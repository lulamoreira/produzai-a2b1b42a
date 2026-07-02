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
      const [piecesRes, storePiecesRows, kitPiecesRes, adjKitsRes] = await Promise.all([
        supabase
          .from("campaign_adjustment_pieces")
          .select("id, source_piece_id, is_deleted")
          .eq("adjustment_id", adjustmentId!),
        supabasePaginate<{ store_id: string; piece_id: string; quantity: number }>(
          (from, to) =>
            supabase
              .from("campaign_adjustment_store_pieces" as never)
              .select("store_id, piece_id, quantity", { count: "exact" })
              .eq("adjustment_id", adjustmentId!)
              .order("id").range(from, to) as any
        ),
        supabase
          .from("campaign_adjustment_kit_pieces" as never)
          .select("kit_id, piece_id, quantity")
          .eq("adjustment_id", adjustmentId!),
        supabase
          .from("campaign_adjustment_kits")
          .select("id, source_kit_id")
          .eq("adjustment_id", adjustmentId!)
          .eq("is_deleted", false),
      ]);

      const adjPieces = (piecesRes.data as any[]) || [];
      const adjKitsData = (adjKitsRes.data as any[]) || [];
      
      const adjToSource = new Map<string, string>();
      const sourceToAdj = new Map<string, string>();
      const adjKitToSource = new Map<string, string>();
      
      for (const p of adjPieces) {
        if (!p.is_deleted && p.source_piece_id) {
          const srcId = String(p.source_piece_id);
          const adjId = String(p.id);
          adjToSource.set(adjId, srcId);
          sourceToAdj.set(srcId, adjId);
        }
      }

      for (const k of adjKitsData) {
        if (k.source_kit_id) {
          adjKitToSource.set(String(k.id), String(k.source_kit_id));
        }
      }

      const qtyMap: Record<string, number> = {};
      for (const row of (storePiecesRows as any[]) || []) {
        const srcPieceId = adjToSource.get(String(row.piece_id)) ?? String(row.piece_id);
        qtyMap[`${row.store_id}-${srcPieceId}`] = Number(row.quantity) || 0;
      }

      const kitPiecesQty: Record<string, number> = {};
      const adjKitPieces: any[] = [];
      for (const kp of (kitPiecesRes.data as any[]) || []) {
        const srcPieceId = adjToSource.get(String(kp.piece_id));
        if (!srcPieceId) continue;
        kitPiecesQty[`${kp.kit_id}-${srcPieceId}`] = Number(kp.quantity) || 0;
        adjKitPieces.push({
          ...kp,
          piece_id: srcPieceId, // map back to source for UI consistency
          kit_id: adjKitToSource.get(String(kp.kit_id)) || kp.kit_id, // map back to source kit id
        });
      }

      return { qtyMap, kitPiecesQty, sourceToAdj, adjKitPieces };
    },
  });
}
