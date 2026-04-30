import { supabase } from "@/integrations/supabase/client";

/**
 * Captures a snapshot of the supplier's current prices + extra costs and
 * stores it in `budget_price_history`. Used both when a supplier submits
 * (reason="submitted") and when an admin reopens the sheet (reason="reopened").
 *
 * Safe to call from anonymous (supplier portal) and authenticated contexts.
 */
export async function snapshotSupplierBudget(params: {
  supplierId: string;
  campaignId: string;
  reason: "submitted" | "reopened";
  createdBy?: string | null;
}) {
  const { supplierId, campaignId, reason, createdBy = null } = params;

  // Fetch current prices + extra costs
  const [{ data: prices }, { data: extra }] = await Promise.all([
    supabase.from("budget_prices").select("piece_id, kit_id, unit_price").eq("supplier_id", supplierId),
    supabase.from("budget_extra_costs").select("installation_value, freight_value, notes").eq("supplier_id", supplierId).maybeSingle(),
  ]);

  // Compute next version
  const { data: latest } = await supabase
    .from("budget_price_history" as never)
    .select("version")
    .eq("supplier_id", supplierId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<{ version: number }>();

  const nextVersion = (latest?.version ?? 0) + 1;

  const snapshot = {
    prices: prices || [],
    extra_costs: extra || null,
  };

  const { error } = await supabase.from("budget_price_history" as never).insert({
    supplier_id: supplierId,
    campaign_id: campaignId,
    version: nextVersion,
    snapshot: snapshot as never,
    reason,
    created_by: createdBy,
  } as never);

  if (error) throw error;
  return nextVersion;
}
