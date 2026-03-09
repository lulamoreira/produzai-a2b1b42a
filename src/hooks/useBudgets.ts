import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BudgetItem {
  id: string;
  budget_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  display_order: number;
}

export interface Budget {
  id: string;
  campaign_id: string;
  supplier_name: string;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
  items?: BudgetItem[];
}

export function useCampaignBudgets(campaignId?: string) {
  return useQuery({
    queryKey: ["campaign_budgets", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_budgets")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("created_at");
      if (error) throw error;
      return data as Budget[];
    },
    enabled: !!campaignId,
  });
}

export function useBudgetItems(campaignId?: string) {
  return useQuery({
    queryKey: ["campaign_budget_items", campaignId],
    queryFn: async () => {
      // Get all budget ids for this campaign first
      const { data: budgets } = await supabase
        .from("campaign_budgets")
        .select("id")
        .eq("campaign_id", campaignId!);
      if (!budgets || budgets.length === 0) return [];
      const budgetIds = budgets.map((b) => b.id);
      const { data, error } = await supabase
        .from("campaign_budget_items")
        .select("*")
        .in("budget_id", budgetIds)
        .order("display_order");
      if (error) throw error;
      return data as BudgetItem[];
    },
    enabled: !!campaignId,
  });
}

export function useAddBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (budget: { campaign_id: string; supplier_name: string; file_url?: string; file_name?: string }) => {
      const { data, error } = await supabase.from("campaign_budgets").insert(budget).select().single();
      if (error) throw error;
      return data as Budget;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["campaign_budgets", vars.campaign_id] });
    },
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campaignId }: { id: string; campaignId: string }) => {
      const { error } = await supabase.from("campaign_budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["campaign_budgets", vars.campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign_budget_items", vars.campaignId] });
    },
  });
}

export function useAddBudgetItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ items, campaignId }: { items: Omit<BudgetItem, "id">[]; campaignId: string }) => {
      const { error } = await supabase.from("campaign_budget_items").insert(items);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["campaign_budget_items", vars.campaignId] });
    },
  });
}
