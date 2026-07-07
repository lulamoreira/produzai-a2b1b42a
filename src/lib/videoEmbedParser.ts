/**
 * Extract embed URL + thumbnail from a pasted YouTube / Vimeo / Google Drive URL.
 * Returns null for unrecognized URLs so the caller can fall back to file upload.
 */
export interface VideoEmbedInfo {
  provider: "youtube" | "vimeo" | "drive";
  id: string;
  embedUrl: string;
  thumbnailUrl: string;
  originalUrl: string;
}

export function parseVideoEmbed(url: string): VideoEmbedInfo | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // YouTube: youtu.be/ID or youtube.com/watch?v=ID or /embed/ID or /shorts/ID
  const ytRegex =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
  const ytMatch = trimmed.match(ytRegex);
  if (ytMatch) {
    const id = ytMatch[1];
    return {
      provider: "youtube",
      id,
      embedUrl: `https://www.youtube.com/embed/${id}`,
      thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      originalUrl: trimmed,
    };
  }

  // Vimeo: vimeo.com/ID or player.vimeo.com/video/ID
  const vmRegex = /vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)/;
  const vmMatch = trimmed.match(vmRegex);
  if (vmMatch) {
    const id = vmMatch[1];
    return {
      provider: "vimeo",
      id,
      embedUrl: `https://player.vimeo.com/video/${id}`,
      thumbnailUrl: `https://vumbnail.com/${id}.jpg`,
      originalUrl: trimmed,
    };
  }

  // Google Drive: drive.google.com/file/d/ID/... or open?id=ID
  const gdRegex = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([A-Za-z0-9_-]+)/;
  const gdMatch = trimmed.match(gdRegex);
  if (gdMatch) {
    const id = gdMatch[1];
    return {
      provider: "drive",
      id,
      embedUrl: `https://drive.google.com/file/d/${id}/preview`,
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w400`,
      originalUrl: trimmed,
    };
  }

  return null;
}
