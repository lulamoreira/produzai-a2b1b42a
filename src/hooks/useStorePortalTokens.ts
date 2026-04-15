import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface StorePortalToken {
  id: string;
  campaign_id: string;
  store_id: string;
  token: string;
  created_at: string;
  client_stores?: {
    name: string;
    city: string | null;
    state: string | null;
    store_code: string | null;
  };
}

export function useStorePortalTokens(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["store-portal-tokens", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_portal_tokens")
        .select("*, client_stores(name, city, state, store_code)")
        .eq("campaign_id", campaignId!);
      if (error) throw error;
      return (data ?? []) as StorePortalToken[];
    },
  });
}

export function useGenerateStoreToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { campaign_id: string; store_id: string }) => {
      const { data, error } = await supabase
        .from("store_portal_tokens")
        .upsert(
          { campaign_id: params.campaign_id, store_id: params.store_id },
          { onConflict: "campaign_id,store_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["store-portal-tokens", v.campaign_id] });
      toast.success("Link gerado");
    },
    onError: (e: any) => toast.error("Erro ao gerar link: " + e.message),
  });
}

export function useDeleteStoreToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; campaign_id: string }) => {
      const { error } = await supabase
        .from("store_portal_tokens")
        .delete()
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["store-portal-tokens", v.campaign_id] });
      toast.success("Link removido");
    },
    onError: (e: any) => toast.error("Erro ao remover link: " + e.message),
  });
}

export function useGenerateAllStoreTokens() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      // Get all distinct store_ids from loja_a_loja_lojas
      const { data: lojas, error: lErr } = await supabase
        .from("loja_a_loja_lojas")
        .select("store_id")
        .eq("campaign_id", campaignId)
        .eq("ativo", true);
      if (lErr) throw lErr;

      const uniqueStoreIds = [...new Set((lojas || []).map((l) => l.store_id))];
      if (uniqueStoreIds.length === 0) return 0;

      const rows = uniqueStoreIds.map((store_id) => ({
        campaign_id: campaignId,
        store_id,
      }));

      const { error } = await supabase
        .from("store_portal_tokens")
        .upsert(rows, { onConflict: "campaign_id,store_id" });
      if (error) throw error;
      return uniqueStoreIds.length;
    },
    onSuccess: (count, campaignId) => {
      qc.invalidateQueries({ queryKey: ["store-portal-tokens", campaignId] });
      toast.success(`${count} links gerados`);
    },
    onError: (e: any) => toast.error("Erro ao gerar links: " + e.message),
  });
}
