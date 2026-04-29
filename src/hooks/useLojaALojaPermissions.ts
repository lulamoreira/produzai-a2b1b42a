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

type PCRow = Record<string, unknown>;

function mergeFlag(acc: PCRow, pc: PCRow, key: string) {
  if (pc[key]) acc[key] = true;
}

function mergePermissions(rows: PCRow[]): PCRow {
  const acc: PCRow = {};
  const keys = [
    "can_view_loja_a_loja", "can_edit_loja_a_loja", "can_delete_loja_a_loja",
    "can_view_lal_estrutura", "can_edit_lal_estrutura", "can_delete_lal_estrutura",
    "can_view_lal_classificacao", "can_edit_lal_classificacao", "can_delete_lal_classificacao",
    "can_view_lal_acessos", "can_edit_lal_acessos", "can_delete_lal_acessos",
    "can_view_lal_config", "can_edit_lal_config", "can_delete_lal_config",
    "can_view_lal_ocorrencias", "can_edit_lal_ocorrencias", "can_delete_lal_ocorrencias",
  ];
  for (const r of rows) {
    for (const k of keys) mergeFlag(acc, r, k);
  }
  return acc;
}

/**
 * Returns granular Loja a Loja permissions for the current user, scoped to the
 * given campaign/client. Admins and Masters always get full access. Other users
 * inherit the highest level of permission across direct client, agency, and
 * campaign-level access categories.
 */
export function useLojaALojaPermissions(
  campaignId: string | undefined,
  clientId: string | undefined,
): LalPermissions {
  const { user } = useAuth();
  const { isAdminOrMaster, isLoading: roleLoading } = useUserRole();

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ["lal_permissions", user?.id, clientId, campaignId],
    queryFn: async (): Promise<PCRow> => {
      if (!user || (!clientId && !campaignId)) return {};

      const rows: PCRow[] = [];

      // Master flag: legacy can_edit on client/agency access grants full LAL access
      const masterRow: PCRow = {
        can_view_loja_a_loja: true, can_edit_loja_a_loja: true, can_delete_loja_a_loja: true,
        can_view_lal_estrutura: true, can_edit_lal_estrutura: true, can_delete_lal_estrutura: true,
        can_view_lal_classificacao: true, can_edit_lal_classificacao: true, can_delete_lal_classificacao: true,
        can_view_lal_acessos: true, can_edit_lal_acessos: true, can_delete_lal_acessos: true,
        can_view_lal_config: true, can_edit_lal_config: true, can_delete_lal_config: true,
        can_view_lal_ocorrencias: true, can_edit_lal_ocorrencias: true, can_delete_lal_ocorrencias: true,
      };

      // Direct client access
      if (clientId) {
        const { data: clientAccess } = await supabase
          .from("user_client_access")
          .select("suspended, can_edit, permission_categories(*)")
          .eq("user_id", user.id)
          .eq("client_id", clientId)
          .eq("suspended", false)
          .maybeSingle();
        if (clientAccess?.permission_categories) {
          rows.push(clientAccess.permission_categories as PCRow);
        }
        if (clientAccess?.can_edit) rows.push(masterRow);

        // Agency-level access (inherited)
        const { data: client } = await supabase
          .from("clients")
          .select("agency_id")
          .eq("id", clientId)
          .maybeSingle();
        if (client?.agency_id) {
          const { data: agencyAccess } = await supabase
            .from("user_agency_access")
            .select("suspended, can_edit, permission_categories(*)")
            .eq("user_id", user.id)
            .eq("agency_id", client.agency_id)
            .eq("suspended", false)
            .maybeSingle();
          if (agencyAccess?.permission_categories) {
            rows.push(agencyAccess.permission_categories as PCRow);
          }
          if (agencyAccess?.can_edit) rows.push(masterRow);
        }
      }

      // Campaign-level access
      if (campaignId) {
        const { data: campaignAccesses } = await supabase
          .from("user_campaign_access")
          .select("suspended, permission_categories(*)")
          .eq("user_id", user.id)
          .eq("campaign_id", campaignId)
          .eq("suspended", false);
        if (campaignAccesses) {
          for (const ca of campaignAccesses) {
            if (ca.permission_categories) rows.push(ca.permission_categories as PCRow);
          }
        }
      }

      return mergePermissions(rows);
    },
    enabled: !!user && !isAdminOrMaster && (!!clientId || !!campaignId),
  });

  const isLoading = roleLoading || (!isAdminOrMaster && queryLoading);

  if (isAdminOrMaster) return ADMIN_PERMS;
  if (!data) return { ...EMPTY_PERMS, isLoading };

  const p = data;
  return {
    canViewModule:
      !!p.can_view_loja_a_loja ||
      !!p.can_view_lal_estrutura ||
      !!p.can_view_lal_classificacao ||
      !!p.can_view_lal_acessos ||
      !!p.can_view_lal_config ||
      !!p.can_view_lal_ocorrencias,
    canDeleteModule: !!p.can_delete_loja_a_loja,
    estrutura: {
      canView: !!p.can_view_lal_estrutura,
      canEdit: !!p.can_edit_lal_estrutura,
      canDelete: !!p.can_delete_lal_estrutura,
    },
    classificacao: {
      canView: !!p.can_view_lal_classificacao,
      canEdit: !!p.can_edit_lal_classificacao,
      canDelete: !!p.can_delete_lal_classificacao,
    },
    acessos: {
      canView: !!p.can_view_lal_acessos,
      canEdit: !!p.can_edit_lal_acessos,
      canDelete: !!p.can_delete_lal_acessos,
    },
    config: {
      canView: !!p.can_view_lal_config,
      canEdit: !!p.can_edit_lal_config,
      canDelete: !!p.can_delete_lal_config,
    },
    ocorrencias: {
      canView: !!p.can_view_lal_ocorrencias,
      canEdit: !!p.can_edit_lal_ocorrencias,
      canDelete: !!p.can_delete_lal_ocorrencias,
    },
    isLoading,
  };
}
