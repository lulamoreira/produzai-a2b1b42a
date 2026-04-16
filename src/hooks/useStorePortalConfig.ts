import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PortalConfig {
  id: string;
  campaign_id: string;
  module_conformidade: boolean;
  module_ocorrencias: boolean;
  module_manutencao: boolean;
  module_reposicoes: boolean;
  deadline_conformidade: string | null;
  deadline_ocorrencias: string | null;
  deadline_manutencao: string | null;
  deadline_reposicoes: string | null;
  portal_title: string | null;
  portal_welcome_message: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface StoreOverride {
  id: string;
  campaign_id: string;
  store_id: string;
  module_conformidade: boolean | null;
  module_ocorrencias: boolean | null;
  module_manutencao: boolean | null;
  module_reposicoes: boolean | null;
  created_at: string | null;
  store_name?: string;
  store_city?: string | null;
  store_state?: string | null;
  store_code?: string | null;
}

const DEFAULT_CONFIG: Omit<PortalConfig, "id" | "campaign_id" | "created_at" | "updated_at"> = {
  module_conformidade: true,
  module_ocorrencias: true,
  module_manutencao: true,
  module_reposicoes: true,
  deadline_conformidade: null,
  deadline_ocorrencias: null,
  deadline_manutencao: null,
  deadline_reposicoes: null,
  portal_title: null,
  portal_welcome_message: null,
};

export function useStorePortalConfig(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["store-portal-config", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_portal_config")
        .select("*")
        .eq("campaign_id", campaignId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { ...DEFAULT_CONFIG, campaign_id: campaignId! } as Partial<PortalConfig>;
      return data as PortalConfig;
    },
  });
}

export function useUpsertPortalConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { campaign_id: string } & Partial<Omit<PortalConfig, "id" | "created_at" | "updated_at">>) => {
      const { data, error } = await supabase
        .from("store_portal_config")
        .upsert(params, { onConflict: "campaign_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(["store-portal-config", data.campaign_id], data);
    },
    onError: (e: any) => toast.error("Erro ao salvar config: " + e.message),
  });
}

export function useStorePortalOverrides(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["store-portal-overrides", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_portal_store_overrides")
        .select("*, client_stores(name, city, state, store_code)")
        .eq("campaign_id", campaignId!);
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        ...row,
        store_name: row.client_stores?.name,
        store_city: row.client_stores?.city,
        store_state: row.client_stores?.state,
        store_code: row.client_stores?.store_code,
      })) as StoreOverride[];
    },
  });
}

export function useUpsertStoreOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      campaign_id: string;
      store_id: string;
      module_conformidade?: boolean | null;
      module_ocorrencias?: boolean | null;
      module_manutencao?: boolean | null;
      module_reposicoes?: boolean | null;
    }) => {
      const { data, error } = await supabase
        .from("store_portal_store_overrides")
        .upsert(params, { onConflict: "campaign_id,store_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["store-portal-overrides", v.campaign_id] });
    },
    onError: (e: any) => toast.error("Erro ao salvar override: " + e.message),
  });
}

export function useBulkSetOverrides() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      campaign_id: string;
      store_ids: string[];
      values: {
        module_conformidade?: boolean | null;
        module_ocorrencias?: boolean | null;
        module_manutencao?: boolean | null;
        module_reposicoes?: boolean | null;
      };
    }) => {
      const rows = params.store_ids.map((store_id) => ({
        campaign_id: params.campaign_id,
        store_id,
        ...params.values,
      }));
      const { error } = await supabase
        .from("store_portal_store_overrides")
        .upsert(rows, { onConflict: "campaign_id,store_id" });
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["store-portal-overrides", v.campaign_id] });
      toast.success("Configurações atualizadas");
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message),
  });
}
