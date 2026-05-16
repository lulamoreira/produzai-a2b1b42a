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

// ─────────────────────────────────────────────────────────
// Phase-aware "current truth" total
// ─────────────────────────────────────────────────────────
import { supabase } from "@/integrations/supabase/client";

export interface PhaseAwareTotal {
  phase: "cotacoes" | "negociacao" | "ajuste";
  total: number;
  piecesTotal: number;
  installation: number;
  freight: number;
  source: "original" | "negotiated" | "adjustment";
  isLocked: boolean;
}

/**
 * Computes the "current truth" total for a campaign based on active phase.
 *
 * Phase logic:
 * - rateio/cotacoes: use winner's original total (winner_locked_total)
 * - negociacao: use negotiation_locked_total if approved, else live negotiation
 * - ajuste: use adjustment budget request totals if available,
 *           else fall back to negotiation_locked_total
 */
export async function computeCurrentTotal(
  supplierId: string,
  campaignId: string,
  currentPhase: string,
  winner: {
    negotiation_status?: string;
    negotiation_locked_total?: number | null;
    winner_locked_total?: number | null;
  }
): Promise<PhaseAwareTotal> {
  // Phase: ajuste — check adjustment budget request first
  if (currentPhase === "ajuste") {
    const { data: adjRequest } = await (supabase as any)
      .from("campaign_adjustment_budget_request")
      .select(
        "status, adjusted_prices_jsonb, adjusted_extras_jsonb, adjustment_id, campaign_adjustments!inner(status)"
      )
      .eq("supplier_id", supplierId)
      .eq("campaign_adjustments.status", "active")
      .eq("status", "approved")
      .maybeSingle();

    if (adjRequest?.adjusted_prices_jsonb) {
      const prices = (adjRequest.adjusted_prices_jsonb as
        | { piece_id?: string; kit_id?: string; unit_price: number }[]
        | null) ?? [];
      const extras = adjRequest.adjusted_extras_jsonb as
        | { installation_value?: number; freight_value?: number }
        | null;

      const { data: adjPieces } = await (supabase as any)
        .from("campaign_adjustment_store_pieces")
        .select("piece_id, kit_id, quantity, adjustment_id")
        .eq("adjustment_id", adjRequest.adjustment_id);

      let piecesTotal = 0;
      for (const p of prices) {
        const qty = ((adjPieces as any[]) || [])
          .filter((ap) =>
            (p.piece_id && ap.piece_id === p.piece_id) ||
            (p.kit_id && ap.kit_id === p.kit_id)
          )
          .reduce((sum, ap) => sum + Number(ap.quantity ?? 0), 0);
        piecesTotal += Number(p.unit_price) * qty;
      }

      const installation = Number(extras?.installation_value ?? 0);
      const freight = Number(extras?.freight_value ?? 0);
      const total = piecesTotal + installation + freight;

      return {
        phase: "ajuste",
        total,
        piecesTotal,
        installation,
        freight,
        source: "adjustment",
        isLocked: true,
      };
    }

    if (winner.negotiation_locked_total != null) {
      return {
        phase: "ajuste",
        total: Number(winner.negotiation_locked_total),
        piecesTotal: Number(winner.negotiation_locked_total),
        installation: 0,
        freight: 0,
        source: "negotiated",
        isLocked: true,
      };
    }
  }

  // Phase: negociacao
  if (currentPhase === "negociacao" || winner.negotiation_status === "approved") {
    if (winner.negotiation_locked_total != null) {
      return {
        phase: "negociacao",
        total: Number(winner.negotiation_locked_total),
        piecesTotal: Number(winner.negotiation_locked_total),
        installation: 0,
        freight: 0,
        source: "negotiated",
        isLocked: true,
      };
    }
  }

  // Phase: cotacoes or rateio — use original locked total
  const originalTotal = Number(winner.winner_locked_total ?? 0);
  return {
    phase: "cotacoes",
    total: originalTotal,
    piecesTotal: originalTotal,
    installation: 0,
    freight: 0,
    source: "original",
    isLocked: currentPhase !== "cotacoes",
  };
}
