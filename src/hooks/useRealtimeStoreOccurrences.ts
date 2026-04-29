import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime changes on store_occurrence_reports for a campaign
 * and invalidates all related query keys so any list/dashboard updates instantly
 * for every connected user.
 */
export function useRealtimeStoreOccurrences(campaignId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!campaignId) return;
    const channel = supabase
      .channel(`store_occ_reports:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "store_occurrence_reports",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["portal-occurrences-v2", campaignId] });
          qc.invalidateQueries({ queryKey: ["portal-occurrences-by-store", campaignId] });
          qc.invalidateQueries({ queryKey: ["loja-a-loja-dashboard", campaignId] });
          qc.invalidateQueries({ queryKey: ["campaign_stats", campaignId] });
          qc.invalidateQueries({ queryKey: ["store-portal-occurrences", campaignId] });
          qc.invalidateQueries({ queryKey: ["store-portal-conformidade", campaignId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, qc]);
}
