import { supabase } from "@/integrations/supabase/client";

const BUCKET = "budget-files";

/**
 * Upload a file blob to the budget-files bucket and return a 30-day signed
 * URL with a friendly download filename.
 */
export async function uploadAndSign(
  blob: Blob,
  fileName: string,
  tag: string,
  campaignId: string,
): Promise<{ name: string; url: string }> {
  const sanitize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.\-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  const safeFileName = sanitize(fileName) || `file_${Date.now()}.xlsx`;
  const safeTag = sanitize(tag) || "tag";
  const path = `${campaignId}/${safeTag}/${Date.now()}_${safeFileName}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
  });
  if (upErr) throw new Error(`Falha no upload de ${fileName}: ${upErr.message}`);
  const { data, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 30, { download: fileName });
  if (signErr || !data) throw new Error(`Falha ao gerar link de ${fileName}`);
  return { name: fileName, url: data.signedUrl };
}
