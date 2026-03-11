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
      const { error } = await supabase.from("user_campaign_access").insert(access);
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
