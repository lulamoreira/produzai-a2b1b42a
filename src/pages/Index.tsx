import { useState, useMemo } from "react";
import {
  useStores,
  usePieces,
  useAllStorePieces,
  type Store,
} from "@/hooks/useStoreData";
import { useAuth } from "@/hooks/useAuth";
import StoreSelector from "@/components/StoreSelector";
import StoreDetail from "@/components/StoreDetail";
import AddPieceDialog from "@/components/AddPieceDialog";
import { exportAllStores, exportFilteredStores } from "@/lib/exportExcel";
import {
  Package,
  ChevronLeft,
  Download,
  FileSpreadsheet,
  Filter,
  LogOut,
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Index = () => {
  const { user, signOut } = useAuth();
  const { data: stores = [], isLoading: loadingStores } = useStores();
  const { data: pieces = [], isLoading: loadingPieces } = usePieces();
  const { data: allStorePieces = [] } = useAllStorePieces();

  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [showList, setShowList] = useState(true);

  const statesList = useMemo(
    () => [...new Set(stores.map((s) => s.uf))].sort(),
    [stores]
  );
  const typesList = useMemo(
    () => [...new Set(stores.map((s) => s.type))].sort(),
    [stores]
  );

  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      const matchesSearch = store.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesState = !selectedState || store.uf === selectedState;
      const matchesType = !selectedType || store.type === selectedType;
      return matchesSearch && matchesState && matchesType;
    });
  }, [stores, searchTerm, selectedState, selectedType]);

  const totalPieces = useMemo(() => {
    return allStorePieces.reduce((sum, sp) => sum + sp.quantity, 0);
  }, [allStorePieces]);

  const handleSelectStore = (store: Store) => {
    setSelectedStore(store);
    setShowList(false);
  };

  const isLoading = loadingStores || loadingPieces;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-gradient-to-r from-card via-card to-primary/5 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-display font-bold text-foreground leading-tight">
                Lindt Excellence Pistache
              </h1>
              <p className="text-xs text-muted-foreground">
                Campanha Brasil 2026
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground mr-3">
              <span>
                <strong className="text-foreground">{stores.length}</strong> lojas
              </span>
              <span>·</span>
              <span>
                <strong className="text-foreground">{totalPieces}</strong> peças
              </span>
            </div>

            <AddPieceDialog existingPieces={pieces} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Download className="w-4 h-4 mr-1" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportAllStores(stores, pieces, allStorePieces)}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Todas as Lojas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportFilteredStores(filteredStores, pieces, allStorePieces)}>
                  <Filter className="w-4 h-4 mr-2" />
                  Com Filtros Aplicados ({filteredStores.length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="gap-1">
                  <UserCircle className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs max-w-[100px] truncate">
                    {user?.email?.split("@")[0]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                  {user?.email}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto flex min-h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <aside
          className={`w-full md:w-80 lg:w-96 border-r border-border p-4 md:block shrink-0 ${
            showList ? "block" : "hidden md:block"
          }`}
        >
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
            states={statesList}
            storeTypes={typesList}
          />
        </aside>

        {/* Detail panel */}
        <main
          className={`flex-1 p-6 ${!showList ? "block" : "hidden md:block"}`}
        >
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
            <StoreDetail
              store={selectedStore}
              pieces={pieces}
              allStorePieces={allStorePieces}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-4">
                <Package className="w-10 h-10 text-primary/60" />
              </div>
              <h2 className="text-xl font-display font-bold text-foreground mb-2">
                Selecione uma loja
              </h2>
              <p className="text-muted-foreground text-sm max-w-xs">
                Escolha uma loja na lista ao lado para ver e editar as peças da
                campanha.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
