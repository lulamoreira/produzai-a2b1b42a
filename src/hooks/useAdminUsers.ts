import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AppRole } from "./useUserRole";

export type UserWithRole = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: AppRole;
  created_at: string;
};

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin_users_list"],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, display_name, created_at");
      if (pErr) throw pErr;

      // Fetch roles
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rErr) throw rErr;

      const roleMap = new Map(roles.map((r) => [r.user_id, r.role as AppRole]));

      return profiles.map((p) => ({
        user_id: p.user_id,
        email: "", // will be enriched if needed
        display_name: p.display_name,
        role: roleMap.get(p.user_id) ?? "viewer",
        created_at: p.created_at,
      })) as UserWithRole[];
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users_list"] });
      toast.success("Role atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar role: " + error.message);
    },
  });
}
