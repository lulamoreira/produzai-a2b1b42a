import React, { useState, useMemo, useCallback, useRef, useEffect, memo, useDeferredValue } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { 
  Table2, BarChart3 as BarChart3Icon, ChevronDown, ChevronUp, 
  Search, Filter, Download, Sparkles, Copy, MoreHorizontal, Lock, CheckCircle2,
  Undo2, Redo2, Store as StoreIcon, MapPin, Tag, Layers, RefreshCw, X,
  ArrowUpDown, Check, Loader2, Upload, FileDown
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import MatrixFilterSidebar, { EMPTY_FILTERS, EMPTY_STORE_FILTERS, type PieceFilters, type StoreFilters, type FilterLogicMode } from "@/components/MatrixFilterSidebar";
import MatrixDistributionDashboard from "@/components/Matrix/MatrixDistributionDashboard";
import MatrixAutomationDialog from "@/components/MatrixAutomationDialog";
import CopyQuantitiesDialog from "@/components/Matrix/CopyQuantitiesDialog";
import { exportMatrixExcelJS } from "@/lib/exportMatrixExcelJS";
import { exportRateioGrid } from "@/lib/exportRateioGrid";
import { useUserRole } from "@/hooks/useUserRole";
import { getStateColor } from "@/lib/stateColors";
import { applyRateioBulk, type RateioUpsert } from "@/lib/applyRateioBulk";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { buildRateioPasteOperations, parseRateioClipboard, type RateioPasteChange } from "@/lib/rateioPaste";
import { exportRateioSpreadsheet, parseRateioSpreadsheet } from '@/lib/rateioSpreadsheet';
import { supabase } from "@/integrations/supabase/client";
import { useBudgetPhase } from "@/hooks/useBudgetPhase";

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
  hasCampaignNegRateio?: boolean;
  winnerSupplierId: string | null | undefined;
  negotiationSupplierId?: string | null | undefined;
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
  srcToAdjPieceId?: Map<string, string>;
  adjKitPieces?: any[];
  isLoadingQuantities?: boolean;
}

