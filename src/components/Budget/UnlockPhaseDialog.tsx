import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BudgetPhase, PHASE_LABELS } from "@/hooks/useBudgetPhase";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  phaseToUnlock: BudgetPhase | null;
  onConfirm: () => void;
  isUnlocking: boolean;
}

export function UnlockPhaseDialog({
  open,
  onOpenChange,
  phaseToUnlock,
  onConfirm,
  isUnlocking,
}: Props) {
  if (!phaseToUnlock) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Desbloquear fase {PHASE_LABELS[phaseToUnlock]}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação retorna o processo para a fase{" "}
            <strong>{PHASE_LABELS[phaseToUnlock]}</strong>. Dados das fases
            posteriores são preservados mas deixam de ser a "verdade atual".
            Apenas Admin e Master podem fazer isso.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isUnlocking}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isUnlocking}>
            {isUnlocking ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Desbloquear
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
