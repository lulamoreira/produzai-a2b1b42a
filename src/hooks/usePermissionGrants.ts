/**
 * Permission Grants — Phase 1 hooks for the new flexible permission schema.
 *
 * These hooks read/write the new `permission_grants` table. They live alongside
 * the existing boolean-column hooks (useClientPermission, etc.) — nothing in the
 * legacy code path uses these yet.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PermissionGrant {
  id: string;
  category_id: string;
  module_key: string;
  action: string;
  granted: boolean;
  created_at?: string;
}

export function useCategoryGrants(categoryId: string | undefined) {
  return useQuery({
    queryKey: ["permission_grants", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permission_grants")
        .select("*")
        .eq("category_id", categoryId!);
      if (error) throw error;
      return (data || []) as PermissionGrant[];
    },
  });
}

interface ToggleGrantVars {
  categoryId: string;
  moduleKey: string;
  action: string;
  granted: boolean;
}

export function useToggleGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: ToggleGrantVars) => {
      if (params.granted) {
        const { error } = await supabase
          .from("permission_grants")
          .upsert(
            {
              category_id: params.categoryId,
              module_key: params.moduleKey,
              action: params.action,
              granted: true,
            },
            { onConflict: "category_id,module_key,action" },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("permission_grants")
          .delete()
          .eq("category_id", params.categoryId)
          .eq("module_key", params.moduleKey)
          .eq("action", params.action);
        if (error) throw error;
      }
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["permission_grants", vars.categoryId] });
      const prev = qc.getQueryData<PermissionGrant[]>(["permission_grants", vars.categoryId]);
      qc.setQueryData<PermissionGrant[] | undefined>(
        ["permission_grants", vars.categoryId],
        (old) => {
          if (!old) return old;
          if (vars.granted) {
            const exists = old.find(
              (g) => g.module_key === vars.moduleKey && g.action === vars.action,
            );
            if (exists) return old;
            return [
              ...old,
              {
                id: "temp-" + Date.now(),
                category_id: vars.categoryId,
                module_key: vars.moduleKey,
                action: vars.action,
                granted: true,
              },
            ];
          }
          return old.filter(
            (g) => !(g.module_key === vars.moduleKey && g.action === vars.action),
          );
        },
      );
      return { prev };
    },
    onError: (_e, vars, ctx) => {
      const c = ctx as { prev?: PermissionGrant[] } | undefined;
      if (c?.prev) qc.setQueryData(["permission_grants", vars.categoryId], c.prev);
      toast.error("Erro ao salvar permissão");
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ["permission_grants", vars.categoryId] });
    },
  });
}

interface BulkSetGrantsVars {
  categoryId: string;
  grants: { module_key: string; action: string }[];
  clearOthers?: boolean;
}

export function useBulkSetGrants() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: BulkSetGrantsVars) => {
      if (params.clearOthers) {
        const { error: delErr } = await supabase
          .from("permission_grants")
          .delete()
          .eq("category_id", params.categoryId);
        if (delErr) throw delErr;
      }
      if (params.grants.length === 0) return;
      const rows = params.grants.map((g) => ({
        category_id: params.categoryId,
        module_key: g.module_key,
        action: g.action,
        granted: true,
      }));
      const { error } = await supabase
        .from("permission_grants")
        .upsert(rows, { onConflict: "category_id,module_key,action" });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["permission_grants", vars.categoryId] });
      toast.success("Permissões atualizadas");
    },
    onError: (e: Error) => toast.error(e?.message || "Erro ao aplicar permissões"),
  });
}

export function useUserCountByCategory(categoryId: string | undefined) {
  return useQuery({
    queryKey: ["user_count_by_category", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const [agency, client, campaign] = await Promise.all([
        supabase
          .from("user_agency_access")
          .select("*", { count: "exact", head: true })
          .eq("category_id", categoryId!),
        supabase
          .from("user_client_access")
          .select("*", { count: "exact", head: true })
          .eq("category_id", categoryId!),
        supabase
          .from("user_campaign_access")
          .select("*", { count: "exact", head: true })
          .eq("category_id", categoryId!),
      ]);
      return (agency.count || 0) + (client.count || 0) + (campaign.count || 0);
    },
  });
}
