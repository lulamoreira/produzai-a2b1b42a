import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";

/**
 * Loads the rateio (store × piece quantities) for a given adjustment and returns
 * a qtyMap keyed by `${store_id}-${source_piece_id}` so it can be plugged into
 * UI components that key by base campaign piece ids.
 *
 * Adjustment pieces with no `source_piece_id` (newly added in the adjustment)
 * are intentionally omitted — they won't appear in the base `pieces` array
 * rendered by the Rateio matrix, so they have no column to populate. We can
 * extend this later if we need to render added-by-adjustment pieces too.
 */
export function useAdjustmentRateio(adjustmentId: string | null | undefined) {
  return useQuery({
    queryKey: ["adjustment_rateio_qty_map", adjustmentId],
    enabled: !!adjustmentId,
    queryFn: async () => {
      const [piecesRes, storePiecesRows, kitPiecesRes] = await Promise.all([
        supabase
          .from("campaign_adjustment_pieces")
          .select("id, source_piece_id, is_deleted")
          .eq("adjustment_id", adjustmentId!),
        supabasePaginate<{ store_id: string; piece_id: string; quantity: number }>(
          (from, to) =>
            supabase
              .from("campaign_adjustment_store_pieces" as never)
              .select("store_id, piece_id, quantity")
              .eq("adjustment_id", adjustmentId!)
              .range(from, to) as any
        ),
        supabase
          .from("campaign_adjustment_kit_pieces" as never)
          .select("kit_id, piece_id, quantity")
          .eq("adjustment_id", adjustmentId!),
      ]);

      const adjPieces = (piecesRes.data as any[]) || [];
      // Map adjustment_piece.id -> source_piece_id (only for non-deleted pieces
      // that map back to a base campaign piece).
      const adjToSource = new Map<string, string>();
      const adjKits = new Map<string, string>(); // adj_kit_id -> source_kit_id (need kits)
      for (const p of adjPieces) {
        if (!p.is_deleted && p.source_piece_id) {
          adjToSource.set(String(p.id), String(p.source_piece_id));
        }
      }

      const qtyMap: Record<string, number> = {};
      for (const row of (storePiecesRows as any[]) || []) {
        const srcPieceId = adjToSource.get(String(row.piece_id));
        if (!srcPieceId) continue;
        qtyMap[`${row.store_id}-${srcPieceId}`] = Number(row.quantity) || 0;
      }

      // Kit pieces quantity map — adjustment kit_id is internal; the consumer
      // currently aggregates kit qty via base kitPieces, so we also build a
      // remap of adj kit_piece quantities keyed by source_piece_id so callers
      // can override the per-kit-piece quantity.
      const kitPiecesQty: Record<string, number> = {};
      for (const kp of (kitPiecesRes.data as any[]) || []) {
        const srcPieceId = adjToSource.get(String(kp.piece_id));
        if (!srcPieceId) continue;
        kitPiecesQty[`${kp.kit_id}-${srcPieceId}`] = Number(kp.quantity) || 0;
      }

      return { qtyMap, kitPiecesQty };
    },
  });
}
