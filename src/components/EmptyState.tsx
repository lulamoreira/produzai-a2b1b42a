import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title?: string;
  subtitle?: string;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title = "Nenhum resultado encontrado",
  subtitle = "Tente ajustar os filtros ou a busca.",
  hasActiveFilters = false,
  onClearFilters,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Icon className="w-12 h-12 mb-4" style={{ color: "var(--text-muted)" }} />
      <p className="text-[15px] font-medium" style={{ color: "var(--text-secondary)" }}>
        {title}
      </p>
      <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
        {subtitle}
      </p>
      {hasActiveFilters && onClearFilters && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onClearFilters}>
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
