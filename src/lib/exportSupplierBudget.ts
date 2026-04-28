import { saveBlobAs } from "@/lib/saveBlobAs";
import { buildExportFileName } from "@/lib/exportFileName";
import { fetchImageBytes } from "@/lib/rateioGridShared";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const BROWN = "FF8C6F4E";
const BEIGE = "FFF7F3EC";
const WHITE = "FFFFFFFF";
const DARK = "FF1C1916";
const BORDER = "FFE5E7EB";
const KIT_BG = "FFEDE3D4";
const GREY = "FF999999";

export type SupplierExportRow = {
  type: "standalone_piece" | "kit_header" | "kit_piece";
  name: string;
  code: number | string;
  specification?: string;
  size?: string;
  totalQty: number;
  unitPrice: number | null;
  lineTotal: number;
  image_url?: string | null;
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

async function fetchImageBuffer(
  url: string,
): Promise<{ buffer: ArrayBuffer; ext: "png" | "jpeg" | "gif" } | null> {
  const fetched = await fetchImageBytes(url, 6000);
  if (!fetched) return null;
  const ext: "png" | "jpeg" | "gif" =
    fetched.mime === "image/jpeg" ? "jpeg" : fetched.mime === "image/gif" ? "gif" : "png";
  return { buffer: fetched.buffer, ext };
}

export async function exportSupplierBudget(params: Params) {
  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "ProduzAI";
  wb.created = new Date();

  const money = moneyFormat(params.currencyCode);
  const ws = wb.addWorksheet("Orçamento", { views: [{ showGridLines: false }] });

  // Title block (cols A:G now → 7 columns: Foto, Tipo, Código, Item, Qtd, Unit, Total)
  ws.mergeCells("A1:G1");
  const t1 = ws.getCell("A1");
  t1.value = [params.agencyName, params.clientName].filter(Boolean).join(" | ") || "ProduzAI";
  t1.font = { name: "Arial", size: 10, color: { argb: WHITE } };
  t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
  t1.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 20;

  ws.mergeCells("A2:G2");
  const t2 = ws.getCell("A2");
  t2.value = (params.campaignName || "").toUpperCase();
  t2.font = { name: "Arial", size: 14, bold: true, color: { argb: WHITE } };
  t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
  t2.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 26;

  ws.mergeCells("A3:G3");
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
  header.values = ["Foto", "Tipo", "Código", "Item / Especificação", "Qtd Total", "Preço Unitário", "Total da Peça"];
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

  // Cache image fetches across rows (same image_url reused in kits)
  const imageCache = new Map<string, { buffer: ArrayBuffer; ext: "png" | "jpeg" | "gif" } | null>();

  // Body rows — sequential because we await image fetches
  let bodyEvenIdx = 0;
  for (let i = 0; i < params.rows.length; i++) {
    const r = params.rows[i];
    const row = ws.addRow([
      "", // Foto column — populated as floating image afterwards
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

    // Tall row to fit the photo
    row.height = 54;

    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = { vertical: "middle", wrapText: true, horizontal: col >= 5 ? "right" : col === 1 ? "center" : "left" };
      cell.font = { bold: isKitHeader };
      cell.border = {
        top: { style: "thin", color: { argb: BORDER } },
        bottom: { style: "thin", color: { argb: BORDER } },
        left: { style: "thin", color: { argb: BORDER } },
        right: { style: "thin", color: { argb: BORDER } },
      };
      if (col === 6 || col === 7) cell.numFmt = money;
    });

    // Insert image into Foto column (col A → index 0)
    let inserted = false;
    if (r.image_url) {
      let img = imageCache.get(r.image_url);
      if (img === undefined) {
        try {
          img = await fetchImageBuffer(r.image_url);
        } catch {
          img = null;
        }
        imageCache.set(r.image_url, img);
      }
      if (img) {
        try {
          const imageId = wb.addImage({ buffer: img.buffer as any, extension: img.ext });
          // Row number in worksheet (1-based). Anchor inside cell A{rowNumber}.
          const rowNumber = row.number;
          ws.addImage(imageId, {
            tl: { col: 0.15, row: rowNumber - 1 + 0.08 } as any,
            ext: { width: 60, height: 60 },
            editAs: "oneCell",
          });
          inserted = true;
        } catch {
          inserted = false;
        }
      }
    }
    if (!inserted) {
      const photoCell = row.getCell(1);
      photoCell.value = "📷";
      photoCell.font = { name: "Arial", size: 16, color: { argb: GREY } };
    }
  }

  // Totals
  ws.addRow([]);
  const itemsTotal = params.rows.reduce((s, r) => s + (r.type === "kit_header" ? 0 : r.lineTotal), 0);
  const addTotalRow = (label: string, value: number | null, emphasized = false) => {
    const r = ws.addRow(["", "", "", "", "", label, value]);
    r.getCell(6).alignment = { horizontal: "right", vertical: "middle" };
    r.getCell(7).alignment = { horizontal: "right", vertical: "middle" };
    r.getCell(7).numFmt = money;
    if (emphasized) {
      r.getCell(6).font = { bold: true, color: { argb: WHITE } };
      r.getCell(7).font = { bold: true, color: { argb: WHITE } };
      r.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
      r.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
    } else {
      r.getCell(6).font = { bold: true };
    }
  };
  addTotalRow("Total dos Itens", itemsTotal);
  addTotalRow("Instalação", params.installation ?? 0);
  addTotalRow("Frete / Despacho", params.freight ?? 0);
  addTotalRow("TOTAL GERAL", params.grandTotal, true);

  ws.columns = [
    { width: 12 }, // Foto
    { width: 14 }, // Tipo
    { width: 12 }, // Código
    { width: 50 }, // Item
    { width: 12 }, // Qtd
    { width: 18 }, // Unit
    { width: 18 }, // Total
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
