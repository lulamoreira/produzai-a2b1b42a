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

export type UploadPhase = "preparing" | "uploading" | "signing" | "retrying" | "done";

export interface UploadStatus {
  phase: UploadPhase;
  message: string;
  /** 0-100 indicative progress */
  progress: number;
  attempt: number;
  fileName: string;
}

export type UploadStatusCallback = (s: UploadStatus) => void;

/**
 * Upload a file blob to the budget-files bucket and return a 30-day signed
 * URL with a friendly download filename.
 *
 * Robust to transient "Failed to fetch" errors: retries up to 4 times with
 * exponential backoff. Optionally reports progress via onStatus callback.
 */
export async function uploadAndSign(
  blob: Blob,
  fileName: string,
  tag: string,
  campaignId: string,
  onStatus?: UploadStatusCallback,
): Promise<{ name: string; url: string }> {
  const safeFileName = sanitize(fileName) || `file_${Date.now()}.xlsx`;
  const safeTag = sanitize(tag) || "tag";
  const sizeMb = blob.size / (1024 * 1024);

  const emit = (s: Omit<UploadStatus, "fileName">) =>
    onStatus?.({ ...s, fileName });

  emit({ phase: "preparing", message: `Preparando ${fileName} (${sizeMb.toFixed(1)} MB)...`, progress: 5, attempt: 0 });

  if (sizeMb > 50) {
    throw new Error(
      `O arquivo ${fileName} tem ${sizeMb.toFixed(1)} MB e excede o limite de 50 MB para upload. Reduza o tamanho e tente novamente.`,
    );
  }

  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const path = `${campaignId}/${safeTag}/${Date.now()}_${attempt}_${safeFileName}`;
    try {
      emit({
        phase: "uploading",
        message:
          attempt === 1
            ? `Enviando ${fileName}...`
            : `Reenviando ${fileName} (tentativa ${attempt}/${MAX_ATTEMPTS})...`,
        progress: 15 + (attempt - 1) * 5,
        attempt,
      });

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { upsert: true, contentType: blob.type || "application/octet-stream" });

      if (upErr) {
        lastErr = upErr;
        if (attempt < MAX_ATTEMPTS && isTransient(upErr)) {
          emit({
            phase: "retrying",
            message: `Falha temporária no envio. Tentando novamente em alguns segundos...`,
            progress: 25,
            attempt,
          });
          await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
          continue;
        }
        throw new Error(`Falha no upload de ${fileName}: ${upErr.message}`);
      }

      emit({
        phase: "signing",
        message: `Gerando link assinado para ${fileName}...`,
        progress: 80,
        attempt,
      });

      const { data, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 30, { download: fileName });

      if (signErr || !data) {
        lastErr = signErr;
        if (attempt < MAX_ATTEMPTS && isTransient(signErr)) {
          emit({
            phase: "retrying",
            message: `Falha ao gerar link. Tentando novamente...`,
            progress: 70,
            attempt,
          });
          await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
          continue;
        }
        throw new Error(`Falha ao gerar link de ${fileName}: ${signErr?.message ?? "erro desconhecido"}`);
      }

      emit({ phase: "done", message: `Planilha pronta: ${fileName}.`, progress: 100, attempt });
      return { name: fileName, url: data.signedUrl };
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS && isTransient(err)) {
        console.warn(
          `[uploadAndSign] tentativa ${attempt}/${MAX_ATTEMPTS} falhou para "${fileName}" (${sizeMb.toFixed(1)} MB):`,
          err,
        );
        emit({
          phase: "retrying",
          message: `Falha de rede. Tentando novamente (${attempt + 1}/${MAX_ATTEMPTS})...`,
          progress: 25,
          attempt,
        });
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      const baseMsg = (err as { message?: string })?.message ?? "Erro desconhecido";
      if (isTransient(err)) {
        throw new Error(
          `Falha de rede ao enviar ${fileName} após ${MAX_ATTEMPTS} tentativas. Verifique sua conexão e tente novamente.`,
        );
      }
      throw err instanceof Error ? err : new Error(baseMsg);
    }
  }

  throw new Error(
    `Não foi possível enviar ${fileName}. Último erro: ${(lastErr as { message?: string })?.message ?? "desconhecido"}`,
  );
}
