/**
 * Helpers for "equipe de apoio" (support / wildcard teams).
 *
 * A support team is a regular installation team flagged with a coverage scope:
 *  - 'none'  → not a support team
 *  - 'all'   → present in every store of the campaign
 *  - 'city'  → present in the stores whose city is listed in coverage_values
 *  - 'state' → present in the stores whose state (UF) is listed in coverage_values
 *
 * Support presence is ALWAYS additive: it never replaces the team assigned to the store.
 */

export type CoverageScope = "none" | "all" | "city" | "state";

export interface CoverageTeamLike {
  id: string;
  name: string;
  coverage_scope?: CoverageScope | string | null;
  coverage_values?: string[] | null;
}

export interface CoverageStoreLike {
  city?: string | null;
  state?: string | null;
}

/** Trim, strip accents and lowercase so "São Paulo " === "sao paulo". */
export function normalizeCoverageValue(value?: string | null): string {
  return (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getCoverageScope(team: CoverageTeamLike): CoverageScope {
  const scope = (team.coverage_scope ?? "none") as CoverageScope;
  return scope === "all" || scope === "city" || scope === "state" ? scope : "none";
}

/**
 * Returns the human readable coverage reason when the team covers the store,
 * or null when it does not cover it.
 */
export function getCoverageMatch(team: CoverageTeamLike, store: CoverageStoreLike): string | null {
  const scope = getCoverageScope(team);
  if (scope === "none") return null;
  if (scope === "all") return "Todas as lojas";

  const values = (team.coverage_values ?? []).map(normalizeCoverageValue).filter(Boolean);
  if (values.length === 0) return null;

  if (scope === "city") {
    const city = normalizeCoverageValue(store.city);
    if (city && values.includes(city)) return `Cidade: ${(store.city ?? "").trim()}`;
    return null;
  }

  const state = normalizeCoverageValue(store.state);
  if (state && values.includes(state)) return `UF: ${(store.state ?? "").trim()}`;
  return null;
}

/** Short badge label for the teams list. */
export function getCoverageBadgeLabel(team: CoverageTeamLike): string | null {
  const scope = getCoverageScope(team);
  if (scope === "none") return null;
  if (scope === "all") return "APOIO: Todas as lojas";

  const values = (team.coverage_values ?? []).filter(Boolean);
  if (values.length === 0) return "APOIO: sem seleção";

  if (scope === "state") return `APOIO: ${values.join(", ")}`;
  return `APOIO: ${values.length} ${values.length === 1 ? "cidade" : "cidades"}`;
}
