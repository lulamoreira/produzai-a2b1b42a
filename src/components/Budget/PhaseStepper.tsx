import { Check, Lock, ChevronRight, ArrowRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BudgetPhase, PHASE_LABELS, PHASE_ORDER, useBudgetPhase } from "@/hooks/useBudgetPhase";

interface PhaseStepperProps {
  currentPhase: BudgetPhase;
  phaseLockedAt: Record<string, string>;
  isAdminOrMaster: boolean;
  onUnlock: (phase: BudgetPhase) => void;
  isUnlocking: boolean;
  campaignId: string;
}

export function PhaseStepper({
  currentPhase,
  phaseLockedAt,
  isAdminOrMaster,
  onUnlock,
  isUnlocking,
  campaignId,
}: PhaseStepperProps) {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-start gap-2 overflow-x-auto pb-1">
        {PHASE_ORDER.map((phase, index) => {
          const isCompleted = index < currentIndex;
          const isActive = index === currentIndex;
          const isLocked = index < currentIndex;
          const lockedAt = phaseLockedAt[phase];

          return (
            <div key={phase} className="flex items-start gap-2 shrink-0">
              <div className="flex flex-col items-center text-center min-w-[88px]">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 shrink-0",
                    isCompleted && "bg-emerald-500 border-emerald-500 text-white",
                    isActive && "bg-primary border-primary text-primary-foreground",
                    !isCompleted && !isActive && "bg-muted border-border text-muted-foreground",
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : isActive ? (
                    <span>{index + 1}</span>
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                </div>

                <span
                  className={cn(
                    "mt-1.5 text-xs font-medium",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {PHASE_LABELS[phase]}
                </span>

                {isCompleted && lockedAt && (
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(lockedAt), "dd MMM", { locale: ptBR })}
                  </span>
                )}

                {isActive && (
                  <span className="text-[10px] text-primary mt-0.5 font-medium">
                    Em andamento
                  </span>
                )}

                {isLocked && isAdminOrMaster && (
                  <button
                    type="button"
                    onClick={() => onUnlock(phase)}
                    disabled={isUnlocking}
                    className="text-[10px] text-muted-foreground hover:text-amber-600 underline transition-colors mt-0.5"
                  >
                    Desbloquear
                  </button>
                )}
              </div>

              {index < PHASE_ORDER.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground mt-3 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      <AdvancePhaseButton
        currentPhase={currentPhase}
        currentIndex={currentIndex}
        isAdminOrMaster={isAdminOrMaster}
        campaignId={campaignId}
      />
    </div>
  );
}

function AdvancePhaseButton({
  currentPhase,
  currentIndex,
  campaignId,
}: {
  currentPhase: BudgetPhase;
  currentIndex: number;
  isAdminOrMaster: boolean;
  campaignId: string;
}) {
  const { advancePhase, isAdvancing } = useBudgetPhase(campaignId);
  const nextPhase = PHASE_ORDER[currentIndex + 1] as BudgetPhase | undefined;

  if (!nextPhase || currentPhase === "ajuste") return null;

  const descriptions: Record<BudgetPhase, string> = {
    rateio: "",
    cotacoes: "O rateio será congelado. Cotações dos fornecedores serão coletadas.",
    negociacao: "As cotações serão congeladas. Negociação com o fornecedor vencedor começa.",
    ajuste: "A negociação será congelada. Ajustes pós-mockup podem ser feitos.",
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border bg-muted/30 p-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">
          Avançar para: {PHASE_LABELS[nextPhase]}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {descriptions[nextPhase]}
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => advancePhase(nextPhase)}
        disabled={isAdvancing}
        className="shrink-0 gap-2"
      >
        {isAdvancing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ArrowRight className="w-3.5 h-3.5" />
        )}
        {PHASE_LABELS[nextPhase]}
      </Button>
    </div>
  );
}
