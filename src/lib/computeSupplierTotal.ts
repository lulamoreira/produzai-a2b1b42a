/**
 * Shared helper to compute a supplier's monetary total for a budget.
 * Used by BOTH the original (supplierPartialTotals) and negotiation
 * (supplierNegotiationTotals) calculations to guarantee they apply the
 * exact same kit-expansion + dedup logic. Differences between original
 * and negotiation totals must come ONLY from the resolvers passed in
 * (different qty source, adjusted prices, adjusted extra costs).
 */

export interface KitComponentRow {
  kitId: string;
  pieceId: string;
  qty: number;
}

export interface ComputeSupplierTotalParams {
  supplierId: string;
  pieces: Array<{ id: string; kit_only?: boolean | null }>;
  /** Same shape as BudgetTab's kitPieceTotals memo: kitId -> components */
  kitPieceTotals: Record<string, KitComponentRow[]>;
  /** Returns total qty of a standalone piece (sum across stores). */
  qtyResolver: (pieceId: string) => number;
  /** Returns the unit price (or adjusted unit price) for supplier x piece. */
  priceResolver: (supplierId: string, pieceId: string) => number;
  /** Returns installation + freight (or adjusted) for the supplier. */
  extraCostResolver: (supplierId: string) => { installation: number; freight: number };
}

export function computeSupplierTotal(params: ComputeSupplierTotalParams): number {
  const {
    supplierId,
    pieces,
    kitPieceTotals,
    qtyResolver,
    priceResolver,
    extraCostResolver,
  } = params;

  const { installation, freight } = extraCostResolver(supplierId);
  let total = installation + freight;
  const counted = new Set<string>();

  // Standalone pieces (not kit_only)
  for (const piece of pieces) {
    if (piece.kit_only) continue;
    const qty = qtyResolver(piece.id);
    if (qty <= 0) continue;
    total += priceResolver(supplierId, piece.id) * qty;
    counted.add(piece.id);
  }

  // Kit-expanded pieces — kits are derived (not directly rateated),
  // so they always use the original kit expansion qty.
  for (const kpItems of Object.values(kitPieceTotals)) {
    for (const kpi of kpItems) {
      if (counted.has(kpi.pieceId)) continue;
      if (kpi.qty <= 0) continue;
      counted.add(kpi.pieceId);
      total += priceResolver(supplierId, kpi.pieceId) * kpi.qty;
    }
  }

  return total;
}
