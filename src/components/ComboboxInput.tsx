import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ComboboxInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  type?: string;
  className?: string;
}

const ComboboxInput = ({ value, onChange, suggestions, placeholder, type = "text", className }: ComboboxInputProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = (search || value).toLowerCase().trim();
    if (!q) return suggestions;
    return suggestions.filter((s) => s.toLowerCase().includes(q));
  }, [suggestions, search, value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSearch(v);
    onChange(v);
    if (!open) setOpen(true);
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setSearch("");
    setOpen(false);
  };

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        ref={inputRef}
        type={type}
        value={value}
        onChange={handleInputChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full max-h-[200px] overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma sugestão</div>
          ) : (
            filtered.map((item) => (
              <button
                key={item}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer",
                  item === value && "bg-accent/50 font-medium"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item);
                }}
              >
                {item}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ComboboxInput;
