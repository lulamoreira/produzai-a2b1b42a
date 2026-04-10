import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { ClientStore, CampaignPiece, CampaignKit, CampaignKitPiece } from "@/hooks/useMultiClientData";

// ─── Helpers ─────────────────────────────────────────────

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

    // Get natural dimensions
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

const DARK_BLUE = "0D2B5E";
const MED_BLUE = "1A6BAF";
const LIGHT_BLUE = "4DA8DA";
const PALE_BLUE = "EAF4FB";
const BORDER_BLUE = "C0D8E8";

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

function solidFill(color: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: `FF${color}` } };
}

const thinBorder: Partial<ExcelJS.Border> = { style: "thin", color: { argb: `FF${BORDER_BLUE}` } };
const whiteBorder: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFFFFFFF" } };
const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const allWhiteBorders = { top: whiteBorder, bottom: whiteBorder, left: whiteBorder, right: whiteBorder };

const whiteFont: Partial<ExcelJS.Font> = { color: { argb: "FFFFFFFF" }, bold: true };
const darkFont: Partial<ExcelJS.Font> = { color: { argb: "FF1E293B" } };

const META_LABELS = ["IMAGEM", "CÓDIGO", "LOCAL", "NOME", "TAMANHO", "ESPECIFICAÇÃO", "INSTRUÇÕES DE INSTALAÇÃO"];
const IMAGE_ROW_INDEX = 0;
const META_ROW_COUNT = META_LABELS.length;

// ─── Shared: build a transposed piece sheet ──────────────

type MatrixItem = {
  id: string;
  code: number;
  name: string;
  size: string;
  store_category?: string | null;
  specification?: string;
  installation_instructions?: string;
  image_url?: string | null;
};

