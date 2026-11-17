import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DELIVERY_LABELS, type DeliveryType } from "@/lib/deliveryType";

export interface DeliveryTypeBadgeProps extends ComponentPropsWithoutRef<"span"> {
  /** Tipo efetivo nesta campanha. */
  type: DeliveryType;
  /** Padrão do cadastro da loja (mostrado no tooltip quando há ajuste). */
  storeDefault: DeliveryType;
  /** true quando o tipo vem de ajuste desta campanha. */
  isOverride: boolean;
  /** Mostra a setinha de menu (selo clicável). */
  interactive?: boolean;
}

/** Selo do tipo de logística efetivo, com marcador "nesta campanha" quando ajustado. */
export const DeliveryTypeBadge = forwardRef<HTMLSpanElement, DeliveryTypeBadgeProps>(
  ({ type, storeDefault, isOverride, interactive = false, className, ...rest }, ref) => {
    const info = DELIVERY_LABELS[type];
    const title = isOverride
      ? `${info.text} nesta campanha · Padrão da loja: ${DELIVERY_LABELS[storeDefault].text}`
      : `${info.text} (padrão da loja)`;
    return (
      <span ref={ref} className={cn("inline-flex flex-wrap items-center gap-1", className)} title={title} {...rest}>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border",
            info.badgeClass,
          )}
        >
          {info.label}
          {interactive && <ChevronDown className="w-3 h-3 opacity-70" aria-hidden />}
        </span>
        {isOverride && (
          <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold border border-dashed border-primary/50 text-primary bg-primary/5">
            nesta campanha
          </span>
        )}
      </span>
    );
  },
);
DeliveryTypeBadge.displayName = "DeliveryTypeBadge";
