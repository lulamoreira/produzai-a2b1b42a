import type * as ExcelJS from "exceljs";
import { saveXlsxAs } from "./saveBlobAs";
import type { ClientStore, CampaignPiece, CampaignKit, CampaignKitPiece, CampaignPieceLocation, CampaignPieceSubLocation } from "@/hooks/useMultiClientData";
import type { ColorPalette, StoreFieldDef } from "@/components/RateioExportColorDialog";
import { DEFAULT_STORE_FIELDS } from "@/components/RateioExportColorDialog";
import { getThumbnailUrl } from "./imageUrl";

function getStoreFieldValue(store: ClientStore, key: string): string | number {
  const v = (store as any)[key];
  if (key === "showcase_count") return typeof v === "number" ? v : 0;
  return v ?? "";
}

// ─── Helpers ─────────────────────────────────────────────

export function getExcelColumnLetter(colNum: number): string {
  let letter = "";
  while (colNum > 0) {
    const mod = (colNum - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    colNum = Math.floor((colNum - 1) / 26);
  }
  return letter;
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; ext: "png" | "jpeg"; width: number; height: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    let binary = "";
    uint8.forEach((b) => (binary += String.fromCharCode(b)));
    const base64 = btoa(binary);
    const ext = blob.type.includes("png") ? "png" : "jpeg";
    const blobUrl = URL.createObjectURL(blob);
    const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(blobUrl); };
      img.onerror = () => { resolve({ width: 200, height: 200 }); URL.revokeObjectURL(blobUrl); };
      img.src = blobUrl;
    });
    return { base64, ext, width, height };
  } catch {
    return null;
  }
}

function hexToArgb(hex: string): string {
  return "FF" + hex.replace("#", "");
}

function formatLocation(
  catId: string | null | undefined,
  subLocId: string | null | undefined,
  locations: CampaignPieceLocation[],
  subLocations: CampaignPieceSubLocation[],
): string {
  // Fields store the name (not the id), so match by both id and name
  if (subLocId && subLocId !== "__none__") {
    const sub = subLocations.find((s) => s.id === subLocId || s.name === subLocId);
    if (sub) {
      const parent = locations.find((l) => l.id === sub.location_id);
      return parent ? `${parent.name} / ${sub.name}` : sub.name;
    }
  }
  if (catId) {
    const loc = locations.find((l) => l.id === catId || l.name === catId);
    return loc?.name || catId;
  }
  return "";
}

// ─── Color helpers ───────────────────────────────────────

function makeColors(palette?: ColorPalette) {
  const p = palette || { primary: "#1A3A5C", secondary: "#2E6DA4", light: "#D6E8F7" };
  const PRIMARY = p.primary.replace("#", "");
  const SECONDARY = p.secondary.replace("#", "");
  const LIGHT = p.light.replace("#", "");
  // Derive a border color from the light color
  const BORDER = LIGHT;

  return { PRIMARY, SECONDARY, LIGHT, BORDER };
}

function solidFill(color: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: `FF${color}` } };
}

function gradientFill(from: string, _to: string, _degree = 0): ExcelJS.Fill {
  // Gradients removed by request — use a solid fill of the primary color instead.
  // Row alternation (lighter/darker tones) is handled separately via solidFill(LIGHT) vs solidFill("FFFFFF").
  return { type: "pattern", pattern: "solid", fgColor: { argb: `FF${from}` } } as ExcelJS.Fill;
}

// ─── Types ───────────────────────────────────────────────

const META_LABELS = ["IMAGEM", "CÓDIGO", "LOCAL", "NOME", "TAMANHO", "ESPECIFICAÇÃO", "INSTRUÇÕES DE INSTALAÇÃO", "NOVO"];
const IMAGE_ROW_INDEX = 0;
const NEW_ROW_INDEX = 7;
const META_ROW_COUNT = META_LABELS.length;

/** Row number (1-based) in the "Matriz Lojas x Peças" sheet that holds the TOTAL of quantities per item column. */
export function getMatrixTotalQtyRowNum(storeCount: number): number {
  return META_ROW_COUNT + 3 + Math.max(storeCount, 0);
}

type MatrixItem = {
  id: string;
  code: number;
  name: string;
  size: string;
  store_category?: string | null;
  sub_location?: string | null;
  specification?: string;
  installation_instructions?: string;
  image_url?: string | null;
  is_new?: boolean;
  _type?: "piece" | "kit";
};

export type MatrixStoreField = StoreFieldDef & { __hidden?: boolean };

export function getMatrixStoreFieldsWithHidden(
  storeFields: StoreFieldDef[] = DEFAULT_STORE_FIELDS,
  extraHiddenStoreFields: StoreFieldDef[] = [],
): MatrixStoreField[] {
  if (!extraHiddenStoreFields.length) return storeFields.slice();
  const out: MatrixStoreField[] = [];
  let inserted = false;
  for (const f of storeFields) {
    out.push(f);
    if (!inserted && f.key === "state") {
      for (const h of extraHiddenStoreFields) out.push({ ...h, __hidden: true });
      inserted = true;
    }
  }
  if (!inserted) {
    for (const h of extraHiddenStoreFields) out.push({ ...h, __hidden: true });
  }
  return out;
}

