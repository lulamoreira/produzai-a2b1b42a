import { useState, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";

interface DebouncedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value: string;
  onValueCommit: (value: string) => void;
}

/**
 * Textarea that keeps local state and only fires onValueCommit on blur.
 * Prevents DB writes on every keystroke.
 */
const DebouncedTextarea = ({ value, onValueCommit, onKeyDown, ...props }: DebouncedTextareaProps) => {
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
    <Textarea
      {...props}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
    />
  );
};

export default DebouncedTextarea;
