/**
 * Regras puras para edição manual de códigos de peças e kits.
 *
 * Peças (avulsas ou de kit) e kits compartilham a mesma numeração dentro de
 * uma campanha, então um código "bate" se qualquer peça ou kit ativo da mesma
 * campanha já o usa. O usuário é avisado e decide se mantém o número repetido.
 */

export type CodedItemKind = "piece" | "kit";

export interface CodedItem {
  id: string;
  code: number | null | undefined;
  name?: string | null;
  kit_only?: boolean | null;
  is_deleted?: boolean | null;
}

export interface CodeConflict {
  kind: CodedItemKind;
  id: string;
  code: number;
  name: string;
  /** true quando a peça é componente de kit (kit_only). */
  isKitPiece: boolean;
}

/** Maior valor aceito pela coluna integer do banco. */
export const MAX_ITEM_CODE = 2147483647;

/**
 * Converte o texto digitado em código válido (inteiro positivo).
 * Retorna null para vazio, decimais, negativos, zero ou valores fora da faixa.
 */
export function parseItemCode(raw: string | number | null | undefined): number | null {
  const text = String(raw ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_ITEM_CODE) return null;
  return value;
}

/** Lista peças e kits ativos que já usam o código, ignorando o próprio item em edição. */
export function findCodeConflicts(
  code: number,
  items: { pieces: CodedItem[]; kits: CodedItem[] },
  ignore?: { pieceId?: string; kitId?: string },
): CodeConflict[] {
  const conflicts: CodeConflict[] = [];
  for (const p of items.pieces) {
    if (p.is_deleted || p.id === ignore?.pieceId || Number(p.code) !== code) continue;
    conflicts.push({ kind: "piece", id: p.id, code, name: p.name?.trim() || "(sem nome)", isKitPiece: !!p.kit_only });
  }
  for (const k of items.kits) {
    if (k.is_deleted || k.id === ignore?.kitId || Number(k.code) !== code) continue;
    conflicts.push({ kind: "kit", id: k.id, code, name: k.name?.trim() || "(sem nome)", isKitPiece: false });
  }
  return conflicts;
}

/** Rótulo curto de um conflito: Peça de kit #41 “Nome”. */
export function describeCodeConflict(c: CodeConflict): string {
  const label = c.kind === "kit" ? "Kit" : c.isKitPiece ? "Peça de kit" : "Peça";
  return `${label} #${c.code} “${c.name}”`;
}

/** Frase única com todos os conflitos, para avisos inline e confirmação. */
export function describeCodeConflicts(conflicts: CodeConflict[]): string {
  if (conflicts.length === 0) return "";
  return `O código ${conflicts[0].code} já é usado por: ${conflicts.map(describeCodeConflict).join("; ")}.`;
}
