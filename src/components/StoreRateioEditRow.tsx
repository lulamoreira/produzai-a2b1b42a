import { Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { itemCodeLabel } from "@/lib/reviewRateio";
import { sanitizeQty, type StoreEditItem } from "@/lib/rateioStoreEdit";

export interface StoreRateioEditRowProps {
  item: StoreEditItem;
  /** Texto digitado (undefined = sem rascunho, usa a quantidade atual). */
  draft?: string;
  focused: boolean;
  onChange: (value: string) => void;
}

/** Uma linha editável do rateio da loja: −, campo inteiro ≥ 0, + e "Zerar". */
export function StoreRateioEditRow({ item, draft, focused, onChange }: StoreRateioEditRowProps) {
  const value = draft === undefined ? item.current : sanitizeQty(draft);
  const changed = value !== item.current;
  const code = itemCodeLabel(item.code);
  return (
    <li
      className={cn(
        "px-2 py-2 space-y-1.5",
        changed && "bg-primary/5",
        focused && "ring-1 ring-inset ring-primary/60",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs min-w-0">
        {code ? <span className="font-mono text-[10px] text-muted-foreground shrink-0">{code}</span> : null}
        <span className="min-w-0 break-words font-medium">{item.name}</span>
        {item.kind === "kit" ? <Badge variant="secondary" className="text-[9px] px-1 py-0">Kit</Badge> : null}
        {focused ? <span className="rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary">apontamento</span> : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {changed ? (
            <>de {item.current} para <span className="font-semibold text-foreground">{value}</span></>
          ) : (
            <>Atual: {item.current}</>
          )}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            aria-label={`Diminuir ${item.name}`}
            disabled={value <= 0}
            onClick={() => onChange(String(Math.max(0, value - 1)))}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={`Quantidade de ${item.name}`}
            value={draft ?? String(item.current)}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
            className="h-8 w-14 px-1 text-center text-xs tabular-nums"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            aria-label={`Aumentar ${item.name}`}
            onClick={() => onChange(String(value + 1))}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-[11px]"
            disabled={value === 0}
            onClick={() => onChange("0")}
          >
            Zerar
          </Button>
        </div>
      </div>
    </li>
  );
}
