import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

export type CampaignAccess = {
  campaignId: string;
  campaignName: string;
  clientName: string;
  clientId: string;
  agencyId: string;
  modules: string[];
};

export function useUserDirectAccess() {
  const { user } = useAuth();
  const { isAdminOrMaster, isLoading: roleLoading } = useUserRole();

  const { data, isLoading } = useQuery({
    queryKey: ["user_direct_access", user?.id, isAdminOrMaster],
    queryFn: async (): Promise<{ isLimited: boolean; campaigns: CampaignAccess[] }> => {
      if (!user) return { isLimited: false, campaigns: [] };
      if (isAdminOrMaster) return { isLimited: false, campaigns: [] };

      // Check agency-level access
      const { data: agencyAccess } = await supabase
        .from("user_agency_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("suspended", false)
        .limit(1);

      if (agencyAccess && agencyAccess.length > 0) {
        return { isLimited: false, campaigns: [] };
      }

      // Check client-level access
      const { data: clientAccess } = await supabase
        .from("user_client_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("suspended", false)
        .limit(1);

      if (clientAccess && clientAccess.length > 0) {
        return { isLimited: false, campaigns: [] };
      }

      // Only campaign-level access → limited user
      const { data: campaignAccess } = await supabase
        .from("user_campaign_access")
        .select(`
          campaign_id,
          permission_categories (
            can_view_stores, can_view_campaign_stores, can_view_pieces,
            can_view_occurrences, can_view_schedules, can_view_campaigns
          )
        `)
        .eq("user_id", user.id)
        .eq("suspended", false);

      if (!campaignAccess || campaignAccess.length === 0) {
        return { isLimited: true, campaigns: [] };
      }

      // Fetch campaign details
      const campaignIds = campaignAccess.map(ca => ca.campaign_id);
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id, name, client_id, clients(name, agency_id)")
        .in("id", campaignIds);

      const result: CampaignAccess[] = campaignAccess.map(ca => {
        const campaign = campaigns?.find(c => c.id === ca.campaign_id);
        const pc = ca.permission_categories as Record<string, boolean> | null;
        const modules: string[] = [];

        if (pc) {
          if (pc.can_view_stores || pc.can_view_campaign_stores) modules.push("stores");
          if (pc.can_view_campaign_stores) modules.push("matrix");
          if (pc.can_view_pieces) modules.push("pieces");
          if (pc.can_view_occurrences) modules.push("occurrences");
          if (pc.can_view_schedules) modules.push("scheduling");
          if (pc.can_view_campaigns) modules.push("budgets");
        }

        const client = campaign?.clients as { name: string; agency_id: string } | null;
        return {
          campaignId: ca.campaign_id,
          campaignName: campaign?.name || "",
          clientName: client?.name || "",
          clientId: campaign?.client_id || "",
          agencyId: client?.agency_id || "",
          modules: [...new Set(modules)],
        };
      });

      return { isLimited: true, campaigns: result };
    },
    enabled: !!user && !roleLoading,
  });

  return {
    isLimited: data?.isLimited ?? false,
    campaigns: data?.campaigns ?? [],
    isLoading: isLoading || roleLoading,
  };
}
