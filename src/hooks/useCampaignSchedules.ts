import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Schedule } from "@/types/schedule";

/**
 * Shared hook for fetching campaign schedules.
 * Used by SchedulingTab, InstallationsTab, and any future module.
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

  const scheduleMap = useMemo(() => {
    const map: Record<string, Schedule> = {};
    (query.data ?? []).forEach((s) => {
      map[s.store_id] = s;
    });
    return map;
  }, [query.data]);

  return { ...query, scheduleMap, schedules: query.data ?? [] };
}
