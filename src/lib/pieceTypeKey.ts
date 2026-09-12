/**
 * Chave de "tipo" de peça, usada para reaproveitar especificações entre campanhas
 * do mesmo cliente ignorando marca, campanha e ano.
 *
 * Regra: a partir do token de localização (VIT, INT, TDS...) até o final do código,
 * removendo o token de medida final ("340x5cm", "35,5x37,63cm").
 * Sem token de localização, usa o código inteiro (menos a medida).
 */

/** Tokens que marcam o início da parte "de tipo" do código. */
const LOCATION_TOKENS = new Set([
  "VIT",
  "VITRINE",
  "VITRINA",
  "INT",
  "INTERNO",
  "INTERIOR",
  "TDS",
  "TODAS",
  "EXT",
  "EXTERNO",
  "STD",
  "STANDARD",
  "PDV",
  "CX",
  "CAIXA",
]);

/** Medida no final do código: "340x5cm", "35,5x37,63cm", "21X29,7". */
const SIZE_TOKEN_RE = /^\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:cm)?$/i;

/** Remove acentos e normaliza para MAIÚSCULO. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/**
 * Gera a chave de tipo de uma peça. Retorna string vazia quando o nome não
 * produz nenhuma chave utilizável (evita casamentos de baixa confiança).
 */
export function pieceTypeKey(rawName: string): string {
  if (!rawName) return "";
  const normalized = normalize(rawName);
  // Divide por separadores comuns preservando a ordem dos tokens.
  const tokens = normalized.split(/[_\s]+/).filter(Boolean);
  if (tokens.length === 0) return "";

  // Remove a medida final, se houver.
  while (tokens.length > 0 && SIZE_TOKEN_RE.test(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  if (tokens.length === 0) return "";

  const start = tokens.findIndex((token) => LOCATION_TOKENS.has(token));
  const relevant = start >= 0 ? tokens.slice(start) : tokens;
  if (relevant.length === 0) return "";
  return relevant.join("_");
}
