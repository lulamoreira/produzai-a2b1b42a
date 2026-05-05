import type {
  CampaignPiece,
  CampaignKit,
  CampaignKitPiece,
  ClientStore,
} from "@/hooks/useMultiClientData";
import { computeSupplierTotal } from "@/lib/computeSupplierTotal";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const BROWN = "FF8C6F4E";
const DARK = "FF4A2C2A";
const BEIGE = "FFF7F3EC";
const WHITE = "FFFFFFFF";
const BORDER = "FFE5E7EB";
const RED_BG = "FFFFF0F0";
const GOLD = "FFC5A55A";
const RED_FONT = "FFC53030";
const GREEN_FONT = "FF2F855A";

function moneyFormat(currencyCode: string) {
  if (currencyCode === "USD") return '"US$" #,##0.00;[Red]-"US$" #,##0.00;-';
  if (currencyCode === "CLP") return '"CLP$" #,##0;[Red]-"CLP$" #,##0;-';
  if (currencyCode === "EUR") return '"€" #,##0.00;[Red]-"€" #,##0.00;-';
  return '"R$" #,##0.00;[Red]-"R$" #,##0.00;-';
}

export type NegotiatedProposalParams = {
  supplier: { id: string; company_name: string; contact_name: string };
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: CampaignKitPiece[];
  stores: ClientStore[];
  originalStorePieces: { store_id: string; piece_id: string; quantity: number }[];
  negotiationStorePieces: { store_id: string; piece_id: string; quantity: number }[];
  prices: { piece_id: string; unit_price: number; adjusted_unit_price: number | null }[];
  extraCosts: {
    installation_value: number;
    freight_value: number;
    adjusted_installation_value: number | null;
    adjusted_freight_value: number | null;
  };
  campaignName: string;
  agencyName: string;
  clientName: string;
  currencyCode: string;
  /** Override autoritativo do total ORIGINAL (já inclui frete + instalação + kits). */
  originalTotalOverride?: number | null;
  /** Override autoritativo do total NEGOCIADO (já inclui frete + instalação + kits). */
  negotiatedTotalOverride?: number | null;
};

export type NegotiatedProposalTotals = {
  itemsOriginal: number;
  itemsNegotiated: number;
  installationOriginal: number;
  installationNegotiated: number;
  freightOriginal: number;
  freightNegotiated: number;
  totalOriginal: number;
  totalNegotiated: number;
  savings: number;
};

function sumQty(
  rows: { piece_id: string; quantity: number }[],
  pieceId: string,
): number {
  return rows.reduce((s, r) => s + (r.piece_id === pieceId ? Number(r.quantity || 0) : 0), 0);
}

export function computeNegotiatedTotals(
  params: NegotiatedProposalParams,
): NegotiatedProposalTotals {
  // Aggregate per-piece quantities across all stores
  const negQtyMap: Record<string, number> = {};
  for (const sp of params.negotiationStorePieces) {
    negQtyMap[sp.piece_id] = (negQtyMap[sp.piece_id] || 0) + Number(sp.quantity || 0);
  }
  const origQtyMap: Record<string, number> = {};
  for (const sp of params.originalStorePieces) {
    origQtyMap[sp.piece_id] = (origQtyMap[sp.piece_id] || 0) + Number(sp.quantity || 0);
  }

  // Build kitPieceTotals — same shape as BudgetTab's memo — for each qty source.
  const buildKitPieceTotals = (qtyMap: Record<string, number>) => {
    const out: Record<string, Array<{ kitId: string; pieceId: string; qty: number }>> = {};
    for (const kit of params.kits) {
      const components = params.kitPieces.filter((kp) => kp.kit_id === kit.id);
      if (components.length === 0) continue;
      const kitQty = Math.min(
        ...components.map((kp) => Math.floor((qtyMap[kp.piece_id] || 0) / (kp.quantity || 1))),
      );
      out[kit.id] = components.map((kp) => ({
        kitId: kit.id,
        pieceId: kp.piece_id,
        qty: kitQty * (kp.quantity || 1),
      }));
    }
    return out;
  };
  const kitPieceTotalsOrig = buildKitPieceTotals(origQtyMap);
  const kitPieceTotalsNeg = buildKitPieceTotals(negQtyMap);

  const installationOriginal = Number(params.extraCosts.installation_value || 0);
  const installationNegotiated = Number(
    params.extraCosts.adjusted_installation_value ?? params.extraCosts.installation_value ?? 0,
  );
  const freightOriginal = Number(params.extraCosts.freight_value || 0);
  const freightNegotiated = Number(
    params.extraCosts.adjusted_freight_value ?? params.extraCosts.freight_value ?? 0,
  );

  const totalOriginal = computeSupplierTotal({
    supplierId: params.supplier.id,
    pieces: params.pieces,
    kitPieceTotals: kitPieceTotalsOrig,
    qtyResolver: (pieceId) => origQtyMap[pieceId] || 0,
    priceResolver: (_sid, pieceId) => {
      const pr = params.prices.find((p) => p.piece_id === pieceId);
      return Number(pr?.unit_price ?? 0);
    },
    extraCostResolver: () => ({ installation: installationOriginal, freight: freightOriginal }),
  });

  const totalNegotiated = computeSupplierTotal({
    supplierId: params.supplier.id,
    pieces: params.pieces,
    kitPieceTotals: kitPieceTotalsNeg,
    qtyResolver: (pieceId) => negQtyMap[pieceId] || 0,
    priceResolver: (_sid, pieceId) => {
      const pr = params.prices.find((p) => p.piece_id === pieceId);
      return Number(pr?.adjusted_unit_price ?? pr?.unit_price ?? 0);
    },
    extraCostResolver: () => ({ installation: installationNegotiated, freight: freightNegotiated }),
  });

  const itemsOriginal = totalOriginal - installationOriginal - freightOriginal;
  const itemsNegotiated = totalNegotiated - installationNegotiated - freightNegotiated;

  return {
    itemsOriginal,
    itemsNegotiated,
    installationOriginal,
    installationNegotiated,
    freightOriginal,
    freightNegotiated,
    totalOriginal,
    totalNegotiated,
    savings: totalOriginal - totalNegotiated,
  };
}

