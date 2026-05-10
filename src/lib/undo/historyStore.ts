export type Command = {
  label: string;
  do: () => Promise<void>;
  undo: () => Promise<void>;
  scope: string;
};

type ScopeHistory = {
  undoStack: Command[];
  redoStack: Command[];
};

const MAX_STACK = 50;
const state = new Map<string, ScopeHistory>();
const listeners = new Set<() => void>();

function getScope(scope: string): ScopeHistory {
  if (!state.has(scope)) state.set(scope, { undoStack: [], redoStack: [] });
  return state.get(scope)!;
}

function notify() {
  listeners.forEach((fn) => fn());
}

export const historyStore = {
  push(cmd: Command) {
    const s = getScope(cmd.scope);
    s.undoStack.push(cmd);
    if (s.undoStack.length > MAX_STACK) s.undoStack.shift();
    s.redoStack = [];
    notify();
  },

  async undo(scope: string) {
    const s = getScope(scope);
    const cmd = s.undoStack.pop();
    if (!cmd) return;
    notify();
    try {
      await cmd.undo();
      s.redoStack.push(cmd);
    } catch {
      s.undoStack.push(cmd);
    }
    notify();
  },

  async redo(scope: string) {
    const s = getScope(scope);
    const cmd = s.redoStack.pop();
    if (!cmd) return;
    notify();
    try {
      await cmd.do();
      s.undoStack.push(cmd);
    } catch {
      s.redoStack.push(cmd);
    }
    notify();
  },

  canUndo(scope: string): boolean {
    return (state.get(scope)?.undoStack.length ?? 0) > 0;
  },

  canRedo(scope: string): boolean {
    return (state.get(scope)?.redoStack.length ?? 0) > 0;
  },

  lastUndoLabel(scope: string): string | null {
    const stack = state.get(scope)?.undoStack;
    return stack && stack.length ? stack[stack.length - 1].label : null;
  },

  lastRedoLabel(scope: string): string | null {
    const stack = state.get(scope)?.redoStack;
    return stack && stack.length ? stack[stack.length - 1].label : null;
  },

  clearScope(scope: string) {
    state.delete(scope);
    notify();
  },

  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
