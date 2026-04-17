import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PermissionCategory = {
  id: string;
  name: string;
  can_view_clients: boolean;
  can_edit_clients: boolean;
  can_delete_clients: boolean;
  can_view_campaigns: boolean;
  can_edit_campaigns: boolean;
  can_delete_campaigns: boolean;
  can_view_stores: boolean;
  can_edit_stores: boolean;
  can_delete_stores: boolean;
  can_view_campaign_stores: boolean;
  can_edit_campaign_stores: boolean;
  can_delete_campaign_stores: boolean;
  can_view_pieces: boolean;
  can_edit_pieces: boolean;
  can_delete_pieces: boolean;
  can_view_occurrences: boolean;
  can_edit_occurrences: boolean;
  can_delete_occurrences: boolean;
  can_view_schedules: boolean;
  can_edit_schedules: boolean;
  can_delete_schedules: boolean;
  can_view_installations: boolean;
  can_edit_installations: boolean;
  can_delete_installations: boolean;
  can_edit_reporter_data: boolean;
  can_manage_team_codes: boolean;
  can_lock_cards: boolean;
  can_view_photo_checkin: boolean;
  can_view_loja_a_loja: boolean;
  can_edit_loja_a_loja: boolean;
  can_delete_loja_a_loja?: boolean;
  can_view_lal_estrutura?: boolean;
  can_edit_lal_estrutura?: boolean;
  can_delete_lal_estrutura?: boolean;
  can_view_lal_classificacao?: boolean;
  can_edit_lal_classificacao?: boolean;
  can_delete_lal_classificacao?: boolean;
  can_view_lal_acessos?: boolean;
  can_edit_lal_acessos?: boolean;
  can_delete_lal_acessos?: boolean;
  can_view_lal_config?: boolean;
  can_edit_lal_config?: boolean;
  can_delete_lal_config?: boolean;
  can_view_lal_ocorrencias?: boolean;
  can_edit_lal_ocorrencias?: boolean;
  can_delete_lal_ocorrencias?: boolean;
  created_at: string;
};

export function usePermissionCategories() {
  return useQuery({
    queryKey: ["permission_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permission_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as PermissionCategory[];
    },
  });
}

export function useAddPermissionCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (category: Omit<PermissionCategory, "id" | "created_at">) => {
      const { error } = await supabase.from("permission_categories").insert(category);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permission_categories"] });
      toast.success("Role criado!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useUpdatePermissionCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<PermissionCategory> & { id: string }) => {
      const { error } = await supabase.from("permission_categories").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permission_categories"] });
      toast.success("Role atualizado!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useDeletePermissionCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("permission_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permission_categories"] });
      toast.success("Role removido!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}
