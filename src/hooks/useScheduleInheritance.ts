import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useScheduleInheritance(clientId: string, currentCampaignId: string) {
  return useQuery({
    queryKey: ["schedule-inheritance", clientId, currentCampaignId],
    queryFn: async () => {
      if (!clientId || !currentCampaignId) return null;

      // Find the most recent campaign from the same client (excluding the current one)
      const { data: previousCampaign, error: campaignError } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("client_id", clientId)
        .neq("id", currentCampaignId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (campaignError) throw campaignError;
      if (!previousCampaign) return null;

      // Fetch scheduling preferences for this previous campaign
      // We look for schedules where at least one preference is set
      const { data: previousPreferences, error: preferencesError } = await supabase
        .from("campaign_schedules")
        .select("store_id, installation_preference")
        .eq("campaign_id", previousCampaign.id)
        .neq("installation_preference", "not_informed");

      if (preferencesError) throw preferencesError;

      // Map preferences by store_id
      const preferencesMap: Record<string, string> = {};
      previousPreferences?.forEach((pref) => {
        preferencesMap[pref.store_id] = pref.installation_preference;
      });

      return {
        previousCampaign,
        preferencesMap,
        hasPreferences: previousPreferences && previousPreferences.length > 0
      };
    },
    enabled: !!clientId && !!currentCampaignId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
