import { supabase } from "@/integrations/supabase/client";

const BUCKET = "budget-files";
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const sanitize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

/** Detects "Failed to fetch" / network-level errors that are worth retrying. */
function isTransient(err: unknown): boolean {
  const msg = (err as { message?: string })?.message?.toLowerCase() ?? "";
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network error") ||
    msg.includes("load failed") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("fetch") ||
    err instanceof TypeError
  );
}

/**
 * Upload a file blob to the budget-files bucket and return a 30-day signed
 * URL with a friendly download filename.
 *
 * Robust to transient "Failed to fetch" errors: retries up to 4 times with
 * exponential backoff. Surfaces a clear, actionable error message when it
 * ultimately fails so the user knows what to do.
 */
export async function uploadAndSign(
  blob: Blob,
  fileName: string,
  tag: string,
  campaignId: string,
): Promise<{ name: string; url: string }> {
  const safeFileName = sanitize(fileName) || `file_${Date.now()}.xlsx`;
  const safeTag = sanitize(tag) || "tag";
  const sizeMb = blob.size / (1024 * 1024);

  // Storage default per-file limit on the project tier — bail out early with
  // a clear message instead of waiting for a generic network failure.
  if (sizeMb > 50) {
    throw new Error(
      `O arquivo ${fileName} tem ${sizeMb.toFixed(1)} MB e excede o limite de 50 MB para upload. Reduza o tamanho e tente novamente.`,
    );
  }

  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // New unique path on every attempt to avoid cache/conflict edge cases.
    const path = `${campaignId}/${safeTag}/${Date.now()}_${attempt}_${safeFileName}`;
    try {
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { upsert: true, contentType: blob.type || "application/octet-stream" });

      if (upErr) {
        lastErr = upErr;
        if (attempt < MAX_ATTEMPTS && isTransient(upErr)) {
          await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
          continue;
        }
        throw new Error(`Falha no upload de ${fileName}: ${upErr.message}`);
      }

      const { data, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 30, { download: fileName });

      if (signErr || !data) {
        lastErr = signErr;
        if (attempt < MAX_ATTEMPTS && isTransient(signErr)) {
          await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
          continue;
        }
        throw new Error(`Falha ao gerar link de ${fileName}: ${signErr?.message ?? "erro desconhecido"}`);
      }

      return { name: fileName, url: data.signedUrl };
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS && isTransient(err)) {
        console.warn(
          `[uploadAndSign] tentativa ${attempt}/${MAX_ATTEMPTS} falhou para "${fileName}" (${sizeMb.toFixed(1)} MB):`,
          err,
        );
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      // Non-transient or out of attempts — re-throw with friendly message.
      const baseMsg = (err as { message?: string })?.message ?? "Erro desconhecido";
      if (isTransient(err)) {
        throw new Error(
          `Falha de rede ao enviar ${fileName} após ${MAX_ATTEMPTS} tentativas. Verifique sua conexão e tente novamente.`,
        );
      }
      throw err instanceof Error ? err : new Error(baseMsg);
    }
  }

  // Defensive fallback (shouldn't reach here).
  throw new Error(
    `Não foi possível enviar ${fileName}. Último erro: ${(lastErr as { message?: string })?.message ?? "desconhecido"}`,
  );
}
