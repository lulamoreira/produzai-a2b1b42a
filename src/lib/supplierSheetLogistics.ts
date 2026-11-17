/**
 * Avisos e rótulo de logística das planilhas de fornecedor (puro, sem leitura/gravação).
 * `tipo_entrega` de cada loja deve chegar já como tipo EFETIVO da campanha.
 * Lojas desativadas na campanha ficam fora da contagem.
 */
import { normalizeDeliveryType, type DeliveryType } from "@/lib/deliveryType";

export interface LogisticsNoteLabels {
  onlyDeliveryNote: (n: number) => string;
  onlyInstallNote: (n: number) => string;
  noLogisticsNote: (n: number) => string;
  deliveryTypeLabels: Record<DeliveryType, string>;
}

type StoreWithType = { id: string; tipo_entrega?: string | null };

/** Um aviso por tipo que tenha lojas, na ordem Só frete → Só instalação → Sem logística. */
export function buildLogisticsNotes(
  stores: readonly StoreWithType[],
  disabledStoreIds: ReadonlySet<string> | undefined,
  labels: LogisticsNoteLabels,
): string[] {
  const count: Record<DeliveryType, number> = { frete_instalacao: 0, frete_apenas: 0, instalacao_apenas: 0, sem_logistica: 0 };
  for (const s of stores) {
    if (disabledStoreIds?.has(s.id)) continue;
    count[normalizeDeliveryType(s.tipo_entrega)] += 1;
  }
  const notes: string[] = [];
  if (count.frete_apenas > 0) notes.push(labels.onlyDeliveryNote(count.frete_apenas));
  if (count.instalacao_apenas > 0) notes.push(labels.onlyInstallNote(count.instalacao_apenas));
  if (count.sem_logistica > 0) notes.push(labels.noLogisticsNote(count.sem_logistica));
  return notes;
}

export const LOGISTICS_NOTE_SEPARATOR = " · ";

/** Rótulo do tipo efetivo da loja para a coluna "Tipo de Logística". */
export function deliveryTypeText(tipo: string | null | undefined, labels: Pick<LogisticsNoteLabels, "deliveryTypeLabels">): string {
  return labels.deliveryTypeLabels[normalizeDeliveryType(tipo)];
}
