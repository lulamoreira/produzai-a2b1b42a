/**
 * Piece Image Variants
 * ====================
 * Generates 3 optimized 1:1 (square) variants of a piece image with white
 * letterbox background — preserving the piece's original aspect ratio without
 * cropping. Used by all reports/exports/listings to keep file sizes small,
 * proportions consistent, and downloads fast.
 *
 * Variants:
 *  - thumb  256 px @ q0.70  → lists, grids, tables
 *  - report 600 px @ q0.78  → Excel / PDF reports
 *  - full  1200 px @ q0.85  → detail / lightbox / zoom
 *
 * Also produces a SHA-256 hash of the original input bytes for storage-level
 * deduplication: if a piece with the same hash already exists, callers can
 * reuse its variant URLs instead of re-uploading the binaries.
 */

export type PieceImageVariant = "thumb" | "report" | "full";

export interface PieceImageVariantBlobs {
  thumb: Blob;
  report: Blob;
  full: Blob;
  hash: string;
}

interface VariantSpec {
  size: number;
  quality: number;
}

const SPECS: Record<PieceImageVariant, VariantSpec> = {
  thumb: { size: 256, quality: 0.7 },
  report: { size: 600, quality: 0.78 },
  full: { size: 1200, quality: 0.85 },
};

async function loadBitmapForVariants(file: Blob): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, dx: number, dy: number, dw: number, dh: number) => void;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image" as ImageOrientation,
      } as ImageBitmapOptions);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, dx, dy, dw, dh) => ctx.drawImage(bitmap, dx, dy, dw, dh),
        cleanup: () => bitmap.close?.(),
      };
    } catch {
      try {
        const bitmap = await createImageBitmap(file);
        return {
          width: bitmap.width,
          height: bitmap.height,
          draw: (ctx, dx, dy, dw, dh) => ctx.drawImage(bitmap, dx, dy, dw, dh),
          cleanup: () => bitmap.close?.(),
        };
      } catch {
        // fall through
      }
    }
  }

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  if (img.decode) {
    await img.decode();
  } else {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
    });
  }
  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    draw: (ctx, dx, dy, dw, dh) => ctx.drawImage(img, dx, dy, dw, dh),
    cleanup: () => URL.revokeObjectURL(url),
  };
}

/**
 * Render a single square variant: white background, image centered with
 * preserved aspect ratio (object-fit: contain).
 */
async function renderSquareVariant(
  source: Awaited<ReturnType<typeof loadBitmapForVariants>>,
  spec: VariantSpec,
): Promise<Blob> {
  const { width: srcW, height: srcH } = source;
  const target = spec.size;

  // Scale source to fit inside target square, preserving aspect ratio
  const scale = Math.min(target / srcW, target / srcH);
  const drawW = Math.max(1, Math.round(srcW * scale));
  const drawH = Math.max(1, Math.round(srcH * scale));
  const dx = Math.floor((target - drawW) / 2);
  const dy = Math.floor((target - drawH) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // White letterbox background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, target, target);

  // High-quality scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  source.draw(ctx, dx, dy, drawW, drawH);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", spec.quality);
  });
  if (!blob) throw new Error("Failed to encode variant blob");
  return blob;
}

/**
 * SHA-256 hex digest of the file bytes. Used as the dedup key.
 */
async function sha256Hex(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generates all 3 variants + content hash for a given image File/Blob.
 * Throws if the image cannot be decoded.
 */
export async function generatePieceImageVariants(file: File | Blob): Promise<PieceImageVariantBlobs> {
  const source = await loadBitmapForVariants(file);
  try {
    const [thumb, report, full, hash] = await Promise.all([
      renderSquareVariant(source, SPECS.thumb),
      renderSquareVariant(source, SPECS.report),
      renderSquareVariant(source, SPECS.full),
      sha256Hex(file),
    ]);
    return { thumb, report, full, hash };
  } finally {
    source.cleanup();
  }
}

/**
 * Picks the best available URL for a given context, falling back gracefully
 * to the legacy `image_url` field for pieces that haven't been re-processed.
 */
export function pickPieceImageUrl(
  piece: {
    image_url?: string | null;
    image_thumb_url?: string | null;
    image_report_url?: string | null;
    image_full_url?: string | null;
  } | null | undefined,
  variant: PieceImageVariant,
): string | null {
  if (!piece) return null;
  if (variant === "thumb") {
    return piece.image_thumb_url || piece.image_report_url || piece.image_url || piece.image_full_url || null;
  }
  if (variant === "report") {
    return piece.image_report_url || piece.image_full_url || piece.image_url || piece.image_thumb_url || null;
  }
  return piece.image_full_url || piece.image_url || piece.image_report_url || piece.image_thumb_url || null;
}
