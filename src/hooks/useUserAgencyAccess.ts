import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type UserAgencyAccess = {
  id: string;
  user_id: string;
  agency_id: string;
  category_id: string | null;
  can_edit: boolean;
  suspended: boolean;
  created_at: string;
};

export function useUserAgencyAccess() {
  return useQuery({
    queryKey: ["user_agency_access"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_agency_access")
        .select("*");
      if (error) throw error;
      return data as UserAgencyAccess[];
    },
  });
}

export function useAddUserAgencyAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (access: { user_id: string; agency_id: string; category_id?: string; can_edit?: boolean }) => {
      const { error } = await supabase.from("user_agency_access").insert(access);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_agency_access"] });
      toast.success("Acesso à agência concedido!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateUserAgencyAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; category_id?: string; can_edit?: boolean; suspended?: boolean }) => {
      const { error } = await supabase.from("user_agency_access").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_agency_access"] });
      toast.success("Acesso atualizado!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteUserAgencyAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_agency_access").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_agency_access"] });
      toast.success("Acesso à agência removido!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}
