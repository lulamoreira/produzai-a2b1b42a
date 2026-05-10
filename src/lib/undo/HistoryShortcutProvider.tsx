import { useEffect } from "react";
import { historyStore } from "./historyStore";
import { getActiveScope } from "./activeScope";

export function HistoryShortcutProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      if (!modKey) return;

      // Don't intercept inside text inputs — let browser handle native undo
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const scope = getActiveScope();
      if (!scope) return;

      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        historyStore.undo(scope);
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        historyStore.redo(scope);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return <>{children}</>;
}
