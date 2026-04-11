import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface CollapsibleFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  primaryFilters?: ReactNode;
  secondaryFilters?: ReactNode;
  activeSecondaryCount?: number;
  onClearSecondary?: () => void;
}

export default function CollapsibleFilters({
  search,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  primaryFilters,
  secondaryFilters,
  activeSecondaryCount = 0,
  onClearSecondary,
}: CollapsibleFiltersProps) {
  const [showMore, setShowMore] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9 h-9"
          />
        </div>

        {/* Primary filters inline */}
        {primaryFilters}

        {/* More filters toggle */}
        {secondaryFilters && (
          isMobile ? (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-9">
                  <Filter className="w-3.5 h-3.5" />
                  Filtros
                  {activeSecondaryCount > 0 && (
                    <span className="ml-1 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                      {activeSecondaryCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh]">
                <SheetHeader>
                  <SheetTitle className="flex items-center justify-between">
                    Filtros
                    {activeSecondaryCount > 0 && onClearSecondary && (
                      <Button variant="ghost" size="sm" onClick={onClearSecondary} className="text-xs gap-1">
                        <X className="w-3 h-3" /> Limpar
                      </Button>
                    )}
                  </SheetTitle>
                </SheetHeader>
                <div className="space-y-3 pt-4">
                  {secondaryFilters}
                </div>
              </SheetContent>
            </Sheet>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9"
              onClick={() => setShowMore(!showMore)}
            >
              <Filter className="w-3.5 h-3.5" />
              Mais filtros
              {activeSecondaryCount > 0 && (
                <span className="ml-1 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {activeSecondaryCount}
                </span>
              )}
            </Button>
          )
        )}
      </div>

      {/* Secondary filters expanded (desktop only) */}
      {!isMobile && showMore && secondaryFilters && (
        <div className="flex items-center gap-2 flex-wrap pt-1 pb-1 animate-in slide-in-from-top-2 duration-200">
          {secondaryFilters}
          {activeSecondaryCount > 0 && onClearSecondary && (
            <Button variant="ghost" size="sm" onClick={onClearSecondary} className="text-xs gap-1 h-8">
              <X className="w-3 h-3" /> Limpar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
