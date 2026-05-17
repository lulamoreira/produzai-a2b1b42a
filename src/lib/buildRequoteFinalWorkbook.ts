// FINAL post-approval requote workbook.
//
// Layout (matches the standard Rateio / Matriz Lojas x Peças the user
// already exports across the app):
//   Sheet 1: "Preços (Recotação)" — ALL pieces + kits with qty, preço
//                                    anterior, novo preço, novo total,
//                                    instalação, frete, total geral.
//   Sheet 2: "Matriz Lojas x Peças" — full transposed matrix delegated to
//                                     appendMatrixSheets (same look as the
//                                     standalone Rateio export).
//   Sheet 3..N: "Kit ..." — one tab per kit, also via appendMatrixSheets.
//
// Data sources:
//   * stores / pieces / kits / kit_pieces / store_pieces → from the
//     post-adjustment snapshot in campaign_adjustment_* tables, enriched
//     with image_url / specification / installation_instructions resolved
//     from campaign_pieces via source_piece_id.
//   * previousPrice (per piece) → budget_prices.adjusted_unit_price for
//     the winning supplier (keyed by source piece id).
//   * newPrice (per piece) → approved jsonb on
//     campaign_adjustment_budget_request.adjusted_prices_jsonb. Falls back
//     to previousPrice when not present (i.e. unchanged piece).

import { appendMatrixSheets } from "@/lib/exportMatrixExcelJS";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const BROWN = "FF8C6F4E";
const DARK = "FF1C1916";
const BEIGE = "FFF7F3EC";
const WHITE = "FFFFFFFF";
const BORDER = "FFE5E7EB";
const KIT_BG = "FFEDE3D4";

const HIGHLIGHT = "FFFFF7CC";
const INCREASE = "FFB91C1C";
const DECREASE = "FF15803D";

function moneyFormat(currencyCode: string) {
  if (currencyCode === "USD") return '"US$" #,##0.00;[Red]-"US$" #,##0.00;-';
  if (currencyCode === "CLP") return '"CLP$" #,##0;[Red]-"CLP$" #,##0;-';
  if (currencyCode === "EUR") return '"€" #,##0.00;[Red]-"€" #,##0.00;-';
  return '"R$" #,##0.00;[Red]-"R$" #,##0.00;-';
}

