// Builds the adjustment ("reorçamento") workbook sent to the supplier.
//
// Layout matches the standard Supplier Budget export (exportSupplierBudget.ts):
//   Sheet 1: "Orçamento"           — every piece + kit, ascending Código,
//                                     adjusted quantities + current prices,
//                                     changed rows highlighted.
//   Sheet 2: "Matriz Lojas x Peças" — the Rateio matrix (delegated to
//                                     appendMatrixSheets) using the adjustment
//                                     quantities.
//   Sheet 3: "Modificações"        — full breakdown of every change
//                                     (standalone pieces and kits/kit-pieces).
//
// The baseline used for "what changed" is the negotiated rateio when one
// exists, otherwise the original campaign rateio — that decision is taken
// by the caller and passed in via `originalStorePieces` + `baselineIsNegotiation`.

import { appendMatrixSheets } from "@/lib/exportMatrixExcelJS";
import { pickPieceImageUrl } from "@/lib/pieceImageVariants";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const BROWN = "FF8C6F4E";
const DARK = "FF1C1916";
const BEIGE = "FFF7F3EC";
const WHITE = "FFFFFFFF";
const BORDER = "FFE5E7EB";
const KIT_BG = "FFEDE3D4";
const GREY = "FF999999";

// Highlight palette (used on Sheet 1 and Sheet 3 to mark changes)
const CHANGE_BG = "FFFFF7CC";       // light yellow — modified row
const CHANGE_FONT = "FF8A6D00";     // amber font
const ADDED_BG = "FFE6F4EA";        // light green — new
const ADDED_FONT = "FF2F855A";
const REMOVED_BG = "FFFFF0F0";      // light red — removed
const REMOVED_FONT = "FFC53030";
const YELLOW_INPUT = "FFFFFFE0";    // editable "novo preço" cells

function moneyFormat(currencyCode: string) {
  if (currencyCode === "USD") return '"US$" #,##0.00;[Red]-"US$" #,##0.00;-';
  if (currencyCode === "CLP") return '"CLP$" #,##0;[Red]-"CLP$" #,##0;-';
  if (currencyCode === "EUR") return '"€" #,##0.00;[Red]-"€" #,##0.00;-';
  return '"R$" #,##0.00;[Red]-"R$" #,##0.00;-';
}

const PIECE_FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  specification: "Especificação",
  size: "Tamanho",
  category: "Categoria",
  sub_location: "Sub-localização",
};

export interface AdjustmentProposalParams {
  adjustment: { id: string; name: string };
  campaignName: string;
  agencyName: string;
  clientName: string;
  currencyCode: string;
  supplier: { id: string; company_name: string; contact_name: string };

  /** Adjustment pieces (campaign_adjustment_pieces) — includes is_new / is_deleted / change_type. */
  pieces: any[];
  /** Adjustment kits (campaign_adjustment_kits). */
  kits: any[];
  /** Adjustment kit composition (campaign_adjustment_kit_pieces). */
  kitPieces: any[];

  /** Source kits from campaign_kits (used for the kit Código + original name). */
  sourceKits: { id: string; code: number; name: string; image_url?: string | null }[];
  /** Source pieces from campaign_pieces (used to resolve names of pieces that
   *  were removed from a kit and have no row in the adjustment_pieces list). */
  sourcePieces: { id: string; code: number; name: string; image_url?: string | null; image_thumb_url?: string | null; image_report_url?: string | null; image_full_url?: string | null }[];
  /** Original kit composition (campaign_kit_pieces) for change detection. */
  originalKitPieces: { kit_id: string; piece_id: string; quantity: number }[];

  stores: { id: string; name: string; nickname?: string | null; city?: string | null; state?: string | null }[];

  /** Previous rateio (negotiation when it exists, otherwise original campaign rateio).
   *  piece_id refers to the **source** (campaign_pieces) id. */
  originalStorePieces: { store_id: string; piece_id: string; quantity: number }[];
  /** Adjustment rateio (campaign_adjustment_store_pieces).
   *  piece_id refers to the **adjustment** piece id. */
  adjustmentStorePieces: { store_id: string; piece_id: string; quantity: number }[];

  /** budget_prices for the winner supplier. piece_id = source piece id. */
  currentPrices: { piece_id: string; unit_price: number; adjusted_unit_price: number | null }[];
  extraCosts: { installation_value: number; freight_value: number };

  /** True if `originalStorePieces` came from a negotiation rather than the
   *  original campaign rateio. Drives wording in the Modificações sheet. */
  baselineIsNegotiation?: boolean;
}

export interface AdjustmentChangeSummary {
  modified: number;
  added: number;
  removed: number;
}

export function summarizeAdjustmentChanges(pieces: any[]): AdjustmentChangeSummary {
  let modified = 0, added = 0, removed = 0;
  for (const p of pieces) {
    if (p.is_deleted) removed++;
    else if (p.is_new || p.change_type === "added") added++;
    else if (p.change_type === "modified") modified++;
  }
  return { modified, added, removed };
}

