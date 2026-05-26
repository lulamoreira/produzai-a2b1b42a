import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { 
  Table2, BarChart3 as BarChart3Icon, ChevronDown, ChevronUp, 
  Search, Filter, Download, Sparkles, Copy, MoreHorizontal, Lock, CheckCircle2,
  Undo2, Redo2, Store as StoreIcon, MapPin, Tag, Layers, RefreshCw, X, Clipboard,
  ArrowUpDown, Check
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useUpdateCampaignStorePiece } from "@/hooks/useMultiClientData";
import { applyRateioBulk, type RateioUpsert } from "@/lib/applyRateioBulk";
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  
  const [rateioView, setRateioView] = useState("planilha");
  const [filterSidebarCollapsed, setFilterSidebarCollapsed] = useState(true);
  
  // Excel Paste state
  const [anchorCell, setAnchorCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<{ 
    storeId: string; 
    pieceId: string; 
    oldValue: number; 
    newValue: number; 
    storeName: string; 
    pieceName: string;
    isIgnored: boolean;
    itemType: 'piece' | 'kit';
  }[]>([]);
  const [isApplyingPaste, setIsApplyingPaste] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const [pieceFilters, setPieceFilters] = useState<PieceFilters>({ ...EMPTY_FILTERS });
  const [storeFilters, setStoreFilters] = useState<StoreFilters>({ ...EMPTY_STORE_FILTERS });
  const [filterLogicMode, setFilterLogicMode] = useState<FilterLogicMode>("and");
  
  const [isAutomationOpen, setIsAutomationOpen] = useState(false);
  const [isExecutingAutomation, setIsExecutingAutomation] = useState(false);
  const [copyQtyOpen, setCopyQtyOpen] = useState(false);

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
    
    if (hasNegotiationRateio && winnerSupplierId) {
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
  }, [hasNegotiationRateio, winnerSupplierId, winnerSupplierName, activeAdjustment]);

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
    let result = stores.filter(s => {
      const q = storeSearch.toLowerCase().trim();
      const matchesSearch = !q || Object.values(s).some(val => 
        (typeof val === 'string' || typeof val === 'number') && 
        val.toString().toLowerCase().includes(q)
      );
      
      // Apply sidebar filters
      if (storeFilters.city.size > 0 && !storeFilters.city.has(s.city)) return false;
      if (storeFilters.state.size > 0 && !storeFilters.state.has(s.state?.trim())) return false;
      if (storeFilters.store_model.size > 0 && !storeFilters.store_model.has(s.store_model)) return false;
      
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
  }, [stores, storeSearch, storeFilters, sortConfig, storeSortField]);

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
    if (!canEditCampaignStores || !isTabEditable) return;
    setEditingCell({ storeId, pieceId });
    setEditValue(currentVal === 0 ? "" : String(currentVal));
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const applyWithHistory = async (
    upserts: RateioUpsert[],
    deletes: { campaignId: string; storeId: string; pieceId: string }[],
    label?: string
  ) => {
    const changes: { storeId: string; pieceId: string; oldVal: number; newVal: number }[] = [];
    
    upserts.forEach(u => {
      const oldVal = qtyMap[`${u.storeId}-${u.pieceId}`] || 0;
      if (oldVal !== u.quantity) {
        changes.push({ storeId: u.storeId, pieceId: u.pieceId, oldVal, newVal: u.quantity });
      }
    });

    deletes.forEach(d => {
      const oldVal = qtyMap[`${d.storeId}-${d.pieceId}`] || 0;
      if (oldVal !== 0) {
        changes.push({ storeId: d.storeId, pieceId: d.pieceId, oldVal, newVal: 0 });
      }
    });

    if (changes.length === 0) return;

    try {
      await applyRateioBulk(upserts, deletes, {
        isNegotiationView: rateioSource === 'negotiation',
        negotiationSupplierId: winnerSupplierId,
        isAdjustmentView: rateioSource === 'adjustment',
        adjustmentId: activeAdjustment?.id
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
        negotiationSupplierId: winnerSupplierId,
        isAdjustmentView: rateioSource === 'adjustment',
        adjustmentId: activeAdjustment?.id
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
        negotiationSupplierId: winnerSupplierId,
        isAdjustmentView: rateioSource === 'adjustment',
        adjustmentId: activeAdjustment?.id
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

  const saveKitQty = async (storeId: string, kitId: string, quantity: number) => {
    const kpList = (kitPieces || []).filter((kp: any) => kp.kit_id === kitId);
    if (kpList.length === 0) return;

    const upserts = kpList.map((kp: any) => ({
      campaignId,
      storeId,
      pieceId: kp.piece_id,
      quantity: quantity * (kp.quantity || 1)
    }));

    await applyWithHistory(upserts, []);
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    const { storeId, pieceId } = editingCell;
    const qty = parseInt(editValue, 10) || 0;
    
    try {
      const isKit = kits?.some(k => k.id === pieceId);
      if (isKit) {
        await saveKitQty(storeId, pieceId, qty);
      } else {
        await applyWithHistory([{ campaignId, storeId, pieceId, quantity: qty }], []);
      }
    } catch (err) {
      // toast already shown in applyWithHistory
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") {
      setEditingCell(null);
      setAnchorCell(null);
    }
  };

  const parseExcelTSV = (text: string): (number | null | undefined)[][] => {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const trimmed = normalized.replace(/\n$/, '');
    return trimmed.split('\n').map(line =>
      line.split('\t').map(cell => {
        const raw = cell.trim();
        if (raw === '') return undefined; // VAZIO = pular silenciosamente
        const cleaned = raw.replace(/\./g, '').replace(',', '.');
        const numValue = parseFloat(cleaned);
        return isNaN(numValue) ? null : numValue; // null = texto inválido, marca ignorado
      })
    );
  };

  const handleExcelPaste = useCallback((text: string, anchor: { rowIndex: number; colIndex: number }) => {
    const parsedData = parseExcelTSV(text);
    const changes: typeof pendingChanges = [];

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
        
        // Ignora peças que pertençam a um kit
        if (!isKit && (col as any).kit_only === true) continue;
        
        const oldValue = isKit 
          ? (kitQtyMap[`${store.id}-${col.id}`] || 0)
          : (qtyMap[`${store.id}-${col.id}`] || 0);
        
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
      setPendingChanges(changes);
      setIsPasteModalOpen(true);
    }
  }, [filteredStores, columns, qtyMap, kitQtyMap]);

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

  const confirmPaste = async () => {
    const allUpsertsMap = new Map<string, RateioUpsert>();

    const addUpsert = (storeId: string, pieceId: string, qty: number) => {
      const key = `${storeId}-${pieceId}`;
      const existing = allUpsertsMap.get(key);
      if (existing) {
        existing.quantity = (existing.quantity || 0) + qty;
      } else {
        allUpsertsMap.set(key, {
          campaignId,
          storeId,
          pieceId,
          quantity: qty
        });
      }
    };
    
    pendingChanges
      .filter(c => !c.isIgnored)
      .forEach(c => {
        const val = Math.round(c.newValue);
        if (c.itemType === 'kit') {
          // Decompõe kit — somando quando peça aparece em outros kits
          const kpList = (kitPieces || []).filter((kp: any) => kp.kit_id === c.pieceId);
          kpList.forEach((kp: any) => {
            addUpsert(c.storeId, kp.piece_id, val * (kp.quantity || 1));
          });
        } else {
          // Peça standalone (kit_only=false)
          addUpsert(c.storeId, c.pieceId, val);
        }
      });

    const allUpserts = Array.from(allUpsertsMap.values());

    if (allUpserts.length === 0) {
      setIsPasteModalOpen(false);
      return;
    }

    setIsApplyingPaste(true);
    try {
      if (allUpserts.length > 0) {
        const CHUNK_SIZE = 500;
        for (let i = 0; i < allUpserts.length; i += CHUNK_SIZE) {
          const chunk = allUpserts.slice(i, i + CHUNK_SIZE);
          await applyRateioBulk(chunk, [], {
            isNegotiationView: rateioSource === 'negotiation',
            negotiationSupplierId: winnerSupplierId,
            isAdjustmentView: rateioSource === 'adjustment',
            adjustmentId: activeAdjustment?.id
          });
        }
        
        // Refresh maps after bulk operations
        queryClient.invalidateQueries({ queryKey: ["campaign_store_pieces"] });
        queryClient.invalidateQueries({ queryKey: ["budget_negotiation_store_pieces"] });
        queryClient.invalidateQueries({ queryKey: ["adjustment_rateio_qty_map"] });
        
        toast.success(`${allUpserts.length} células atualizadas com sucesso`);
      }
      
      setIsPasteModalOpen(false);
      setAnchorCell(null);
    } catch (err: any) {
      console.error("Erro confirmPaste:", err);
      toast.error(`Erro ao aplicar colagem: ${err?.message || 'desconhecido'}`);
    } finally {
      setIsApplyingPaste(false);
    }
  };


  const handleAutomationComplete = () => {
    setIsAutomationOpen(false);
    // You might want to refresh data here, but react-query usually handles it via mutations
  };




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
              <div className="bg-white border-b border-stone-200 px-4 pt-3 flex items-end gap-1 overflow-x-auto no-scrollbar">
                {versionTabs.map((tab) => {
                  const isActive = activeVersionTab === tab.id;
                  const isCurrentVigente = tab.isVigente;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setRateioSource(tab.id as "original" | "negotiation" | "adjustment")}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap",
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


              {/* Rateio Header Banner */}
              <div className={cn(
                "px-6 py-3 border-b flex flex-col md:flex-row md:items-center justify-between gap-4",
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
                        className="h-9 text-xs gap-2 rounded-lg border-stone-200 shadow-sm hover:bg-stone-50"
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
                        className="h-9 text-xs gap-2 rounded-lg border-stone-200 shadow-sm hover:bg-stone-50"
                        onClick={() => setCopyQtyOpen(true)}
                      >
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
                      <DropdownMenuItem 
                        onClick={() => exportRateioGrid(pieces, kits, kitPieces, stores, qtyMap, campaign.name, client.name, agency.name)} 
                        className="text-xs py-2 cursor-pointer"
                      >
                        {t("rateio.exportByStore", "EXPORTAR RATEIO POR LOJA")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {isTabEditable && (
                    <>
                      <Badge variant="secondary" className="bg-stone-100 text-stone-500 border-none text-[10px] h-9 px-3 font-bold uppercase rounded-lg">
                        {activeTabData?.type === "adjustment" ? "AJUSTE" : activeTabData?.type === "negotiation" ? "NEGOCIAÇÃO" : "ORIGINAL"}
                      </Badge>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg border border-stone-200 shadow-sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem 
                            className="text-xs cursor-pointer"
                            onClick={async () => {
                              if (!confirm("Deseja realmente limpar todo o rateio desta versão?")) return;
                              const deletes = Object.keys(qtyMap).map(key => {
                                const [storeId, pieceId] = key.split("-");
                                return { campaignId, storeId, pieceId };
                              });
                              await applyWithHistory([], deletes, "Rateio limpo com sucesso");
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
              <div className="px-6 py-2 border-b border-stone-100 bg-white flex items-center gap-3">
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
              <div ref={gridContainerRef} className="flex-1 overflow-auto relative custom-scrollbar">
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
                    {filteredStores.map((store, sIdx) => (
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
                        {columns.map((col, cIdx) => {
                          const isKit = col._type === "kit";
                          const val = isKit
                            ? (kitQtyMap[`${store.id}-${col.id}`] || 0)
                            : (qtyMap[`${store.id}-${col.id}`] || 0);
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
                                setAnchorCell({ rowIndex: sIdx, colIndex: cIdx });
                              }}
                              onDoubleClick={() => isTabEditable && startEditing(store.id, col.id, val)}
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
                                  onPaste={(e) => {
                                    e.preventDefault();
                                    const text = e.clipboardData.getData('text/plain');
                                    console.log("Paste on cell:", { rowIndex: sIdx, colIndex: cIdx });
                                    handleExcelPaste(text, { rowIndex: sIdx, colIndex: cIdx });
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

      {anchorCell && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-stone-900 text-white px-4 py-2 rounded-full text-xs font-medium shadow-2xl z-[100] flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <Clipboard className="w-3.5 h-3.5 text-[#C2714F]" />
            <span>Pressione <strong>Ctrl+V</strong> para colar do Excel</span>
          </div>
          <div className="w-px h-3 bg-stone-700" />
          <button 
            onClick={() => setAnchorCell(null)}
            className="text-stone-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <span>Esc para cancelar</span>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <AlertDialog open={isPasteModalOpen} onOpenChange={setIsPasteModalOpen}>
        <AlertDialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle>Colar dados do Excel</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a preencher {pendingChanges.filter(c => !c.isIgnored).length} células.
              {pendingChanges.some(c => c.oldValue > 0) && (
                <span className="block mt-1 text-amber-600 font-medium">
                  Aviso: {pendingChanges.filter(c => c.oldValue > 0).length} células com valores existentes serão sobrescritas.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex-1 overflow-auto my-4 border rounded-md">
            <Table>
              <TableHeader className="bg-stone-50 sticky top-0">
                <TableRow>
                  <TableHead className="text-xs">Loja</TableHead>
                  <TableHead className="text-xs">Peça</TableHead>
                  <TableHead className="text-xs text-center">Valor atual</TableHead>
                  <TableHead className="text-xs text-center">Novo valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingChanges.slice(0, 10).map((change, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs font-medium">{change.storeName}</TableCell>
                    <TableCell className="text-xs">{change.pieceName}</TableCell>
                    <TableCell className="text-xs text-center text-stone-400">{change.oldValue || "—"}</TableCell>
                    <TableCell className={cn(
                      "text-xs text-center font-bold",
                      change.isIgnored ? "text-red-500" : "text-stone-900"
                    )}>
                      {change.isIgnored ? "ignorado" : change.newValue}
                    </TableCell>
                  </TableRow>
                ))}
                {pendingChanges.length > 10 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-xs text-center text-stone-500 bg-stone-50/50 italic py-2">
                      ... e mais {pendingChanges.length - 10} células
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApplyingPaste}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                confirmPaste();
              }}
              disabled={isApplyingPaste}
              className="bg-[#C2714F] hover:bg-[#A35D3F]"
            >
              {isApplyingPaste ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Aplicando...
                </>
              ) : (
                "Confirmar colagem"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
        negotiationSupplierId={winnerSupplierId}
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
        negotiationSupplierId={winnerSupplierId}
        isAdjustmentView={rateioSource === 'adjustment'}
        adjustmentId={activeAdjustment?.id}
        runBulkWithHistory={async (label, upserts, deletes) => {
          await applyWithHistory(upserts, deletes, label);
        }}
      />
    </div>
  );
}