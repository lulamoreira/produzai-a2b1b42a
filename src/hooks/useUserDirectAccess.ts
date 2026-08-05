import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { usePreviewUser } from "@/hooks/usePreviewUser";
import { supabasePaginate } from "@/lib/supabasePaginate";

export type CampaignAccess = {
  campaignId: string;
  campaignName: string;
  clientName: string;
  clientId: string;
  agencyId: string;
  modules: string[];
  is_active?: boolean;
  /** true when the access comes from a client-level grant (all campaigns of the client) */
  viaClient?: boolean;
};

export type ClientAccess = {
  clientId: string;
  clientName: string;
  agencyId: string;
};

const PERMISSION_COLUMNS = `
  can_view_stores, can_view_campaign_stores, can_view_pieces,
  can_view_occurrences, can_view_schedules, can_view_campaigns,
  can_view_installations, can_view_loja_a_loja,
  can_view_lal_estrutura, can_view_lal_classificacao, can_view_lal_acessos,
  can_view_lal_config, can_view_lal_ocorrencias
`;

type PermissionFlags = Record<string, boolean | null> | null;

/** Translate a permission_categories row into the module keys used by the UI. */
function modulesFromFlags(pc: PermissionFlags): string[] {
  const mods: string[] = [];
  if (!pc) return mods;
  if (pc.can_view_stores || pc.can_view_campaign_stores) mods.push("stores");
  if (pc.can_view_campaign_stores) mods.push("matrix");
  if (pc.can_view_pieces) mods.push("pieces");
  if (pc.can_view_occurrences) mods.push("occurrences");
  if (pc.can_view_schedules) mods.push("scheduling");
  if (pc.can_view_installations) mods.push("installations");
  
  const lalView =
    pc.can_view_loja_a_loja ||
    pc.can_view_lal_estrutura ||
    pc.can_view_lal_classificacao ||
    pc.can_view_lal_acessos ||
    pc.can_view_lal_config ||
    pc.can_view_lal_ocorrencias;
  if (lalView) mods.push("loja_a_loja");

  // If we have granular occurrence permission, ensure the module key is present
  if (pc.can_view_lal_ocorrencias && !mods.includes("occurrences")) {
    mods.push("occurrences");
  }

  return mods;
}

