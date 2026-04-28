import { saveBlobAs } from "@/lib/saveBlobAs";
import { buildExportFileName } from "@/lib/exportFileName";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const BROWN = "FF8C6F4E";
const BEIGE = "FFF7F3EC";
const WHITE = "FFFFFFFF";
const DARK = "FF1C1916";
const BORDER = "FFE5E7EB";
const KIT_BG = "FFEDE3D4";

export type SupplierExportRow = {
  type: "standalone_piece" | "kit_header" | "kit_piece";
  name: string;
  code: number | string;
  specification?: string;
  size?: string;
  totalQty: number;
  unitPrice: number | null;
  lineTotal: number;
};

type Params = {
  campaignName: string;
  agencyName?: string;
  clientName?: string;
  supplierName: string;
  currencyCode: string;
  rows: SupplierExportRow[];
  installation: number | null;
  freight: number | null;
  grandTotal: number;
};

function moneyFormat(currencyCode: string) {
  if (currencyCode === "USD") return '"US$" #,##0.00;[Red]-"US$" #,##0.00;-';
  if (currencyCode === "CLP") return '"CLP$" #,##0;[Red]-"CLP$" #,##0;-';
  if (currencyCode === "EUR") return '"€" #,##0.00;[Red]-"€" #,##0.00;-';
  return '"R$" #,##0.00;[Red]-"R$" #,##0.00;-';
}

export async function exportSupplierBudget(params: Params) {
  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "ProduzAI";
  wb.created = new Date();

  const money = moneyFormat(params.currencyCode);
  const ws = wb.addWorksheet("Orçamento", { views: [{ showGridLines: false }] });

  // Title block
  ws.mergeCells("A1:F1");
  const t1 = ws.getCell("A1");
  t1.value = [params.agencyName, params.clientName].filter(Boolean).join(" | ") || "ProduzAI";
  t1.font = { name: "Arial", size: 10, color: { argb: WHITE } };
  t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
  t1.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 20;

  ws.mergeCells("A2:F2");
  const t2 = ws.getCell("A2");
  t2.value = (params.campaignName || "").toUpperCase();
  t2.font = { name: "Arial", size: 14, bold: true, color: { argb: WHITE } };
  t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
  t2.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 26;

  ws.mergeCells("A3:F3");
  const t3 = ws.getCell("A3");
  t3.value = `Fornecedor: ${params.supplierName}`;
  t3.font = { name: "Arial", size: 11, bold: true, color: { argb: DARK } };
  t3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
  t3.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(3).height = 22;

  ws.getRow(4).height = 6;

  // Header row
  const headerRowIdx = 5;
  const header = ws.getRow(headerRowIdx);
  header.values = ["Tipo", "Código", "Item / Especificação", "Qtd Total", "Preço Unitário", "Total da Peça"];
  header.height = 24;
  header.eachCell((cell) => {
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

  // Body rows
  let bodyEvenIdx = 0;
  params.rows.forEach((r) => {
    const row = ws.addRow([
      r.type === "kit_header" ? "Kit" : r.type === "kit_piece" ? "Peça do Kit" : "Peça",
      r.code,
      [r.name, r.specification, r.size].filter(Boolean).join(" — "),
      r.totalQty,
      r.type === "kit_header" ? null : r.unitPrice,
      r.type === "kit_header" ? null : r.lineTotal,
    ]);

    const isKitHeader = r.type === "kit_header";
    const bg = isKitHeader ? KIT_BG : bodyEvenIdx % 2 === 0 ? WHITE : BEIGE;
    if (!isKitHeader) bodyEvenIdx++;

    row.eachCell((cell, col) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = { vertical: "middle", wrapText: true, horizontal: col >= 4 ? "right" : "left" };
      cell.font = { bold: isKitHeader };
      cell.border = {
        top: { style: "thin", color: { argb: BORDER } },
        bottom: { style: "thin", color: { argb: BORDER } },
        left: { style: "thin", color: { argb: BORDER } },
        right: { style: "thin", color: { argb: BORDER } },
      };
      if (col === 5 || col === 6) cell.numFmt = money;
    });
  });

  // Totals
  ws.addRow([]);
  const itemsTotal = params.rows.reduce((s, r) => s + (r.type === "kit_header" ? 0 : r.lineTotal), 0);
  const addTotalRow = (label: string, value: number | null, emphasized = false) => {
    const r = ws.addRow(["", "", "", "", label, value]);
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
  addTotalRow("Total dos Itens", itemsTotal);
  addTotalRow("Instalação", params.installation ?? 0);
  addTotalRow("Frete / Despacho", params.freight ?? 0);
  addTotalRow("TOTAL GERAL", params.grandTotal, true);

  ws.columns = [
    { width: 14 },
    { width: 12 },
    { width: 50 },
    { width: 12 },
    { width: 18 },
    { width: 18 },
  ];
  ws.views = [{ state: "frozen", ySplit: headerRowIdx }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  const fileName = buildExportFileName(`Orcamento_${params.supplierName}_${params.campaignName}`, {
    agencyName: params.agencyName,
    clientName: params.clientName,
  });
  await saveBlobAs(blob, fileName, {
    mimeType: XLSX_MIME,
    description: "Planilha Excel (.xlsx)",
    extension: ".xlsx",
  });
}
