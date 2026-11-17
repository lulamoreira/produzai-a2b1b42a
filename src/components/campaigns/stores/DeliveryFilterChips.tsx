import { cn } from "@/lib/utils";
import { DELIVERY_LABELS, DELIVERY_TYPES, type DeliveryCounts, type DeliveryType } from "@/lib/deliveryType";

export type DeliveryFilter = "all" | DeliveryType | "adjusted";

export interface DeliveryFilterChipsProps {
  value: DeliveryFilter;
  onChange: (v: DeliveryFilter) => void;
  counts: DeliveryCounts;
  total: number;
  adjustedCount: number;
}

/** Filtro rápido por tipo efetivo nesta campanha, com contagem por tipo. */
export function DeliveryFilterChips({ value, onChange, counts, total, adjustedCount }: DeliveryFilterChipsProps) {
  const chip = (key: DeliveryFilter, label: string, count: number, extra?: string) => (
    <button
      key={key}
      type="button"
      aria-pressed={value === key}
      onClick={() => onChange(key)}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors min-h-[32px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        value === key ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "opacity-90 hover:opacity-100",
        extra ?? "border-border bg-background text-foreground",
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums opacity-80">{count}</span>
    </button>
  );
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar lojas por logística nesta campanha">
      {chip("all", "Todos", total)}
      {DELIVERY_TYPES.map((t) => chip(t, DELIVERY_LABELS[t].label, counts[t], DELIVERY_LABELS[t].badgeClass))}
      {chip("adjusted", "Ajustadas nesta campanha", adjustedCount, "border-dashed border-primary/50 bg-primary/5 text-primary")}
    </div>
  );
}
