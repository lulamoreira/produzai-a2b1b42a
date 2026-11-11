import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LojaALojaTipo } from "@/hooks/useLojaALoja";

export interface InternosMaterialsPickerProps {
  storeName: string;
  tipo: LojaALojaTipo;
  canEdit: boolean;
  /** Returns whether the material (subdivision) is selected for this store. */
  isSelected: (subId: string) => boolean;
  /** Saves one material for this store. */
  onToggle: (subId: string, selected: boolean) => void;
  /** Saves every material of this letter for this store at once. */
  onSetAll: (selected: boolean) => Promise<void> | void;
}

/**
 * Dropdown that lists every material (subdivision) registered for an
 * internal letter (e.g. H) in this campaign, so each store can receive
 * an individual multi-selection. Materials come from the campaign data,
 * never from a fixed list.
 */
export function InternosMaterialsPicker({
  storeName, tipo, canEdit, isSelected, onToggle, onSetAll,
}: InternosMaterialsPickerProps) {
  const [busy, setBusy] = useState(false);
  const subs = tipo.subdivisoes ?? [];
  const selectedCount = subs.filter((s) => isSelected(s.id)).length;
  const total = subs.length;
  const state: "all" | "some" | "none" =
    selectedCount === 0 ? "none" : selectedCount === total ? "all" : "some";

  const handleSetAll = async (selected: boolean) => {
    if (!canEdit || busy) return;
    setBusy(true);
    try { await onSetAll(selected); } finally { setBusy(false); }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Materiais internos ${tipo.letra} de ${storeName}: ${selectedCount} de ${total} selecionados`}
          title="Escolher materiais internos desta loja"
          className={cn(
            "inline-flex items-center gap-0.5 h-7 rounded-full border pl-2 pr-1 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            state === "all" && "bg-primary text-primary-foreground border-primary",
            state === "some" && "bg-primary/10 text-primary border-primary",
            state === "none" && "bg-background text-muted-foreground border-border hover:border-primary/50"
          )}
        >
          {tipo.letra}
          <span className="font-medium tabular-nums opacity-90">{selectedCount}/{total}</span>
          <ChevronDown className="h-3 w-3" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end" collisionPadding={8}>
        <div className="mb-1.5 px-1">
          <p className="text-xs font-semibold text-foreground">{tipo.letra} · {tipo.nome}</p>
          <p className="text-[11px] text-muted-foreground truncate">{storeName} — {selectedCount} de {total} materiais</p>
        </div>
        {total === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            Nenhum material cadastrado nesta letra. Cadastre em "Loja a Loja".
          </p>
        ) : (
          <>
            {canEdit && (
              <div className="flex gap-1 px-1 pb-1.5">
                <Button size="sm" variant="outline" className="h-7 text-[11px] flex-1" disabled={busy || state === "all"} onClick={() => handleSetAll(true)}>
                  Marcar todos
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[11px] flex-1" disabled={busy || state === "none"} onClick={() => handleSetAll(false)}>
                  Desmarcar todos
                </Button>
              </div>
            )}
            <div className="max-h-72 overflow-y-auto space-y-0.5">
              {subs.map((sub) => {
                const checked = isSelected(sub.id);
                return (
                  <label
                    key={sub.id}
                    className={cn(
                      "flex items-start gap-2 rounded px-1.5 py-1 text-sm",
                      canEdit ? "cursor-pointer hover:bg-muted/60" : "cursor-default opacity-80"
                    )}
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={checked}
                      disabled={!canEdit || busy}
                      onCheckedChange={(v) => onToggle(sub.id, !!v)}
                    />
                    <span className="leading-tight">{sub.nome}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
