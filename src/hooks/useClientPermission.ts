import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

type PermissionKey =
  | "can_view_clients" | "can_edit_clients" | "can_delete_clients"
  | "can_view_campaigns" | "can_edit_campaigns" | "can_delete_campaigns"
  | "can_view_stores" | "can_edit_stores" | "can_delete_stores"
  | "can_view_campaign_stores" | "can_edit_campaign_stores" | "can_delete_campaign_stores"
  | "can_view_pieces" | "can_edit_pieces" | "can_delete_pieces"
  | "can_view_occurrences" | "can_edit_occurrences" | "can_delete_occurrences"
  | "can_view_schedules" | "can_edit_schedules" | "can_delete_schedules"
  | "can_edit_reporter_data";

export function useClientPermission(clientId?: string, permission?: PermissionKey) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  const { data: hasPermission = false, isLoading } = useQuery({
    queryKey: ["client_permission", user?.id, clientId, permission],
    queryFn: async () => {
      if (!user || !clientId || !permission) return false;
      if (isAdmin) return true;

      // Check direct client access
      const { data: clientAccess } = await supabase
        .from("user_client_access")
        .select("category_id, suspended, permission_categories(*)")
        .eq("user_id", user.id)
        .eq("client_id", clientId)
        .eq("suspended", false)
        .maybeSingle();

      if (clientAccess?.permission_categories) {
        const pc = clientAccess.permission_categories as Record<string, unknown>;
        if (!!pc[permission]) return true;
      }

      // Check agency-level access (inherited)
      const { data: client } = await supabase
        .from("clients")
        .select("agency_id")
        .eq("id", clientId)
        .single();

      if (client?.agency_id) {
        const { data: agencyAccess } = await supabase
          .from("user_agency_access")
          .select("category_id, suspended, permission_categories(*)")
          .eq("user_id", user.id)
          .eq("agency_id", client.agency_id)
          .eq("suspended", false)
          .maybeSingle();

        if (agencyAccess?.permission_categories) {
          const pc = agencyAccess.permission_categories as Record<string, unknown>;
          if (!!pc[permission]) return true;
        }
      }

      return false;
    },
    enabled: !!user && !!clientId && !!permission,
  });

  return { hasPermission: isAdmin || hasPermission, isLoading };
}