const RateioRow = memo(({ 
  store, 
  sIdx, 
  columns, 
  kits, 
  kitQtyMap, 
  storeQtyMap, 
  isEditingRow,
  editingCell, 
  anchorCell, 
  isTabEditable, 
  switchToCell, 
  inputRef, 
  editValue, 
  setEditValue,
  editValueRef,
  handlePieceBlur, 
  handleEditorKeyDown, 
  handleExcelPaste, 
  closeEditing 
}: any) => {
  return (
    <tr className="group even:bg-stone-100/80 odd:bg-white hover:bg-[#C2714F]/[0.08] transition-colors">
      <td 
        className="bg-white group-hover:bg-stone-50/50 border-r border-b border-stone-200 p-3 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]" 
        style={{ position: 'sticky', left: 0, zIndex: 20 }}
      >
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
      {columns.map((col: any, cIdx: number) => {
        const isKit = col._type === "kit";
        const val = isKit
          ? (kitQtyMap[`${store.id}-${col.id}`] || 0)
          : (storeQtyMap[col.id] || 0);
        const isEditing = editingCell?.storeId === store.id && editingCell?.pieceId === col.id;
        const isSelected = !isEditing && anchorCell?.rowIndex === sIdx && anchorCell?.colIndex === cIdx;

        return (
          <td 
            key={`${col._type}-${col.id}`} 
            className={cn(
              "border-r border-b border-stone-200 text-center transition-all relative",
              !isTabEditable ? "cursor-default" : "cursor-cell",
              isKit && "bg-[#C2714F]/[0.03]",
              val > 0 && !isKit && "bg-stone-50/30",
              isEditing && "ring-2 ring-inset ring-[#C2714F] z-10",
              isSelected && "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/50"
            )}
            onClick={() => {
              if (!isTabEditable) return;
              switchToCell(sIdx, cIdx);
            }}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                className="w-full h-full bg-transparent text-center text-xs font-bold focus:outline-none"
                value={editValue}
                onChange={(e) => {
                  editValueRef.current = e.target.value;
                  setEditValue(e.target.value);
                }}
                onBlur={handlePieceBlur}
                onKeyDown={(e) => handleEditorKeyDown(e, sIdx, cIdx)}
                 onPaste={(e) => {
                  const text = e.clipboardData.getData('text/plain');
                  if (text.includes('\t') || text.includes('\n')) {
                    e.preventDefault();
                    closeEditing(false);
                    handleExcelPaste(text, { rowIndex: sIdx, colIndex: cIdx });
                  }
                }}
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
  );
});

RateioRow.displayName = "RateioRow";

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
  hasCampaignNegRateio = false,
  winnerSupplierId,
  negotiationSupplierId,
  winnerSupplierName,
  rateioSource,
  setRateioSource,
  vigenteSource,
  isViewingVigente,
  handleResetNegotiationRateio,
  handleCancelNegotiationRateio,
  isNegotiationView,
  hasAnyAdjustment,
  setActiveSection,
  srcToAdjPieceId,
  adjKitPieces,
  isLoadingQuantities
}: RateioTabV2Props) {
  const { t } = useTranslation();
  const { isAdminOrMaster } = useUserRole();
  const queryClient = useQueryClient();
  const { currentPhase } = useBudgetPhase(campaignId);
  const [isCreatingNegCopy, setIsCreatingNegCopy] = useState(false);
  const effectiveNegSupplierId = negotiationSupplierId ?? winnerSupplierId ?? null;

  const showStartNegotiationCallout =
    rateioSource === "original" && !hasNegotiationRateio && !hasCampaignNegRateio;

  const handleCreateNegotiationCopy = useCallback(async () => {
    try {
      setIsCreatingNegCopy(true);
      const { error } = await supabase.rpc("create_negotiation_rateio_copy" as any, { p_campaign_id: campaignId });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["has_negotiation_rateio", campaignId] });
      await queryClient.invalidateQueries({ queryKey: ["has_campaign_neg_rateio", campaignId] });
      await queryClient.invalidateQueries({ queryKey: ["negotiation_store_pieces"] });
      await queryClient.invalidateQueries({ queryKey: ["campaign_negotiation_store_pieces", campaignId] });
      toast.success("Cópia para negociação criada");
      setRateioSource("negotiation");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar cópia");
    } finally {
      setIsCreatingNegCopy(false);
    }
  }, [campaignId, queryClient, setRateioSource]);

  // ─── Recotação por quantidade (campaign-level negotiation rateio) ───
  const [requoteDialogOpen, setRequoteDialogOpen] = useState(false);
  const [requoteSuppliers, setRequoteSuppliers] = useState<any[]>([]);
  const [requoteSelectedSupplier, setRequoteSelectedSupplier] = useState<string>("");
  const [requoteNotes, setRequoteNotes] = useState("");
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [generatedRequoteLink, setGeneratedRequoteLink] = useState<string | null>(null);
  const [existingPendingRequote, setExistingPendingRequote] = useState<any | null>(null);

  const refreshPendingRequote = useCallback(async () => {
    if (!campaignId) return;
    const { data } = await supabase
      .from("budget_qty_requotes" as any)
      .select("id, supplier_id, access_token, status, created_at")
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);
    setExistingPendingRequote((data && data[0]) || null);
  }, [campaignId]);

  useEffect(() => {
    if (rateioSource === "negotiation" && hasCampaignNegRateio) refreshPendingRequote();
  }, [rateioSource, hasCampaignNegRateio, refreshPendingRequote]);

  const openRequoteDialog = useCallback(async () => {
    setGeneratedRequoteLink(null);
    setRequoteSelectedSupplier("");
    setRequoteNotes("");
    const { data } = await supabase
      .from("budget_suppliers")
      .select("id, company_name")
      .eq("campaign_id", campaignId)
      .eq("status", "enviado");
    setRequoteSuppliers(data || []);
    setRequoteDialogOpen(true);
  }, [campaignId]);

  const handleSwapSupplier = useCallback(async () => {
    if (!existingPendingRequote) return;
    const { error } = await supabase
      .from("budget_qty_requotes" as any)
      .update({ status: "rejected" } as any)
      .eq("id", existingPendingRequote.id);
    if (error) { toast.error(error.message); return; }
    setExistingPendingRequote(null);
    await openRequoteDialog();
  }, [existingPendingRequote, openRequoteDialog]);

  const handleGenerateRequoteLink = useCallback(async () => {
    if (!requoteSelectedSupplier) { toast.error("Selecione um fornecedor"); return; }
    try {
      setIsGeneratingLink(true);
      const { supabasePaginate } = await import("@/lib/supabasePaginate");
      const negRows = await supabasePaginate<any>((from, to) =>
        (supabase as any)
          .from("budget_negotiation_store_pieces")
          .select("store_id, piece_id, quantity, original_quantity", { count: "exact" })
          .eq("campaign_id", campaignId)
          .is("supplier_id", null)
          .order("id")
          .range(from, to)
      );
      const origByPiece = new Map<string, number>();
      const negByPiece = new Map<string, number>();
      for (const r of negRows) {
        const pid = r.piece_id as string;
        origByPiece.set(pid, (origByPiece.get(pid) ?? 0) + (Number(r.original_quantity) || 0));
        negByPiece.set(pid,  (negByPiece.get(pid)  ?? 0) + (Number(r.quantity)          || 0));
      }
      const allPieceIds = new Set<string>([...origByPiece.keys(), ...negByPiece.keys()]);
      const qty_changes: Record<string, { old_qty: number; new_qty: number }> = {};
      for (const pieceId of allPieceIds) {
        const oldQ = origByPiece.get(pieceId) ?? 0;
        const newQ = negByPiece.get(pieceId) ?? 0;
        if (oldQ !== newQ) qty_changes[pieceId] = { old_qty: oldQ, new_qty: newQ };
      }
      const { data: rpcResult, error } = await supabase.rpc(
        "create_budget_qty_requote" as any,
        {
          p_campaign_id: campaignId,
          p_supplier_id: requoteSelectedSupplier,
          p_qty_changes: qty_changes,
          p_notes: requoteNotes || null,
        } as any
      );
      if (error) throw error;
      if ((rpcResult as any)?.error) throw new Error((rpcResult as any).error);
      const link = `${window.location.origin}/recotacao-qtd/${(rpcResult as any).access_token}`;
      setGeneratedRequoteLink(link);
      await refreshPendingRequote();
      toast.success("Link de recotação gerado");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao gerar link");
    } finally {
      setIsGeneratingLink(false);
    }
  }, [campaignId, requoteSelectedSupplier, requoteNotes, refreshPendingRequote]);

  
  
  const [rateioView, setRateioView] = useState("planilha");
  const [filterSidebarCollapsed, setFilterSidebarCollapsed] = useState(true);
  
  // Excel Paste state
  const [anchorCell, setAnchorCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [storeSearch, setStoreSearch] = useState("");
  const deferredStoreSearch = useDeferredValue(storeSearch);
  const [pieceFilters, setPieceFilters] = useState<PieceFilters>({ ...EMPTY_FILTERS });
  const [storeFilters, setStoreFilters] = useState<StoreFilters>({ ...EMPTY_STORE_FILTERS });
  const [filterLogicMode, setFilterLogicMode] = useState<FilterLogicMode>("and");
  
  const [isAutomationOpen, setIsAutomationOpen] = useState(false);
  const [isExecutingAutomation, setIsExecutingAutomation] = useState(false);
  const [copyQtyOpen, setCopyQtyOpen] = useState(false);
  
  // Excel Paste Modal state
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isApplyingPaste, setIsApplyingPaste] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<RateioPasteChange[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Undo/Redo history
  const [history, setHistory] = useState<{ storeId: string; pieceId: string; oldVal: number; newVal: number }[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);


  const scrollToFirst = () => {
    gridContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToLast = () => {
    const container = gridContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  };

  const versionTabs = useMemo(() => {
    const tabs: { id: string; label: string; isVigente?: boolean; type?: string; parent?: string }[] = [{ id: "original", label: "Rateio Original", type: "original" }];
    
    if (hasCampaignNegRateio) {
      tabs.push({
        id: "negotiation",
        label: "Rateio de Negociação",
        type: "negotiation"
      });
    } else if (hasNegotiationRateio && effectiveNegSupplierId) {
      tabs.push({
        id: "negotiation",
        label: `Negociação · ${winnerSupplierName}`,
        type: "negotiation"
      });
    }
    
    if (activeAdjustment) {
      tabs.push({ 
        id: "adjustment", 
        label: `Ajuste · ${activeAdjustment.name}`,
        type: "adjustment",
        parent: hasNegotiationRateio ? "Negociação" : "Original"
      });
    }

    const lastTab = tabs[tabs.length - 1];
    if (lastTab) lastTab.isVigente = true;

    return tabs;
  }, [hasNegotiationRateio, effectiveNegSupplierId, winnerSupplierName, activeAdjustment, hasCampaignNegRateio]);

  const activeTabData = versionTabs.find(t => t.id === rateioSource) || versionTabs.find(t => t.id === vigenteSource) || versionTabs[0];
  const activeVersionTab = activeTabData?.id || vigenteSource;
  const isTabEditable = activeTabData?.isVigente && activeVersionTab === vigenteSource;
  const isLatestTab = isTabEditable;

  
  // Custom field labels for automation
  const customFieldLabels = useMemo(() => {
    return Array.from({ length: 15 }, (_, idx) => {
      const i = idx + 1;
      const label = (client as any)?.[`custom_field_${i}_label`];
      return label ? { index: i, label, key: `custom_field_${i}` } : null;
    }).filter((x): x is { index: number; label: string; key: string } => x !== null);
  }, [client]);

  // Sorting state - "state" or null (default alpha)
  const [sortConfig, setSortConfig] = useState<{ key: "state"; direction: "asc" | "desc" } | null>(null);

  // Persisted sort field per campaign
  const sortStorageKey = `rateio_sort_field_${campaignId}`;
  const [storeSortField, setStoreSortField] = useState<string>(() => {
    try {
      return localStorage.getItem(sortStorageKey) || "name";
    } catch { return "name"; }
  });

  const sortFieldOptions = useMemo(() => {
    const base = [
      { value: "name", label: t("stores.name", "Nome") },
      { value: "city", label: t("stores.city", "Cidade") },
      { value: "state", label: t("stores.state", "Estado") },
      { value: "store_model", label: t("filters.storeCategory", "Categoria de Loja") },
    ];
    customFieldLabels.forEach((cf) => {
      base.push({ value: `custom_field_${cf.index}`, label: cf.label });
    });
    return base;
  }, [customFieldLabels, t]);

  const currentSortLabel = sortFieldOptions.find(o => o.value === storeSortField)?.label || storeSortField;

  const handleSortFieldChange = (field: string) => {
    setStoreSortField(field);
    try { localStorage.setItem(sortStorageKey, field); } catch {}
  };

  const toggleSort = (key: "state") => {
    setSortConfig(prev => {
      if (!prev) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  // Filter stores
  const filteredStores = useMemo(() => {
    const storeMatchesFilters = (s: any): boolean => {
      const checks: boolean[] = [];
      if (storeFilters.city.size > 0) checks.push(storeFilters.city.has(s.city));
      if (storeFilters.state.size > 0) checks.push(storeFilters.state.has(s.state?.trim()));
      if (storeFilters.store_model.size > 0) checks.push(storeFilters.store_model.has(s.store_model));
      for (let i = 1; i <= 15; i++) {
        const key = `custom_field_${i}` as keyof typeof storeFilters;
        const set = storeFilters[key] as Set<string> | undefined;
        if (set && set.size > 0) checks.push(!!((s as any)[key]) && set.has((s as any)[key]));
      }
      return checks.length === 0 || checks.some(Boolean);
    };

    const storeMatchesAllFilters = (s: any): boolean => {
      if (storeFilters.city.size > 0 && !storeFilters.city.has(s.city)) return false;
      if (storeFilters.state.size > 0 && !storeFilters.state.has(s.state?.trim())) return false;
      if (storeFilters.store_model.size > 0 && !storeFilters.store_model.has(s.store_model)) return false;
      for (let i = 1; i <= 15; i++) {
        const key = `custom_field_${i}` as keyof typeof storeFilters;
        const set = storeFilters[key] as Set<string> | undefined;
        if (set && set.size > 0 && (!((s as any)[key]) || !set.has((s as any)[key]))) return false;
      }
      return true;
    };

    let result = stores.filter(s => {
      const q = deferredStoreSearch.toLowerCase().trim();
      const matchesSearch = !q || Object.values(s).some(val => 
        (typeof val === 'string' || typeof val === 'number') && 
        val.toString().toLowerCase().includes(q)
      );
      
      if (filterLogicMode === "and") {
        if (!storeMatchesAllFilters(s)) return false;
      } else if (filterLogicMode === "or") {
        const hasAnyActiveFilter =
          storeFilters.city.size > 0 || storeFilters.state.size > 0 || storeFilters.store_model.size > 0 ||
          Array.from({ length: 15 }, (_, i) => storeFilters[`custom_field_${i + 1}` as keyof typeof storeFilters] as Set<string>).some(s => s?.size > 0);
        if (hasAnyActiveFilter && !storeMatchesFilters(s)) return false;
      } else if (filterLogicMode === "and_or") {
        if (!storeMatchesAllFilters(s)) return false;
      } else if (filterLogicMode === "not") {
        if (storeMatchesFilters(s)) return false;
      }

      return matchesSearch;
    });

    // Apply sorting: legacy state toggle takes priority, otherwise persisted field
    result = [...result].sort((a, b) => {
      if (sortConfig?.key === "state") {
        const stateA = (a.state || "").toString().trim().toLowerCase();
        const stateB = (b.state || "").toString().trim().toLowerCase();
        if (stateA !== stateB) {
          return sortConfig.direction === "asc" 
            ? stateA.localeCompare(stateB, undefined, { numeric: true, sensitivity: 'base' })
            : stateB.localeCompare(stateA, undefined, { numeric: true, sensitivity: 'base' });
        }
        const nameA = (a.name || "").toString().trim().toLowerCase();
        const nameB = (b.name || "").toString().trim().toLowerCase();
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
      }

      const valA = ((a as any)[storeSortField] ?? "").toString().trim().toLowerCase();
      const valB = ((b as any)[storeSortField] ?? "").toString().trim().toLowerCase();
      const cmp = valA.localeCompare(valB, 'pt-BR', { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      // Tiebreaker: name asc
      const nameA = (a.name || "").toString().trim().toLowerCase();
      const nameB = (b.name || "").toString().trim().toLowerCase();
      return nameA.localeCompare(nameB, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });

    return result;
  }, [stores, deferredStoreSearch, storeFilters, sortConfig, storeSortField, filterLogicMode]);

  const rowVirtualizer = useVirtualizer({
    count: filteredStores.length,
    getScrollElement: () => gridContainerRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollTop(scrollTop > 200);
      // Show bottom button if we are not at the very end (with some buffer)
      setShowScrollBottom(scrollTop + clientHeight < scrollHeight - 100);
    };

    container.addEventListener("scroll", handleScroll);
    // Initial check
    handleScroll();
    
    // Also check when data changes
    const observer = new ResizeObserver(handleScroll);
    observer.observe(container);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [filteredStores]);

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
        if (pieceFilters.store_category.size > 0 && !pieceFilters.store_category.has((p.store_category || "").toUpperCase())) return false;
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

  const filteredPieces = useMemo(() => 
    columns.filter(c => c._type === "piece").map(c => c.raw),
    [columns]
  );

  const filteredKits = useMemo(() => 
    columns.filter(c => c._type === "kit").map(c => c.raw),
    [columns]
  );


  const [localQtyOverrides, setLocalQtyOverrides] = useState<Record<string, number>>({});

  useEffect(() => {
    setLocalQtyOverrides({});
  }, [campaignId, rateioSource, activeAdjustment?.id, effectiveNegSupplierId]);

  const visibleQtyMap = useMemo(() => {
    return { ...qtyMap, ...localQtyOverrides };
  }, [qtyMap, localQtyOverrides]);

  // Cleanup overrides that have been confirmed by the server
  useEffect(() => {
    setLocalQtyOverrides(prev => {
      let changed = false;
      const next = { ...prev };
      for (const key in next) {
        if (qtyMap[key] === next[key]) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [qtyMap]);

  // Grouped quantities per store for performance.
  // NOTE: keys are `${storeUuid}-${pieceUuid}` and UUIDs themselves contain
  // hyphens, so `key.split('-')` is unsafe. UUIDs are always 36 chars, so
  // the storeId is key[0..36) and the pieceId is key[37..).
  const storeQtyMaps = useMemo(() => {
    const maps: Record<string, Record<string, number>> = {};
    for (const s of stores) {
      maps[s.id] = {};
    }
    for (const key in visibleQtyMap) {
      const sId = key.slice(0, 36);
      const pId = key.slice(37);
      if (maps[sId]) {
        maps[sId][pId] = visibleQtyMap[key];
      }
    }
    return maps;
  }, [stores, visibleQtyMap]);

  const activeKitPieces = useMemo(() => {
    if (rateioSource === 'adjustment' && adjKitPieces && adjKitPieces.length > 0) {
      return adjKitPieces;
    }
    return kitPieces;
  }, [rateioSource, adjKitPieces, kitPieces]);

  // Pre-compute kit quantity per store from components (read-only display)
  const kitQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (!kits?.length || !activeKitPieces?.length) return map;

    const kitPiecesByKit = (activeKitPieces || []).reduce((acc: Record<string, any[]>, kp: any) => {
      if (!acc[kp.kit_id]) acc[kp.kit_id] = [];
      acc[kp.kit_id].push(kp);
      return acc;
    }, {});
    // Use all stores (not filteredStores) so that the store search filter
    // does not invalidate kit quantities — only columnTotals needs filtering.
    for (const kit of kits) {
      const kpList = kitPiecesByKit[kit.id];
      if (!kpList || kpList.length === 0) continue;
      for (const s of stores) {
        let minQty = Infinity;
        for (const kp of kpList) {
          const baseQty = visibleQtyMap[`${s.id}-${kp.piece_id}`] || 0;
          const kitCompQty = Math.floor(baseQty / (kp.quantity || 1));
          if (kitCompQty < minQty) minQty = kitCompQty;
        }
        map[`${s.id}-${kit.id}`] = minQty === Infinity ? 0 : minQty;
      }
    }
    return map;
  }, [kits, activeKitPieces, stores, visibleQtyMap]);

  // Compute column totals in a more optimized way
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    if (!columns.length || !filteredStores.length) return totals;

    // Initialize totals
    columns.forEach(col => {
      totals[`${col._type}-${col.id}`] = 0;
    });

    // Single pass over stores and columns
    for (const store of filteredStores) {
      for (const col of columns) {
        const key = `${col._type}-${col.id}`;
        if (col._type === "kit") {
          totals[key] += kitQtyMap[`${store.id}-${col.id}`] || 0;
        } else {
          totals[key] += visibleQtyMap[`${store.id}-${col.id}`] || 0;
        }
      }
    }
    return totals;
  }, [columns, filteredStores, visibleQtyMap, kitQtyMap]);

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

  // Sub-grouping by the actual piece category (PAREDE PRIMÁRIA, PICK&MIX, QUIOSQUE, ...)
  const categoryGroups = useMemo(() => {
    const groups: { label: string; items: ColumnItem[] }[] = [];
    columns.forEach((c) => {
      const raw = (c.category || "").toString().trim();
      const label = !raw || raw.toUpperCase() === "TODAS" ? "" : raw.toUpperCase();
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
  const editingCellRef = useRef<{ storeId: string; pieceId: string } | null>(null);
  const editValueRef = useRef("");
  const skipBlurSaveRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getVisibleCellQty = useCallback((storeId: string, pieceId: string) => {
    const isKit = kits?.some((k: any) => k.id === pieceId);
    return isKit ? (kitQtyMap[`${storeId}-${pieceId}`] || 0) : (visibleQtyMap[`${storeId}-${pieceId}`] || 0);
  }, [kits, kitQtyMap, visibleQtyMap]);

  useEffect(() => {
    if (!editingCell) return;
    const rafId = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(rafId);
  }, [editingCell]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const applyWithHistory = async (
    upserts: RateioUpsert[],
    deletes: { campaignId: string; storeId: string; pieceId: string }[],
    label?: string
  ) => {
    const changes: { storeId: string; pieceId: string; oldVal: number; newVal: number }[] = [];
    
    upserts.forEach(u => {
      const oldVal = visibleQtyMap[`${u.storeId}-${u.pieceId}`] || 0;
      if (oldVal !== u.quantity) {
        changes.push({ storeId: u.storeId, pieceId: u.pieceId, oldVal, newVal: u.quantity });
      }
    });

    deletes.forEach(d => {
      const oldVal = visibleQtyMap[`${d.storeId}-${d.pieceId}`] || 0;
      if (oldVal !== 0) {
        changes.push({ storeId: d.storeId, pieceId: d.pieceId, oldVal, newVal: 0 });
      }
    });

    if (changes.length === 0) return;

    setLocalQtyOverrides(prev => {
      const next = { ...prev };
      upserts.forEach(u => {
        next[`${u.storeId}-${u.pieceId}`] = u.quantity;
      });
      deletes.forEach(d => {
        next[`${d.storeId}-${d.pieceId}`] = 0;
      });
      return next;
    });

    try {
      await applyRateioBulk(upserts, deletes, {
        isNegotiationView: rateioSource === 'negotiation',
        negotiationSupplierId: effectiveNegSupplierId,
        isCampaignNegView: hasCampaignNegRateio,
        isAdjustmentView: rateioSource === 'adjustment',
        adjustmentId: activeAdjustment?.id,
        srcToAdjPieceId
      });

      const newHistory = [...history.slice(0, historyIndex + 1), changes].slice(-20);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      queryClient.invalidateQueries({ queryKey: ["campaign_store_pieces"] });
      queryClient.invalidateQueries({ queryKey: ["budget_negotiation_store_pieces"] });
      queryClient.invalidateQueries({ queryKey: ["adjustment_rateio_qty_map"] });
      if (label) toast.success(label);
    } catch (err) {
      console.error("Erro detalhado (applyWithHistory):", err);
      toast.error("Erro ao aplicar alterações");
      throw err;
    }
  };

  const handleUndo = async () => {
    if (historyIndex < 0) return;
    const entry = history[historyIndex];
    const upserts: RateioUpsert[] = entry.map(e => ({
      campaignId,
      storeId: e.storeId,
      pieceId: e.pieceId,
      quantity: e.oldVal
    })).filter(u => u.quantity > 0);
    
    const deletes = entry
      .filter(e => e.oldVal === 0)
      .map(e => ({ campaignId, storeId: e.storeId, pieceId: e.pieceId }));

    try {
      await applyRateioBulk(upserts, deletes, {
        isNegotiationView: rateioSource === 'negotiation',
        negotiationSupplierId: effectiveNegSupplierId,
        isCampaignNegView: hasCampaignNegRateio,
        isAdjustmentView: rateioSource === 'adjustment',
        adjustmentId: activeAdjustment?.id,
        srcToAdjPieceId
      });
      setHistoryIndex(historyIndex - 1);
      queryClient.invalidateQueries({ queryKey: ["campaign_store_pieces"] });
      queryClient.invalidateQueries({ queryKey: ["budget_negotiation_store_pieces"] });
      queryClient.invalidateQueries({ queryKey: ["adjustment_rateio_qty_map"] });
      toast.success("Desfeito");
    } catch (err) {
      toast.error("Erro ao desfazer");
    }
  };

  const handleRedo = async () => {
    if (historyIndex >= history.length - 1) return;
    const entry = history[historyIndex + 1];
    const upserts: RateioUpsert[] = entry.map(e => ({
      campaignId,
      storeId: e.storeId,
      pieceId: e.pieceId,
      quantity: e.newVal
    })).filter(u => u.quantity > 0);
    
    const deletes = entry
      .filter(e => e.newVal === 0)
      .map(e => ({ campaignId, storeId: e.storeId, pieceId: e.pieceId }));

    try {
      await applyRateioBulk(upserts, deletes, {
        isNegotiationView: rateioSource === 'negotiation',
        negotiationSupplierId: effectiveNegSupplierId,
        isCampaignNegView: hasCampaignNegRateio,
        isAdjustmentView: rateioSource === 'adjustment',
        adjustmentId: activeAdjustment?.id,
        srcToAdjPieceId
      });
      setHistoryIndex(historyIndex + 1);
      queryClient.invalidateQueries({ queryKey: ["campaign_store_pieces"] });
      queryClient.invalidateQueries({ queryKey: ["budget_negotiation_store_pieces"] });
      queryClient.invalidateQueries({ queryKey: ["adjustment_rateio_qty_map"] });
      toast.success("Refeito");
    } catch (err) {
      toast.error("Erro ao refazer");
    }
  };

  const saveCell = (cell: { storeId: string; pieceId: string }, rawValue: string) => {
    const qty = Math.max(0, parseInt(rawValue, 10) || 0);
    const isKit = kits?.some((k: any) => k.id === cell.pieceId);
    
    // Optimistic update - do it synchronously
    setLocalQtyOverrides(prev => {
      const next = { ...prev };
      if (isKit) {
        const kpList = (activeKitPieces || []).filter((kp: any) => kp.kit_id === cell.pieceId);
        kpList.forEach(kp => {
          const key = `${cell.storeId}-${kp.piece_id}`;
          const val = qty * (kp.quantity || 1);
          next[key] = val;
        });
      } else {
        const key = `${cell.storeId}-${cell.pieceId}`;
        next[key] = qty;
      }
      return next;
    });

    if (isKit) {
      const kpList = (activeKitPieces || []).filter((kp: any) => kp.kit_id === cell.pieceId);
      if (kpList.length === 0) return;

      const targets = kpList.map((kp: any) => ({
        campaignId,
        storeId: cell.storeId,
        pieceId: kp.piece_id,
        quantity: qty * (kp.quantity || 1)
      }));
      const upserts = targets.filter((t) => t.quantity > 0);
      const deletes = targets
        .filter((t) => t.quantity <= 0)
        .map((t) => ({ campaignId, storeId: t.storeId, pieceId: t.pieceId }));
      void applyWithHistory(upserts, deletes);
      return;
    }

    if (qty > 0) {
      void applyWithHistory([{ campaignId, storeId: cell.storeId, pieceId: cell.pieceId, quantity: qty }], []);
    } else {
      void applyWithHistory([], [{ campaignId, storeId: cell.storeId, pieceId: cell.pieceId }]);
    }
  };

  const switchToCell = (rowIndex: number, colIndex: number) => {
    if (!canEditCampaignStores || !isTabEditable) return;
    const store = filteredStores[rowIndex];
    const col = columns[colIndex];
    if (!store || !col) return;

    const current = editingCellRef.current;
    if (current && (current.storeId !== store.id || current.pieceId !== col.id)) {
      saveCell(current, editValueRef.current ?? "");
    }

    const targetValue = getVisibleCellQty(store.id, col.id);
    const nextValue = targetValue > 0 ? String(targetValue) : "";
    
    editingCellRef.current = { storeId: store.id, pieceId: col.id };
    editValueRef.current = nextValue;
    setEditingCell({ storeId: store.id, pieceId: col.id });
    setEditValue(nextValue);
    setAnchorCell({ rowIndex, colIndex });
  };

  const closeEditing = (save = true) => {
    const current = editingCellRef.current;
    if (current && save) {
      saveCell(current, editValueRef.current ?? "");
    }
    editingCellRef.current = null;
    editValueRef.current = "";
    setEditingCell(null);
    setEditValue("");
  };

  const handlePieceBlur = () => {
    if (skipBlurSaveRef.current) {
      skipBlurSaveRef.current = false;
      return;
    }
    closeEditing(true);
  };

  const navigateFromCell = (rowIndex: number, colIndex: number, dRow: number, dCol: number) => {
    const nextRow = Math.max(0, Math.min(filteredStores.length - 1, rowIndex + dRow));
    const nextCol = Math.max(0, Math.min(columns.length - 1, colIndex + dCol));
    switchToCell(nextRow, nextCol);
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      navigateFromCell(rowIndex, colIndex, 1, 0);
    } else if (e.key === "Tab") {
      e.preventDefault();
      navigateFromCell(rowIndex, colIndex, 0, e.shiftKey ? -1 : 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      navigateFromCell(rowIndex, colIndex, -1, 0);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      navigateFromCell(rowIndex, colIndex, 1, 0);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      navigateFromCell(rowIndex, colIndex, 0, -1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      navigateFromCell(rowIndex, colIndex, 0, 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeEditing(false);
    }
  };

  const confirmPaste = async () => {
    // Map garante que cada (storeId, pieceId) só aparece UMA VEZ.
    // Processamos peças diretas primeiro, kits depois —
    // assim o valor do kit (191) sobrescreve o da peça direta (ex: 39 ou 128).
    const allUpsertsMap = new Map<string, RateioUpsert>();

    const setUpsert = (storeId: string, pieceId: string, quantity: number) => {
      allUpsertsMap.set(`${storeId}|${pieceId}`, {
        campaignId,
        storeId,
        pieceId,
        quantity,
      });
    };

    // 1ª passagem: peças diretas
    pendingChanges
      .filter(c => !c.isIgnored && c.itemType === 'piece')
      .forEach(c => setUpsert(c.storeId, c.pieceId, Math.round(c.newValue)));

    // 2ª passagem: kits — decompõe em peças componentes e SOBRESCREVE se houver conflito
    pendingChanges
      .filter(c => !c.isIgnored && c.itemType === 'kit')
      .forEach(c => {
        const val = Math.round(c.newValue);
        const kpList = (activeKitPieces || []).filter((kp: any) => kp.kit_id === c.pieceId);
        kpList.forEach((kp: any) => {
          setUpsert(c.storeId, kp.piece_id, val * (kp.quantity || 1));
        });
      });

    const allUpserts = Array.from(allUpsertsMap.values());

    if (allUpserts.length === 0) {
      setIsPasteModalOpen(false);
      return;
    }

    setIsApplyingPaste(true);
    try {
      await applyWithHistory(allUpserts, [], `${allUpserts.length} células atualizadas com sucesso`);
      setIsPasteModalOpen(false);
      setAnchorCell(null);
    } catch (err) {
      console.error("Erro detalhado (confirmPaste):", err);
      toast.error("Erro ao aplicar colagem do Excel");
    } finally {
      setIsApplyingPaste(false);
    }
  };

  const applyPasteChanges = async (changes: RateioPasteChange[]) => {
    setPendingChanges(changes);
    setIsPasteModalOpen(true);
  };

  const handleExcelPaste = useCallback((text: string, anchor: { rowIndex: number; colIndex: number }) => {
    const parsedData = parseRateioClipboard(text);
    const changes: RateioPasteChange[] = [];

    const rowCount = parsedData.length;
    const colCount = rowCount > 0 ? Math.max(...parsedData.map(r => r.length)) : 0;

    for (let rowOffset = 0; rowOffset < rowCount; rowOffset++) {
      const storeIdx = anchor.rowIndex + rowOffset;
      if (storeIdx >= filteredStores.length) break;
      
      const store = filteredStores[storeIdx];
      const rowData = parsedData[rowOffset];
      
      for (let colOffset = 0; colOffset < colCount; colOffset++) {
        const colIdx = anchor.colIndex + colOffset;
        if (colIdx >= columns.length) break;
        
        const val = rowData[colOffset];
        if (val === undefined) continue;

        const col = columns[colIdx];
        const isKit = col._type === 'kit';
        if (!isKit && (col as any).kit_only === true) continue;
        
        const oldValue = isKit 
          ? (kitQtyMap[`${store.id}-${col.id}`] || 0)
          : (visibleQtyMap[`${store.id}-${col.id}`] || 0);
        
        changes.push({
          storeId: store.id,
          pieceId: col.id,
          oldValue,
          newValue: val ?? 0,
          storeName: store.name,
          pieceName: col.name,
          isIgnored: val === null,
          itemType: col._type as 'piece' | 'kit'
        });
      }
    }

    if (changes.length > 0) {
      applyPasteChanges(changes);
    }
  }, [filteredStores, columns, visibleQtyMap, kitQtyMap, activeKitPieces, campaignId, rateioSource, effectiveNegSupplierId, activeAdjustment, queryClient]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!anchorCell || editingCell || !isTabEditable) return;
      
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') || '';
      handleExcelPaste(text, anchorCell);
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAnchorCell(null);
      }
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [anchorCell, editingCell, isTabEditable, handleExcelPaste]);

  const handleAutomationComplete = () => {
    setIsAutomationOpen(false);
    // You might want to refresh data here, but react-query usually handles it via mutations
  };

  const handleExport = async () => {
    setIsExporting(true);
    const toastId = toast.loading('Exportando modelo...');
    try {
      await exportRateioSpreadsheet({
        stores: filteredStores,
        columns,
        qtyMap: visibleQtyMap,
        kitQtyMap,
        campaignName: campaign?.name ?? 'campanha',
      });
      toast.success('Modelo exportado com sucesso', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao exportar modelo', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsImporting(true);
    try {
      const validStoreIds  = new Set(stores.map((s: any) => s.id));
      const validPieceIds  = new Set(pieces.map((p: any) => p.id));
      const validKitIds    = new Set((kits || []).map((k: any) => k.id));

      const upserts = await parseRateioSpreadsheet({
        file,
        campaignId,
        validStoreIds,
        validPieceIds,
        validKitIds,
        activeKitPieces: activeKitPieces || [],
      });

      await applyWithHistory(upserts, [], `${upserts.length} células importadas com sucesso`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? 'Erro ao importar planilha');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Top Navigation for Spreadsheet/Dashboard */}
      <div className="flex items-center justify-between px-6 py-1 border-b border-stone-200">
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

        <div className="flex items-center gap-2">
          {rateioSource === "negotiation" && hasCampaignNegRateio && (
            <>
              {existingPendingRequote ? (
                <>
                  <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 border-amber-200">
                    Recotação em aberto
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSwapSupplier}
                    className="text-xs gap-2 h-8"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    TROCAR FORNECEDOR
                  </Button>
                </>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={openRequoteDialog}
                  className="text-xs gap-2 h-8"
                >
                  <Upload className="w-3.5 h-3.5" />
                  ENVIAR RECOTAÇÃO
                </Button>
              )}
            </>
          )}

          {currentPhase === "negociacao" && !hasNegotiationRateio && isViewingVigente && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateNegotiationCopy}
              disabled={isCreatingNegCopy}
              className="text-xs gap-2 h-8"
            >
              <Layers className="w-3.5 h-3.5" />
              {isCreatingNegCopy ? "Criando..." : "Criar cópia para negociação"}
            </Button>
          )}
          {isAdminOrMaster && hasNegotiationRateio && (
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
      </div>


      <div className="flex flex-1 relative min-h-0 overflow-hidden">
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
          customFieldLabels={customFieldLabels.map((cf) => ({ key: `custom_field_${cf.index}` as any, label: cf.label }))}
        />

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {rateioView === "planilha" ? (
            <div className="flex flex-col h-full min-h-0 overflow-hidden">

              {/* Excel-like Version Tabs */}
              <div className="bg-white border-b border-stone-200 px-4 pt-1.5 flex items-end gap-1 overflow-x-auto no-scrollbar">
                {versionTabs.map((tab) => {
                  const isActive = activeVersionTab === tab.id;
                  const isCurrentVigente = tab.isVigente;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setRateioSource(tab.id as "original" | "negotiation" | "adjustment")}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-t-lg transition-all whitespace-nowrap",
                        isActive 
                          ? "bg-white border border-stone-200 border-b-white text-stone-900 -mb-px z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]" 
                          : "bg-stone-50 text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                      )}
                    >
                      {tab.label}
                      {isCurrentVigente ? (
                        <span className="bg-[#C2714F] text-white text-[10px] font-bold rounded-full px-2 py-0.5 ml-2">
                          ATIVO
                        </span>
                      ) : (
                        <Lock className="w-3 h-3 text-stone-400 ml-1" />
                      )}
                    </button>
                  );
                })}
              </div>


              {showStartNegotiationCallout && (
                <div className="mx-6 my-2 border border-amber-200 bg-amber-50/60 rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-stone-900">Iniciar Rateio de Negociação</div>
                    <div className="text-xs text-stone-600 mt-0.5">Crie uma cópia editável do rateio para trabalhar durante a negociação. O rateio original não será alterado.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleCreateNegotiationCopy}
                      disabled={isCreatingNegCopy}
                      className="h-9 text-xs"
                    >
                      {isCreatingNegCopy ? "Criando..." : "CRIAR CÓPIA"}
                    </Button>
                  </div>
                </div>
              )}


              {/* Rateio Header Banner */}
              <div className={cn(
                "px-6 py-1.5 border-b flex flex-col md:flex-row md:items-center justify-between gap-2",
                isTabEditable 
                  ? "bg-emerald-50/60 border-emerald-100" 
                  : "bg-amber-50/50 border-amber-100"
              )}>
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "mt-1.5 inline-block h-2 w-2 rounded-full shrink-0",
                    isTabEditable ? "bg-emerald-500" : "bg-amber-500"
                  )} />
                  <div>
                    <div className="text-sm font-medium text-stone-900 leading-none">
                      {isTabEditable ? (
                        <>Rateio vigente: <span className="font-bold">{activeTabData?.label}</span></>
                      ) : (
                        <>{t("rateio.readOnlyBanner")} <span className="font-bold">{activeTabData?.label}</span></>
                      )}
                    </div>
                    {isTabEditable && activeTabData?.type === "adjustment" && (
                      <div className="text-[11px] text-stone-500 mt-1.5">
                        Sincronizado com: <span className="font-bold">{activeTabData.parent}</span> · Edições aqui valem para o ajuste; o rateio original e o da negociação ficam preservados.
                      </div>
                    )}
                  </div>
                </div>


                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {isTabEditable && (
                    <>
                      <div className="flex items-center bg-stone-100 rounded-lg p-0.5">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn("h-8 w-8", historyIndex < 0 ? "text-stone-300" : "text-stone-600 hover:text-stone-900")}
                          onClick={handleUndo}
                          disabled={historyIndex < 0}
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn("h-8 w-8", historyIndex >= history.length - 1 ? "text-stone-300" : "text-stone-600 hover:text-stone-900")}
                          onClick={handleRedo}
                          disabled={historyIndex >= history.length - 1}
                        >
                          <Redo2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs gap-2 rounded-lg border-stone-200 shadow-sm hover:bg-stone-50"
                        onClick={() => setIsAutomationOpen(true)}
                        disabled={isExecutingAutomation}
                      >
                        {isExecutingAutomation ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-[#C2714F]" />
                        )}
                        {t("rateio.matrixAutomation", "AUTOMAÇÃO DE MATRIZ")}
                      </Button>

                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs gap-2 rounded-lg border-stone-200 shadow-sm hover:bg-stone-50"
                        onClick={() => setCopyQtyOpen(true)}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {t("rateio.copyQuantities", "COPIAR QUANTIDADES")}
                      </Button>
                    </>
                  )}

                  {/* Input oculto para upload */}
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={handleImportFile}
                  />

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 rounded-lg border-stone-200 shadow-sm hover:bg-stone-50"
                    onClick={handleExport}
                    disabled={isExporting}
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    {isExporting ? 'Exportando...' : 'Exportar Modelo'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 rounded-lg border-stone-200 shadow-sm hover:bg-stone-50"
                    onClick={() => importInputRef.current?.click()}
                    disabled={isImporting || !isTabEditable}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {isImporting ? 'Importando...' : 'Importar Planilha'}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-2 rounded-lg border-stone-200 shadow-sm">
                        <Download className="w-3.5 h-3.5" />
                        {t("common.export", "Exportar")}
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem 
                        onClick={async () => {
                          const toastId = toast.loading('Gerando exportação de rateio...');
                          try {
                            await exportMatrixExcelJS(
                              filteredStores, 
                              filteredPieces, 
                              visibleQtyMap, 
                              campaign.name, 
                              filteredKits, 
                              activeKitPieces, 
                              undefined, 
                              [], 
                              [], 
                              pieces, 
                              agency?.name, 
                              client?.name, 
                              undefined, 
                              undefined, 
                              activeTabData?.label
                            );
                            toast.success('Rateio exportado com sucesso', { id: toastId });
                          } catch (err) {
                            console.error(err);
                            toast.error('Erro ao exportar rateio', { id: toastId });
                          }
                        }} 
                        className="text-xs py-2 cursor-pointer"
                      >
                        {t("rateio.exportRateio", "EXPORTAR RATEIO")}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={async () => {
                          const toastId = toast.loading('Iniciando exportação por loja...');
                          try {
                            await exportRateioGrid(
                              filteredPieces, 
                              filteredKits, 
                              activeKitPieces, 
                              filteredStores, 
                              visibleQtyMap, 
                              campaign.name, 
                              client.name, 
                              agency.name, 
                              "pieces_and_kits", 
                              (current, total, storeName) => {
                                toast.loading(`Exportando loja ${current} de ${total}: ${storeName}`, { id: toastId });
                              }, 
                              activeTabData?.label
                            );
                            toast.success('Exportação por loja concluída', { id: toastId });
                          } catch (err) {
                            console.error(err);
                            toast.error('Erro ao exportar rateio por loja', { id: toastId });
                          }
                        }} 
                        className="text-xs py-2 cursor-pointer"
                      >
                        {t("rateio.exportByStore", "EXPORTAR RATEIO POR LOJA")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>

                  </DropdownMenu>

                  {isTabEditable && (
                    <>
                      <Badge variant="secondary" className="bg-stone-100 text-stone-500 border-none text-[10px] h-8 px-2.5 font-bold uppercase rounded-lg">
                        {activeTabData?.type === "adjustment" ? "AJUSTE" : activeTabData?.type === "negotiation" ? "NEGOCIAÇÃO" : "ORIGINAL"}
                      </Badge>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg border border-stone-200 shadow-sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem 
                            className="text-xs cursor-pointer"
                            onClick={async () => {
                              if (!confirm("Deseja realmente zerar todas as células do rateio desta versão?")) return;
                              const deletes: { campaignId: string; storeId: string; pieceId: string }[] = [];
                              const seen = new Set<string>();
                              stores.forEach(s => {
                                pieces.forEach(p => {
                                  const key = `${s.id}-${p.id}`;
                                  if (seen.has(key)) return;
                                  seen.add(key);
                                  deletes.push({ campaignId, storeId: s.id, pieceId: p.id });
                                });
                              });
                              setLocalQtyOverrides({});
                              await applyWithHistory([], deletes, "Rateio zerado com sucesso");
                            }}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Limpar todo o rateio
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-xs cursor-pointer"
                            onClick={async () => {
                              if (!confirm("Deseja preencher com 1 em todas as células vazias?")) return;
                              const upserts: RateioUpsert[] = [];
                              stores.forEach(s => {
                                pieces.forEach(p => {
                                  if (!p.kit_only && !qtyMap[`${s.id}-${p.id}`]) {
                                    upserts.push({ campaignId, storeId: s.id, pieceId: p.id, quantity: 1 });
                                  }
                                });
                              });
                              await applyWithHistory(upserts, [], "Rateio preenchido");
                            }}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Preencher vazios com 1
                          </DropdownMenuItem>
                          
                          {rateioSource === 'negotiation' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-xs cursor-pointer text-amber-600 focus:text-amber-600"
                                onClick={handleResetNegotiationRateio}
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Restaurar original
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              </div>

              {/* Filters Row */}
              <div className="px-6 py-1 border-b border-stone-100 bg-white flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                  <Input 
                    value={storeSearch} 
                    onChange={(e) => setStoreSearch(e.target.value)} 
                    placeholder={t("stores.searchAll")} 
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

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-[11px] font-bold uppercase tracking-wider gap-2 px-3"
                      title={t("common.sortBy", "Ordenar por")}
                    >
                      <ArrowUpDown className="w-3 h-3" />
                      <span>{t("common.sortBy", "Ordenar por")}:</span>
                      <span className="text-[#C2714F]">{currentSortLabel}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
                    {sortFieldOptions.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onSelect={(e) => { e.preventDefault(); handleSortFieldChange(opt.value); }}
                        className="text-xs cursor-pointer flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{opt.label}</span>
                        {storeSortField === opt.value && <Check className="w-3.5 h-3.5 text-[#C2714F]" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="h-4 w-px bg-stone-200" />

                {(() => {
                  const uniqueStates = Array.from(new Set(stores.map(s => s.state?.trim()).filter(Boolean))).sort();
                  const uniqueCities = Array.from(new Set(stores.map(s => s.city).filter(Boolean))).sort();
                  const uniqueModels = Array.from(new Set(stores.map(s => s.store_model).filter(Boolean))).sort();

                  const renderFilterDropdown = (
                    label: string,
                    field: "state" | "city" | "store_model",
                    options: string[]
                  ) => {
                    const selected = storeFilters[field];
                    const hasSelection = selected.size > 0;
                    return (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={cn(
                            "flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest px-2 py-1 rounded transition-colors",
                            hasSelection 
                              ? "text-[#C2714F] bg-[#C2714F]/10 hover:bg-[#C2714F]/15" 
                              : "text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                          )}>
                            {label}
                            {hasSelection && (
                              <span className="bg-[#C2714F] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                {selected.size}
                              </span>
                            )}
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto w-56">
                          {hasSelection && (
                            <>
                              <DropdownMenuItem 
                                onClick={() => setStoreFilters(prev => ({ ...prev, [field]: new Set() }))}
                                className="text-xs text-[#C2714F] font-medium"
                              >
                                {t("common.clearFilter", "Limpar filtro")}
                              </DropdownMenuItem>
                              <div className="h-px bg-stone-100 my-1" />
                            </>
                          )}
                          {options.length === 0 && (
                            <div className="px-2 py-1.5 text-xs text-stone-400">
                              {t("common.noOptions", "Sem opções")}
                            </div>
                          )}
                          {options.map(opt => {
                            const isSelected = selected.has(opt);
                            return (
                              <DropdownMenuItem
                                key={opt}
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setStoreFilters(prev => {
                                    const next = new Set(prev[field]);
                                    if (next.has(opt)) next.delete(opt); else next.add(opt);
                                    return { ...prev, [field]: next };
                                  });
                                }}
                                className="text-xs cursor-pointer flex items-center gap-2"
                              >
                                <span className={cn(
                                  "w-3.5 h-3.5 rounded border flex items-center justify-center",
                                  isSelected ? "bg-[#C2714F] border-[#C2714F]" : "border-stone-300"
                                )}>
                                  {isSelected && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                                </span>
                                <span className="truncate">{opt}</span>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  };

                  return (
                    <>
                      {renderFilterDropdown(t("filters.state", "Estado"), "state", uniqueStates as string[])}
                      {renderFilterDropdown(t("filters.city", "Cidade"), "city", uniqueCities as string[])}
                      {renderFilterDropdown(t("filters.storeCategory", "Categoria de Loja"), "store_model", uniqueModels as string[])}
                    </>
                  );
                })()}
                
                <div className="flex-1" />
                
                <div className="text-[11px] text-stone-500 font-bold">
                  {filteredStores.length} {t("rateio.stores", "loja(s)")}
                </div>
              </div>

              {/* Spreadsheet Table */}
              <div ref={gridContainerRef} className="flex-1 min-h-0 overflow-auto relative custom-scrollbar">
                {/* Loading overlay for quantities */}
                {isLoadingQuantities && (
                  <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/70 dark:bg-stone-900/70 backdrop-blur-sm pointer-events-none animate-in fade-in">
                    <div className="flex flex-col items-center gap-3 px-6 py-4 rounded-xl bg-white dark:bg-stone-900 shadow-lg border border-stone-200 dark:border-stone-800">
                      <Loader2 className="h-6 w-6 animate-spin text-[#8C6F4E]" />
                      <p className="text-sm font-medium text-stone-700 dark:text-stone-200">
                        Carregando quantidades...
                      </p>
                      <p className="text-[11px] text-stone-400">
                        Seus dados estão sendo recuperados. Aguarde um instante.
                      </p>
                    </div>
                  </div>
                )}
                {/* Floating Navigation Buttons */}
                <div className="fixed right-12 bottom-24 flex flex-col gap-2 z-50">
                  {showScrollTop && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full shadow-lg bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 transition-all animate-in fade-in slide-in-from-right-4"
                      onClick={scrollToFirst}
                      title="Primeira Loja"
                    >
                      <ChevronUp className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                    </Button>
                  )}
                  {showScrollBottom && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full shadow-lg bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 transition-all animate-in fade-in slide-in-from-right-4"
                      onClick={scrollToLast}
                      title="Última Loja"
                    >
                      <ChevronDown className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                    </Button>
                  )}
                </div>
                <table className="min-w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead 
                    className="bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.05)]"
                    style={{ position: 'sticky', top: 0, zIndex: 30 }}
                  >
                    {/* Category Sub-Labels Row (store_category: PAREDE PRIMÁRIA, PICK&MIX, QUIOSQUE...) */}
                    <tr>
                      <th
                        className="w-[300px] bg-white border-r border-stone-200"
                        style={{ position: 'sticky', left: 0, top: 0, zIndex: 50 }}
                      />
                      {(() => {
                        const CAT_COLORS = ['#C2410C','#B91C1C','#15803D','#1D4ED8','#6B21A8','#78350F'];
                        const colorMap = new Map<string, string>();
                        let ci = 0;
                        for (const g of categoryGroups) {
                          const key = (g.label || '').trim().toUpperCase();
                          if (!key) continue;
                          if (!colorMap.has(key)) {
                            colorMap.set(key, CAT_COLORS[ci % CAT_COLORS.length]);
                            ci++;
                          }
                        }
                        return categoryGroups.map((group, gIdx) => {
                          const key = (group.label || '').trim().toUpperCase();
                          const bg = colorMap.get(key);
                          return (
                            <th
                              key={`cat-${gIdx}`}
                              colSpan={group.items.length}
                              className="border-b border-r border-stone-200 text-[10px] font-bold py-1 text-center uppercase tracking-wider"
                              style={{
                                position: 'sticky',
                                top: 0,
                                zIndex: 30,
                                background: bg || '#f5f5f4',
                                color: bg ? '#ffffff' : '#78716c',
                              }}
                            >
                              {group.label || "\u00A0"}
                            </th>
                          );
                        });
                      })()}
                    </tr>
                    {/* Piece Headers Row */}
                    <tr>
                      <th 
                        className="w-[300px] bg-white px-3 py-2 border-r border-b border-stone-200 text-left align-top" 
                        style={{ position: 'sticky', left: 0, top: 22, zIndex: 50 }}
                      >

                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Loja</div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={cn(
                                "h-6 w-6 rounded-md transition-all relative", 
                                sortConfig?.key === 'state' && "bg-stone-100 text-[#C2714F]"
                              )}
                              onClick={() => toggleSort('state')}
                              title="Ordenar por Estado"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              {sortConfig?.key === 'state' && (
                                <span className="absolute -top-1 -right-1 flex items-center justify-center w-3 h-3 bg-[#C2714F] text-white text-[8px] rounded-full font-bold">
                                  {sortConfig.direction === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </Button>
                          </div>
                        </div>
                      </th>
                      {columns.map((col) => {
                        const isKit = col._type === "kit";
                        const img = col.image_url || col.image_report_url || undefined;
                        return (
                          <th 
                            key={`${col._type}-${col.id}`} 
                            className="min-w-[140px] px-1.5 py-1 border-r border-b border-stone-200 align-top bg-white transition-colors hover:bg-stone-50"

                            style={{ position: 'sticky', top: 22, zIndex: 25 }}
                          >
                            <div className="flex flex-col items-center gap-1">
                              {img ? (
                                <img 
                                  src={img} 
                                  alt={col.name} 
                                  className="w-8 h-8 rounded-md object-cover border border-stone-100 shadow-sm" 
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-md bg-stone-100 flex items-center justify-center">
                                  <Table2 className="w-3.5 h-3.5 text-stone-300" />
                                </div>
                              )}
                              <div className="flex items-center gap-1 leading-none">
                                <span className="text-xs font-black text-stone-900">{col.code}</span>
                                {isKit && (
                                  <span className="text-[9px] font-black text-[#C2714F] uppercase">KIT</span>
                                )}
                              </div>
                              <div className="text-[10px] text-stone-600 font-semibold leading-tight text-center whitespace-normal break-words">
                                {col.name}
                              </div>

                            </div>
                          </th>
                        );
                      })}

                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {virtualRows.length > 0 && virtualRows[0].start > 0 && (
                      <tr><td colSpan={columns.length + 1} style={{ height: virtualRows[0].start }} /></tr>
                    )}
                    {virtualRows.map((virtualRow) => {
                      const store = filteredStores[virtualRow.index];
                      const sIdx = virtualRow.index;
                      const isEditingRow = editingCell?.storeId === store.id;
                      const isAnchorRow = anchorCell?.rowIndex === sIdx;
                      
                      return (
                        <RateioRow
                          key={store.id}
                          store={store}
                          sIdx={sIdx}
                          columns={columns}
                          kits={kits}
                          kitQtyMap={kitQtyMap}
                          storeQtyMap={storeQtyMaps[store.id] || {}}
                          isEditingRow={isEditingRow}
                          editingCell={isEditingRow ? editingCell : null}
                          anchorCell={isAnchorRow ? anchorCell : null}
                          isTabEditable={isTabEditable}
                          switchToCell={switchToCell}
                          inputRef={inputRef}
                          editValue={isEditingRow ? editValue : ""}
                          setEditValue={setEditValue}
                          editValueRef={editValueRef}
                          handlePieceBlur={handlePieceBlur}
                          handleEditorKeyDown={handleEditorKeyDown}
                          handleExcelPaste={handleExcelPaste}
                          closeEditing={closeEditing}
                        />
                      );
                    })}
                    {virtualRows.length > 0 && (rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end) > 0 && (
                      <tr><td colSpan={columns.length + 1} style={{ height: rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end }} /></tr>
                    )}
                  </tbody>
                  {/* Table Footer with Totals */}
                  <tfoot 
                    className="bg-stone-50 shadow-[0_-1px_0_0_rgba(0,0,0,0.05)]"
                    style={{ position: 'sticky', bottom: 0, zIndex: 30 }}
                  >
                    <tr>
                      <td 
                        className="bg-stone-50 border-r border-t border-stone-200 p-3 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]" 
                        style={{ position: 'sticky', left: 0, bottom: 0, zIndex: 40 }}
                      >
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

      <MatrixAutomationDialog 
        open={isAutomationOpen}
        onOpenChange={setIsAutomationOpen}
        campaignId={campaignId}
        clientId={clientId}
        stores={stores}
        pieces={pieces}
        kits={kits}
        kitPieces={kitPieces}
        qtyMap={qtyMap}
        customFieldLabels={customFieldLabels}
        onComplete={handleAutomationComplete}
        isAdjustmentView={activeTabData?.type === "adjustment"}
        adjustmentId={activeAdjustment?.id}
        isNegotiationView={activeTabData?.type === "negotiation"}
        negotiationSupplierId={effectiveNegSupplierId}
      />
      <CopyQuantitiesDialog 
        open={copyQtyOpen}
        onOpenChange={setCopyQtyOpen}
        campaignId={campaignId}
        stores={stores}
        pieces={pieces}
        kits={kits}
        kitPieces={kitPieces}
        qtyMap={qtyMap}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["campaign_store_pieces"] });
          queryClient.invalidateQueries({ queryKey: ["budget_negotiation_store_pieces"] });
          queryClient.invalidateQueries({ queryKey: ["adjustment_rateio_qty_map"] });
        }}
        isNegotiationView={rateioSource === 'negotiation'}
        negotiationSupplierId={effectiveNegSupplierId}
        isAdjustmentView={rateioSource === 'adjustment'}
        adjustmentId={activeAdjustment?.id}
        runBulkWithHistory={async (label, upserts, deletes) => {
          await applyWithHistory(upserts, deletes, label);
        }}
      />

      <Dialog open={isPasteModalOpen} onOpenChange={setIsPasteModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5 text-[#C2714F]" />
              Confirmar colagem de valores
            </DialogTitle>
            <DialogDescription>
              Revise as alterações detectadas na sua planilha antes de confirmar a atualização no sistema.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6">
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-stone-50 rounded-lg p-3 border border-stone-200">
                  <div className="text-[10px] font-bold text-stone-400 uppercase mb-1">Total de células</div>
                  <div className="text-2xl font-black text-stone-900">{pendingChanges.length}</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Lojas afetadas</div>
                  <div className="text-2xl font-black text-emerald-700">
                    {new Set(pendingChanges.map(c => c.storeId)).size}
                  </div>
                </div>
              </div>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-stone-100">
                    <TableRow>
                      <TableHead className="text-[10px] h-8 font-bold uppercase">Loja</TableHead>
                      <TableHead className="text-[10px] h-8 font-bold uppercase">Item</TableHead>
                      <TableHead className="text-[10px] h-8 font-bold uppercase text-center">De</TableHead>
                      <TableHead className="text-[10px] h-8 font-bold uppercase text-center">Para</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingChanges.slice(0, 50).map((c, idx) => (
                      <TableRow key={idx} className="h-9">
                        <TableCell className="text-xs py-1 font-medium truncate max-w-[150px]">{c.storeName}</TableCell>
                        <TableCell className="text-xs py-1">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[9px] h-4 px-1 leading-none">
                              {c.itemType === 'kit' ? 'KIT' : 'PEÇA'}
                            </Badge>
                            <span className="truncate max-w-[150px]">{c.pieceName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs py-1 text-center text-stone-400">{c.oldValue ?? 0}</TableCell>
                        <TableCell className="text-xs py-1 text-center font-bold text-emerald-600">{Math.round(c.newValue)}</TableCell>
                      </TableRow>
                    ))}
                    {pendingChanges.length > 50 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-[10px] text-center text-stone-400 bg-stone-50/50 italic py-2">
                          + {pendingChanges.length - 50} outras alterações...
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-stone-50 border-t border-stone-100 gap-2">
            <Button variant="ghost" onClick={() => setIsPasteModalOpen(false)} disabled={isApplyingPaste}>
              Cancelar
            </Button>
            <Button 
              className="bg-[#C2714F] hover:bg-[#A35D3F] text-white" 
              onClick={confirmPaste} 
              disabled={isApplyingPaste}
            >
              {isApplyingPaste ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Aplicando...
                </>
              ) : (
                <>Confirmar colagem ({pendingChanges.length})</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={requoteDialogOpen} onOpenChange={setRequoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar Recotação por Quantidade</DialogTitle>
            <DialogDescription>
              Gere um link para o fornecedor recotar com base nas novas quantidades do Rateio de Negociação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-stone-700 mb-1 block">Fornecedor</label>
              <select
                className="h-10 w-full rounded-md border border-stone-300 bg-white text-sm px-2"
                value={requoteSelectedSupplier}
                onChange={(e) => setRequoteSelectedSupplier(e.target.value)}
                disabled={!!generatedRequoteLink}
              >
                <option value="">Selecione o fornecedor...</option>
                {requoteSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.company_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-700 mb-1 block">Observações (opcional)</label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-stone-300 bg-white text-sm p-2"
                value={requoteNotes}
                onChange={(e) => setRequoteNotes(e.target.value)}
                disabled={!!generatedRequoteLink}
              />
            </div>
            {generatedRequoteLink && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
                <div className="text-xs font-semibold text-stone-700 mb-1">Link de recotação</div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={generatedRequoteLink}
                    className="flex-1 text-xs px-2 py-1 rounded border border-stone-300 bg-white"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedRequoteLink);
                      toast.success("Link copiado");
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRequoteDialogOpen(false)}>
              Fechar
            </Button>
            {!generatedRequoteLink && (
              <Button onClick={handleGenerateRequoteLink} disabled={isGeneratingLink || !requoteSelectedSupplier}>
                {isGeneratingLink ? "Gerando..." : "GERAR LINK"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
