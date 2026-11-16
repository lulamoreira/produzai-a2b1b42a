/**
 * "TÁ ERRADO" da Revisar Rateio — regras puras e SOMENTE LEITURA da janela de correção.
 * Não detectam nada, não alteram fingerprints e não gravam: só reorganizam o apontamento
 * já calculado e os dados já carregados (lojas, matriz, composição de kits).
 */
import { norm, type RateioFinding } from "@/lib/reviewRateio";
import { fpEspecifico } from "@/lib/rateioReviewJust";
import { findingConcernsStore, normalizeStoreKey } from "@/lib/storeFicha";
import { sourceQuantityPerStore, type MatrixKitLink } from "@/lib/matrixImportPrefill";

/** Motivo gravado pelo "TÁ CERTO" (justificativa "só este caso"). */
export const AUTO_CORRECT_REASON = "Conferido: está certo";

const KIT_GROUP_TYPES = new Set(["kit_incompleto", "kit_fora_proporcao", "peca_compartilhada"]);

/**
 * Identidade estável do apontamento durante a correção. Diferente do fingerprint:
 * - kits agrupados ignoram o conjunto de lojas (corrigir uma loja não "troca" o apontamento);
 * - vitrine ignora o subtipo (a loja continua com problema de vitrine).
 */
export function findingIdentity(f: RateioFinding): string {
  if (f.type === "vitrine_excesso") return `vitrine_excesso::LOJA:${norm(f.storeName)}`;
  if (KIT_GROUP_TYPES.has(f.type)) return `${f.type}::${f.itemId ?? norm(f.itemName)}`;
  return fpEspecifico(f);
}

/** Versão atual (após reanálise) do apontamento aberto; null quando deixou de existir entre os ativos. */
export function findCurrentFinding(original: RateioFinding, ativos: readonly RateioFinding[]): RateioFinding | null {
  const fp = fpEspecifico(original);
  const exact = ativos.find((a) => a.type === original.type && fpEspecifico(a) === fp);
  if (exact) return exact;
  const id = findingIdentity(original);
  return ativos.find((a) => a.type === original.type && findingIdentity(a) === id) ?? null;
}

export interface FixStoreRef {
  name: string;
  id?: string;
}

export interface FixStoreGroups {
  /** "Falta em lojas do mesmo modelo": Não têm (prováveis erradas) / Têm (recolhido). */
  split: boolean;
  primary: FixStoreRef[];
  secondary: FixStoreRef[];
}

function uniqueRefs(refs: FixStoreRef[], skip = new Set<string>()): FixStoreRef[] {
  const seen = new Set(skip);
  const out: FixStoreRef[] = [];
  for (const r of refs) {
    const key = normalizeStoreKey(r.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** Lojas relacionadas ao apontamento, sem repetição (por nome normalizado). */
export function relatedStores(f: RateioFinding): FixStoreGroups {
  if (f.storeName) return { split: false, primary: [{ name: f.storeName }], secondary: [] };
  const without: FixStoreRef[] = [
    ...(f.storesWithoutIds ?? []).map((s) => ({ name: s.name, id: s.id })),
    ...(f.storesWithout ?? []).map((name) => ({ name })),
  ];
  const withs: FixStoreRef[] = [
    ...(f.storesWithQty ?? []).map((s) => ({ name: s.name, id: s.id })),
    ...(f.storesWith ?? []).map((name) => ({ name })),
    ...(f.storesInfo ?? []).map((s) => ({ name: s.name })),
  ];
  if (f.type === "modelo_divergente") {
    const primary = uniqueRefs(without);
    const secondary = uniqueRefs(withs, new Set(primary.map((r) => normalizeStoreKey(r.name))));
    return { split: true, primary, secondary };
  }
  return { split: false, primary: uniqueRefs([...withs, ...without]), secondary: [] };
}

/** Quantidade atual do item na loja (peça = célula; kit = menor quociente, mesma regra do Rateio). */
export function itemQtyForStore(
  itemKind: "piece" | "kit" | undefined,
  itemId: string | undefined,
  storeId: string,
  qtyMap: Record<string, number>,
  kitPieces: readonly MatrixKitLink[],
): number | null {
  if (!itemKind || !itemId) return null;
  if (itemKind === "piece") return qtyMap[`${storeId}-${itemId}`] || 0;
  const links = (kitPieces ?? []).filter((l) => l.kit_id === itemId);
  const quantities = links.map((l) => ({ store_id: storeId, piece_id: l.piece_id, quantity: qtyMap[`${storeId}-${l.piece_id}`] || 0 }));
  return sourceQuantityPerStore("kit", itemId, links as MatrixKitLink[], quantities, [storeId]).get(storeId) ?? 0;
}

interface NamedStore { id: string; name?: string | null; nickname?: string | null }

/** A loja era afetada pelo apontamento original e deixou de ser (ou o apontamento sumiu). */
export function storeCorrected(original: RateioFinding, current: RateioFinding | null, store: NamedStore): boolean {
  if (!findingConcernsStore(original, store)) return false;
  return !current || !findingConcernsStore(current, store);
}
