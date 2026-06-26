const SUPPLIER_FILES_BUCKET = "supplier_files";

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

export { SUPPLIER_FILES_BUCKET };