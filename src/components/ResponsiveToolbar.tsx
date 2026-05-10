import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

interface ResponsiveToolbarProps {
  /** Always-visible primary actions. */
  primaryActions: React.ReactNode;
  /** Collapses into a "..." menu on mobile. */
  secondaryActions?: React.ReactNode;
  className?: string;
}

/**
 * Toolbar wrapper that keeps primary actions visible and collapses
 * secondary actions into a "..." menu on mobile, preventing overflow.
 *
 * On mobile, secondary actions are rendered inside a DropdownMenuContent.
 * Pass them as a fragment of `<DropdownMenuItem>` (or compatible) for the
 * best UX, but plain buttons also work.
 */
export function ResponsiveToolbar({
  primaryActions,
  secondaryActions,
  className,
}: ResponsiveToolbarProps) {
  const isMobile = useIsMobile();

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        {primaryActions}
      </div>
      {secondaryActions && !isMobile && (
        <div className="flex items-center gap-2 flex-wrap min-w-0 ml-auto">
          {secondaryActions}
        </div>
      )}
      {secondaryActions && isMobile && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="ml-auto min-h-[44px] min-w-[44px]"
              aria-label="Mais ações"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            {secondaryActions}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export default ResponsiveToolbar;
