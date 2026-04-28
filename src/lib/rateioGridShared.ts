import type { CampaignPiece, CampaignKit, CampaignKitPiece, ClientStore } from "@/hooks/useMultiClientData";

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
