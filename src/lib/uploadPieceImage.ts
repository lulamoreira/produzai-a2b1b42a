/**
 * Uploads a piece image as 3 optimized variants (thumb/report/full) into the
 * `piece-images` bucket under a hash-based path so identical files dedupe to
 * the same URLs across pieces / campaigns.
 *
 * Path layout (immutable, cache-friendly):
 *   variants/{hash}/thumb.jpg
 *   variants/{hash}/report.jpg
 *   variants/{hash}/full.jpg
 *
 * Returns the 4 fields to persist on the piece row.
 */
import { supabase } from "@/integrations/supabase/client";
import { generatePieceImageVariants } from "@/lib/pieceImageVariants";

export interface UploadedPieceImage {
  image_thumb_url: string;
  image_report_url: string;
  image_full_url: string;
  image_hash: string;
  /** Mirrors image_full_url — kept for backwards compatibility with code that still reads `image_url`. */
  image_url: string;
}

const BUCKET = "piece-images";

async function uploadVariant(path: string, blob: Blob): Promise<string> {
  // Idempotent: hash-based path means the bytes are already what we want.
  // upsert:true keeps re-uploads safe, with a long-lived cache header.
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: "image/jpeg",
    cacheControl: "31536000, immutable",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Generate variants and upload them. Idempotent: identical input bytes
 * produce identical paths, so re-uploading the same image is a no-op
 * (and downstream pieces share the same URLs — no duplicated storage).
 */
export async function uploadPieceImageVariants(file: File | Blob): Promise<UploadedPieceImage> {
  const variants = await generatePieceImageVariants(file);
  const base = `variants/${variants.hash}`;

  const [thumbUrl, reportUrl, fullUrl] = await Promise.all([
    uploadVariant(`${base}/thumb.jpg`, variants.thumb),
    uploadVariant(`${base}/report.jpg`, variants.report),
    uploadVariant(`${base}/full.jpg`, variants.full),
  ]);

  return {
    image_thumb_url: thumbUrl,
    image_report_url: reportUrl,
    image_full_url: fullUrl,
    image_url: fullUrl,
    image_hash: variants.hash,
  };
}
