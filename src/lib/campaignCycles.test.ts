import { describe, expect, it } from 'vitest';
import { suggestCycleYear, groupCycleFamilies, parseCycleYear } from './campaignCycles';
const family = { parent: { id: 'root', name: 'Natal 2026' }, children: [{ id: 'child', name: 'Natal 2026 — Renegociação' }] };
describe('reviewed campaign cycles', () => {
  it('suggests 2026 from the campaign name', () => expect(suggestCycleYear(family)).toBe(2026));
  it('uses 2027 in the name rather than its creation year', () => expect(suggestCycleYear({ parent: { id: 's', name: 'Summer Brasil 2027' }, children: [] })).toBe(2027));
  it('leaves campaigns without a year for manual review', () => expect(suggestCycleYear({ parent: { id: 'w', name: 'Wafer' }, children: [] })).toBeNull());
  it('does not guess when the chain contains conflicting years', () => expect(suggestCycleYear({ ...family, children: [{ id: 's', name: 'Summer 2027' }] })).toBeNull());
  it('keeps the entire chain in the reviewed folder', () => expect(groupCycleFamilies([family], [{ campaign_id: 'root', cycle_year: 2027 }])).toEqual([[2027, [family]]]));
  it('does not apply suggestions without confirmation', () => expect(groupCycleFamilies([family], [])).toEqual([[null, [family]]]));
  it('allows leaving a campaign unclassified', () => expect(parseCycleYear('')).toBeNull());
  it('rejects invalid cycle years', () => expect(() => parseCycleYear('1999')).toThrow());
});