import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserClientAccess } from "@/hooks/useMultiClientData";
import { useUserCampaignAccess } from "@/hooks/useUserCampaignAccess";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the client IDs the current user can access.
 * - null  → user is admin/master, no restriction (show all clients)
 * - []    → user has no access to any client
 * - [...] → list of accessible client IDs (via client access OR campaign access)
 */
export function useMyAccessibleClientIds(): { clientIds: string[] | null; isLoading: boolean } {
  const { user } = useAuth();
  const { isAdminOrMaster } = useUserRole();
  const { data: allClientAccess = [] } = useUserClientAccess();
  const { data: allCampaignAccess = [] } = useUserCampaignAccess();

  const myDirectClientIds = allClientAccess
    .filter(a => a.user_id === user?.id && !a.suspended)
    .map(a => a.client_id);

  const myCampaignIds = allCampaignAccess
    .filter(a => a.user_id === user?.id && !a.suspended)
    .map(a => a.campaign_id);

  const { data: campaignClientIds = [], isLoading } = useQuery({
    queryKey: ["my-campaign-client-ids", [...myCampaignIds].sort().join(",")],
    enabled: !isAdminOrMaster && myCampaignIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("client_id")
        .in("id", myCampaignIds);
      return [...new Set((data || []).map((c: any) => c.client_id).filter(Boolean))];
    },
  });

  if (isAdminOrMaster) return { clientIds: null, isLoading: false };

  const allClientIds = [...new Set([...myDirectClientIds, ...campaignClientIds])];
  return { clientIds: allClientIds, isLoading };
}
