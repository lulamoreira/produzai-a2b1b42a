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
  can_view_pieces: boolean;
  can_edit_pieces: boolean;
  can_delete_pieces: boolean;
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
      toast.success("Categoria criada!");
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
      toast.success("Categoria atualizada!");
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
      toast.success("Categoria removida!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}
