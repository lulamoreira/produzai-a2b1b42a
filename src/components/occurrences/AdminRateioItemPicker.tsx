import { useState } from "react";
import { Check, ChevronsUpDown, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { getThumbnailUrl } from "@/lib/imageUrl";
import type { RateioItemOption } from "@/lib/occurrenceRateioItem";

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** Kits cujo nome já começa com "KIT" não ganham o selo de novo (evita "KIT KIT"). */
const showKitTag = (o: RateioItemOption) => o.type === "kit" && !/^\s*kit\b/i.test(o.name);

/** Selo com o CÓDIGO da peça/kit no rateio (numeração única peças+kits). */
function CodeBadge({ o }: { o: RateioItemOption }) {
  return (
    <span className="min-w-7 h-6 px-1 shrink-0 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold mr-2 tabular-nums">
      {o.code ?? "—"}
    </span>
  );
}

function Row({ o, selected }: { o: RateioItemOption; selected: boolean }) {
  return (
    <>
      <Check className={cn("mr-2 h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
      <CodeBadge o={o} />
      <div className="w-8 h-8 rounded bg-muted overflow-hidden shrink-0 mr-2 flex items-center justify-center">
        {o.image_url
          ? <img src={getThumbnailUrl(o.image_url, 80)} alt="" loading="lazy" className="w-full h-full object-cover" />
          : <ImageIcon className="w-4 h-4 text-muted-foreground/40" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug line-clamp-2 break-words">
          {showKitTag(o) && <span className="mr-1 rounded bg-secondary px-1 text-[10px] font-semibold text-secondary-foreground">KIT</span>}
          {o.name}
        </p>
        {o.local && <p className="text-[11px] text-muted-foreground truncate">{o.local}</p>}
      </div>
      {o.inStore && <span className="ml-2 shrink-0 text-[11px] font-medium text-muted-foreground tabular-nums">{o.qty} un.</span>}
    </>
  );
}

export interface AdminRateioItemPickerProps {
  options: RateioItemOption[];
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
}

/** Seletor de peça/kit do rateio: primeiro o que a loja recebe, depois o resto da campanha. */
export function AdminRateioItemPicker({ options, value, onChange, disabled }: AdminRateioItemPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.key === value);
  const mine = options.filter((o) => o.inStore);
  const others = options.filter((o) => !o.inStore);
  const pick = (key: string) => { onChange(key); setOpen(false); };
  const itemValue = (o: RateioItemOption) => `${o.code ?? ""} ${o.type === "kit" ? "kit" : ""} ${o.name} ${o.local} ${o.key}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled}
          className="w-full justify-between font-normal h-auto min-h-10 text-left">
          <span className={cn("flex min-w-0 items-center", !selected && "text-muted-foreground")}>
            {selected && <CodeBadge o={selected} />}
            <span className="line-clamp-2 whitespace-normal break-words">
              {selected ? `${showKitTag(selected) ? "KIT " : ""}${selected.name}${selected.inStore ? ` — ${selected.qty} un. nesta loja` : ""}` : "Selecione a peça do rateio..."}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start" onWheel={stop} onTouchMove={stop}>
        <Command>
          <CommandInput placeholder="Buscar por código ou nome..." />
          <CommandList className="max-h-[280px] overflow-y-auto" onWheel={stop} onTouchMove={stop}>
            <CommandEmpty>Nenhuma peça encontrada.</CommandEmpty>
            {mine.length > 0 && (
              <CommandGroup heading={`No rateio desta loja (${mine.length})`}>
                {mine.map((o) => (
                  <CommandItem key={o.key} value={itemValue(o)} onSelect={() => pick(o.key)}>
                    <Row o={o} selected={value === o.key} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {mine.length > 0 && others.length > 0 && <CommandSeparator />}
            {others.length > 0 && (
              <CommandGroup heading={`Outras peças da campanha (${others.length})`}>
                {others.map((o) => (
                  <CommandItem key={o.key} value={itemValue(o)} onSelect={() => pick(o.key)}>
                    <Row o={o} selected={value === o.key} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