export function appendMatrixFinancialFooter(params: {
  ws: ExcelJS.Worksheet;
  storeCount: number;
  storeMetaColumnCount: number;
  unitPricesByColumn: number[];
  moneyFormat: string;
  installation?: number | null;
  freight?: number | null;
  primaryArgb?: string;
  darkArgb?: string;
  lightArgb?: string;
}): void {
  const {
    ws,
    storeCount,
    storeMetaColumnCount,
    unitPricesByColumn,
    moneyFormat,
    installation = 0,
    freight = 0,
    primaryArgb = "FF8C6F4E",
    darkArgb = "FF1C1916",
    lightArgb = "FFF7F3EC",
  } = params;
  if (!unitPricesByColumn.length) return;

  const metaCols = Math.max(storeMetaColumnCount, 1);
  const firstItemCol = metaCols + 1;
  const lastItemCol = metaCols + unitPricesByColumn.length;
  const totalQtyRowNum = META_ROW_COUNT + 3 + Math.max(storeCount, 0);
  const unitRowNum = totalQtyRowNum + 1;
  const totalPriceRowNum = unitRowNum + 1;
  const summaryStartRowNum = totalPriceRowNum + 2;

  const styleLabel = (cell: ExcelJS.Cell, fillArgb = primaryArgb, size = 11) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size };
    cell.alignment = { horizontal: "right", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
  };

  const styleMoney = (cell: ExcelJS.Cell, opts: { bold?: boolean; fillArgb?: string; fontArgb?: string; size?: number } = {}) => {
    cell.numFmt = moneyFormat;
    cell.font = {
      bold: !!opts.bold,
      color: { argb: opts.fontArgb || darkArgb },
      size: opts.size || 10,
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fillArgb || lightArgb } };
  };

  const mergeLabel = (rowNum: number, label: string, fillArgb = primaryArgb, size = 11) => {
    ws.mergeCells(rowNum, 1, rowNum, metaCols);
    const cell = ws.getCell(rowNum, 1);
    cell.value = label;
    styleLabel(cell, fillArgb, size);
    return cell;
  };

  const unitRow = ws.getRow(unitRowNum);
  mergeLabel(unitRowNum, "PREÇO UNITÁRIO");
  unitPricesByColumn.forEach((unitPrice, index) => {
    const cell = unitRow.getCell(firstItemCol + index);
    cell.value = Number(unitPrice || 0);
    styleMoney(cell);
  });
  unitRow.height = 22;

  const totalPriceRow = ws.getRow(totalPriceRowNum);
  mergeLabel(totalPriceRowNum, "PREÇO TOTAL");
  for (let colNum = firstItemCol; colNum <= lastItemCol; colNum++) {
    const colLetter = getExcelColumnLetter(colNum);
    const cell = totalPriceRow.getCell(colNum);
    cell.value = { formula: `${colLetter}${unitRowNum}*${colLetter}${totalQtyRowNum}` } as any;
    styleMoney(cell, { bold: true, fillArgb: "FFEFE7D8" });
  }
  totalPriceRow.height = 22;

  const labelEndCol = Math.min(2, metaCols);
  const valueCol = Math.min(Math.max(3, labelEndCol + 1), metaCols);
  const valueColLetter = getExcelColumnLetter(valueCol);
  const firstItemColLetter = getExcelColumnLetter(firstItemCol);
  const lastItemColLetter = getExcelColumnLetter(lastItemCol);

  // Ensure the summary value column is wide enough to display formatted totals
  // (avoids ###### overflow when the meta column happens to be narrow, e.g. UF).
  const valueColRef = ws.getColumn(valueCol);
  if (!valueColRef.width || valueColRef.width < 22) valueColRef.width = 22;


  const writeSummaryRow = (rowNum: number, label: string, value: number | ExcelJS.CellValue, emphasized = false) => {
    ws.mergeCells(rowNum, 1, rowNum, labelEndCol);
    const labelCell = ws.getCell(rowNum, 1);
    labelCell.value = label;
    styleLabel(labelCell, emphasized ? darkArgb : primaryArgb, emphasized ? 13 : 11);
    const valueCell = ws.getCell(rowNum, valueCol);
    valueCell.value = value;
    styleMoney(valueCell, {
      bold: true,
      fillArgb: emphasized ? primaryArgb : lightArgb,
      fontArgb: emphasized ? "FFFFFFFF" : darkArgb,
      size: emphasized ? 14 : 11,
    });
    ws.getRow(rowNum).height = emphasized ? 32 : 24;
  };

  const productionRowNum = summaryStartRowNum;
  const installationRowNum = productionRowNum + 1;
  const freightRowNum = installationRowNum + 1;
  const grandTotalRowNum = freightRowNum + 1;

  writeSummaryRow(productionRowNum, "VALOR DE PRODUÇÃO", {
    formula: `SUM(${firstItemColLetter}${totalPriceRowNum}:${lastItemColLetter}${totalPriceRowNum})`,
  } as any);
  writeSummaryRow(installationRowNum, "VALOR DE INSTALAÇÃO", Number(installation || 0));
  writeSummaryRow(freightRowNum, "FRETE", Number(freight || 0));
  writeSummaryRow(grandTotalRowNum, "TOTAL GERAL", {
    formula: `${valueColLetter}${productionRowNum}+${valueColLetter}${installationRowNum}+${valueColLetter}${freightRowNum}`,
  } as any, true);
}

