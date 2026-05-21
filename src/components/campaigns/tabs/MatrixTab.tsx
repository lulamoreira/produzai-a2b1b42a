import React, { useState, useMemo, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { 
  Table2, BarChart3 as BarChart3Icon, ChevronDown, ChevronUp, 
  Search, Filter, X, Grid3X3, ArrowDownAZ, MapPin, Copy, 
  Trash2, Package, MoreHorizontal, Presentation, Download, Upload, Sparkles, RefreshCw, AlertTriangle
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import MatrixDistributionDashboard from "@/components/Matrix/MatrixDistributionDashboard";
import MatrixFilterSidebar, { EMPTY_FILTERS, EMPTY_STORE_FILTERS, type PieceFilters, type StoreFilters, type FilterLogicMode } from "@/components/MatrixFilterSidebar";
import { exportMatrixExcelJS } from "@/lib/exportMatrixExcelJS";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import StoresMatrixTable from "@/components/StoresMatrixTable";
import { useUpdateCampaignStorePiece, useBulkUpdateCampaignStorePieces } from "@/hooks/useMultiClientData";
import { StoreDetailsPopover } from "./StoreDetailsPopover";
import { getStateColor } from "@/lib/stateColors";
import PieceThumbnail from "@/components/PieceThumbnail";

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
  const [rateioView, setRateioView] = useState("planilha");
  const [matrixToolbarCollapsed, setMatrixToolbarCollapsed] = useState(false);
  const [filterSidebarCollapsed, setFilterSidebarCollapsed] = useState(true);
  const [filterLogicMode, setFilterLogicMode] = useState<FilterLogicMode>("and");
  const [pieceFilters, setPieceFilters] = useState<PieceFilters>({ ...EMPTY_FILTERS });
  const [storeFilters, setStoreFilters] = useState<StoreFilters>({ ...EMPTY_STORE_FILTERS });
  const [storeSearch, setStoreSearch] = useState("");
  const [editingCell, setEditingCell] = useState<{ storeId: string; pieceId: string } | null>(null);

  const updateStorePiece = useUpdateCampaignStorePiece();
  const bulkUpdateStorePieces = useBulkUpdateCampaignStorePieces();

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

  // ─── Filtered pieces for matrix (by piece filters) ───
  const matrixPieces = useMemo(() => {
    let filtered = [...pieces];

    const f = pieceFilters;
    const activeChecks: ((p: any) => boolean)[] = [];
    if (f.category.size > 0) activeChecks.push((p) => f.category.has(p.category));
    if (f.name.size > 0) activeChecks.push((p) => f.name.has(p.name));
    if (f.store_category.size > 0) activeChecks.push((p) => !!p.store_category && f.store_category.has(p.store_category));
    if (f.size.size > 0) activeChecks.push((p) => f.size.has(p.size));
    if (f.specification.size > 0) activeChecks.push((p) => f.specification.has(p.specification));
    if (f.installation_instructions.size > 0) activeChecks.push((p) => f.installation_instructions.has(p.installation_instructions));
    if (f.kit_only.size > 0) activeChecks.push((p) => f.kit_only.has(p.kit_only ? "Sim" : "Não"));
    if (f.is_mockup.size > 0) activeChecks.push((p) => f.is_mockup.has(p.is_mockup ? "Sim" : "Não"));

    if (activeChecks.length > 0) {
      filtered = filtered.filter((p) => {
        const results = activeChecks.map((check) => check(p));
        if (filterLogicMode === "and") return results.every(Boolean);
        return results.some(Boolean);
      });
    }

    return filtered;
  }, [pieces, pieceFilters, filterLogicMode]);

  // Kits appear as virtual columns in the matrix
  const matrixKits = useMemo(() => kits, [kits]);

  const getKitCategory = useCallback((kit: any) => {
    if (kit.category) return kit.category;
    const kpRows = kitPieces.filter((kp) => kp.kit_id === kit.id);
    for (const kp of kpRows) {
      const piece = pieces.find((p) => p.id === kp.piece_id);
      if (piece?.category) return piece.category;
    }
    return null;
  }, [kitPieces, pieces]);

  // Unified matrix columns sorted by display_order
  type MatrixCol = { type: "piece"; data: any; display_order: number } | { type: "kit"; data: any; display_order: number };
  const matrixColumns: MatrixCol[] = useMemo(() => {
    return [
      ...matrixPieces.map(p => ({ type: "piece" as const, data: p, display_order: p.display_order })),
      ...matrixKits.map(k => ({ type: "kit" as const, data: k, display_order: k.display_order })),
    ].sort((a, b) =>
      a.display_order - b.display_order
      || (a.type === b.type ? 0 : a.type === "piece" ? -1 : 1)
      || (a.data.id < b.data.id ? -1 : 1)
    );
  }, [matrixPieces, matrixKits]);

  const matrixCategoryGroups = useMemo(() => {
    const groups: { label: string; span: number }[] = [];
    let currentCat: string | null = null;
    let currentSpan = 0;
    matrixColumns.forEach((col) => {
      const cat = col.type === "piece"
        ? (col.data.category || "Sem localização")
        : (getKitCategory(col.data) || "Sem localização");
      if (cat !== currentCat) {
        if (currentCat !== null) groups.push({ label: currentCat, span: currentSpan });
        currentCat = cat;
        currentSpan = 1;
      } else {
        currentSpan++;
      }
    });
    if (currentCat !== null) groups.push({ label: currentCat, span: currentSpan });
    return groups;
  }, [matrixColumns, getKitCategory]);

  const columnTints = useMemo(() => {
    const tints: string[] = [];
    let currentCat: string | null = null;
    let tintIndex = -1;
    matrixColumns.forEach((col) => {
      const cat = col.type === "piece"
        ? (col.data.category || "Sem localização")
        : (getKitCategory(col.data) || "Sem localização");
      if (cat !== currentCat) {
        currentCat = cat;
        tintIndex++;
      }
      tints.push(tintIndex % 2 === 0 ? "bg-muted/30" : "bg-transparent");
    });
    return tints;
  }, [matrixColumns, getKitCategory]);

  const filteredStores = useMemo(() => {
    return stores.filter((s) => {
      const q = storeSearch.toLowerCase();
      return !q || s.name.toLowerCase().includes(q) ||
        s.nickname?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.store_code?.toLowerCase().includes(q);
    });
  }, [stores, storeSearch]);

  const navigateMatrixCell = useCallback((dir: "up" | "down" | "left" | "right") => {
    if (!editingCell) return;
    const storeIdx = filteredStores.findIndex((s) => s.id === editingCell.storeId);
    const colIds = matrixColumns.map((c) => c.type === "piece" ? c.data.id : `kit-${c.data.id}`);
    const colIdx = colIds.indexOf(editingCell.pieceId);
    if (storeIdx === -1 || colIdx === -1) return;

    let newStoreIdx = storeIdx;
    let newColIdx = colIdx;
    if (dir === "up") newStoreIdx = Math.max(0, storeIdx - 1);
    else if (dir === "down") newStoreIdx = Math.min(filteredStores.length - 1, storeIdx + 1);
    else if (dir === "left") newColIdx = Math.max(0, colIdx - 1);
    else if (dir === "right") newColIdx = Math.min(colIds.length - 1, colIdx + 1);

    const newStore = filteredStores[newStoreIdx];
    const newPieceId = colIds[newColIdx];
    if (newStore && newPieceId) {
      setEditingCell({ storeId: newStore.id, pieceId: newPieceId });
    }
  }, [editingCell, filteredStores, matrixColumns]);

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
              <TabsList className="h-8 bg-muted/60">
                <TabsTrigger value="planilha" className="text-xs gap-1.5 h-6 px-2.5">
                  <Table2 className="w-3.5 h-3.5" />
                  {t("modules.matrix")}
                </TabsTrigger>
                <TabsTrigger value="dashboard" className="text-xs gap-1.5 h-6 px-2.5">
                  <BarChart3Icon className="w-3.5 h-3.5" />
                  Dashboard
                </TabsTrigger>
              </TabsList>
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
                        {!isViewingVigente && <Button size="sm" className="h-7 text-xs" onClick={() => setRateioSource(vigenteSource)}>← {t("common.backToVigente")}</Button>}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-7 text-xs">Ver rateios anteriores ▾</Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64">
                            {vigenteSource !== "original" && <DropdownMenuItem onClick={() => setRateioSource("original")}><div className="flex flex-col"><span className="text-xs font-medium">Rateio Original</span><span className="text-[10px] text-muted-foreground">Congelado · somente leitura</span></div></DropdownMenuItem>}
                            {vigenteSource !== "negotiation" && hasNegotiationRateio && winnerSupplierId && <DropdownMenuItem onClick={() => setRateioSource("negotiation")}><div className="flex flex-col"><span className="text-xs font-medium">Rateio da Negociação</span><span className="text-[10px] text-muted-foreground">{winnerSupplierName} · somente leitura</span></div></DropdownMenuItem>}
                            {vigenteSource !== "adjustment" && activeAdjustment && <DropdownMenuItem onClick={() => setRateioSource("adjustment")}><div className="flex flex-col"><span className="text-xs font-medium">Rateio do Ajuste</span><span className="text-[10px] text-muted-foreground">{activeAdjustment.name}</span></div></DropdownMenuItem>}
                            {isNegotiationView && (<><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setActiveSection("budgets")}><span className="text-xs">← Voltar à Negociação</span></DropdownMenuItem></>)}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {isNegotiationView && isViewingVigente && (
                          <>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button size="sm" variant="outline" className="h-7 text-xs">Restaurar original</Button></AlertDialogTrigger>
                              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Restaurar rateio da negociação?</AlertDialogTitle><AlertDialogDescription>Isso descarta as alterações feitas no rateio da negociação e copia novamente o rateio original congelado.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={handleResetNegotiationRateio || (() => {})}>Restaurar original</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                            </AlertDialog>
                            {hasAnyAdjustment ? <Button size="sm" variant="outline" disabled className="h-7 text-xs text-muted-foreground" title="Não é possível cancelar a negociação porque já existe um ajuste vinculado a ela. Exclua todos os ajustes antes.">Cancelar negociação</Button> : (
                              <AlertDialog>
                                <AlertDialogTrigger asChild><Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive">Cancelar negociação</Button></AlertDialogTrigger>
                                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Cancelar negociação?</AlertDialogTitle><AlertDialogDescription>Isso remove o rateio e os ajustes da negociação. O rateio original congelado permanece preservado.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={handleCancelNegotiationRateio || (() => {})}>Confirmar cancelamento</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                              </AlertDialog>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
               })()}

               <div className="border-b border-border bg-muted/30">
                  <div className="flex items-center justify-between px-3 py-1">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{matrixToolbarCollapsed ? t("common.filtersAndActionsHidden") : t("common.filtersAndActions")}</span>
                    <Button variant="ghost" size="sm" onClick={() => setMatrixToolbarCollapsed(!matrixToolbarCollapsed)} className="h-6 px-2 text-xs gap-1">
                      {matrixToolbarCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                      {matrixToolbarCollapsed ? t("common.expand") : t("common.collapse")}
                    </Button>
                  </div>
                  {!matrixToolbarCollapsed && (
                    <div className="px-3 pb-2 pt-1 flex flex-wrap items-center gap-2">
                       <div className="relative w-full sm:w-64">
                         <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                         <Input 
                            value={storeSearch} 
                            onChange={(e) => setStoreSearch(e.target.value)} 
                            placeholder="Buscar loja..." 
                            className="pl-8 h-8 text-xs"
                         />
                       </div>
                       <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={async () => {
                          const tId = "export-matrix-exceljs";
                          toast.loading("Gerando planilha Excel...", { id: tId });
                          try {
                            await exportMatrixExcelJS(
                              stores || [], pieces || [], qtyMap || {}, campaign?.name || "Campanha", kits || [], kitPieces || [], 
                              undefined, [], [], pieces || [], agency?.name, client?.name, []
                            );
                            toast.success("Planilha exportada com sucesso!", { id: tId });
                          } catch (e: any) { toast.error("Falha ao exportar: " + e.message, { id: tId }); }
                       }}>
                          <Download className="w-3.5 h-3.5" /> {t("common.exportExcel")}
                       </Button>
                    </div>
                  )}
               </div>

               <div className="flex-1 overflow-hidden">
                 <StoresMatrixTable 
                    stores={stores}
                    clientId={clientId}
                    customFieldLabels={customFieldLabels}
                    canEdit={canEditCampaignStores && isViewingVigente}
                    onUpdateStore={handleUpdateStorePiece}
                    storeSearch={storeSearch}
                    storeStateFilter="all"
                 />
               </div>
            </TabsContent>

            <TabsContent value="dashboard" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
              <MatrixDistributionDashboard 
                stores={stores}
                pieces={pieces}
                kits={kits}
                kitPieces={kitPieces}
                qtyMap={qtyMap}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
