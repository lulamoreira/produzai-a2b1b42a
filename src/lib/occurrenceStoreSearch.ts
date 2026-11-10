/**
 * Busca por nome de loja na barra de ocorrências.
 *
 * Regra: o termo digitado é comparado com o nome da loja ignorando maiúsculas/
 * minúsculas e acentos, então "sao paulo" encontra "São Paulo" e "cinc" encontra
 * "Shopping Cinco". Um termo vazio não filtra nada.
 */

/** Normaliza texto para comparação: minúsculas, sem acentos, espaços colapsados. */
export function normalizeStoreSearchText(value?: string | null): string {
  return (value ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Diz se a ocorrência deve aparecer para o termo digitado.
 * O nome da loja vem do relacionamento client_stores do registro de ocorrência.
 */
export function matchesOccurrenceStoreName(
  occurrence: { client_stores?: { name?: string | null } | null } | null | undefined,
  term: string,
): boolean {
  const needle = normalizeStoreSearchText(term);
  if (!needle) return true;

  const storeName = normalizeStoreSearchText(occurrence?.client_stores?.name);
  if (!storeName) return false;

  return storeName.includes(needle);
}
