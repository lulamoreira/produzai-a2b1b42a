import JSZip from "jszip";

function sanitize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 50);
}

export async function downloadPhotosAsZip(
  photos: { photo_url: string; category?: string; created_at?: string }[],
  options: {
    module: string;
    campaignName: string;
    storeName: string;
  }
) {
  if (photos.length === 0) return;

  const zip = new JSZip();
  const fileName = `${sanitize(options.module)}_${sanitize(options.campaignName)}_${sanitize(options.storeName)}`;

  const fetchPromises = photos.map(async (photo, i) => {
    try {
      const response = await fetch(photo.photo_url);
      if (!response.ok) return;
      const blob = await response.blob();
      const ext = photo.photo_url.match(/\.(jpg|jpeg|png|webp|gif)/i)?.[1] || "jpg";
      const cat = photo.category || "foto";
      const name = `${cat}_${String(i + 1).padStart(3, "0")}.${ext}`;
      zip.file(name, blob);
    } catch {
      console.warn("Failed to fetch photo:", photo.photo_url);
    }
  });

  await Promise.all(fetchPromises);

  const content = await zip.generateAsync({ type: "blob" });

  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
