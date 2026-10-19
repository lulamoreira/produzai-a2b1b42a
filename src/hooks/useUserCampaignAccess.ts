import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type UserCampaignAccess = {
  id: string;
  user_id: string;
  campaign_id: string;
  category_id: string | null;
  suspended: boolean;
  created_at: string;
};

export function useUserCampaignAccess() {
  return useQuery({
    queryKey: ["user_campaign_access"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_campaign_access")
        .select("*");
      if (error) throw error;
      return data as UserCampaignAccess[];
    },
  });
}

export function useAddUserCampaignAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (access: { user_id: string; campaign_id: string; category_id?: string }) => {
      // Sempre grava na campanha vigente (mais recente) da cadeia de renegociação
      // e remove o acesso do usuário nas demais campanhas da mesma cadeia.
      const { error } = await supabase.rpc("grant_campaign_access_latest", {
        _user_id: access.user_id,
        _campaign_id: access.campaign_id,
        _category_id: access.category_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_campaign_access"] });
      toast.success("Acesso à campanha concedido!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateUserCampaignAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; category_id?: string; suspended?: boolean }) => {
      const { error } = await supabase.from("user_campaign_access").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_campaign_access"] });
      toast.success("Acesso atualizado!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteUserCampaignAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_campaign_access").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_campaign_access"] });
      toast.success("Acesso à campanha removido!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}
