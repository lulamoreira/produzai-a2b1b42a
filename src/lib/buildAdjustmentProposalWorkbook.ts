// Builds a 3-sheet Excel workbook for the Adjustment quote request.
// Reuses the visual style of buildNegotiatedProposalWorkbook.

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const BROWN = "FF8C6F4E";
const DARK = "FF4A2C2A";
const BEIGE = "FFF7F3EC";
const WHITE = "FFFFFFFF";
const BORDER = "FFE5E7EB";
const RED_BG = "FFFFF0F0";
const GREEN_BG = "FFE6F4EA";
const YELLOW_FILL = "FFFFFFE0";
const RED_FONT = "FFC53030";
const GREEN_FONT = "FF2F855A";

function moneyFormat(currencyCode: string) {
  if (currencyCode === "USD") return '"US$" #,##0.00;[Red]-"US$" #,##0.00;-';
  if (currencyCode === "CLP") return '"CLP$" #,##0;[Red]-"CLP$" #,##0;-';
  if (currencyCode === "EUR") return '"€" #,##0.00;[Red]-"€" #,##0.00;-';
  return '"R$" #,##0.00;[Red]-"R$" #,##0.00;-';
}

export interface AdjustmentProposalParams {
  adjustment: { id: string; name: string };
  campaignName: string;
  agencyName: string;
  clientName: string;
  currencyCode: string;
  supplier: { id: string; company_name: string; contact_name: string };
  pieces: any[]; // campaign_adjustment_pieces
  kits: any[];
  kitPieces: any[];
  stores: { id: string; name: string; nickname?: string | null; city?: string | null; state?: string | null }[];
  originalStorePieces: { store_id: string; piece_id: string; quantity: number }[];
  adjustmentStorePieces: { store_id: string; piece_id: string; quantity: number }[];
  currentPrices: { piece_id: string; unit_price: number; adjusted_unit_price: number | null }[];
  extraCosts: { installation_value: number; freight_value: number };
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

export async function buildAdjustmentProposalWorkbook(
  params: AdjustmentProposalParams,
): Promise<{ blob: Blob; fileName: string }> {
  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "ProduzAI";
  wb.created = new Date();

  const money = moneyFormat(params.currencyCode);

  // Resolve "current price" by source_piece_id (adjustment pieces reference original)
  const priceBySource = new Map<string, { unit: number; adjusted: number | null }>();
  for (const p of params.currentPrices) {
    priceBySource.set(p.piece_id, {
      unit: Number(p.unit_price || 0),
      adjusted: p.adjusted_unit_price != null ? Number(p.adjusted_unit_price) : null,
    });
  }
  const priceFor = (adjPiece: any): number => {
    const src = adjPiece.source_piece_id;
    if (!src) return 0;
    const pr = priceBySource.get(src);
    if (!pr) return 0;
    return pr.adjusted ?? pr.unit ?? 0;
  };

  // Sum maps
  const origSumBySource: Record<string, number> = {};
  for (const sp of params.originalStorePieces) {
    origSumBySource[sp.piece_id] = (origSumBySource[sp.piece_id] || 0) + Number(sp.quantity || 0);
  }
  const adjSumByPiece: Record<string, number> = {};
  for (const sp of params.adjustmentStorePieces) {
    adjSumByPiece[sp.piece_id] = (adjSumByPiece[sp.piece_id] || 0) + Number(sp.quantity || 0);
  }

  // ─────────────────────────────────────────────────────────
  // SHEET 1 — Reorçamento
  // ─────────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet("Reorçamento", { views: [{ showGridLines: false }] });

  ws1.mergeCells("A1:H1");
  const t1 = ws1.getCell("A1");
  t1.value = [params.agencyName, params.clientName].filter(Boolean).join(" | ") || "ProduzAI";
  t1.font = { name: "Arial", size: 10, color: { argb: WHITE } };
  t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
  t1.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(1).height = 20;

  ws1.mergeCells("A2:H2");
  const t2 = ws1.getCell("A2");
  t2.value = `${(params.campaignName || "").toUpperCase()} — REORÇAMENTO PÓS-MOCKUP`;
  t2.font = { name: "Arial", size: 14, bold: true, color: { argb: WHITE } };
  t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
  t2.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(2).height = 26;

  ws1.mergeCells("A3:H3");
  const t3 = ws1.getCell("A3");
  t3.value = `Fornecedor: ${params.supplier.company_name} | Ajuste: ${params.adjustment.name}`;
  t3.font = { name: "Arial", size: 11, bold: true, color: { argb: DARK } };
  t3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
  t3.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(3).height = 22;

  const headerRow1 = ws1.getRow(5);
  headerRow1.values = [
    "Código",
    "Item / Especificação",
    "Qtd Original",
    "Qtd Ajuste",
    "Δ Qtd",
    "Preço Atual",
    "Total Atual",
    "Novo Preço",
  ];
  headerRow1.height = 24;
  headerRow1.eachCell((cell) => {
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

  let totalCurrent = 0;
  let evenIdx = 0;

  // Sort: kept/modified first, then added, then removed
  const orderRank = (p: any) => (p.is_deleted ? 2 : (p.is_new ? 1 : 0));
  const piecesSorted = [...params.pieces].sort(
    (a, b) => orderRank(a) - orderRank(b) || (a.code || 0) - (b.code || 0),
  );

  for (const p of piecesSorted) {
    if (p.kit_only) continue;
    const qOrig = p.is_new ? 0 : (p.source_piece_id ? (origSumBySource[p.source_piece_id] || 0) : 0);
    const qAdj = p.is_deleted ? 0 : (adjSumByPiece[p.id] || 0);
    const dQty = qAdj - qOrig;
    const price = priceFor(p);
    const lineTotal = price * qAdj;
    totalCurrent += lineTotal;

    const codeLabel = p.is_new
      ? `${p.code} (NOVA)`
      : p.is_deleted
      ? `${p.code} (REMOVIDA)`
      : `${p.code}`;

    const desc = [p.name, p.specification, p.size].filter(Boolean).join(" — ");

    const row = ws1.addRow([
      codeLabel,
      desc,
      qOrig,
      qAdj,
      dQty,
      price,
      lineTotal,
      null, // empty for supplier
    ]);
    const bg = evenIdx % 2 === 0 ? WHITE : BEIGE;
    evenIdx++;

    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
        horizontal: col >= 3 ? "right" : col === 1 ? "center" : "left",
      };
      cell.border = {
        top: { style: "thin", color: { argb: BORDER } },
        bottom: { style: "thin", color: { argb: BORDER } },
        left: { style: "thin", color: { argb: BORDER } },
        right: { style: "thin", color: { argb: BORDER } },
      };
      if (col === 6 || col === 7) cell.numFmt = money;
    });

    if (p.is_deleted) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { strike: true, color: { argb: RED_FONT } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_BG } };
      });
    } else if (p.is_new) {
      row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG } };
      row.getCell(1).font = { bold: true, color: { argb: GREEN_FONT } };
    }

    if (dQty !== 0 && !p.is_deleted) {
      const isPositive = dQty > 0;
      const dCell = row.getCell(5);
      dCell.font = { color: { argb: WHITE }, bold: true };
      dCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isPositive ? "FF22C55E" : "FFDC2626" },
      };
      dCell.alignment = { vertical: "middle", horizontal: "center" };
    }

    // Yellow editable cell for "Novo Preço"
    const newPriceCell = row.getCell(8);
    newPriceCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW_FILL } };
    newPriceCell.numFmt = money;
    newPriceCell.border = {
      top: { style: "medium", color: { argb: BROWN } },
      bottom: { style: "medium", color: { argb: BROWN } },
      left: { style: "medium", color: { argb: BROWN } },
      right: { style: "medium", color: { argb: BROWN } },
    };
  }

  // Footer rows
  ws1.addRow([]);

  const addExtraRow = (label: string, value: number) => {
    const r = ws1.addRow(["", "", "", "", "", label, value, null]);
    r.getCell(6).alignment = { horizontal: "right", vertical: "middle" };
    r.getCell(6).font = { bold: true };
    r.getCell(7).numFmt = money;
    r.getCell(7).alignment = { horizontal: "right", vertical: "middle" };
    const newCell = r.getCell(8);
    newCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW_FILL } };
    newCell.numFmt = money;
    newCell.border = {
      top: { style: "medium", color: { argb: BROWN } },
      bottom: { style: "medium", color: { argb: BROWN } },
      left: { style: "medium", color: { argb: BROWN } },
      right: { style: "medium", color: { argb: BROWN } },
    };
    return r;
  };
  addExtraRow("Instalação:", Number(params.extraCosts.installation_value || 0));
  addExtraRow("Frete / Despacho:", Number(params.extraCosts.freight_value || 0));

  const totalAll =
    totalCurrent +
    Number(params.extraCosts.installation_value || 0) +
    Number(params.extraCosts.freight_value || 0);

  const totRow = ws1.addRow(["", "", "", "", "", "TOTAL ATUAL:", totalAll, null]);
  totRow.height = 24;
  ["F", "G"].forEach((c) => {
    const cell = totRow.getCell(c);
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
    cell.alignment = { horizontal: "right", vertical: "middle" };
  });
  totRow.getCell(7).numFmt = money;

  const totReoRow = ws1.addRow(["", "", "", "", "", "TOTAL REORÇAMENTO:", null, null]);
  totReoRow.height = 24;
  totReoRow.getCell(6).font = { bold: true, color: { argb: WHITE } };
  totReoRow.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
  totReoRow.getCell(6).alignment = { horizontal: "right", vertical: "middle" };
  const tReoCell = totReoRow.getCell(7);
  tReoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW_FILL } };
  tReoCell.numFmt = money;
  tReoCell.border = {
    top: { style: "medium", color: { argb: BROWN } },
    bottom: { style: "medium", color: { argb: BROWN } },
    left: { style: "medium", color: { argb: BROWN } },
    right: { style: "medium", color: { argb: BROWN } },
  };

  ws1.addRow([]);
  const noteRow = ws1.addRow([
    "* Preencha os campos destacados em amarelo com os novos valores propostos e retorne este arquivo.",
  ]);
  ws1.mergeCells(`A${noteRow.number}:H${noteRow.number}`);
  const nc = noteRow.getCell(1);
  nc.font = { italic: true, color: { argb: DARK }, size: 10 };
  nc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
  nc.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  noteRow.height = 26;

  ws1.columns = [
    { width: 14 },
    { width: 50 },
    { width: 12 },
    { width: 12 },
    { width: 10 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
  ];
  ws1.views = [{ state: "frozen", ySplit: 5 }];

  // ─────────────────────────────────────────────────────────
  // SHEET 2 — Rateio do Ajuste (matrix Stores × Pieces)
  // ─────────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Rateio do Ajuste", { views: [{ showGridLines: false }] });

  const visiblePieces = piecesSorted.filter((p) => !p.kit_only);
  const adjQtyMap: Record<string, number> = {};
  for (const sp of params.adjustmentStorePieces) {
    adjQtyMap[`${sp.store_id}-${sp.piece_id}`] = Number(sp.quantity || 0);
  }

  // Header
  const h2Row = ws2.getRow(1);
  h2Row.values = ["Loja", "Cidade/UF", ...visiblePieces.map((p) => `${p.code} - ${p.name}`)];
  h2Row.height = 28;
  h2Row.eachCell((cell, col) => {
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: BORDER } },
      bottom: { style: "thin", color: { argb: BORDER } },
      left: { style: "thin", color: { argb: BORDER } },
      right: { style: "thin", color: { argb: BORDER } },
    };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
    if (col >= 3) {
      const piece = visiblePieces[col - 3];
      if (piece?.is_new) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF22C55E" } };
      } else if (piece?.is_deleted) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDC2626" } };
        cell.font = { bold: true, color: { argb: WHITE }, strike: true };
      }
    }
  });

  let evenStoreIdx = 0;
  for (const store of params.stores) {
    const cityState = [store.city, store.state].filter(Boolean).join(" / ");
    const row = ws2.addRow([
      store.nickname || store.name,
      cityState,
      ...visiblePieces.map((p) => adjQtyMap[`${store.id}-${p.id}`] || 0),
    ]);
    const bg = evenStoreIdx % 2 === 0 ? WHITE : BEIGE;
    evenStoreIdx++;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = {
        vertical: "middle",
        horizontal: col <= 2 ? "left" : "center",
        wrapText: col <= 2,
      };
      cell.border = {
        top: { style: "thin", color: { argb: BORDER } },
        bottom: { style: "thin", color: { argb: BORDER } },
        left: { style: "thin", color: { argb: BORDER } },
        right: { style: "thin", color: { argb: BORDER } },
      };
      if (col >= 3 && Number(cell.value || 0) === 0) {
        cell.font = { color: { argb: "FFBBBBBB" } };
      }
    });
  }

  ws2.columns = [
    { width: 30 },
    { width: 24 },
    ...visiblePieces.map(() => ({ width: 12 })),
  ];
  ws2.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];

  // ─────────────────────────────────────────────────────────
  // SHEET 3 — Comparativo
  // ─────────────────────────────────────────────────────────
  const ws3 = wb.addWorksheet("Comparativo", { views: [{ showGridLines: false }] });

  // Compute totals (qty × current prices for both)
  let totQtyOrig = 0, totQtyAdj = 0;
  let totValOrig = 0, totValAdj = 0;
  const detail: Array<{ label: string; qOrig: number; qAdj: number; price: number; tOrig: number; tAdj: number; }> = [];
  for (const p of visiblePieces) {
    const qOrig = p.is_new ? 0 : (p.source_piece_id ? (origSumBySource[p.source_piece_id] || 0) : 0);
    const qAdj = p.is_deleted ? 0 : (adjSumByPiece[p.id] || 0);
    const price = priceFor(p);
    const tOrig = price * qOrig;
    const tAdj = price * qAdj;
    totQtyOrig += qOrig; totQtyAdj += qAdj;
    totValOrig += tOrig; totValAdj += tAdj;
    detail.push({ label: `${p.code} - ${p.name}`, qOrig, qAdj, price, tOrig, tAdj });
  }

  const summary = [
    ["", "Original", "Ajuste", "Δ"],
    ["Unidades Totais", totQtyOrig, totQtyAdj, totQtyAdj - totQtyOrig],
    ["Valor Total (mesmos preços)", totValOrig, totValAdj, totValAdj - totValOrig],
  ];
  summary.forEach((rowVals, i) => {
    const r = ws3.addRow(rowVals);
    r.height = 22;
    if (i === 0) {
      r.eachCell((c) => {
        c.font = { bold: true, color: { argb: WHITE } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
        c.alignment = { horizontal: "center", vertical: "middle" };
      });
    } else {
      r.getCell(1).font = { bold: true };
      [2, 3, 4].forEach((col) => {
        r.getCell(col).alignment = { horizontal: "right" };
        if (i === 2) r.getCell(col).numFmt = money;
      });
    }
  });
  ws3.addRow([]);

  const headers3 = ["Peça", "Preço Atual", "Qtd Original", "Qtd Ajuste", "Δ Qtd", "Total Original", "Total Ajuste", "Δ Total"];
  const h3 = ws3.addRow(headers3);
  h3.height = 26;
  h3.eachCell((c) => {
    c.font = { bold: true, color: { argb: WHITE } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = {
      top: { style: "thin", color: { argb: BORDER } },
      bottom: { style: "thin", color: { argb: BORDER } },
      left: { style: "thin", color: { argb: BORDER } },
      right: { style: "thin", color: { argb: BORDER } },
    };
  });

  for (const d of detail) {
    const dQty = d.qAdj - d.qOrig;
    const dTot = d.tAdj - d.tOrig;
    const r = ws3.addRow([d.label, d.price, d.qOrig, d.qAdj, dQty, d.tOrig, d.tAdj, dTot]);
    r.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.alignment = { vertical: "middle", horizontal: col === 1 ? "left" : "right" };
      cell.border = {
        top: { style: "thin", color: { argb: BORDER } },
        bottom: { style: "thin", color: { argb: BORDER } },
        left: { style: "thin", color: { argb: BORDER } },
        right: { style: "thin", color: { argb: BORDER } },
      };
      if ([2, 6, 7, 8].includes(col)) cell.numFmt = money;
    });
    if (dQty !== 0) {
      const dc = r.getCell(5);
      dc.font = { color: { argb: WHITE }, bold: true };
      dc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: dQty > 0 ? "FF22C55E" : "FFDC2626" } };
      dc.alignment = { vertical: "middle", horizontal: "center" };
    }
    if (dTot !== 0) r.getCell(8).font = { bold: true, color: { argb: dTot > 0 ? GREEN_FONT : RED_FONT } };
  }

  ws3.columns = [
    { width: 38 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 16 }, { width: 16 }, { width: 14 },
  ];

  // Build blob
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });

  const sanitize = (s?: string) =>
    (s || "").trim().replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, "").replace(/\s+/g, "_").slice(0, 40);
  const today = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
  const fileName = `Reorcamento_${sanitize(params.campaignName)}_${sanitize(params.adjustment.name)}_${sanitize(params.supplier.company_name)}_${today}.xlsx`;

  return { blob, fileName };
}
