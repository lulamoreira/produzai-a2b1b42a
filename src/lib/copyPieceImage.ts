/**
 * Cópia de imagens de peças/kits dentro do bucket piece-images, feita no
 * servidor (storage.copy, sem download), para o item exportado ficar com
 * arquivos próprios e independentes da origem.
 *
 * Usado pelo "Exportar para campanha". O import entre campanhas tem a sua
 * própria função (copyImportedPhoto) e não usa este arquivo.
 */
import { supabase } from "@/integrations/supabase/client";

export const PIECE_IMAGES_BUCKET = "piece-images";
const PUBLIC_MARKERS = [
  `/object/public/${PIECE_IMAGES_BUCKET}/`,
  `/render/image/public/${PIECE_IMAGES_BUCKET}/`,
];

/** Caminho do arquivo dentro do bucket, ou null quando a URL não é do piece-images. */
export function pieceImagePathFromUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  for (const marker of PUBLIC_MARKERS) {
    const at = url.indexOf(marker);
    if (at < 0) continue;
    const raw = url.substring(at + marker.length).split("?")[0].split("#")[0];
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/** Extensão original do arquivo (com ponto, minúscula); ".jpg" quando não houver. */
export function imageExtension(path: string): string {
  const name = path.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return ".jpg";
  const ext = name.substring(dot).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : ".jpg";
}

/** Caminho novo e único: piece-export-<agora>-<idx>-<aleatório><ext>. */
export function buildExportImagePath(sourcePath: string, idx: number, now = Date.now(), random = Math.random().toString(36).slice(2, 8)): string {
  return `piece-export-${now}-${idx}-${random}${imageExtension(sourcePath)}`;
}

export type PieceImageCopyResult =
  | { status: "empty"; url: null }
  | { status: "copied"; url: string; path: string }
  /** Não copiada (falha ou URL de fora do bucket): mantém a URL original. */
  | { status: "shared"; url: string };

/** Copia uma imagem; nunca lança erro — em falha, devolve a URL original. */
export async function copyPieceImage(sourceUrl: string | null | undefined, idx: number): Promise<PieceImageCopyResult> {
  if (!sourceUrl) return { status: "empty", url: null };
  const fromPath = pieceImagePathFromUrl(sourceUrl);
  if (!fromPath) return { status: "shared", url: sourceUrl };
  const toPath = buildExportImagePath(fromPath, idx);
  try {
    const { error } = await supabase.storage.from(PIECE_IMAGES_BUCKET).copy(fromPath, toPath);
    if (error) {
      console.warn("Exportar para campanha: falha ao copiar imagem, mantendo a original.", error.message);
      return { status: "shared", url: sourceUrl };
    }
  } catch (e) {
    console.warn("Exportar para campanha: falha ao copiar imagem, mantendo a original.", e);
    return { status: "shared", url: sourceUrl };
  }
  const { data } = supabase.storage.from(PIECE_IMAGES_BUCKET).getPublicUrl(toPath);
  return { status: "copied", url: data.publicUrl, path: toPath };
}

/** Apaga arquivos copiados por esta operação (usado só no desfazer). */
export async function removeCopiedPieceImages(paths: string[]): Promise<string | null> {
  if (paths.length === 0) return null;
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(PIECE_IMAGES_BUCKET).remove(paths.slice(i, i + 100));
    if (error) return error.message;
  }
  return null;
}
