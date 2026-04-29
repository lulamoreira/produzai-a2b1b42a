import type { ClientStore, CampaignPiece, CampaignKit, CampaignKitPiece } from "@/hooks/useMultiClientData";
import { saveBlobAs } from "@/lib/saveBlobAs";
import {
  buildRateioGridBuckets,
  rateioGridFileSuffix,
  safeProgress,
  renderStoreRateioSheet,
  sanitizeSheetName,
  type RateioGridExportMode,
  type RateioGridProgress,
  type RateioImageCache,
} from "@/lib/rateioGridShared";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type { RateioGridExportMode };

export async function exportRateioGrid(
  pieces: CampaignPiece[],
  kits: CampaignKit[],
  kitPieces: CampaignKitPiece[],
  stores: ClientStore[],
  qtyMap: Record<string, number>,
  campaignName: string,
  clientName: string,
  agencyName: string,
  mode: RateioGridExportMode = "pieces_and_kits",
  onProgress?: RateioGridProgress,
) {
  const buckets = buildRateioGridBuckets(pieces, kits, kitPieces, stores, qtyMap, mode);
  if (buckets.length === 0) {
    throw new Error("Nenhuma loja com quantidades preenchidas para exportar.");
  }

  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "ProduzAI";

  const usedNames = new Set<string>();
  const imageCache: RateioImageCache = new Map();

  const totalStores = buckets.length;
  let storeIndex = 0;

  for (const bucket of buckets) {
    storeIndex += 1;
    const ws = wb.addWorksheet(sanitizeSheetName(bucket.store.name || "Loja", usedNames), {
      views: [{ showGridLines: false }],
    });
    await renderStoreRateioSheet(wb, ws, bucket, { campaignName, clientName, agencyName }, imageCache);
    safeProgress(onProgress, storeIndex, totalStores, bucket.store.name || "Loja");
  }

  const suffix = rateioGridFileSuffix(mode);
  const filename = `${campaignName} — Rateio por Loja (${suffix}).xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  await saveBlobAs(blob, filename, {
    mimeType: XLSX_MIME,
    description: "Planilha Excel (.xlsx)",
    extension: ".xlsx",
  });
}
