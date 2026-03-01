import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

type PermissionKey =
  | "can_view_clients" | "can_edit_clients" | "can_delete_clients"
  | "can_view_campaigns" | "can_edit_campaigns" | "can_delete_campaigns"
  | "can_view_stores" | "can_edit_stores" | "can_delete_stores"
  | "can_view_pieces" | "can_edit_pieces" | "can_delete_pieces"
  | "can_view_occurrences" | "can_edit_occurrences" | "can_delete_occurrences";

export function useClientPermission(clientId?: string, permission?: PermissionKey) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  const { data: hasPermission = false, isLoading } = useQuery({
    queryKey: ["client_permission", user?.id, clientId, permission],
    queryFn: async () => {
      if (!user || !clientId || !permission) return false;
      if (isAdmin) return true;

      const { data, error } = await supabase
        .from("user_client_access")
        .select("category_id, permission_categories(*)")
        .eq("user_id", user.id)
        .eq("client_id", clientId)
        .maybeSingle();

      if (error || !data?.permission_categories) return false;
      const pc = data.permission_categories as Record<string, unknown>;
      return !!pc[permission];
    },
    enabled: !!user && !!clientId && !!permission,
  });

  return { hasPermission: isAdmin || hasPermission, isLoading };
}