export async function buildNegotiatedProposalWorkbook(
  params: NegotiatedProposalParams,
): Promise<{ blob: Blob; fileName: string; totals: NegotiatedProposalTotals }> {
  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "ProduzAI";
  wb.created = new Date();

  const money = moneyFormat(params.currencyCode);
  const totals = computeNegotiatedTotals(params);

  const priceMap = new Map(params.prices.map((p) => [p.piece_id, p]));

  // ─────────────────────────────────────────────────────────
  // SHEET 1: Orçamento Negociado
  // ─────────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet("Orçamento Negociado", { views: [{ showGridLines: false }] });

  ws1.mergeCells("A1:F1");
  const t1 = ws1.getCell("A1");
  t1.value = [params.agencyName, params.clientName].filter(Boolean).join(" | ") || "ProduzAI";
  t1.font = { name: "Arial", size: 10, color: { argb: WHITE } };
  t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
  t1.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(1).height = 20;

  ws1.mergeCells("A2:F2");
  const t2 = ws1.getCell("A2");
  t2.value = `${(params.campaignName || "").toUpperCase()} — PROPOSTA NEGOCIADA`;
  t2.font = { name: "Arial", size: 14, bold: true, color: { argb: WHITE } };
  t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
  t2.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(2).height = 26;

  ws1.mergeCells("A3:F3");
  const t3 = ws1.getCell("A3");
  t3.value = `Fornecedor: ${params.supplier.company_name}`;
  t3.font = { name: "Arial", size: 11, bold: true, color: { argb: DARK } };
  t3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
  t3.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(3).height = 22;

  const headerRow1 = ws1.getRow(5);
  headerRow1.values = [
    "Código",
    "Item / Especificação",
    "Qtd Original",
    "Qtd Negociada",
    "Preço Negociado",
    "Total da Peça",
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

  let evenIdx = 0;
  for (const piece of params.pieces) {
    const pr = priceMap.get(piece.id);
    if (!pr) continue;
    const qOrig = sumQty(params.originalStorePieces, piece.id);
    const qNeg = sumQty(params.negotiationStorePieces, piece.id);
    const adj = pr.adjusted_unit_price ?? pr.unit_price;
    const lineTotal = Number(adj || 0) * qNeg;
    const qtyChanged = qOrig !== qNeg;
    const priceChanged = pr.adjusted_unit_price != null && Number(pr.adjusted_unit_price) !== Number(pr.unit_price);

    const row = ws1.addRow([
      piece.code,
      [piece.name, (piece as any).specification, piece.size].filter(Boolean).join(" — "),
      qOrig,
      qNeg,
      adj,
      lineTotal,
    ]);
    const bg = evenIdx % 2 === 0 ? WHITE : BEIGE;
    evenIdx++;
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
        horizontal: col >= 3 ? "right" : col === 1 ? "center" : "left",
      };
      cell.font = { bold: qtyChanged || priceChanged };
      cell.border = {
        top: { style: "thin", color: { argb: BORDER } },
        bottom: { style: "thin", color: { argb: BORDER } },
        left: { style: "thin", color: { argb: BORDER } },
        right: { style: "thin", color: { argb: BORDER } },
      };
      if (col === 5 || col === 6) cell.numFmt = money;
    });
  }

  // Totals
  ws1.addRow([]);
  const addTotal1 = (label: string, value: number, emphasized = false) => {
    const r = ws1.addRow(["", "", "", "", label, value]);
    r.getCell(5).alignment = { horizontal: "right", vertical: "middle" };
    r.getCell(6).alignment = { horizontal: "right", vertical: "middle" };
    r.getCell(6).numFmt = money;
    if (emphasized) {
      r.getCell(5).font = { bold: true, color: { argb: WHITE } };
      r.getCell(6).font = { bold: true, color: { argb: WHITE } };
      r.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
      r.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
    } else {
      r.getCell(5).font = { bold: true };
    }
  };
  addTotal1("Total dos Itens", totals.itemsNegotiated);
  addTotal1("Instalação", totals.installationNegotiated);
  addTotal1("Frete / Despacho", totals.freightNegotiated);
  addTotal1("TOTAL GERAL NEGOCIADO", totals.totalNegotiated, true);

  ws1.columns = [
    { width: 10 },
    { width: 50 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
  ];
  ws1.views = [{ state: "frozen", ySplit: 5 }];

  // ─────────────────────────────────────────────────────────
  // SHEET 2: Rateio por Loja (negotiation quantities)
  // ─────────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Rateio por Loja");
  const negQtyMap: Record<string, number> = {};
  params.negotiationStorePieces.forEach((sp) => {
    negQtyMap[`${sp.store_id}-${sp.piece_id}`] = Number(sp.quantity || 0);
  });
  const visiblePieces = params.pieces;

  const header2: any[] = ["Loja", "Apelido", "Cidade", "Estado"];
  visiblePieces.forEach((p) => {
    header2.push(`${p.code} - ${p.name}${(p as any).is_mockup ? " (MOCKUP)" : ""}`);
  });
  const maxPieceCode = visiblePieces.length > 0 ? Math.max(...visiblePieces.map((p) => p.code)) : 0;
  params.kits.forEach((kit, idx) => {
    header2.push(`${maxPieceCode + idx + 1} - ${kit.name}`);
  });
  header2.push("Total");
  const h2 = ws2.addRow(header2);
  h2.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  h2.height = 28;

  params.stores.forEach((store) => {
    const r: any[] = [store.name, store.nickname || "", store.city || "", store.state || ""];
    let total = 0;
    visiblePieces.forEach((p) => {
      const q = negQtyMap[`${store.id}-${p.id}`] || 0;
      r.push(q);
      total += q;
    });
    params.kits.forEach((kit) => {
      const kpForKit = params.kitPieces.filter((kp) => kp.kit_id === kit.id);
      const kitQty =
        kpForKit.length > 0
          ? Math.min(
              ...kpForKit.map((kp) => {
                const sq = negQtyMap[`${store.id}-${kp.piece_id}`] || 0;
                return Math.floor(sq / (kp.quantity || 1));
              }),
            )
          : 0;
      r.push(kitQty);
    });
    r.push(total);
    ws2.addRow(r);
  });
  ws2.columns = header2.map((_, i) => ({ width: i === 0 ? 28 : 14 }));
  ws2.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];

  // ─────────────────────────────────────────────────────────
  // SHEET 3: Comparativo
  // ─────────────────────────────────────────────────────────
  const ws3 = wb.addWorksheet("Comparativo", { views: [{ showGridLines: false }] });

  // Top summary block
  const summary = [
    ["", "Original", "Negociado", "Δ / Economia"],
    ["Instalação", totals.installationOriginal, totals.installationNegotiated, totals.installationOriginal - totals.installationNegotiated],
    ["Frete", totals.freightOriginal, totals.freightNegotiated, totals.freightOriginal - totals.freightNegotiated],
    ["Total Geral", totals.totalOriginal, totals.totalNegotiated, totals.savings],
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
        r.getCell(col).numFmt = money;
        r.getCell(col).alignment = { horizontal: "right" };
      });
      if (i === 3) {
        r.eachCell((c) => {
          c.font = { bold: true };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
        });
        r.getCell(4).font = { bold: true, color: { argb: GREEN_FONT } };
      }
    }
  });
  ws3.addRow([]);

  // Detailed table
  const headers3 = [
    "Peça",
    "Preço Original",
    "Preço Negociado",
    "Δ Preço",
    "Qtd Original",
    "Qtd Negociada",
    "Δ Qtd",
    "Total Original",
    "Total Negociado",
    "Δ Total",
  ];
  const h3 = ws3.addRow(headers3);
  h3.height = 26;
  h3.eachCell((c) => {
    c.font = { bold: true, color: { argb: WHITE } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = { top: { style: "thin", color: { argb: BORDER } }, bottom: { style: "thin", color: { argb: BORDER } }, left: { style: "thin", color: { argb: BORDER } }, right: { style: "thin", color: { argb: BORDER } } };
  });

  let totH = 0;
  let totI = 0;
  let totJ = 0;

  for (const piece of params.pieces) {
    const pr = priceMap.get(piece.id);
    if (!pr) continue;
    const original = Number(pr.unit_price || 0);
    const negotiated = Number(pr.adjusted_unit_price ?? pr.unit_price ?? 0);
    const dPrice = negotiated - original;
    const qOrig = sumQty(params.originalStorePieces, piece.id);
    const qNeg = sumQty(params.negotiationStorePieces, piece.id);
    const dQty = qNeg - qOrig;
    const tOrig = original * qOrig;
    const tNeg = negotiated * qNeg;
    const dTotal = tNeg - tOrig;
    totH += tOrig;
    totI += tNeg;
    totJ += dTotal;

    const changed = dPrice !== 0 || dQty !== 0;
    const r = ws3.addRow([
      `${piece.code} - ${piece.name}`,
      original,
      negotiated,
      dPrice,
      qOrig,
      qNeg,
      dQty,
      tOrig,
      tNeg,
      dTotal,
    ]);
    r.height = 20;
    r.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.alignment = { vertical: "middle", horizontal: col === 1 ? "left" : "right", wrapText: col === 1 };
      cell.border = {
        top: { style: "thin", color: { argb: BORDER } },
        bottom: { style: "thin", color: { argb: BORDER } },
        left: { style: "thin", color: { argb: BORDER } },
        right: { style: "thin", color: { argb: BORDER } },
      };
      if ([2, 3, 4, 8, 9, 10].includes(col)) cell.numFmt = money;
      if (changed && [3, 4, 6, 7, 9, 10].includes(col)) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_BG } };
      }
    });
    // Color-coded fonts
    if (dPrice !== 0) r.getCell(3).font = { color: { argb: RED_FONT }, bold: true };
    if (dPrice !== 0) r.getCell(4).font = { color: { argb: RED_FONT }, bold: true };
    if (dQty !== 0) r.getCell(7).font = { color: { argb: dQty > 0 ? GREEN_FONT : RED_FONT }, bold: true };
    if (dTotal < 0) r.getCell(9).font = { color: { argb: RED_FONT }, bold: true };
    if (dTotal !== 0) r.getCell(10).font = { color: { argb: dTotal > 0 ? RED_FONT : GREEN_FONT }, bold: true };
  }

  const totRow = ws3.addRow(["SUBTOTAL ITENS (sem frete/instalação)", "", "", "", "", "", "", totH, totI, totJ]);
  totRow.height = 22;
  totRow.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
    cell.alignment = { vertical: "middle", horizontal: col === 1 ? "left" : "right" };
    if ([8, 9, 10].includes(col)) cell.numFmt = money;
  });

  const addExtra = (label: string, o: number, n: number) => {
    const d = n - o;
    const r = ws3.addRow([label, "", "", "", "", "", "", o, n, d]);
    r.height = 20;
    r.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { bold: col === 1 };
      cell.alignment = { vertical: "middle", horizontal: col === 1 ? "left" : "right" };
      if ([8, 9, 10].includes(col)) cell.numFmt = money;
    });
  };
  addExtra("Instalação", totals.installationOriginal, totals.installationNegotiated);
  addExtra("Frete / Despacho", totals.freightOriginal, totals.freightNegotiated);

  const grand = ws3.addRow(["TOTAL GERAL", "", "", "", "", "", "", totals.totalOriginal, totals.totalNegotiated, totals.totalNegotiated - totals.totalOriginal]);
  grand.height = 26;
  grand.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
    cell.alignment = { vertical: "middle", horizontal: col === 1 ? "left" : "right" };
    if ([8, 9, 10].includes(col)) cell.numFmt = money;
  });

  ws3.columns = [
    { width: 38 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 10 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
  ];

  // ─── Build blob ───
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });

  const sanitize = (s?: string) =>
    (s || "").trim().replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, "").replace(/\s+/g, "_").slice(0, 40);
  const today = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
  const fileName = `Proposta_Negociada_${sanitize(params.campaignName)}_${sanitize(params.supplier.company_name)}_${today}.xlsx`;

  return { blob, fileName, totals };
}
