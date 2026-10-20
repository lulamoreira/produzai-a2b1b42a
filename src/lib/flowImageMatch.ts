/** Liga linhas do Flow às peças já existentes da campanha (para reaplicar só imagens). */
export interface ExistingPieceRef {
  id: string;
  code: number;
  name: string;
  category: string | null;
  image_url: string | null;
  specification?: string | null;
}

const norm = (s: string | null | undefined) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

/** Só substitui imagem ausente ou criada pelo importador do Flow (nunca imagem enviada manualmente). */
export const canReplaceImage = (url: string | null) => !url || url.includes("/flow-piece-");

/**
 * Para cada linha, devolve a peça correspondente (ou null). Prioriza nome+localização,
 * depois só nome; nomes repetidos são consumidos em ordem de código, sem reutilizar peça.
 */
export function matchFlowRows(
  rows: Array<{ name: string; category: string }>,
  existing: ExistingPieceRef[],
): Array<ExistingPieceRef | null> {
  const pool = [...existing].sort((a, b) => a.code - b.code);
  const used = new Set<string>();
  return rows.map((row) => {
    const n = norm(row.name);
    const c = norm(row.category);
    const hit =
      pool.find((p) => !used.has(p.id) && norm(p.name) === n && norm(p.category) === c) ||
      pool.find((p) => !used.has(p.id) && norm(p.name) === n);
    if (!hit) return null;
    used.add(hit.id);
    return hit;
  });
}