type LocationData = {
  locations: CampaignPieceLocation[];
  subLocations: CampaignPieceSubLocation[];
};

// ─── Shared: build a transposed piece sheet ──────────────

async function buildTransposedSheet(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  title: string,
  items: MatrixItem[],
  stores: ClientStore[],
  qtyMap: Record<string, number>,
  qtyKeyFn: (storeId: string, itemId: string) => string,
  colors: ReturnType<typeof makeColors>,
  locData: LocationData,
  kitSheetNames?: Map<string, string>, // id -> sheet name, for hyperlinks
  storeFields: StoreFieldDef[] = DEFAULT_STORE_FIELDS,
  extraHiddenStoreFields: StoreFieldDef[] = [],
) {
  const { PRIMARY, SECONDARY, LIGHT, BORDER } = colors;
  const whiteFont: Partial<ExcelJS.Font> = { color: { argb: "FFFFFFFF" }, bold: true };
  const darkFont: Partial<ExcelJS.Font> = { color: { argb: "FF1E293B" } };
  const thinBorder: Partial<ExcelJS.Border> = { style: "thin", color: { argb: `FF${BORDER}` } };
  const whiteBorder: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFFFFFFF" } };
  const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
  const allWhiteBorders = { top: whiteBorder, bottom: whiteBorder, left: whiteBorder, right: whiteBorder };

  // Merge visible storeFields with extra hidden fields. Hidden fields are
  // inserted right after the `state` (UF) column when present, otherwise at
  // the end of the meta columns — but BEFORE the items, so they stay grouped
  // with the rest of the store info instead of being far to the right.
  const mergedStoreFields = getMatrixStoreFieldsWithHidden(storeFields, extraHiddenStoreFields);
  const hiddenColSet = new Set<number>();
  mergedStoreFields.forEach((f, i) => { if (f.__hidden) hiddenColSet.add(i + 1); });
  // Use merged list for all rendering so hidden cols sit inside meta block.
  storeFields = mergedStoreFields;

  const STORE_META_COLS = Math.max(storeFields.length, 1);
  const colCount = items.length + STORE_META_COLS;
  const IMAGE_ROW_HEIGHT = 120;

  // Row 1 – Title
  ws.addRow([title.toUpperCase()]);
  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell(1, 1);
  titleCell.font = { ...whiteFont, size: 16 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = gradientFill(PRIMARY, SECONDARY);
  titleCell.border = allWhiteBorders;
  ws.getRow(1).height = 40;

  // Pre-fetch images — usa thumbnail otimizado (Supabase image transform)
  // para drasticamente reduzir bytes baixados e tempo de geração.
  // Concorrência limitada para evitar congestionar a rede do navegador.
  const imageCache: Record<string, { base64: string; ext: "png" | "jpeg"; width: number; height: number } | null> = {};
  const CONCURRENCY = 8;
  const queue = items.filter((p) => p.image_url).slice();
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      const p = queue.shift()!;
      const url = getThumbnailUrl(p.image_url!, 240, 70);
      imageCache[p.id] = await fetchImageAsBase64(url);
    }
  });
  await Promise.all(workers);

  // Meta rows
  for (let mi = 0; mi < META_ROW_COUNT; mi++) {
    const values: (string | number)[] = [META_LABELS[mi]];
    for (let pad = 1; pad < STORE_META_COLS; pad++) values.push("");
    for (const p of items) {
      switch (mi) {
        case 0: values.push(""); break;
        case 1: values.push(p.code); break;
        case 2: values.push(formatLocation(p.store_category, p.sub_location, locData.locations, locData.subLocations)); break;
        case 3: values.push(p.name); break;
        case 4: values.push(p.size); break;
        case 5: values.push(p.specification || ""); break;
        case 6: values.push(p.installation_instructions || ""); break;
        case 7: values.push(p.is_new ? "Sim" : ""); break;
        default: values.push("");
      }
    }
    const row = ws.addRow(values);
    const rowNum = mi + 2;

    ws.mergeCells(rowNum, 1, rowNum, STORE_META_COLS);
    const labelCell = ws.getCell(rowNum, 1);
    labelCell.font = { ...whiteFont, size: 11 };
    labelCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    labelCell.fill = gradientFill(PRIMARY, SECONDARY, 90);
    labelCell.border = allWhiteBorders;

    for (let ci = STORE_META_COLS + 1; ci <= colCount; ci++) {
      const cell = ws.getCell(rowNum, ci);
      cell.font = { ...darkFont, size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      if (mi === IMAGE_ROW_INDEX) {
        cell.fill = solidFill("FFFFFF");
      } else if (mi === NEW_ROW_INDEX) {
        // Highlight "Sim" cells in green; leave empty cells white
        const itemIdx = ci - STORE_META_COLS - 1;
        const isNewItem = !!items[itemIdx]?.is_new;
        if (isNewItem) {
          cell.fill = solidFill("22C55E"); // green-500
          cell.font = { color: { argb: "FFFFFFFF" }, bold: true, size: 10 };
        } else {
          cell.fill = gradientFill("FFFFFF", LIGHT);
        }
      } else {
        cell.fill = gradientFill("FFFFFF", LIGHT);
      }
      cell.border = allBorders;
    }

    if (mi === IMAGE_ROW_INDEX) row.height = IMAGE_ROW_HEIGHT;
    else if (mi === 5 || mi === 6) row.height = 80;
    else row.height = 25;
  }

  // Images
  const imageRowNum = 2;
  const CELL_PADDING = 8;
  for (let pi = 0; pi < items.length; pi++) {
    const imgData = imageCache[items[pi].id];
    if (imgData) {
      const item = items[pi];
      const nameLen = item?.name?.length || 10;
      const colWidthChars = Math.min(Math.max(nameLen + 4, 18), 30);
      const maxW = colWidthChars * 7.5 - CELL_PADDING * 2;
      const maxH = IMAGE_ROW_HEIGHT * 0.75 - CELL_PADDING;
      const ratio = imgData.width / imgData.height;
      let w = maxW;
      let h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
      const imageId = wb.addImage({ base64: imgData.base64, extension: imgData.ext });
      ws.addImage(imageId, {
        tl: { col: pi + STORE_META_COLS + 0.05, row: imageRowNum - 1 + 0.1 },
        ext: { width: Math.round(w), height: Math.round(h) },
      });
    }
  }

  // Kit hyperlinks on the name row (row 5 = index 3 = NOME)
  if (kitSheetNames) {
    const nameRowNum = 2 + 3; // row 5 = NOME
    for (let pi = 0; pi < items.length; pi++) {
      const item = items[pi];
      if (item._type === "kit" && kitSheetNames.has(item.id)) {
        const sheetName = kitSheetNames.get(item.id)!;
        const cell = ws.getCell(nameRowNum, STORE_META_COLS + 1 + pi);
        cell.value = { text: item.name, hyperlink: `#'${sheetName}'!A1` } as any;
        cell.font = { ...whiteFont, underline: true, size: 10, bold: false, color: { argb: `FF${PRIMARY}` } };
      }
    }
  }

  // Stores header
  const storesHeaderRowNum = META_ROW_COUNT + 2;
  const storeHeaderValues: (string | number)[] = storeFields.map((f) => f.label.toUpperCase());
  while (storeHeaderValues.length < STORE_META_COLS) storeHeaderValues.push("");
  for (const _p of items) storeHeaderValues.push("");
  const storeHeaderRow = ws.addRow(storeHeaderValues);
  storeHeaderRow.height = 30;
  storeHeaderRow.eachCell((cell) => {
    cell.font = { ...whiteFont, size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = gradientFill(SECONDARY, PRIMARY);
    cell.border = allWhiteBorders;
  });

  // Store rows
  const firstStoreRowNum = storesHeaderRowNum + 1;
  for (let si = 0; si < stores.length; si++) {
    const s = stores[si];
    const rowValues: (string | number)[] = storeFields.map((f) => getStoreFieldValue(s, f.key));
    while (rowValues.length < STORE_META_COLS) rowValues.push("");
    for (const p of items) {
      rowValues.push(qtyMap[qtyKeyFn(s.id, p.id)] || 0);
    }
    const row = ws.addRow(rowValues);
    const isEven = si % 2 === 0;
    row.eachCell((cell, colNumber) => {
      if (colNumber <= STORE_META_COLS) {
        cell.font = { bold: colNumber === 1, size: 10, color: { argb: "FF1E293B" } };
        cell.alignment = { horizontal: colNumber === 1 ? "left" : "center", vertical: "middle", wrapText: true };
      } else {
        cell.font = { ...darkFont, size: 11 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
      cell.fill = isEven ? solidFill(LIGHT) : solidFill("FFFFFF");
      cell.border = allBorders;
    });
  }

  // Totals with SUM formulas
  const lastStoreRowNum = firstStoreRowNum + stores.length - 1;
  const totalsRowValues: (string | number)[] = ["TOTAL"];
  for (let pad = 1; pad < STORE_META_COLS; pad++) totalsRowValues.push("");
  const totalsRow = ws.addRow(totalsRowValues);
  for (let pi = 0; pi < items.length; pi++) {
    const colLetter = getExcelColumnLetter(STORE_META_COLS + pi + 1);
    const cell = totalsRow.getCell(STORE_META_COLS + pi + 1);
    cell.value = { formula: `SUM(${colLetter}${firstStoreRowNum}:${colLetter}${lastStoreRowNum})` } as any;
  }
  totalsRow.height = 30;
  totalsRow.eachCell((cell) => {
    cell.font = { ...whiteFont, size: 12 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = gradientFill(SECONDARY, PRIMARY);
    cell.border = allWhiteBorders;
  });

  // Enable AutoFilter on the stores header row, spanning all columns.
  ws.autoFilter = {
    from: { row: storesHeaderRowNum, column: 1 },
    to: { row: storesHeaderRowNum, column: colCount },
  };

  // Column widths
  for (let i = 1; i <= STORE_META_COLS; i++) {
    const f = storeFields[i - 1];
    let w = 16;
    if (f) {
      switch (f.key) {
        case "name": w = 30; break;
        case "state": w = 8; break;
        case "showcase_count": w = 10; break;
        case "city": case "country": case "store_code": case "store_model":
        case "nickname": case "phone": case "manager_name":
          w = 18; break;
        case "observations": case "street": case "email":
          w = 28; break;
        default:
          w = Math.max(14, Math.min(28, f.label.length + 4));
      }
    }
    ws.getColumn(i).width = w;
  }
  for (let i = STORE_META_COLS + 1; i <= colCount; i++) {
    const item = items[i - STORE_META_COLS - 1];
    const nameLen = item?.name?.length || 10;
    ws.getColumn(i).width = Math.min(Math.max(nameLen + 4, 18), 30);
  }
  // Hide the user-selected extra store-info columns (inserted right after the
  // UF column inside the meta block). Their data is already written by the
  // standard header / store-row loops above.
  for (const colNum of hiddenColSet) {
    ws.getColumn(colNum).hidden = true;
  }
}

// ─── Main export ─────────────────────────────────────────

export type AppendMatrixParams = {
  stores: ClientStore[];
  pieces: CampaignPiece[];
  qtyMap: Record<string, number>;
  /** Optional display override for main matrix cells. Kit columns are still computed from qtyMap. */
  displayQtyMap?: Record<string, number>;
  campaignName: string;
  kits?: CampaignKit[];
  kitPieces?: CampaignKitPiece[];
  palette?: ColorPalette;
  locations?: CampaignPieceLocation[];
  subLocations?: CampaignPieceSubLocation[];
  allPieces?: CampaignPiece[];
  agencyName?: string;
  clientName?: string;
  storeFields?: StoreFieldDef[];
  /** Extra store info columns appended to the right of every transposed sheet and hidden by default. */
  extraHiddenStoreFields?: StoreFieldDef[];
  /** When provided, sheet names already used in the workbook (lowercased) — to avoid collisions. */
  reservedSheetNames?: Set<string>;
  /** When true, skip the Dashboard tab. Useful when appending to another workbook. */
  skipDashboard?: boolean;
  /** When true, skip generating individual tabs for each kit (kits still appear as columns in main matrix). */
  skipKitTabs?: boolean;
  /** When true, order pieces and kits by their numeric Código instead of display_order. */
  sortByCode?: boolean;
  /** Optional: highlight the columns (and their store-row cells) for these item ids in the main matrix. */
  changeMap?: Map<string, "added" | "removed" | "modified" | "qty">;
  /** Optional: highlight entire store rows by store id (added=green, removed=red). */
  storeChangeMap?: Map<string, "added" | "removed">;
};

/**
 * Appends the Rateio matrix sheets (Matriz Lojas x Peças, kit tabs, optional Dashboard)
 * to an EXISTING workbook. Used by both the standalone Rateio export and the
 * Supplier Budget export (which appends these sheets after its own "Orçamento" tab).
 */
export async function appendMatrixSheets(wb: ExcelJS.Workbook, params: AppendMatrixParams): Promise<string> {
  const {
    stores,
    pieces,
    qtyMap,
    displayQtyMap,
    campaignName,
    kits = [],
    kitPieces = [],
    palette,
    locations = [],
    subLocations = [],
    allPieces,
    agencyName,
    clientName,
    storeFields,
    extraHiddenStoreFields,
    reservedSheetNames,
    skipDashboard,
    skipKitTabs,
    sortByCode,
    changeMap,
    storeChangeMap,
  } = params;

  const effectiveStoreFields = storeFields && storeFields.length > 0 ? storeFields : DEFAULT_STORE_FIELDS;
  const effectiveMatrixStoreFields = getMatrixStoreFieldsWithHidden(effectiveStoreFields, extraHiddenStoreFields || []);
  const effectiveStoreMetaCols = Math.max(effectiveMatrixStoreFields.length, 1);
  const colors = makeColors(palette);
  const locData: LocationData = { locations, subLocations };

  // Build full hierarchy title
  const titleParts = [agencyName, clientName, campaignName].filter(Boolean);
  const fullTitle = titleParts.join(" / ");

  // Build unified column list — same ordering rules used in the Rateio module
  // (display_order, then piece-before-kit on ties, then id) so that the
  // "Matriz Lojas x Peças" tab produced here matches the standalone Rateio export.
  type ColItem = MatrixItem & { _type: "piece" | "kit"; display_order: number };
  const allColumns: ColItem[] = [
    ...pieces.map((p) => ({
      ...p,
      _type: "piece" as const,
      store_category: p.category,
      specification: p.specification || "",
      installation_instructions: p.installation_instructions || "",
      is_new: (p as any).is_new || false,
    })),
    ...kits.map((k) => ({
      id: k.id,
      code: k.code,
      name: k.name,
      size: "",
      store_category: k.category,
      sub_location: k.sub_location,
      specification: "",
      installation_instructions: "",
      image_url: (k as any).image_report_url || k.image_url,
      is_new: (k as any).is_new || false,
      _type: "kit" as const,
      display_order: k.display_order,
    })),
  ].sort((a, b) => {
    if (sortByCode) {
      return (Number(a.code ?? Number.MAX_SAFE_INTEGER) - Number(b.code ?? Number.MAX_SAFE_INTEGER))
        || (a._type === b._type ? 0 : a._type === "piece" ? -1 : 1)
        || (a.id < b.id ? -1 : 1);
    }
    return (a.display_order ?? 0) - (b.display_order ?? 0)
      || (a._type === b._type ? 0 : a._type === "piece" ? -1 : 1)
      || (a.id < b.id ? -1 : 1);
  });

  // Build kit sheet names map first.
  // Excel forbids \ / ? * [ ] : in sheet names and limits length to 31 chars.
  // Also deduplicate names (truncation can collide, e.g. "Kit 111 - KIT Revestimento Cubo" / "Kit 114 - ...").
  const usedSheetNames = new Set<string>(reservedSheetNames ? Array.from(reservedSheetNames) : []);
  const safeSheetName = (raw: string): string => {
    let base = raw.replace(/[\\/?*\[\]:]/g, "-").replace(/\s+/g, " ").slice(0, 31).trim();
    if (!base) base = "Sheet";
    let name = base;
    let i = 2;
    while (usedSheetNames.has(name.toLowerCase())) {
      const suffix = ` (${i++})`;
      name = base.slice(0, 31 - suffix.length).trim() + suffix;
    }
    usedSheetNames.add(name.toLowerCase());
    return name;
  };
  const mainSheetName = safeSheetName("Matriz Lojas x Peças");
  const dashboardSheetName = skipDashboard ? null : safeSheetName("Dashboard");
  const kitSheetNames = new Map<string, string>();
  for (const kit of kits) {
    const kpList = kitPieces.filter((kp) => kp.kit_id === kit.id);
    if (kpList.length === 0) continue;
    kitSheetNames.set(kit.id, safeSheetName(`Kit ${kit.code} - ${kit.name}`));
  }

  // Pre-compute kit quantities into a merged qtyMap for the main tab
  const mainQtyMap: Record<string, number> = { ...qtyMap };
  for (const kit of kits) {
    const kpList = kitPieces.filter((kp) => kp.kit_id === kit.id);
    if (kpList.length === 0) continue;
    for (const s of stores) {
      const kitQty = Math.min(
        ...kpList.map((kp) => {
          const baseQty = qtyMap[`${s.id}-${kp.piece_id}`] || 0;
          return Math.floor(baseQty / (kp.quantity || 1));
        })
      );
      mainQtyMap[`${s.id}-${kit.id}`] = kitQty;
    }
  }
  if (displayQtyMap) Object.assign(mainQtyMap, displayQtyMap);

  // ABA 1 – Main matrix
  const ws = wb.addWorksheet(mainSheetName);
  await buildTransposedSheet(wb, ws, fullTitle, allColumns, stores, mainQtyMap, (sId, pId) => `${sId}-${pId}`, colors, locData, kitSheetNames, effectiveStoreFields, extraHiddenStoreFields || []);

  // Apply change highlights to the main matrix columns (meta rows + store rows).
  if (changeMap && changeMap.size > 0) {
    const STORE_META_COLS = effectiveStoreMetaCols;
    const META_ROWS = META_LABELS.length;
    const firstMetaRow = 2;
    const lastMetaRow = firstMetaRow + META_ROWS - 1;
    const firstStoreRow = lastMetaRow + 2; // skip stores header row
    const lastStoreRow = firstStoreRow + stores.length - 1;
    const palette: Record<string, { bg: string; font: string }> = {
      added:    { bg: "FFE6F4EA", font: "FF2F855A" },
      removed:  { bg: "FFFFF0F0", font: "FFC53030" },
      modified: { bg: "FFFFF7CC", font: "FF8A6D00" },
      qty:      { bg: "FFFFF7CC", font: "FF8A6D00" },
    };
    for (let i = 0; i < allColumns.length; i++) {
      const item = allColumns[i];
      const kind = changeMap.get(item.id);
      if (!kind) continue;
      const colNum = STORE_META_COLS + 1 + i;
      const tone = palette[kind];
      // Re-paint the meta-area cells (rows 2..lastMetaRow) for this column
      for (let rowNum = firstMetaRow; rowNum <= lastMetaRow; rowNum++) {
        const cell = ws.getCell(rowNum, colNum);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tone.bg } };
        cell.font = { ...(cell.font || {}), color: { argb: tone.font }, bold: true };
      }
      // Lightly tint the store-row cells too (keep value visible)
      for (let rowNum = firstStoreRow; rowNum <= lastStoreRow; rowNum++) {
        const cell = ws.getCell(rowNum, colNum);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tone.bg } };
      }
    }
  }

  // Apply store-row highlights (added/removed stores)
  if (storeChangeMap && storeChangeMap.size > 0) {
    const STORE_META_COLS = effectiveStoreMetaCols;
    const META_ROWS = META_LABELS.length;
    const firstStoreRow = META_ROWS + 2 + 1; // meta rows + title + stores header
    const lastCol = STORE_META_COLS + allColumns.length;
    const storeTone: Record<string, { bg: string; font: string }> = {
      added:   { bg: "FFD1FAE5", font: "FF065F46" }, // green
      removed: { bg: "FFFEE2E2", font: "FF991B1B" }, // red
    };
    for (let si = 0; si < stores.length; si++) {
      const kind = storeChangeMap.get(stores[si].id);
      if (!kind) continue;
      const tone = storeTone[kind];
      const rowNum = firstStoreRow + si;
      for (let colNum = 1; colNum <= lastCol; colNum++) {
        const cell = ws.getCell(rowNum, colNum);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tone.bg } };
        const baseFont = (cell.font || {}) as any;
        cell.font = {
          ...baseFont,
          color: { argb: tone.font },
          bold: colNum === 1 ? true : baseFont.bold,
          strike: kind === "removed",
        };
      }
    }
  }
  if (skipKitTabs) {
    if (skipDashboard || !dashboardSheetName) return mainSheetName;
  }
  for (const kit of skipKitTabs ? [] : kits) {
    const kpList = kitPieces.filter((kp) => kp.kit_id === kit.id);
    if (kpList.length === 0) continue;

    const kitItems: MatrixItem[] = kpList.map((kp) => {
      const piece = (allPieces || pieces).find((p) => p.id === kp.piece_id);
      return {
        id: kp.id,
        code: piece?.code ?? 0,
        name: piece?.name ?? "",
        size: piece?.size ?? "",
        store_category: piece?.store_category,
        sub_location: piece?.sub_location,
        specification: piece?.specification || "",
        installation_instructions: piece?.installation_instructions || "",
        image_url: (piece as any)?.image_report_url || piece?.image_url,
        is_new: (piece as any)?.is_new || false,
      };
    });

    const kitQtyMap: Record<string, number> = {};
    for (const s of stores) {
      // Quantos kits completos esta loja recebe
      // = min sobre os componentes de floor(qtdComponente / qtdPorKit)
      const kitsAtStore = kpList.length > 0
        ? Math.min(
            ...kpList.map((kp) =>
              Math.floor((qtyMap[`${s.id}-${kp.piece_id}`] || 0) / (kp.quantity || 1)),
            ),
          )
        : 0;
      const safeKits = Number.isFinite(kitsAtStore) ? kitsAtStore : 0;
      for (const kp of kpList) {
        kitQtyMap[`${s.id}-${kp.id}`] = safeKits * (kp.quantity || 1);
      }
    }

    const sheetName = kitSheetNames.get(kit.id)!;
    const kitWs = wb.addWorksheet(sheetName);
    await buildTransposedSheet(wb, kitWs, `${kit.name} (Kit ${kit.code})`, kitItems, stores, kitQtyMap, (sId, kpId) => `${sId}-${kpId}`, colors, locData, undefined, effectiveStoreFields, extraHiddenStoreFields || []);
  }

  if (skipDashboard || !dashboardSheetName) return mainSheetName;

  // Dashboard tab
  const { PRIMARY, SECONDARY, LIGHT, BORDER } = colors;
  const whiteFont: Partial<ExcelJS.Font> = { color: { argb: "FFFFFFFF" }, bold: true };
  const darkFont: Partial<ExcelJS.Font> = { color: { argb: "FF1E293B" } };
  const thinBorder: Partial<ExcelJS.Border> = { style: "thin", color: { argb: `FF${BORDER}` } };
  const whiteBorder: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFFFFFFF" } };
  const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
  const allWhiteBorders = { top: whiteBorder, bottom: whiteBorder, left: whiteBorder, right: whiteBorder };

  const dash = wb.addWorksheet(dashboardSheetName);
  let currentRow = 1;

  function addSectionTitle(title: string, cols: number) {
    const row = dash.getRow(currentRow);
    row.getCell(1).value = title;
    dash.mergeCells(currentRow, 1, currentRow, cols);
    const cell = dash.getCell(currentRow, 1);
    cell.font = { ...whiteFont, size: 14 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = gradientFill(PRIMARY, SECONDARY);
    cell.border = allWhiteBorders;
    row.height = 35;
    currentRow++;
  }

  function addTableHeader(headers: string[]) {
    const row = dash.getRow(currentRow);
    headers.forEach((h, i) => {
      const cell = row.getCell(i + 1);
      cell.value = h;
      cell.font = { ...whiteFont, size: 11 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = gradientFill(SECONDARY, PRIMARY);
      cell.border = allWhiteBorders;
    });
    row.height = 25;
    currentRow++;
  }

  function addTableRow(values: (string | number)[], isEven: boolean) {
    const row = dash.getRow(currentRow);
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.font = { ...darkFont, size: 11 };
      cell.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
      cell.fill = isEven ? solidFill(LIGHT) : solidFill("FFFFFF");
      cell.border = allBorders;
    });
    currentRow++;
  }

  const pieceTotals = pieces.map((p) => {
    const total = stores.reduce((sum, s) => sum + (qtyMap[`${s.id}-${p.id}`] || 0), 0);
    return { name: `${p.code} - ${p.name}`, total };
  }).sort((a, b) => b.total - a.total);

  addSectionTitle("TOP 5 PEÇAS MAIS PEDIDAS", 3);
  addTableHeader(["#", "Peça", "Quantidade Total"]);
  pieceTotals.slice(0, 5).forEach((p, i) => {
    addTableRow([i + 1, p.name, p.total], i % 2 === 0);
  });
  currentRow++;

  const storeTotals = stores.map((s) => {
    const total = allColumns.reduce((sum, p) => sum + (qtyMap[`${s.id}-${p.id}`] || 0), 0);
    return { name: s.name, total };
  }).sort((a, b) => b.total - a.total);

  addSectionTitle("RANKING DE LOJAS POR VOLUME", 3);
  addTableHeader(["#", "Loja", "Total de Itens"]);
  storeTotals.forEach((s, i) => {
    addTableRow([i + 1, s.name, s.total], i % 2 === 0);
  });
  currentRow++;

  const grandTotal = storeTotals.reduce((s, x) => s + x.total, 0);
  addSectionTitle("TOTAL GERAL CONSOLIDADO", 2);
  addTableHeader(["Métrica", "Valor"]);
  addTableRow(["Total de Lojas", stores.length], false);
  addTableRow(["Total de Peças", pieces.length], true);
  addTableRow(["Total de Kits", kits.length], false);
  addTableRow(["Volume Total", grandTotal], true);

  dash.getColumn(1).width = 12;
  dash.getColumn(2).width = 40;
  dash.getColumn(3).width = 20;

  return mainSheetName;
}

