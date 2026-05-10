import { useSyncExternalStore, useCallback, useEffect } from "react";
import { historyStore } from "./historyStore";
import { setActiveScope, clearActiveScope } from "./activeScope";
import { toast } from "sonner";

export function useHistory(scope: string) {
  // Register this scope as active on mount
  useEffect(() => {
    setActiveScope(scope);
    return () => clearActiveScope(scope);
  }, [scope]);

  // Subscribe so component re-renders when stacks change
  useSyncExternalStore(
    historyStore.subscribe,
    () =>
      `${historyStore.canUndo(scope) ? 1 : 0}:${historyStore.canRedo(scope) ? 1 : 0}:${historyStore.lastUndoLabel(scope) ?? ""}:${historyStore.lastRedoLabel(scope) ?? ""}`,
    () => "0:0::",
  );

  const canUndo = historyStore.canUndo(scope);
  const canRedo = historyStore.canRedo(scope);
  const undoLabel = historyStore.lastUndoLabel(scope);
  const redoLabel = historyStore.lastRedoLabel(scope);

  const undo = useCallback(async () => {
    if (!historyStore.canUndo(scope)) return;
    const label = historyStore.lastUndoLabel(scope);
    await historyStore.undo(scope);
    if (label) {
      toast(`Desfeito: ${label}`, {
        action: {
          label: "Refazer",
          onClick: () => historyStore.redo(scope),
        },
      });
    }
  }, [scope]);

  const redo = useCallback(async () => {
    if (!historyStore.canRedo(scope)) return;
    await historyStore.redo(scope);
  }, [scope]);

  const run = useCallback(
    async (cmd: { label: string; do: () => Promise<void>; undo: () => Promise<void> }) => {
      const command = { ...cmd, scope };
      historyStore.push(command);
      await command.do();
    },
    [scope],
  );

  return { canUndo, canRedo, undo, redo, run, undoLabel, redoLabel };
}
