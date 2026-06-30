import { saveBlobAs } from "@/lib/saveBlobAs";
import { buildExportFileName } from "@/lib/exportFileName";
import { fetchImageBytes, type RateioImageCache } from "@/lib/rateioGridShared";
import {
  appendMatrixFinancialFooter,
  appendMatrixSheets,
  getMatrixStoreFieldsWithHidden,
  getMatrixTotalQtyRowNum,
  getExcelColumnLetter,
} from "@/lib/exportMatrixExcelJS";
import { getSupplierExcelLabels } from "@/utils/currencyLocale";
import type {
  CampaignPiece,
  CampaignKit,
  CampaignKitPiece,
  ClientStore,
  CampaignPieceLocation,
  CampaignPieceSubLocation,
} from "@/hooks/useMultiClientData";

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
  /** Optional: id of the piece or kit. Required to mirror qty from the matrix sheet. */
  id?: string;
  /** Optional (kit_piece rows): parent kit id, used to reference the kit qty in the matrix. */
  kitId?: string;
  /** Optional (kit_piece rows): how many of this piece compose one kit. */
  kitPieceQuantity?: number;
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
  labels?: ReturnType<typeof getSupplierExcelLabels>;
  /** When true: write Total del Ítem (col G) as formula =E*F and items total as =SUM(G_body). */
  useFormulas?: boolean;
  /** Optional: include the full Rateio module export (Matriz Lojas x Peças + Kit tabs) as additional sheets. */
  rateio?: {
    pieces: CampaignPiece[];
    kits: CampaignKit[];
    kitPieces: CampaignKitPiece[];
    stores: ClientStore[];
    qtyMap: Record<string, number>;
    unitPriceByPieceId?: Record<string, number | null | undefined>;
    installation?: number | null;
    freight?: number | null;
    locations?: CampaignPieceLocation[];
    subLocations?: CampaignPieceSubLocation[];
  };
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

export type ExportSupplierBudgetParams = Params;

