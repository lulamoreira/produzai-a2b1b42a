import { type LucideIcon } from "lucide-react";

export interface ModuleItem {
  key: string;
  label: string;
  icon: LucideIcon;
  visible?: boolean;
}

interface ModuleGridProps {
  items: ModuleItem[];
  onSelect: (key: string) => void;
  title?: string;
  subtitle?: string;
}

const ModuleGrid = ({ items, onSelect, title, subtitle }: ModuleGridProps) => {
  const visibleItems = items.filter((i) => i.visible !== false);

  if (visibleItems.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-sm">
      {(title || subtitle) && (
        <div className="mb-5">
          {title && <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>}
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}
      >
        {visibleItems.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className="bg-primary/5 border border-primary/20 hover:bg-primary/10 rounded-xl p-4 sm:p-5 flex flex-col items-center gap-3 transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer"
          >
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary flex items-center justify-center shadow-md">
              <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
            </div>
            <span className="font-bold text-xs sm:text-sm text-foreground">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ModuleGrid;
