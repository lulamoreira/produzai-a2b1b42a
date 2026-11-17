import { hasLogistics, normalizeDeliveryType, type DeliveryType } from "@/lib/deliveryType";

/**
 * A campaign schedule only becomes an installation the user can actually see
 * when it has BOTH a date and a time. When `reschedule_enabled` is on, the
 * reschedule pair is the one that counts — same rule the Installations screen
 * uses to build its store list.
 *
 * Rows without them (typically copied from a previous campaign) must never be
 * counted as stores, pendings, check-ins or confirmed schedules anywhere.
 */
export interface InstallationScheduleLike {
  reschedule_enabled?: boolean | null;
  reschedule_date?: string | null;
  reschedule_time?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
}

export function hasScheduledDateAndTime(s: InstallationScheduleLike): boolean {
  if (s.reschedule_enabled) {
    return !!(s.reschedule_date && s.reschedule_time);
  }
  return !!(s.scheduled_date && s.scheduled_time);
}

/**
 * A pending installation, as counted by the campaign status panel and the
 * Installations screen: not completed yet, store has logistics (missing
 * tipo_entrega means 'frete_instalacao') and the schedule has date AND time.
 */
export interface PendingInstallationLike extends InstallationScheduleLike {
  completed_at?: string | null;
  client_stores?: { tipo_entrega?: string | null } | null;
}

/**
 * `effectiveType` is the store's delivery type IN THIS CAMPAIGN (campaign
 * override ?? store default). When omitted, the store default is used.
 */
export function isVisiblePendingInstallation(s: PendingInstallationLike, effectiveType?: DeliveryType): boolean {
  if (s.completed_at) return false;
  const tipo = effectiveType ?? normalizeDeliveryType(s.client_stores?.tipo_entrega);
  if (!hasLogistics(tipo)) return false;
  return hasScheduledDateAndTime(s);
}

/**
 * Field-operation data only lives on the newest campaign of a renegotiation
 * chain. Mirrors get_latest_campaign_in_chain: group by COALESCE(root, id) and
 * keep the newest by created_at DESC, id DESC.
 */
export interface ChainCampaignLike {
  id: string;
  root_campaign_id?: string | null;
  created_at?: string | null;
}

export function latestCampaignIdsByChain(campaigns: ChainCampaignLike[]): Set<string> {
  const best = new Map<string, ChainCampaignLike>();
  for (const c of campaigns) {
    const root = c.root_campaign_id || c.id;
    const cur = best.get(root);
    const ca = c.created_at ?? "";
    const cb = cur?.created_at ?? "";
    // ISO timestamps from the same source compare correctly as strings.
    if (!cur || ca > cb || (ca === cb && c.id > cur.id)) best.set(root, c);
  }
  return new Set([...best.values()].map((c) => c.id));
}
