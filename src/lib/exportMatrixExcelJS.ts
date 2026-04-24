import type ExcelJSType from "exceljs";
type ExcelJSModule = typeof import("exceljs");
import { saveAs } from "file-saver";
import type { ClientStore, CampaignPiece, CampaignKit, CampaignKitPiece, CampaignPieceLocation, CampaignPieceSubLocation } from "@/hooks/useMultiClientData";
import type { ColorPalette } from "@/components/RateioExportColorDialog";

// ─── Helpers ─────────────────────────────────────────────

function getExcelColumnLetter(colNum: number): string {
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

function gradientFill(from: string, to: string, degree = 0): ExcelJS.FillGradientAngle {
  return {
    type: "gradient",
    gradient: "angle",
    degree,
    stops: [
      { position: 0, color: { argb: `FF${from}` } },
      { position: 1, color: { argb: `FF${to}` } },
    ],
  };
}

// ─── Types ───────────────────────────────────────────────

const META_LABELS = ["IMAGEM", "CÓDIGO", "LOCAL", "NOME", "TAMANHO", "ESPECIFICAÇÃO", "INSTRUÇÕES DE INSTALAÇÃO"];
const IMAGE_ROW_INDEX = 0;
const META_ROW_COUNT = META_LABELS.length;

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
  _type?: "piece" | "kit";
};

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
) {
  const { PRIMARY, SECONDARY, LIGHT, BORDER } = colors;
  const whiteFont: Partial<ExcelJS.Font> = { color: { argb: "FFFFFFFF" }, bold: true };
  const darkFont: Partial<ExcelJS.Font> = { color: { argb: "FF1E293B" } };
  const thinBorder: Partial<ExcelJS.Border> = { style: "thin", color: { argb: `FF${BORDER}` } };
  const whiteBorder: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFFFFFFF" } };
  const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
  const allWhiteBorders = { top: whiteBorder, bottom: whiteBorder, left: whiteBorder, right: whiteBorder };

  const STORE_META_COLS = 4;
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

  // Pre-fetch images
  const imageCache: Record<string, { base64: string; ext: "png" | "jpeg"; width: number; height: number } | null> = {};
  await Promise.all(
    items.map(async (p) => {
      if (p.image_url) {
        imageCache[p.id] = await fetchImageAsBase64(p.image_url);
      }
    })
  );

  // Meta rows
  for (let mi = 0; mi < META_ROW_COUNT; mi++) {
    const values: (string | number)[] = [META_LABELS[mi], "", "", ""];
    for (const p of items) {
      switch (mi) {
        case 0: values.push(""); break;
        case 1: values.push(p.code); break;
        case 2: values.push(formatLocation(p.store_category, p.sub_location, locData.locations, locData.subLocations)); break;
        case 3: values.push(p.name); break;
        case 4: values.push(p.size); break;
        case 5: values.push(p.specification || ""); break;
        case 6: values.push(p.installation_instructions || ""); break;
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
      cell.fill = mi === IMAGE_ROW_INDEX ? solidFill("FFFFFF") : gradientFill("FFFFFF", LIGHT);
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
  const storeHeaderValues: (string | number)[] = ["NOME DA LOJA", "CIDADE", "UF", "VITRINES"];
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
    const rowValues: (string | number)[] = [s.name, (s as any).city || "", (s as any).state || "", (s as any).showcase_count ?? 0];
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
  const totalsRow = ws.addRow(["TOTAL", "", "", ""]);
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

  // Column widths
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 8;
  ws.getColumn(4).width = 10;
  for (let i = STORE_META_COLS + 1; i <= colCount; i++) {
    const item = items[i - STORE_META_COLS - 1];
    const nameLen = item?.name?.length || 10;
    ws.getColumn(i).width = Math.min(Math.max(nameLen + 4, 18), 30);
  }
}

// ─── Main export ─────────────────────────────────────────

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
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ProduzAI";
  const colors = makeColors(palette);
  const locData: LocationData = { locations, subLocations };

  // Build full hierarchy title
  const titleParts = [agencyName, clientName, campaignName].filter(Boolean);
  const fullTitle = titleParts.join(" / ");

  // Build unified column list
  type ColItem = MatrixItem & { _type: "piece" | "kit"; display_order: number };
  const allColumns: ColItem[] = [
    ...pieces.map((p) => ({
      ...p,
      _type: "piece" as const,
      store_category: p.category,
      specification: p.specification || "",
      installation_instructions: p.installation_instructions || "",
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
      image_url: k.image_url,
      _type: "kit" as const,
      display_order: k.display_order,
    })),
  ].sort((a, b) => a.display_order - b.display_order);

  // Build kit sheet names map first
  const kitSheetNames = new Map<string, string>();
  for (const kit of kits) {
    const kpList = kitPieces.filter((kp) => kp.kit_id === kit.id);
    if (kpList.length === 0) continue;
    const sheetName = `Kit ${kit.code} - ${kit.name}`.slice(0, 31);
    kitSheetNames.set(kit.id, sheetName);
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

  // ABA 1 – Main matrix
  const ws = wb.addWorksheet("Matriz Lojas x Peças");
  await buildTransposedSheet(wb, ws, fullTitle, allColumns, stores, mainQtyMap, (sId, pId) => `${sId}-${pId}`, colors, locData, kitSheetNames);

  // Kit tabs
  for (const kit of kits) {
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
        image_url: piece?.image_url,
      };
    });

    const kitQtyMap: Record<string, number> = {};
    for (const s of stores) {
      for (const kp of kpList) {
        kitQtyMap[`${s.id}-${kp.id}`] = kp.quantity;
      }
    }

    const sheetName = kitSheetNames.get(kit.id)!;
    const kitWs = wb.addWorksheet(sheetName);
    await buildTransposedSheet(wb, kitWs, `${kit.name} (Kit ${kit.code})`, kitItems, stores, kitQtyMap, (sId, kpId) => `${sId}-${kpId}`, colors, locData);
  }

  // Dashboard tab
  const { PRIMARY, SECONDARY, LIGHT, BORDER } = colors;
  const whiteFont: Partial<ExcelJS.Font> = { color: { argb: "FFFFFFFF" }, bold: true };
  const darkFont: Partial<ExcelJS.Font> = { color: { argb: "FF1E293B" } };
  const thinBorder: Partial<ExcelJS.Border> = { style: "thin", color: { argb: `FF${BORDER}` } };
  const whiteBorder: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFFFFFFF" } };
  const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
  const allWhiteBorders = { top: whiteBorder, bottom: whiteBorder, left: whiteBorder, right: whiteBorder };

  const dash = wb.addWorksheet("Dashboard");
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

  // Generate and download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const fileName = `Orcamento_${campaignName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, fileName);
}
