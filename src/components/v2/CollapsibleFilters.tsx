import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "date";
  value: string;
  onChange: (value: string) => void;
  options?: { value: string; label: string }[];
}

interface CollapsibleFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  primaryFilters?: FilterConfig[];
  secondaryFilters?: FilterConfig[];
}

function renderFilter(f: FilterConfig) {
  if (f.type === "date") {
    return (
      <div key={f.key} className="flex items-center gap-1">
        <input
          type="date"
          value={f.value}
          onChange={(e) => f.onChange(e.target.value)}
          className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground min-w-[120px] max-w-[160px] h-9"
          title={f.label}
        />
        {f.value && (
          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs text-muted-foreground" onClick={() => f.onChange("")}>
            ✕
          </Button>
        )}
      </div>
    );
  }
  return (
    <select
      key={f.key}
      value={f.value}
      onChange={(e) => f.onChange(e.target.value)}
      className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground flex-1 min-w-[100px] max-w-[150px] h-9"
    >
      {f.options?.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

export default function CollapsibleFilters({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  primaryFilters = [],
  secondaryFilters = [],
}: CollapsibleFiltersProps) {
  const [showMore, setShowMore] = useState(false);
  const isMobile = useIsMobile();

  const activeSecondaryCount = secondaryFilters.filter(f => f.value !== "").length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9 h-9"
          />
        </div>

        {/* Primary filters */}
        {primaryFilters.map(renderFilter)}

        {/* More filters toggle */}
        {secondaryFilters.length > 0 && (
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
                    {activeSecondaryCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => secondaryFilters.forEach(f => f.onChange(""))} className="text-xs gap-1">
                        <X className="w-3 h-3" /> Limpar
                      </Button>
                    )}
                  </SheetTitle>
                </SheetHeader>
                <div className="space-y-3 pt-4">
                  {secondaryFilters.map(renderFilter)}
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
      {!isMobile && showMore && secondaryFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-1 pb-1 animate-in slide-in-from-top-2 duration-200">
          {secondaryFilters.map(renderFilter)}
          {activeSecondaryCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => secondaryFilters.forEach(f => f.onChange(""))} className="text-xs gap-1 h-8">
              <X className="w-3 h-3" /> Limpar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
