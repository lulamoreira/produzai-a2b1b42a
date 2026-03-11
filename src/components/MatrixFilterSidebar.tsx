import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Filter, PanelLeftClose, PanelLeft, X, Search } from "lucide-react";
import type { CampaignPiece } from "@/hooks/useMultiClientData";

export type PieceFilters = {
  category: Set<string>;
  name: Set<string>;
  store_category: Set<string>;
  size: Set<string>;
  specification: Set<string>;
  installation_instructions: Set<string>;
  kit_only: Set<string>;
  is_mockup: Set<string>;
};

const EMPTY_FILTERS: PieceFilters = {
  category: new Set(),
  name: new Set(),
  store_category: new Set(),
  size: new Set(),
  specification: new Set(),
  installation_instructions: new Set(),
  kit_only: new Set(),
  is_mockup: new Set(),
};

interface FilterGroupProps {
  label: string;
  filterKey: keyof PieceFilters;
  options: string[];
  selected: Set<string>;
  onToggle: (key: keyof PieceFilters, value: string) => void;
}

const FilterGroup = ({ label, filterKey, options, selected, onToggle }: FilterGroupProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const hasSelection = selected.size > 0;

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  if (options.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 rounded-md transition-colors">
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span>{label}</span>
          {hasSelection && (
            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {selected.size}
            </span>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pb-2">
        {options.length > 6 && (
          <div className="relative mb-1.5">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-[11px] pl-7 pr-6"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
          {filteredOptions.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 px-2 py-1 rounded text-[11px] text-foreground hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <Checkbox
                checked={selected.has(option)}
                onCheckedChange={() => onToggle(filterKey, option)}
                className="h-3.5 w-3.5"
              />
              <span className="truncate">{option}</span>
            </label>
          ))}
          {filteredOptions.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-2">Nenhum resultado</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

interface MatrixFilterSidebarProps {
  pieces: CampaignPiece[];
  filters: PieceFilters;
  onFiltersChange: (filters: PieceFilters) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

const MatrixFilterSidebar = ({
  pieces,
  filters,
  onFiltersChange,
  collapsed,
  onCollapsedChange,
}: MatrixFilterSidebarProps) => {
  // Extract unique options from pieces for each field
  const filterOptions = useMemo(() => {
    const categories = [...new Set(pieces.map((p) => p.category).filter(Boolean))].sort();
    const names = [...new Set(pieces.map((p) => p.name).filter(Boolean))].sort();
    const storeCategories = [...new Set(pieces.map((p) => p.store_category).filter(Boolean) as string[])].sort();
    const sizes = [...new Set(pieces.map((p) => p.size).filter(Boolean))].sort();
    const specifications = [...new Set(pieces.map((p) => p.specification).filter(Boolean))].sort();
    const instructions = [...new Set(pieces.map((p) => p.installation_instructions).filter(Boolean))].sort();
    const kitOnly = pieces.some((p) => p.kit_only) ? ["Sim", "Não"] : [];
    const isMockup = pieces.some((p) => p.is_mockup) ? ["Sim", "Não"] : [];

    return {
      category: categories,
      name: names,
      store_category: storeCategories,
      size: sizes,
      specification: specifications,
      installation_instructions: instructions,
      kit_only: kitOnly,
      is_mockup: isMockup,
    };
  }, [pieces]);

  const handleToggle = (key: keyof PieceFilters, value: string) => {
    const newSet = new Set(filters[key]);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    onFiltersChange({ ...filters, [key]: newSet });
  };

  const activeFilterCount = Object.values(filters).reduce((sum, set) => sum + set.size, 0);

  const clearAll = () => {
    onFiltersChange({ ...EMPTY_FILTERS });
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-3 gap-2 border-r border-border bg-card/50 w-10 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onCollapsedChange(false)}
          title="Abrir filtros"
        >
          <PanelLeft className="w-4 h-4" />
        </Button>
        {activeFilterCount > 0 && (
          <span className="bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 border-r border-border bg-card/50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-foreground">Filtros de Peças</span>
          {activeFilterCount > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onCollapsedChange(true)}
          title="Recolher filtros"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Clear all button */}
      {activeFilterCount > 0 && (
        <div className="px-3 py-1.5 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] h-6 gap-1 text-destructive hover:text-destructive w-full justify-start"
            onClick={clearAll}
          >
            <X className="w-3 h-3" /> Limpar todos os filtros
          </Button>
        </div>
      )}

      {/* Filter groups */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          <FilterGroup label="Localização na Loja" filterKey="category" options={filterOptions.category} selected={filters.category} onToggle={handleToggle} />
          <FilterGroup label="Nome" filterKey="name" options={filterOptions.name} selected={filters.name} onToggle={handleToggle} />
          <FilterGroup label="Modelo de Loja" filterKey="store_category" options={filterOptions.store_category} selected={filters.store_category} onToggle={handleToggle} />
          <FilterGroup label="Medidas" filterKey="size" options={filterOptions.size} selected={filters.size} onToggle={handleToggle} />
          <FilterGroup label="Especificação" filterKey="specification" options={filterOptions.specification} selected={filters.specification} onToggle={handleToggle} />
          <FilterGroup label="Instruções de Instalação" filterKey="installation_instructions" options={filterOptions.installation_instructions} selected={filters.installation_instructions} onToggle={handleToggle} />
          {filterOptions.kit_only.length > 0 && (
            <FilterGroup label="Peça para Kit" filterKey="kit_only" options={filterOptions.kit_only} selected={filters.kit_only} onToggle={handleToggle} />
          )}
          {filterOptions.is_mockup.length > 0 && (
            <FilterGroup label="Mockup" filterKey="is_mockup" options={filterOptions.is_mockup} selected={filters.is_mockup} onToggle={handleToggle} />
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export { EMPTY_FILTERS };
export default MatrixFilterSidebar;
