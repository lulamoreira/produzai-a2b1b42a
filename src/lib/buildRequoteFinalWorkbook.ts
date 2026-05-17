// Builds the FINAL post-approval requote workbook (4 sheets):
//   1. Resumo            — items with previous/new/variation + grand total
//   2. Rateio por Loja   — store × piece quantity matrix with new unit prices
//   3. Kit {name}        — one sheet per kit, with piece-level price comparison
//   4. Comparativo       — previous vs new side-by-side
//
// Returns a Blob (browser-friendly). Color coded: red=increase, green=decrease,
// yellow=changed cell.
import type ExcelJS from "exceljs";

export interface RequoteFinalPiece {
  id: string;
  code: string;
  name: string;
  specification?: string | null;
  kitId?: string | null;
  previousPrice: number;
  newPrice: number;
  totalQty: number;
}

export interface RequoteFinalKitPiece {
  id: string;
  code: string;
  name: string;
  previousPrice: number;
  newPrice: number;
  quantityInKit: number;
}

export interface RequoteFinalKit {
  id: string;
  name: string;
  previousPrice: number;
  newPrice: number;
  totalQty: number;
  pieces: RequoteFinalKitPiece[];
}

export interface RequoteFinalStore {
  id: string;
  name: string;
  code?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface RequoteFinalStoreQty {
  storeId: string;
  pieceId: string;
  quantity: number;
}

export interface RequoteFinalWorkbookParams {
  campaignName: string;
  adjustmentName: string;
  supplierName: string;
  pieces: RequoteFinalPiece[];        // includes both standalone and kit member pieces
  kits: RequoteFinalKit[];
  stores: RequoteFinalStore[];
  storeQuantities: RequoteFinalStoreQty[];
  installation: number;
  freight: number;
  previousInstallation: number;
  previousFreight: number;
  generatedAt: Date;
}

// ARGB colors (ExcelJS expects ARGB, not RGB)
const BRAND = "FF4F46E5";
const HEADER_BG = "FF1E1B4B";
const HEADER_FG = "FFFFFFFF";
const INCREASE = "FFDC2626";
const DECREASE = "FF16A34A";
const NEUTRAL = "FF6B7280";
const HIGHLIGHT = "FFFEF9C3";

function variationPct(prev: number, next: number): number | null {
  if (!prev) return null;
  return ((next - prev) / prev) * 100;
}

function fmtPct(p: number | null): string {
  if (p === null) return "—";
  const sign = p >= 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}%`;
}

function applyHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    cell.font = { bold: true, color: { argb: HEADER_FG }, size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  row.height = 30;
}

function priceColor(prev: number, next: number): string {
  if (next > prev) return INCREASE;
  if (next < prev) return DECREASE;
  return NEUTRAL;
}

export async function buildRequoteFinalWorkbook(
  params: RequoteFinalWorkbookParams,
): Promise<{ blob: Blob; fileName: string }> {
  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "ProduzAI";
  wb.created = params.generatedAt;

  const standalonePieces = params.pieces.filter((p) => !p.kitId);
  const currencyFmt = '"R$" #,##0.00';

  // ────────────────────────────────────────────────────────────────────
  // SHEET 1 — Resumo
  // ────────────────────────────────────────────────────────────────────
  const summary = wb.addWorksheet("Resumo", { pageSetup: { paperSize: 9, orientation: "portrait" } });
  summary.columns = [{ width: 42 }, { width: 18 }, { width: 18 }, { width: 14 }];

  summary.mergeCells("A1:D1");
  const sTitle = summary.getCell("A1");
  sTitle.value = `Recotação Final — ${params.adjustmentName}`;
  sTitle.font = { bold: true, size: 14, color: { argb: BRAND } };
  sTitle.alignment = { horizontal: "center" };
  summary.getRow(1).height = 32;

  summary.getRow(3).values = ["Campanha", params.campaignName];
  summary.getRow(4).values = ["Fornecedor", params.supplierName];
  summary.getRow(5).values = ["Gerado em", params.generatedAt.toLocaleString("pt-BR")];

  const sHeader = summary.getRow(7);
  sHeader.values = ["Item", "Valor anterior", "Novo valor", "Variação"];
  applyHeader(sHeader);

  let r = 8;
  const writeRow = (label: string, prev: number, next: number) => {
    const row = summary.getRow(r++);
    const pct = variationPct(prev, next);
    row.values = [label, prev, next, fmtPct(pct)];
    row.getCell(2).numFmt = currencyFmt;
    row.getCell(3).numFmt = currencyFmt;
    row.getCell(3).font = { color: { argb: priceColor(prev, next) } };
    if (next !== prev) {
      row.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HIGHLIGHT } };
    }
    row.getCell(4).font = { color: { argb: priceColor(prev, next) } };
  };

  for (const p of standalonePieces) {
    writeRow(`${p.code} — ${p.name}`, p.previousPrice * p.totalQty, p.newPrice * p.totalQty);
  }
  for (const k of params.kits) {
    writeRow(`${k.name} (Kit)`, k.previousPrice * k.totalQty, k.newPrice * k.totalQty);
  }

  summary.getRow(r++).values = [];
  writeRow("Instalação", params.previousInstallation, params.installation);
  writeRow("Frete", params.previousFreight, params.freight);

  const prevGrand =
    standalonePieces.reduce((s, p) => s + p.previousPrice * p.totalQty, 0) +
    params.kits.reduce((s, k) => s + k.previousPrice * k.totalQty, 0) +
    params.previousInstallation +
    params.previousFreight;
  const newGrand =
    standalonePieces.reduce((s, p) => s + p.newPrice * p.totalQty, 0) +
    params.kits.reduce((s, k) => s + k.newPrice * k.totalQty, 0) +
    params.installation +
    params.freight;

  summary.getRow(r++).values = [];
  const totalRow = summary.getRow(r++);
  const grandPct = variationPct(prevGrand, newGrand);
  totalRow.values = ["TOTAL GERAL", prevGrand, newGrand, fmtPct(grandPct)];
  totalRow.getCell(2).numFmt = currencyFmt;
  totalRow.getCell(3).numFmt = currencyFmt;
  applyHeader(totalRow);
  totalRow.getCell(3).font = {
    bold: true,
    color: { argb: newGrand > prevGrand ? INCREASE : newGrand < prevGrand ? DECREASE : HEADER_FG },
  };

  // ────────────────────────────────────────────────────────────────────
  // SHEET 2 — Rateio por Loja
  // ────────────────────────────────────────────────────────────────────
  const rateio = wb.addWorksheet("Rateio por Loja", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 2 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
  });

  // Only pieces are stored per-store in the schema; kits aren't in store_pieces.
  const items = [...standalonePieces].sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));

  rateio.columns = [
    { width: 30 },
    { width: 18 },
    ...items.map(() => ({ width: 12 })),
    { width: 12 },
    { width: 16 },
  ];

  const codeRow = rateio.getRow(1);
  codeRow.getCell(1).value = "Loja";
  codeRow.getCell(2).value = "Cidade/UF";
  items.forEach((it, i) => (codeRow.getCell(i + 3).value = it.code));
  codeRow.getCell(items.length + 3).value = "Total peças";
  codeRow.getCell(items.length + 4).value = "Total R$";
  applyHeader(codeRow);

  const nameRow = rateio.getRow(2);
  nameRow.getCell(1).value = "";
  nameRow.getCell(2).value = "";
  items.forEach((it, i) => (nameRow.getCell(i + 3).value = it.name));
  applyHeader(nameRow);

  let storeRow = 3;
  for (const store of params.stores) {
    const row = rateio.getRow(storeRow++);
    row.getCell(1).value = store.name;
    row.getCell(2).value = [store.city, store.state].filter(Boolean).join("/");
    let totalQty = 0;
    let totalBRL = 0;
    items.forEach((it, i) => {
      const qty =
        params.storeQuantities.find((sq) => sq.storeId === store.id && sq.pieceId === it.id)?.quantity ?? 0;
      row.getCell(i + 3).value = qty || null;
      totalQty += qty;
      totalBRL += qty * it.newPrice;
    });
    row.getCell(items.length + 3).value = totalQty || null;
    row.getCell(items.length + 4).value = totalBRL || null;
    row.getCell(items.length + 4).numFmt = currencyFmt;
  }

  // Totals row
  const tot = rateio.getRow(storeRow);
  tot.getCell(1).value = "TOTAL";
  let grandQty = 0;
  let grandBRL = 0;
  items.forEach((it, i) => {
    const q = params.storeQuantities
      .filter((sq) => sq.pieceId === it.id)
      .reduce((s, sq) => s + sq.quantity, 0);
    tot.getCell(i + 3).value = q;
    grandQty += q;
    grandBRL += q * it.newPrice;
  });
  tot.getCell(items.length + 3).value = grandQty;
  tot.getCell(items.length + 4).value = grandBRL;
  tot.getCell(items.length + 4).numFmt = currencyFmt;
  applyHeader(tot);

  // ────────────────────────────────────────────────────────────────────
  // SHEET 3 — One sheet per Kit
  // ────────────────────────────────────────────────────────────────────
  const usedSheetNames = new Set<string>(wb.worksheets.map((w) => w.name.toLowerCase()));
  for (const kit of params.kits) {
    const base = `Kit ${kit.name}`.replace(/[\\/?*[\]:]/g, "-");
    let safeName = base.slice(0, 31);
    let suffix = 2;
    while (usedSheetNames.has(safeName.toLowerCase())) {
      const tag = ` (${suffix++})`;
      safeName = `${base.slice(0, 31 - tag.length)}${tag}`;
    }
    usedSheetNames.add(safeName.toLowerCase());
    const ks = wb.addWorksheet(safeName, { pageSetup: { paperSize: 9, orientation: "landscape" } });
    ks.columns = [{ width: 12 }, { width: 32 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 14 }];

    ks.mergeCells("A1:F1");
    const t = ks.getCell("A1");
    t.value = `Kit: ${kit.name}`;
    t.font = { bold: true, size: 12, color: { argb: BRAND } };
    ks.getRow(1).height = 26;

    ks.getRow(2).values = [
      "",
      "Preço anterior do kit:",
      "",
      kit.previousPrice,
      kit.newPrice,
      fmtPct(variationPct(kit.previousPrice, kit.newPrice)),
    ];
    ks.getRow(2).getCell(4).numFmt = currencyFmt;
    ks.getRow(2).getCell(5).numFmt = currencyFmt;
    ks.getRow(2).font = { italic: true };

    const h = ks.getRow(4);
    h.values = ["Código", "Peça", "Qtd no kit", "Preço anterior", "Novo preço", "Variação"];
    applyHeader(h);

    let kr = 5;
    for (const piece of kit.pieces) {
      const row = ks.getRow(kr++);
      const pct = variationPct(piece.previousPrice, piece.newPrice);
      row.values = [
        piece.code,
        piece.name,
        piece.quantityInKit,
        piece.previousPrice,
        piece.newPrice,
        fmtPct(pct),
      ];
      row.getCell(4).numFmt = currencyFmt;
      row.getCell(5).numFmt = currencyFmt;
      if (piece.newPrice !== piece.previousPrice) {
        row.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HIGHLIGHT } };
      }
      row.getCell(5).font = { color: { argb: priceColor(piece.previousPrice, piece.newPrice) } };
      row.getCell(6).font = { color: { argb: priceColor(piece.previousPrice, piece.newPrice) } };
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // SHEET 4 — Comparativo
  // ────────────────────────────────────────────────────────────────────
  const comp = wb.addWorksheet("Comparativo", { pageSetup: { paperSize: 9, orientation: "portrait" } });
  comp.columns = [{ width: 12 }, { width: 32 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 12 }];

  const ch = comp.getRow(1);
  ch.values = ["Código", "Peça / Kit", "Qtd total", "Preço anterior", "Novo preço", "Variação"];
  applyHeader(ch);

  let cr = 2;
  const writeCompRow = (
    code: string,
    label: string,
    qty: number | string,
    prev: number,
    next: number,
  ) => {
    const row = comp.getRow(cr++);
    const pct = variationPct(prev, next);
    row.values = [code, label, qty, prev, next, fmtPct(pct)];
    row.getCell(4).numFmt = currencyFmt;
    row.getCell(5).numFmt = currencyFmt;
    if (next !== prev) {
      row.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HIGHLIGHT } };
    }
    row.getCell(5).font = { color: { argb: priceColor(prev, next) } };
    row.getCell(6).font = { color: { argb: priceColor(prev, next) } };
  };

  for (const p of standalonePieces) {
    writeCompRow(p.code, p.name, p.totalQty, p.previousPrice, p.newPrice);
  }
  for (const k of params.kits) {
    writeCompRow("—", `${k.name} (Kit)`, k.totalQty, k.previousPrice, k.newPrice);
  }
  comp.getRow(cr++).values = [];
  writeCompRow("—", "Instalação", "—", params.previousInstallation, params.installation);
  writeCompRow("—", "Frete", "—", params.previousFreight, params.freight);
  comp.getRow(cr++).values = [];
  const finalRow = comp.getRow(cr++);
  finalRow.values = ["", "TOTAL GERAL", "", prevGrand, newGrand, fmtPct(grandPct)];
  finalRow.getCell(4).numFmt = currencyFmt;
  finalRow.getCell(5).numFmt = currencyFmt;
  applyHeader(finalRow);
  finalRow.getCell(5).font = {
    bold: true,
    color: { argb: newGrand > prevGrand ? INCREASE : newGrand < prevGrand ? DECREASE : HEADER_FG },
  };

  // ────────────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const dateStr = params.generatedAt.toLocaleDateString("pt-BR").replace(/\//g, "-");
  const safe = params.adjustmentName.replace(/[^a-zA-Z0-9_\- ]/g, "").trim() || "ajuste";
  const fileName = `Recotacao_Final_${safe}_${dateStr}.xlsx`;
  return { blob, fileName };
}