async function buildTransposedSheet(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  title: string,
  items: MatrixItem[],
  stores: ClientStore[],
  qtyMap: Record<string, number>,
  qtyKeyFn: (storeId: string, itemId: string) => string,
) {
  const STORE_META_COLS = 4; // name, city, state, showcase_count
  const colCount = items.length + STORE_META_COLS;
  const IMAGE_ROW_HEIGHT = 120;

  // Row 1 – Title
  ws.addRow([title.toUpperCase()]);
  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell(1, 1);
  titleCell.font = { ...whiteFont, size: 16 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = gradientFill(DARK_BLUE, MED_BLUE);
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
        case 2: values.push(p.store_category || ""); break;
        case 3: values.push(p.name); break;
        case 4: values.push(p.size); break;
        case 5: values.push(p.specification || ""); break;
        case 6: values.push(p.installation_instructions || ""); break;
        default: values.push("");
      }
    }
    const row = ws.addRow(values);
    const rowNum = mi + 2;

    // Merge the label across the first STORE_META_COLS columns
    ws.mergeCells(rowNum, 1, rowNum, STORE_META_COLS);
    const labelCell = ws.getCell(rowNum, 1);
    labelCell.font = { ...whiteFont, size: 11 };
    labelCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    labelCell.fill = gradientFill(DARK_BLUE, "0E4D72", 90);
    labelCell.border = allWhiteBorders;

    for (let ci = STORE_META_COLS + 1; ci <= colCount; ci++) {
      const cell = ws.getCell(rowNum, ci);
      cell.font = { ...darkFont, size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = mi === IMAGE_ROW_INDEX ? solidFill("FFFFFF") : gradientFill("FFFFFF", PALE_BLUE);
      cell.border = allBorders;
    }

    if (mi === IMAGE_ROW_INDEX) row.height = IMAGE_ROW_HEIGHT;
    else if (mi === 5 || mi === 6) row.height = 80;
    else row.height = 25;
  }

  // Images – fit to cell preserving aspect ratio
  const imageRowNum = 2;
  // Cell available area: colWidth in px ≈ colWidth * 7.5, rowHeight in px = IMAGE_ROW_HEIGHT * 0.75
  // We use pixel-based ext sizing with padding
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
      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }

      const imageId = wb.addImage({ base64: imgData.base64, extension: imgData.ext });
      ws.addImage(imageId, {
        tl: { col: pi + STORE_META_COLS + 0.05, row: imageRowNum - 1 + 0.1 },
        ext: { width: Math.round(w), height: Math.round(h) },
      });
    }
  }

  // Stores header
  const storesHeaderRowNum = META_ROW_COUNT + 2;
  const storeHeaderValues: (string | number)[] = ["NOME DA LOJA", "CIDADE", "UF", "VITRINES"];
  for (const p of items) storeHeaderValues.push("");
  const storeHeaderRow = ws.addRow(storeHeaderValues);
  storeHeaderRow.height = 30;
  storeHeaderRow.eachCell((cell) => {
    cell.font = { ...whiteFont, size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = gradientFill(MED_BLUE, LIGHT_BLUE);
    cell.border = allWhiteBorders;
  });
  for (let pi = 0; pi < items.length; pi++) {
    ws.getCell(storesHeaderRowNum, pi + 4 + 1).value = items[pi].code;
  }

  // Store rows
  for (let si = 0; si < stores.length; si++) {
    const s = stores[si];
    const rowValues: (string | number)[] = [s.name, (s as any).city || "", (s as any).state || "", (s as any).showcase_count ?? 0];
    for (const p of items) {
      rowValues.push(qtyMap[qtyKeyFn(s.id, p.id)] || 0);
    }
    const row = ws.addRow(rowValues);
    const isEven = si % 2 === 0;
    row.eachCell((cell, colNumber) => {
      if (colNumber === 1) {
        cell.font = { bold: true, size: 10, color: { argb: "FF1E293B" } };
        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      } else {
        cell.font = { ...darkFont, size: 11 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
      cell.fill = isEven ? solidFill(PALE_BLUE) : solidFill("FFFFFF");
      cell.border = allBorders;
    });
  }

  // Totals
  const totalsValues: (string | number)[] = ["TOTAL", "", "", ""];
  let grandTotal = 0;
  for (const p of items) {
    const t = stores.reduce((sum, s) => sum + (qtyMap[qtyKeyFn(s.id, p.id)] || 0), 0);
    grandTotal += t;
    totalsValues.push(t);
  }
  const totalsRow = ws.addRow(totalsValues);
  totalsRow.height = 30;
  totalsRow.eachCell((cell) => {
    cell.font = { ...whiteFont, size: 12 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = gradientFill(MED_BLUE, DARK_BLUE);
    cell.border = allWhiteBorders;
  });

  // Column widths
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 18; // city
  ws.getColumn(3).width = 8;  // state
  ws.getColumn(4).width = 10; // showcase_count
  for (let i = STORE_META_COLS + 1; i <= colCount; i++) {
    const item = items[i - STORE_META_COLS - 1];
    const nameLen = item?.name?.length || 10;
    ws.getColumn(i).width = Math.min(Math.max(nameLen + 4, 18), 30);
  }

  return grandTotal;
}

// ─── Main export ─────────────────────────────────────────

export async function exportMatrixExcelJS(
  stores: ClientStore[],
  pieces: CampaignPiece[],
  qtyMap: Record<string, number>,
  campaignName: string,
  kits: CampaignKit[] = [],
  kitPieces: CampaignKitPiece[] = [],
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ProduzAI";

  // ═══════════════════════════════════════════════════════
  //  ABA 1 – Matriz principal (peças + kits como colunas)
  // ═══════════════════════════════════════════════════════

  // Build unified column list sorted by display_order
  type ColItem = MatrixItem & { _type: "piece" | "kit"; display_order: number };
  const allColumns: ColItem[] = [
    ...pieces.map(p => ({ ...p, _type: "piece" as const, specification: p.specification || "", installation_instructions: p.installation_instructions || "" })),
    ...kits.map(k => ({
      id: k.id,
      code: k.code,
      name: k.name,
      size: "",
      store_category: null,
      specification: "",
      installation_instructions: "",
      image_url: k.image_url,
      _type: "kit" as const,
      display_order: k.display_order,
    })),
  ].sort((a, b) => a.display_order - b.display_order);

  const ws = wb.addWorksheet("Matriz Lojas x Peças");
  await buildTransposedSheet(wb, ws, campaignName, allColumns, stores, qtyMap, (sId, pId) => `${sId}-${pId}`);

  // ═══════════════════════════════════════════════════════
  //  ABAS por Kit – listagem de peças do kit (1 un cada)
  // ═══════════════════════════════════════════════════════

  for (const kit of kits) {
    const kpList = kitPieces.filter(kp => kp.kit_id === kit.id);
    if (kpList.length === 0) continue;

    const kitItems: MatrixItem[] = kpList.map(kp => {
      const piece = pieces.find(p => p.id === kp.piece_id);
      return {
        id: kp.id,
        code: piece?.code ?? 0,
        name: piece?.name ?? "",
        size: piece?.size ?? "",
        store_category: piece?.store_category,
        specification: piece?.specification || "",
        installation_instructions: piece?.installation_instructions || "",
        image_url: piece?.image_url,
      };
    });

    // Build a qty map where every store gets quantity = kit piece quantity (usually 1)
    const kitQtyMap: Record<string, number> = {};
    for (const s of stores) {
      for (const kp of kpList) {
        kitQtyMap[`${s.id}-${kp.id}`] = kp.quantity;
      }
    }

    const sheetName = `Kit ${kit.code} - ${kit.name}`.slice(0, 31);
    const kitWs = wb.addWorksheet(sheetName);
    await buildTransposedSheet(wb, kitWs, `${kit.name} (Kit ${kit.code})`, kitItems, stores, kitQtyMap, (sId, kpId) => `${sId}-${kpId}`);
  }

  // ═══════════════════════════════════════════════════════
  //  ABA Dashboard
  // ═══════════════════════════════════════════════════════
  const dash = wb.addWorksheet("Dashboard");
  let currentRow = 1;

  function addSectionTitle(title: string, cols: number) {
    const row = dash.getRow(currentRow);
    row.getCell(1).value = title;
    dash.mergeCells(currentRow, 1, currentRow, cols);
    const cell = dash.getCell(currentRow, 1);
    cell.font = { ...whiteFont, size: 14 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = gradientFill(DARK_BLUE, MED_BLUE);
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
      cell.fill = gradientFill(MED_BLUE, LIGHT_BLUE);
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
      cell.fill = isEven ? solidFill(PALE_BLUE) : solidFill("FFFFFF");
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

  // ── Generate and download ──
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const fileName = `Orcamento_${campaignName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, fileName);
}
