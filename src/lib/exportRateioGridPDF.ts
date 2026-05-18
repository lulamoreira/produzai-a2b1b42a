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

const PDF_MIME = "application/pdf";

// Brand palette (RGB tuples for jspdf)
const DARK: [number, number, number] = [28, 25, 22];
const BROWN: [number, number, number] = [140, 111, 78];
const BEIGE: [number, number, number] = [247, 246, 243];
const ROW_ALT: [number, number, number] = [245, 240, 235];
const BORDER: [number, number, number] = [224, 213, 200];
const GREY: [number, number, number] = [102, 102, 102];
const WHITE: [number, number, number] = [255, 255, 255];

// Layout constants (mm) — A4 landscape: 297 × 210
const PAGE_MARGIN_X = 8;
const PAGE_MARGIN_TOP = 0;
const PAGE_MARGIN_BOTTOM = 7; // footer
const HEADER_TOTAL_HEIGHT = 26; // compact 3-bar header
const CARD_GAP = 2.5;
const CARDS_PER_ROW = 7;
const ROWS_PER_PAGE = 4;
const CARD_HEIGHT = 41; // fits 4 rows in landscape A4
const PHOTO_SIZE = 16;

type ImageCacheEntry = { dataUrl: string; format: "PNG" | "JPEG" | "GIF" } | null;

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
}

async function loadImageDataUrl(url: string, cache: Map<string, ImageCacheEntry>): Promise<ImageCacheEntry> {
  const cached = cache.get(url);
  if (cached !== undefined) return cached;
  const fetched = await fetchImageBytes(url);
  if (!fetched) {
    cache.set(url, null);
    return null;
  }
  const format: "PNG" | "JPEG" | "GIF" =
    fetched.mime === "image/jpeg" ? "JPEG" : fetched.mime === "image/gif" ? "GIF" : "PNG";
  const base64 = bufferToBase64(fetched.buffer);
  const dataUrl = `data:${fetched.mime};base64,${base64}`;
  const entry: ImageCacheEntry = { dataUrl, format };
  cache.set(url, entry);
  return entry;
}

type StoreHeaderInfo = {
  agencyName: string;
  clientName: string;
  campaignName: string;
  storeName: string;
  storeCode: string;
  cityState: string;
  totalQuantity: number;
  pageCurrent?: number;
  pageTotal?: number;
};

function drawStoreHeader(doc: any, info: StoreHeaderInfo) {
  const pw = doc.internal.pageSize.getWidth();
  let y = PAGE_MARGIN_TOP;

  // Bar 1 — agency | client | campaign (dark, white, single compact line)
  const bar1H = 6;
  doc.setFillColor(...DARK);
  doc.rect(0, y, pw, bar1H, "F");
  const top = [info.agencyName, info.clientName].filter(Boolean).join(" | ");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...WHITE);
  doc.text(top || "—", pw / 2, y + bar1H / 2 + 1.3, { align: "center" });
  y += bar1H;

  // Bar 2 — campaign (brown, bold)
  const bar2H = 8;
  doc.setFillColor(...BROWN);
  doc.rect(0, y, pw, bar2H, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.text((info.campaignName || "").toUpperCase(), pw / 2, y + bar2H / 2 + 1.7, { align: "center" });
  y += bar2H;

  // Bar 3 — store name + total qty (beige bg). Qty appears on the same line.
  const bar3H = 7.5;
  doc.setFillColor(...BEIGE);
  doc.rect(0, y, pw, bar3H, "F");
  const pageSuffix = info.pageTotal && info.pageTotal > 1
    ? `  —  PÁGINA ${info.pageCurrent}/${info.pageTotal}`
    : "";
  const qtySuffix = `  •  ${info.totalQuantity} peças`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text(`${info.storeName || "—"}${qtySuffix}${pageSuffix}`, pw / 2, y + bar3H / 2 + 1.9, { align: "center" });
  y += bar3H;

  // Bar 4 — code | city, state (beige bg, brown small)
  const bar4H = 4.5;
  doc.setFillColor(...BEIGE);
  doc.rect(0, y, pw, bar4H, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...BROWN);
  const meta = `Codigo: ${info.storeCode || "—"}  |  ${info.cityState || "—"}`;
  doc.text(meta, pw / 2, y + bar4H / 2 + 1.2, { align: "center" });
  y += bar4H;

  doc.setTextColor(0, 0, 0);
}

