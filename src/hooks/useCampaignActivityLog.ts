import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CampaignActivity {
  id: string;
  campaign_id: string;
  store_id: string | null;
  user_id: string | null;
  actor_name: string | null;
  actor_type: string | null;
  action: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const PAGE_SIZE = 50;

export function useCampaignActivityLog(
  campaignId: string | undefined,
  filters?: {
    action?: string;
    actorType?: string;
    storeSearch?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  return useInfiniteQuery({
    queryKey: ["campaign_activity_log", campaignId, filters],
    enabled: !!campaignId,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from("campaign_activity_log")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (filters?.action) {
        query = query.eq("action", filters.action);
      }
      if (filters?.actorType) {
        query = query.eq("actor_type", filters.actorType);
      }
      if (filters?.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte("created_at", filters.dateTo + "T23:59:59.999Z");
      }
      if (filters?.storeSearch) {
        query = query.ilike("description", `%${filters.storeSearch}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CampaignActivity[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
  });
}

export function useLogCampaignActivity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      campaign_id: string;
      store_id?: string | null;
      actor_name?: string;
      actor_type?: "user" | "installer" | "system";
      action: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }) => {
      const { error } = await supabase.from("campaign_activity_log" as any).insert({
        campaign_id: params.campaign_id,
        store_id: params.store_id || null,
        user_id: user?.id || null,
        actor_name: params.actor_name || null,
        actor_type: params.actor_type || "user",
        action: params.action,
        description: params.description || null,
        metadata: params.metadata || null,
      });
      if (error) throw error;
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({
        queryKey: ["campaign_activity_log", params.campaign_id],
      });
    },
    onError: () => {
      // Silent failure - don't block the main action
    },
  });
}
