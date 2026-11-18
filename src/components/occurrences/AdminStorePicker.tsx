import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { storeLabel, storeMatches, type SearchableStore } from "@/lib/adminOccurrence";

const LIMIT = 200;
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export interface AdminStorePickerProps {
  stores: SearchableStore[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

/** Combobox de loja com busca por nome, apelido, cidade/UF ou código. */
export function AdminStorePicker({ stores, value, onChange, disabled }: AdminStorePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = stores.find((s) => s.id === value);
  const matches = useMemo(() => stores.filter((s) => storeMatches(s, query)), [stores, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled}
          className="w-full justify-between font-normal h-auto min-h-10 text-left">
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? storeLabel(selected) : "Selecione a loja..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start" onWheel={stop} onTouchMove={stop}>
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar por nome, cidade, UF ou código..." value={query} onValueChange={setQuery} />
          <CommandList className="max-h-[260px] overflow-y-auto" onWheel={stop} onTouchMove={stop}>
            <CommandEmpty>Nenhuma loja encontrada.</CommandEmpty>
            <CommandGroup>
              {matches.slice(0, LIMIT).map((s) => (
                <CommandItem key={s.id} value={s.id} onSelect={() => { onChange(s.id); setOpen(false); setQuery(""); }}>
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === s.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{storeLabel(s)}</span>
                  {s.store_code && <span className="ml-auto pl-2 text-xs text-muted-foreground shrink-0">{s.store_code}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
            {matches.length > LIMIT && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Mostrando {LIMIT} de {matches.length}. Refine a busca.</p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
