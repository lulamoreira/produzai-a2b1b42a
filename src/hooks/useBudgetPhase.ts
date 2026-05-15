import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "./useUserRole";

export type BudgetPhase = "rateio" | "cotacoes" | "negociacao" | "ajuste";

export const PHASE_LABELS: Record<BudgetPhase, string> = {
  rateio: "Rateio",
  cotacoes: "Cotações",
  negociacao: "Negociação",
  ajuste: "Ajuste",
};

export const PHASE_ORDER: BudgetPhase[] = ["rateio", "cotacoes", "negociacao", "ajuste"];

export function useBudgetPhase(campaignId: string | undefined) {
  const qc = useQueryClient();
  const { isAdminOrMaster } = useUserRole();

  const { data, isLoading } = useQuery({
    queryKey: ["budget_phase", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_settings")
        .select("current_phase, phase_locked_at")
        .eq("campaign_id", campaignId!)
        .maybeSingle();
      if (error) throw error;
      return data as { current_phase: BudgetPhase; phase_locked_at: Record<string, string> } | null;
    },
  });

  const advancePhase = useMutation({
    mutationFn: async (targetPhase: BudgetPhase) => {
      const { data, error } = await supabase.rpc("advance_budget_phase" as never, {
        p_campaign_id: campaignId!,
        p_target_phase: targetPhase,
        p_force: false,
      } as never);
      if (error) throw error;
      const res = data as { success: boolean; error?: string };
      if (!res?.success) throw new Error(res?.error || "Erro ao avançar fase");
      return res;
    },
    onSuccess: (_, targetPhase) => {
      qc.invalidateQueries({ queryKey: ["budget_phase", campaignId] });
      qc.invalidateQueries({ queryKey: ["budget_settings", campaignId] });
      toast.success(`Avançado para fase: ${PHASE_LABELS[targetPhase]}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlockPhase = useMutation({
    mutationFn: async (targetPhase: BudgetPhase) => {
      if (!isAdminOrMaster) throw new Error("Apenas Admin ou Master podem desbloquear");
      const { data, error } = await supabase.rpc("unlock_budget_phase" as never, {
        p_campaign_id: campaignId!,
        p_target_phase: targetPhase,
      } as never);
      if (error) throw error;
      const res = data as { success: boolean; error?: string };
      if (!res?.success) throw new Error(res?.error || "Erro ao desbloquear fase");
      return res;
    },
    onSuccess: (_, targetPhase) => {
      qc.invalidateQueries({ queryKey: ["budget_phase", campaignId] });
      qc.invalidateQueries({ queryKey: ["budget_settings", campaignId] });
      toast.success(`Fase desbloqueada: ${PHASE_LABELS[targetPhase]}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const currentPhase: BudgetPhase = (data?.current_phase as BudgetPhase) ?? "rateio";
  const phaseLockedAt = data?.phase_locked_at ?? {};
  const currentPhaseIndex = PHASE_ORDER.indexOf(currentPhase);

  return {
    currentPhase,
    phaseLockedAt,
    currentPhaseIndex,
    isLoading,
    isAdminOrMaster,
    isPhaseActive: (phase: BudgetPhase) => phase === currentPhase,
    isPhaseCompleted: (phase: BudgetPhase) => PHASE_ORDER.indexOf(phase) < currentPhaseIndex,
    isPhaseLocked: (phase: BudgetPhase) => PHASE_ORDER.indexOf(phase) < currentPhaseIndex,
    isPhaseEditable: (phase: BudgetPhase) => phase === currentPhase || isAdminOrMaster,
    canAdvanceTo: (phase: BudgetPhase) => PHASE_ORDER.indexOf(phase) === currentPhaseIndex + 1,
    advancePhase: advancePhase.mutate,
    unlockPhase: unlockPhase.mutate,
    isAdvancing: advancePhase.isPending,
    isUnlocking: unlockPhase.isPending,
  };
}