type RowKind = "kit_header" | "kit_piece" | "standalone_piece";
type ChangeKind = "unchanged" | "modified" | "added" | "removed" | "qty";

type WorkbookImage = { base64: string; ext: "png" | "jpeg"; width: number; height: number };

async function fetchWorkbookImage(url?: string | null): Promise<WorkbookImage | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    let binary = "";
    uint8.forEach((b) => { binary += String.fromCharCode(b); });
    const blobUrl = URL.createObjectURL(blob);
    const size = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(blobUrl); };
      img.onerror = () => { resolve({ width: 160, height: 120 }); URL.revokeObjectURL(blobUrl); };
      img.src = blobUrl;
    });
    return { base64: btoa(binary), ext: blob.type.includes("png") ? "png" : "jpeg", ...size };
  } catch {
    return null;
  }
}

/**
 * Writes a small color legend (one row per change kind) to the given worksheet.
 * Used at the bottom of every sheet so the supplier always knows what each
 * color means without having to flip back to Sheet 1.
 */
function writeLegend(ws: any, lastColLetter: string) {
  const items: { bg: string; font: string; label: string; desc: string }[] = [
    { bg: "FFFFFFFF", font: "FF1C1916", label: "Sem alteração", desc: "Item mantido — preço/quantidade inalterados." },
    { bg: CHANGE_BG, font: CHANGE_FONT, label: "Modificada", desc: "Item ou quantidade alterada nesta solicitação." },
    { bg: ADDED_BG, font: ADDED_FONT, label: "Nova", desc: "Item incluído neste reorçamento." },
    { bg: REMOVED_BG, font: REMOVED_FONT, label: "Removida", desc: "Item removido neste reorçamento." },
  ];
  const titleRow = ws.addRow(["Legenda de cores"]);
  ws.mergeCells(`A${titleRow.number}:${lastColLetter}${titleRow.number}`);
  const tc = titleRow.getCell(1);
  tc.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  tc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1C1916" } };
  tc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  titleRow.height = 22;
  for (const it of items) {
    const r = ws.addRow([it.label, it.desc]);
    ws.mergeCells(`B${r.number}:${lastColLetter}${r.number}`);
    const c1 = r.getCell(1);
    c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: it.bg } };
    c1.font = { bold: true, color: { argb: it.font } };
    c1.alignment = { horizontal: "center", vertical: "middle" };
    c1.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
    const c2 = r.getCell(2);
    c2.font = { italic: true, color: { argb: "FF1C1916" }, size: 10 };
    c2.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
    r.height = 20;
  }
}

interface OrcamentoRow {
  kind: RowKind;
  code: number | undefined;
  name: string;
  specification?: string;
  size?: string;
  qty: number;
  unitPrice: number | null;
  lineTotal: number;
  change: ChangeKind;
  /** kit code this kit_piece belongs to (only for kit_piece rows) */
  parentKitCode?: number;
}

