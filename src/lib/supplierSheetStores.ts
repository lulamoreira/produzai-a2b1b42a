/**
 * Lojas usadas na aba "Matriz Lojas x Peças" das planilhas de fornecedor
 * (planilha individual e planilha do vencedor).
 *
 * Por que existe: essas planilhas reliam client_stores só com nome/cidade/UF/código
 * e SUBSTITUÍAM a loja completa por essa projeção — por isso "MODELO DE LOJA" saía
 * vazio, "VITRINES" saía 0 e o aviso de lojas sem instalação sumia.
 *
 * Regra: parte SEMPRE da loja completa já carregada na tela, sobrepõe os campos
 * relidos do banco (mais recentes) e grava em `tipo_entrega` o tipo EFETIVO da
 * campanha (ajuste da campanha ?? padrão da loja). Mantém a ordem da lista de entrada.
 * Função pura: não lê nem grava nada.
 */
import { effectiveDeliveryType, type DeliveryOverrideMap, type DeliveryType } from "@/lib/deliveryType";

/** Colunas relidas de client_stores para a planilha (todas as que a matriz usa). */
export const SUPPLIER_SHEET_STORE_COLUMNS =
  "id, name, city, state, store_code, store_model, showcase_count, tipo_entrega";

export type SupplierSheetStoreInput = { id: string; name?: string | null; tipo_entrega?: string | null } & Record<string, unknown>;

export function mergeSupplierSheetStores<T extends SupplierSheetStoreInput>(
  stores: readonly T[],
  freshRows: readonly SupplierSheetStoreInput[],
  overrides?: DeliveryOverrideMap | null,
): Array<T & { tipo_entrega: DeliveryType }> {
  const fresh = new Map(freshRows.map((r) => [r.id, r]));
  return stores.map((store) => {
    const row = fresh.get(store.id);
    // Campos nulos relidos não apagam o que a tela já tinha (ex.: projeção parcial).
    const overlay: Record<string, unknown> = {};
    if (row) for (const [k, v] of Object.entries(row)) if (v !== null && v !== undefined) overlay[k] = v;
    const merged = { ...store, ...overlay } as T;
    return { ...merged, tipo_entrega: effectiveDeliveryType(merged as { id: string; tipo_entrega?: string | null }, overrides) };
  });
}
