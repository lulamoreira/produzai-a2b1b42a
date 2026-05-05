import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";

export type NegotiationStorePiece = {
  id: string;
  supplier_id: string;
  campaign_id: string;
  store_id: string;
  piece_id: string;
  quantity: number;
};

/**
 * Fetch all negotiation rateio rows for a given supplier.
 * Used when editing the isolated negotiation distribution.
 */
export function useNegotiationStorePieces(
  supplierId: string | null | undefined,
  _campaignId: string | null | undefined,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ["negotiation_store_pieces", supplierId],
    enabled: !!supplierId && enabled,
    queryFn: async () => {
      return supabasePaginate<NegotiationStorePiece>((from, to) =>
        supabase
          .from("budget_negotiation_store_pieces" as never)
          .select("id, supplier_id, campaign_id, store_id, piece_id, quantity")
          .eq("supplier_id", supplierId as string)
          .range(from, to) as any
      );
    },
  });
}

/**
 * Upsert (or delete when quantity <= 0) a single negotiation rateio cell.
 */
export function useUpdateNegotiationStorePiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      supplier_id: string;
      campaign_id: string;
      store_id: string;
      piece_id: string;
      quantity: number;
    }) => {
      const { supplier_id, campaign_id, store_id, piece_id, quantity } = params;
      if (quantity <= 0) {
        const { error } = await supabase
          .from("budget_negotiation_store_pieces" as never)
          .delete()
          .eq("supplier_id", supplier_id)
          .eq("store_id", store_id)
          .eq("piece_id", piece_id);
        if (error) throw error;
        return null;
      }
      const { error } = await supabase
        .from("budget_negotiation_store_pieces" as never)
        .upsert(
          { supplier_id, campaign_id, store_id, piece_id, quantity } as never,
          { onConflict: "supplier_id,store_id,piece_id" }
        );
      if (error) throw error;
      return null;
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["negotiation_store_pieces", vars?.supplier_id] });
      if (vars?.supplier_id) {
        qc.invalidateQueries({ queryKey: ["neg_rateio_exists", vars.supplier_id] });
      }
    },
  });
}

/**
 * Snapshot the current campaign rateio into the negotiation table for a supplier.
 * Idempotent: if rows already exist for this supplier, returns 0 without copying.
 */
export async function snapshotNegotiationRateio(
  supplierId: string,
  campaignId: string
): Promise<number> {
  // Idempotency check
  const { count, error: countErr } = await supabase
    .from("budget_negotiation_store_pieces" as never)
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId);
  if (countErr) throw countErr;
  if ((count ?? 0) > 0) return 0;

  // Fetch current campaign rateio in pages.
  const rows = await supabasePaginate<{ store_id: string; piece_id: string; quantity: number }>(
    (from, to) =>
      supabase
        .from("campaign_store_pieces")
        .select("store_id, piece_id, quantity")
        .eq("campaign_id", campaignId)
        .range(from, to) as any
  );
  if (rows.length === 0) return 0;

  const payload = rows
    .filter((r: any) => Number(r.quantity) > 0)
    .map((r: any) => ({
      supplier_id: supplierId,
      campaign_id: campaignId,
      store_id: r.store_id,
      piece_id: r.piece_id,
      quantity: Number(r.quantity) || 0,
    }));

  if (payload.length === 0) return 0;

  // Insert in chunks to stay under request size limits
  const CHUNK = 500;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK);
    const { error: insErr } = await supabase
      .from("budget_negotiation_store_pieces" as never)
      .insert(slice as never);
    if (insErr) throw insErr;
  }
  return payload.length;
}

export async function resetNegotiationRateioFromOriginal(
  supplierId: string,
  campaignId: string
): Promise<number> {
  const { error } = await supabase
    .from("budget_negotiation_store_pieces" as never)
    .delete()
    .eq("supplier_id", supplierId);
  if (error) throw error;
  return snapshotNegotiationRateio(supplierId, campaignId);
}

export async function cancelNegotiationRateio(supplierId: string, campaignId?: string): Promise<void> {
  const { error: pricesErr } = await supabase
    .from("budget_prices")
    .update({ adjusted_unit_price: null } as never)
    .eq("supplier_id", supplierId);
  if (pricesErr) throw pricesErr;

  const { error: extrasErr } = await supabase
    .from("budget_extra_costs")
    .update({ adjusted_installation_value: null, adjusted_freight_value: null } as never)
    .eq("supplier_id", supplierId);
  if (extrasErr) throw extrasErr;

  const { error: rateioErr } = await supabase
    .from("budget_negotiation_store_pieces" as never)
    .delete()
    .eq("supplier_id", supplierId);
  if (rateioErr) throw rateioErr;

  const { error: supplierErr } = await supabase
    .from("budget_suppliers")
    .update({ negotiation_status: null, negotiation_submitted_at: null } as never)
    .eq("id", supplierId);
  if (supplierErr) throw supplierErr;

  if (campaignId) {
    const { error: settingsErr } = await supabase
      .from("budget_settings")
      .update({ negotiation_target: null, negotiation_mode: "manual" } as never)
      .eq("campaign_id", campaignId);
    if (settingsErr) throw settingsErr;
  }
}
