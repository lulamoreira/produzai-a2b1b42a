import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type CampaignFavorite = {
  id: string;
  user_id: string;
  campaign_id: string;
  created_at: string;
};

export type FavoriteWithDetails = CampaignFavorite & {
  campaign_name: string;
  campaign_color: string | null;
  client_id: string;
  client_name: string;
  agency_id: string;
  agency_name: string;
  is_active?: boolean;
};

type CampaignFamilyRow = {
  id: string;
  root_campaign_id: string | null;
  created_at: string;
};

async function getCampaignFamily(campaignId: string): Promise<CampaignFamilyRow[]> {
  const { data: selectedCampaign, error: selectedError } = await supabase
    .from("campaigns")
    .select("id, root_campaign_id, created_at")
    .eq("id", campaignId)
    .maybeSingle();

  if (selectedError) throw selectedError;
  if (!selectedCampaign) throw new Error("Campanha não encontrada");

  const rootId = selectedCampaign.root_campaign_id ?? selectedCampaign.id;
  const { data: family, error: familyError } = await supabase
    .from("campaigns")
    .select("id, root_campaign_id, created_at")
    .or(`id.eq.${rootId},root_campaign_id.eq.${rootId}`)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (familyError) throw familyError;
  return family ?? [];
}

export function useCampaignFavorites() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["campaign_favorites", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<FavoriteWithDetails[]> => {
      const { data: favs, error } = await supabase
        .from("user_campaign_favorites")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      if (!favs || favs.length === 0) return [];

      const campaignIds = favs.map((f) => f.campaign_id);

      // Fetch campaign + client + agency info
      const { data: campaigns, error: cErr } = await supabase
        .from("campaigns")
        .select("id, name, color, is_active, client_id, clients(id, name, agency_id, agencies(id, name))")
        .in("id", campaignIds);
      if (cErr) throw cErr;

      // Check access: user_campaign_access OR user_client_access OR user_agency_access
      const [
        { data: campAccess },
        { data: clientAccess },
        { data: agencyAccess },
      ] = await Promise.all([
        supabase.from("user_campaign_access").select("campaign_id").eq("user_id", user!.id).eq("suspended", false),
        supabase.from("user_client_access").select("client_id").eq("user_id", user!.id).eq("suspended", false),
        supabase.from("user_agency_access").select("agency_id").eq("user_id", user!.id).eq("suspended", false),
      ]);

      // Check if user is admin/master
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      const isAdminOrMaster = roles?.some((r) => r.role === "admin" || r.role === "master") ?? false;

      const accessibleCampaignIds = new Set(campAccess?.map((a) => a.campaign_id) ?? []);
      const accessibleClientIds = new Set(clientAccess?.map((a) => a.client_id) ?? []);
      const accessibleAgencyIds = new Set(agencyAccess?.map((a) => a.agency_id) ?? []);

      const campaignMap = new Map(campaigns?.map((c) => [c.id, c]) ?? []);

      return favs
        .map((fav) => {
          const camp = campaignMap.get(fav.campaign_id);
          if (!camp) return null;
          const client = camp.clients as any;
          if (!client) return null;
          const agency = client.agencies as any;
          if (!agency) return null;

          // Filter by access
          if (
            !isAdminOrMaster &&
            !accessibleCampaignIds.has(camp.id) &&
            !accessibleClientIds.has(client.id) &&
            !accessibleAgencyIds.has(agency.id)
          ) {
            return null;
          }

          return {
            ...fav,
            campaign_name: camp.name,
            campaign_color: camp.color,
            client_id: client.id,
            client_name: client.name,
            agency_id: agency.id,
            agency_name: agency.name,
            is_active: camp.is_active,
          } as FavoriteWithDetails;
        })
        .filter(Boolean) as FavoriteWithDetails[];
    },
  });
}

export function useFavoriteIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["campaign_favorite_ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_campaign_favorites")
        .select("campaign_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      const storedIds = data?.map((d) => d.campaign_id) ?? [];
      if (storedIds.length === 0) return new Set<string>();

      const { data: storedCampaigns, error: campaignsError } = await supabase
        .from("campaigns")
        .select("id, root_campaign_id")
        .in("id", storedIds);
      if (campaignsError) throw campaignsError;

      const rootIds = Array.from(new Set(
        (storedCampaigns ?? []).map((campaign) => campaign.root_campaign_id ?? campaign.id)
      ));
      const familyIds = new Set<string>(storedIds);

      if (rootIds.length > 0) {
        const rootFilters = rootIds.flatMap((rootId) => [
          `id.eq.${rootId}`,
          `root_campaign_id.eq.${rootId}`,
        ]);
        const { data: familyCampaigns, error: familyError } = await supabase
          .from("campaigns")
          .select("id")
          .or(rootFilters.join(","));
        if (familyError) throw familyError;
        familyCampaigns?.forEach((campaign) => familyIds.add(campaign.id));
      }

      return familyIds;
    },
  });
}

export function useToggleFavorite() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ campaignId }: { campaignId: string; isFavorited: boolean }) => {
      if (!user) throw new Error("Not authenticated");

      const family = await getCampaignFamily(campaignId);
      if (family.length === 0) throw new Error("Campanha não encontrada");

      const familyIds = family.map((campaign) => campaign.id);
      const latestCampaignId = family[0].id;
      const { data: existingFavorites, error: favoriteError } = await supabase
        .from("user_campaign_favorites")
        .select("id")
        .eq("user_id", user.id)
        .in("campaign_id", familyIds)
        .limit(1);
      if (favoriteError) throw favoriteError;

      if ((existingFavorites?.length ?? 0) > 0) {
        const { error } = await supabase
          .from("user_campaign_favorites")
          .delete()
          .eq("user_id", user.id)
          .in("campaign_id", familyIds);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_campaign_favorites")
          .insert({ user_id: user.id, campaign_id: latestCampaignId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign_favorites"] });
      qc.invalidateQueries({ queryKey: ["campaign_favorite_ids"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