function fmtPct(prev: number, next: number): string {
  if (!prev) return next > 0 ? "novo" : "—";
  const p = ((next - prev) / prev) * 100;
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}%`;
}

export interface RequoteFinalSourcePiece {
  id: string;
  code: number;
  name: string;
  image_url?: string | null;
  image_thumb_url?: string | null;
  image_report_url?: string | null;
  image_full_url?: string | null;
  specification?: string | null;
  installation_instructions?: string | null;
  category?: string | null;
  sub_location?: string | null;
  size?: string | null;
}

export interface RequoteFinalSourceKit {
  id: string;
  code: number;
  name: string;
  image_url?: string | null;
  category?: string | null;
  sub_location?: string | null;
}

export interface RequoteFinalAdjPiece {
  id: string;
  source_piece_id: string | null;
  code: number;
  name: string;
  specification?: string | null;
  size?: string | null;
  category?: string | null;
  sub_location?: string | null;
  is_new?: boolean | null;
  is_deleted?: boolean | null;
  kit_only?: boolean | null;
}

export interface RequoteFinalAdjKit {
  id: string;
  source_kit_id: string | null;
  name: string;
  is_deleted?: boolean | null;
}

export interface RequoteFinalAdjKitPiece {
  id: string;
  kit_id: string;
  piece_id: string;
  quantity: number;
}

export interface RequoteFinalStoreRow {
  id: string;
  name: string;
  nickname?: string | null;
  city?: string | null;
  state?: string | null;
  store_code?: string | null;
  showcase_count?: number | null;
}

export interface RequoteFinalParams {
  campaignName: string;
  agencyName?: string;
  clientName?: string;
  adjustmentName: string;
  supplierName: string;
  currencyCode: string;

  /** Adjustment-side snapshot (post-adjustment authoritative state). */
  adjPieces: RequoteFinalAdjPiece[];
  adjKits: RequoteFinalAdjKit[];
  adjKitPieces: RequoteFinalAdjKitPiece[];
  /** piece_id refers to adjustment piece id. */
  adjStorePieces: { store_id: string; piece_id: string; quantity: number }[];
  /** Stores carrying rateio (live client_stores filtered to those used). */
  stores: RequoteFinalStoreRow[];

  /** Source campaign tables to resolve image / specification / código de kit. */
  sourcePieces: RequoteFinalSourcePiece[];
  sourceKits: RequoteFinalSourceKit[];

  /** budget_prices.adjusted_unit_price (keyed by source piece id). */
  previousPriceBySourcePiece: Record<string, number>;
  /** Approved new prices (keyed by adjustment piece id). */
  newPriceByAdjPiece: Record<string, number>;

  previousInstallation: number;
  previousFreight: number;
  newInstallation: number;
  newFreight: number;

  generatedAt: Date;
}

export async function buildRequoteFinalWorkbook(
  params: RequoteFinalParams,
): Promise<{ blob: Blob; fileName: string }> {
  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "ProduzAI";
  wb.created = params.generatedAt;

  const money = moneyFormat(params.currencyCode);

  // ─── Helpers / lookups ──────────────────────────────────
  const sourcePieceById = new Map(params.sourcePieces.map((p) => [p.id, p]));
  const sourceKitById = new Map(params.sourceKits.map((k) => [k.id, k]));

  const pieceImage = (sourceId: string | null | undefined): string | null => {
    if (!sourceId) return null;
    const s = sourcePieceById.get(sourceId);
    return (
      s?.image_report_url ||
      s?.image_full_url ||
      s?.image_url ||
      s?.image_thumb_url ||
      null
    );
  };
  const kitImage = (sourceKitId: string | null | undefined): string | null => {
    if (!sourceKitId) return null;
    const s = sourceKitById.get(sourceKitId);
    return s?.image_url || null;
  };
  const kitCode = (sourceKitId: string | null | undefined): number => {
    if (!sourceKitId) return 0;
    return sourceKitById.get(sourceKitId)?.code ?? 0;
  };
  const sourcePieceMeta = (sourceId: string | null | undefined) =>
    sourceId ? sourcePieceById.get(sourceId) : undefined;

  // Live, non-deleted adjustment pieces (everything in the post-adjustment
  // campaign — both standalone and kit-only pieces).
  const livePieces = params.adjPieces.filter((p) => !p.is_deleted);
  const liveKits = params.adjKits.filter((k) => !k.is_deleted);

  // qty per adjustment piece across all stores
  const qtyByAdjPiece: Record<string, number> = {};
  for (const sp of params.adjStorePieces) {
    qtyByAdjPiece[sp.piece_id] =
      (qtyByAdjPiece[sp.piece_id] || 0) + Number(sp.quantity || 0);
  }

  // For a kit: qty = min over its component pieces of floor(pieceQty / qtyInKit)
  // computed per store, then summed.
  const kitPiecesByKit = new Map<string, RequoteFinalAdjKitPiece[]>();
  for (const kp of params.adjKitPieces) {
    const arr = kitPiecesByKit.get(kp.kit_id) || [];
    arr.push(kp);
    kitPiecesByKit.set(kp.kit_id, arr);
  }
  const qtyByStorePiece = new Map<string, number>(); // key = store-piece
  for (const sp of params.adjStorePieces) {
    qtyByStorePiece.set(`${sp.store_id}-${sp.piece_id}`, Number(sp.quantity || 0));
  }
  const qtyByKit = new Map<string, number>();
  const qtyByStoreKit = new Map<string, number>(); // key = store-kit
  for (const kit of liveKits) {
    const kps = kitPiecesByKit.get(kit.id) || [];
    if (kps.length === 0) {
      qtyByKit.set(kit.id, 0);
      continue;
    }
    let total = 0;
    for (const s of params.stores) {
      const perStore = Math.min(
        ...kps.map((kp) => {
          const q = qtyByStorePiece.get(`${s.id}-${kp.piece_id}`) || 0;
          return Math.floor(q / (kp.quantity || 1));
        }),
      );
      qtyByStoreKit.set(`${s.id}-${kit.id}`, perStore);
      total += perStore;
    }
    qtyByKit.set(kit.id, total);
  }

  // Quantities from kit-only components that are NOT covered by a complete
  // kit must still appear in the matrix as real piece quantity. Example: if a
  // kit needs 2 of piece A and the store has 5, the matrix should show 2 kits
  // + 1 residual piece A. Otherwise the visible matrix sum becomes lower than
  // the real piece-by-piece total from "Preços (Recotação)".
  const kitConsumedQtyByStorePiece = new Map<string, number>();
  for (const kit of liveKits) {
    const kps = kitPiecesByKit.get(kit.id) || [];
    for (const s of params.stores) {
      const kitQty = qtyByStoreKit.get(`${s.id}-${kit.id}`) || 0;
      if (kitQty <= 0) continue;
      for (const kp of kps) {
        const key = `${s.id}-${kp.piece_id}`;
        kitConsumedQtyByStorePiece.set(
          key,
          (kitConsumedQtyByStorePiece.get(key) || 0) + kitQty * (kp.quantity || 1),
        );
      }
    }
  }
  const residualQtyByStorePiece = new Map<string, number>();
  const residualQtyByAdjPiece: Record<string, number> = {};
  for (const sp of params.adjStorePieces) {
    const actual = Number(sp.quantity || 0);
    const consumed = kitConsumedQtyByStorePiece.get(`${sp.store_id}-${sp.piece_id}`) || 0;
    const residual = Math.max(actual - consumed, 0);
    if (residual <= 0) continue;
    residualQtyByStorePiece.set(`${sp.store_id}-${sp.piece_id}`, residual);
    residualQtyByAdjPiece[sp.piece_id] = (residualQtyByAdjPiece[sp.piece_id] || 0) + residual;
  }

  // Resolve previous/new price for an adjustment piece
  const previousPriceFor = (adjP: RequoteFinalAdjPiece): number => {
    if (!adjP.source_piece_id) return 0;
    return Number(params.previousPriceBySourcePiece[adjP.source_piece_id] || 0);
  };
  const newPriceFor = (adjP: RequoteFinalAdjPiece): number => {
    const explicit = params.newPriceByAdjPiece[adjP.id];
    if (explicit != null) return Number(explicit || 0);
    return previousPriceFor(adjP);
  };

  // ─── Sheet 1: "Preços (Recotação)" ──────────────────────
  const ws = wb.addWorksheet("Preços (Recotação)", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  // Title block
  ws.mergeCells("A1:H1");
  const t1 = ws.getCell("A1");
  t1.value = `Recotação Final — ${params.adjustmentName}`;
  t1.font = { bold: true, size: 14, color: { argb: WHITE } };
  t1.alignment = { horizontal: "center", vertical: "middle" };
  t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
  ws.getRow(1).height = 30;

  ws.mergeCells("A2:H2");
  const t2 = ws.getCell("A2");
  const subtitleParts = [
    params.agencyName,
    params.clientName,
    params.campaignName,
    params.supplierName,
  ].filter(Boolean);
  t2.value = subtitleParts.join("  ·  ");
  t2.font = { italic: true, color: { argb: DARK }, size: 10 };
  t2.alignment = { horizontal: "center", vertical: "middle" };
  t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };

  ws.mergeCells("A3:H3");
  const t3 = ws.getCell("A3");
  t3.value = `Gerado em ${params.generatedAt.toLocaleString("pt-BR")}`;
  t3.font = { color: { argb: DARK }, size: 9 };
  t3.alignment = { horizontal: "center" };

  // Header row 5
  const headers = [
    "Tipo",
    "Código",
    "Item",
    "Qtd",
    "Preço Anterior",
    "Novo Preço",
    "Novo Total",
    "Variação",
  ];
  const headerRow = ws.getRow(5);
  headers.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: WHITE }, size: 11 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
    c.border = {
      top: { style: "thin", color: { argb: BORDER } },
      bottom: { style: "thin", color: { argb: BORDER } },
      left: { style: "thin", color: { argb: BORDER } },
      right: { style: "thin", color: { argb: BORDER } },
    };
  });
  headerRow.height = 26;

  // Body — grouped rendering:
  //   1) Each kit (sorted by code): kit header row, then ONLY its component
  //      pieces (sorted by piece code). Kit header is informational only
  //      (contributeToTotal=false); component pieces carry the real qty × price.
  //   2) Standalone pieces (not referenced by any kit), sorted by code.
  // This avoids the previous bug where pieces with codes between two kit codes
  // visually appeared as if they belonged to the previous kit.
  let rowIdx = 6;
  let runningNewTotal = 0;
  let runningPrevTotal = 0;

  // Set of piece ids referenced by ANY kit composition
  const kitPieceIdSet = new Set<string>();
  for (const [, comps] of kitPiecesByKit) {
    for (const kp of comps) kitPieceIdSet.add(kp.piece_id);
  }
  const pieceById = new Map(livePieces.map((p) => [p.id, p]));

  const writeBodyRow = (
    type: "Peça" | "Kit",
    code: number | string,
    name: string,
    qty: number,
    prev: number,
    next: number,
    isNew = false,
    contributeToTotal = true,
  ) => {
    const r = ws.getRow(rowIdx++);
    const lineNewTotal = qty * next;
    const linePrevTotal = qty * prev;
    if (contributeToTotal) {
      runningNewTotal += lineNewTotal;
      runningPrevTotal += linePrevTotal;
    }
    r.getCell(1).value = type;
    r.getCell(2).value = code;
    r.getCell(3).value = name + (isNew ? " (nova)" : "");
    r.getCell(4).value = qty;
    if (contributeToTotal) {
      r.getCell(5).value = prev;
      r.getCell(6).value = next;
      r.getCell(7).value = lineNewTotal;
      r.getCell(8).value = fmtPct(prev, next);
      r.getCell(5).numFmt = money;
      r.getCell(6).numFmt = money;
      r.getCell(7).numFmt = money;
    } else {
      r.getCell(5).value = "";
      r.getCell(6).value = "";
      r.getCell(7).value = "";
      r.getCell(8).value = "";
    }
    r.eachCell((c, col) => {
      c.alignment = {
        horizontal: col === 3 ? "left" : "center",
        vertical: "middle",
        wrapText: col === 3,
      };
      c.font = { color: { argb: DARK }, size: 10, bold: type === "Kit" };
      c.border = {
        top: { style: "hair", color: { argb: BORDER } },
        bottom: { style: "hair", color: { argb: BORDER } },
        left: { style: "hair", color: { argb: BORDER } },
        right: { style: "hair", color: { argb: BORDER } },
      };
      if (type === "Kit") {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: KIT_BG } };
      }
    });
    if (contributeToTotal) {
      const changed = next !== prev;
      if (changed) {
        r.getCell(6).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: HIGHLIGHT },
        };
        const color = next > prev ? INCREASE : DECREASE;
        r.getCell(6).font = { color: { argb: color }, bold: true, size: 10 };
        r.getCell(8).font = { color: { argb: color }, bold: true, size: 10 };
      }
    }
  };

  // 1) Kits, each followed by its component pieces
  const sortedKits = [...liveKits]
    .map((k) => ({ k, code: kitCode(k.source_kit_id), qty: qtyByKit.get(k.id) || 0 }))
    .filter((x) => x.qty > 0)
    .sort((a, b) => a.code - b.code || (a.k.name || "").localeCompare(b.k.name || "", "pt-BR"));

  for (const { k, code, qty } of sortedKits) {
    writeBodyRow("Kit", code, k.name, qty, 0, 0, false, false);
    const comps = (kitPiecesByKit.get(k.id) || [])
      .map((kp) => ({ kp, piece: pieceById.get(kp.piece_id) }))
      .filter((x) => !!x.piece && !!x.piece.code && Number(x.piece.code) !== 0)
      .sort(
        (a, b) =>
          (Number(a.piece!.code) || 0) - (Number(b.piece!.code) || 0) ||
          (a.piece!.name || "").localeCompare(b.piece!.name || "", "pt-BR"),
      );
    for (const { piece } of comps) {
      const pQty = qtyByAdjPiece[piece!.id] || 0;
      writeBodyRow(
        "Peça",
        piece!.code,
        piece!.name,
        pQty,
        previousPriceFor(piece!),
        newPriceFor(piece!),
        !!piece!.is_new,
        true,
      );
    }
  }

  // 2) Standalone pieces — not referenced by any kit
  const standalonePieces = livePieces
    .filter((p) => p.code && Number(p.code) !== 0)
    .filter((p) => !kitPieceIdSet.has(p.id))
    .filter((p) => (qtyByAdjPiece[p.id] || 0) > 0 || !!p.is_new)
    .sort(
      (a, b) =>
        (Number(a.code) || 0) - (Number(b.code) || 0) ||
        (a.name || "").localeCompare(b.name || "", "pt-BR"),
    );
  for (const p of standalonePieces) {
    const qty = qtyByAdjPiece[p.id] || 0;
    writeBodyRow(
      "Peça",
      p.code,
      p.name,
      qty,
      previousPriceFor(p),
      newPriceFor(p),
      !!p.is_new,
      true,
    );
  }

  // Spacer + extras
  rowIdx++;
  const writeExtra = (label: string, prev: number, next: number) => {
    const r = ws.getRow(rowIdx++);
    r.getCell(3).value = label;
    r.getCell(5).value = prev;
    r.getCell(6).value = next;
    r.getCell(7).value = next;
    r.getCell(8).value = fmtPct(prev, next);
    r.getCell(5).numFmt = money;
    r.getCell(6).numFmt = money;
    r.getCell(7).numFmt = money;
    r.eachCell((c, col) => {
      c.alignment = {
        horizontal: col === 3 ? "left" : "center",
        vertical: "middle",
      };
      c.font = { color: { argb: DARK }, size: 10, italic: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
    });
    runningNewTotal += next;
    runningPrevTotal += prev;
    if (next !== prev) {
      const color = next > prev ? INCREASE : DECREASE;
      r.getCell(6).font = { color: { argb: color }, bold: true, size: 10 };
      r.getCell(8).font = { color: { argb: color }, bold: true, size: 10 };
    }
  };
  writeExtra("Instalação", params.previousInstallation, params.newInstallation);
  writeExtra("Frete", params.previousFreight, params.newFreight);

  // Total row
  rowIdx++;
  const totalRow = ws.getRow(rowIdx++);
  totalRow.getCell(3).value = "TOTAL GERAL";
  totalRow.getCell(5).value = runningPrevTotal;
  totalRow.getCell(6).value = runningNewTotal;
  totalRow.getCell(7).value = runningNewTotal;
  totalRow.getCell(8).value = fmtPct(runningPrevTotal, runningNewTotal);
  totalRow.getCell(5).numFmt = money;
  totalRow.getCell(6).numFmt = money;
  totalRow.getCell(7).numFmt = money;
  totalRow.eachCell((c, col) => {
    c.font = { bold: true, color: { argb: WHITE }, size: 12 };
    c.alignment = {
      horizontal: col === 3 ? "left" : "center",
      vertical: "middle",
    };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
  });
  totalRow.height = 28;

  ws.columns = [
    { width: 8 },   // Tipo
    { width: 10 },  // Código
    { width: 50 },  // Item
    { width: 8 },   // Qtd
    { width: 16 },  // Preço Anterior
    { width: 16 },  // Novo Preço
    { width: 18 },  // Novo Total
    { width: 12 },  // Variação
  ];

  // ─── Sheet 2+: Matriz Lojas x Peças (delegated) ─────────
  const matrixQtyMap: Record<string, number> = {};
  const matrixDisplayQtyMap: Record<string, number> = {};
  for (const sp of params.adjStorePieces) {
    const key = `${sp.store_id}-${sp.piece_id}`;
    matrixQtyMap[key] = Number(sp.quantity || 0);
    const adjPiece = livePieces.find((p) => p.id === sp.piece_id);
    if (adjPiece?.kit_only) matrixDisplayQtyMap[key] = residualQtyByStorePiece.get(key) || 0;
  }

  // Filter ghost/deleted pieces (code 0 or zero total qty across all stores).
  const piecesForMatrix = livePieces.filter((p) => {
    if (!p.code || Number(p.code) === 0) return false;
    const totalQty = p.kit_only ? (residualQtyByAdjPiece[p.id] || 0) : (qtyByAdjPiece[p.id] || 0);
    if (totalQty === 0 && !p.is_new) return false;
    return true;
  });

  // appendMatrixSheets expects CampaignPiece / CampaignKit shapes. Build
  // those by merging adjustment metadata with source-piece images.
  const matrixPieces = piecesForMatrix
    .map((p) => {
      const src = sourcePieceMeta(p.source_piece_id);
      return {
        id: p.id,
        campaign_id: "",
        code: p.code,
        category: p.category || "",
        name: p.name,
        size: p.size || "",
        store_category: p.category || null,
        sub_location: p.sub_location || null,
        image_url: pieceImage(p.source_piece_id),
        image_thumb_url: src?.image_thumb_url || null,
        image_report_url: src?.image_report_url || null,
        image_full_url: src?.image_full_url || null,
        specification: p.specification || src?.specification || "",
        installation_instructions: src?.installation_instructions || "",
        kit_only: !!p.kit_only,
        is_mockup: false,
        display_order: 0,
        created_at: "",
        is_new: !!p.is_new,
      } as any;
    });

  // allPieces — TODAS as peças vivas com code válido (sem filtro de qty).
  // Necessário para que componentes kit_only com residual zero ainda sejam
  // resolvíveis nas sub-abas de Kit (código, nome, spec, imagem, local).
  const allLivePiecesForLookup = livePieces.filter(
    (p) => p.code && Number(p.code) !== 0,
  );
  const matrixAllPieces = allLivePiecesForLookup.map((p) => {
    const src = sourcePieceMeta(p.source_piece_id);
    return {
      id: p.id,
      campaign_id: "",
      code: p.code,
      category: p.category || "",
      name: p.name,
      size: p.size || "",
      store_category: p.category || null,
      sub_location: p.sub_location || null,
      image_url: pieceImage(p.source_piece_id),
      image_thumb_url: src?.image_thumb_url || null,
      image_report_url: src?.image_report_url || null,
      image_full_url: src?.image_full_url || null,
      specification: p.specification || src?.specification || "",
      installation_instructions: src?.installation_instructions || "",
      kit_only: !!p.kit_only,
      is_mockup: false,
      display_order: 0,
      created_at: "",
      is_new: !!p.is_new,
    } as any;
  });

  const kitsForMatrix = liveKits.filter((k) => (qtyByKit.get(k.id) || 0) > 0);
  const matrixKits = kitsForMatrix.map((k) => ({
    id: k.id,
    campaign_id: "",
    name: k.name,
    code: kitCode(k.source_kit_id),
    display_order: 0,
    image_url: kitImage(k.source_kit_id),
    is_mockup: false,
    category: null,
    sub_location: null,
    created_at: "",
  } as any));

  const matrixKitPieces = params.adjKitPieces.map((kp) => ({
    id: kp.id,
    kit_id: kp.kit_id,
    piece_id: kp.piece_id,
    quantity: kp.quantity,
    display_order: 0,
    created_at: "",
  } as any));

  // Sort stores by UF (state), then by name.
  const sortedStores = [...params.stores].sort((a, b) => {
    const ua = (a.state || "ZZ").toUpperCase();
    const ub = (b.state || "ZZ").toUpperCase();
    if (ua !== ub) return ua.localeCompare(ub, "pt-BR");
    return (a.name || "").localeCompare(b.name || "", "pt-BR");
  });

  const matrixStores = sortedStores.map((s) => ({
    id: s.id,
    client_id: "",
    name: s.name,
    nickname: s.nickname || null,
    city: s.city || null,
    state: s.state || null,
    cnpj: null, state_registration: null, zip_code: null, street: null,
    number: null, complement: null, neighborhood: null, phone: null,
    manager_name: null, store_model: null, country: null,
    store_code: s.store_code || null, email: null,
    custom_field_1: null, custom_field_2: null, custom_field_3: null,
    custom_field_4: null, custom_field_5: null, custom_field_6: null,
    custom_field_7: null, custom_field_8: null, custom_field_9: null,
    custom_field_10: null, custom_field_11: null, custom_field_12: null,
    custom_field_13: null, custom_field_14: null, custom_field_15: null,
    observations: null, auto_distribute: false, show_in_scheduling: true,
    created_at: "",
    showcase_count: s.showcase_count || 0,
  } as any));

  let matrixSheetName: string | null = null;
  try {
    matrixSheetName = await appendMatrixSheets(wb, {
      stores: matrixStores,
      pieces: matrixPieces,
      qtyMap: matrixQtyMap,
      displayQtyMap: matrixDisplayQtyMap,
      campaignName: params.campaignName,
      kits: matrixKits,
      kitPieces: matrixKitPieces,
      locations: [],
      subLocations: [],
      allPieces: matrixAllPieces,
      agencyName: params.agencyName,
      clientName: params.clientName,
      reservedSheetNames: new Set(["preços (recotação)"]),
      skipDashboard: true,
      sortByCode: true,
    } as any);
  } catch (e) {
    console.warn("[buildRequoteFinalWorkbook] matrix append failed", e);
  }

  // ─── Append price/freight/installation/grand-total rows to matrix sheet ──
  // Column order MUST match appendMatrixSheets sortByCode (code asc,
  // piece-before-kit on ties, id asc).
  if (matrixSheetName) {
    const matrixWs = wb.getWorksheet(matrixSheetName);
    if (matrixWs) {
      type ColEntry = { id: string; type: "piece" | "kit"; code: number; unitPrice: number };
      const colItems: ColEntry[] = [
        ...matrixPieces.map((p) => {
          const adjP = piecesForMatrix.find((x) => x.id === p.id)!;
          return { id: p.id, type: "piece" as const, code: Number(p.code) || 0, unitPrice: newPriceFor(adjP) };
        }),
        ...matrixKits.map((k) => {
          const kps = kitPiecesByKit.get(k.id) || [];
          let unit = 0;
          for (const kp of kps) {
            const adjP = params.adjPieces.find((p) => p.id === kp.piece_id);
            if (adjP) unit += newPriceFor(adjP) * (kp.quantity || 0);
          }
          return { id: k.id, type: "kit" as const, code: Number(k.code) || 0, unitPrice: unit };
        }),
      ].sort((a, b) => {
        return (a.code - b.code)
          || (a.type === b.type ? 0 : a.type === "piece" ? -1 : 1)
          || (a.id < b.id ? -1 : 1);
      });

      const STORE_META_COLS = 4; // DEFAULT_STORE_FIELDS
      const colCount = STORE_META_COLS + colItems.length;
      // Matrix layout: row 1 title, rows 2-9 meta (8), row 10 stores header,
      // rows 11..(10+N) stores, row (11+N) TOTAL.
      const totalRowNum = 10 + matrixStores.length + 1;
      const baseRow = totalRowNum + 1;

      const getColLetter = (n: number): string => {
        let s = ""; let c = n;
        while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); }
        return s;
      };

      const styleLabel = (cell: any) => {
        cell.font = { bold: true, color: { argb: WHITE }, size: 11 };
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
      };

      // Row 1: PREÇO UNITÁRIO
      const unitRow = matrixWs.getRow(baseRow);
      matrixWs.mergeCells(baseRow, 1, baseRow, STORE_META_COLS);
      const unitLabel = matrixWs.getCell(baseRow, 1);
      unitLabel.value = "PREÇO UNITÁRIO";
      styleLabel(unitLabel);
      for (let i = 0; i < colItems.length; i++) {
        const c = unitRow.getCell(STORE_META_COLS + 1 + i);
        c.value = colItems[i].unitPrice;
        c.numFmt = money;
        c.font = { color: { argb: DARK }, size: 10 };
        c.alignment = { horizontal: "center", vertical: "middle" };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
      }
      unitRow.height = 22;

      // Row 2: PREÇO TOTAL = unit × total qty (formula)
      const totalLineRow = matrixWs.getRow(baseRow + 1);
      matrixWs.mergeCells(baseRow + 1, 1, baseRow + 1, STORE_META_COLS);
      const totLabel = matrixWs.getCell(baseRow + 1, 1);
      totLabel.value = "PREÇO TOTAL";
      styleLabel(totLabel);
      for (let i = 0; i < colItems.length; i++) {
        const colN = STORE_META_COLS + 1 + i;
        const letter = getColLetter(colN);
        const c = totalLineRow.getCell(colN);
        c.value = { formula: `${letter}${baseRow}*${letter}${totalRowNum}` } as any;
        c.numFmt = money;
        c.font = { bold: true, color: { argb: DARK }, size: 10 };
        c.alignment = { horizontal: "center", vertical: "middle" };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFE7D8" } };
      }
      totalLineRow.height = 22;

      // Row 3 (after spacer): TOTAL DA PRODUÇÃO
      const prodRowNum = baseRow + 3;
      const prodRow = matrixWs.getRow(prodRowNum);
      matrixWs.mergeCells(prodRowNum, 1, prodRowNum, STORE_META_COLS);
      const prodLabel = matrixWs.getCell(prodRowNum, 1);
      prodLabel.value = "TOTAL DA PRODUÇÃO";
      styleLabel(prodLabel);
      matrixWs.mergeCells(prodRowNum, STORE_META_COLS + 1, prodRowNum, colCount);
      const prodValCell = matrixWs.getCell(prodRowNum, STORE_META_COLS + 1);
      prodValCell.value = { formula: `SUM(${getColLetter(STORE_META_COLS + 1)}${baseRow + 1}:${getColLetter(colCount)}${baseRow + 1})` } as any;
      prodValCell.numFmt = money;
      prodValCell.font = { bold: true, color: { argb: DARK }, size: 11 };
      prodValCell.alignment = { horizontal: "center", vertical: "middle" };
      prodValCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
      prodRow.height = 24;

      // FRETE
      const freightRowNum = prodRowNum + 1;
      const freightRow = matrixWs.getRow(freightRowNum);
      matrixWs.mergeCells(freightRowNum, 1, freightRowNum, STORE_META_COLS);
      const fLabel = matrixWs.getCell(freightRowNum, 1);
      fLabel.value = "FRETE";
      styleLabel(fLabel);
      matrixWs.mergeCells(freightRowNum, STORE_META_COLS + 1, freightRowNum, colCount);
      const fVal = matrixWs.getCell(freightRowNum, STORE_META_COLS + 1);
      fVal.value = Number(params.newFreight || 0);
      fVal.numFmt = money;
      fVal.font = { color: { argb: DARK }, size: 11 };
      fVal.alignment = { horizontal: "center", vertical: "middle" };
      fVal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
      freightRow.height = 22;

      // INSTALAÇÃO
      const instRowNum = freightRowNum + 1;
      const instRow = matrixWs.getRow(instRowNum);
      matrixWs.mergeCells(instRowNum, 1, instRowNum, STORE_META_COLS);
      const iLabel = matrixWs.getCell(instRowNum, 1);
      iLabel.value = "INSTALAÇÃO";
      styleLabel(iLabel);
      matrixWs.mergeCells(instRowNum, STORE_META_COLS + 1, instRowNum, colCount);
      const iVal = matrixWs.getCell(instRowNum, STORE_META_COLS + 1);
      iVal.value = Number(params.newInstallation || 0);
      iVal.numFmt = money;
      iVal.font = { color: { argb: DARK }, size: 11 };
      iVal.alignment = { horizontal: "center", vertical: "middle" };
      iVal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
      instRow.height = 22;

      // VALOR TOTAL GERAL (destaque)
      const grandRowNum = instRowNum + 1;
      const grandRow = matrixWs.getRow(grandRowNum);
      matrixWs.mergeCells(grandRowNum, 1, grandRowNum, STORE_META_COLS);
      const gLabel = matrixWs.getCell(grandRowNum, 1);
      gLabel.value = "VALOR TOTAL GERAL";
      gLabel.font = { bold: true, color: { argb: WHITE }, size: 13 };
      gLabel.alignment = { horizontal: "right", vertical: "middle" };
      gLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
      matrixWs.mergeCells(grandRowNum, STORE_META_COLS + 1, grandRowNum, colCount);
      const gVal = matrixWs.getCell(grandRowNum, STORE_META_COLS + 1);
      const colLetterFirst = getColLetter(STORE_META_COLS + 1);
      gVal.value = {
        formula: `${colLetterFirst}${prodRowNum}+${colLetterFirst}${freightRowNum}+${colLetterFirst}${instRowNum}`,
      } as any;
      gVal.numFmt = money;
      gVal.font = { bold: true, color: { argb: WHITE }, size: 14 };
      gVal.alignment = { horizontal: "center", vertical: "middle" };
      gVal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
      grandRow.height = 32;
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  const dateStr = params.generatedAt
    .toLocaleDateString("pt-BR")
    .replace(/\//g, "-");
  const safe = params.adjustmentName.replace(/[^a-zA-Z0-9_\- ]/g, "").trim() || "ajuste";
  const fileName = `Recotacao_Final_${safe}_${dateStr}.xlsx`;
  return { blob, fileName };
}
