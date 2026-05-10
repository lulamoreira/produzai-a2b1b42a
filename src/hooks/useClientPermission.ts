import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

type PermissionKey =
  | "can_view_clients" | "can_edit_clients" | "can_delete_clients"
  | "can_view_campaigns" | "can_edit_campaigns" | "can_delete_campaigns"
  | "can_view_stores" | "can_edit_stores" | "can_delete_stores"
  | "can_view_campaign_stores" | "can_edit_campaign_stores" | "can_delete_campaign_stores"
  | "can_view_pieces" | "can_edit_pieces" | "can_delete_pieces"
  | "can_view_occurrences" | "can_edit_occurrences" | "can_delete_occurrences"
  | "can_view_schedules" | "can_edit_schedules" | "can_delete_schedules"
  | "can_view_installations" | "can_edit_installations" | "can_delete_installations"
  | "can_edit_reporter_data"
  | "can_manage_team_codes"
  | "can_lock_cards"
  | "can_view_photo_checkin"
  | "can_view_loja_a_loja"
  | "can_edit_loja_a_loja";

/**
 * Translate a legacy `can_<action>_<thing>` string into the new
 * (module_key, action) pair for permission_grants. Returns the legacy column
 * name as the fallback for the SQL helper.
 */
function resolveCheck(permission: string): {
  moduleKey: string; action: string; legacyColumn: string;
} | null {
  // Specials first
  const specials: Record<string, { moduleKey: string; action: string }> = {
    can_edit_reporter_data: { moduleKey: "loja_a_loja.ocorrencias", action: "special:reporter_data" },
    can_lock_cards:         { moduleKey: "loja_a_loja.ocorrencias", action: "special:lock_cards" },
    can_manage_team_codes:  { moduleKey: "installations",          action: "special:team_codes" },
    can_view_photo_checkin: { moduleKey: "installations",          action: "special:photo_checkin" },
  };
  if (specials[permission]) {
    return { ...specials[permission], legacyColumn: permission };
  }

  const m = permission.match(/^can_(view|edit|delete)_(.+)$/);
  if (!m) return null;
  const [, action, dbModule] = m;
  const moduleMap: Record<string, string> = {
    clients: "clients",
    campaigns: "campaigns",
    stores: "stores",
    campaign_stores: "campaign_stores",
    pieces: "pieces",
    schedules: "scheduling",
    installations: "installations",
    occurrences: "loja_a_loja.ocorrencias",
    loja_a_loja: "loja_a_loja",
    lal_estrutura: "loja_a_loja.estrutura",
    lal_classificacao: "loja_a_loja.classificacao",
    lal_acessos: "loja_a_loja.acessos",
    lal_config: "loja_a_loja.config",
    lal_ocorrencias: "loja_a_loja.ocorrencias",
  };
  const moduleKey = moduleMap[dbModule] ?? dbModule;
  return { moduleKey, action, legacyColumn: permission };
}

async function checkCategoryPermission(
  categoryId: string,
  permission: string,
): Promise<boolean> {
  const r = resolveCheck(permission);
  if (!r) return false;
  const { data } = await (supabase.rpc as never as (
    fn: string, args: Record<string, unknown>,
  ) => Promise<{ data: boolean | null }>)("check_category_permission", {
    _category_id: categoryId,
    _module_key: r.moduleKey,
    _action: r.action,
    _legacy_column_name: r.legacyColumn,
  });
  return !!data;
}

export function useClientPermission(clientId?: string, permission?: PermissionKey) {
  const { user } = useAuth();
  const { isAdmin, isMaster } = useUserRole();

  const { data: hasPermission = false, isLoading } = useQuery({
    queryKey: ["client_permission_v2", user?.id, clientId, permission],
    queryFn: async () => {
      if (!user || !clientId || !permission) return false;
      if (isAdmin || isMaster) return true;

      const categoryIds = new Set<string>();

      // Direct client access
      const { data: clientAccess } = await supabase
        .from("user_client_access")
        .select("category_id")
        .eq("user_id", user.id)
        .eq("client_id", clientId)
        .eq("suspended", false);
      clientAccess?.forEach(r => r.category_id && categoryIds.add(r.category_id));

      // Agency-level access (inherited)
      const { data: client } = await supabase
        .from("clients")
        .select("agency_id")
        .eq("id", clientId)
        .maybeSingle();

      if (client?.agency_id) {
        const { data: agencyAccess } = await supabase
          .from("user_agency_access")
          .select("category_id")
          .eq("user_id", user.id)
          .eq("agency_id", client.agency_id)
          .eq("suspended", false);
        agencyAccess?.forEach(r => r.category_id && categoryIds.add(r.category_id));
      }

      // Campaign-of-client
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id")
        .eq("client_id", clientId);
      if (campaigns && campaigns.length > 0) {
        const { data: campaignAccesses } = await supabase
          .from("user_campaign_access")
          .select("category_id")
          .eq("user_id", user.id)
          .in("campaign_id", campaigns.map(c => c.id))
          .eq("suspended", false);
        campaignAccesses?.forEach(r => r.category_id && categoryIds.add(r.category_id));
      }

      if (categoryIds.size === 0) return false;

      // Check each category via the new RPC (grants → legacy fallback)
      for (const cid of categoryIds) {
        if (await checkCategoryPermission(cid, permission)) return true;
      }
      return false;
    },
    enabled: !!user && !!clientId && !!permission,
  });

  return { hasPermission: isAdmin || isMaster || hasPermission, isLoading };
}
