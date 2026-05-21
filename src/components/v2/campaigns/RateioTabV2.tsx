import React, { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { 
  Table2, BarChart3 as BarChart3Icon, ChevronDown, ChevronUp, 
  Search, Filter, Download, Sparkles, RefreshCw, Layers, 
  Undo2, Redo2, Copy, MoreHorizontal, Lock, CheckCircle2
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import MatrixFilterSidebar, { EMPTY_FILTERS, EMPTY_STORE_FILTERS, type PieceFilters, type StoreFilters, type FilterLogicMode } from "@/components/MatrixFilterSidebar";
import StoresMatrixTable from "@/components/StoresMatrixTable";
import MatrixDistributionDashboard from "@/components/Matrix/MatrixDistributionDashboard";
import { exportMatrixExcelJS } from "@/lib/exportMatrixExcelJS";
import { useUserRole } from "@/hooks/useUserRole";

interface RateioTabV2Props {
  campaignId: string;
  clientId: string;
  campaign: any;
  agency: any;
  client: any;
  pieces: any[];
  kits: any[];
  kitPieces: any[];
  stores: any[];
  qtyMap: Record<string, number>;
  canEditCampaignStores: boolean;
  activeAdjustment: any;
  hasNegotiationRateio: boolean;
  winnerSupplierId: string | null | undefined;
  winnerSupplierName: string;
  rateioSource: "original" | "negotiation" | "adjustment";
  setRateioSource: (source: "original" | "negotiation" | "adjustment") => void;
  vigenteSource: "original" | "negotiation" | "adjustment";
  isViewingVigente: boolean;
  handleResetNegotiationRateio: () => void;
  handleCancelNegotiationRateio: () => void;
  isNegotiationView: boolean;
  hasAnyAdjustment: boolean;
  setActiveSection: (section: string) => void;
}

export default function RateioTabV2({
  campaignId,
  clientId,
  campaign,
  agency,
  client,
  pieces,
  kits,
  kitPieces,
  stores,
  qtyMap,
  canEditCampaignStores,
  activeAdjustment,
  hasNegotiationRateio,
  winnerSupplierId,
  winnerSupplierName,
  rateioSource,
  setRateioSource,
  vigenteSource,
  isViewingVigente,
  handleResetNegotiationRateio,
  handleCancelNegotiationRateio,
  isNegotiationView,
  hasAnyAdjustment,
  setActiveSection
}: RateioTabV2Props) {
  const { t } = useTranslation();
  const { isAdminOrMaster } = useUserRole();
  
  const [rateioView, setRateioView] = useState("planilha");
  const [filterSidebarCollapsed, setFilterSidebarCollapsed] = useState(true);
  const [matrixToolbarCollapsed, setMatrixToolbarCollapsed] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const [pieceFilters, setPieceFilters] = useState<PieceFilters>({ ...EMPTY_FILTERS });
  const [storeFilters, setStoreFilters] = useState<StoreFilters>({ ...EMPTY_STORE_FILTERS });
  const [filterLogicMode, setFilterLogicMode] = useState<FilterLogicMode>("and");

  // Excel-like tabs state
  const storageKey = `rateio-active-tab-${campaignId}`;
  const [activeVersionTab, setActiveVersionTab] = useState<string>(() => {
    return localStorage.getItem(storageKey) || vigenteSource;
  });

  // Sync state with local storage
  useEffect(() => {
    localStorage.setItem(storageKey, activeVersionTab);
    setRateioSource(activeVersionTab as any);
  }, [activeVersionTab, storageKey, setRateioSource]);

  // Persist source from props if it changes externally
  useEffect(() => {
    if (rateioSource !== activeVersionTab) {
      setActiveVersionTab(rateioSource);
    }
  }, [rateioSource]);

  const customFieldLabels = useMemo(() => {
    return Array.from({ length: 15 }, (_, idx) => {
      const i = idx + 1;
      const label = (client as any)?.[`custom_field_${i}_label`];
      return label ? { index: i, label } : null;
    }).filter((x): x is { index: number; label: string } => x !== null);
  }, [client]);

  const filteredStores = useMemo(() => {
    return stores.filter(s => {
      const q = storeSearch.toLowerCase();
      const matchesSearch = !q || 
        s.name?.toLowerCase().includes(q) || 
        s.nickname?.toLowerCase().includes(q) || 
        s.city?.toLowerCase().includes(q) || 
        s.store_code?.toLowerCase().includes(q);
      
      // Basic city/state filtering logic (can be expanded based on MatrixFilterSidebar)
      return matchesSearch;
    });
  }, [stores, storeSearch]);

  const isLatestTab = activeVersionTab === vigenteSource;

  // Tabs for the excel-like navigation
  const versionTabs = useMemo(() => {
    const tabs = [{ id: "original", label: "Rateio Original" }];
    
    if (hasNegotiationRateio && winnerSupplierId) {
      tabs.push({ id: "negotiation", label: `Negociação · ${winnerSupplierName}` });
    }
    
    if (activeAdjustment) {
      tabs.push({ id: "adjustment", label: `Ajuste · ${activeAdjustment.name}` });
    }
    
    return tabs;
  }, [hasNegotiationRateio, winnerSupplierId, winnerSupplierName, activeAdjustment]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Top Navigation for Spreadsheet/Dashboard */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-stone-200">
        <Tabs value={rateioView} onValueChange={setRateioView} className="w-auto">
          <TabsList className="bg-stone-100 h-9 p-1">
            <TabsTrigger value="planilha" className="text-xs gap-2 px-3 h-7 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Table2 className="w-3.5 h-3.5" />
              {t("modules.matrix", "Rateio")}
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="text-xs gap-2 px-3 h-7 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <BarChart3Icon className="w-3.5 h-3.5" />
              Dashboard
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {isAdminOrMaster && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setActiveSection("adjustments")}
            className="text-xs gap-2 text-stone-500 hover:text-stone-900"
          >
            <Layers className="w-3.5 h-3.5" />
            {t("modules.adjustments", "Ajustes")}
          </Button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <MatrixFilterSidebar
          collapsed={filterSidebarCollapsed}
          onCollapsedChange={setFilterSidebarCollapsed}
          pieces={pieces}
          stores={stores}
          filters={pieceFilters}
          onFiltersChange={setPieceFilters}
          storeFilters={storeFilters}
          onStoreFiltersChange={setStoreFilters}
          customFieldLabels={customFieldLabels.map(cf => ({ key: `custom_field_${cf.index}` as any, label: cf.label }))}
          filterLogicMode={filterLogicMode}
          onFilterLogicModeChange={setFilterLogicMode}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {rateioView === "planilha" ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Excel-like Version Tabs */}
              <div className="bg-stone-50 border-b border-stone-200 px-6 pt-2 flex items-end gap-1 overflow-x-auto no-scrollbar">
                {versionTabs.map((tab) => {
                  const isActive = activeVersionTab === tab.id;
                  const isCurrentVigente = vigenteSource === tab.id;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveVersionTab(tab.id)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all border-x border-t whitespace-nowrap",
                        isActive 
                          ? "bg-white border-stone-200 text-stone-900 -mb-px shadow-[0_-2px_10px_rgba(0,0,0,0.02)]" 
                          : "bg-stone-100 border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-50"
                      )}
                    >
                      {!isCurrentVigente && <Lock className="w-3 h-3 text-stone-400" />}
                      {tab.label}
                      {isCurrentVigente && (
                        <span className="flex items-center gap-1 bg-[#C2714F]/10 text-[#C2714F] px-1.5 py-0.5 rounded text-[10px] font-bold">
                          {t("rateio.activeTab", "ATIVO")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Rateio Header Banner */}
              <div className={cn(
                "px-6 py-3 border-b flex flex-col md:flex-row md:items-center justify-between gap-4",
                isLatestTab 
                  ? "bg-stone-50/50 border-stone-100" 
                  : "bg-amber-50/50 border-amber-100"
              )}>
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "mt-1 p-1 rounded-full",
                    isLatestTab ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                  )}>
                    {isLatestTab ? <CheckCircle2 className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-stone-900">
                      {isLatestTab ? t("rateio.currentRateio", "Rateio vigente") : t("rateio.readOnly", "Visualização somente leitura")}
                      : <span className="font-normal text-stone-600 ml-1">
                        {activeVersionTab === "adjustment" ? activeAdjustment?.name : activeVersionTab === "negotiation" ? winnerSupplierName : "Original"}
                      </span>
                    </div>
                    {activeVersionTab === "adjustment" && isLatestTab && (
                      <div className="text-xs text-stone-500 mt-0.5">
                        {t("rateio.syncWith", "Sincronizado com")}: <span className="font-medium">{hasNegotiationRateio ? "Negociação" : "Original"}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Filters and Actions Bar */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                    <Input 
                      value={storeSearch} 
                      onChange={(e) => setStoreSearch(e.target.value)} 
                      placeholder={t("rateio.searchStore", "Buscar loja...")} 
                      className="pl-8 h-9 text-xs bg-white border-stone-200 rounded-lg shadow-sm focus:ring-1 focus:ring-stone-200"
                    />
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={cn(
                      "h-9 text-xs gap-2 rounded-lg border-stone-200 shadow-sm transition-all",
                      !filterSidebarCollapsed && "bg-stone-100 border-stone-300"
                    )}
                    onClick={() => setFilterSidebarCollapsed(!filterSidebarCollapsed)}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    {t("common.filters", "Filtros")}
                  </Button>

                  <div className="h-6 w-px bg-stone-200 mx-1 hidden sm:block" />

                  {isLatestTab && (
                    <>
                      <div className="flex items-center bg-stone-100 rounded-lg p-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-stone-900"><Undo2 className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-stone-900"><Redo2 className="w-3.5 h-3.5" /></Button>
                      </div>

                      <Button variant="outline" size="sm" className="h-9 text-xs gap-2 rounded-lg border-stone-200 shadow-sm hover:bg-stone-50">
                        <Sparkles className="w-3.5 h-3.5 text-[#C2714F]" />
                        {t("rateio.matrixAutomation", "AUTOMAÇÃO DE MATRIZ")}
                      </Button>

                      <Button variant="outline" size="sm" className="h-9 text-xs gap-2 rounded-lg border-stone-200 shadow-sm hover:bg-stone-50">
                        <Copy className="w-3.5 h-3.5" />
                        {t("rateio.copyQuantities", "COPIAR QUANTIDADES")}
                      </Button>
                    </>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 text-xs gap-2 rounded-lg border-stone-200 shadow-sm">
                        <Download className="w-3.5 h-3.5" />
                        {t("common.export", "Exportar")}
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => exportMatrixExcelJS(stores, pieces, qtyMap, campaign.name, kits, kitPieces, undefined, [], [], pieces, agency?.name, client?.name)} className="text-xs py-2 cursor-pointer">
                        {t("rateio.exportRateio", "EXPORTAR RATEIO")}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-xs py-2 cursor-pointer">
                        {t("rateio.exportByStore", "EXPORTAR RATEIO POR LOJA")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {isLatestTab && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg border border-stone-200 shadow-sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Spreadsheet Content */}
              <div className="flex-1 overflow-hidden relative">
                <StoresMatrixTable 
                  clientId={clientId}
                  stores={filteredStores}
                  customFieldLabels={customFieldLabels}
                  canEdit={canEditCampaignStores && isLatestTab}
                  onUpdateStore={async () => {}} // Metadata updates handled elsewhere
                  storeSearch={storeSearch}
                  storeStateFilter=""
                  // The component itself handles pieces/quantities internally via hooks if needed
                  // but usually it receives them. Let's ensure it's compatible with v2 design.
                />
              </div>
              
              {/* Footer / Counter */}
              <div className="px-6 py-2 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-[11px] text-stone-500 font-medium">
                <div>
                  {filteredStores.length} {t("rateio.stores", "loja(s)")}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {t("rateio.activeTab", "ATIVO")}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-stone-300" />
                    Zero
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-6 bg-stone-50/30">
              <MatrixDistributionDashboard 
                pieces={pieces}
                stores={stores}
                qtyMap={qtyMap}
                kits={kits}
                kitPieces={kitPieces}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}