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

export type ClientAccess = {
  clientId: string;
  clientName: string;
  agencyId: string;
};

export function useUserDirectAccess() {
  const { user } = useAuth();
  const { isAdminOrMaster, isLoading: roleLoading } = useUserRole();

  const { data, isLoading } = useQuery({
    queryKey: ["user_direct_access", user?.id, isAdminOrMaster],
    queryFn: async (): Promise<{ isLimited: boolean; campaigns: CampaignAccess[]; clients: ClientAccess[] }> => {
      if (!user) return { isLimited: false, campaigns: [], clients: [] };
      if (isAdminOrMaster) return { isLimited: false, campaigns: [], clients: [] };

      // Check agency-level access — if present, user is NOT limited
      const { data: agencyAccess } = await supabase
        .from("user_agency_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("suspended", false)
        .limit(1);

      if (agencyAccess && agencyAccess.length > 0) {
        return { isLimited: false, campaigns: [], clients: [] };
      }

      // User is limited — gather direct client access
      const { data: clientAccess } = await supabase
        .from("user_client_access")
        .select("client_id, clients(id, name, agency_id)")
        .eq("user_id", user.id)
        .eq("suspended", false);

      const directClients: ClientAccess[] = (clientAccess ?? [])
        .map((ca) => {
          const cli = ca.clients as { id: string; name: string; agency_id: string } | null;
          if (!cli) return null;
          return { clientId: cli.id, clientName: cli.name, agencyId: cli.agency_id };
        })
        .filter((c): c is ClientAccess => c !== null);

      // Gather campaign-level access
      const { data: campaignAccess } = await supabase
        .from("user_campaign_access")
        .select(`
          campaign_id,
          permission_categories (
            can_view_stores, can_view_campaign_stores, can_view_pieces,
            can_view_occurrences, can_view_schedules, can_view_campaigns,
            can_view_installations, can_view_loja_a_loja
          )
        `)
        .eq("user_id", user.id)
        .eq("suspended", false);

      let campaignsResult: CampaignAccess[] = [];

      if (campaignAccess && campaignAccess.length > 0) {
        const campaignIds = campaignAccess.map((ca) => ca.campaign_id);
        const { data: campaigns } = await supabase
          .from("campaigns")
          .select("id, name, client_id, clients(name, agency_id)")
          .in("id", campaignIds);

        const mergedMap = new Map<string, { campaignId: string; modules: Set<string>; campaignName: string; clientName: string; clientId: string; agencyId: string }>();

        for (const ca of campaignAccess) {
          const campaign = campaigns?.find((c) => c.id === ca.campaign_id);
          const pc = ca.permission_categories as Record<string, boolean> | null;
          const client = campaign?.clients as { name: string; agency_id: string } | null;

          let entry = mergedMap.get(ca.campaign_id);
          if (!entry) {
            entry = {
              campaignId: ca.campaign_id,
              campaignName: campaign?.name || "",
              clientName: client?.name || "",
              clientId: campaign?.client_id || "",
              agencyId: client?.agency_id || "",
              modules: new Set(),
            };
            mergedMap.set(ca.campaign_id, entry);
          }

          if (pc) {
            if (pc.can_view_stores || pc.can_view_campaign_stores) entry.modules.add("stores");
            if (pc.can_view_campaign_stores) entry.modules.add("matrix");
            if (pc.can_view_pieces) entry.modules.add("pieces");
            if (pc.can_view_occurrences) entry.modules.add("occurrences");
            if (pc.can_view_schedules) entry.modules.add("scheduling");
            if (pc.can_view_installations) entry.modules.add("installations");
            if (pc.can_view_campaigns) entry.modules.add("budgets");
            const lalView =
              pc.can_view_loja_a_loja ||
              pc.can_view_lal_estrutura ||
              pc.can_view_lal_classificacao ||
              pc.can_view_lal_acessos ||
              pc.can_view_lal_config ||
              pc.can_view_lal_ocorrencias;
            if (lalView) entry.modules.add("loja_a_loja");
          }
        }

        campaignsResult = Array.from(mergedMap.values()).map((e) => ({
          ...e,
          modules: [...e.modules],
        }));
      }

      return { isLimited: true, campaigns: campaignsResult, clients: directClients };
    },
    enabled: !!user && !roleLoading,
  });

  return {
    isLimited: data?.isLimited ?? false,
    campaigns: data?.campaigns ?? [],
    clients: data?.clients ?? [],
    isLoading: isLoading || roleLoading,
  };
}
