import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OccurrenceLike {
  loja_a_loja_peca_id?: string | null;
  loja_a_loja_pecas?: any;
}

interface PieceOption {
  id: string;
  nome: string;
  local: string;
  count: number;
}

interface Props {
  occurrences: OccurrenceLike[];
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
  triggerClassName?: string;
}

function buildLocal(peca: any): string {
  if (!peca) return "";
  const tipo = peca.loja_a_loja_tipos;
  const sub = peca.loja_a_loja_subdivisoes;
  const tipoStr = tipo ? `${tipo.letra ? `${tipo.letra} · ` : ""}${tipo.nome ?? ""}`.trim() : "";
  const subStr = sub?.nome ?? "";
  if (tipoStr && subStr) return `${tipoStr} › ${subStr}`;
  return tipoStr || subStr || "";
}

export default function PieceMultiSelectFilter({
  occurrences,
  value,
  onChange,
  className,
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);

  const options = useMemo<PieceOption[]>(() => {
    const map = new Map<string, PieceOption>();
    occurrences.forEach((o) => {
      const id = o.loja_a_loja_peca_id;
      if (!id) return;
      const peca = o.loja_a_loja_pecas;
      const nome = peca?.nome ?? "—";
      const local = buildLocal(peca);
      const existing = map.get(id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(id, { id, nome, local, count: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [occurrences]);

  const selectedCount = value.length;
  const allIds = options.map((o) => o.id);

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  };

  const selectAll = () => onChange(allIds);
  const clearAll = () => onChange([]);

  let triggerLabel = "Todas as peças";
  if (selectedCount === 1) {
    const sel = options.find((o) => o.id === value[0]);
    triggerLabel = sel?.nome ?? "1 peça selecionada";
  } else if (selectedCount > 1) {
    triggerLabel = `${selectedCount} peças selecionadas`;
  }

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between font-normal", triggerClassName)}
          >
            <span className="flex items-center gap-2 truncate">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{triggerLabel}</span>
              {selectedCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {selectedCount}
                </Badge>
              )}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar peça..." />
            <CommandList>
              <CommandEmpty>Nenhuma peça citada em ocorrências.</CommandEmpty>
              {options.length > 0 && (
                <>
                  <CommandGroup>
                    <CommandItem onSelect={selectAll} className="text-xs">
                      <Check className="mr-2 h-3.5 w-3.5" /> Selecionar todas
                    </CommandItem>
                    <CommandItem onSelect={clearAll} className="text-xs" disabled={selectedCount === 0}>
                      <X className="mr-2 h-3.5 w-3.5" /> Limpar seleção
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                  <CommandGroup heading={`${options.length} peça${options.length === 1 ? "" : "s"} citada${options.length === 1 ? "" : "s"}`}>
                    {options.map((opt) => {
                      const checked = value.includes(opt.id);
                      return (
                        <CommandItem
                          key={opt.id}
                          value={`${opt.nome} ${opt.local}`}
                          onSelect={() => toggle(opt.id)}
                          className="flex items-start gap-2 py-2"
                        >
                          <Checkbox checked={checked} className="mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{opt.nome}</div>
                            {opt.local && (
                              <div className="text-[11px] text-muted-foreground truncate">{opt.local}</div>
                            )}
                          </div>
                          <Badge variant="outline" className="ml-1 h-5 px-1.5 text-[10px] shrink-0">
                            {opt.count}
                          </Badge>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
