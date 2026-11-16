/**
 * Regras puras (somente leitura) da ficha de loja aberta pela janela "Revisar Rateio".
 * Não consulta o banco e não altera nada: só reorganiza dados já carregados.
 */
import { sourceQuantityPerStore, type MatrixKitLink } from "@/lib/matrixImportPrefill";
import { MAX_CUSTOM_FIELDS } from "@/lib/customFields";

/** trim + minúsculas + sem acentos. */
export const normalizeStoreKey = (value: unknown): string =>
  (value ?? "").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

interface NamedStore { id: string; name?: string | null; nickname?: string | null }

/**
 * Mapa nome normalizado → loja. As listas da revisão usam o apelido quando existe
 * (senão o nome), então os dois são indexados. Em nomes repetidos vale o primeiro.
 */
export function buildStoreLookup<T extends NamedStore>(stores: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const store of stores ?? []) {
    for (const label of [store.nickname, store.name]) {
      const key = normalizeStoreKey(label);
      if (key && !map.has(key)) map.set(key, store);
    }
  }
  return map;
}

export interface StoreFichaField { label: string; value: string }

const cleanLabel = (label: string) => label.split("|")[0]?.trim() || label;
const formatValue = (value: unknown): string => {
  const text = String(value).trim();
  const lower = text.toLowerCase();
  if (lower === "true") return "Sim";
  if (lower === "false") return "Não";
  return text;
};

/** Campos personalizados preenchidos, com o rótulo do cliente (cortado no "|"). Vazios são omitidos. */
export function storeCustomFields(
  store: Record<string, unknown>,
  customFieldLabels: readonly { index: number; label: string }[] = [],
): StoreFichaField[] {
  const labels = new Map(customFieldLabels.map((f) => [f.index, cleanLabel(f.label)]));
  const fields: StoreFichaField[] = [];
  for (let i = 1; i <= MAX_CUSTOM_FIELDS; i++) {
    const raw = store[`custom_field_${i}`];
    if (raw === null || raw === undefined || String(raw).trim() === "") continue;
    fields.push({ label: labels.get(i) || `Campo personalizado ${i}`, value: formatValue(raw) });
  }
  return fields;
}

export interface StoreCampaignItem {
  kind: "piece" | "kit";
  id: string;
  code: number | string | null;
  name: string;
  quantity: number;
}

interface ItemSource { id: string; code?: number | string | null; name?: string | null; kit_only?: boolean | null }

/**
 * Itens que a loja recebe nesta campanha. Peças avulsas (não exclusivas de kit) usam a
 * quantidade da matriz; kits usam a regra compartilhada de contagem (menor quociente
 * entre os componentes). Ordenado por código.
 */
export function storeCampaignItems(
  storeId: string,
  pieces: readonly ItemSource[],
  kits: readonly ItemSource[],
  kitPieces: readonly MatrixKitLink[],
  qtyMap: Record<string, number>,
): StoreCampaignItem[] {
  const items: StoreCampaignItem[] = [];
  for (const p of pieces ?? []) {
    if (p?.kit_only === true) continue;
    const quantity = qtyMap[`${storeId}-${p.id}`] || 0;
    if (quantity > 0) items.push({ kind: "piece", id: p.id, code: p.code ?? null, name: p.name ?? "", quantity });
  }
  if ((kits ?? []).length) {
    const prefix = `${storeId}-`;
    const storeQuantities = Object.entries(qtyMap)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, quantity]) => ({ store_id: storeId, piece_id: key.slice(prefix.length), quantity }));
    for (const k of kits) {
      const quantity = sourceQuantityPerStore("kit", k.id, kitPieces as MatrixKitLink[], storeQuantities, [storeId]).get(storeId) ?? 0;
      if (quantity > 0) items.push({ kind: "kit", id: k.id, code: k.code ?? null, name: k.name ?? "", quantity });
    }
  }
  const codeNum = (c: StoreCampaignItem["code"]) => {
    const n = Number(c);
    return Number.isFinite(n) && c !== null && c !== "" ? n : Number.POSITIVE_INFINITY;
  };
  return items.sort((a, b) => codeNum(a.code) - codeNum(b.code) || a.name.localeCompare(b.name, "pt-BR"));
}
