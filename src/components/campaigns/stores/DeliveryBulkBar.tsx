import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DELIVERY_LABELS, DELIVERY_TYPES, type DeliveryType } from "@/lib/deliveryType";

export interface DeliveryBulkBarProps {
  count: number;
  disabled?: boolean;
  onPick: (tipo: DeliveryType | null) => void;
  onClear: () => void;
}

/** Barra de ação da seleção múltipla: "Logística nesta campanha (N lojas)". */
export function DeliveryBulkBar({ count, disabled, onPick, onClear }: DeliveryBulkBarProps) {
  if (count === 0) return null;
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
      <span className="text-sm font-medium">{count} {count === 1 ? "loja selecionada" : "lojas selecionadas"}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" disabled={disabled} className="gap-1 h-auto min-h-9 whitespace-normal text-left max-w-full">
            Logística nesta campanha ({count} {count === 1 ? "loja" : "lojas"})
            <ChevronDown className="w-4 h-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {DELIVERY_TYPES.map((t) => (
            <DropdownMenuItem key={t} onSelect={() => onPick(t)} className="text-sm">
              {DELIVERY_LABELS[t].label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onPick(null)} className="text-sm">
            Voltar ao padrão de cada loja
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" variant="ghost" onClick={onClear} className="gap-1 ml-auto">
        <X className="w-4 h-4" /> Limpar seleção
      </Button>
    </div>
  );
}
