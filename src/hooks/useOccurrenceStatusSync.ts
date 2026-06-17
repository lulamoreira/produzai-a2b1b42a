import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { computeStoreOccurrenceStatus } from "@/lib/occurrenceHelpers";

/**
 * Per-store occurrence status for the active campaign, sourced from the
 * "Loja a Loja" module (store_occurrence_reports). An occurrence is
 * considered resolved when resolved_at IS NOT NULL (canonical marker set
 * by the set_occurrence_resolved_at trigger via lal_tratativa_statuses).
 *
 * Returns the same shape consumers already use:
 *   storeOccurrenceStatus[storeId] = { hasOccurrence, allResolved, count }
 *
 * `count` reflects only OPEN (unresolved) occurrences, which is what the
 * UI badges on the Installations module need to display.
 */
export function useOccurrenceStatusSync(campaignId?: string) {
  const queryClient = useQueryClient();

  const { data: campaignOccurrences = [] } = useQuery({
    queryKey: ["store_occ_status_sync", campaignId],
    queryFn: async () => {
      const rows = await supabasePaginate<{
        id: string;
        store_id: string | null;
        resolved_at: string | null;
      }>((from, to) =>
        supabase
          .from("store_occurrence_reports")
          .select("id, store_id, resolved_at")
          .eq("campaign_id", campaignId!)
          .is("resolved_at", null)
          .range(from, to) as any
      );
      // Map to the shape expected by computeStoreOccurrenceStatus.
      return rows.map((r) => ({ store_id: r.store_id, status: "pending" }));
    },
    enabled: !!campaignId,
  });

  useEffect(() => {
    if (!campaignId) return;
    const channel = supabase
      .channel(`store_occ_status_sync_${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "store_occurrence_reports",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["store_occ_status_sync", campaignId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, queryClient]);

  const storeOccurrenceStatus = useMemo(
    () => computeStoreOccurrenceStatus(campaignOccurrences),
    [campaignOccurrences]
  );

  return { campaignOccurrences, storeOccurrenceStatus };
}
