import { useSyncExternalStore, useCallback, useEffect } from "react";
import { historyStore } from "./historyStore";
import { setActiveScope, clearActiveScope } from "./activeScope";
import { toast } from "sonner";

export function useHistory(scope: string) {
  useEffect(() => {
    setActiveScope(scope);
    return () => clearActiveScope(scope);
  }, [scope]);

  useSyncExternalStore(
    historyStore.subscribe,
    () =>
      `${historyStore.undoCount(scope)}:${historyStore.redoCount(scope)}:${historyStore.lastUndoLabel(scope) ?? ""}:${historyStore.lastRedoLabel(scope) ?? ""}`,
    () => "0:0::",
  );

  useEffect(() => {
    const unsub = historyStore.onConflict((msg) => {
      toast.warning(msg, { duration: 6000 });
    });
    return unsub;
  }, []);

  const canUndo = historyStore.canUndo(scope);
  const canRedo = historyStore.canRedo(scope);
  const undoLabel = historyStore.lastUndoLabel(scope);
  const redoLabel = historyStore.lastRedoLabel(scope);
  const undoCount = historyStore.undoCount(scope);
  const redoCount = historyStore.redoCount(scope);

  const undo = useCallback(async () => {
    if (!historyStore.canUndo(scope)) return;
    const label = historyStore.lastUndoLabel(scope);
    try {
      await historyStore.undo(scope);
      toast.success(`Desfeito: ${label}`, {
        duration: 4000,
        action: {
          label: "Refazer",
          onClick: () => historyStore.redo(scope),
        },
      });
    } catch (e: any) {
      if (e?.message === "__conflict__") return; // conflict toast already shown
      toast.error(`Não foi possível desfazer: ${label}`, {
        description: e?.message || "Tente novamente",
      });
    }
  }, [scope]);

  const redo = useCallback(async () => {
    if (!historyStore.canRedo(scope)) return;
    const label = historyStore.lastRedoLabel(scope);
    try {
      await historyStore.redo(scope);
      toast.success(`Refeito: ${label}`, { duration: 3000 });
    } catch (e: any) {
      toast.error(`Não foi possível refazer: ${label}`, {
        description: e?.message || "Tente novamente",
      });
    }
  }, [scope]);

  const run = useCallback(
    async (cmd: {
      label: string;
      do: () => Promise<void>;
      undo: () => Promise<void>;
      checkConflict?: () => Promise<boolean>;
      conflictMessage?: string;
    }) => {
      const command = { ...cmd, scope };
      historyStore.push(command);
      await command.do();
    },
    [scope],
  );

  return { canUndo, canRedo, undo, redo, run, undoLabel, redoLabel, undoCount, redoCount };
}
