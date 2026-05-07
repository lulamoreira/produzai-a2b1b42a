import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TratativaStatus {
  id: string;
  client_id: string;
  value: string;
  label: string;
  color: string;
  display_order: number;
  is_default: boolean;
  is_resolved: boolean;
  ativo: boolean;
}

/** Built-in fallback statuses used when the client has no custom statuses configured. */
export const FALLBACK_TRATATIVA_STATUSES: Omit<TratativaStatus, "id" | "client_id">[] = [
  { value: "aberta", label: "Aberta", color: "#6366f1", display_order: 0, is_default: true, is_resolved: false, ativo: true },
  { value: "em_andamento", label: "Em andamento", color: "#f59e0b", display_order: 1, is_default: false, is_resolved: false, ativo: true },
  { value: "resolvida", label: "Resolvida", color: "#22c55e", display_order: 2, is_default: false, is_resolved: true, ativo: true },
];

export function useLalTratativaStatuses(clientId: string | undefined, onlyActive = false) {
  return useQuery({
    queryKey: ["lal-tratativa-statuses", clientId, onlyActive],
    enabled: !!clientId,
    queryFn: async () => {
      let q = supabase
        .from("lal_tratativa_statuses" as any)
        .select("*")
        .eq("client_id", clientId!)
        .order("display_order", { ascending: true });
      if (onlyActive) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as TratativaStatus[];
    },
  });
}

/** Returns custom statuses if set, else fallback. */
export function useEffectiveTratativaStatuses(clientId: string | undefined) {
  const { data, isLoading } = useLalTratativaStatuses(clientId, true);
  const list: Omit<TratativaStatus, "id" | "client_id">[] = data && data.length > 0 ? data : FALLBACK_TRATATIVA_STATUSES;
  return { statuses: list, isLoading };
}

function slugify(s: string) {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export function useAddTratativaStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { client_id: string; label: string; color?: string; is_resolved?: boolean }) => {
      const baseValue = slugify(input.label);
      // ensure unique value
      const { data: existing } = await supabase
        .from("lal_tratativa_statuses" as any)
        .select("value, display_order")
        .eq("client_id", input.client_id);
      const used = new Set((existing as any[] | null ?? []).map((r) => r.value));
      let value = baseValue || "status";
      let i = 1;
      while (used.has(value)) value = `${baseValue}_${++i}`;
      const nextOrder = Math.max(-1, ...((existing as any[] | null ?? []).map((r) => r.display_order ?? 0))) + 1;
      const { error } = await supabase
        .from("lal_tratativa_statuses" as any)
        .insert({
          client_id: input.client_id,
          value,
          label: input.label.trim(),
          color: input.color ?? "#8C6F4E",
          display_order: nextOrder,
          is_resolved: !!input.is_resolved,
          ativo: true,
        });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["lal-tratativa-statuses", vars.client_id] }),
  });
}

export function useUpdateTratativaStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; client_id: string; patch: Partial<TratativaStatus> }) => {
      const { error } = await supabase
        .from("lal_tratativa_statuses" as any)
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["lal-tratativa-statuses", vars.client_id] }),
  });
}

export function useDeleteTratativaStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; client_id: string }) => {
      const { error } = await supabase
        .from("lal_tratativa_statuses" as any)
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["lal-tratativa-statuses", vars.client_id] }),
  });
}

export function useReorderTratativaStatuses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { client_id: string; orderedIds: string[] }) => {
      const updates = input.orderedIds.map((id, idx) =>
        supabase.from("lal_tratativa_statuses" as any).update({ display_order: idx }).eq("id", id),
      );
      const results = await Promise.all(updates);
      const firstErr = results.find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["lal-tratativa-statuses", vars.client_id] }),
  });
}

/** When user marks one as default, ensure the others are not default. */
export function useSetDefaultTratativaStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; client_id: string }) => {
      // Clear existing default
      const { error: e1 } = await supabase
        .from("lal_tratativa_statuses" as any)
        .update({ is_default: false })
        .eq("client_id", input.client_id)
        .eq("is_default", true);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("lal_tratativa_statuses" as any)
        .update({ is_default: true })
        .eq("id", input.id);
      if (e2) throw e2;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["lal-tratativa-statuses", vars.client_id] }),
  });
}
