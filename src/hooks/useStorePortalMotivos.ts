import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PortalMotivo {
  id: string;
  client_id: string;
  descricao: string;
  ativo: boolean;
  sort_order: number;
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
        .order("sort_order", { ascending: true })
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
      // Place new motivo at the end
      const { data: existing } = await supabase
        .from("store_portal_motivos" as any)
        .select("sort_order")
        .eq("client_id", input.client_id)
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextOrder =
        existing && existing.length > 0 ? ((existing[0] as any).sort_order ?? 0) + 1 : 0;
      const { error, data } = await supabase
        .from("store_portal_motivos" as any)
        .insert({
          client_id: input.client_id,
          descricao: input.descricao.trim(),
          sort_order: nextOrder,
        })
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

export function useReorderMotivos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { client_id: string; orderedIds: string[] }) => {
      // Update each row with its new sort_order
      const updates = input.orderedIds.map((id, idx) =>
        supabase
          .from("store_portal_motivos" as any)
          .update({ sort_order: idx })
          .eq("id", id),
      );
      const results = await Promise.all(updates);
      const firstErr = results.find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["store-portal-motivos", vars.client_id] });
      const previous = qc.getQueriesData({ queryKey: ["store-portal-motivos", vars.client_id] });
      previous.forEach(([key, data]) => {
        if (!Array.isArray(data)) return;
        const map = new Map((data as PortalMotivo[]).map((m) => [m.id, m]));
        const reordered = vars.orderedIds
          .map((id, idx) => {
            const m = map.get(id);
            return m ? { ...m, sort_order: idx } : null;
          })
          .filter(Boolean);
        qc.setQueryData(key, reordered);
      });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      ctx?.previous?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ["store-portal-motivos", vars.client_id] });
    },
  });
}
