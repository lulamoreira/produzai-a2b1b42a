import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardV2Props {
  status?: "success" | "warning" | "danger" | "info" | "neutral" | "purple";
  collapsed: React.ReactNode;
  expanded?: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

export default function CardV2({ status = "neutral", collapsed, expanded, defaultExpanded = false, className }: CardV2Props) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={cn("card-v2", className)} data-status={status}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">{collapsed}</div>
        {expanded && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="shrink-0 p-1 rounded hover:bg-muted/50 text-muted-foreground transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {expanded && (
        <div className={cn("card-v2-details", isExpanded ? "expanded" : "collapsed")}>
          <div className="pt-3 mt-3 border-t border-border/50">
            {expanded}
          </div>
        </div>
      )}
    </div>
  );
}
