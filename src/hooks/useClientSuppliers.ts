import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ClientSupplier = {
  id: string;
  client_id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string;
  observations: string | null;
  created_at: string;
  updated_at: string;
};

export function useClientSuppliers(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client_suppliers", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("client_suppliers")
        .select("*")
        .eq("client_id", clientId)
        .order("company_name", { ascending: true });
      if (error) throw error;
      return data as ClientSupplier[];
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000, // reference data — rarely changes
  });
}

export function useAddClientSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      supplier: Partial<ClientSupplier> & { client_id: string; company_name: string; email: string },
    ) => {
      const { data, error } = await supabase
        .from("client_suppliers")
        .insert(supplier)
        .select()
        .single();
      if (error) throw error;
      return data as ClientSupplier;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["client_suppliers", vars.client_id] });
      qc.invalidateQueries({ queryKey: ["client_suppliers"] });
      toast.success("Fornecedor adicionado!");
    },
    onError: (e: any) => toast.error("Erro: " + (e.message || "")),
  });
}

export function useUpdateClientSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ClientSupplier> & { id: string }) => {
      const { error } = await supabase.from("client_suppliers").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      if (vars.client_id) {
        qc.invalidateQueries({ queryKey: ["client_suppliers", vars.client_id] });
      }
      qc.invalidateQueries({ queryKey: ["client_suppliers"] });
      toast.success("Fornecedor atualizado!");
    },
    onError: (e: any) => toast.error("Erro: " + (e.message || "")),
  });
}

export function useDeleteClientSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_suppliers"] });
      toast.success("Fornecedor removido!");
    },
    onError: (e: any) => toast.error("Erro: " + (e.message || "")),
  });
}
