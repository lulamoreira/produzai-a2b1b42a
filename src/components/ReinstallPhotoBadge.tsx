import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

interface Props {
  reinstallSeq?: number | null;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Small overlay badge shown on top of a photo thumbnail when the photo
 * was uploaded during a reinstallation (reinstall_seq > 0).
 * Renders nothing for original installation photos (seq 0 / null).
 */
export function ReinstallPhotoBadge({ reinstallSeq, size = "sm", className }: Props) {
  if (!reinstallSeq || reinstallSeq <= 0) return null;
  const cls = size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs";
  return (
    <div className={`absolute top-2 left-2 z-10 pointer-events-none ${className ?? ""}`}>
      <Badge
        variant="outline"
        className={`bg-amber-100 dark:bg-amber-950/70 border-amber-400 text-amber-800 dark:text-amber-200 ${cls} gap-1 shadow-sm`}
      >
        <RefreshCw className="w-3 h-3" />
        Reinst. #{reinstallSeq}
      </Badge>
    </div>
  );
}

export default ReinstallPhotoBadge;
