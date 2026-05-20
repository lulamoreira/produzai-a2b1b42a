import { Lock, Loader2, Unlock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { BudgetPhase, PHASE_LABELS } from "@/hooks/useBudgetPhase";

interface FrozenPhaseBannerProps {
  frozenPhase: BudgetPhase;
  activePhase: BudgetPhase;
  lockedAt?: string;
  isAdminOrMaster: boolean;
  onUnlock: () => void;
  isUnlocking: boolean;
}

export function FrozenPhaseBanner({
  frozenPhase,
  activePhase,
  lockedAt,
  isAdminOrMaster,
  onUnlock,
  isUnlocking,
}: FrozenPhaseBannerProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3">
      <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
          Fase {PHASE_LABELS[frozenPhase]} congelada
        </p>
        <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
          {lockedAt
            ? `Congelada em ${format(new Date(lockedAt), "dd 'de' MMMM 'de' yyyy")} — `
            : ""}
          Fase atual: {PHASE_LABELS[activePhase]}. Este conteúdo é somente leitura.
        </p>
      </div>
      {isAdminOrMaster && (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={onUnlock}
          disabled={isUnlocking}
        >
          {isUnlocking ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Unlock className="w-3.5 h-3.5" />
          )}
          Desbloquear
        </Button>
      )}
    </div>
  );
}
