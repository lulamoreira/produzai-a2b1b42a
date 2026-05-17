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

  // Body — pieces ordered by código asc, then kits at end.
  let rowIdx = 6;
  let runningNewTotal = 0;
  let runningPrevTotal = 0;

  const orderedPieces = [...livePieces].sort(
    (a, b) =>
      (Number(a.code) || 0) - (Number(b.code) || 0) ||
      (a.name || "").localeCompare(b.name || "", "pt-BR"),
  );

  const writeBodyRow = (
    type: "Peça" | "Kit",
    code: number | string,
    name: string,
    qty: number,
    prev: number,
    next: number,
    isNew = false,
  ) => {
    const r = ws.getRow(rowIdx++);
    const lineNewTotal = qty * next;
    const linePrevTotal = qty * prev;
    runningNewTotal += lineNewTotal;
    runningPrevTotal += linePrevTotal;
    r.getCell(1).value = type;
    r.getCell(2).value = code;
    r.getCell(3).value = name + (isNew ? " (nova)" : "");
    r.getCell(4).value = qty;
    r.getCell(5).value = prev;
    r.getCell(6).value = next;
    r.getCell(7).value = lineNewTotal;
    r.getCell(8).value = fmtPct(prev, next);
    r.getCell(5).numFmt = money;
    r.getCell(6).numFmt = money;
    r.getCell(7).numFmt = money;
    r.eachCell((c, col) => {
      c.alignment = {
        horizontal: col === 3 ? "left" : "center",
        vertical: "middle",
        wrapText: col === 3,
      };
      c.font = { color: { argb: DARK }, size: 10 };
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
  };

  for (const p of orderedPieces) {
    const qty = qtyByAdjPiece[p.id] || 0;
    if (qty === 0 && !p.is_new) continue; // skip pieces with no rateio
    writeBodyRow(
      "Peça",
      p.code,
      p.name,
      qty,
      previousPriceFor(p),
      newPriceFor(p),
      !!p.is_new,
    );
  }

  // Kits (cost computed from member pieces × qty in kit × kit qty)
  const orderedKits = [...liveKits].sort((a, b) => {
    return kitCode(a.source_kit_id) - kitCode(b.source_kit_id);
  });
  for (const k of orderedKits) {
    const kQty = qtyByKit.get(k.id) || 0;
    if (kQty === 0) continue;
    const kps = kitPiecesByKit.get(k.id) || [];
    let prevUnit = 0;
    let nextUnit = 0;
    for (const kp of kps) {
      const adjP = params.adjPieces.find((p) => p.id === kp.piece_id);
      if (!adjP) continue;
      prevUnit += previousPriceFor(adjP) * (kp.quantity || 0);
      nextUnit += newPriceFor(adjP) * (kp.quantity || 0);
    }
    writeBodyRow("Kit", kitCode(k.source_kit_id), k.name, kQty, prevUnit, nextUnit);
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
  for (const sp of params.adjStorePieces) {
    matrixQtyMap[`${sp.store_id}-${sp.piece_id}`] = Number(sp.quantity || 0);
  }

  // appendMatrixSheets expects CampaignPiece / CampaignKit shapes. Build
  // those by merging adjustment metadata with source-piece images.
  const matrixPieces = livePieces
    .filter((p) => !p.kit_only)
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
        kit_only: false,
        is_mockup: false,
        display_order: 0,
        created_at: "",
        is_new: !!p.is_new,
      } as any;
    });

  const matrixAllPieces = livePieces.map((p) => {
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

  const matrixKits = liveKits
    .filter((k) => (qtyByKit.get(k.id) || 0) > 0 || (kitPiecesByKit.get(k.id)?.length || 0) > 0)
    .map((k) => ({
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

  const matrixStores = params.stores.map((s) => ({
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

  try {
    await appendMatrixSheets(wb, {
      stores: matrixStores,
      pieces: matrixPieces,
      qtyMap: matrixQtyMap,
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

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  const dateStr = params.generatedAt
    .toLocaleDateString("pt-BR")
    .replace(/\//g, "-");
  const safe = params.adjustmentName.replace(/[^a-zA-Z0-9_\- ]/g, "").trim() || "ajuste";
  const fileName = `Recotacao_Final_${safe}_${dateStr}.xlsx`;
  return { blob, fileName };
}
