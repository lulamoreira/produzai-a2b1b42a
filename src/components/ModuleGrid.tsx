import AquaIcon from "@/components/AquaIcon";

export interface ModuleItem {
  key: string;
  label: string;
  icon: React.ElementType;
  visible?: boolean;
  color?: string;
}

interface ModuleGridProps {
  items: ModuleItem[];
  onSelect: (key: string) => void;
}

const MODULE_COLORS: Record<string, string> = {
  stores: "#6366f1",
  matrix: "#8b5cf6",
  pieces: "#3b82f6",
  occurrences: "#ef4444",
  scheduling: "#22c55e",
  installations: "#f97316",
  budgets: "#14b8a6",
  chat: "#06b6d4",
};

const ModuleGrid = ({ items, onSelect }: ModuleGridProps) => {
  const visibleItems = items.filter((i) => i.visible !== false);

  if (visibleItems.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-sm">
      <div className="flex flex-wrap justify-center gap-3">
        {visibleItems.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className="bg-muted/50 border border-border hover:bg-muted rounded-xl p-4 sm:p-5 flex flex-col items-center gap-3 transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer w-[110px] sm:w-[130px]"
          >
            <AquaIcon icon={Icon} size="lg" color={color || MODULE_COLORS[key]} />
            <span className="font-bold text-xs sm:text-sm text-foreground">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ModuleGrid;
