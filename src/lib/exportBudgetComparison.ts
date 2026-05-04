import type * as ExcelJS from "exceljs";
import { saveBlobAs } from "@/lib/saveBlobAs";
import { buildExportFileName } from "@/lib/exportFileName";
import type { CampaignKit, CampaignPiece } from "@/hooks/useMultiClientData";

type BudgetSupplier = {
  id: string;
  company_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status: string;
  submitted_at?: string | null;
};

type BudgetPrice = {
  supplier_id: string;
  piece_id: string | null;
  unit_price: number | string | null;
  adjusted_unit_price?: number | string | null;
};

type BudgetExtraCost = {
  supplier_id: string;
  installation_value: number | string | null;
  freight_value: number | string | null;
  adjusted_installation_value?: number | string | null;
  adjusted_freight_value?: number | string | null;
};

type BudgetKitPiece = {
  id: string;
  kit_id: string;
  piece_id: string;
  quantity: number;
};

type BudgetStore = { id: string; name: string };

type ExportBudgetComparisonParams = {
  campaignName: string;
  agencyName?: string;
  clientName?: string;
  currencyCode: string;
  budgetAmount: number | null;
  suppliers: BudgetSupplier[];
  prices: BudgetPrice[];
  extraCosts: BudgetExtraCost[];
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: BudgetKitPiece[];
  qtyMap: Record<string, number>;
  stores: BudgetStore[];
};

