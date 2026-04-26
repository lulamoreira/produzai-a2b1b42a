import type { ClientStore, CampaignPiece, CampaignKit, CampaignKitPiece } from "@/hooks/useMultiClientData";
import { saveBlobAs } from "@/lib/saveBlobAs";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Palette
const DARK = "FF1C1916";
const BROWN = "FF8C6F4E";
const BEIGE = "FFF7F6F3";
const WHITE = "FFFFFFFF";
const GREY = "FF666666";
const BORDER = "FFE0D5C8";
const ROW_ALT = "FFF5F0EB";

export type RateioGridExportMode = "pieces" | "pieces_and_kits";

type Item = {
  name: string;
  code: string | number;
  category: string;
  quantity: number;
  is_new: boolean;
  image_url: string | null;
};

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

async function fetchImageBuffer(url: string, timeoutMs = 5000): Promise<{ buffer: ArrayBuffer; ext: "png" | "jpeg" | "gif" } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    let ext: "png" | "jpeg" | "gif" = "png";
    if (ct.includes("jpeg") || ct.includes("jpg")) ext = "jpeg";
    else if (ct.includes("gif")) ext = "gif";
    else if (ct.includes("png")) ext = "png";
    else {
      // fallback: detect from URL
      if (/\.jpe?g(\?|$)/i.test(url)) ext = "jpeg";
      else if (/\.gif(\?|$)/i.test(url)) ext = "gif";
    }
    return { buffer, ext };
  } catch {
    return null;
  }
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
) {
  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "ProduzAI";

  const usedNames = new Set<string>();

  // Cache image buffers across all sheets to avoid refetching
  const imageCache = new Map<string, { buffer: ArrayBuffer; ext: "png" | "jpeg" | "gif" } | null>();

  for (const store of stores) {
    // Build items for this store based on mode
    const items: Item[] = [];

    for (const p of pieces) {
      const isKitOnly = (p as any).kit_only === true;
      // mode=pieces: include all pieces (standalone + kit_only)
      // mode=pieces_and_kits: only standalone pieces
      if (mode === "pieces_and_kits" && isKitOnly) continue;
      const qty = qtyMap[`${store.id}-${p.id}`] || 0;
      if (qty > 0) {
        items.push({
          name: p.name || "",
          code: p.code || "",
          category: p.category || "—",
          quantity: qty,
          is_new: (p as any).is_new === true,
          image_url: p.image_url || null,
        });
      }
    }

    if (mode === "pieces_and_kits") {
      for (const k of kits) {
        const components = kitPieces.filter((kp) => kp.kit_id === k.id);
        if (components.length === 0) continue;
        const kitQty = Math.min(
          ...components.map((kp) => {
            const storeQty = qtyMap[`${store.id}-${kp.piece_id}`] || 0;
            return Math.floor(storeQty / (kp.quantity || 1));
          }),
        );
        if (kitQty > 0) {
          items.push({
            name: k.name || "",
            code: k.code || "",
            category: k.category || "—",
            quantity: kitQty,
            is_new: (k as any).is_new === true,
            image_url: k.image_url || null,
          });
        }
      }
    }

    if (items.length === 0) continue;

    items.sort((a, b) => {
      const c = a.category.localeCompare(b.category, "pt-BR");
      if (c !== 0) return c;
      return a.name.localeCompare(b.name, "pt-BR");
    });

    const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);

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
  }

  if (wb.worksheets.length === 0) {
    throw new Error("Nenhuma loja com quantidades preenchidas para exportar.");
  }

  const suffix = mode === "pieces" ? "Peças" : "Peças e Kits";
  const filename = `${campaignName} — Rateio por Loja (${suffix}).xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  await saveBlobAs(blob, filename, {
    mimeType: XLSX_MIME,
    description: "Planilha Excel (.xlsx)",
    extension: ".xlsx",
  });
}