// ─── Thin wrapper: standalone Rateio export (creates workbook + saves) ───

export async function exportMatrixExcelJS(
  stores: ClientStore[],
  pieces: CampaignPiece[],
  qtyMap: Record<string, number>,
  campaignName: string,
  kits: CampaignKit[] = [],
  kitPieces: CampaignKitPiece[] = [],
  palette?: ColorPalette,
  locations: CampaignPieceLocation[] = [],
  subLocations: CampaignPieceSubLocation[] = [],
  allPieces?: CampaignPiece[],
  agencyName?: string,
  clientName?: string,
  storeFields?: StoreFieldDef[],
  extraHiddenStoreFields?: StoreFieldDef[],
  sourceLabel?: string,
) {
  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "ProduzAI";

  await appendMatrixSheets(wb, {
    stores,
    pieces,
    qtyMap,
    campaignName,
    kits,
    kitPieces,
    palette,
    locations,
    subLocations,
    allPieces,
    agencyName,
    clientName,
    storeFields,
    extraHiddenStoreFields,
  });

  const buffer = await wb.xlsx.writeBuffer();
  const sourceSuffix = sourceLabel ? ` — ${sourceLabel}` : "";
  const fileName = `Rateio_${campaignName.replace(/[^a-zA-Z0-9]/g, "_")}${sourceSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await saveXlsxAs(buffer as ArrayBuffer, fileName);
}
