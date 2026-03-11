import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "admin" | "master" | "viewer";

export function useUserRole() {
  const { user } = useAuth();

  const { data: role, isLoading } = useQuery({
    queryKey: ["user_role", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.role as AppRole) ?? "viewer";
    },
    enabled: !!user,
  });

  return {
    role: role ?? "viewer",
    isAdmin: role === "admin",
    isMaster: role === "master",
    isAdminOrMaster: role === "admin" || role === "master",
    isLoading,
  };
}
