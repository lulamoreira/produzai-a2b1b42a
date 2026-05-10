import { useState } from "react";
import { Undo2, Redo2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void | Promise<void>;
  onRedo: () => void | Promise<void>;
  undoLabel?: string | null;
  redoLabel?: string | null;
  undoCount?: number;
  redoCount?: number;
  className?: string;
}

export function UndoRedoToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  undoLabel,
  redoLabel,
  undoCount = 0,
  redoCount = 0,
  className,
}: Props) {
  const [loading, setLoading] = useState<"undo" | "redo" | null>(null);

  const handleUndo = async () => {
    setLoading("undo");
    try {
      await onUndo();
    } finally {
      setLoading(null);
    }
  };

  const handleRedo = async () => {
    setLoading("redo");
    try {
      await onRedo();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            disabled={!canUndo || loading !== null}
            onClick={handleUndo}
            aria-label="Desfazer"
          >
            {loading === "undo" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Undo2 className="w-4 h-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {canUndo ? `Desfazer: ${undoLabel}` : "Nada para desfazer"} (⌘Z)
        </TooltipContent>
      </Tooltip>

      {canUndo && undoCount > 1 && (
        <span className="text-[10px] text-muted-foreground tabular-nums px-0.5">
          {undoCount}
        </span>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            disabled={!canRedo || loading !== null}
            onClick={handleRedo}
            aria-label="Refazer"
          >
            {loading === "redo" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Redo2 className="w-4 h-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {canRedo ? `Refazer: ${redoLabel}` : "Nada para refazer"} (⌘⇧Z)
        </TooltipContent>
      </Tooltip>

      {canRedo && redoCount > 1 && (
        <span className="text-[10px] text-muted-foreground tabular-nums px-0.5">
          {redoCount}
        </span>
      )}
    </div>
  );
}
