/**
 * Regras puras da alteração de status de ocorrências em lote (Loja a Loja).
 * A permissão real é revalidada no servidor (bulk_update_occurrence_status);
 * aqui fica apenas a regra usada para exibir ou ocultar a seleção na tela.
 */
export type BulkStatusRole = "admin" | "master" | "viewer" | string | null | undefined;

/** Somente administradores e masters podem alterar status em lote. */
export function canBulkChangeOccurrenceStatus(role: BulkStatusRole): boolean {
  return role === "admin" || role === "master";
}

/** Mantém só os ids selecionados que ainda estão visíveis na lista filtrada. */
export function visibleSelection(selected: ReadonlySet<string>, visibleIds: readonly string[]): string[] {
  return visibleIds.filter((id) => selected.has(id));
}

/** Estado do checkbox "selecionar todas" a partir da seleção visível. */
export function headerCheckState(selectedVisible: number, totalVisible: number): boolean | "indeterminate" {
  if (totalVisible === 0 || selectedVisible === 0) return false;
  if (selectedVisible >= totalVisible) return true;
  return "indeterminate";
}

/** Quantidade de lojas distintas entre as ocorrências selecionadas. */
export function countDistinctStores(occurrences: readonly { id: string; store_id: string | null }[], selectedIds: readonly string[]): number {
  const ids = new Set(selectedIds);
  const stores = new Set<string>();
  for (const o of occurrences) if (ids.has(o.id) && o.store_id) stores.add(o.store_id);
  return stores.size;
}
