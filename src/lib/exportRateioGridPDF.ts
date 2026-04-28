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
const DARK: [number, number, number] = [28, 25, 22]; // #1C1916
const BROWN: [number, number, number] = [140, 111, 78]; // #8C6F4E
const BEIGE: [number, number, number] = [247, 246, 243]; // #F7F6F3
const ROW_ALT: [number, number, number] = [245, 240, 235]; // #F5F0EB
const BORDER: [number, number, number] = [224, 213, 200]; // #E0D5C8
const GREY: [number, number, number] = [102, 102, 102]; // #666666
const WHITE: [number, number, number] = [255, 255, 255];

// Layout constants (mm)
const PAGE_MARGIN_X = 10;
const PAGE_MARGIN_TOP = 0; // header is full-width to top
const PAGE_MARGIN_BOTTOM = 12; // footer reserved
const HEADER_TOTAL_HEIGHT = 38; // 4 stacked bars
const CARD_GAP = 3;
const CARDS_PER_ROW = 6;
const CARD_HEIGHT = 42; // mm — compact card, ~4 rows per page in landscape A4
const PHOTO_SIZE = 16; // mm

type ImageCacheEntry = { dataUrl: string; format: "PNG" | "JPEG" | "GIF" } | null;

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  // btoa is available in browsers
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
};

function drawStoreHeader(doc: any, info: StoreHeaderInfo) {
  const pw = doc.internal.pageSize.getWidth();
  let y = PAGE_MARGIN_TOP;

  // Bar 1 — agency | client (dark, white text, small)
  const bar1H = 7;
  doc.setFillColor(...DARK);
  doc.rect(0, y, pw, bar1H, "F");
  const agencyClient = [info.agencyName, info.clientName].filter(Boolean).join(" | ");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(agencyClient || "—", pw / 2, y + bar1H / 2 + 1.5, { align: "center" });
  y += bar1H;

  // Bar 2 — campaign UPPER (brown, white bold, larger)
  const bar2H = 10;
  doc.setFillColor(...BROWN);
  doc.rect(0, y, pw, bar2H, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text((info.campaignName || "").toUpperCase(), pw / 2, y + bar2H / 2 + 2, { align: "center" });
  y += bar2H;

  // Bar 3 — store name (beige bg, dark bold, large)
  const bar3H = 12;
  doc.setFillColor(...BEIGE);
  doc.rect(0, y, pw, bar3H, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...DARK);
  doc.text(info.storeName || "—", pw / 2, y + bar3H / 2 + 2.5, { align: "center" });
  y += bar3H;

  // Bar 4 — code | city, state (beige bg, brown small)
  const bar4H = 9;
  doc.setFillColor(...BEIGE);
  doc.rect(0, y, pw, bar4H, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BROWN);
  const meta = `Codigo: ${info.storeCode || "—"} | ${info.cityState || "—"}`;
  doc.text(meta, pw / 2, y + bar4H / 2 + 1.5, { align: "center" });
  y += bar4H;

  // reset text color
  doc.setTextColor(0, 0, 0);
}

function drawFooter(doc: any, campaignName: string, pageNum: number, pageCount: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text(`ProduzAI — ${campaignName}`, pw / 2, ph - 5, { align: "center" });
  doc.text(`Pagina ${pageNum} de ${pageCount}`, pw - PAGE_MARGIN_X, ph - 5, { align: "right" });
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
  // Background
  if (altBg) {
    doc.setFillColor(...ROW_ALT);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, "F");
  } else {
    doc.setFillColor(...WHITE);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, "F");
  }
  // Border
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "S");

  // Photo area (top-centered)
  const photoY = y + 2.5;
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

  // Text block (below photo)
  let textY = photoY + PHOTO_SIZE + 3.5;
  const textX = x + 2;
  const textW = w - 4;

  // Line 1: Local: category (small brown bold)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...BROWN);
  const catLine = `Local: ${card.category}`;
  doc.text(doc.splitTextToSize(catLine, textW)[0] || catLine, textX, textY);
  textY += 3.2;

  // Line 2: name — bold dark, single line truncated
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...(card.is_mockup ? BROWN : DARK));
  const mockupPrefix = card.is_mockup ? "[MOCKUP] " : "";
  const nameRaw = `${mockupPrefix}${card.is_new ? "[N] " : ""}${card.name || "—"}`;
  const nameLines = doc.splitTextToSize(nameRaw, textW);
  doc.text(nameLines.slice(0, 1), textX, textY);
  textY += 3.5;

  // Line 3: Cód | Qtd
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...DARK);
  const summary = `Cod: ${card.code || "—"}  |  Qtd: ${card.quantity}`;
  doc.text(summary, textX, textY);

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

  const usableTop = HEADER_TOTAL_HEIGHT + 4;
  const usableBottom = ph - PAGE_MARGIN_BOTTOM;
  const usableWidth = pw - PAGE_MARGIN_X * 2;
  const cardWidth = (usableWidth - CARD_GAP * (CARDS_PER_ROW - 1)) / CARDS_PER_ROW;
  const rowStride = CARD_HEIGHT + CARD_GAP;

  const TOTAL_BAR_HEIGHT = 12;

  let firstStore = true;

  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i];
    const { store, items, totalQuantity } = bucket;
    const headerInfo: StoreHeaderInfo = {
      agencyName,
      clientName,
      campaignName,
      storeName: store.name || "Loja",
      storeCode: store.store_code || "—",
      cityState: [store.city, store.state].filter(Boolean).join(", "),
    };

    if (!firstStore) doc.addPage();
    firstStore = false;

    drawStoreHeader(doc, headerInfo);

    let y = usableTop;
    let gridRowIdx = 0;

    for (let idx = 0; idx < items.length; idx++) {
      const colInRow = idx % CARDS_PER_ROW;

      // Page break check before starting a new row
      if (colInRow === 0) {
        const reserve = items.length - idx <= CARDS_PER_ROW ? rowStride + TOTAL_BAR_HEIGHT + 4 : rowStride;
        if (y + reserve > usableBottom) {
          doc.addPage();
          drawStoreHeader(doc, headerInfo);
          y = usableTop;
        }
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

      // After last column in row, advance Y
      if (colInRow === CARDS_PER_ROW - 1 || idx === items.length - 1) {
        y += rowStride;
        gridRowIdx += 1;
      }
    }

    // Total bar (always fits because we reserved space above; otherwise add page)
    if (y + TOTAL_BAR_HEIGHT > usableBottom) {
      doc.addPage();
      drawStoreHeader(doc, headerInfo);
      y = usableTop;
    }
    doc.setFillColor(...BROWN);
    doc.rect(PAGE_MARGIN_X, y, usableWidth, TOTAL_BAR_HEIGHT, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...WHITE);
    doc.text(`Total de pecas: ${totalQuantity}`, pw / 2, y + TOTAL_BAR_HEIGHT / 2 + 2.5, { align: "center" });
    doc.setTextColor(0, 0, 0);

    safeProgress(onProgress, i + 1, totalStores, store.name || "Loja");
  }

  // Footers on every page
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, campaignName, p, totalPages);
  }

  const suffix = rateioGridFileSuffix(mode);
  const filename = `${campaignName} — Rateio por Loja (${suffix}).pdf`;

  const blob = doc.output("blob");
  await saveBlobAs(blob, filename, {
    mimeType: PDF_MIME,
    description: "Documento PDF (.pdf)",
    extension: ".pdf",
  });
}
