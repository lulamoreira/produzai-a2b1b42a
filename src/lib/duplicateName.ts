import type { CampaignPiece, CampaignKit } from "@/hooks/useMultiClientData";

/** Normaliza um nome para comparação tolerante: trim, lowercase, espaços/acentos colapsados. */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\s+/g, " "); // colapsa espaços
}

export type DuplicateMatch =
  | { type: "piece"; id: string; code: number; name: string }
  | { type: "kit"; id: string; code: number; name: string }
  | null;

/**
 * Procura uma peça ou kit com o mesmo nome (normalizado) dentro da campanha.
 * Permite ignorar um id (caso de edição).
 */
export function findDuplicateName(
  name: string,
  pieces: CampaignPiece[],
  kits: CampaignKit[],
  options?: { ignorePieceId?: string; ignoreKitId?: string }
): DuplicateMatch {
  const target = normalizeName(name);
  if (!target) return null;

  const piece = pieces.find(
    (p) => p.id !== options?.ignorePieceId && normalizeName(p.name) === target,
  );
  if (piece) {
    return { type: "piece", id: piece.id, code: piece.code, name: piece.name };
  }

  const kit = kits.find(
    (k) => k.id !== options?.ignoreKitId && normalizeName(k.name) === target,
  );
  if (kit) {
    return { type: "kit", id: kit.id, code: kit.code, name: kit.name };
  }

  return null;
}

/** Mensagem padrão exibida ao usuário quando há duplicidade. */
export function duplicateNameMessage(match: NonNullable<DuplicateMatch>): string {
  const label = match.type === "kit" ? "kit" : "peça";
  return `Já existe um(a) ${label} com este nome (${match.name} — código ${match.code}). Escolha um nome diferente.`;
}
