import type { CampaignPiece, CampaignKit, CampaignKitPiece, ClientStore } from "@/hooks/useMultiClientData";
import type * as ExcelJS from "exceljs";

export type RateioGridExportMode = "pieces" | "pieces_and_kits";

export type RateioGridItem = {
  name: string;
  code: string | number;
  category: string;
  quantity: number;
  is_new: boolean;
  is_mockup: boolean;
  image_url: string | null;
};

export type RateioGridStoreBucket = {
  store: ClientStore;
  items: RateioGridItem[];
  totalQuantity: number;
};

/**
 * Builds the list of items per store applying mode logic.
 * - "pieces": include all pieces (standalone + kit_only) where qty > 0. No kits.
 * - "pieces_and_kits": only standalone pieces (kit_only=false) with qty > 0, PLUS kits with computed qty > 0.
 *
 * Stores with zero items are filtered out.
 */
export function buildRateioGridBuckets(
  pieces: CampaignPiece[],
  kits: CampaignKit[],
  kitPieces: CampaignKitPiece[],
  stores: ClientStore[],
  qtyMap: Record<string, number>,
  mode: RateioGridExportMode,
): RateioGridStoreBucket[] {
  const buckets: RateioGridStoreBucket[] = [];

  for (const store of stores) {
    const items: RateioGridItem[] = [];

    for (const p of pieces) {
      const isKitOnly = (p as any).kit_only === true;
      if (mode === "pieces_and_kits" && isKitOnly) continue;
      const qty = qtyMap[`${store.id}-${p.id}`] || 0;
      if (qty > 0) {
        items.push({
          name: p.name || "",
          code: p.code || "",
          category: p.category || "—",
          quantity: qty,
          is_new: (p as any).is_new === true,
          is_mockup: (p as any).is_mockup === true,
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
            is_mockup: (k as any).is_mockup === true,
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
    buckets.push({ store, items, totalQuantity });
  }

  return buckets;
}

export function rateioGridFileSuffix(mode: RateioGridExportMode): string {
  return mode === "pieces" ? "Peças" : "Peças e Kits";
}

export type RateioGridProgress = (current: number, total: number, storeName: string) => void;

export function safeProgress(cb: RateioGridProgress | undefined, current: number, total: number, storeName: string) {
  if (!cb) return;
  try {
    cb(current, total, storeName);
  } catch {
    // ignore — progress callback should never break the export
  }
}

/** Fetch image with timeout. Returns null on failure. */
export async function fetchImageBytes(
  url: string,
  timeoutMs = 5000,
): Promise<{ buffer: ArrayBuffer; mime: "image/png" | "image/jpeg" | "image/gif" } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    let mime: "image/png" | "image/jpeg" | "image/gif" = "image/png";
    if (ct.includes("jpeg") || ct.includes("jpg")) mime = "image/jpeg";
    else if (ct.includes("gif")) mime = "image/gif";
    else if (ct.includes("png")) mime = "image/png";
    else if (/\.jpe?g(\?|$)/i.test(url)) mime = "image/jpeg";
    else if (/\.gif(\?|$)/i.test(url)) mime = "image/gif";
    return { buffer, mime };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Shared rendering: a single store's "Rateio" sheet (or block in
// a multi-store sheet). Used by both the standalone Rateio export
// and the supplier budget export (second tab).
// ─────────────────────────────────────────────────────────────

export type RateioImageCache = Map<string, { buffer: ArrayBuffer; ext: "png" | "jpeg" | "gif" } | null>;

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

// Palette (must match exportRateioGrid for visual consistency)
const DARK = "FF1C1916";
const BROWN = "FF8C6F4E";
const BEIGE = "FFF7F6F3";
const WHITE = "FFFFFFFF";
const GREY = "FF666666";
const BORDER = "FFE0D5C8";
const ROW_ALT = "FFF5F0EB";

export function sanitizeSheetName(name: string, used: Set<string>) {
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

export type RenderStoreOpts = {
  campaignName: string;
  clientName: string;
  agencyName: string;
};

/**
 * Renders a single store's rateio grid into the given worksheet.
 * Returns the number of rows used (so callers can stack multiple stores).
 */
export async function renderStoreRateioSheet(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  bucket: RateioGridStoreBucket,
  opts: RenderStoreOpts,
  imageCache: RateioImageCache,
): Promise<void> {
  const { store, items, totalQuantity } = bucket;
  const { campaignName, clientName, agencyName } = opts;

  for (let c = 1; c <= 12; c++) {
    ws.getColumn(c).width = 12;
  }

  // ─── Header rows 1–5 ───
  ws.mergeCells("A1:L1");
  const r1 = ws.getCell("A1");
  r1.value = [agencyName, clientName].filter(Boolean).join(" | ");
  r1.font = { name: "Arial", size: 10, color: { argb: WHITE } };
  r1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
  r1.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 20;

  ws.mergeCells("A2:L2");
  const r2 = ws.getCell("A2");
  r2.value = (campaignName || "").toUpperCase();
  r2.font = { name: "Arial", size: 14, bold: true, color: { argb: WHITE } };
  r2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
  r2.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 24;

  ws.mergeCells("A3:L3");
  const r3 = ws.getCell("A3");
  r3.value = store.name || "";
  r3.font = { name: "Arial", size: 18, bold: true, color: { argb: DARK } };
  r3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
  r3.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(3).height = 30;

  ws.mergeCells("A4:L4");
  const r4 = ws.getCell("A4");
  const cityState = [(store as any).city, (store as any).state].filter(Boolean).join(", ");
  r4.value = `Código: ${(store as any).store_code || "—"} | ${cityState || "—"}`;
  r4.font = { name: "Arial", size: 10, color: { argb: BROWN } };
  r4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
  r4.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(4).height = 18;

  ws.getRow(5).height = 8;

  // ─── Grid section ───
  const cardCols: Array<[string, string]> = [
    ["A", "B"],
    ["C", "D"],
    ["E", "F"],
    ["G", "H"],
    ["I", "J"],
    ["K", "L"],
  ];
  const CARDS_PER_ROW = 6;

  let lastDataRow = 5;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const gridRow = Math.floor(idx / CARDS_PER_ROW);
    const gridCol = idx % CARDS_PER_ROW;
    const top = 6 + gridRow * 6;
    const [colL, colR] = cardCols[gridCol];

    if (gridCol === 0) {
      ws.getRow(top + 0).height = 42;
      for (let i = 1; i <= 4; i++) ws.getRow(top + i).height = 15;
      ws.getRow(top + 5).height = 6;
    }

    const isAlt = gridRow % 2 === 1;
    const bgArgb = isAlt ? ROW_ALT : WHITE;

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
          const colIdxL = colL.charCodeAt(0) - 65;
          ws.addImage(imageId, {
            tl: { col: colIdxL + 0.5, row: photoRow - 1 + 0.05 } as any,
            ext: { width: 50, height: 50 },
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

    const lines: Array<{ value: string; font: any }> = [
      {
        value: `📍 ${item.category}`,
        font: { name: "Arial", size: 9, bold: true, color: { argb: BROWN } },
      },
      {
        value: `${item.is_mockup ? "🎭 MOCKUP — " : ""}${item.is_new ? "🆕 " : ""}${item.name}`,
        font: { name: "Arial", size: 11, bold: true, color: { argb: item.is_mockup ? BROWN : DARK } },
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
  ws.mergeCells(`A${totalRow}:L${totalRow}`);
  const tCell = ws.getCell(`A${totalRow}`);
  tCell.value = `Total de peças: ${totalQuantity}`;
  tCell.font = { name: "Arial", size: 14, bold: true, color: { argb: WHITE } };
  tCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
  tCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(totalRow).height = 28;
}