const STATUS_LABELS: Record<string, string> = {
  aguardando: "Aguardando",
  preenchendo: "Preenchendo",
  enviado: "Enviado",
  prazo_encerrado: "Prazo encerrado",
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyFormat(currencyCode: string) {
  if (currencyCode === "USD") return '"US$" #,##0.00;[Red]-"US$" #,##0.00;-';
  if (currencyCode === "CLP") return '"CLP$" #,##0;[Red]-"CLP$" #,##0;-';
  return '"R$" #,##0.00;[Red]-"R$" #,##0.00;-';
}

function getPieceTotals(pieces: CampaignPiece[], stores: BudgetStore[], qtyMap: Record<string, number>) {
  return pieces.reduce<Record<string, number>>((acc, piece) => {
    acc[piece.id] = stores.reduce((sum, store) => sum + (qtyMap[`${store.id}-${piece.id}`] || 0), 0);
    return acc;
  }, {});
}

function getKitComponentTotals(
  kits: CampaignKit[],
  kitPieces: BudgetKitPiece[],
  pieceTotals: Record<string, number>,
) {
  return kits.reduce<Record<string, { kitQty: number; components: Record<string, number> }>>((acc, kit) => {
    const components = kitPieces.filter((kp) => kp.kit_id === kit.id);
    if (!components.length) return acc;

    const kitQty = Math.min(
      ...components.map((kp) => Math.floor((pieceTotals[kp.piece_id] || 0) / (kp.quantity || 1))),
    );

    acc[kit.id] = {
      kitQty: Number.isFinite(kitQty) ? kitQty : 0,
      components: components.reduce<Record<string, number>>((componentAcc, kp) => {
        componentAcc[kp.piece_id] = (Number.isFinite(kitQty) ? kitQty : 0) * (kp.quantity || 1);
        return componentAcc;
      }, {}),
    };
    return acc;
  }, {});
}

function effectiveUnit(price: BudgetPrice | undefined): number {
  if (!price) return 0;
  return toNumber(price.adjusted_unit_price ?? price.unit_price);
}

function getSupplierItemTotal(
  supplierId: string,
  prices: BudgetPrice[],
  pieces: CampaignPiece[],
  pieceTotals: Record<string, number>,
  kitComponentTotals: Record<string, { kitQty: number; components: Record<string, number> }>,
) {
  const standaloneTotal = pieces
    .filter((piece) => !piece.kit_only)
    .reduce((sum, piece) => {
      const price = prices.find((pr) => pr.supplier_id === supplierId && pr.piece_id === piece.id);
      return sum + effectiveUnit(price) * (pieceTotals[piece.id] || 0);
    }, 0);

  const kitTotal = Object.values(kitComponentTotals).reduce((sum, kit) => {
    return sum + Object.entries(kit.components).reduce((componentSum, [pieceId, qty]) => {
      const price = prices.find((pr) => pr.supplier_id === supplierId && pr.piece_id === pieceId);
      return componentSum + effectiveUnit(price) * qty;
    }, 0);
  }, 0);

  return standaloneTotal + kitTotal;
}

function styleHeader(row: ExcelJS.Row, fillColor = "8C6F4E") {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${fillColor}` } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });
}

function styleBody(row: ExcelJS.Row, isEven: boolean) {
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isEven ? "FFF7F3EC" : "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });
}

export async function exportBudgetComparison(params: ExportBudgetComparisonParams) {
  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "ProduzAI";
  wb.created = new Date();

  const money = moneyFormat(params.currencyCode);
  const pieceTotals = getPieceTotals(params.pieces, params.stores, params.qtyMap);
  const kitComponentTotals = getKitComponentTotals(params.kits, params.kitPieces, pieceTotals);
  const extraBySupplier = new Map(params.extraCosts.map((cost) => [cost.supplier_id, cost]));
  const supplierTotals = new Map<string, { items: number; installation: number; freight: number; grand: number }>();

  params.suppliers.forEach((supplier) => {
    const extra = extraBySupplier.get(supplier.id) as any;
    const items = getSupplierItemTotal(supplier.id, params.prices, params.pieces, pieceTotals, kitComponentTotals);
    const installation = toNumber(extra?.adjusted_installation_value ?? extra?.installation_value);
    const freight = toNumber(extra?.adjusted_freight_value ?? extra?.freight_value);
    supplierTotals.set(supplier.id, { items, installation, freight, grand: items + installation + freight });
  });

  const summary = wb.addWorksheet("Resumo");
  summary.addRow([`Orçamento — ${params.campaignName}`]);
  summary.mergeCells(1, 1, 1, 9);
  const title = summary.getCell(1, 1);
  title.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8C6F4E" } };
  title.alignment = { horizontal: "center" };
  summary.addRow(["Moeda", params.currencyCode, "Budget", params.budgetAmount ?? "", "Fornecedores", params.suppliers.length]);
  summary.getCell("D2").numFmt = money;
  summary.addRow([]);
  styleHeader(summary.addRow(["Fornecedor", "Contato", "E-mail", "Status", "Itens", "Instalação", "Frete", "Total Geral", "Diferença vs Budget"]));

  params.suppliers.forEach((supplier, index) => {
    const totals = supplierTotals.get(supplier.id) ?? { items: 0, installation: 0, freight: 0, grand: 0 };
    const row = summary.addRow([
      supplier.company_name,
      supplier.contact_name || "",
      supplier.email || "",
      STATUS_LABELS[supplier.status] || supplier.status,
      totals.items,
      totals.installation,
      totals.freight,
      totals.grand,
      params.budgetAmount == null ? "" : totals.grand - params.budgetAmount,
    ]);
    [5, 6, 7, 8, 9].forEach((col) => { row.getCell(col).numFmt = money; });
    styleBody(row, index % 2 === 0);
  });
  summary.columns = [
    { width: 28 }, { width: 22 }, { width: 32 }, { width: 18 },
    { width: 16 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 20 },
  ];
  summary.views = [{ state: "frozen", ySplit: 4 }];

  const items = wb.addWorksheet("Itens");
  styleHeader(items.addRow(["Tipo", "Código", "Nome", "Especificação", "Quantidade", ...params.suppliers.flatMap((s) => [`${s.company_name} - Unit.`, `${s.company_name} - Total`])]));
  const addItemRow = (values: (string | number)[], rowIndex: number) => {
    const row = items.addRow(values);
    for (let col = 6; col <= row.cellCount; col++) row.getCell(col).numFmt = money;
    styleBody(row, rowIndex % 2 === 0);
  };
  let rowIndex = 0;
  params.pieces.filter((piece) => !piece.kit_only).sort((a, b) => a.display_order - b.display_order).forEach((piece) => {
    const qty = pieceTotals[piece.id] || 0;
    addItemRow([
      "Peça",
      piece.code,
      piece.name,
      piece.specification || "",
      qty,
      ...params.suppliers.flatMap((supplier) => {
        const priceRow = params.prices.find((pr) => pr.supplier_id === supplier.id && pr.piece_id === piece.id);
        const unitPrice = effectiveUnit(priceRow);
        return [unitPrice, unitPrice * qty];
      }),
    ], rowIndex++);
  });
  params.kits.sort((a, b) => a.display_order - b.display_order).forEach((kit) => {
    const kitData = kitComponentTotals[kit.id];
    if (!kitData) return;
    addItemRow(["Kit", kit.code, kit.name, "", kitData.kitQty, ...params.suppliers.flatMap((supplier) => {
      const kitTotal = Object.entries(kitData.components).reduce((sum, [pieceId, qty]) => {
        const priceRow = params.prices.find((pr) => pr.supplier_id === supplier.id && pr.piece_id === pieceId);
        const unitPrice = effectiveUnit(priceRow);
        return sum + unitPrice * qty;
      }, 0);
      return ["", kitTotal];
    })], rowIndex++);
  });
  items.columns.forEach((col, index) => { col.width = index < 5 ? [14, 10, 34, 44, 14][index] : 18; });
  items.views = [{ state: "frozen", ySplit: 1, xSplit: 5 }];

  const kitsSheet = wb.addWorksheet("Composição dos Kits");
  styleHeader(kitsSheet.addRow(["Kit", "Código Kit", "Qtd Kit", "Código Peça", "Peça", "Qtd por Kit", "Qtd Total"]));
  let kitRowIndex = 0;
  params.kits.sort((a, b) => a.display_order - b.display_order).forEach((kit) => {
    const kitData = kitComponentTotals[kit.id];
    const components = params.kitPieces.filter((kp) => kp.kit_id === kit.id);
    components.forEach((kp) => {
      const piece = params.pieces.find((p) => p.id === kp.piece_id);
      const row = kitsSheet.addRow([kit.name, kit.code, kitData?.kitQty ?? 0, piece?.code ?? "", piece?.name ?? kp.piece_id, kp.quantity, kitData?.components[kp.piece_id] ?? 0]);
      styleBody(row, kitRowIndex++ % 2 === 0);
    });
  });
  kitsSheet.columns = [{ width: 34 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 34 }, { width: 12 }, { width: 12 }];
  kitsSheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const fileName = buildExportFileName(`Orcamento_${params.campaignName}`, {
    agencyName: params.agencyName,
    clientName: params.clientName,
  });
  await saveBlobAs(blob, fileName, {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    description: "Planilha Excel (.xlsx)",
    extension: ".xlsx",
  });
}