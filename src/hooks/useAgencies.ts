import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Agency = {
  id: string;
  name: string;
  created_at: string;
};

export function useAgencies() {
  return useQuery({
    queryKey: ["agencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Agency[];
    },
  });
}

export function useAddAgency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (agency: { name: string }) => {
      const { error } = await supabase.from("agencies").insert(agency);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agencies"] });
      toast.success("Agência criada!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteAgency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agencies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agencies"] });
      toast.success("Agência removida!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}
