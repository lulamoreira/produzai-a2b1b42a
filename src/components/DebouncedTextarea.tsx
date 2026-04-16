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
 */
const DebouncedTextarea = ({ value, onValueCommit, onKeyDown, debounceMs = 700, ...props }: DebouncedTextareaProps) => {
  const [local, setLocal] = useState(value);
  const latest = useRef(local);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(value);
    latest.current = value;
  }, [value]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const commit = useCallback(() => {
    clearTimer();
    if (latest.current !== value) {
      onValueCommit(latest.current);
    }
  }, [value, onValueCommit]);

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
            if (latest.current !== value) onValueCommit(latest.current);
          }, debounceMs);
        }
      }}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
};

export default DebouncedTextarea;