function drawFooter(doc: any, campaignName: string, pageNum: number, pageCount: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  doc.text(`ProduzAI — ${campaignName}`, pw / 2, ph - 2.5, { align: "center" });
  doc.text(`Pagina ${pageNum} de ${pageCount}`, pw - PAGE_MARGIN_X, ph - 2.5, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

type CardData = {
  category: string;
  name: string;
  is_new: boolean;
  is_mockup: boolean;
  code: string | number;
  quantity: number;
  image_url: string | null;
};

async function drawCard(
  doc: any,
  card: CardData,
  x: number,
  y: number,
  w: number,
  h: number,
  altBg: boolean,
  imageCache: Map<string, ImageCacheEntry>,
) {
  // Background + border
  doc.setFillColor(...(altBg ? ROW_ALT : WHITE));
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "F");
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "S");

  // Photo (top-centered)
  const photoY = y + 2;
  const photoX = x + (w - PHOTO_SIZE) / 2;
  let imageDrawn = false;
  if (card.image_url) {
    const img = await loadImageDataUrl(card.image_url, imageCache);
    if (img) {
      try {
        doc.addImage(img.dataUrl, img.format, photoX, photoY, PHOTO_SIZE, PHOTO_SIZE);
        imageDrawn = true;
      } catch {
        imageDrawn = false;
      }
    }
  }
  if (!imageDrawn) {
    doc.setDrawColor(...BORDER);
    doc.setFillColor(...BEIGE);
    doc.roundedRect(photoX, photoY, PHOTO_SIZE, PHOTO_SIZE, 1, 1, "FD");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6);
    doc.setTextColor(...GREY);
    doc.text("(sem foto)", photoX + PHOTO_SIZE / 2, photoY + PHOTO_SIZE / 2 + 1, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  // Text block — three tight lines, no overlap
  const textX = x + 2;
  const textW = w - 4;
  let textY = photoY + PHOTO_SIZE + 3.2;

  // Line 1: Local (brown bold, tiny) — single line, truncated to width
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...BROWN);
  const catLine = doc.splitTextToSize(`Local: ${card.category || "—"}`, textW)[0] || "—";
  doc.text(catLine, textX, textY);
  textY += 3.4;

  // Line 2: name (bold dark) — single line, truncated
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.3);
  doc.setTextColor(...(card.is_mockup ? BROWN : DARK));
  const mockupPrefix = card.is_mockup ? "[MOCKUP] " : "";
  const nameRaw = `${mockupPrefix}${card.is_new ? "[N] " : ""}${card.name || "—"}`;
  const nameLine = doc.splitTextToSize(nameRaw, textW)[0] || "—";
  doc.text(nameLine, textX, textY);
  textY += 3.6;

  // Line 3: Cod | Qtd
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...DARK);
  doc.text(`Cod: ${card.code || "—"}  |  Qtd: ${card.quantity}`, textX, textY);

  doc.setTextColor(0, 0, 0);
}

