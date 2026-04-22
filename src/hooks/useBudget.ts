import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Budget Settings ─────────────────────────────────────
export function useBudgetSettings(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["budget_settings", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_settings")
        .select("*")
        .eq("campaign_id", campaignId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });
}

export function useSaveBudgetSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { campaign_id: string; budget_amount?: number | null; deadline?: string | null; currency_code?: string }) => {
      const payload: Record<string, unknown> = {
        campaign_id: params.campaign_id,
        budget_amount: params.budget_amount ?? null,
        deadline: params.deadline ?? null,
      };
      if (params.currency_code !== undefined) payload.currency_code = params.currency_code;
      const { data, error } = await supabase
        .from("budget_settings")
        .upsert(payload as never, { onConflict: "campaign_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["budget_settings", v.campaign_id] }),
  });
}

// ─── Budget Suppliers ────────────────────────────────────
export function useBudgetSuppliers(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["budget_suppliers", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_suppliers")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!campaignId,
  });
}

export function useAddSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { campaign_id: string; company_name: string; contact_name: string; phone: string; email: string }) => {
      const { data, error } = await supabase.from("budget_suppliers").insert(params).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["budget_suppliers", v.campaign_id] }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; campaign_id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from("budget_suppliers").update(params.updates).eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["budget_suppliers", v.campaign_id] }),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; campaign_id: string }) => {
      const { error } = await supabase.from("budget_suppliers").delete().eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["budget_suppliers", v.campaign_id] }),
  });
}

// ─── Budget Prices ───────────────────────────────────────
export function useBudgetPrices(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["budget_prices", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_prices")
        .select("*")
        .eq("campaign_id", campaignId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!campaignId,
  });
}

// ─── Budget Extra Costs ──────────────────────────────────
export function useBudgetExtraCosts(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["budget_extra_costs", campaignId],
    queryFn: async () => {
      // Join through supplier to filter by campaign
      const { data: suppliers } = await supabase
        .from("budget_suppliers")
        .select("id")
        .eq("campaign_id", campaignId!);
      if (!suppliers || suppliers.length === 0) return [];
      const ids = suppliers.map((s) => s.id);
      const { data, error } = await supabase
        .from("budget_extra_costs")
        .select("*")
        .in("supplier_id", ids);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!campaignId,
  });
}

// ─── Supplier Spec Suggestions ───────────────────────────
export function useSupplierSpecSuggestions(supplierId: string | null | undefined) {
  return useQuery({
    queryKey: ["supplier_spec_suggestions", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_spec_suggestions")
        .select("*")
        .eq("supplier_id", supplierId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!supplierId,
  });
}
