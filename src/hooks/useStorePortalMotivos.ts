import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PortalMotivo {
  id: string;
  client_id: string;
  descricao: string;
  ativo: boolean;
  created_at: string | null;
}

export function useStorePortalMotivos(clientId: string | undefined, onlyActive = false) {
  return useQuery({
    queryKey: ["store-portal-motivos", clientId, onlyActive],
    enabled: !!clientId,
    queryFn: async () => {
      let q = supabase
        .from("store_portal_motivos" as any)
        .select("*")
        .eq("client_id", clientId!)
        .order("descricao", { ascending: true });
      if (onlyActive) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PortalMotivo[];
    },
  });
}

export function useAddMotivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { client_id: string; descricao: string }) => {
      const { error, data } = await supabase
        .from("store_portal_motivos" as any)
        .insert({ client_id: input.client_id, descricao: input.descricao.trim() })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["store-portal-motivos", vars.client_id] });
    },
  });
}

export function useUpdateMotivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; client_id: string; patch: Partial<PortalMotivo> }) => {
      const { error } = await supabase
        .from("store_portal_motivos" as any)
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["store-portal-motivos", vars.client_id] });
    },
  });
}

export function useDeleteMotivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; client_id: string }) => {
      const { error } = await supabase
        .from("store_portal_motivos" as any)
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["store-portal-motivos", vars.client_id] });
    },
  });
}
