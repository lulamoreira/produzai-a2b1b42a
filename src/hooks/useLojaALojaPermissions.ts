import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

export interface LalSubAreaPermission {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface LalPermissions {
  canViewModule: boolean;
  canDeleteModule: boolean;
  estrutura: LalSubAreaPermission;
  classificacao: LalSubAreaPermission;
  acessos: LalSubAreaPermission;
  config: LalSubAreaPermission;
  ocorrencias: LalSubAreaPermission;
  isLoading: boolean;
}

const FULL: LalSubAreaPermission = { canView: true, canEdit: true, canDelete: true };
const NONE: LalSubAreaPermission = { canView: false, canEdit: false, canDelete: false };

const ADMIN_PERMS: LalPermissions = {
  canViewModule: true,
  canDeleteModule: true,
  estrutura: FULL,
  classificacao: FULL,
  acessos: FULL,
  config: FULL,
  ocorrencias: FULL,
  isLoading: false,
};

const EMPTY_PERMS: LalPermissions = {
  canViewModule: false,
  canDeleteModule: false,
  estrutura: NONE,
  classificacao: NONE,
  acessos: NONE,
  config: NONE,
  ocorrencias: NONE,
  isLoading: false,
};

const SUB_AREAS = [
  { name: "estrutura",     moduleKey: "loja_a_loja.estrutura",     legacy: "lal_estrutura" },
  { name: "classificacao", moduleKey: "loja_a_loja.classificacao", legacy: "lal_classificacao" },
  { name: "acessos",       moduleKey: "loja_a_loja.acessos",       legacy: "lal_acessos" },
  { name: "config",        moduleKey: "loja_a_loja.config",        legacy: "lal_config" },
  { name: "ocorrencias",   moduleKey: "loja_a_loja.ocorrencias",   legacy: "lal_ocorrencias" },
] as const;

const ACTIONS = ["view", "edit", "delete"] as const;

async function checkAny(
  categoryIds: string[], moduleKey: string, action: string, legacyColumn: string,
): Promise<boolean> {
  for (const cid of categoryIds) {
    const { data } = await (supabase.rpc as never as (
      fn: string, args: Record<string, unknown>,
    ) => Promise<{ data: boolean | null }>)("check_category_permission", {
      _category_id: cid,
      _module_key: moduleKey,
      _action: action,
      _legacy_column_name: legacyColumn,
    });
    if (data) return true;
  }
  return false;
}

/**
 * Returns granular Loja a Loja permissions for the current user, scoped to the
 * given campaign/client. Admins and Masters always get full access. Other
 * users inherit the highest level of permission across direct client, agency,
 * and campaign-level access categories. Reads from `permission_grants` first
 * with fallback to legacy boolean columns.
 */
export function useLojaALojaPermissions(
  campaignId: string | undefined,
  clientId: string | undefined,
): LalPermissions {
  const { user } = useAuth();
  const { isAdminOrMaster, isLoading: roleLoading } = useUserRole();

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ["lal_permissions_v2", user?.id, clientId, campaignId],
    queryFn: async () => {
      if (!user || (!clientId && !campaignId)) return EMPTY_PERMS;

      const categoryIds = new Set<string>();
      let masterFlag = false;

      // Direct client access
      if (clientId) {
        const { data: clientAccess } = await supabase
          .from("user_client_access")
          .select("category_id, can_edit")
          .eq("user_id", user.id)
          .eq("client_id", clientId)
          .eq("suspended", false);
        clientAccess?.forEach(r => {
          if (r.category_id) categoryIds.add(r.category_id);
          if (r.can_edit) masterFlag = true;
        });

        // Agency-level access
        const { data: client } = await supabase
          .from("clients")
          .select("agency_id")
          .eq("id", clientId)
          .maybeSingle();
        if (client?.agency_id) {
          const { data: agencyAccess } = await supabase
            .from("user_agency_access")
            .select("category_id, can_edit")
            .eq("user_id", user.id)
            .eq("agency_id", client.agency_id)
            .eq("suspended", false);
          agencyAccess?.forEach(r => {
            if (r.category_id) categoryIds.add(r.category_id);
            if (r.can_edit) masterFlag = true;
          });
        }
      }

      // Campaign-level access
      if (campaignId) {
        const { data: campaignAccesses } = await supabase
          .from("user_campaign_access")
          .select("category_id")
          .eq("user_id", user.id)
          .eq("campaign_id", campaignId)
          .eq("suspended", false);
        campaignAccesses?.forEach(r => r.category_id && categoryIds.add(r.category_id));
      }

      if (masterFlag) return { ...ADMIN_PERMS };

      const cidArr = Array.from(categoryIds);
      if (cidArr.length === 0) return EMPTY_PERMS;

      // Compute per sub-area × action
      const result: LalPermissions = { ...EMPTY_PERMS };
      // canDeleteModule = legacy can_delete_loja_a_loja
      result.canDeleteModule = await checkAny(cidArr, "loja_a_loja", "delete", "can_delete_loja_a_loja");

      for (const sa of SUB_AREAS) {
        const perms: LalSubAreaPermission = { canView: false, canEdit: false, canDelete: false };
        for (const act of ACTIONS) {
          const granted = await checkAny(
            cidArr, sa.moduleKey, act, `can_${act}_${sa.legacy}`,
          );
          if (act === "view") perms.canView = granted;
          if (act === "edit") perms.canEdit = granted;
          if (act === "delete") perms.canDelete = granted;
        }
        result[sa.name] = perms;
      }

      result.canViewModule =
        result.estrutura.canView ||
        result.classificacao.canView ||
        result.acessos.canView ||
        result.config.canView ||
        result.ocorrencias.canView ||
        await checkAny(cidArr, "loja_a_loja", "view", "can_view_loja_a_loja");

      return result;
    },
    enabled: !!user && !isAdminOrMaster && (!!clientId || !!campaignId),
  });

  const isLoading = roleLoading || (!isAdminOrMaster && queryLoading);

  if (isAdminOrMaster) return ADMIN_PERMS;
  if (!data) return { ...EMPTY_PERMS, isLoading };
  return { ...data, isLoading };
}
