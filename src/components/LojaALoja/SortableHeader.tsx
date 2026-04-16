import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortDir } from "@/hooks/useTableSort";

interface SortableHeaderProps {
  label: string;
  field: string;
  sortField: string | null;
  sortDir: SortDir;
  onSort: (field: string) => void;
  className?: string;
  align?: "left" | "center" | "right";
}

export default function SortableHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  className,
  align = "left",
}: SortableHeaderProps) {
  const Icon =
    sortField !== field ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  const active = sortField === field && sortDir != null;
  const justify =
    align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start";

  return (
    <TableHead
      onClick={() => onSort(field)}
      className={cn(
        "cursor-pointer select-none hover:bg-muted/50 whitespace-nowrap transition-colors",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className
      )}
    >
      <div className={cn("flex items-center gap-1", justify)}>
        {label}
        <Icon
          className={cn(
            "w-3 h-3 transition-opacity",
            active ? "opacity-100 text-foreground" : "opacity-40 text-muted-foreground"
          )}
        />
      </div>
    </TableHead>
  );
}
