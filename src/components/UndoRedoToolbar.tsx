import { Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  undoLabel?: string | null;
  redoLabel?: string | null;
  className?: string;
}

export function UndoRedoToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  undoLabel,
  redoLabel,
  className,
}: Props) {
  return (
    <div className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            disabled={!canUndo}
            onClick={onUndo}
            aria-label="Desfazer"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {canUndo ? `Desfazer: ${undoLabel}` : "Nada para desfazer"} (⌘Z)
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            disabled={!canRedo}
            onClick={onRedo}
            aria-label="Refazer"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {canRedo ? `Refazer: ${redoLabel}` : "Nada para refazer"} (⌘⇧Z)
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
