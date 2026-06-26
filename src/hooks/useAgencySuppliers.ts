import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SupplierContact = {
  nome: string;
  funcao: string;
  email: string;
  telefone: string;
  whatsapp: string;
};

export type AgencySupplier = {
  id: string;
  agency_id: string;
  company_name: string;
  cnpj: string | null;
  contact_name: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  observations: string | null;
  services: string[];
  contacts: SupplierContact[];
  file_urls: { name: string; url?: string | null; path?: string | null }[];
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  created_at: string;
  updated_at: string;
};

export const VISUAL_COMMUNICATION_SERVICES = [
  "Marcenaria",
  "Impressão Digital (Grandes Formatos)",
  "Cenografia",
  "Serralheria",
  "Pintura",
  "Letra Caixa",
  "Neon / LED",
  "Instalação e Montagem",
  "Logística e Transporte",
  "Acrílico e Termoflagagem",
  "Comunicação Visual (Geral)",
  "Projetos 3D",
  "Impressão 3D",
  "Iluminação",
  "Adesivagem",
  "Fachadas",
  "Sinalização Interna",
  "Displays e Expositores",
  "Eventos",
];

export function useAgencySuppliers(agencyId: string | undefined) {
  return useQuery({
    queryKey: ["agency_suppliers", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("agency_suppliers")
        .select("*")
        .eq("agency_id", agencyId)
        .order("company_name", { ascending: true });
      if (error) throw error;
      return (data || []).map(s => ({
        ...s,
        services: Array.isArray(s.services) ? (s.services as string[]) : [],
        contacts: Array.isArray(s.contacts) ? (s.contacts as unknown as SupplierContact[]) : [],
        file_urls: Array.isArray(s.file_urls) ? (s.file_urls as unknown as { name: string; url?: string | null; path?: string | null }[]) : []
      })) as unknown as AgencySupplier[];
    },
    enabled: !!agencyId,
  });
}

export function useAddAgencySupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (supplier: Partial<AgencySupplier> & { agency_id: string; company_name: string }) => {
      const { data, error } = await supabase
        .from("agency_suppliers")
        .insert([supplier])
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AgencySupplier;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["agency_suppliers", data.agency_id] });
      toast.success("Fornecedor cadastrado com sucesso!");
    },
    onError: (e: any) => toast.error("Erro ao cadastrar fornecedor: " + (e.message || "")),
  });
}

export function useUpdateAgencySupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<AgencySupplier> & { id: string }) => {
      const { error } = await supabase.from("agency_suppliers").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["agency_suppliers"] });
      toast.success("Fornecedor atualizado com sucesso!");
    },
    onError: (e: any) => toast.error("Erro ao atualizar fornecedor: " + (e.message || "")),
  });
}

export function useDeleteAgencySupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agency_suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agency_suppliers"] });
      toast.success("Fornecedor removido com sucesso!");
    },
    onError: (e: any) => toast.error("Erro ao remover fornecedor: " + (e.message || "")),
  });
}
