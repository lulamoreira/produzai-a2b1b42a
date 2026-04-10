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

function gradientFill(
  from: string,
  to: string,
  degree = 0
): ExcelJS.FillGradientAngle {
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
  //  ABA 1 – Matriz Lojas × Peças
  // ═══════════════════════════════════════════════════════
  const ws = wb.addWorksheet("Matriz Lojas x Peças");

  const colCount = stores.length + 2; // col A (peça) + stores + total

  // Row 1 – Title
  const titleRow = ws.addRow([`MATRIZ DE PEÇAS POR LOJA — ${campaignName}`]);
  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell(1, 1);
  titleCell.font = { ...whiteFont, size: 16 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = gradientFill(DARK_BLUE, MED_BLUE);
  titleCell.border = allWhiteBorders;
  ws.getRow(1).height = 40;

  // Row 2 – Headers
  const headerValues: string[] = ["Peça"];
  stores.forEach((s) => headerValues.push(s.name));
  headerValues.push("TOTAL");
  const headerRow = ws.addRow(headerValues);
  headerRow.height = 30;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { ...whiteFont, size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = colNumber === 1
      ? gradientFill(DARK_BLUE, "0E4D72", 90)
      : gradientFill(MED_BLUE, LIGHT_BLUE);
    cell.border = allWhiteBorders;
  });

  // Pre-fetch images
  const imageCache: Record<string, { base64: string; ext: "png" | "jpeg" } | null> = {};
  await Promise.all(
    pieces.map(async (p) => {
      if (p.image_url) {
        imageCache[p.id] = await fetchImageAsBase64(p.image_url);
      }
    })
  );

  // Data rows
  for (let pi = 0; pi < pieces.length; pi++) {
    const p = pieces[pi];
    const rowValues: (string | number)[] = [`${p.code} - ${p.name}`];
    let pieceTotal = 0;
    stores.forEach((s) => {
      const qty = qtyMap[`${s.id}-${p.id}`] || 0;
      pieceTotal += qty;
      rowValues.push(qty);
    });
    rowValues.push(pieceTotal);

    const row = ws.addRow(rowValues);
    const rowIdx = pi + 3; // 1-based, after title+header
    row.height = 60;

    row.eachCell((cell, colNumber) => {
      if (colNumber === 1) {
        cell.font = { ...whiteFont, size: 10 };
        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        cell.fill = gradientFill(DARK_BLUE, "0E4D72", 90);
        cell.border = allWhiteBorders;
      } else if (colNumber === colCount) {
        // Total column
        cell.font = { ...whiteFont, size: 11 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = gradientFill(MED_BLUE, DARK_BLUE);
        cell.border = allWhiteBorders;
      } else {
        cell.font = { ...darkFont, size: 11 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = gradientFill("FFFFFF", PALE_BLUE);
        cell.border = allBorders;
      }
    });

    // Add image
    const imgData = imageCache[p.id];
    if (imgData) {
      const imageId = wb.addImage({ base64: imgData.base64, extension: imgData.ext });
      ws.addImage(imageId, {
        tl: { col: 0.05, row: rowIdx - 1 + 0.1 },
        ext: { width: 50, height: 50 },
      });
    }
  }

  // Totals row
  const totalsValues: (string | number)[] = ["TOTAL"];
  let grandTotal = 0;
  stores.forEach((s) => {
    const storeTotal = pieces.reduce((sum, p) => sum + (qtyMap[`${s.id}-${p.id}`] || 0), 0);
    grandTotal += storeTotal;
    totalsValues.push(storeTotal);
  });
  totalsValues.push(grandTotal);

  const totalsRow = ws.addRow(totalsValues);
  totalsRow.height = 30;
  totalsRow.eachCell((cell) => {
    cell.font = { ...whiteFont, size: 12 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = gradientFill(MED_BLUE, DARK_BLUE);
    cell.border = allWhiteBorders;
  });

  // Auto column widths
  ws.getColumn(1).width = 35;
  for (let i = 2; i <= colCount; i++) {
    const maxLen = Math.max(
      (stores[i - 2]?.name?.length || 5),
      6
    );
    ws.getColumn(i).width = Math.min(Math.max(maxLen + 2, 10), 25);
  }

  // ═══════════════════════════════════════════════════════
  //  ABA 2 – Dashboard
  // ═══════════════════════════════════════════════════════
  const dash = wb.addWorksheet("Dashboard");

  // Helper to write a section header
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

  // ── Top 5 peças mais pedidas ──
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

  // ── Ranking de lojas por volume ──
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

  // ── Total geral consolidado ──
  addSectionTitle("TOTAL GERAL CONSOLIDADO", 2);
  addTableHeader(["Métrica", "Valor"]);
  addTableRow(["Total de Lojas", stores.length], false);
  addTableRow(["Total de Peças Cadastradas", pieces.length], true);
  addTableRow(["Volume Total de Peças", grandTotal], false);

  // Auto-fit dashboard columns
  dash.getColumn(1).width = 12;
  dash.getColumn(2).width = 40;
  dash.getColumn(3).width = 20;

  // ── Generate and download ──
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const fileName = `Matriz_${campaignName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, fileName);
}
