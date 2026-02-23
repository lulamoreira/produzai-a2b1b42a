import { useState, useMemo } from "react";
import { stores, Store } from "@/data/storeData";
import StoreSelector from "@/components/StoreSelector";
import StoreDetail from "@/components/StoreDetail";
import { Package, ChevronLeft } from "lucide-react";

const Index = () => {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [showList, setShowList] = useState(true);

  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      const matchesSearch = store.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesState = !selectedState || store.uf === selectedState;
      const matchesType = !selectedType || store.type === selectedType;
      return matchesSearch && matchesState && matchesType;
    });
  }, [searchTerm, selectedState, selectedType]);

  const totalPieces = useMemo(() => {
    return stores.reduce((sum, s) => sum + Object.values(s.quantities).reduce((a, b) => a + b, 0), 0);
  }, []);

  const handleSelectStore = (store: Store) => {
    setSelectedStore(store);
    setShowList(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-display font-bold text-foreground leading-tight">
                Lindt Excellence Pistache
              </h1>
              <p className="text-xs text-muted-foreground">Campanha Brasil 2026</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
            <span><strong className="text-foreground">{stores.length}</strong> lojas</span>
            <span>·</span>
            <span><strong className="text-foreground">{totalPieces}</strong> peças total</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto flex min-h-[calc(100vh-73px)]">
        {/* Sidebar - store list */}
        <aside className={`w-full md:w-80 lg:w-96 border-r border-border p-4 md:block shrink-0 ${
          showList ? "block" : "hidden md:block"
        }`}>
          <StoreSelector
            stores={filteredStores}
            selectedStore={selectedStore}
            onSelect={handleSelectStore}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedState={selectedState}
            onStateChange={setSelectedState}
            selectedType={selectedType}
            onTypeChange={setSelectedType}
          />
        </aside>

        {/* Detail panel */}
        <main className={`flex-1 p-6 ${!showList ? "block" : "hidden md:block"}`}>
          {/* Mobile back button */}
          {!showList && (
            <button
              onClick={() => setShowList(true)}
              className="md:hidden flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar à lista
            </button>
          )}

          {selectedStore ? (
            <StoreDetail store={selectedStore} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-display font-bold text-foreground mb-2">
                Selecione uma loja
              </h2>
              <p className="text-muted-foreground text-sm max-w-xs">
                Escolha uma loja na lista ao lado para ver quais peças da campanha serão enviadas.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
