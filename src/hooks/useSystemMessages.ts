import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemMessage {
  id: string;
  key: string;
  category: string;
  content: string;
  agency_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useSystemMessages() {
  return useQuery({
    queryKey: ["system_messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_messages" as any)
        .select("*")
        .order("category")
        .order("key");
      if (error) throw error;
      return (data || []) as unknown as SystemMessage[];
    },
  });
}

export function useUpdateSystemMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from("system_messages" as any)
        .update({ content, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system_messages"] }),
  });
}

export function useCreateSystemMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (msg: { key: string; category: string; content: string; agency_id: string | null }) => {
      const { error } = await supabase
        .from("system_messages" as any)
        .insert(msg as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system_messages"] }),
  });
}

export function useDeleteSystemMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("system_messages" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system_messages"] }),
  });
}