export function useUserDirectAccess() {
  const { user } = useAuth();
  const { previewUserId } = usePreviewUser();
  const { isAdminOrMaster, isLoading: roleLoading } = useUserRole();
  const effectiveId = previewUserId ?? user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["user_direct_access", effectiveId, isAdminOrMaster],
    queryFn: async (): Promise<{ isLimited: boolean; campaigns: CampaignAccess[]; clients: ClientAccess[] }> => {
      if (!effectiveId) return { isLimited: false, campaigns: [], clients: [] };
      if (isAdminOrMaster) return { isLimited: false, campaigns: [], clients: [] };

      // Check agency-level access — if present, user is NOT limited
      const { data: agencyAccess } = await supabase
        .from("user_agency_access")
        .select("id")
        .eq("user_id", effectiveId)
        .eq("suspended", false)
        .limit(1);

      if (agencyAccess && agencyAccess.length > 0) {
        return { isLimited: false, campaigns: [], clients: [] };
      }

      // User is limited — gather direct client access (with its permission category)
      const { data: clientAccess } = await supabase
        .from("user_client_access")
        .select(`
          client_id,
          category_id,
          clients(id, name, agency_id),
          permission_categories (${PERMISSION_COLUMNS})
        `)
        .eq("user_id", effectiveId)
        .eq("suspended", false);

      const clientRows = (clientAccess ?? []) as Array<{
        client_id: string;
        category_id?: string | null;
        clients: { id: string; name: string; agency_id: string } | null;
        permission_categories: PermissionFlags;
      }>;

      const directClients: ClientAccess[] = clientRows
        .map((ca) => {
          const cli = ca.clients;
          if (!cli) return null;
          return { clientId: cli.id, clientName: cli.name, agencyId: cli.agency_id };
        })
        .filter((c): c is ClientAccess => c !== null);

      // Gather campaign-level access
      const { data: campaignAccess } = await supabase
        .from("user_campaign_access")
        .select(`
          campaign_id,
          category_id,
          permission_categories (${PERMISSION_COLUMNS})
        `)
        .eq("user_id", effectiveId)
        .eq("suspended", false);

      const campaignRows = (campaignAccess ?? []) as Array<{
        campaign_id: string;
        category_id?: string | null;
        permission_categories: PermissionFlags;
      }>;

      // ---- v2 grants (modules without a legacy boolean column) ----
      const categoryIds = Array.from(
        new Set(
          [...clientRows, ...campaignRows]
            .map((r) => r.category_id)
            .filter((x): x is string => !!x),
        ),
      );
      const grantedV2Modules = new Set<string>();
      if (categoryIds.length > 0) {
        const { data: grants } = await (supabase as never as {
          from: (t: string) => {
            select: (s: string) => {
              in: (c: string, v: string[]) => {
                in: (c: string, v: string[]) => {
                  eq: (c: string, v: string) => Promise<{ data: Array<{ category_id: string; module_key: string }> | null }>;
                };
              };
            };
          };
        })
          .from("permission_grants")
          .select("category_id, module_key")
          .in("category_id", categoryIds)
          .in("module_key", ["mockup", "adjustments", "occurrences", "briefing", "scheduling", "installations", "loja_a_loja", "stores", "pieces", "matrix"])
          .eq("action", "view");
        (grants ?? []).forEach((g) => grantedV2Modules.add(`${g.category_id}:${g.module_key}`));
      }

      const v2ModulesFor = (categoryId?: string | null): string[] => {
        if (!categoryId) return [];
        return (["mockup", "adjustments", "occurrences", "briefing", "scheduling", "installations", "loja_a_loja", "stores", "pieces", "matrix"] as const).filter((mk) =>
          grantedV2Modules.has(`${categoryId}:${mk}`),
        );
      };

      // ---- Load the campaigns we need (client-level + campaign-level) ----
      const clientIds = directClients.map((c) => c.clientId);
      const campaignIds = campaignRows.map((r) => r.campaign_id);

      type CampaignRow = {
        id: string;
        name: string;
        client_id: string;
        is_active: boolean | null;
        clients: { name: string; agency_id: string } | null;
      };

      const campaignsById = new Map<string, CampaignRow>();

      if (clientIds.length > 0) {
        // Client-level access ⇒ ALL campaigns of the client (may exceed 1000 rows)
        const rows = await supabasePaginate<CampaignRow>((from, to) =>
          supabase
            .from("campaigns")
            .select("id, name, client_id, is_active, clients(name, agency_id)", { count: "exact" })
            .in("client_id", clientIds)
            .order("id")
            .range(from, to) as unknown as PromiseLike<{ data: CampaignRow[] | null; error: unknown; count?: number | null }>,
        );
        rows.forEach((r) => campaignsById.set(r.id, r));
      }

      const missingCampaignIds = campaignIds.filter((id) => !campaignsById.has(id));
      if (missingCampaignIds.length > 0) {
        const { data: rows } = await supabase
          .from("campaigns")
          .select("id, name, client_id, is_active, clients(name, agency_id)")
          .in("id", missingCampaignIds);
        ((rows ?? []) as unknown as CampaignRow[]).forEach((r) => campaignsById.set(r.id, r));
      }

      // ---- Merge module sets per campaign ----
      const mergedMap = new Map<
        string,
        {
          campaignId: string;
          campaignName: string;
          clientName: string;
          clientId: string;
          agencyId: string;
          modules: Set<string>;
          is_active?: boolean;
          viaClient: boolean;
        }
      >();

      const ensureEntry = (campaignId: string, viaClient: boolean) => {
        let entry = mergedMap.get(campaignId);
        if (!entry) {
          const campaign = campaignsById.get(campaignId);
          entry = {
            campaignId,
            campaignName: campaign?.name || "",
            clientName: campaign?.clients?.name || "",
            clientId: campaign?.client_id || "",
            agencyId: campaign?.clients?.agency_id || "",
            modules: new Set<string>(),
            is_active: campaign?.is_active ?? undefined,
            viaClient,
          };
          mergedMap.set(campaignId, entry);
        }
        entry.viaClient = entry.viaClient || viaClient;
        return entry;
      };

      // 1) Client-level grants apply to every campaign of that client
      for (const ca of clientRows) {
        const mods = [...modulesFromFlags(ca.permission_categories), ...v2ModulesFor(ca.category_id)];
        for (const campaign of campaignsById.values()) {
          if (campaign.client_id !== ca.client_id) continue;
          const entry = ensureEntry(campaign.id, true);
          mods.forEach((m) => entry.modules.add(m));
        }
      }

      // 2) Campaign-level grants add on top (never remove)
      for (const ca of campaignRows) {
        const entry = ensureEntry(ca.campaign_id, false);
        modulesFromFlags(ca.permission_categories).forEach((m) => entry.modules.add(m));
        v2ModulesFor(ca.category_id).forEach((m) => entry.modules.add(m));
      }

      const campaignsResult: CampaignAccess[] = Array.from(mergedMap.values()).map((e) => ({
        ...e,
        modules: [...e.modules],
      }));

      return { isLimited: true, campaigns: campaignsResult, clients: directClients };
    },
    enabled: !!effectiveId && !roleLoading,
  });

  return {
    isLimited: data?.isLimited ?? false,
    campaigns: data?.campaigns ?? [],
    clients: data?.clients ?? [],
    isLoading: isLoading || roleLoading,
  };
}
