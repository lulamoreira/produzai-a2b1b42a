import { useState } from "react";
import { Check, ChevronsUpDown, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { getThumbnailUrl } from "@/lib/imageUrl";
import type { PecaOption } from "@/lib/adminOccurrence";

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export interface AdminPecaPickerProps {
  options: PecaOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

function Row({ o, selected }: { o: PecaOption; selected: boolean }) {
  return (
    <>
      <Check className={cn("mr-2 h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
      <div className="w-8 h-8 rounded bg-muted overflow-hidden shrink-0 mr-2 flex items-center justify-center">
        {o.peca.image_url
          ? <img src={getThumbnailUrl(o.peca.image_url, 80)} alt="" loading="lazy" className="w-full h-full object-cover" />
          : <ImageIcon className="w-4 h-4 text-muted-foreground/40" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm truncate">{o.peca.nome}</p>
        <p className="text-[11px] text-muted-foreground truncate">{o.local}</p>
      </div>
    </>
  );
}

/** Seletor de peça do Loja a Loja: primeiro as que a loja recebe, depois as demais. */
export function AdminPecaPicker({ options, value, onChange, disabled }: AdminPecaPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.peca.id === value);
  const mine = options.filter((o) => o.assigned);
  const others = options.filter((o) => !o.assigned);
  const pick = (id: string) => { onChange(id); setOpen(false); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled}
          className="w-full justify-between font-normal h-auto min-h-10 text-left">
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? `${selected.peca.nome} — ${selected.local}` : "Selecione a peça..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start" onWheel={stop} onTouchMove={stop}>
        <Command>
          <CommandInput placeholder="Buscar peça ou local..." />
          <CommandList className="max-h-[280px] overflow-y-auto" onWheel={stop} onTouchMove={stop}>
            <CommandEmpty>Nenhuma peça encontrada.</CommandEmpty>
            {mine.length > 0 && (
              <CommandGroup heading={`Peças que a loja recebe (${mine.length})`}>
                {mine.map((o) => (
                  <CommandItem key={o.peca.id} value={`${o.peca.nome} ${o.local} ${o.peca.id}`} onSelect={() => pick(o.peca.id)}>
                    <Row o={o} selected={value === o.peca.id} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {mine.length > 0 && others.length > 0 && <CommandSeparator />}
            {others.length > 0 && (
              <CommandGroup heading={`Outras peças da campanha (${others.length})`}>
                {others.map((o) => (
                  <CommandItem key={o.peca.id} value={`${o.peca.nome} ${o.local} ${o.peca.id}`} onSelect={() => pick(o.peca.id)}>
                    <Row o={o} selected={value === o.peca.id} />
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
