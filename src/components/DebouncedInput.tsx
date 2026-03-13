import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";

interface DebouncedInputProps extends Omit<React.ComponentProps<"input">, "onChange"> {
  value: string;
  onValueCommit: (value: string) => void;
}

/**
 * Input that keeps local state and only fires onValueCommit on blur or Enter.
 * Prevents DB writes on every keystroke.
 */
const DebouncedInput = ({ value, onValueCommit, onKeyDown, ...props }: DebouncedInputProps) => {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const commit = useCallback(() => {
    if (local !== value) {
      onValueCommit(local);
    }
  }, [local, value, onValueCommit]);

  return (
    <Input
      {...props}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
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
