import { useState, useEffect, useCallback, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";

interface DebouncedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value: string;
  onValueCommit: (value: string) => void;
  /** Delay in ms after typing stops before committing. Default 700ms. Set to 0 to disable auto-commit. */
  debounceMs?: number;
}

/**
 * Textarea that keeps local state and auto-commits after the user stops typing,
 * or immediately on blur. Prevents DB writes on every keystroke while still
 * feeling instant.
 *
 * Mirrors DebouncedInput: external value updates are ignored while the user
 * is actively typing (pending debounce timer or unsaved keystrokes), so
 * realtime/refetch echoes cannot wipe in-flight input.
 */
const DebouncedTextarea = ({ value, onValueCommit, onKeyDown, debounceMs = 700, ...props }: DebouncedTextareaProps) => {
  const [local, setLocal] = useState(value);
  const latest = useRef(local);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedRef = useRef(value);

  useEffect(() => {
    // Only accept external value updates when the user is NOT actively typing.
    // "Actively typing" = there is a pending debounce timer, OR the local value
    // differs from what we last committed (meaning user has unsaved keystrokes).
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
    <Textarea
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
      onKeyDown={onKeyDown}
    />
  );
};

export default DebouncedTextarea;
