import { type Store } from "@/hooks/useStoreData";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface StoreSelectorProps {
  stores: Store[];
  selectedStore: Store | null;
  onSelect: (store: Store) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedState: string;
  onStateChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  states: string[];
  storeTypes: string[];
}

const StoreSelector = ({
  stores,
  selectedStore,
  onSelect,
  searchTerm,
  onSearchChange,
  selectedState,
  onStateChange,
  selectedType,
  onTypeChange,
  states,
  storeTypes,
}: StoreSelectorProps) => {
  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar loja..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-card border-border"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={selectedState}
          onChange={(e) => onStateChange(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md border border-border bg-card text-foreground"
        >
          <option value="">Todos os estados</option>
          {states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={selectedType}
          onChange={(e) => onTypeChange(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md border border-border bg-card text-foreground"
        >
          <option value="">Todos os tipos</option>
          {storeTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Store count */}
      <p className="text-xs text-muted-foreground px-1">
        {stores.length} loja(s) encontrada(s)
      </p>

      {/* Store List */}
      <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto pr-1">
        {stores.map((store) => (
          <button
            key={store.id}
            onClick={() => onSelect(store)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm group ${
              selectedStore?.id === store.id
                ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20"
                : "hover:bg-muted"
            }`}
          >
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 ${
                selectedStore?.id === store.id
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {store.number}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-medium truncate">{store.name}</span>
              <span
                className={`text-xs ${
                  selectedStore?.id === store.id
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground"
                }`}
              >
                {store.uf} · {store.type}
              </span>
            </div>
          </button>
        ))}
        {stores.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">
            Nenhuma loja encontrada
          </p>
        )}
      </div>
    </div>
  );
};

export default StoreSelector;
