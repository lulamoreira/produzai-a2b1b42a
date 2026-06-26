import { supabase } from "@/integrations/supabase/client";

const SUPPLIER_FILES_BUCKET = "supplier_files";
const SIGNED_URL_TTL_SECONDS = 60 * 5;

export interface SupplierFileReference {
  name: string;
  url?: string | null;
  path?: string | null;
}

export function sanitizeSupplierFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function buildSupplierFilePath(agencyId: string, fileName: string): string {
  return `suppliers/${agencyId}/${Date.now()}-${sanitizeSupplierFileName(fileName)}`;
}

export function resolveSupplierFilePath(file: SupplierFileReference): string | null {
  if (file.path?.trim()) return file.path.trim();

  const rawUrl = file.url?.trim();
  if (!rawUrl) return null;

  if (rawUrl.startsWith("suppliers/")) return rawUrl;

  const bucketMarker = `/${SUPPLIER_FILES_BUCKET}/`;
  const markerIndex = rawUrl.indexOf(bucketMarker);
  if (markerIndex >= 0) {
    const path = rawUrl.slice(markerIndex + bucketMarker.length).split(/[?#]/)[0];
    try {
      return decodeURIComponent(path);
    } catch {
      return path;
    }
  }

  return null;
}

export async function openSupplierFile(file: SupplierFileReference): Promise<void> {
  const path = resolveSupplierFilePath(file);

  if (!path) {
    if (file.url) {
      window.open(file.url, "_blank", "noopener,noreferrer");
      return;
    }
    throw new Error("Arquivo sem caminho de armazenamento válido.");
  }

  const { data, error } = await supabase.storage
    .from(SUPPLIER_FILES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, {
      download: file.name || undefined,
    });

  if (error || !data?.signedUrl) {
    throw error || new Error("Não foi possível gerar o link seguro do arquivo.");
  }

  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export { SUPPLIER_FILES_BUCKET };