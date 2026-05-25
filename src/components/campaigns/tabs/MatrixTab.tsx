import React, { useState, useMemo, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { 
  Table2, BarChart3 as BarChart3Icon, ChevronDown, ChevronUp, 
  Search, Filter, X, Grid3X3, ArrowDownAZ, MapPin, Copy, 
  Trash2, Package, MoreHorizontal, Presentation, Download, Upload, Sparkles, RefreshCw, AlertTriangle, Layers,
  ArrowUpDown, Check
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import MatrixDistributionDashboard from "@/components/Matrix/MatrixDistributionDashboard";
import MatrixFilterSidebar, { EMPTY_FILTERS, EMPTY_STORE_FILTERS, type PieceFilters, type StoreFilters, type FilterLogicMode } from "@/components/MatrixFilterSidebar";
import { exportMatrixExcelJS } from "@/lib/exportMatrixExcelJS";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import StoresMatrixTable from "@/components/StoresMatrixTable";
import { useUpdateCampaignStorePiece, useBulkUpdateCampaignStorePieces } from "@/hooks/useMultiClientData";

interface MatrixTabProps {
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

export default function MatrixTab({
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
}: MatrixTabProps) {
  const { t } = useTranslation();
  const [rateioView, setRateioView] = useState("planilha");
  const [matrixToolbarCollapsed, setMatrixToolbarCollapsed] = useState(false);
  const [filterSidebarCollapsed, setFilterSidebarCollapsed] = useState(true);
  const [filterLogicMode, setFilterLogicMode] = useState<FilterLogicMode>("and");
  const [pieceFilters, setPieceFilters] = useState<PieceFilters>({ ...EMPTY_FILTERS });
  const [storeFilters, setStoreFilters] = useState<StoreFilters>({ ...EMPTY_STORE_FILTERS });
  const [storeSearch, setStoreSearch] = useState("");
  const [storeSortField, setStoreSortField] = useState(() => {
    return localStorage.getItem(`rateio_sort_field_${campaignId}`) || "name";
  });

  const handleSortChange = (field: string) => {
    setStoreSortField(field);
    localStorage.setItem(`rateio_sort_field_${campaignId}`, field);
  };

  const getSortLabel = (field: string) => {
    if (field === "name") return t("stores.name", "Nome");
    if (field === "city") return t("stores.city", "Cidade");
    if (field === "state") return t("stores.state", "Estado");
    if (field === "store_model") return t("pieces.storeModelLabel", "Categoria de Loja");
    if (field.startsWith("custom_field_")) {
      const idx = parseInt(field.replace("custom_field_", ""), 10);
      const label = customFieldLabels.find(cf => cf.index === idx)?.label;
      return label || field;
    }
    return field;
  };

  const sortedStores = useMemo(() => {
    return [...stores].sort((a, b) => {
      let valA = (a as any)[storeSortField];
      let valB = (b as any)[storeSortField];

      if (valA === null || valA === undefined) valA = "";
      if (valB === null || valB === undefined) valB = "";

      // Numerical sort for specific fields if needed, but localeCompare with numeric: true is usually enough
      return valA.toString().localeCompare(valB.toString(), 'pt-BR', { numeric: true });
    });
  }, [stores, storeSortField]);

  const handleUpdateStorePiece = async (data: { id: string } & Partial<any>) => {
    // This is for store metadata updates from StoresMatrixTable
  };

  const { isAdminOrMaster } = useUserRole();

  const customFieldLabels = useMemo(() => {
    return Array.from({ length: 15 }, (_, idx) => {
      const i = idx + 1;
      const label = (client as any)?.[`custom_field_${i}_label`];
      return label ? { index: i, label } : null;
    }).filter((x): x is { index: number; label: string } => x !== null);
  }, [client]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
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
          <Tabs value={rateioView} onValueChange={setRateioView} className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b border-border bg-muted/20 px-2 sm:px-3 pt-2">
              <div className="flex items-center justify-between">
                <TabsList className="h-8 bg-muted/60">
                  <TabsTrigger value="planilha" className="text-xs gap-1.5 h-6 px-2.5">
                    <Table2 className="w-3.5 h-3.5" />
                    {t("modules.matrix", "Rateio")}
                  </TabsTrigger>
                  <TabsTrigger value="dashboard" className="text-xs gap-1.5 h-6 px-2.5">
                    <BarChart3Icon className="w-3.5 h-3.5" />
                    Dashboard
                  </TabsTrigger>
                </TabsList>
                
                {isAdminOrMaster && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setActiveSection("adjustments")}
                    className="h-8 text-xs gap-1.5 mr-2 text-muted-foreground hover:text-foreground"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    {t("modules.adjustments", "Ajustes")}
                  </Button>
                )}
              </div>
            </div>
            
            <TabsContent value="planilha" className="flex-1 flex flex-col overflow-hidden mt-0 data-[state=inactive]:hidden">
               {/* Rateio source banner */}
               {(activeAdjustment || (hasNegotiationRateio && winnerSupplierId)) && (() => {
                  const vigenteLabel = vigenteSource === "adjustment" ? `Rateio do Ajuste · ${activeAdjustment?.name ?? ""}` : vigenteSource === "negotiation" ? `Rateio da Negociação · ${winnerSupplierName}` : "Rateio Original";
                  const currentLabel = rateioSource === "adjustment" ? `Rateio do Ajuste · ${activeAdjustment?.name ?? ""}` : rateioSource === "negotiation" ? `Rateio da Negociação · ${winnerSupplierName}` : "Rateio Original";
                  const adjSyncedLabel = (hasNegotiationRateio && winnerSupplierId) ? "Negociação" : "Original";

                  return (
                    <div className={`border-b px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${isViewingVigente ? "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-900/10" : "border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10"}`}>
                      <div className="flex items-start gap-2 text-xs min-w-0">
                        <span className={`mt-1 inline-block h-2 w-2 rounded-full shrink-0 ${isViewingVigente ? "bg-emerald-500" : "bg-amber-500"}`} />
                        <div className="min-w-0">
                          {isViewingVigente ? (
                            <>
                              <div className="font-medium text-foreground">Rateio vigente: <span className="font-semibold">{vigenteLabel}</span></div>
                              {vigenteSource === "adjustment" && (
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  Sincronizado com: <strong>{adjSyncedLabel}</strong> · Edições aqui valem para o ajuste; o rateio original e o da negociação ficam preservados.
                                </div>
                              )}
                              {vigenteSource === "negotiation" && <div className="text-[11px] text-muted-foreground mt-0.5">O rateio original congelado fica preservado em "Ver rateios anteriores".</div>}
                            </>
                          ) : (
                            <>
                              <div className="font-medium text-amber-900 dark:text-amber-200">Visualizando rateio histórico (somente leitura): <span className="font-semibold">{currentLabel}</span></div>
                              <div className="text-[11px] text-amber-800/80 dark:text-amber-200/80 mt-0.5">Este rateio não é mais o vigente. As edições devem ser feitas no rateio vigente: <strong>{vigenteLabel}</strong>.</div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isViewingVigente && <Button size="sm" className="h-7 text-xs" onClick={() => setRateioSource(vigenteSource)}>← {t("common.backToVigente", "Voltar ao vigente")}</Button>}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-7 text-xs">{t("common.viewPreviousRateios", "Ver rateios anteriores")} ▾</Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64">
                            {vigenteSource !== "original" && <DropdownMenuItem onClick={() => setRateioSource("original")}><div className="flex flex-col"><span className="text-xs font-medium">Rateio Original</span><span className="text-[10px] text-muted-foreground">Congelado · somente leitura</span></div></DropdownMenuItem>}
                            {vigenteSource !== "negotiation" && hasNegotiationRateio && winnerSupplierId && <DropdownMenuItem onClick={() => setRateioSource("negotiation")}><div className="flex flex-col"><span className="text-xs font-medium">Rateio da Negociação</span><span className="text-[10px] text-muted-foreground">{winnerSupplierName} · somente leitura</span></div></DropdownMenuItem>}
                            {vigenteSource !== "adjustment" && activeAdjustment && <DropdownMenuItem onClick={() => setRateioSource("adjustment")}><div className="flex flex-col"><span className="text-xs font-medium">Rateio do Ajuste</span><span className="text-[10px] text-muted-foreground">{activeAdjustment.name}</span></div></DropdownMenuItem>}
                            {isNegotiationView && (<><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setActiveSection("budgets")}><span className="text-xs">← Voltar à Negociação</span></DropdownMenuItem></>)}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
               })()}

               <div className="border-b border-border bg-muted/30">
                  <div className="flex items-center justify-between px-3 py-1">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{matrixToolbarCollapsed ? t("common.filtersAndActionsHidden", "Filtros e Ações Ocultos") : t("common.filtersAndActions", "Filtros e Ações")}</span>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setMatrixToolbarCollapsed(!matrixToolbarCollapsed)} className="h-6 px-2 text-xs gap-1">
                        {matrixToolbarCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                        {matrixToolbarCollapsed ? t("common.expand", "Expandir") : t("common.collapse", "Recolher")}
                      </Button>
                    </div>
                  </div>
                  {!matrixToolbarCollapsed && (
                    <div className="px-3 pb-2 pt-1 flex flex-wrap items-center gap-2">
                       <div className="relative w-full sm:w-64">
                         <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                         <Input 
                             value={storeSearch} 
                             onChange={(e) => setStoreSearch(e.target.value)} 
                             placeholder={t("stores.searchAll")} 

                            className="pl-8 h-8 text-xs"
                         />
                       </div>
                       
                       <Button 
                          variant={filterSidebarCollapsed ? "outline" : "secondary"} 
                          size="sm" 
                          className="h-8 text-xs gap-1.5"
                          onClick={() => setFilterSidebarCollapsed(!filterSidebarCollapsed)}
                       >
                         <Filter className="w-3.5 h-3.5" />
                         {t("common.filters", "Filtros")}
                         {(Object.values(pieceFilters).some(s => s.size > 0) || Object.values(storeFilters).some(s => s.size > 0)) && (
                           <span className="ml-1 px-1.5 py-0.5 rounded-full bg-brand-500 text-white text-[10px]">!</span>
                         )}
                       </Button>

                       <div className="flex-1" />

                       <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs gap-1.5"
                          onClick={() => exportMatrixExcelJS(stores, pieces, qtyMap, campaign.name, kits, kitPieces, undefined, [], [], pieces, agency?.name, client?.name)}
                       >
                         <Download className="w-3.5 h-3.5" />
                         {t("common.exportExcel", "Exportar Excel")}
                       </Button>
                    </div>
                  )}
               </div>

               <div className="flex-1 overflow-hidden">
                 <StoresMatrixTable 
                    clientId={clientId}
                    campaignId={campaignId}
                    stores={stores.filter(s => {
                      const q = storeSearch.toLowerCase().trim();
                      return !q || Object.values(s).some(val => 
                        (typeof val === 'string' || typeof val === 'number') && 
                        val.toString().toLowerCase().includes(q)
                      );
                    })}
                    customFieldLabels={customFieldLabels}
                    canEdit={canEditCampaignStores && isViewingVigente}
                    onUpdateStore={handleUpdateStorePiece}
                    storeSearch={storeSearch}
                    storeStateFilter=""
                 />

               </div>
            </TabsContent>

            <TabsContent value="dashboard" className="flex-1 overflow-auto mt-0 data-[state=inactive]:hidden p-4">
              <MatrixDistributionDashboard 
                pieces={pieces}
                stores={stores}
                qtyMap={qtyMap}
                kits={kits}
                kitPieces={kitPieces}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