export async function buildAdjustmentProposalWorkbook(
  params: AdjustmentProposalParams,
): Promise<{ blob: Blob; fileName: string }> {
  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "ProduzAI";
  wb.created = new Date();

  const money = moneyFormat(params.currencyCode);

  // ── Lookup maps ────────────────────────────────────────────────────────
  const sourceKitById = new Map(params.sourceKits.map((k) => [k.id, k]));
  const sourcePieceById = new Map(params.sourcePieces.map((p) => [p.id, p]));
  const pieceImageUrl = (p: any): string | null => {
    const source = p?.source_piece_id ? sourcePieceById.get(p.source_piece_id) : undefined;
    return pickPieceImageUrl({ ...(source || {}), ...(p || {}) }, "report");
  };
  const sourcePieceImageUrl = (sourcePieceId: string): string | null =>
    pickPieceImageUrl(sourcePieceById.get(sourcePieceId), "report");
  const kitImageUrl = (k: any): string | null => {
    const source = k?.source_kit_id ? sourceKitById.get(k.source_kit_id) : undefined;
    return (k?.image_report_url || k?.image_url || source?.image_url || null) as string | null;
  };

  // Adjustment piece id -> source piece id (and back).
  const adjPieceById = new Map<string, any>();
  const adjBySourcePieceId = new Map<string, any>();
  for (const p of params.pieces) {
    adjPieceById.set(p.id, p);
    if (p.source_piece_id) adjBySourcePieceId.set(p.source_piece_id, p);
  }

  // Quantity per adjustment piece id (sum across stores).
  const adjQtyByPieceId = new Map<string, number>();
  for (const sp of params.adjustmentStorePieces) {
    adjQtyByPieceId.set(sp.piece_id, (adjQtyByPieceId.get(sp.piece_id) || 0) + Number(sp.quantity || 0));
  }
  // Baseline (negotiated or original) qty per source piece id.
  const baseQtyBySourceId = new Map<string, number>();
  for (const sp of params.originalStorePieces) {
    baseQtyBySourceId.set(sp.piece_id, (baseQtyBySourceId.get(sp.piece_id) || 0) + Number(sp.quantity || 0));
  }

  // Price per source piece id (adjusted ?? unit).
  const priceBySourceId = new Map<string, number>();
  for (const pr of params.currentPrices) {
    const v = pr.adjusted_unit_price != null ? Number(pr.adjusted_unit_price) : Number(pr.unit_price || 0);
    priceBySourceId.set(pr.piece_id, v);
  }
  const priceForAdjPiece = (p: any): number => {
    if (!p.source_piece_id) return 0;
    return priceBySourceId.get(p.source_piece_id) ?? 0;
  };
  const imageCache = new Map<string, Promise<WorkbookImage | null>>();
  const addImageToCell = async (ws: any, rowNumber: number, colNumber: number, url?: string | null) => {
    if (!url) return;
    if (!imageCache.has(url)) imageCache.set(url, fetchWorkbookImage(url));
    const img = await imageCache.get(url)!;
    if (!img) return;
    const maxW = 72;
    const maxH = 54;
    const ratio = img.width / img.height;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    const imageId = wb.addImage({ base64: img.base64, extension: img.ext });
    ws.addImage(imageId, {
      tl: { col: colNumber - 1 + 0.08, row: rowNumber - 1 + 0.12 },
      ext: { width: Math.round(w), height: Math.round(h) },
    });
    ws.getCell(rowNumber, colNumber).value = "";
  };

  // ── Compute kit-pieces change map (per adjustment kit) ─────────────────
  // For each adjustment kit, what changed inside (added / removed / qty).
  type KitPieceChange = {
    sourcePieceId: string;
    pieceCode: number | undefined;
    pieceName: string;
    change: "added" | "removed" | "qty" | "modified";
    origQty: number;
    adjQty: number;
    detail?: string;
  };
  const kitPieceChangesByAdjKit = new Map<string, KitPieceChange[]>();
  for (const k of params.kits) {
    const orig = new Map<string, number>(); // source_piece_id -> qty
    if (k.source_kit_id) {
      params.originalKitPieces
        .filter((kp) => kp.kit_id === k.source_kit_id)
        .forEach((kp) => orig.set(kp.piece_id, Number(kp.quantity || 0)));
    }
    const cur = new Map<string, number>(); // source_piece_id -> qty
    params.kitPieces
      .filter((kp) => kp.kit_id === k.id)
      .forEach((kp) => {
        const adjP = adjPieceById.get(kp.piece_id);
        if (adjP?.is_deleted) return;
        const srcId = adjP?.source_piece_id ?? kp.piece_id;
        cur.set(srcId, Number(kp.quantity || 0));
      });
    const ids = new Set<string>([...orig.keys(), ...cur.keys()]);
    const out: KitPieceChange[] = [];
    ids.forEach((pid) => {
      const o = orig.get(pid) ?? 0;
      const a = cur.get(pid) ?? 0;
      const adjP = adjBySourcePieceId.get(pid);
      const fieldChanges = adjP?.change_type === "modified"
        ? Object.keys(PIECE_FIELD_LABELS).filter((key) => String((adjP.original_snapshot || {})[key] ?? "") !== String(adjP[key] ?? ""))
        : [];
      if (o === a && fieldChanges.length === 0) return;
      const meta =
        sourcePieceById.get(pid) ||
        (adjBySourcePieceId.get(pid) && {
          code: adjBySourcePieceId.get(pid).code,
          name: adjBySourcePieceId.get(pid).name,
        });
      out.push({
        sourcePieceId: pid,
        pieceCode: meta?.code,
        pieceName: adjP?.name ?? meta?.name ?? "—",
        change: o === 0 ? "added" : a === 0 ? "removed" : fieldChanges.length > 0 ? "modified" : "qty",
        origQty: o,
        adjQty: a,
        detail: fieldChanges.map((key) => `${PIECE_FIELD_LABELS[key]}: "${(adjP.original_snapshot || {})[key] ?? ""}" → "${adjP[key] ?? ""}"`).join("\n"),
      });
    });
    if (out.length > 0) kitPieceChangesByAdjKit.set(k.id, out);
  }

  // ── Build the unified row list for Sheet 1 ─────────────────────────────
  // Strategy:
  //   • One "kit_header" row per adjustment kit, followed by its component
  //     "kit_piece" rows (drawn from the adjustment composition).
  //   • One "standalone_piece" row per non-kit_only piece that is NOT a
  //     component of any kit in this adjustment.
  //   • A piece is a "kit component" iff it appears in adjustment kit_pieces.
  //   • Rows are produced grouped by the kit/piece's Código (ascending),
  //     with kit components emitted under their kit header.

  const piecesInAnyAdjKit = new Set<string>(params.kitPieces.map((kp) => kp.piece_id));
  const sourcePiecesInAnyKit = new Set<string>(params.originalKitPieces.map((kp) => kp.piece_id));
  const isKitPiece = (p: any) => piecesInAnyAdjKit.has(p.id) || (!!p.source_piece_id && sourcePiecesInAnyKit.has(p.source_piece_id));

  const kitTotalQty = (kitId: string): number => {
    const kpList = params.kitPieces.filter((kp) => kp.kit_id === kitId);
    if (kpList.length === 0) return 0;
    return Math.min(
      ...kpList.map((kp) => {
        const total = adjQtyByPieceId.get(kp.piece_id) || 0;
        return Math.floor(total / (Number(kp.quantity) || 1));
      })
    );
  };

  const isPieceChanged = (p: any): ChangeKind => {
    if (p.is_deleted) return "removed";
    if (p.is_new || p.change_type === "added") return "added";
    if (p.change_type === "modified") return "modified";
    // Quantity-only change vs baseline:
    const adjQ = adjQtyByPieceId.get(p.id) || 0;
    const baseQ = p.source_piece_id ? (baseQtyBySourceId.get(p.source_piece_id) || 0) : 0;
    if (adjQ !== baseQ) return "qty";
    return "unchanged";
  };

  const isKitChanged = (k: any): ChangeKind => {
    if (k.is_deleted) return "removed";
    if (k.change_type === "added") return "added";
    if (k.change_type === "modified") return "modified";
    if ((kitPieceChangesByAdjKit.get(k.id)?.length ?? 0) > 0) return "modified";
    return "unchanged";
  };

  type Group = { code: number; render: () => OrcamentoRow[] };
  const groups: Group[] = [];

  // Kit groups
  for (const k of params.kits) {
    const sk = k.source_kit_id ? sourceKitById.get(k.source_kit_id) : null;
    const kitCode = sk?.code ?? Number.MAX_SAFE_INTEGER;
    groups.push({
      code: kitCode,
      render: () => {
        const out: OrcamentoRow[] = [];
        const kQty = kitTotalQty(k.id);
        out.push({
          kind: "kit_header",
          code: sk?.code,
          name: k.name,
          qty: kQty,
          unitPrice: null,
          lineTotal: 0,
          change: isKitChanged(k),
        });
        // Kit pieces — emit in ascending piece code order
        const kpEntries = params.kitPieces
          .filter((kp) => kp.kit_id === k.id)
          .map((kp) => {
            const adjP = adjPieceById.get(kp.piece_id);
            return { kp, adjP };
          })
          .filter((x) => !!x.adjP)
          .sort((a, b) => (a.adjP.code ?? 0) - (b.adjP.code ?? 0));
        for (const { kp, adjP } of kpEntries) {
          const qty = (adjQtyByPieceId.get(adjP.id) || 0);
          const price = priceForAdjPiece(adjP);
          out.push({
            kind: "kit_piece",
            code: adjP.code,
            name: adjP.name,
            specification: adjP.specification,
            size: adjP.size,
            qty,
            unitPrice: price,
            lineTotal: price * qty,
            change: isPieceChanged(adjP),
            parentKitCode: sk?.code,
          });
        }
        return out;
      },
    });
  }

  // Standalone pieces (not part of any adjustment kit, and not kit_only)
  for (const p of params.pieces) {
    if (p.kit_only) continue;
    if (isKitPiece(p)) continue;
    const code = (p.code as number | undefined) ?? Number.MAX_SAFE_INTEGER;
    groups.push({
      code,
      render: () => {
        const qty = adjQtyByPieceId.get(p.id) || 0;
        const price = priceForAdjPiece(p);
        return [{
          kind: "standalone_piece",
          code: p.code,
          name: p.name,
          specification: p.specification,
          size: p.size,
          qty,
          unitPrice: price,
          lineTotal: price * qty,
          change: isPieceChanged(p),
        }];
      },
    });
  }

  groups.sort((a, b) => a.code - b.code);
  const orcamentoRows: OrcamentoRow[] = groups.flatMap((g) => g.render());

  // ─────────────────────────────────────────────────────────
  // SHEET 1 — Orçamento
  // ─────────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet("Orçamento", { views: [{ showGridLines: false }] });

  const TOTAL_COLS = 9;
  const lastColLetter = "I";

  ws1.mergeCells(`A1:${lastColLetter}1`);
  const t1 = ws1.getCell("A1");
  t1.value = [params.agencyName, params.clientName].filter(Boolean).join(" | ") || "ProduzAI";
  t1.font = { name: "Arial", size: 10, color: { argb: WHITE } };
  t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
  t1.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(1).height = 20;

  ws1.mergeCells(`A2:${lastColLetter}2`);
  const t2 = ws1.getCell("A2");
  t2.value = `${(params.campaignName || "").toUpperCase()} — REORÇAMENTO`;
  t2.font = { name: "Arial", size: 14, bold: true, color: { argb: WHITE } };
  t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
  t2.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(2).height = 26;

  ws1.mergeCells(`A3:${lastColLetter}3`);
  const t3 = ws1.getCell("A3");
  t3.value = `Fornecedor: ${params.supplier.company_name} · Ajuste: ${params.adjustment.name}`;
  t3.font = { name: "Arial", size: 11, bold: true, color: { argb: DARK } };
  t3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
  t3.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(3).height = 22;

  ws1.getRow(4).height = 6;

  const headerRowIdx = 5;
  const header = ws1.getRow(headerRowIdx);
  header.values = [
    "Foto",
    "Tipo",
    "Código",
    "Item / Especificação",
    "Qtd Total",
    "Preço Atual",
    "Total Atual",
    "Novo Preço Unit.",
    "Novo Total",
  ];
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: BORDER } },
      bottom: { style: "thin", color: { argb: BORDER } },
      left: { style: "thin", color: { argb: BORDER } },
      right: { style: "thin", color: { argb: BORDER } },
    };
  });

  let bodyEvenIdx = 0;
  let totalCurrent = 0;
  for (const r of orcamentoRows) {
    const isKitHeader = r.kind === "kit_header";
    const baseBg = isKitHeader ? KIT_BG : (bodyEvenIdx % 2 === 0 ? WHITE : BEIGE);
    if (!isKitHeader) bodyEvenIdx++;

    // Override background for changed rows
    let bg = baseBg;
    if (r.change === "added") bg = ADDED_BG;
    else if (r.change === "removed") bg = REMOVED_BG;
    else if (r.change === "modified" || r.change === "qty") bg = CHANGE_BG;

    const codeCell = r.code != null ? r.code : "";
    const desc = [r.name, r.specification, r.size].filter(Boolean).join(" — ");

    // Decide whether the "Novo Preço" cells are editable inputs (yellow)
    // or just a repeat of the current price (normal background).
    // Rule: only items that were actually changed get the yellow input.
    // Unchanged items keep the same price, repeated with the row's normal bg.
    const needsNewPriceInput = !isKitHeader && (r.change === "added" || r.change === "modified" || r.change === "qty");
    const repeatCurrentPrice = !isKitHeader && r.change === "unchanged";

    const row = ws1.addRow([
      "📷",
      isKitHeader ? "Kit" : r.kind === "kit_piece" ? "Peça do Kit" : "Peça",
      codeCell,
      desc,
      r.qty,
      isKitHeader ? null : r.unitPrice,
      isKitHeader ? null : r.lineTotal,
      isKitHeader ? null : (repeatCurrentPrice ? r.unitPrice : null),
      isKitHeader ? null : (repeatCurrentPrice ? r.lineTotal : null),
    ]);

    if (!isKitHeader) totalCurrent += r.lineTotal;

    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
        horizontal: col >= 5 ? "right" : col === 1 || col === 3 ? "center" : "left",
      };
      cell.font = { bold: isKitHeader };
      cell.border = {
        top: { style: "thin", color: { argb: BORDER } },
        bottom: { style: "thin", color: { argb: BORDER } },
        left: { style: "thin", color: { argb: BORDER } },
        right: { style: "thin", color: { argb: BORDER } },
      };
      if (col === 6 || col === 7 || col === 8 || col === 9) cell.numFmt = money;
    });

    // Photo placeholder cell styling
    const photoCell = row.getCell(1);
    photoCell.font = { name: "Arial", size: 14, color: { argb: GREY } };

    // Highlight the Tipo cell for changed rows + add a status word
    if (r.change !== "unchanged") {
      const statusText =
        r.change === "added" ? "NOVA" :
        r.change === "removed" ? "REMOVIDA" :
        r.change === "modified" ? "MODIFICADA" :
        "QTD ALTERADA";
      const cCode = row.getCell(3);
      cCode.value = `${codeCell !== "" ? codeCell : "—"} (${statusText})`;
      cCode.font = {
        bold: true,
        color: { argb:
          r.change === "added" ? ADDED_FONT :
          r.change === "removed" ? REMOVED_FONT :
          CHANGE_FONT },
      };
      if (r.change === "removed") {
        row.eachCell({ includeEmpty: false }, (c) => {
          c.font = { ...(c.font || {}), strike: true, color: { argb: REMOVED_FONT } };
        });
      }
    }

    // Yellow editable cells only on rows that actually changed
    if (needsNewPriceInput) {
      const npUnit = row.getCell(8);
      const npTotal = row.getCell(9);
      // Total = Qty * Novo Preço Unit.  (col E = 5, col H = 8)
      const formulaTotal = { formula: `IF(H${row.number}="","",E${row.number}*H${row.number})` } as any;
      npTotal.value = formulaTotal;
      for (const c of [npUnit, npTotal]) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW_INPUT } };
        c.numFmt = money;
        c.border = {
          top: { style: "medium", color: { argb: BROWN } },
          bottom: { style: "medium", color: { argb: BROWN } },
          left: { style: "medium", color: { argb: BROWN } },
          right: { style: "medium", color: { argb: BROWN } },
        };
      }
    }
  }

  // Totals
  ws1.addRow([]);
  const addTotalRow = (label: string, value: number | null, emphasized = false, editable = false) => {
    const r = ws1.addRow(["", "", "", "", "", label, value, null, null]);
    r.getCell(6).alignment = { horizontal: "right", vertical: "middle" };
    r.getCell(7).alignment = { horizontal: "right", vertical: "middle" };
    r.getCell(7).numFmt = money;
    if (emphasized) {
      for (const cn of [6, 7]) {
        r.getCell(cn).font = { bold: true, color: { argb: WHITE } };
        r.getCell(cn).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
      }
    } else {
      r.getCell(6).font = { bold: true };
    }
    if (editable) {
      const np = r.getCell(9);
      np.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW_INPUT } };
      np.numFmt = money;
      np.border = {
        top: { style: "medium", color: { argb: BROWN } },
        bottom: { style: "medium", color: { argb: BROWN } },
        left: { style: "medium", color: { argb: BROWN } },
        right: { style: "medium", color: { argb: BROWN } },
      };
    }
  };
  addTotalRow("Total dos Itens", totalCurrent);
  addTotalRow("Instalação", Number(params.extraCosts.installation_value || 0), false, true);
  addTotalRow("Frete / Despacho", Number(params.extraCosts.freight_value || 0), false, true);
  const grand =
    totalCurrent +
    Number(params.extraCosts.installation_value || 0) +
    Number(params.extraCosts.freight_value || 0);
  addTotalRow("TOTAL ATUAL", grand, true);
  addTotalRow("TOTAL REORÇAMENTO", null, true, true);

  ws1.addRow([]);
  // Legenda de cores (reutilizada nas três abas)
  writeLegend(ws1, lastColLetter);

  ws1.addRow([]);
  const noteRow = ws1.addRow([
    "* Preencha as células destacadas em amarelo (colunas \"Novo Preço Unit.\" e \"Novo Total\") nas linhas que tiveram alteração. Itens sem alteração já vêm com o preço atual repetido.",
  ]);
  ws1.mergeCells(`A${noteRow.number}:${lastColLetter}${noteRow.number}`);
  const nc = noteRow.getCell(1);
  nc.font = { italic: true, color: { argb: DARK }, size: 10 };
  nc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
  nc.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  noteRow.height = 28;

  ws1.columns = [
    { width: 8 },   // Foto
    { width: 14 },  // Tipo
    { width: 18 },  // Código
    { width: 50 },  // Item
    { width: 12 },  // Qtd
    { width: 16 },  // Preço Atual
    { width: 16 },  // Total Atual
    { width: 16 },  // Novo Preço Unit.
    { width: 16 },  // Novo Total
  ];
  ws1.views = [{ state: "frozen", ySplit: headerRowIdx }];

  // ─────────────────────────────────────────────────────────
  // SHEET 2 — Matriz Lojas x Peças (mesmo formato do Rateio)
  // ─────────────────────────────────────────────────────────
  const matrixQtyMap: Record<string, number> = {};
  for (const sp of params.adjustmentStorePieces) {
    matrixQtyMap[`${sp.store_id}-${sp.piece_id}`] = Number(sp.quantity || 0);
  }
  // Filter pieces to those displayed (non-kit_only, not deleted)
  const matrixPieces = params.pieces
    .filter((p: any) => !p.kit_only && !p.is_deleted)
    .map((p: any) => ({
      ...p,
      store_category: p.category,
      specification: p.specification || "",
      image_url: pieceImageUrl(p),
    }));

  // Adjustment kits don't carry codes — synthesize from sourceKitById for matrix labels.
  const matrixKits = params.kits
    .filter((k: any) => !k.is_deleted)
    .map((k: any) => {
      const sk = k.source_kit_id ? sourceKitById.get(k.source_kit_id) : null;
      return { ...k, code: sk?.code ?? 0, image_url: kitImageUrl(k) };
    });

  // Build a change map (item id -> change kind) so the matrix tab can
  // visually highlight pieces/kits that were altered in this adjustment.
  const matrixChangeMap = new Map<string, "added" | "removed" | "modified" | "qty">();
  for (const p of matrixPieces) {
    const k = isPieceChanged(p);
    if (k !== "unchanged") matrixChangeMap.set(p.id, k as any);
  }
  for (const k of matrixKits) {
    const ck = isKitChanged(k);
    if (ck !== "unchanged") matrixChangeMap.set(k.id, ck as any);
  }

  let matrixSheetName: string | null = null;
  try {
    matrixSheetName = await appendMatrixSheets(wb, {
      stores: params.stores as any,
      pieces: matrixPieces as any,
      qtyMap: matrixQtyMap,
      campaignName: params.campaignName,
      kits: matrixKits as any,
      kitPieces: params.kitPieces as any,
      locations: [],
      subLocations: [],
      allPieces: matrixPieces as any,
      agencyName: params.agencyName,
      clientName: params.clientName,
      reservedSheetNames: new Set(["orçamento", "modificações"]),
      skipDashboard: true,
      skipKitTabs: true,
      sortByCode: true,
      changeMap: matrixChangeMap,
    } as any) ?? null;
  } catch {
    // Fail-soft: matrix is decorative; never block the export.
  }

  // Append legend at the bottom of the matrix sheet too
  if (matrixSheetName) {
    const matrixWs = wb.getWorksheet(matrixSheetName);
    if (matrixWs) {
      matrixWs.addRow([]);
      writeLegend(matrixWs, "F");
    }
  }

  // ─────────────────────────────────────────────────────────
  // SHEET 3 — Modificações
  // ─────────────────────────────────────────────────────────
  const ws3 = wb.addWorksheet("Modificações", { views: [{ showGridLines: false }] });

  const writeSectionTitle = (title: string) => {
    const r = ws3.addRow([title]);
    ws3.mergeCells(`A${r.number}:G${r.number}`);
    const c = r.getCell(1);
    c.value = title;
    c.font = { bold: true, color: { argb: WHITE }, size: 12 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
    c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    r.height = 24;
  };
  const writeTableHeader = (cols: string[]) => {
    const r = ws3.addRow(cols);
    r.eachCell((c) => {
      c.font = { bold: true, color: { argb: WHITE } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      c.border = {
        top: { style: "thin", color: { argb: BORDER } },
        bottom: { style: "thin", color: { argb: BORDER } },
        left: { style: "thin", color: { argb: BORDER } },
        right: { style: "thin", color: { argb: BORDER } },
      };
    });
    r.height = 22;
  };
  const styleDataRow = (r: any, kind: ChangeKind) => {
    const bg =
      kind === "added" ? ADDED_BG :
      kind === "removed" ? REMOVED_BG :
      kind === "modified" || kind === "qty" ? CHANGE_BG : WHITE;
    r.eachCell({ includeEmpty: true }, (c: any) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      c.alignment = c.alignment || { vertical: "middle" };
      c.alignment = { ...c.alignment, vertical: "middle", wrapText: true };
      c.border = {
        top: { style: "thin", color: { argb: BORDER } },
        bottom: { style: "thin", color: { argb: BORDER } },
        left: { style: "thin", color: { argb: BORDER } },
        right: { style: "thin", color: { argb: BORDER } },
      };
    });
  };

  const baselineLabel = params.baselineIsNegotiation ? "Negociado" : "Original";

  // ── Section 1: Standalone pieces (regular, non-kit) ──────────────────
  const standalonePieces = params.pieces.filter((p: any) => !p.kit_only && !isKitPiece(p));
  const piecePieceChangeRows: { p: any; kind: ChangeKind }[] = [];
  for (const p of standalonePieces) {
    const k = isPieceChanged(p);
    if (k !== "unchanged") piecePieceChangeRows.push({ p, kind: k });
  }

  writeSectionTitle("Peças (alteradas, removidas e novas)");
  writeTableHeader([
    "Imagem",
    "Código",
    "Peça",
    "Alteração",
    "Detalhe",
    `Qtd ${baselineLabel}`,
    "Qtd Ajuste",
  ]);

  if (piecePieceChangeRows.length === 0) {
    const r = ws3.addRow(["—", "Nenhuma peça (não-kit) com alteração.", "", "", "", "", ""]);
    ws3.mergeCells(`B${r.number}:G${r.number}`);
    r.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    r.getCell(2).font = { italic: true, color: { argb: GREY } };
    styleDataRow(r, "unchanged");
  } else {
    for (const { p, kind } of piecePieceChangeRows) {
      const adjQ = adjQtyByPieceId.get(p.id) || 0;
      const baseQ = p.source_piece_id ? (baseQtyBySourceId.get(p.source_piece_id) || 0) : 0;

      if (kind === "added") {
        const r = ws3.addRow(["", p.code ?? "", p.name, "Nova", "Peça incluída no ajuste.", 0, adjQ]);
        styleDataRow(r, "added");
        r.height = 58;
        await addImageToCell(ws3, r.number, 1, pieceImageUrl(p));
      } else if (kind === "removed") {
        const r = ws3.addRow(["", p.code ?? "", p.name, "Removida", "Peça removida do ajuste.", baseQ, 0]);
        styleDataRow(r, "removed");
        r.height = 58;
        await addImageToCell(ws3, r.number, 1, pieceImageUrl(p));
      } else if (kind === "modified") {
        const snap = p.original_snapshot || {};
        const fields = Object.keys(PIECE_FIELD_LABELS).filter((k) => String(snap[k] ?? "") !== String((p as any)[k] ?? ""));
        const detail = fields.length === 0
          ? "Campos modificados."
          : fields.map((k) => `${PIECE_FIELD_LABELS[k]}: "${snap[k] ?? ""}" → "${(p as any)[k] ?? ""}"`).join("\n");
        const r = ws3.addRow(["", p.code ?? "", p.name, "Modificada", detail, baseQ, adjQ]);
        styleDataRow(r, "modified");
        r.getCell(5).alignment = { vertical: "top", wrapText: true };
        r.height = Math.max(58, Math.min(120, 14 + 14 * Math.max(1, fields.length)));
        await addImageToCell(ws3, r.number, 1, pieceImageUrl(p));
      } else if (kind === "qty") {
        const r = ws3.addRow(["", p.code ?? "", p.name, "Quantidade", `${baseQ} → ${adjQ} (${adjQ - baseQ >= 0 ? "+" : ""}${adjQ - baseQ})`, baseQ, adjQ]);
        styleDataRow(r, "qty");
        r.height = 58;
        await addImageToCell(ws3, r.number, 1, pieceImageUrl(p));
      }
    }
  }

  ws3.addRow([]);

  // ── Section 2: Kits & kit-pieces ─────────────────────────────────────
  writeSectionTitle("Kits (alterados, removidos e novos) — incluindo peças dentro dos kits");
  writeTableHeader([
    "Imagem",
    "Cód. Kit",
    "Kit",
    "Cód. Peça",
    "Peça do Kit",
    "Alteração",
    "Detalhe",
  ]);

  const changedKits = params.kits.filter((k: any) => isKitChanged(k) !== "unchanged");
  if (changedKits.length === 0) {
    const r = ws3.addRow(["—", "Nenhum kit com alteração.", "", "", "", "", ""]);
    ws3.mergeCells(`B${r.number}:G${r.number}`);
    r.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    r.getCell(2).font = { italic: true, color: { argb: GREY } };
    styleDataRow(r, "unchanged");
  } else {
    for (const k of changedKits) {
      const sk = k.source_kit_id ? sourceKitById.get(k.source_kit_id) : null;
      const kCode = sk?.code ?? "";
      const kKind = isKitChanged(k);

      // Kit-level row
      let kitDetail = "";
      if (kKind === "added") kitDetail = "Kit adicionado no ajuste.";
      else if (kKind === "removed") kitDetail = "Kit removido do ajuste.";
      else {
        const parts: string[] = [];
        if (sk && sk.name && sk.name !== k.name) parts.push(`Nome: "${sk.name}" → "${k.name}"`);
        const kp = kitPieceChangesByAdjKit.get(k.id) ?? [];
        if (kp.length > 0) parts.push(`${kp.length} peça(s) do kit alteradas (ver linhas abaixo)`);
        kitDetail = parts.join("\n") || "Kit modificado.";
      }
      const kr = ws3.addRow(["", kCode, k.name, "—", "—", kKind === "added" ? "Novo" : kKind === "removed" ? "Removido" : "Modificado", kitDetail]);
      styleDataRow(kr, kKind);
      kr.height = 58;
      kr.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      kr.getCell(7).alignment = { vertical: "top", wrapText: true };
      kr.eachCell({ includeEmpty: false }, (c: any) => { c.font = { ...(c.font || {}), bold: true }; });
      await addImageToCell(ws3, kr.number, 1, kitImageUrl(k));

      // Kit-piece rows
      const kpChanges = kitPieceChangesByAdjKit.get(k.id) ?? [];
      for (const ch of kpChanges) {
        const detail =
          ch.change === "added"  ? `Peça adicionada ao kit (qtd por kit: ${ch.adjQty}).` :
          ch.change === "removed" ? `Peça removida do kit (era ${ch.origQty} por kit).` :
          ch.change === "modified" ? (ch.detail || "Campos da peça alterados dentro do kit.") :
                                    `Quantidade por kit: ${ch.origQty} → ${ch.adjQty} (${ch.adjQty - ch.origQty >= 0 ? "+" : ""}${ch.adjQty - ch.origQty}).`;
        const label =
          ch.change === "added" ? "Peça nova no kit" :
          ch.change === "removed" ? "Peça removida do kit" :
          ch.change === "modified" ? "Peça alterada no kit" :
          "Qtd por kit alterada";
        const r = ws3.addRow(["", "", "↳ " + (k.name || ""), ch.pieceCode ?? "", ch.pieceName, label, detail]);
        styleDataRow(r, ch.change === "added" ? "added" : ch.change === "removed" ? "removed" : ch.change === "modified" ? "modified" : "qty");
        r.height = 58;
        r.getCell(3).font = { italic: true, color: { argb: GREY } };
        await addImageToCell(ws3, r.number, 1, sourcePieceImageUrl(ch.sourcePieceId));
      }
    }
  }

  ws3.columns = [
    { width: 14 },
    { width: 12 },
    { width: 36 },
    { width: 12 },
    { width: 36 },
    { width: 22 },
    { width: 60 },
  ];

  // ── Build blob ────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });

  const sanitize = (s?: string) =>
    (s || "").trim().replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, "").replace(/\s+/g, "_").slice(0, 40);
  const today = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
  const fileName = `Reorcamento_${sanitize(params.campaignName)}_${sanitize(params.adjustment.name)}_${sanitize(params.supplier.company_name)}_${today}.xlsx`;

  return { blob, fileName };
}
