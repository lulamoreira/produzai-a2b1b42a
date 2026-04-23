/**
 * Returns a thumbnail-sized URL for Supabase Storage public images using
 * Supabase image transformations. For non-Supabase URLs, returns the URL as-is.
 *
 * Resilient to URLs that already contain query strings.
 */
export function getThumbnailUrl(
  url: string | null | undefined,
  width = 200,
  quality = 70,
): string {
  if (!url) return "";
  if (!url.includes("/storage/v1/object/public/")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}width=${width}&quality=${quality}`;
}
