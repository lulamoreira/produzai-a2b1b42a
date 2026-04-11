import { cn } from "@/lib/utils";

export interface KpiItem {
  label: string;
  value: number;
  color?: "success" | "warning" | "danger" | "info" | "neutral" | "purple";
  primary?: boolean;
}

interface KpiStripProps {
  items: KpiItem[];
  activeFilter?: string;
  onFilterClick?: (label: string) => void;
}

const colorMap: Record<string, string> = {
  success: "text-green-600",
  warning: "text-amber-600",
  danger: "text-red-600",
  info: "text-blue-600",
  neutral: "text-muted-foreground",
  purple: "text-purple-600",
};

export default function KpiStrip({ items, activeFilter, onFilterClick }: KpiStripProps) {
  return (
    <div className="kpi-strip-v2">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={cn(
            "kpi-item",
            item.primary && "primary",
            activeFilter === item.label && "active"
          )}
          onClick={() => onFilterClick?.(item.label)}
        >
          <span className={cn("kpi-value", item.color && colorMap[item.color])}>
            {item.value}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
