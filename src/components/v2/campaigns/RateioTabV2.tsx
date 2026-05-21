import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { 
  Table2, BarChart3 as BarChart3Icon, ChevronDown, ChevronUp, 
  Search, Filter, Download, Sparkles, Copy, MoreHorizontal, Lock, CheckCircle2,
  Undo2, Redo2, Store as StoreIcon, MapPin, Tag, Layers
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import MatrixFilterSidebar, { EMPTY_FILTERS, EMPTY_STORE_FILTERS, type PieceFilters, type StoreFilters, type FilterLogicMode } from "@/components/MatrixFilterSidebar";
import MatrixDistributionDashboard from "@/components/Matrix/MatrixDistributionDashboard";
import { exportMatrixExcelJS } from "@/lib/exportMatrixExcelJS";
import { useUserRole } from "@/hooks/useUserRole";
import { getStateColor } from "@/lib/stateColors";
import { useUpdateCampaignStorePiece } from "@/hooks/useMultiClientData";
import { toast } from "sonner";

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
  const updatePieceQty = useUpdateCampaignStorePiece();
  
  const [rateioView, setRateioView] = useState("planilha");
  const [filterSidebarCollapsed, setFilterSidebarCollapsed] = useState(true);
  const [storeSearch, setStoreSearch] = useState("");
  const [pieceFilters, setPieceFilters] = useState<PieceFilters>({ ...EMPTY_FILTERS });
  const [storeFilters, setStoreFilters] = useState<StoreFilters>({ ...EMPTY_STORE_FILTERS });
  const [filterLogicMode, setFilterLogicMode] = useState<FilterLogicMode>("and");
  
  // Sorting state - supporting multiple levels
  const [sortConfig, setSortConfig] = useState<{ key: "name" | "state"; direction: "asc" | "desc" }[]>([]);

  const toggleSort = (key: "name" | "state", multi: boolean = false) => {
    setSortConfig(prev => {
      const existing = prev.find(s => s.key === key);
      
      if (existing) {
        if (existing.direction === "asc") {
          // Toggle to desc
          const updated = prev.map(s => s.key === key ? { ...s, direction: "desc" as const } : s);
          return updated;
        } else {
          // Remove this sort
          return prev.filter(s => s.key !== key);
        }
      } else {
        // Add new sort level
        const newSort = { key, direction: "asc" as const };
        return multi ? [...prev, newSort] : [newSort];
      }
    });
  };

  // Excel-like tabs state
  const storageKey = `rateio-active-tab-${campaignId}`;
  const [activeVersionTab, setActiveVersionTab] = useState<string>(() => {
    return localStorage.getItem(storageKey) || vigenteSource;
  });

  // Sync state with local storage
  useEffect(() => {
    localStorage.setItem(storageKey, activeVersionTab);
    if (activeVersionTab !== rateioSource) {
      setRateioSource(activeVersionTab as any);
    }
  }, [activeVersionTab, storageKey, setRateioSource, rateioSource]);

  // Persist source from props if it changes externally
  useEffect(() => {
    if (rateioSource !== activeVersionTab) {
      setActiveVersionTab(rateioSource);
    }
  }, [rateioSource, activeVersionTab]);

  const isLatestTab = activeVersionTab === vigenteSource;

  // Filter stores
  const filteredStores = useMemo(() => {
    let result = stores.filter(s => {
      const q = storeSearch.toLowerCase();
      const matchesSearch = !q || 
        s.name?.toLowerCase().includes(q) || 
        s.nickname?.toLowerCase().includes(q) || 
        s.city?.toLowerCase().includes(q) || 
        s.store_code?.toLowerCase().includes(q);
      
      // Apply sidebar filters
      if (storeFilters.city.size > 0 && !storeFilters.city.has(s.city)) return false;
      if (storeFilters.state.size > 0 && !storeFilters.state.has(s.state?.trim())) return false;
      if (storeFilters.store_model.size > 0 && !storeFilters.store_model.has(s.store_model)) return false;
      
      return matchesSearch;
    });

    if (sortConfig.length > 0) {
      result = [...result].sort((a, b) => {
        for (const sort of sortConfig) {
          const key = sort.key;
          const valA = (a[key] || "").toString().trim().toLowerCase();
          const valB = (b[key] || "").toString().trim().toLowerCase();
          
          if (valA < valB) return sort.direction === "asc" ? -1 : 1;
          if (valA > valB) return sort.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [stores, storeSearch, storeFilters, sortConfig]);

  // Build unified columns (pieces + kits) ordered like the Pieces module
  // (display_order, piece-before-kit on ties). Kit-only pieces are hidden.
  type ColumnItem = {
    _type: "piece" | "kit";
    id: string;
    code: number | string;
    name: string;
    image_url?: string | null;
    image_report_url?: string | null;
    category?: string | null;
    store_category?: string | null;
    display_order: number;
    raw: any;
  };

  const columns = useMemo<ColumnItem[]>(() => {
    const pieceCols: ColumnItem[] = pieces
      .filter((p: any) => !p.kit_only)
      .filter((p: any) => {
        if (pieceFilters.category.size > 0 && !pieceFilters.category.has(p.category)) return false;
        if (pieceFilters.name.size > 0 && !pieceFilters.name.has(p.name)) return false;
        if (pieceFilters.store_category.size > 0 && !pieceFilters.store_category.has(p.store_category)) return false;
        return true;
      })
      .map((p: any) => ({
        _type: "piece" as const,
        id: p.id,
        code: p.code,
        name: p.name,
        image_url: p.image_url,
        image_report_url: p.image_report_url,
        category: p.category,
        store_category: p.store_category,
        display_order: p.display_order ?? 0,
        raw: p,
      }));

    const kitCols: ColumnItem[] = (kits || []).map((k: any) => ({
      _type: "kit" as const,
      id: k.id,
      code: k.code,
      name: k.name,
      image_url: k.image_url,
      image_report_url: k.image_report_url,
      category: k.category,
      store_category: k.category,
      display_order: k.display_order ?? 0,
      raw: k,
    }));

    return [...pieceCols, ...kitCols].sort((a, b) => {
      const d = (a.display_order ?? 0) - (b.display_order ?? 0);
      if (d !== 0) return d;
      if (a._type !== b._type) return a._type === "piece" ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    });
  }, [pieces, kits, pieceFilters]);

  // Pre-compute kit quantity per store from components (read-only display)
  const kitQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const kit of kits || []) {
      const kpList = (kitPieces || []).filter((kp: any) => kp.kit_id === kit.id);
      if (kpList.length === 0) continue;
      for (const s of stores) {
        const q = Math.min(
          ...kpList.map((kp: any) => {
            const baseQty = qtyMap[`${s.id}-${kp.piece_id}`] || 0;
            return Math.floor(baseQty / (kp.quantity || 1));
          })
        );
        map[`${s.id}-${kit.id}`] = Number.isFinite(q) ? q : 0;
      }
    }
    return map;
  }, [kits, kitPieces, stores, qtyMap]);

  // Compute column totals
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    columns.forEach(col => {
      let total = 0;
      const isKit = col._type === "kit";
      stores.forEach(store => {
        if (isKit) {
          total += kitQtyMap[`${store.id}-${col.id}`] || 0;
        } else {
          total += qtyMap[`${store.id}-${col.id}`] || 0;
        }
      });
      totals[`${col._type}-${col.id}`] = total;
    });
    return totals;
  }, [columns, stores, qtyMap, kitQtyMap]);

  // Group columns by store_category label, preserving sorted order (no global re-sort)
  const pieceGroups = useMemo(() => {
    const groups: { label: string; items: ColumnItem[] }[] = [];
    columns.forEach((c) => {
      const label = !c.store_category || c.store_category === "TODAS" ? "TODAS" : "ÚNICA";
      const last = groups[groups.length - 1];
      if (!last || last.label !== label) {
        groups.push({ label, items: [c] });
      } else {
        last.items.push(c);
      }
    });
    return groups;
  }, [columns]);

  // Cell editing state
  const [editingCell, setEditingCell] = useState<{ storeId: string; pieceId: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = (storeId: string, pieceId: string, currentVal: number) => {
    if (!canEditCampaignStores || !isLatestTab) return;
    setEditingCell({ storeId, pieceId });
    setEditValue(currentVal === 0 ? "" : String(currentVal));
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    const { storeId, pieceId } = editingCell;
    const qty = parseInt(editValue, 10) || 0;
    
    try {
      await updatePieceQty.mutateAsync({ campaignId, storeId, pieceId, quantity: qty });
    } catch (err) {
      toast.error("Erro ao atualizar quantidade");
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") setEditingCell(null);
  };

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

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
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

              {/* Filters Row */}
              <div className="px-6 py-2 border-b border-stone-100 bg-white flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                  <Input 
                    value={storeSearch} 
                    onChange={(e) => setStoreSearch(e.target.value)} 
                    placeholder={t("rateio.searchStore", "Buscar loja...")} 
                    className="pl-8 h-8 text-xs bg-stone-50 border-none rounded-md"
                  />
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn("h-8 text-[11px] font-bold uppercase tracking-wider gap-2 px-3", !filterSidebarCollapsed && "bg-stone-100")}
                  onClick={() => setFilterSidebarCollapsed(!filterSidebarCollapsed)}
                >
                  <Filter className="w-3 h-3" />
                  {t("common.filters", "Filtros")}
                </Button>

                <div className="h-4 w-px bg-stone-200" />
                
                <div className="text-[11px] font-medium text-stone-400 uppercase tracking-widest">
                  ESTADO
                </div>
                <div className="text-[11px] font-medium text-stone-400 uppercase tracking-widest">
                  CIDADE
                </div>
                <div className="text-[11px] font-medium text-stone-400 uppercase tracking-widest">
                  CATEGORIA DE LOJA
                </div>
                
                <div className="flex-1" />
                
                <div className="text-[11px] text-stone-500 font-bold">
                  {filteredStores.length} {t("rateio.stores", "loja(s)")}
                </div>
              </div>

              {/* Spreadsheet Table */}
              <div className="flex-1 overflow-auto relative custom-scrollbar">
                <table className="border-collapse min-w-full">
                  <thead className="sticky top-0 z-30 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                    {/* Group Labels Row */}
                    <tr>
                      <th className="w-[300px] sticky left-0 z-40 bg-white border-r border-stone-200" />
                      {pieceGroups.map((group, gIdx) => (
                        <th 
                          key={gIdx} 
                          colSpan={group.items.length} 
                          className="bg-stone-50 border-b border-r border-stone-200 text-[10px] font-bold text-stone-500 py-1 text-center uppercase tracking-widest"
                        >
                          {group.label}
                        </th>
                      ))}
                    </tr>
                    {/* Piece Headers Row */}
                    <tr>
                      <th className="w-[300px] sticky left-0 z-40 bg-white p-4 border-r border-b border-stone-200 text-left align-top">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">Loja</div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={cn(
                                "h-6 w-6 rounded-md transition-all relative", 
                                sortConfig.some(s => s.key === 'state') && "bg-stone-100 text-[#C2714F]"
                              )}
                              onClick={(e) => toggleSort('state', e.shiftKey || e.metaKey || e.ctrlKey)}
                              title="Ordenar por Estado (Shift + Clique para multi-nível)"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              {sortConfig.length > 1 && sortConfig.findIndex(s => s.key === 'state') !== -1 && (
                                <span className="absolute -top-1 -right-1 flex items-center justify-center w-3 h-3 bg-[#C2714F] text-white text-[8px] rounded-full font-bold">
                                  {sortConfig.findIndex(s => s.key === 'state') + 1}
                                </span>
                              )}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={cn(
                                "h-6 w-6 rounded-md transition-all relative", 
                                sortConfig.some(s => s.key === 'name') && "bg-stone-100 text-[#C2714F]"
                              )}
                              onClick={(e) => toggleSort('name', e.shiftKey || e.metaKey || e.ctrlKey)}
                              title="Ordenar por Nome (Shift + Clique para multi-nível)"
                            >
                              <Tag className="w-3.5 h-3.5" />
                              {sortConfig.length > 1 && sortConfig.findIndex(s => s.key === 'name') !== -1 && (
                                <span className="absolute -top-1 -right-1 flex items-center justify-center w-3 h-3 bg-[#C2714F] text-white text-[8px] rounded-full font-bold">
                                  {sortConfig.findIndex(s => s.key === 'name') + 1}
                                </span>
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="text-[10px] text-stone-400 font-medium leading-tight">Total de peças distribuídas por ponto de venda</div>
                      </th>
                      {columns.map((col) => {
                        const isKit = col._type === "kit";
                        const img = col.image_url || col.image_report_url || undefined;
                        return (
                          <th key={`${col._type}-${col.id}`} className="min-w-[120px] max-w-[200px] p-2 border-r border-b border-stone-200 align-top bg-white transition-colors hover:bg-stone-50">
                            <div className="flex flex-col items-center gap-1.5">
                              {img ? (
                                <img 
                                  src={img} 
                                  alt={col.name} 
                                  className="w-12 h-12 rounded-lg object-cover border border-stone-100 shadow-sm" 
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center">
                                  <Table2 className="w-4 h-4 text-stone-300" />
                                </div>
                              )}
                              <div className="text-sm font-black text-stone-900 leading-none">{col.code}</div>
                              {isKit && (
                                <div className="text-[9px] font-bold text-[#C2714F] leading-none uppercase">KIT</div>
                              )}
                              <div className="text-[10px] text-stone-500 font-medium leading-tight text-center px-1 whitespace-normal break-normal line-clamp-3">
                                {col.name}
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {filteredStores.map(store => (
                      <tr key={store.id} className="group even:bg-stone-100/80 odd:bg-white hover:bg-[#C2714F]/[0.08] transition-colors">
                        <td className="sticky left-0 z-20 bg-white group-hover:bg-stone-50/50 border-r border-b border-stone-200 p-3 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                              style={{ 
                                backgroundColor: getStateColor(store.state).bg, 
                                color: getStateColor(store.state).text 
                              }}
                            >
                              {store.state}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-stone-900 text-xs truncate">{store.name}</span>
                                {store.nickname && (
                                  <span className="text-[10px] text-stone-400 truncate">({store.nickname})</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <StoreIcon className="w-3 h-3 text-stone-300 shrink-0" />
                                <Badge variant="secondary" className="bg-stone-100 text-stone-500 border-none text-[9px] h-4 px-1.5 font-bold uppercase">
                                  {store.store_model || "PADRÃO"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </td>
                        {columns.map((col) => {
                          const isKit = col._type === "kit";
                          const val = isKit
                            ? (kitQtyMap[`${store.id}-${col.id}`] || 0)
                            : (qtyMap[`${store.id}-${col.id}`] || 0);
                          const isEditing = !isKit && editingCell?.storeId === store.id && editingCell?.pieceId === col.id;

                          return (
                            <td 
                              key={`${col._type}-${col.id}`} 
                              className={cn(
                                "border-r border-b border-stone-200 text-center transition-all",
                                isKit ? "cursor-default bg-[#C2714F]/[0.03]" : "cursor-pointer",
                                val > 0 && !isKit ? "bg-stone-50/30" : "",
                                isEditing && "ring-2 ring-inset ring-[#C2714F] z-10"
                              )}
                              onClick={() => !isKit && startEditing(store.id, col.id, val)}
                            >
                              {isEditing ? (
                                <input
                                  ref={inputRef}
                                  type="text"
                                  className="w-full h-full bg-transparent text-center text-xs font-bold focus:outline-none"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveEdit}
                                  onKeyDown={handleKeyDown}
                                />
                              ) : (
                                <div className={cn(
                                  "w-full h-full min-h-[48px] flex items-center justify-center text-xs transition-all",
                                  val > 0 
                                    ? (isKit ? "text-[#C2714F] font-black" : "text-stone-900 font-black scale-110") 
                                    : "text-stone-200 font-medium"
                                )}>
                                  {val > 0 ? val : "—"}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  {/* Table Footer with Totals */}
                  <tfoot className="sticky bottom-0 z-30 bg-stone-50 shadow-[0_-1px_0_0_rgba(0,0,0,0.05)]">
                    <tr>
                      <td className="sticky left-0 z-20 bg-stone-50 border-r border-t border-stone-200 p-3 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                        <div className="text-xs font-black text-stone-900 uppercase tracking-widest text-right pr-4">TOTAL</div>
                      </td>
                      {columns.map((col) => {
                        const total = columnTotals[`${col._type}-${col.id}`] || 0;
                        return (
                          <td 
                            key={`total-${col._type}-${col.id}`} 
                            className={cn(
                              "border-r border-t border-stone-200 text-center py-3 px-2 text-xs font-black",
                              total === 0 ? "bg-red-500 text-white" : "bg-stone-50 text-stone-900"
                            )}
                          >
                            {total}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              {/* Spreadsheet Footer */}
              <div className="px-6 py-2 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-[11px] text-stone-500 font-medium">
                <div className="flex items-center gap-6">
                  <div>
                    {filteredStores.length} {t("rateio.stores", "loja(s)")}
                  </div>
                  <div>
                    {columns.length} {t("pieces.pieceCountShort", "peça(s)")}
                  </div>
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