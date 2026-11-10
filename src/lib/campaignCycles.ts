export interface CycleCampaign { id: string; name: string; }
export interface CycleFamily { parent: CycleCampaign; children: CycleCampaign[]; }
export interface CycleAssignment { campaign_id: string; cycle_year: number | null; }

/** Creation dates deliberately do not determine a commercial cycle. */
export function suggestCycleYear(family: CycleFamily): number | null {
  const years = new Set([family.parent, ...family.children].flatMap(c =>
    (c.name.match(/\b20\d{2}\b/g) ?? []).map(Number)));
  return years.size === 1 ? [...years][0] : null;
}

export function parseCycleYear(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^20\d{2}$|^21\d{2}$/.test(value)) throw new Error('Informe um ano entre 2000 e 2199.');
  return Number(value);
}

export function groupCycleFamilies<T extends CycleFamily>(families: T[], assignments: CycleAssignment[]) {
  const years = new Map(assignments.map(a => [a.campaign_id, a.cycle_year]));
  const groups = new Map<number | null, T[]>();
  for (const family of families) {
    const year = years.get(family.parent.id) ?? null;
    groups.set(year, [...(groups.get(year) ?? []), family]);
  }
  return [...groups].sort(([a], [b]) => a === null ? -1 : b === null ? 1 : b - a);
}