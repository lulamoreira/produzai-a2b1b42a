import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { isVisiblePendingInstallation, type PendingInstallationLike } from "@/lib/installationSchedule";
import { effectiveDeliveryTypeFor } from "@/lib/deliveryType";
import { fetchDeliveryOverridesForCampaign } from "@/lib/deliveryOverridesFetch";

/**
 * Counts the pending installations of a campaign exactly like the campaign
 * status panel ("Pendentes"). Callers must pass the newest campaign of the
 * renegotiation chain, because schedules only live there.
 * Errors propagate so the UI never shows a silent zero.
 */
export async function fetchPendingInstallationsCount(fieldCampaignId: string): Promise<number> {
  const [overrides, rows] = await Promise.all([
    fetchDeliveryOverridesForCampaign(fieldCampaignId),
    supabasePaginate<PendingInstallationLike & { id: string; store_id: string }>((from, to) =>
    supabase
      .from("campaign_schedules")
      .select(
        "id, store_id, completed_at, scheduled_date, scheduled_time, reschedule_enabled, reschedule_date, reschedule_time, client_stores(tipo_entrega)",
        { count: "exact" },
      )
      .eq("campaign_id", fieldCampaignId)
      .is("completed_at", null)
      .order("id")
      .range(from, to) as any,
    ),
  ]);
  // Tipo efetivo nesta campanha (ajuste da campanha ?? padrão da loja).
  return rows.filter((r) =>
    isVisiblePendingInstallation(r, effectiveDeliveryTypeFor(r.store_id, r.client_stores?.tipo_entrega, overrides)),
  ).length;
}
