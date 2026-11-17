import { Check, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DELIVERY_LABELS, DELIVERY_TYPES, type DeliveryType } from "@/lib/deliveryType";
import { DeliveryTypeBadge } from "./DeliveryTypeBadge";

export interface DeliveryTypeMenuProps {
  storeName: string;
  type: DeliveryType;
  storeDefault: DeliveryType;
  isOverride: boolean;
  canEdit: boolean;
  disabled?: boolean;
  /** tipo escolhido, ou null = voltar ao padrão da loja. */
  onSelect: (tipo: DeliveryType | null) => void;
}

/**
 * Selo clicável: escolhe o tipo SÓ nesta campanha ou volta ao padrão da loja.
 * Sem permissão de edição, mostra apenas o selo.
 */
export function DeliveryTypeMenu({ storeName, type, storeDefault, isOverride, canEdit, disabled, onSelect }: DeliveryTypeMenuProps) {
  if (!canEdit) {
    return <DeliveryTypeBadge type={type} storeDefault={storeDefault} isOverride={isOverride} />;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        aria-label={`Logística de ${storeName} nesta campanha: ${DELIVERY_LABELS[type].text}. Alterar`}
      >
        <DeliveryTypeBadge type={type} storeDefault={storeDefault} isOverride={isOverride} interactive />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-semibold">Logística nesta campanha</DropdownMenuLabel>
        {DELIVERY_TYPES.map((t) => (
          <DropdownMenuItem key={t} onSelect={() => onSelect(t)} className="text-sm gap-2">
            <span className="w-4 shrink-0">{isOverride && type === t ? <Check className="w-4 h-4" /> : null}</span>
            {DELIVERY_LABELS[t].label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onSelect(null)} disabled={!isOverride} className="text-sm gap-2">
          <span className="w-4 shrink-0">{!isOverride ? <Check className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}</span>
          Voltar ao padrão da loja ({DELIVERY_LABELS[storeDefault].text})
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
