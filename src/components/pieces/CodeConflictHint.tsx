import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { describeCodeConflicts, type CodeConflict } from "@/lib/itemCodeConflicts";

export interface CodeConflictHintProps {
  conflicts: CodeConflict[];
  invalid?: boolean;
  className?: string;
}

/** Aviso inline enquanto o usuário digita um código repetido ou inválido. */
export function CodeConflictHint({ conflicts, invalid, className }: CodeConflictHintProps) {
  if (!invalid && conflicts.length === 0) return null;
  return (
    <p role="status" className={cn("flex items-start gap-1 text-[11px] leading-tight text-destructive", className)}>
      <AlertTriangle className="w-3 h-3 mt-px shrink-0" aria-hidden="true" />
      <span>{invalid ? "Use um número inteiro maior que zero." : describeCodeConflicts(conflicts)}</span>
    </p>
  );
}
