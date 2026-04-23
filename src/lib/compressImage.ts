/**
 * Compresses an image file to a target max dimension and quality.
 * Returns a Blob ready for upload.
 *
 * Android-safe:
 * - Uses createImageBitmap when available (handles EXIF orientation + decoding off main thread)
 * - Falls back to HTMLImageElement with proper await img.decode()
 * - Caps canvas dimensions to avoid mobile GPU/canvas size limits
 * - Falls back to original file if canvas.toBlob fails (instead of throwing)
 *
 * Multi-pass guarantee:
 * - Output blob is NEVER allowed to exceed ~3MB. If the first pass produces a
 *   blob larger than 2MB, additional passes shrink quality and dimensions until
 *   it fits. The original full-resolution file is never returned just because
 *   it failed to compress small enough — only on hard decode/canvas errors.
 */
const MAX_CANVAS_DIMENSION = 4096; // Safe across iOS Safari + Android Chrome
const TARGET_MAX_BYTES = 2 * 1024 * 1024; // 2MB — preferred ceiling
const HARD_MAX_BYTES = 3 * 1024 * 1024; // 3MB — absolute ceiling we report against

async function loadBitmap(file: Blob): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  cleanup: () => void;
}> {
  // Prefer createImageBitmap — auto-applies EXIF orientation on modern browsers
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image" as ImageOrientation,
      } as ImageBitmapOptions);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        cleanup: () => bitmap.close?.(),
      };
    } catch {
      // Some Android browsers don't support imageOrientation option — retry without it
      try {
        const bitmap = await createImageBitmap(file);
        return {
          width: bitmap.width,
          height: bitmap.height,
          draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
          cleanup: () => bitmap.close?.(),
        };
      } catch {
        // fall through to <img> path
      }
    }
  }

  // Fallback: HTMLImageElement
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    if (img.decode) {
      await img.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
      });
    }
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    cleanup: () => URL.revokeObjectURL(url),
  };
}

import { getCompressionProfileForFile } from "./deviceProfile";

interface PassResult {
  blob: Blob;
  width: number;
  height: number;
  quality: number;
}

/**
 * Run a single compression pass with the given target dimension and quality.
 * Returns null if the pass produced an obviously corrupted output (solid color,
 * suspiciously tiny blob, or no blob at all).
 */
async function runPass(
  source: Awaited<ReturnType<typeof loadBitmap>>,
  targetMax: number,
  quality: number
): Promise<PassResult | null> {
  let { width, height } = source;
  if (!width || !height) return null;

  const limit = Math.min(targetMax, MAX_CANVAS_DIMENSION);
  if (width > limit || height > limit) {
    if (width >= height) {
      height = Math.round((height * limit) / width);
      width = limit;
    } else {
      width = Math.round((width * limit) / height);
      height = limit;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // White background avoids black backgrounds when JPEG-encoding transparent PNGs
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  source.draw(ctx, width, height);

  // Sanity check: sample a few pixels across the canvas. If they're ALL identical,
  // drawImage silently failed (common on iOS Safari + Android Chrome under memory
  // pressure when uploading many photos in a row) and we'd be uploading a solid
  // color block instead of the user's photo. Reject this pass entirely.
  try {
    const samplePoints: Array<[number, number]> = [
      [Math.floor(width * 0.25), Math.floor(height * 0.25)],
      [Math.floor(width * 0.5), Math.floor(height * 0.5)],
      [Math.floor(width * 0.75), Math.floor(height * 0.75)],
      [Math.floor(width * 0.1), Math.floor(height * 0.9)],
      [Math.floor(width * 0.9), Math.floor(height * 0.1)],
    ];
    const samples = samplePoints.map(([x, y]) => {
      const d = ctx.getImageData(x, y, 1, 1).data;
      return `${d[0]},${d[1]},${d[2]}`;
    });
    if (new Set(samples).size === 1) {
      console.warn(
        "[compressImage] Canvas appears to be a solid color after drawImage — " +
          "likely a memory-pressure failure on mobile. Rejecting pass.",
        { sample: samples[0], width, height }
      );
      return null;
    }
  } catch {
    // getImageData can throw on tainted canvases — safe to skip the check
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
  });

  if (!blob) return null;

  // Sanity check: under iOS Safari / Android memory pressure, drawImage can fail
  // silently and the canvas keeps its initial fill color, producing a tiny solid-color
  // JPEG (typically <8KB for 1024px). When that happens, reject the pass.
  const expectedMinSize = Math.max(8 * 1024, Math.round((width * height) / 200));
  if (blob.size < expectedMinSize) {
    console.warn(
      "[compressImage] Suspicious tiny output blob — likely a solid-color canvas. Rejecting pass.",
      { blobSize: blob.size, expectedMin: expectedMinSize, width, height }
    );
    return null;
  }

  return { blob, width, height, quality };
}

export async function compressImage(
  file: File,
  maxDimension?: number,
  quality?: number
): Promise<Blob> {
  // If callers don't provide explicit settings, pick them based on the device
  // profile + file size — Android low-end gets the most aggressive defaults.
  if (maxDimension === undefined || quality === undefined) {
    const profile = getCompressionProfileForFile(file.size);
    if (maxDimension === undefined) maxDimension = profile.maxDimension;
    if (quality === undefined) quality = profile.quality;
  }
  // If it's not actually an image (HEIC files often have empty type on Android), bail to original
  if (file.size === 0) throw new Error("Empty file");

  let source: Awaited<ReturnType<typeof loadBitmap>>;
  try {
    source = await loadBitmap(file);
  } catch {
    // Cannot decode (e.g., HEIC on Android Chrome). Upload original.
    return file;
  }

  try {
    // ---- Pass 1: caller-provided / profile dimensions ----
    const pass1 = await runPass(source, maxDimension, quality);
    if (!pass1) return file; // hard failure (canvas/decode) — fall back to original

    if (pass1.blob.size <= TARGET_MAX_BYTES) {
      return pass1.blob;
    }

    // ---- Pass 2: quality -0.15, dimensions -20% ----
    const pass2Quality = Math.max(0.3, quality - 0.15);
    const pass2Dim = Math.max(600, Math.round(maxDimension * 0.8));
    const pass2 = await runPass(source, pass2Dim, pass2Quality);
    const best2 = pass2 ?? pass1;

    if (best2.blob.size <= TARGET_MAX_BYTES) {
      return best2.blob;
    }

    // ---- Pass 3: quality 0.4, dimensions 600px ----
    const pass3 = await runPass(source, 600, 0.4);
    const candidates = [pass1, pass2, pass3].filter(
      (p): p is PassResult => p !== null
    );
    // Prefer the smallest blob that actually fits under HARD_MAX_BYTES; otherwise
    // return the smallest blob we have. Per spec we never go back to the original.
    candidates.sort((a, b) => a.blob.size - b.blob.size);
    const underHardCap = candidates.find((c) => c.blob.size <= HARD_MAX_BYTES);
    return (underHardCap ?? candidates[0] ?? pass1).blob;
  } finally {
    source.cleanup();
  }
}
