// @deprecated [REMOVE-CANDIDATE] Módulo antigo de Ocorrências — desabilitado da UI.
// Substituído pelo módulo de Ocorrências dentro de "Loja a Loja". Pode ser apagado.

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { computeStoreOccurrenceStatus } from "@/lib/occurrenceHelpers";

/**
 * Shared hook: fetches campaign occurrences (lightweight: id, store_id, status)
 * and provides per-store occurrence status with realtime sync.
 * Used by SchedulingTab and any future module needing this data.
 */
export function useOccurrenceStatusSync(campaignId?: string) {
  const queryClient = useQueryClient();

  const { data: campaignOccurrences = [] } = useQuery({
    queryKey: ["occurrences_status_sync", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrences")
        .select("id, store_id, status")
        .eq("campaign_id", campaignId!);
      if (error) throw error;
      return data as { id: string; store_id: string | null; status: string | null }[];
    },
    enabled: !!campaignId,
  });

  // Realtime subscription — single source of truth for occurrences changes per campaign.
  // Consumers (OccurrencesTab, SchedulingTab, etc.) all reuse this hook to avoid duplicate channels.
  useEffect(() => {
    if (!campaignId) return;
    const channel = supabase
      .channel(`occ-status-sync-${campaignId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "occurrences",
        filter: `campaign_id=eq.${campaignId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["occurrences_status_sync", campaignId] });
        queryClient.invalidateQueries({ queryKey: ["occurrences", campaignId] });
        queryClient.invalidateQueries({ queryKey: ["occurrence_photos", campaignId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [campaignId, queryClient]);

  const storeOccurrenceStatus = useMemo(
    () => computeStoreOccurrenceStatus(campaignOccurrences),
    [campaignOccurrences]
  );

  return { campaignOccurrences, storeOccurrenceStatus };
}