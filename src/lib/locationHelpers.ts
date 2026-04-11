import type { CampaignPieceLocation, CampaignPieceSubLocation } from "@/hooks/useMultiClientData";

/**
 * Format a location for display or export.
 * Returns { parent, sub, full } strings.
 */
export function formatLocationDisplay(
  category: string | null | undefined,
  subLocation: string | null | undefined,
): { parent: string; sub: string; full: string } {
  const parent = category || "";
  const sub = subLocation || "";
  const full = sub ? `${parent} / ${sub}` : parent;
  return { parent, sub, full };
}

/**
 * Build a hierarchical structure from flat location + sub-location arrays.
 */
export function buildLocationHierarchy(
  locations: CampaignPieceLocation[],
  subLocations: CampaignPieceSubLocation[],
) {
  return locations.map((loc) => ({
    ...loc,
    subs: subLocations
      .filter((s) => s.location_id === loc.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