export async function exportRateioGridPDF(
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
  sourceLabel?: string,
) {
  const buckets = buildRateioGridBuckets(pieces, kits, kitPieces, stores, qtyMap, mode);
  if (buckets.length === 0) {
    throw new Error("Nenhuma loja com quantidades preenchidas para exportar.");
  }

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  const imageCache = new Map<string, ImageCacheEntry>();
  const totalStores = buckets.length;

  const usableTop = HEADER_TOTAL_HEIGHT + 2.5;
  const usableBottom = ph - PAGE_MARGIN_BOTTOM;
  const usableWidth = pw - PAGE_MARGIN_X * 2;
  const cardWidth = (usableWidth - CARD_GAP * (CARDS_PER_ROW - 1)) / CARDS_PER_ROW;
  const rowStride = CARD_HEIGHT + CARD_GAP;

  const CARDS_PER_PAGE = CARDS_PER_ROW * ROWS_PER_PAGE;

  // ===== Build index entries grouped by state =====
  type IndexEntry = { bucketIdx: number; storeName: string; storeCode: string; city: string; state: string };
  const indexEntries: IndexEntry[] = buckets.map((b, idx) => ({
    bucketIdx: idx,
    storeName: b.store.name || "Loja",
    storeCode: b.store.store_code || "—",
    city: b.store.city || "",
    state: b.store.state || "—",
  }));
  const byState = new Map<string, IndexEntry[]>();
  for (const e of indexEntries) {
    if (!byState.has(e.state)) byState.set(e.state, []);
    byState.get(e.state)!.push(e);
  }
  const sortedStates = Array.from(byState.keys()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  for (const st of sortedStates) {
    byState.get(st)!.sort((a, b) => a.storeName.localeCompare(b.storeName, "pt-BR"));
  }

  // ===== Index layout planning (3 columns) =====
  const INDEX_COLS = 3;
  const INDEX_LINE_H = 5;
  const INDEX_STATE_H = 7;
  const INDEX_GROUP_GAP = 2;
  const INDEX_TOP = 28; // below page title bar
  const INDEX_BOTTOM = ph - 12;
  const INDEX_COL_GAP = 6;
  const INDEX_COL_W = (pw - PAGE_MARGIN_X * 2 - INDEX_COL_GAP * (INDEX_COLS - 1)) / INDEX_COLS;

  // Pre-compute units (heights) per group
  type IndexUnit = { type: "state" | "entry" | "gap"; state?: string; entry?: IndexEntry; h: number };
  const units: IndexUnit[] = [];
  for (const st of sortedStates) {
    units.push({ type: "state", state: st, h: INDEX_STATE_H });
    for (const e of byState.get(st)!) units.push({ type: "entry", entry: e, h: INDEX_LINE_H });
    units.push({ type: "gap", h: INDEX_GROUP_GAP });
  }

  // Assign each unit to (column, page) — flow columns then pages
  const colHeight = INDEX_BOTTOM - INDEX_TOP;
  type PlacedUnit = IndexUnit & { page: number; col: number; y: number };
  const placed: PlacedUnit[] = [];
  let curPage = 0, curCol = 0, curY = 0;
  for (const u of units) {
    if (curY + u.h > colHeight) {
      curCol += 1;
      curY = 0;
      if (curCol >= INDEX_COLS) {
        curCol = 0;
        curPage += 1;
      }
    }
    // Skip state header at bottom if entries won't follow on same column — handled implicitly by widow check
    placed.push({ ...u, page: curPage, col: curCol, y: curY });
    curY += u.h;
  }
  const indexPagesCount = curPage + 1;

  // First store page = cover(1) + indexPagesCount + 1
  const FIRST_STORE_PAGE = 1 + indexPagesCount + 1;

  // ===== COVER PAGE =====
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pw, ph, "F");
  doc.setFillColor(...BROWN);
  doc.rect(0, ph / 2 - 30, pw, 60, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...WHITE);
  doc.text((campaignName || "").toUpperCase(), pw / 2, ph / 2 - 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text("Rateio por Loja", pw / 2, ph / 2 + 8, { align: "center" });
  if (sourceLabel) {
    doc.setFontSize(11);
    doc.text(sourceLabel, pw / 2, ph / 2 + 18, { align: "center" });
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...BEIGE);
  doc.text([agencyName, clientName].filter(Boolean).join("   |   "), pw / 2, ph / 2 + 42, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // ===== INDEX PAGES (placeholders — we fill clickable links after store pages are rendered) =====
  for (let p = 0; p < indexPagesCount; p++) {
    doc.addPage();
    // top bar
    doc.setFillColor(...BROWN);
    doc.rect(0, 0, pw, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...WHITE);
    doc.text(`ÍNDICE DE LOJAS${indexPagesCount > 1 ? ` — ${p + 1}/${indexPagesCount}` : ""}`, pw / 2, 10.5, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  // Track each store's start page (filled while rendering)
  const storeStartPage: number[] = new Array(buckets.length).fill(0);

  

  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i];
    const { store, items, totalQuantity } = bucket;
    const pageTotal = Math.max(1, Math.ceil(items.length / CARDS_PER_PAGE));
    const baseHeader: StoreHeaderInfo = {
      agencyName,
      clientName,
      campaignName,
      storeName: store.name || "Loja",
      storeCode: store.store_code || "—",
      cityState: [store.city, store.state].filter(Boolean).join(", "),
      totalQuantity,
      pageTotal,
    };

    // Always add a page for each store (cover + index already exist before first store)
    doc.addPage();
    firstStore = false;
    storeStartPage[i] = (doc as any).internal.getNumberOfPages();

    let currentPage = 1;
    drawStoreHeader(doc, { ...baseHeader, pageCurrent: currentPage });

    let y = usableTop;
    let gridRowIdx = 0;

    for (let idx = 0; idx < items.length; idx++) {
      const colInRow = idx % CARDS_PER_ROW;

      if (idx > 0 && idx % CARDS_PER_PAGE === 0) {
        doc.addPage();
        currentPage += 1;
        drawStoreHeader(doc, { ...baseHeader, pageCurrent: currentPage });
        y = usableTop;
        gridRowIdx = 0;
      }

      const x = PAGE_MARGIN_X + colInRow * (cardWidth + CARD_GAP);
      const altBg = gridRowIdx % 2 === 1;

      await drawCard(
        doc,
        {
          category: items[idx].category,
          name: items[idx].name,
          is_new: items[idx].is_new,
          is_mockup: items[idx].is_mockup,
          code: items[idx].code,
          quantity: items[idx].quantity,
          image_url: items[idx].image_url,
        },
        x,
        y,
        cardWidth,
        CARD_HEIGHT,
        altBg,
        imageCache,
      );

      if (colInRow === CARDS_PER_ROW - 1 || idx === items.length - 1) {
        y += rowStride;
        gridRowIdx += 1;
      }
    }

    safeProgress(onProgress, i + 1, totalStores, store.name || "Loja");
  }

  // ===== Render index entries with clickable links =====
  const bucketToStartPage = new Map<number, number>();
  buckets.forEach((_, i) => bucketToStartPage.set(i, storeStartPage[i]));

  for (const u of placed) {
    const pageNum = 2 + u.page; // cover=1, index starts at page 2
    doc.setPage(pageNum);
    const x = PAGE_MARGIN_X + u.col * (INDEX_COL_W + INDEX_COL_GAP);
    const yTop = INDEX_TOP + u.y;

    if (u.type === "state") {
      doc.setFillColor(...BEIGE);
      doc.rect(x, yTop, INDEX_COL_W, INDEX_STATE_H - 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...BROWN);
      doc.text(u.state || "—", x + 2, yTop + INDEX_STATE_H - 2.2);
    } else if (u.type === "entry" && u.entry) {
      const targetPage = bucketToStartPage.get(u.entry.bucketIdx) || FIRST_STORE_PAGE;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      const label = u.entry.storeName;
      const pageLabel = String(targetPage);
      const pageLabelW = doc.getTextWidth(pageLabel);
      const maxLabelW = INDEX_COL_W - pageLabelW - 4;
      const labelTruncated = doc.splitTextToSize(label, maxLabelW)[0] || label;
      const labelY = yTop + INDEX_LINE_H - 1.5;
      doc.textWithLink(labelTruncated, x + 2, labelY, { pageNumber: targetPage });
      // dotted leader
      doc.setTextColor(...GREY);
      doc.setFontSize(7);
      const labelW = doc.getTextWidth(labelTruncated);
      const dotStart = x + 2 + labelW + 1;
      const dotEnd = x + INDEX_COL_W - pageLabelW - 1;
      if (dotEnd > dotStart) {
        const dotsW = dotEnd - dotStart;
        const dotChar = ".";
        const oneDot = doc.getTextWidth(dotChar);
        const dotCount = Math.max(0, Math.floor(dotsW / oneDot));
        if (dotCount > 0) doc.text(dotChar.repeat(dotCount), dotStart, labelY);
      }
      // page number (also linked)
      doc.setTextColor(...DARK);
      doc.setFontSize(8.5);
      doc.textWithLink(pageLabel, x + INDEX_COL_W - pageLabelW - 1, labelY, { pageNumber: targetPage });
    }
  }
  doc.setTextColor(0, 0, 0);

  // ===== Footer on every page except the cover =====
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, campaignName, p, totalPages);
  }

  const suffix = rateioGridFileSuffix(mode);
  const sourceSuffix = sourceLabel ? ` — ${sourceLabel}` : "";
  const filename = `${campaignName} — Rateio por Loja (${suffix})${sourceSuffix}.pdf`;

  const blob = doc.output("blob");
  await saveBlobAs(blob, filename, {
    mimeType: PDF_MIME,
    description: "Documento PDF (.pdf)",
    extension: ".pdf",
  });
}
