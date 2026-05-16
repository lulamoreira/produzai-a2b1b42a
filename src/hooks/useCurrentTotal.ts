import { useQuery } from "@tanstack/react-query";
import { computeCurrentTotal, type PhaseAwareTotal } from "@/lib/computeSupplierTotal";
import type { BudgetPhase } from "./useBudgetPhase";

export type { PhaseAwareTotal };

export function useCurrentTotal(
  supplierId: string | undefined,
  campaignId: string | undefined,
  currentPhase: BudgetPhase,
  winner:
    | {
        negotiation_status?: string;
        negotiation_locked_total?: number | null;
        winner_locked_total?: number | null;
      }
    | undefined
) {
  return useQuery({
    queryKey: [
      "current_total",
      supplierId,
      campaignId,
      currentPhase,
      winner?.negotiation_status,
      winner?.negotiation_locked_total,
      winner?.winner_locked_total,
    ],
    enabled: !!supplierId && !!campaignId && !!winner,
    staleTime: 30_000,
    queryFn: async () => {
      if (!supplierId || !campaignId || !winner) return null;
      return computeCurrentTotal(supplierId, campaignId, currentPhase, winner);
    },
  });
}
