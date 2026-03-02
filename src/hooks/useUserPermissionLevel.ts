import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Checks if the current user has a specific permission category name
 * (e.g. 'Master', 'Editor') assigned via client or agency access.
 */
export function useUserPermissionLevel() {
  const { user } = useAuth();

  const { data: categoryNames = [], isLoading } = useQuery({
    queryKey: ["user_permission_categories", user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Check client-level access
      const { data: clientAccess } = await supabase
        .from("user_client_access")
        .select("category_id")
        .eq("user_id", user.id)
        .eq("suspended", false);
      // Check agency-level access
      const { data: agencyAccess } = await supabase
        .from("user_agency_access")
        .select("category_id")
        .eq("user_id", user.id)
        .eq("suspended", false);

      const categoryIds = [
        ...(clientAccess || []).map((a) => a.category_id),
        ...(agencyAccess || []).map((a) => a.category_id),
      ].filter(Boolean) as string[];

      if (categoryIds.length === 0) return [];

      const uniqueIds = [...new Set(categoryIds)];
      const { data: categories } = await supabase
        .from("permission_categories")
        .select("name")
        .in("id", uniqueIds);

      return [...new Set((categories || []).map((c) => c.name))];
    },
    enabled: !!user,
  });

  return {
    categoryNames,
    isMaster: categoryNames.includes("Master"),
    isEditor: categoryNames.includes("Editor"),
    isMasterOrEditor: categoryNames.includes("Master") || categoryNames.includes("Editor"),
    isLoading,
  };
}
