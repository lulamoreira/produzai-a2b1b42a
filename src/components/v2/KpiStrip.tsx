import { cn } from "@/lib/utils";

export interface KpiItem {
  key: string;
  label: string;
  value: number;
  color?: string;
  primary?: boolean;
}

interface KpiStripProps {
  items: KpiItem[];
  activeKey?: string;
  onItemClick?: (key: string) => void;
}

export default function KpiStrip({ items, activeKey, onItemClick }: KpiStripProps) {
  return (
    <div className="kpi-strip-v2">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={cn(
            "kpi-item",
            item.primary && "primary",
            activeKey === item.key && "active"
          )}
          onClick={() => onItemClick?.(item.key)}
        >
          <span className={cn("kpi-value", item.color)}>
            {item.value}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
