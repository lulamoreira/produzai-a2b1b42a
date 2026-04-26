import type { ClientStore, CampaignPiece, CampaignKit, CampaignKitPiece } from "@/hooks/useMultiClientData";
import { saveBlobAs } from "@/lib/saveBlobAs";
import {
  buildRateioGridBuckets,
  rateioGridFileSuffix,
  safeProgress,
  fetchImageBytes,
  type RateioGridExportMode,
  type RateioGridProgress,
} from "@/lib/rateioGridShared";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Palette
const DARK = "FF1C1916";
const BROWN = "FF8C6F4E";
const BEIGE = "FFF7F6F3";
const WHITE = "FFFFFFFF";
const GREY = "FF666666";
const BORDER = "FFE0D5C8";
const ROW_ALT = "FFF5F0EB";

export type { RateioGridExportMode };

function sanitizeSheetName(name: string, used: Set<string>) {
  let base = (name || "Loja").replace(/[\\/?*[\]:]/g, "").trim().slice(0, 31) || "Loja";
  let candidate = base;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = `~${i}`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
    i++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

async function fetchImageBuffer(
  url: string,
  timeoutMs = 5000,
): Promise<{ buffer: ArrayBuffer; ext: "png" | "jpeg" | "gif" } | null> {
  const fetched = await fetchImageBytes(url, timeoutMs);
  if (!fetched) return null;
  const ext: "png" | "jpeg" | "gif" =
    fetched.mime === "image/jpeg" ? "jpeg" : fetched.mime === "image/gif" ? "gif" : "png";
  return { buffer: fetched.buffer, ext };
}

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

  // Cache image buffers across all sheets to avoid refetching
  const imageCache = new Map<string, { buffer: ArrayBuffer; ext: "png" | "jpeg" | "gif" } | null>();

  const totalStores = buckets.length;
  let storeIndex = 0;

  for (const bucket of buckets) {
    const { store, items, totalQuantity } = bucket;

    storeIndex += 1;

    const ws = wb.addWorksheet(sanitizeSheetName(store.name || "Loja", usedNames), {
      views: [{ showGridLines: false }],
    });

    for (let c = 1; c <= 8; c++) {
      ws.getColumn(c).width = 18;
    }

    // ─── Header rows 1–5 ───
    ws.mergeCells("A1:H1");
    const r1 = ws.getCell("A1");
    r1.value = [agencyName, clientName].filter(Boolean).join(" | ");
    r1.font = { name: "Arial", size: 10, color: { argb: WHITE } };
    r1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
    r1.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 20;

    ws.mergeCells("A2:H2");
    const r2 = ws.getCell("A2");
    r2.value = (campaignName || "").toUpperCase();
    r2.font = { name: "Arial", size: 14, bold: true, color: { argb: WHITE } };
    r2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
    r2.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 24;

    ws.mergeCells("A3:H3");
    const r3 = ws.getCell("A3");
    r3.value = store.name || "";
    r3.font = { name: "Arial", size: 18, bold: true, color: { argb: DARK } };
    r3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
    r3.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(3).height = 30;

    ws.mergeCells("A4:H4");
    const r4 = ws.getCell("A4");
    const cityState = [store.city, store.state].filter(Boolean).join(", ");
    r4.value = `Código: ${store.store_code || "—"} | ${cityState || "—"}`;
    r4.font = { name: "Arial", size: 10, color: { argb: BROWN } };
    r4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
    r4.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(4).height = 18;

    ws.getRow(5).height = 8;

    // ─── Grid section ───
    // Each card: 5 data rows (photo + 4 text) + 1 spacer = 6 rows
    const cardCols: Array<[string, string]> = [
      ["A", "B"],
      ["C", "D"],
      ["E", "F"],
      ["G", "H"],
    ];

    let lastDataRow = 5;

    // Process items sequentially (for image fetching)
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const gridRow = Math.floor(idx / 4);
      const gridCol = idx % 4;
      const top = 6 + gridRow * 6; // 5 data rows + 1 spacer
      const [colL, colR] = cardCols[gridCol];

      // Set row heights once per gridRow (when first card in row is processed)
      if (gridCol === 0) {
        ws.getRow(top + 0).height = 50; // photo
        for (let i = 1; i <= 4; i++) ws.getRow(top + i).height = 18;
        ws.getRow(top + 5).height = 8; // spacer
      }

      const isAlt = gridRow % 2 === 1;
      const bgArgb = isAlt ? ROW_ALT : WHITE;

      // ── Photo row (top+0) ──
      const photoRow = top + 0;
      ws.mergeCells(`${colL}${photoRow}:${colR}${photoRow}`);
      const photoCell = ws.getCell(`${colL}${photoRow}`);
      photoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
      photoCell.alignment = { horizontal: "center", vertical: "middle" };

      let imageInserted = false;
      if (item.image_url) {
        let img = imageCache.get(item.image_url);
        if (img === undefined) {
          img = await fetchImageBuffer(item.image_url);
          imageCache.set(item.image_url, img);
        }
        if (img) {
          try {
            const imageId = wb.addImage({ buffer: img.buffer as any, extension: img.ext });
            // Anchor image inside the merged 2-col cell, ~60x60 px, centered-ish
            // Column index is 0-based for ExcelJS image positioning
            const colIdxL = colL.charCodeAt(0) - 65; // A=0
            ws.addImage(imageId, {
              tl: { col: colIdxL + 0.5, row: photoRow - 1 + 0.05 } as any,
              ext: { width: 60, height: 60 },
              editAs: "oneCell",
            });
            imageInserted = true;
          } catch {
            imageInserted = false;
          }
        }
      }

      if (!imageInserted) {
        photoCell.value = "📷";
        photoCell.font = { name: "Arial", size: 18, color: { argb: GREY } };
      }

      // ── Text rows ──
      const lines: Array<{ value: string; font: any }> = [
        {
          value: `📍 ${item.category}`,
          font: { name: "Arial", size: 9, bold: true, color: { argb: BROWN } },
        },
        {
          value: `${item.is_new ? "🆕 " : ""}${item.name}`,
          font: { name: "Arial", size: 11, bold: true, color: { argb: DARK } },
        },
        {
          value: `Cód: ${item.code || "—"}`,
          font: { name: "Arial", size: 9, color: { argb: GREY } },
        },
        {
          value: `Qtd: ${item.quantity}`,
          font: { name: "Arial", size: 10, bold: true, color: { argb: DARK } },
        },
      ];

      lines.forEach((line, i) => {
        const rowNum = top + 1 + i;
        ws.mergeCells(`${colL}${rowNum}:${colR}${rowNum}`);
        const cell = ws.getCell(`${colL}${rowNum}`);
        cell.value = line.value;
        cell.font = line.font;
        cell.alignment = { horizontal: "left", vertical: "middle", indent: 1, wrapText: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
      });

      // Apply alt background to right column of photo row too (already merged)
      // Borders around the 5-row × 2-col block
      const borderColor = { argb: BORDER };
      const thin = { style: "thin" as const, color: borderColor };
      for (let i = 0; i < 5; i++) {
        const rowNum = top + i;
        const left = ws.getCell(`${colL}${rowNum}`);
        const right = ws.getCell(`${colR}${rowNum}`);
        const isTop = i === 0;
        const isBottom = i === 4;
        left.border = {
          left: thin,
          top: isTop ? thin : undefined,
          bottom: isBottom ? thin : undefined,
        };
        right.border = {
          right: thin,
          top: isTop ? thin : undefined,
          bottom: isBottom ? thin : undefined,
        };
      }

      lastDataRow = Math.max(lastDataRow, top + 4);
    }

    // ─── Total summary ───
    const spacer1 = lastDataRow + 1;
    const spacer2 = lastDataRow + 2;
    const totalRow = lastDataRow + 3;
    ws.getRow(spacer1).height = 8;
    ws.getRow(spacer2).height = 8;
    ws.mergeCells(`A${totalRow}:H${totalRow}`);
    const tCell = ws.getCell(`A${totalRow}`);
    tCell.value = `Total de peças: ${totalQuantity}`;
    tCell.font = { name: "Arial", size: 14, bold: true, color: { argb: WHITE } };
    tCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
    tCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(totalRow).height = 28;

    safeProgress(onProgress, storeIndex, totalStores, store.name || "Loja");
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
