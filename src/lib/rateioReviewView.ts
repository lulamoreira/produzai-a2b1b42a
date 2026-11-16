/**
 * Revisar Rateio — regras puras de EXIBIÇÃO (somente leitura).
 * Não detectam nada novo e não gravam: só reorganizam os apontamentos já calculados
 * por reviewRateio() para a tela (quadro por vitrines, busca/filtros, motivos sugeridos).
 */
import type { RateioFinding, RateioFindingSeverity, RateioFindingType } from "@/lib/reviewRateio";
import { summarizeQuantities } from "@/lib/rateioFillMissing";

/** trim + minúsculas + sem acentos (busca tolerante). */
export const foldText = (value: unknown): string =>
  (value ?? "").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// ---------------------------------------------------------------------------
// 1) Quadro por nº de vitrines ("Falta em lojas do mesmo modelo")
// ---------------------------------------------------------------------------

/** Fração mínima de lojas do grupo que têm o item para apontar "provável erro". */
export const LIKELY_ERROR_SHARE = 0.8;

export type ShowcaseGroupFlag = "provavel_erro" | "sem_referencia" | null;

export interface ShowcaseGroup {
  showcase: number;
  /** Lojas do grupo que têm o item. */
  have: number;
  /** Quantidade mais comum entre as que têm (empate = menor); 0 se ninguém tem. */
  mode: number;
  /** Lojas do grupo que não têm o item. */
  notHave: number;
  flag: ShowcaseGroupFlag;
}

/**
 * Agrupa as lojas do apontamento pelo nº de vitrines (showcase_count).
 * Regra do dono: loja com 1 un. pode estar certa (a outra vitrine é outlet);
 * loja com 0 num grupo em que quase todas têm é provável erro.
 */
export function showcaseGroups(f: Pick<RateioFinding, "storesWithQty" | "storesWithoutIds">): ShowcaseGroup[] {
  const withQ = f.storesWithQty ?? [];
  const without = f.storesWithoutIds ?? [];
  if (withQ.length === 0 && without.length === 0) return [];
  const keys = new Set<number>();
  const sc = (v: unknown) => Number(v) || 0;
  withQ.forEach((s) => keys.add(sc(s.showcase)));
  without.forEach((s) => keys.add(sc(s.showcase)));
  return [...keys].sort((a, b) => a - b).map((showcase) => {
    const qtys = withQ.filter((s) => sc(s.showcase) === showcase).map((s) => s.qty);
    const have = qtys.length;
    const notHave = without.filter((s) => sc(s.showcase) === showcase).length;
    let flag: ShowcaseGroupFlag = null;
    if (have === 0) flag = "sem_referencia";
    else if (notHave > 0 && have / (have + notHave) >= LIKELY_ERROR_SHARE) flag = "provavel_erro";
    return { showcase, have, mode: summarizeQuantities(qtys).mode, notHave, flag };
  });
}

export const showcaseLabel = (n: number): string => `${n} ${n === 1 ? "vitrine" : "vitrines"}`;

// ---------------------------------------------------------------------------
// 4) Busca e filtros
// ---------------------------------------------------------------------------

export const ALL = "__all__" as const;

export interface FindingFilters {
  query: string;
  severity: RateioFindingSeverity | typeof ALL;
  type: RateioFindingType | typeof ALL;
}

export const EMPTY_FILTERS: FindingFilters = { query: "", severity: ALL, type: ALL };

export const hasActiveFilters = (f: FindingFilters): boolean =>
  f.query.trim() !== "" || f.severity !== ALL || f.type !== ALL;

/** Busca por nome do item, código do item ou nome de qualquer loja citada (sem acento/maiúscula). */
export function matchesFindingQuery(f: RateioFinding, query: string): boolean {
  const q = foldText(query);
  if (!q) return true;
  const haystack = [
    f.itemName,
    f.itemCode,
    f.storeName,
    ...(f.storesWith ?? []),
    ...(f.storesWithout ?? []),
  ];
  return haystack.some((v) => v !== undefined && v !== null && foldText(v).includes(q));
}

export function filterFindings<T>(list: readonly T[], filters: FindingFilters, pick: (item: T) => RateioFinding): T[] {
  return list.filter((item) => {
    const f = pick(item);
    if (filters.severity !== ALL && f.severity !== filters.severity) return false;
    if (filters.type !== ALL && f.type !== filters.type) return false;
    return matchesFindingQuery(f, filters.query);
  });
}

// ---------------------------------------------------------------------------
// 5) Motivos sugeridos para "Justificar"
// ---------------------------------------------------------------------------

export const DEFAULT_REASONS: readonly string[] = ["Outlet", "Sem capacidade de vitrine", "Era antiga"];

/**
 * Motivos mais usados pelo cliente (mais frequentes primeiro; empate = mais recente, depois A→Z).
 * Variações só de acento/maiúscula/espaço contam juntas e exibem a grafia mais usada.
 * Sem motivos salvos, devolve os padrões.
 */
export function topReasons(
  justs: readonly { motivo?: string | null; created_at?: string | null }[],
  limit = 8,
): string[] {
  const groups = new Map<string, { count: number; last: string; spellings: Map<string, number> }>();
  for (const j of justs) {
    const text = (j.motivo ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const key = foldText(text);
    const g = groups.get(key) ?? { count: 0, last: "", spellings: new Map<string, number>() };
    g.count += 1;
    const at = j.created_at ?? "";
    if (at > g.last) g.last = at;
    g.spellings.set(text, (g.spellings.get(text) ?? 0) + 1);
    groups.set(key, g);
  }
  if (groups.size === 0) return [...DEFAULT_REASONS];
  return [...groups.values()]
    .map((g) => {
      const label = [...g.spellings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))[0][0];
      return { label, count: g.count, last: g.last };
    })
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last) || a.label.localeCompare(b.label, "pt-BR"))
    .slice(0, limit)
    .map((r) => r.label);
}
