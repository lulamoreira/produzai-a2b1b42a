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
  stores: "#6B4F2E",
  matrix: "#8C6F4E",
  pieces: "#A07850",
  occurrences: "#7A3B2E",
  scheduling: "#5C6B3F",
  installations: "#7B5E3A",
  budgets: "#4A5568",
  chat: "#5A4A3A",
};

const ModuleGrid = ({ items, onSelect }: ModuleGridProps) => {
  const visibleItems = items.filter((i) => i.visible !== false);

  if (visibleItems.length === 0) return null;

  return (
    <div
      className="overflow-hidden"
      style={{
        background: "var(--bg-surface, #fff)",
        borderRadius: "var(--radius-card, 12px)",
        boxShadow: "var(--shadow-card)",
        padding: "16px 20px",
      }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
        {visibleItems.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className="flex flex-col items-center gap-2 rounded-[10px] cursor-pointer transition-colors"
            style={{ padding: "14px 8px" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-muted, #EDE8E0)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: color || MODULE_COLORS[key] || "#8C6F4E" }}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <span
              className="text-xs font-medium text-center leading-tight"
              style={{ color: "var(--text-secondary)" }}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ModuleGrid;
