import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BudgetTimelineEntry {
  id: string;
  campaign_id: string;
  entry_date: string; // YYYY-MM-DD
  description: string;
  display_order: number;
  created_at: string | null;
}

// ─── Read ────────────────────────────────────────────────
export function useBudgetTimeline(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["budget_timeline", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_timeline_entries")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BudgetTimelineEntry[];
    },
    enabled: !!campaignId,
  });
}

// ─── Add ────────────────────────────────────────────────
export function useAddTimelineEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      campaign_id: string;
      entry_date: string;
      description: string;
      display_order: number;
    }) => {
      const { data, error } = await supabase
        .from("budget_timeline_entries")
        .insert(params)
        .select()
        .single();
      if (error) throw error;
      return data as BudgetTimelineEntry;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["budget_timeline", v.campaign_id] }),
  });
}

// ─── Update ─────────────────────────────────────────────
export function useUpdateTimelineEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      campaign_id: string;
      updates: Partial<Pick<BudgetTimelineEntry, "entry_date" | "description" | "display_order">>;
    }) => {
      const { error } = await supabase
        .from("budget_timeline_entries")
        .update(params.updates)
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["budget_timeline", v.campaign_id] }),
  });
}

// ─── Delete ─────────────────────────────────────────────
export function useDeleteTimelineEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; campaign_id: string }) => {
      const { error } = await supabase
        .from("budget_timeline_entries")
        .delete()
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["budget_timeline", v.campaign_id] }),
  });
}

// ─── Reorder (bulk) ─────────────────────────────────────
export function useReorderTimeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      campaign_id: string;
      entries: Array<{ id: string; display_order: number }>;
    }) => {
      await Promise.all(
        params.entries.map((e) =>
          supabase
            .from("budget_timeline_entries")
            .update({ display_order: e.display_order })
            .eq("id", e.id),
        ),
      );
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["budget_timeline", v.campaign_id] }),
  });
}
