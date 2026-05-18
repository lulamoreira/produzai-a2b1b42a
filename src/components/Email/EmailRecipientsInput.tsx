import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const SEPARATOR = ", ";
// Divisores aceitos enquanto digita: vírgula, ponto e vírgula, espaços/quebras.
const SPLIT_RE = /[,;]+/;

function splitTokens(raw: string): { before: string[]; current: string } {
  // Mantém apenas vírgula/ponto-e-vírgula como separadores "fortes". Espaços
  // dentro do token corrente são permitidos para não atrapalhar a digitação.
  const parts = raw.split(SPLIT_RE);
  const current = parts[parts.length - 1] ?? "";
  const before = parts.slice(0, -1).map((p) => p.trim()).filter(Boolean);
  return { before, current };
}

/**
 * Campo de e-mails múltiplos com autocomplete baseado em memória do cliente.
 * - Sugere e-mails que começam/contêm o que está sendo digitado no token atual.
 * - Ao selecionar uma sugestão, acrescenta ", " e mantém o foco para o próximo.
 * - Ao perder o foco, remove a vírgula/espaço final pendentes.
 */
export default function EmailRecipientsInput({
  id,
  value,
  onChange,
  suggestions,
  disabled,
  placeholder,
  className,
}: Props) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);

  const { before, current } = React.useMemo(() => splitTokens(value), [value]);

  const filtered = React.useMemo(() => {
    const q = current.trim().toLowerCase();
    const already = new Set(before.map((e) => e.toLowerCase()));
    const pool = suggestions.filter((s) => !already.has(s.toLowerCase()));
    if (!q) return pool.slice(0, 8);
    const starts = pool.filter((s) => s.toLowerCase().startsWith(q));
    const contains = pool.filter(
      (s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q)
    );
    return [...starts, ...contains].slice(0, 8);
  }, [suggestions, current, before]);

  React.useEffect(() => {
    setHighlight(0);
  }, [filtered.length, current]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        // limpa vírgula/espaço final pendentes ao sair
        cleanupTrailing();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const cleanupTrailing = () => {
    // remove ", " ou ";" ou espaços finais quando o token atual está vazio
    const trimmed = value.replace(/[\s,;]+$/g, "");
    if (trimmed !== value) onChange(trimmed);
  };

  const applySelection = (email: string) => {
    const parts = value.split(SPLIT_RE);
    parts[parts.length - 1] = email;
    const next = parts.map((p) => p.trim()).filter(Boolean).join(SEPARATOR) + SEPARATOR;
    onChange(next);
    // mantém aberto para próxima seleção
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const len = next.length;
      try {
        inputRef.current?.setSelectionRange(len, len);
      } catch {
        /* ignore */
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) {
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (filtered[highlight]) {
        e.preventDefault();
        applySelection(filtered[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showDropdown = open && !disabled && filtered.length > 0;

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onBlur={() => {
          // pequeno atraso para permitir clique nas sugestões
          setTimeout(() => {
            cleanupTrailing();
          }, 120);
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        spellCheck={false}
      />
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full max-h-[220px] overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {filtered.map((item, idx) => (
            <button
              key={item}
              type="button"
              className={cn(
                "w-full text-left px-3 py-1.5 text-sm transition-colors cursor-pointer",
                idx === highlight
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
              onMouseEnter={() => setHighlight(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                applySelection(item);
              }}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
