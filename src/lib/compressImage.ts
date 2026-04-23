/**
 * Compresses an image file to a target max dimension and quality.
 * Returns a Blob ready for upload.
 *
 * Android-safe:
 * - Uses createImageBitmap when available (handles EXIF orientation + decoding off main thread)
 * - Falls back to HTMLImageElement with proper await img.decode()
 * - Caps canvas dimensions to avoid mobile GPU/canvas size limits
 * - Falls back to original file if canvas.toBlob fails (instead of throwing)
 */
const MAX_CANVAS_DIMENSION = 4096; // Safe across iOS Safari + Android Chrome

async function loadBitmap(file: File): Promise<{
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
    let { width, height } = source;
    if (!width || !height) {
      return file;
    }

    // Cap to maxDimension preserving aspect ratio (FIXED: was inverted before)
    const limit = Math.min(maxDimension, MAX_CANVAS_DIMENSION);
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
    if (!ctx) return file;

    // White background avoids black backgrounds when JPEG-encoding transparent PNGs
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
    source.draw(ctx, width, height);

    // Sanity check: sample a few pixels across the canvas. If they're ALL identical,
    // drawImage silently failed (common on iOS Safari + Android Chrome under memory
    // pressure when uploading many photos in a row) and we'd be uploading a solid
    // color block instead of the user's photo. Fall back to the original file.
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
      const unique = new Set(samples);
      if (unique.size === 1) {
        console.warn(
          "[compressImage] Canvas appears to be a solid color after drawImage — " +
            "likely a memory-pressure failure on mobile. Falling back to original.",
          { sample: samples[0], width, height }
        );
        return file;
      }
    } catch {
      // getImageData can throw on tainted canvases — safe to skip the check
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });

    if (!blob) {
      // toBlob can return null on Android with very large canvases — fall back to original
      return file;
    }

    // Sanity check: under iOS Safari / Android memory pressure, drawImage can fail
    // silently and the canvas keeps its initial fill color, producing a tiny solid-color
    // JPEG (typically <8KB for 1024px). When that happens, fall back to the original file
    // so the installer never sees red/green/white solid blocks instead of their photos.
    const expectedMinSize = Math.max(8 * 1024, Math.round((width * height) / 200));
    if (blob.size < expectedMinSize) {
      console.warn(
        "[compressImage] Suspicious tiny output blob — likely a solid-color canvas " +
          "from memory pressure. Falling back to original file.",
        { blobSize: blob.size, expectedMin: expectedMinSize, width, height }
      );
      return file;
    }
    return blob;
  } finally {
    source.cleanup();
  }
}