export async function buildSupplierBudgetWorkbook(
  params: Params,
): Promise<{ blob: Blob; fileName: string }> {
  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "ProduzAI";
  wb.created = new Date();

  const money = moneyFormat(params.currencyCode);
  const labels = params.labels || getSupplierExcelLabels(params.currencyCode);
  const ws = wb.addWorksheet(labels.worksheetName, { views: [{ showGridLines: false }] });

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
  t3.value = `${params.labels ? (params.currencyCode === "CLP" ? "Proveedor" : "Fornecedor") : "Fornecedor"}: ${params.supplierName}`;
  t3.font = { name: "Arial", size: 11, bold: true, color: { argb: DARK } };
  t3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
  t3.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(3).height = 22;

  // Add "Only Delivery" warning if any
  const somenteEntrega = params.rateio?.stores.filter((s: any) => (s.tipo_entrega ?? 'frete_instalacao') !== 'frete_instalacao').length || 0;
  if (somenteEntrega > 0) {
    const note = labels.onlyDeliveryNote(somenteEntrega);
    ws.mergeCells("A4:G4");
    const t4 = ws.getCell("A4");
    t4.value = note;
    t4.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF990000" } };
    t4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
    t4.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(4).height = 20;
  } else {
    ws.getRow(4).height = 6;
  }

  // Header row
  const headerRowIdx = 5;
  const header = ws.getRow(headerRowIdx);
  header.values = [
    labels.colPhoto,
    labels.colType,
    labels.colCode,
    labels.colItem,
    labels.colQty,
    labels.colUnitPrice,
    labels.colTotal,
  ];
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

  // Cache image fetches across rows AND across the optional Rateio sheet.
  const imageCache: RateioImageCache = new Map();

  // Body rows — sequential because we await image fetches
  let bodyEvenIdx = 0;
  const bodyRowNumbers: number[] = []; // rows that contribute to Total de los Ítems
  // Track each body row so we can later overwrite col E (Cantidad) with a
  // formula that mirrors the "Matriz Lojas x Peças" tab.
  const bodyRowMeta: { rowNumber: number; row: SupplierExportRow }[] = [];
  for (let i = 0; i < params.rows.length; i++) {
    const r = params.rows[i];
    const row = ws.addRow([
      "", // Foto column — populated as floating image afterwards
      r.type === "kit_header" ? labels.typeKit : r.type === "kit_piece" ? labels.typeKitPiece : labels.typePiece,
      r.code,
      [r.name, r.specification, r.size].filter(Boolean).join(" — "),
      r.totalQty,
      r.type === "kit_header" ? null : r.unitPrice,
      r.type === "kit_header" ? null : r.lineTotal,
    ]);
    bodyRowMeta.push({ rowNumber: row.number, row: r });

    // When using formulas, replace col G with =E*F so it recalcs on edit
    if (params.useFormulas && r.type !== "kit_header") {
      const rn = row.number;
      row.getCell(7).value = { formula: `E${rn}*F${rn}` } as any;
      bodyRowNumbers.push(rn);
    }

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
  const addTotalRow = (label: string, value: number | null | any, emphasized = false) => {
    const r = ws.addRow(["", "", "", "", "", label, value as any]);
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
    return r;
  };

  if (params.useFormulas && bodyRowNumbers.length > 0) {
    const first = bodyRowNumbers[0];
    const last = bodyRowNumbers[bodyRowNumbers.length - 1];
    // Use SUM over the full range (kit_header rows are blank in col G so they sum to 0)
    const itemsRow = addTotalRow(labels.rowItemsTotal, { formula: `SUM(G${first}:G${last})` } as any);
    const itemsRowNum = itemsRow.number;
    const instRow = addTotalRow(labels.rowInstallation, params.installation ?? 0);
    const instRowNum = instRow.number;
    const frRow = addTotalRow(labels.rowFreight, params.freight ?? 0);
    const frRowNum = frRow.number;
    addTotalRow(
      labels.rowGrandTotal,
      { formula: `G${itemsRowNum}+G${instRowNum}+G${frRowNum}` } as any,
      true,
    );
  } else {
    addTotalRow(labels.rowItemsTotal, itemsTotal);
    addTotalRow(labels.rowInstallation, params.installation ?? 0);
    addTotalRow(labels.rowFreight, params.freight ?? 0);
    addTotalRow(labels.rowGrandTotal, params.grandTotal, true);
  }


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

  // ─── Optional: append the full Rateio module export (Matriz Lojas x Peças + Kit tabs) ───
  if (params.rateio) {
    // Mirror the Rateio module: only standalone pieces (kit_only=false) become
    // columns in the "Matriz Lojas x Peças" tab. The full piece pool is still
    // passed via `allPieces` so kit components can be resolved.
    const visiblePieces = params.rateio.pieces.filter((p: any) => p.kit_only !== true);
    const matrixSheetName = await appendMatrixSheets(wb, {
      stores: params.rateio.stores,
      pieces: visiblePieces,
      qtyMap: params.rateio.qtyMap,
      campaignName: params.campaignName,
      kits: params.rateio.kits,
      kitPieces: params.rateio.kitPieces,
      locations: params.rateio.locations ?? [],
      subLocations: params.rateio.subLocations ?? [],
      allPieces: params.rateio.pieces,
      agencyName: params.agencyName,
      clientName: params.clientName,
      reservedSheetNames: new Set(["cotação"]),
      skipDashboard: true,
      skipKitTabs: true,
    });
    const matrixWs = wb.getWorksheet(matrixSheetName);
    if (matrixWs && params.rateio.unitPriceByPieceId) {
      const columnItems = [
        ...visiblePieces.map((piece) => ({
          id: piece.id,
          type: "piece" as const,
          displayOrder: piece.display_order ?? 0,
          unitPrice: Number(params.rateio!.unitPriceByPieceId?.[piece.id] ?? 0),
        })),
        ...params.rateio.kits.map((kit) => {
          const unitPrice = params.rateio!.kitPieces
            .filter((kp) => kp.kit_id === kit.id)
            .reduce(
              (sum, kp) => sum + Number(params.rateio!.unitPriceByPieceId?.[kp.piece_id] ?? 0) * Number(kp.quantity || 0),
              0,
            );
          return {
            id: kit.id,
            type: "kit" as const,
            displayOrder: kit.display_order ?? 0,
            unitPrice,
          };
        }),
      ].sort(
        (a, b) =>
          a.displayOrder - b.displayOrder ||
          (a.type === b.type ? 0 : a.type === "piece" ? -1 : 1) ||
          (a.id < b.id ? -1 : 1),
      );
      appendMatrixFinancialFooter({
        ws: matrixWs,
        storeCount: params.rateio.stores.length,
        storeMetaColumnCount: getMatrixStoreFieldsWithHidden().length,
        unitPricesByColumn: columnItems.map((item) => item.unitPrice),
        moneyFormat: money,
        installation: params.rateio.installation ?? params.installation ?? 0,
        freight: params.rateio.freight ?? params.freight ?? 0,
      });
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });

  const firstName = (s?: string) =>
    (s || "").trim().split(/\s+/)[0]?.replace(/[^a-zA-Z0-9À-ÿ_-]/g, "") || "";
  const sanitizeCamp = (s?: string) =>
    (s || "").trim().replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, "").replace(/\s+/g, "_").slice(0, 40);
  const today = new Date()
    .toLocaleDateString("pt-BR", { year: "numeric", month: "2-digit", day: "2-digit" })
    .replace(/\//g, "-");

  const nameParts = [
    labels.exportFileNamePrefix,
    sanitizeCamp(params.campaignName),
    firstName(params.clientName),
    firstName(params.supplierName),
    firstName(params.agencyName),
    today,
  ].filter(Boolean);

  const fileName = `${nameParts.join("_")}.xlsx`;
  return { blob, fileName };
}

export async function exportSupplierBudget(params: Params) {
  const { blob, fileName } = await buildSupplierBudgetWorkbook(params);
  await saveBlobAs(blob, fileName, {
    mimeType: XLSX_MIME,
    description: "Planilha Excel (.xlsx)",
    extension: ".xlsx",
  });
}
