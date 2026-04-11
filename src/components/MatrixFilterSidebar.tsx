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
import { ChevronDown, ChevronRight, ChevronLeft, Filter, SlidersHorizontal, X, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CampaignPiece, ClientStore } from "@/hooks/useMultiClientData";

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

export type StoreFilters = {
  city: Set<string>;
  state: Set<string>;
  store_model: Set<string>;
  custom_field_1: Set<string>;
  custom_field_2: Set<string>;
  custom_field_3: Set<string>;
  custom_field_4: Set<string>;
  custom_field_5: Set<string>;
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

const EMPTY_STORE_FILTERS: StoreFilters = {
  city: new Set(),
  state: new Set(),
  store_model: new Set(),
  custom_field_1: new Set(),
  custom_field_2: new Set(),
  custom_field_3: new Set(),
  custom_field_4: new Set(),
  custom_field_5: new Set(),
};

interface FilterGroupProps {
  label: string;
  filterKey: string;
  options: string[];
  selected: Set<string>;
  onToggle: (key: string, value: string) => void;
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

interface CustomFieldLabel {
  key: keyof StoreFilters;
  label: string;
}

interface MatrixFilterSidebarProps {
  pieces: CampaignPiece[];
  stores: ClientStore[];
  filters: PieceFilters;
  storeFilters: StoreFilters;
  onFiltersChange: (filters: PieceFilters) => void;
  onStoreFiltersChange: (filters: StoreFilters) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  customFieldLabels?: CustomFieldLabel[];
}

const MatrixFilterSidebar = ({
  pieces,
  stores,
  filters,
  storeFilters,
  onFiltersChange,
  onStoreFiltersChange,
  collapsed,
  onCollapsedChange,
  customFieldLabels = [],
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

  // Extract unique options from stores
  const storeFilterOptions = useMemo(() => {
    const cities = [...new Set(stores.map((s) => s.city).filter(Boolean) as string[])].sort();
    const states = [...new Set(stores.map((s) => s.state?.trim()).filter(Boolean) as string[])].sort();
    const models = [...new Set(stores.map((s) => s.store_model).filter(Boolean) as string[])].sort();
    const cf1 = [...new Set(stores.map((s) => s.custom_field_1).filter(Boolean) as string[])].sort();
    const cf2 = [...new Set(stores.map((s) => s.custom_field_2).filter(Boolean) as string[])].sort();
    const cf3 = [...new Set(stores.map((s) => s.custom_field_3).filter(Boolean) as string[])].sort();
    const cf4 = [...new Set(stores.map((s) => s.custom_field_4).filter(Boolean) as string[])].sort();
    const cf5 = [...new Set(stores.map((s) => s.custom_field_5).filter(Boolean) as string[])].sort();

    return {
      city: cities,
      state: states,
      store_model: models,
      custom_field_1: cf1,
      custom_field_2: cf2,
      custom_field_3: cf3,
      custom_field_4: cf4,
      custom_field_5: cf5,
    };
  }, [stores]);

  const handleToggle = (key: string, value: string) => {
    // Check if it's a piece filter or store filter
    if (key in filters) {
      const k = key as keyof PieceFilters;
      const newSet = new Set(filters[k]);
      if (newSet.has(value)) newSet.delete(value); else newSet.add(value);
      onFiltersChange({ ...filters, [k]: newSet });
    } else if (key in storeFilters) {
      const k = key as keyof StoreFilters;
      const newSet = new Set(storeFilters[k]);
      if (newSet.has(value)) newSet.delete(value); else newSet.add(value);
      onStoreFiltersChange({ ...storeFilters, [k]: newSet });
    }
  };

  const activeFilterCount =
    Object.values(filters).reduce((sum, set) => sum + set.size, 0) +
    Object.values(storeFilters).reduce((sum, set) => sum + set.size, 0);

  const clearAll = () => {
    onFiltersChange({ ...EMPTY_FILTERS });
    onStoreFiltersChange({ ...EMPTY_STORE_FILTERS });
  };

  if (collapsed) {
    return (
      <div className="hidden lg:flex flex-col items-center py-3 gap-2 border-r border-border bg-card/50 w-10 shrink-0">
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

  // Build custom field filter groups dynamically
  const customFieldGroups = customFieldLabels
    .filter((cf) => storeFilterOptions[cf.key].length > 0)
    .map((cf) => (
      <FilterGroup
        key={cf.key}
        label={cf.label}
        filterKey={cf.key}
        options={storeFilterOptions[cf.key]}
        selected={storeFilters[cf.key]}
        onToggle={handleToggle}
      />
    ));

  return (
    <div className="hidden lg:flex w-64 shrink-0 border-r border-border bg-card/50 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-foreground">Filtros</span>
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
          {/* Piece filters */}
          <div className="px-3 py-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Peças</span>
          </div>
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

          {/* Store filters */}
          <div className="px-3 py-1.5 mt-2 border-t border-border">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Lojas</span>
          </div>
          <FilterGroup label="Cidade" filterKey="city" options={storeFilterOptions.city} selected={storeFilters.city} onToggle={handleToggle} />
          <FilterGroup label="Estado" filterKey="state" options={storeFilterOptions.state} selected={storeFilters.state} onToggle={handleToggle} />
          {storeFilterOptions.store_model.length > 0 && (
            <FilterGroup label="Modelo de Loja" filterKey="store_model" options={storeFilterOptions.store_model} selected={storeFilters.store_model} onToggle={handleToggle} />
          )}

          {/* Custom field filters */}
          {customFieldGroups.length > 0 && (
            <>
              <div className="px-3 py-1.5 mt-2 border-t border-border">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Campos Personalizados</span>
              </div>
              {customFieldGroups}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export { EMPTY_FILTERS, EMPTY_STORE_FILTERS };
export default MatrixFilterSidebar;
