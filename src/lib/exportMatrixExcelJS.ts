import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { ClientStore, CampaignPiece } from "@/hooks/useMultiClientData";

// ─── Helpers ─────────────────────────────────────────────

async function fetchImageAsBase64(url: string): Promise<{ base64: string; ext: "png" | "jpeg" } | null> {
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
    return { base64, ext };
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

// ─── Meta row labels (transposed: pieces in columns, metadata in rows) ───
const META_LABELS = ["IMAGEM DA PEÇA", "CÓDIGO", "LOCAL", "NOME", "TAMANHO", "ESPECIFICAÇÃO", "INSTRUÇÕES DE INSTALAÇÃO"];
const IMAGE_ROW_INDEX = 0;  // index in META_LABELS
const META_ROW_COUNT = META_LABELS.length;

// ─── Main export ─────────────────────────────────────────

export async function exportMatrixExcelJS(
  stores: ClientStore[],
  pieces: CampaignPiece[],
  qtyMap: Record<string, number>,
  campaignName: string
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ProduzAI";

  // ═══════════════════════════════════════════════════════
  //  ABA 1 – Matriz (Transposed: pieces as columns)
  // ═══════════════════════════════════════════════════════
  const ws = wb.addWorksheet("Matriz Lojas x Peças");

  const colCount = pieces.length + 1; // col A (labels/store names) + one col per piece
  const IMAGE_ROW_HEIGHT = 120;

  // Row 1 – Title
  const titleRow = ws.addRow([campaignName.toUpperCase()]);
  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell(1, 1);
  titleCell.font = { ...whiteFont, size: 16 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = gradientFill(DARK_BLUE, MED_BLUE);
  titleCell.border = allWhiteBorders;
  ws.getRow(1).height = 40;

  // Pre-fetch images
  const imageCache: Record<string, { base64: string; ext: "png" | "jpeg" } | null> = {};
  await Promise.all(
    pieces.map(async (p) => {
      if (p.image_url) {
        imageCache[p.id] = await fetchImageAsBase64(p.image_url);
      }
    })
  );

  // Rows 2..N – Meta rows (one per META_LABELS)
  for (let mi = 0; mi < META_ROW_COUNT; mi++) {
    const label = META_LABELS[mi];
    const values: (string | number)[] = [label];

    for (const p of pieces) {
      switch (mi) {
        case 0: // IMAGEM - leave empty, images added separately
          values.push("");
          break;
        case 1: // CÓDIGO
          values.push(p.code);
          break;
        case 2: // LOCAL
          values.push(p.store_category || "");
          break;
        case 3: // NOME
          values.push(p.name);
          break;
        case 4: // TAMANHO
          values.push(p.size);
          break;
        case 5: // ESPECIFICAÇÃO
          values.push(p.specification || "");
          break;
        case 6: // INSTRUÇÕES
          values.push(p.installation_instructions || "");
          break;
        default:
          values.push("");
      }
    }

    const row = ws.addRow(values);
    const rowNum = mi + 2; // 1-based

    // Style label cell (col A)
    const labelCell = ws.getCell(rowNum, 1);
    labelCell.font = { ...whiteFont, size: 11 };
    labelCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    labelCell.fill = gradientFill(DARK_BLUE, "0E4D72", 90);
    labelCell.border = allWhiteBorders;

    // Style data cells
    for (let ci = 2; ci <= colCount; ci++) {
      const cell = ws.getCell(rowNum, ci);
      cell.font = { ...darkFont, size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = mi === IMAGE_ROW_INDEX
        ? solidFill("FFFFFF")
        : gradientFill("FFFFFF", PALE_BLUE);
      cell.border = allBorders;
    }

    // Row heights
    if (mi === IMAGE_ROW_INDEX) {
      row.height = IMAGE_ROW_HEIGHT;
    } else if (mi === 5 || mi === 6) {
      // Spec and instructions can be tall
      row.height = 80;
    } else {
      row.height = 25;
    }
  }

  // Add images to the image row
  const imageRowNum = 2; // row 2 = IMAGEM DA PEÇA
  for (let pi = 0; pi < pieces.length; pi++) {
    const imgData = imageCache[pieces[pi].id];
    if (imgData) {
      const imageId = wb.addImage({ base64: imgData.base64, extension: imgData.ext });
      ws.addImage(imageId, {
        tl: { col: pi + 1 + 0.05, row: imageRowNum - 1 + 0.1 },
        ext: { width: 140, height: 100 },
      });
    }
  }

  // ── Stores header row ──
  const storesHeaderRowNum = META_ROW_COUNT + 2; // after title + meta rows
  const storeHeaderValues: (string | number)[] = ["NOME DA LOJA"];
  for (const p of pieces) {
    storeHeaderValues.push(""); // piece column headers already shown above
  }
  const storeHeaderRow = ws.addRow(storeHeaderValues);
  storeHeaderRow.height = 30;
  storeHeaderRow.eachCell((cell, colNumber) => {
    cell.font = { ...whiteFont, size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = gradientFill(MED_BLUE, LIGHT_BLUE);
    cell.border = allWhiteBorders;
  });
  // Put piece codes in header for reference
  for (let pi = 0; pi < pieces.length; pi++) {
    const cell = ws.getCell(storesHeaderRowNum, pi + 2);
    cell.value = pieces[pi].code;
  }

  // ── Store data rows ──
  for (let si = 0; si < stores.length; si++) {
    const s = stores[si];
    const rowValues: (string | number)[] = [s.name];
    for (const p of pieces) {
      rowValues.push(qtyMap[`${s.id}-${p.id}`] || 0);
    }
    const row = ws.addRow(rowValues);
    const isEven = si % 2 === 0;

    row.eachCell((cell, colNumber) => {
      if (colNumber === 1) {
        cell.font = { bold: true, size: 10, color: { argb: "FF1E293B" } };
        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        cell.fill = isEven ? solidFill(PALE_BLUE) : solidFill("FFFFFF");
      } else {
        cell.font = { ...darkFont, size: 11 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = isEven ? solidFill(PALE_BLUE) : solidFill("FFFFFF");
      }
      cell.border = allBorders;
    });
  }

  // ── Totals row ──
  const totalsValues: (string | number)[] = ["TOTAL"];
  let grandTotal = 0;
  for (const p of pieces) {
    const pieceTotal = stores.reduce((sum, s) => sum + (qtyMap[`${s.id}-${p.id}`] || 0), 0);
    grandTotal += pieceTotal;
    totalsValues.push(pieceTotal);
  }
  const totalsRow = ws.addRow(totalsValues);
  totalsRow.height = 30;
  totalsRow.eachCell((cell) => {
    cell.font = { ...whiteFont, size: 12 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = gradientFill(MED_BLUE, DARK_BLUE);
    cell.border = allWhiteBorders;
  });

  // ── Column widths ──
  ws.getColumn(1).width = 30; // labels / store names
  for (let i = 2; i <= colCount; i++) {
    const piece = pieces[i - 2];
    const nameLen = piece?.name?.length || 10;
    ws.getColumn(i).width = Math.min(Math.max(nameLen + 4, 18), 30);
  }

  // ═══════════════════════════════════════════════════════
  //  ABA 2 – Dashboard
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

  // Top 5 peças
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

  // Ranking lojas
  const storeTotals = stores.map((s) => {
    const total = pieces.reduce((sum, p) => sum + (qtyMap[`${s.id}-${p.id}`] || 0), 0);
    return { name: s.name, total };
  }).sort((a, b) => b.total - a.total);

  addSectionTitle("RANKING DE LOJAS POR VOLUME", 3);
  addTableHeader(["#", "Loja", "Total de Peças"]);
  storeTotals.forEach((s, i) => {
    addTableRow([i + 1, s.name, s.total], i % 2 === 0);
  });
  currentRow++;

  // Total consolidado
  addSectionTitle("TOTAL GERAL CONSOLIDADO", 2);
  addTableHeader(["Métrica", "Valor"]);
  addTableRow(["Total de Lojas", stores.length], false);
  addTableRow(["Total de Peças Cadastradas", pieces.length], true);
  addTableRow(["Volume Total de Peças", grandTotal], false);

  dash.getColumn(1).width = 12;
  dash.getColumn(2).width = 40;
  dash.getColumn(3).width = 20;

  // ── Generate and download ──
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const fileName = `Orcamento_${campaignName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, fileName);
}
