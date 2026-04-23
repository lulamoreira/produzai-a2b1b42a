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

export async function compressImage(
  file: File,
  maxDimension = 1200,
  quality = 0.7
): Promise<Blob> {
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

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });

    if (!blob) {
      // toBlob can return null on Android with very large canvases — fall back to original
      return file;
    }
    return blob;
  } finally {
    source.cleanup();
  }
}
