import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserAgencyAccess } from "@/hooks/useUserAgencyAccess";
import { useUserDirectAccess } from "@/hooks/useUserDirectAccess";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSidebarPermissions() {
  const { user } = useAuth();
  const { isAdmin, isMaster, isAdminOrMaster, isLoading: roleLoading } = useUserRole();
  const { isLimited, campaigns: limitedCampaigns, isLoading: accessLoading } = useUserDirectAccess();
  const { data: allAgencyAccess = [], isLoading: agencyAccessLoading } = useUserAgencyAccess();
  
  const isLoading = roleLoading || accessLoading || agencyAccessLoading;

  // Check if user has access to a specific agency
  const hasAgencyAccess = (agencyId: string) => {
    if (isAdminOrMaster) return true;
    return allAgencyAccess.some(a => a.agency_id === agencyId && a.user_id === user?.id && !a.suspended);
  };

  return {
    isAdmin,
    isMaster,
    isAdminOrMaster,
    isLimited,
    limitedCampaigns,
    hasAgencyAccess,
    isLoading
  };
}
