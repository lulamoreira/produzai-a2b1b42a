/**
 * Notas das lojas (client_stores.observations) na "Revisar Rateio" — regras puras e
 * SOMENTE LEITURA. Não consultam o banco e não gravam: só reorganizam as lojas já
 * carregadas pela matriz. Não entram em detecção, fingerprints nem justificativas.
 */
import type { RateioFinding } from "@/lib/reviewRateio";
import { normalizeStoreKey } from "@/lib/storeFicha";
import { findingStoreNames } from "@/lib/storeNameLinks";
import { foldText } from "@/lib/rateioReviewView";

interface NotedStore {
  id: string;
  name?: string | null;
  nickname?: string | null;
  observations?: string | null;
  store_model?: string | null;
  era?: string | null;
  showcase_count?: number | string | null;
}

/** Texto da nota (sem espaços nas pontas) ou null quando vazia/ausente. */
export function storeNote(store: Pick<NotedStore, "observations"> | null | undefined): string | null {
  const text = (store?.observations ?? "").toString().trim();
  return text ? text : null;
}

/** Nome como a revisão cita a loja: apelido quando existe, senão o nome (mesma regra de reviewRateio). */
export const storeLabel = (store: Pick<NotedStore, "name" | "nickname">): string =>
  (store.nickname || store.name || "").toString();

export interface StoreNoteRow<T extends NotedStore = NotedStore> {
  store: T;
  /** Nome exibido e usado na busca (apelido ou nome). */
  label: string;
  note: string;
  /** "Modelo X · Era Y · N vitrines" (só partes preenchidas). */
  meta: string;
}

const vitrines = (n: number) => `${n} ${n === 1 ? "vitrine" : "vitrines"}`;

/** Resumo curto modelo/era/vitrines; partes vazias são omitidas. */
export function storeMeta(store: NotedStore): string {
  const parts: string[] = [];
  if (store.store_model && String(store.store_model).trim()) parts.push(`Modelo ${String(store.store_model).trim()}`);
  if (store.era && String(store.era).trim()) parts.push(`Era ${String(store.era).trim()}`);
  const sc = Number(store.showcase_count);
  if (store.showcase_count !== null && store.showcase_count !== undefined && String(store.showcase_count).trim() !== "" && Number.isFinite(sc)) {
    parts.push(vitrines(sc));
  }
  return parts.join(" · ");
}

/** Lojas com nota preenchida, em ordem alfabética (pt-BR, sem diferenciar maiúsculas/acentos). */
export function buildStoreNotes<T extends NotedStore>(stores: readonly T[]): StoreNoteRow<T>[] {
  const rows: StoreNoteRow<T>[] = [];
  for (const store of stores ?? []) {
    const note = storeNote(store);
    if (!note) continue;
    rows.push({ store, label: storeLabel(store), note, meta: storeMeta(store) });
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));
}

/** A busca da revisão também filtra as notas: por nome, apelido ou texto da nota. */
export function filterStoreNotes<T extends NotedStore>(rows: readonly StoreNoteRow<T>[], query: string): StoreNoteRow<T>[] {
  const q = foldText(query);
  if (!q) return [...rows];
  return rows.filter((r) => [r.label, r.store.name, r.store.nickname, r.note].some((v) => !!v && foldText(v).includes(q)));
}

// Índice id → loja por lookup (o lookup é recriado quando as lojas mudam).
const idIndexCache = new WeakMap<Map<string, NotedStore>, Map<string, NotedStore>>();
function idIndex<T extends NotedStore>(lookup: Map<string, T>): Map<string, T> {
  let idx = idIndexCache.get(lookup) as Map<string, T> | undefined;
  if (!idx) {
    idx = new Map();
    for (const s of lookup.values()) if (s?.id && !idx.has(s.id)) idx.set(s.id, s);
    idIndexCache.set(lookup, idx);
  }
  return idx;
}

/** Casa a loja pelo id quando houver; senão pelo nome normalizado (nome ou apelido). */
export function resolveStore<T extends NotedStore>(lookup: Map<string, T>, ref: { id?: string | null; name?: string | null }): T | null {
  if (ref.id) {
    const byId = idIndex(lookup).get(ref.id);
    if (byId) return byId;
  }
  return ref.name ? lookup.get(normalizeStoreKey(ref.name)) ?? null : null;
}

/** Nota da loja citada num apontamento de uma loja só (storeName); null nos demais. */
export function findingStoreNote<T extends NotedStore>(f: Pick<RateioFinding, "storeName">, lookup: Map<string, T>): string | null {
  if (!f.storeName) return null;
  return storeNote(resolveStore(lookup, { name: f.storeName }));
}

/**
 * Quantos apontamentos (da lista dada) citam cada loja, em qualquer lista do apontamento.
 * Cada apontamento conta no máximo uma vez por loja. Chave: id da loja.
 */
export function findingCountsByStore<T extends NotedStore>(findings: readonly RateioFinding[], lookup: Map<string, T>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const f of findings) {
    const ids = new Set<string>();
    for (const name of findingStoreNames(f)) {
      const s = lookup.get(normalizeStoreKey(name));
      if (s?.id) ids.add(s.id);
    }
    for (const id of f.storesWithQty ?? []) if (id.id) ids.add(id.id);
    for (const id of f.storesWithoutIds ?? []) if (id.id) ids.add(id.id);
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}
