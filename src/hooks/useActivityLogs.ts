import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ActivityLog {
  id: string;
  campaign_id: string;
  store_id: string;
  user_id: string;
  module: string;
  action: string;
  details: string | null;
  created_at: string;
  author_name?: string;
}

export function useActivityLogs(campaignId: string, storeId: string, module: string) {
  return useQuery({
    queryKey: ["activity_logs", campaignId, storeId, module],
    enabled: !!campaignId && !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("store_id", storeId)
        .eq("module", module)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      const userIds = [...new Set((data || []).map((d: any) => d.user_id).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, nickname")
          .in("user_id", userIds);
        if (profiles) {
          for (const p of profiles) {
            profileMap[p.user_id] = p.nickname || p.display_name || "Sistema";
          }
        }
      }
      return (data || []).map((d: any) => ({
        ...d,
        author_name: profileMap[d.user_id] || "Sistema",
      })) as ActivityLog[];
    },
  });
}

export function useLogActivity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      campaign_id: string;
      store_id: string;
      module: string;
      action: string;
      details?: string;
    }) => {
      if (!user) return;
      const { error } = await supabase.from("activity_logs").insert({
        campaign_id: params.campaign_id,
        store_id: params.store_id,
        user_id: user.id,
        module: params.module,
        action: params.action,
        details: params.details || null,
      });
      if (error) throw error;
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({
        queryKey: ["activity_logs", params.campaign_id, params.store_id, params.module],
      });
    },
  });
}
