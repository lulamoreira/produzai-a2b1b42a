import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";

interface DebouncedInputProps extends Omit<React.ComponentProps<"input">, "onChange"> {
  value: string;
  onValueCommit: (value: string) => void;
  /** Delay in ms after typing stops before committing. Default 700ms. Set to 0 to disable auto-commit. */
  debounceMs?: number;
}

/**
 * Input that keeps local state and auto-commits after the user stops typing,
 * or immediately on blur / Enter. Prevents DB writes on every keystroke
 * while still feeling instant.
 */
const DebouncedInput = ({ value, onValueCommit, onKeyDown, debounceMs = 700, ...props }: DebouncedInputProps) => {
  const [local, setLocal] = useState(value);
  const latest = useRef(local);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedRef = useRef(value);

  useEffect(() => {
    // Only accept external value updates when the user is NOT actively typing.
    // "Actively typing" = there is a pending debounce timer, OR the local value
    // differs from what we last committed (meaning user has unsaved keystrokes).
    // This prevents stale realtime/refetch echoes from wiping out in-flight input.
    const userIsTyping = timerRef.current !== null || latest.current !== lastCommittedRef.current;
    if (userIsTyping) return;
    if (value === latest.current) return;
    setLocal(value);
    latest.current = value;
    lastCommittedRef.current = value;
  }, [value]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const commit = useCallback(() => {
    clearTimer();
    if (latest.current !== lastCommittedRef.current) {
      lastCommittedRef.current = latest.current;
      onValueCommit(latest.current);
    }
  }, [onValueCommit]);

  useEffect(() => () => clearTimer(), []);

  return (
    <Input
      {...props}
      value={local}
      onChange={(e) => {
        const v = e.target.value;
        setLocal(v);
        latest.current = v;
        if (debounceMs > 0) {
          clearTimer();
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            if (latest.current !== lastCommittedRef.current) {
              lastCommittedRef.current = latest.current;
              onValueCommit(latest.current);
            }
          }, debounceMs);
        }
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          (e.target as HTMLInputElement).blur();
        }
        onKeyDown?.(e);
      }}
    />
  );
};

export default DebouncedInput;
