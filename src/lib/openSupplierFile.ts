import { supabase } from "@/integrations/supabase/client";
import {
  resolveSupplierFilePath,
  SUPPLIER_FILES_BUCKET,
  type SupplierFileReference,
} from "@/lib/supplierFiles";

const SIGNED_URL_TTL_SECONDS = 60 * 5;

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
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw error || new Error("Não foi possível gerar o link seguro do arquivo.");
  }

  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}