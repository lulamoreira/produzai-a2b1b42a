import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePreviewUser } from "@/hooks/usePreviewUser";

export type AppRole = "admin" | "master" | "viewer";

export function useUserRole() {
  const { user } = useAuth();
  const { previewUserId } = usePreviewUser();
  const effectiveId = previewUserId ?? user?.id;

  const { data: role, isLoading } = useQuery({
    queryKey: ["user_role", effectiveId],
    queryFn: async () => {
      if (!effectiveId) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", effectiveId)
        .maybeSingle();
      if (error) throw error;
      return (data?.role as AppRole) ?? "viewer";
    },
    enabled: !!effectiveId,
  });

  return {
    role: role ?? "viewer",
    isAdmin: role === "admin",
    isMaster: role === "master",
    isAdminOrMaster: role === "admin" || role === "master",
    isLoading,
  };
}
