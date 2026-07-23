import type { ClientStore, CampaignPiece, CampaignKit, CampaignKitPiece } from "@/hooks/useMultiClientData";
import { saveXlsxAs } from "@/lib/saveBlobAs";
import {
  appendMatrixSheets,
  appendMatrixFinancialFooter,
  getMatrixStoreFieldsWithHidden,
} from "@/lib/exportMatrixExcelJS";

function moneyFormat(currencyCode?: string | null) {
  if (currencyCode === "USD") return '"US$" #,##0.00;[Red]-"US$" #,##0.00;-';
  if (currencyCode === "CLP") return '"CLP$" #,##0;[Red]-"CLP$" #,##0;-';
  if (currencyCode === "EUR") return '"€" #,##0.00;[Red]-"€" #,##0.00;-';
  return '"R$" #,##0.00;[Red]-"R$" #,##0.00;-';
}

export interface ExportRequoteSheetParams {
  stores: ClientStore[];
  /** Pieces to include as columns (kit_only pieces should be excluded — pass their parent kit instead). */
  pieces: CampaignPiece[];
  /** Full piece pool (so kit components can be resolved by appendMatrixSheets). */
  allPieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: CampaignKitPiece[];
  qtyMap: Record<string, number>;
  campaignName: string;
  agencyName?: string;
  clientName?: string;
  currencyCode?: string | null;
  locations?: any[];
  subLocations?: any[];
}

/**
 * Generates a "Recotação" workbook: the Rateio matrix filtered to a subset of
 * pieces/kits, with a blank "PREÇO UNITÁRIO" row for the supplier to fill in.
 * Does not alter the standard Rateio export.
 */
export async function exportRequoteSheet(params: ExportRequoteSheetParams): Promise<void> {
  const {
    stores,
    pieces,
    allPieces,
    kits,
    kitPieces,
    qtyMap,
    campaignName,
    agencyName,
    clientName,
    currencyCode,
    locations = [],
    subLocations = [],
  } = params;

  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "ProduzAI";

  const matrixSheetName = await appendMatrixSheets(wb, {
    stores,
    pieces,
    qtyMap,
    campaignName,
    kits,
    kitPieces,
    locations,
    subLocations,
    allPieces,
    agencyName,
    clientName,
    skipDashboard: true,
    skipKitTabs: true,
  });

  const matrixWs = wb.getWorksheet(matrixSheetName);
  const totalColumns = pieces.length + kits.length;
  if (matrixWs && totalColumns > 0) {
    appendMatrixFinancialFooter({
      ws: matrixWs,
      storeCount: stores.length,
      storeMetaColumnCount: getMatrixStoreFieldsWithHidden().length,
      unitPricesByColumn: new Array(totalColumns).fill(0),
      moneyFormat: moneyFormat(currencyCode),
      installation: 0,
      freight: 0,
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const safeName = (campaignName || "campanha").replace(/[^a-zA-Z0-9À-ÿ_-]+/g, "_");
  const fileName = `Recotacao_${safeName}_${pieces.length + kits.length}pecas.xlsx`;
  await saveXlsxAs(buffer as ArrayBuffer, fileName);
}
