import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Schedule } from "@/types/schedule";

/**
 * Shared hook for fetching campaign schedules (a.k.a. installations).
 *
 * Reinstallation support:
 * - Original installation rows have `reinstall_seq = 0` (default).
 * - Reinstallations have `reinstall_seq >= 1` and reference the original via `parent_installation_id`.
 *
 * To preserve all existing store-centric code (`scheduleMap[store.id]`), this hook
 * exposes:
 *   - `scheduleMap` / `schedules`: ONLY originals (seq=0). Existing UI keeps working unchanged.
 *   - `reinstallsByStore`: Record<store_id, Schedule[]> of reinstallations sorted by seq ASC.
 *   - `allSchedules`: every row (originals + reinstalls), useful for tabs that want the full list.
 */
export function useCampaignSchedules(campaignId?: string) {
  const query = useQuery({
    queryKey: ["campaign_schedules", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_schedules")
        .select("*")
        .eq("campaign_id", campaignId!);
      if (error) throw error;
      return data as Schedule[];
    },
    enabled: !!campaignId,
  });

  const all = (query.data ?? []) as Schedule[];

  const originals = useMemo(
    () => all.filter((s) => (s as any).reinstall_seq == null || (s as any).reinstall_seq === 0),
    [all]
  );

  const scheduleMap = useMemo(() => {
    const map: Record<string, Schedule> = {};
    originals.forEach((s) => {
      map[s.store_id] = s;
    });
    return map;
  }, [originals]);

  const reinstallsByStore = useMemo(() => {
    const map: Record<string, Schedule[]> = {};
    all.forEach((s) => {
      const seq = (s as any).reinstall_seq ?? 0;
      if (seq >= 1) {
        if (!map[s.store_id]) map[s.store_id] = [];
        map[s.store_id].push(s);
      }
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => ((a as any).reinstall_seq ?? 0) - ((b as any).reinstall_seq ?? 0))
    );
    return map;
  }, [all]);

  return {
    ...query,
    scheduleMap,
    schedules: originals,
    allSchedules: all,
    reinstallsByStore,
  };
}

/** Update the reinstallation reason text. */
export function useUpdateReinstallReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { installationId: string; campaignId: string; reason: string }) => {
      const { error } = await supabase
        .from("campaign_schedules")
        .update({ reinstall_reason: params.reason } as any)
        .eq("id", params.installationId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["campaign_schedules", vars.campaignId] });
      toast.success("Motivo atualizado");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar motivo"),
  });
}
