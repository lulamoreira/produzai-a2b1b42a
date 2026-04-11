import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";

import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  useCampaign, useClient, useClientStores, useCampaignPieces, useCampaignStorePieces,
  useAddCampaignPiece, useDeleteCampaignPiece, useUpdateCampaignPiece, useUpdateCampaignStorePiece,
  useCampaignPieceLocations, useAddCampaignPieceLocation, useDeleteCampaignPieceLocation,
  useCampaignPieceSubLocations,
  useUpdateClientStore,
  useCampaignStoreStatus, useUpsertCampaignStoreStatus, useBulkUpsertCampaignStoreStatus,
  useClientStoreModels,
  useCampaignKits, useAddCampaignKit, useDeleteCampaignKit, useUpdateCampaignKit,
  useCampaignKitPieces, useAddCampaignKitPiece, useDeleteCampaignKitPiece, useUpdateCampaignKitPiece,
  type CampaignPiece, type ClientStore, type CampaignKit,
} from "@/hooks/useMultiClientData";

import { useClientPermission } from "@/hooks/useClientPermission";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, Search, Package, Edit3, Store, Grid3X3, LayoutList, MapPin, Download, Upload, Sparkles, Hash, X, Minus, ChevronRight, CheckSquare, AlertTriangle, CalendarDays, Copy, RefreshCw, Home, DollarSign, Filter, Camera, MessageSquare, Users, FileSpreadsheet, MoreHorizontal } from "lucide-react";
import StoreContactsCardView from "@/components/StoreContactsCardView";
import BudgetsTab from "@/components/BudgetsTab";
import PieceThumbnail from "@/components/PieceThumbnail";
import CampaignPieceImageUpload from "@/components/CampaignPieceImageUpload";
import AppLayout from "@/components/AppLayout";
import QuickMatrixEditor from "@/components/QuickMatrixEditor";
import { toast } from "sonner";
import { exportCampaignPieces, parsePiecesImport, exportMatrix, parseMatrixImport } from "@/lib/exportMultiClient";
import { exportMatrixExcelJS } from "@/lib/exportMatrixExcelJS";
import CustomExportDialog, { type ExportFieldDef } from "@/components/CustomExportDialog";
import OccurrencesTab from "@/components/OccurrencesTab";
import { CreateKitDialog, KitDetailDialog } from "@/components/KitDialog";
import SchedulingTab from "@/components/SchedulingTab";
import InstallationsTab from "@/components/InstallationsTab";
import ImportPiecesFromCampaignDialog from "@/components/ImportPiecesFromCampaignDialog";
import SortablePiecesTable, { type UnifiedRow } from "@/components/SortablePiecesTable";
import SupportMaterialsSection from "@/components/SupportMaterialsSection";
import ImportSpecFromCampaign from "@/components/ImportSpecFromCampaign";
import BulkDeletePiecesDialog from "@/components/BulkDeletePiecesDialog";
import ManageLocationsDialog from "@/components/ManageLocationsDialog";
import ImportMatrixFromCampaignDialog from "@/components/ImportMatrixFromCampaignDialog";
import MatrixFilterSidebar, { EMPTY_FILTERS, EMPTY_STORE_FILTERS, type PieceFilters, type StoreFilters } from "@/components/MatrixFilterSidebar";
import ModuleGrid from "@/components/ModuleGrid";
import CampaignChatSection from "@/components/CampaignChatSection";
import StoreContactsSection from "@/components/StoreContactsSection";
import MatrixAutomationDialog from "@/components/MatrixAutomationDialog";

const CampaignDetail = () => {
  const { agencyId, clientId, campaignId } = useParams<{ agencyId: string; clientId: string; campaignId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const locationState = location.state as { initialSection?: string; limitedMode?: boolean } | null;
  const isLimitedMode = locationState?.limitedMode || false;

  // For limited users, browser back button should go to /my-campaigns
  useEffect(() => {
    if (!isLimitedMode) return;
    const onPopState = () => navigate("/my-campaigns", { replace: true });
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isLimitedMode, navigate]);

  const { isAdmin } = useUserRole();

  // Permission checks replace isAdmin for granular access control
  const { hasPermission: canEditCampaign } = useClientPermission(clientId, "can_edit_campaigns");
  const { hasPermission: canEditOccurrences } = useClientPermission(clientId, "can_edit_occurrences");
  const { hasPermission: canDeleteOccurrences } = useClientPermission(clientId, "can_delete_occurrences");
  const { hasPermission: canEditReporterData } = useClientPermission(clientId, "can_edit_reporter_data");
  const { hasPermission: canEditPieces } = useClientPermission(clientId, "can_edit_pieces");
  const { hasPermission: canDeletePieces } = useClientPermission(clientId, "can_delete_pieces");
  const { hasPermission: canEditCampaignStores } = useClientPermission(clientId, "can_edit_campaign_stores");
  const { hasPermission: canEditStores } = useClientPermission(clientId, "can_edit_stores");
  const { hasPermission: canEditSchedules } = useClientPermission(clientId, "can_edit_schedules");

  // View permissions for module visibility
  const { hasPermission: canViewStores } = useClientPermission(clientId, "can_view_stores");
  const { hasPermission: canViewCampaignStores } = useClientPermission(clientId, "can_view_campaign_stores");
  const { hasPermission: canViewPieces } = useClientPermission(clientId, "can_view_pieces");
  const { hasPermission: canViewOccurrences } = useClientPermission(clientId, "can_view_occurrences");
  const { hasPermission: canViewSchedules } = useClientPermission(clientId, "can_view_schedules");
  const { hasPermission: canViewInstallations } = useClientPermission(clientId, "can_view_installations");
  const { hasPermission: canEditInstallations } = useClientPermission(clientId, "can_edit_installations");
  const { hasPermission: canViewCampaigns } = useClientPermission(clientId, "can_view_campaigns");
  const { data: client } = useClient(clientId);
  // Auto-sync language based on client config
  useLanguage((client as any)?.language);
  const { data: campaign, isLoading: loadingCampaign } = useCampaign(campaignId);
  const { data: stores = [] } = useClientStores(clientId);
  const { data: clientStoreModels = [] } = useClientStoreModels(clientId);
  const { data: pieces = [], isLoading: loadingPieces } = useCampaignPieces(campaignId);
  const { data: storePieces = [] } = useCampaignStorePieces(campaignId);
  const addPiece = useAddCampaignPiece();
  const deletePiece = useDeleteCampaignPiece();
  const updatePiece = useUpdateCampaignPiece();
  const updateStorePiece = useUpdateCampaignStorePiece();
  const { data: pieceLocations = [] } = useCampaignPieceLocations(campaignId);
  const { data: pieceSubLocations = [] } = useCampaignPieceSubLocations(campaignId);
  const addPieceLocation = useAddCampaignPieceLocation();
  const updateClientStore = useUpdateClientStore();
  const { data: campaignStoreStatus = [] } = useCampaignStoreStatus(campaignId);
  const upsertStoreStatus = useUpsertCampaignStoreStatus();
  const bulkUpsertStoreStatus = useBulkUpsertCampaignStoreStatus();
  const { data: kits = [] } = useCampaignKits(campaignId);
  const { data: kitPieces = [] } = useCampaignKitPieces(campaignId);
  const addKit = useAddCampaignKit();
  const deleteKit = useDeleteCampaignKit();
  const updateKit = useUpdateCampaignKit();
  const addKitPiece = useAddCampaignKitPiece();
  const deleteKitPiece = useDeleteCampaignKitPiece();
  const updateKitPiece = useUpdateCampaignKitPiece();

  // Fetch agency color for header gradient
  const { data: agency } = useQuery({
    queryKey: ["agency", agencyId],
    queryFn: async () => {
      if (!agencyId) return null;
      const { data } = await supabase.from("agencies").select("name, color").eq("id", agencyId).maybeSingle();
      return data;
    },
    enabled: !!agencyId,
  });
  const agencyColor = agency?.color || "#6366f1";


  const storeEnabledMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    campaignStoreStatus.forEach((s) => { map[s.store_id] = s.enabled; });
    return map;
  }, [campaignStoreStatus]);

  const isStoreEnabled = (storeId: string) => storeEnabledMap[storeId] !== false;

  // ─── Location management ──────────────────────────────
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);

  // ─── Kit dialogs ───────────────────────────────────────
  const [createKitDialogOpen, setCreateKitDialogOpen] = useState(false);
  const [importPiecesDialogOpen, setImportPiecesDialogOpen] = useState(false);
  const [viewKitDetail, setViewKitDetail] = useState<CampaignKit | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // ─── Piece dialogs ─────────────────────────────────────
  const [pieceDialogOpen, setPieceDialogOpen] = useState(false);
  const [pieceForm, setPieceForm] = useState({
    code: "", category: "", sub_location: "", name: "",
    width: "", length: "", height: "",
    store_category: typeof window !== "undefined" ? localStorage.getItem("last_store_category") || "" : "",
    specification: "Vide Book/Manual",
    installation_instructions: "Sem informações específicas",
    kit_only: false,
    is_mockup: false,
    image_url: "",
  });
  const [pieceImageUploading, setPieceImageUploading] = useState(false);
  const [editPieceDialogOpen, setEditPieceDialogOpen] = useState(false);
  const [editPieceForm, setEditPieceForm] = useState({
    id: "", code: "", category: "", sub_location: "", name: "",
    width: "", length: "", height: "",
    store_category: "",
    specification: "Vide Book/Manual",
    installation_instructions: "Sem informações específicas",
    kit_only: false,
    is_mockup: false,
    image_url: "",
  });

  // ─── Store filters ─────────────────────────────────────
  const [storeSearch, setStoreSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("__all__");
  const [stateFilter, setStateFilter] = useState("__all__");
  const [storeCategoryFilter, setStoreCategoryFilter] = useState("__all__");

  // ─── Store detail view ────────────────────────────────
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [storesViewMode, setStoresViewMode] = useState<"table" | "contacts">("table");
  const [deactivateStoreId, setDeactivateStoreId] = useState<string | null>(null);
  const [addPieceToStoreOpen, setAddPieceToStoreOpen] = useState(false);
  const [storeEditingPieceId, setStoreEditingPieceId] = useState<string | null>(null);
  const [storeEditQtyValue, setStoreEditQtyValue] = useState("");

  // ─── Edit store from card views ───────────────────────
  const [editStoreDialogOpen, setEditStoreDialogOpen] = useState(false);
  const [editStoreId, setEditStoreId] = useState<string | null>(null);
  const [editStoreForm, setEditStoreForm] = useState({
    name: "", nickname: "", cnpj: "", state_registration: "",
    zip_code: "", street: "", number: "", complement: "", neighborhood: "",
    city: "", state: "", phone: "", manager_name: "",
    store_model: "", country: "", store_code: "", email: "", observations: "",
  });

  const handleOpenEditStore = useCallback((store: ClientStore) => {
    setEditStoreId(store.id);
    setEditStoreForm({
      name: store.name || "", nickname: store.nickname || "",
      cnpj: store.cnpj || "", state_registration: store.state_registration || "",
      zip_code: store.zip_code || "", street: store.street || "",
      number: store.number || "", complement: store.complement || "",
      neighborhood: store.neighborhood || "", city: store.city || "",
      state: store.state || "", phone: store.phone || "",
      manager_name: store.manager_name || "", store_model: store.store_model || "",
      country: store.country || "", store_code: store.store_code || "",
      email: (store as any).email || "", observations: (store as any).observations || "",
    });
    setEditStoreDialogOpen(true);
  }, []);

  const handleEditStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStoreId) return;
    await updateClientStore.mutateAsync({ id: editStoreId, ...editStoreForm });
    setEditStoreDialogOpen(false);
    setEditStoreId(null);
  };

  // ─── Active section (null = home) ──────────────────────
  const searchParams = new URLSearchParams(location.search);
  const sectionFromUrl = searchParams.get("section");
  const [activeSection, setActiveSectionState] = useState<string | null>(locationState?.initialSection || sectionFromUrl || null);
  const [pieceSearch, setPieceSearch] = useState("");

  // Sync section from URL search params (for sidebar navigation)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlSection = params.get("section");
    if (urlSection && urlSection !== activeSection) {
      setActiveSectionState(urlSection);
    } else if (!urlSection && activeSection && !locationState?.initialSection) {
      // Only clear if navigated without section param and no initial section
    }
  }, [location.search]);

  const setActiveSection = useCallback((section: string | null) => {
    setActiveSectionState(section);
    // Update URL without full navigation
    const params = new URLSearchParams(location.search);
    if (section) {
      params.set("section", section);
    } else {
      params.delete("section");
    }
    const newUrl = `${location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState(null, "", newUrl);
  }, [location.pathname, location.search]);

  // ─── Matrix editing ────────────────────────────────────
  const [editingCell, setEditingCell] = useState<{ storeId: string; pieceId: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const editingInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const editingCellRef = useRef<{ storeId: string; pieceId: string } | null>(null);
  const skipBlurSaveRef = useRef(false);
  const [importMatrixDialogOpen, setImportMatrixDialogOpen] = useState(false);
  const [pieceFilters, setPieceFilters] = useState<PieceFilters>({ ...EMPTY_FILTERS });
  const [storeFilters, setStoreFilters] = useState<StoreFilters>({ ...EMPTY_STORE_FILTERS });
  const [filterSidebarCollapsed, setFilterSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('produzai_matrix_filters_open');
      return saved === null ? true : saved === 'collapsed';
    } catch { return true; }
  });
  const [quickEditActive, setQuickEditActive] = useState(false);
  const [matrixCustomExportOpen, setMatrixCustomExportOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);

  const handleFilterSidebarCollapsedChange = useCallback((collapsed: boolean) => {
    setFilterSidebarCollapsed(collapsed);
    try { localStorage.setItem('produzai_matrix_filters_open', collapsed ? 'collapsed' : 'expanded'); } catch {}
  }, []);

  // ─── Derived data ──────────────────────────────────────
  const qtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    storePieces.forEach((sp) => { map[`${sp.store_id}-${sp.piece_id}`] = sp.quantity; });
    return map;
  }, [storePieces]);

  const totalPieces = useMemo(() => storePieces.reduce((s, sp) => s + sp.quantity, 0), [storePieces]);

  // Unique cities, states, store_categories from pieces
  const uniqueCities = useMemo(() => [...new Set(stores.map((s) => s.city).filter(Boolean))].sort() as string[], [stores]);
  const uniqueStates = useMemo(() => [...new Set(stores.map((s) => s.state?.trim()).filter(Boolean))].sort() as string[], [stores]);
  const uniqueStoreCategories = useMemo(() => [...new Set(pieces.map((p) => p.store_category).filter(Boolean))].sort() as string[], [pieces]);

  const filteredStores = useMemo(() => {
    return stores.filter((s) => {
      const matchesSearch = storeSearch === "" ||
        s.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
        s.nickname?.toLowerCase().includes(storeSearch.toLowerCase());
      const matchesCity = cityFilter === "__all__" || s.city === cityFilter;
      const matchesState = stateFilter === "__all__" || s.state?.trim() === stateFilter;
      const matchesStoreCategory = storeCategoryFilter === "__all__" || true; // applied on matrix level

      // Apply sidebar store filters
      const sf = storeFilters;
      if (sf.city.size > 0 && (!s.city || !sf.city.has(s.city))) return false;
      if (sf.state.size > 0 && (!s.state || !sf.state.has(s.state.trim()))) return false;
      if (sf.store_model.size > 0 && (!s.store_model || !sf.store_model.has(s.store_model))) return false;
      if (sf.custom_field_1.size > 0 && (!s.custom_field_1 || !sf.custom_field_1.has(s.custom_field_1))) return false;
      if (sf.custom_field_2.size > 0 && (!s.custom_field_2 || !sf.custom_field_2.has(s.custom_field_2))) return false;
      if (sf.custom_field_3.size > 0 && (!s.custom_field_3 || !sf.custom_field_3.has(s.custom_field_3))) return false;
      if (sf.custom_field_4.size > 0 && (!s.custom_field_4 || !sf.custom_field_4.has(s.custom_field_4))) return false;
      if (sf.custom_field_5.size > 0 && (!s.custom_field_5 || !sf.custom_field_5.has(s.custom_field_5))) return false;

      return matchesSearch && matchesCity && matchesState && matchesStoreCategory;
    }).sort((a, b) => {
      const stateComp = (a.state || "").localeCompare(b.state || "");
      if (stateComp !== 0) return stateComp;
      return a.name.localeCompare(b.name);
    });
  }, [stores, storeSearch, cityFilter, stateFilter, storeCategoryFilter, storeFilters]);

  const allEnabled = useMemo(() => filteredStores.every(s => isStoreEnabled(s.id)), [filteredStores, storeEnabledMap]);
  const activeFilteredStores = useMemo(() => filteredStores.filter(s => isStoreEnabled(s.id)), [filteredStores, storeEnabledMap]);

  // ─── Filtered pieces: exclude kit_only from normal views ─
  const visiblePieces = useMemo(() => pieces.filter(p => !p.kit_only), [pieces]);
  const kitOnlyPieces = useMemo(() => pieces.filter(p => p.kit_only), [pieces]);

  // For each store, compute total pieces assigned in this campaign
  const storeStats = useMemo(() => {
    const stats: Record<string, { totalQty: number; pieceCount: number }> = {};
    stores.forEach((s) => {
      let totalQty = 0;
      let pieceCount = 0;
      pieces.forEach((p) => {
        const qty = qtyMap[`${s.id}-${p.id}`] || 0;
        totalQty += qty;
        if (qty > 0) pieceCount++;
      });
      stats[s.id] = { totalQty, pieceCount };
    });
    return stats;
  }, [stores, pieces, qtyMap]);

  // ─── Handlers ──────────────────────────────────────────
  const nextPieceCode = useMemo(() => {
    const campaignPrefix = (campaign?.name || "XXX").replace(/[^a-zA-Z0-9]/g, "").substring(0, 3).toUpperCase().padEnd(3, "X");
    const usedNumbers = new Set<number>();
    pieces.forEach((p) => {
      const codeStr = String(p.code);
      // Extract number portion (code is stored as number, prefix is visual)
      usedNumbers.add(p.code);
    });
    // Find lowest available number starting from 1
    let seq = 1;
    while (usedNumbers.has(seq)) seq++;
    return { prefix: campaignPrefix, seq, full: `${campaignPrefix}${String(seq).padStart(4, "0")}` };
  }, [pieces, campaign]);

  const handleAddPiece = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId) return;
    const size = [pieceForm.width, pieceForm.height, pieceForm.length].filter(Boolean).join(" x ");
    const code = pieceForm.code ? parseInt(pieceForm.code) : nextPieceCode.seq;
    if (pieceForm.store_category) {
      localStorage.setItem("last_store_category", pieceForm.store_category);
    }
    const maxOrder = pieces.length > 0 ? Math.max(...pieces.map(p => p.display_order)) : 0;
    await addPiece.mutateAsync({
      campaign_id: campaignId,
      code,
      category: pieceForm.category,
      name: pieceForm.name,
      size,
      store_category: pieceForm.store_category || undefined,
      sub_location: pieceForm.sub_location || undefined,
      specification: pieceForm.specification,
      installation_instructions: pieceForm.installation_instructions,
      kit_only: pieceForm.kit_only,
      is_mockup: pieceForm.is_mockup,
      display_order: maxOrder + 1,
      image_url: pieceForm.image_url || undefined,
    });
    setPieceForm({
      code: "", category: "", sub_location: "", name: "",
      width: "", length: "", height: "",
      store_category: pieceForm.store_category,
      specification: "Vide Book/Manual",
      installation_instructions: "Sem informações específicas",
      kit_only: false,
      is_mockup: false,
      image_url: "",
    });
    setPieceDialogOpen(false);
  };

  const handleOpenEditPiece = (piece: CampaignPiece) => {
    const sizeParts = piece.size?.split(" x ") || [];
    setEditPieceForm({
      id: piece.id,
      code: String(piece.code),
      category: piece.category,
      name: piece.name,
      width: sizeParts[0] || "",
      height: sizeParts[1] || "",
      length: sizeParts[2] || "",
      store_category: piece.store_category || "",
      specification: piece.specification || "Vide Book/Manual",
      installation_instructions: piece.installation_instructions || "Sem informações específicas",
      kit_only: piece.kit_only || false,
      is_mockup: piece.is_mockup || false,
      image_url: piece.image_url || "",
    });
    setEditPieceDialogOpen(true);
  };

  const handleEditPiece = async (e: React.FormEvent) => {
    e.preventDefault();
    const size = [editPieceForm.width, editPieceForm.height, editPieceForm.length].filter(Boolean).join(" x ");
    const code = editPieceForm.code ? parseInt(editPieceForm.code) : nextPieceCode.seq;
    await updatePiece.mutateAsync({
      id: editPieceForm.id,
      code,
      category: editPieceForm.category,
      name: editPieceForm.name,
      size,
      store_category: editPieceForm.store_category || null,
      specification: editPieceForm.specification,
      installation_instructions: editPieceForm.installation_instructions,
      kit_only: editPieceForm.kit_only,
      is_mockup: editPieceForm.is_mockup,
      image_url: editPieceForm.image_url || null,
    });
    setEditPieceDialogOpen(false);
  };

  const handleReviewPieceCodes = async () => {
    const piecesWithoutCode = pieces.filter((p) => !p.code || p.code === 0);
    if (piecesWithoutCode.length === 0) {
      toast.info("Todas as peças já possuem código.");
      return;
    }
    const usedNumbers = new Set<number>(pieces.filter((p) => p.code && p.code > 0).map((p) => p.code));
    let count = 0;
    for (const piece of piecesWithoutCode) {
      let seq = 1;
      while (usedNumbers.has(seq)) seq++;
      usedNumbers.add(seq);
      await updatePiece.mutateAsync({ id: piece.id, code: seq });
      count++;
    }
    toast.success(`${count} peça(s) receberam código automaticamente.`);
  };

  const focusEditingCell = useCallback((cell: { storeId: string; pieceId: string } | null) => {
    if (!cell) return;
    const el = editingInputRefs.current[`${cell.storeId}-${cell.pieceId}`];
    if (el && document.activeElement !== el) {
      el.focus();
      el.select();
    }
  }, []);

  useEffect(() => {
    editingCellRef.current = editingCell;
  }, [editingCell]);

  useEffect(() => {
    if (!editingCell) return;
    const rafId = requestAnimationFrame(() => focusEditingCell(editingCell));
    return () => cancelAnimationFrame(rafId);
  }, [editingCell, qtyMap, focusEditingCell]);

  const getCellQty = useCallback((storeId: string, pieceId: string) => {
    if (pieceId.startsWith("kit-")) {
      const kitId = pieceId.replace("kit-", "");
      const piecesInKit = kitPieces.filter((kp) => kp.kit_id === kitId);
      if (piecesInKit.length === 0) return 0;
      return Math.min(
        ...piecesInKit.map((kp) => {
          const baseQty = qtyMap[`${storeId}-${kp.piece_id}`] || 0;
          return Math.floor(baseQty / (kp.quantity || 1));
        })
      );
    }
    return qtyMap[`${storeId}-${pieceId}`] || 0;
  }, [qtyMap, kitPieces]);

  const handleCellClick = (storeId: string, pieceId: string) => {
    if (!canEditCampaign) return;
    setEditingCell({ storeId, pieceId });
    setEditValue(String(getCellQty(storeId, pieceId)));
  };

  const handleCellSave = useCallback((options?: { navigateTo?: { storeId: string; pieceId: string }; keepEditing?: boolean }) => {
    if (!editingCell || !campaignId) return;

    const currentCell = editingCell;
    const qty = Math.max(0, parseInt(editValue) || 0);

    updateStorePiece.mutate({
      campaignId,
      storeId: currentCell.storeId,
      pieceId: currentCell.pieceId,
      quantity: qty,
    });

    const targetCell = options?.navigateTo ?? (options?.keepEditing ? currentCell : null);

    if (targetCell) {
      setEditingCell(targetCell);
      const targetIsCurrent = targetCell.storeId === currentCell.storeId && targetCell.pieceId === currentCell.pieceId;
      setEditValue(String(targetIsCurrent ? qty : getCellQty(targetCell.storeId, targetCell.pieceId)));
      return;
    }

    setEditingCell(null);
  }, [editingCell, campaignId, editValue, updateStorePiece, getCellQty]);

  const handlePieceBlur = () => {
    if (skipBlurSaveRef.current) {
      skipBlurSaveRef.current = false;
      return;
    }
    handleCellSave({ keepEditing: true });
  };


  const handleDistributePiece = async (piece: CampaignPiece) => {
    if (!campaignId) return;
    const autoStores = stores.filter(s => s.auto_distribute && isStoreEnabled(s.id));
    const targetStores = piece.store_category === "Todas" || !piece.store_category
      ? autoStores
      : autoStores.filter(s => s.store_model === piece.store_category);
    
    // Check if piece is already distributed (any target store has it)
    const assignedStores = targetStores.filter(s => qtyMap[`${s.id}-${piece.id}`]);
    const isDistributed = assignedStores.length > 0;

    if (isDistributed) {
      // Remove from all target stores
      for (const store of assignedStores) {
        await updateStorePiece.mutateAsync({
          campaignId, storeId: store.id, pieceId: piece.id, quantity: 0,
        });
      }
      toast.success(`Peça removida de ${assignedStores.length} loja(s)!`);
    } else {
      // Assign to all target stores
      for (const store of targetStores) {
        await updateStorePiece.mutateAsync({
          campaignId, storeId: store.id, pieceId: piece.id, quantity: 1,
        });
      }
      toast.success(`Peça distribuída para ${targetStores.length} loja(s)!`);
    }
  };

  // ─── Reorder pieces & kits (drag & drop) ───────────────
  const handleReorderUnified = useCallback(async (reorderedRows: UnifiedRow[]) => {
    for (let i = 0; i < reorderedRows.length; i++) {
      const row = reorderedRows[i];
      const newOrder = i + 1;
      if (row.type === "piece") {
        if (row.data.display_order !== newOrder) {
          await supabase.from("campaign_pieces").update({ display_order: newOrder }).eq("id", row.data.id);
        }
      } else {
        if (row.data.display_order !== newOrder) {
          await supabase.from("campaign_kits").update({ display_order: newOrder }).eq("id", row.data.id);
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: ["campaign_pieces"] });
    queryClient.invalidateQueries({ queryKey: ["campaign_kits"] });
  }, [queryClient]);

  // ─── Recodificar (rewrite codes sequentially) ─────────
  const handleRecodificar = async () => {
    const allItems: { type: "piece" | "kit"; id: string; display_order: number }[] = [
      ...visiblePieces.map(p => ({ type: "piece" as const, id: p.id, display_order: p.display_order })),
      ...kits.map(k => ({ type: "kit" as const, id: k.id, display_order: k.display_order })),
    ].sort((a, b) => a.display_order - b.display_order);

    let code = 1;
    let count = 0;
    for (const item of allItems) {
      if (item.type === "piece") {
        const piece = visiblePieces.find(p => p.id === item.id);
        if (piece && piece.code !== code) {
          await supabase.from("campaign_pieces").update({ code }).eq("id", item.id);
          count++;
        }
      } else {
        const kit = kits.find(k => k.id === item.id);
        if (kit && kit.code !== code) {
          await supabase.from("campaign_kits").update({ code }).eq("id", item.id);
          count++;
        }
        // Recodificar as peças do kit sequencialmente a partir do código do kit + 1
        const kitPiecesForKit = kitPieces.filter(kp => kp.kit_id === item.id);
        let kitPieceCode = code + 1;
        for (const kp of kitPiecesForKit) {
          const piece = kitOnlyPieces.find(p => p.id === kp.piece_id);
          if (piece && piece.code !== kitPieceCode) {
            await supabase.from("campaign_pieces").update({ code: kitPieceCode }).eq("id", kp.piece_id);
            count++;
          }
          kitPieceCode++;
        }
        // Avançar o código para depois das peças do kit
        code = kitPieceCode;
        continue;
      }
      code++;
    }
    queryClient.invalidateQueries({ queryKey: ["campaign_pieces"] });
    queryClient.invalidateQueries({ queryKey: ["campaign_kits"] });
    if (count > 0) {
      toast.success(`${count} código(s) atualizado(s) sequencialmente!`);
    } else {
      toast.info("Os códigos já estão em ordem sequencial.");
    }
  };

  // ─── Piece form fields (shared between add/edit) ──────
  const renderPieceFormFields = (
    form: typeof pieceForm,
    setForm: React.Dispatch<React.SetStateAction<typeof pieceForm>>,
  ) => (
    <>
      <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
        <div>
          <label className="text-xs font-medium text-foreground">Peça para Kit</label>
          <p className="text-[10px] text-muted-foreground">Ative para usar esta peça exclusivamente em kits</p>
        </div>
        <Switch checked={form.kit_only} onCheckedChange={(checked) => setForm((f) => ({ ...f, kit_only: checked }))} />
      </div>
      <div className="flex items-center justify-between p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
        <div>
          <label className="text-xs font-medium text-foreground">Mockup</label>
          <p className="text-[10px] text-muted-foreground">Marcar esta peça como item de mockup</p>
        </div>
        <Switch checked={form.is_mockup} onCheckedChange={(checked) => setForm((f) => ({ ...f, is_mockup: checked }))} />
      </div>
      {/* Image upload */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Foto da peça</label>
        {form.image_url ? (
          <div className="relative">
            <img src={form.image_url} alt="Preview" className="w-full h-36 object-contain rounded-lg border border-border bg-muted/30" />
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="absolute top-2 right-2 h-7 px-2"
              onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
            >
              <X className="w-3 h-3 mr-1" /> Remover
            </Button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={pieceImageUploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPieceImageUploading(true);
                try {
                  const { compressImage } = await import("@/lib/compressImage");
                  const compressed = await compressImage(file, 800, 0.6);
                  const path = `campaign-piece-new-${Date.now()}.jpg`;
                  const { error } = await supabase.storage.from("piece-images").upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
                  if (error) throw error;
                  const { data: urlData } = supabase.storage.from("piece-images").getPublicUrl(path);
                  setForm((f) => ({ ...f, image_url: urlData.publicUrl }));
                  toast.success("Imagem enviada com sucesso");
                } catch (err: any) {
                  toast.error("Erro ao enviar imagem: " + err.message);
                } finally {
                  setPieceImageUploading(false);
                }
              }}
            />
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/20">
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {pieceImageUploading ? "Comprimindo e enviando..." : "Clique ou arraste (será comprimida)"}
              </span>
            </div>
          </div>
        )}
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("common.code")}</label>
        <Input type="number" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder={nextPieceCode.full} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("pieces.locationInStore")} *</label>
        {pieceLocations.length > 0 ? (
          <Select value={form.category} onValueChange={(val) => setForm((f) => ({ ...f, category: val }))}>
            <SelectTrigger>
              <SelectValue placeholder={t("pieces.selectLocation")} />
            </SelectTrigger>
            <SelectContent>
              {pieceLocations.map((loc) => <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} required />
        )}
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("common.name")} *</label>
        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
      </div>
      {clientId && campaignId && (
        <ImportSpecFromCampaign
          clientId={clientId}
          currentCampaignId={campaignId}
          onImport={({ specification, size }) => {
            const sizeParts = size.split(" x ");
            setForm((f) => ({
              ...f,
              specification,
              width: sizeParts[0] || f.width,
              height: sizeParts[1] || f.height,
              length: sizeParts[2] || f.length,
            }));
          }}
        />
      )}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("pieces.measures")}</label>
        <div className="grid grid-cols-3 gap-2">
           <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">{t("pieces.width")}</label>
            <Input value={form.width} onChange={(e) => setForm((f) => ({ ...f, width: e.target.value }))} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">{t("pieces.height")}</label>
            <Input value={form.height} onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">{t("pieces.length")}</label>
            <Input value={form.length} onChange={(e) => setForm((f) => ({ ...f, length: e.target.value }))} />
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("pieces.storeModelLabel")}</label>
        <Select value={form.store_category || "Todas"} onValueChange={(val) => setForm((f) => ({ ...f, store_category: val }))}>
          <SelectTrigger>
            <SelectValue placeholder={t("stores.selectModel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">{t("common.allFeminine")}</SelectItem>
            {clientStoreModels.map((m) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("pieces.specification")}</label>
        <Input value={form.specification} onChange={(e) => setForm((f) => ({ ...f, specification: e.target.value }))} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("pieces.installationInstructions")}</label>
        <Input value={form.installation_instructions} onChange={(e) => setForm((f) => ({ ...f, installation_instructions: e.target.value }))} />
      </div>
    </>
  );

  // ─── Store filters bar ─────────────────────────────────
  const renderStoreFilters = () => (
    <div className="space-y-2 mb-4">
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("stores.searchStore")} value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} className="pl-10" />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {uniqueStates.length > 0 && (
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[100px] sm:w-[140px] text-xs">
              <SelectValue placeholder={t("stores.state")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("common.all")}</SelectItem>
              {uniqueStates.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {uniqueCities.length > 0 && (
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-[110px] sm:w-[180px] text-xs">
              <SelectValue placeholder={t("stores.city")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("common.allFeminine")}</SelectItem>
              {uniqueCities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {uniqueStoreCategories.length > 0 && (
          <Select value={storeCategoryFilter} onValueChange={setStoreCategoryFilter}>
            <SelectTrigger className="w-[110px] sm:w-[180px] text-xs">
              <SelectValue placeholder="Cat." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("common.allFeminine")}</SelectItem>
              {uniqueStoreCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-muted-foreground">{filteredStores.length} {t("stores.storeCount")}</span>
      </div>
    </div>
  );

  // ─── Filtered pieces for matrix (by store_category + piece filters) ───
  const matrixPieces = useMemo(() => {
    let filtered = storeCategoryFilter === "__all__"
      ? visiblePieces
      : visiblePieces.filter((p) => p.store_category === storeCategoryFilter);

    // Apply piece sidebar filters
    const f = pieceFilters;
    if (f.category.size > 0) filtered = filtered.filter((p) => f.category.has(p.category));
    if (f.name.size > 0) filtered = filtered.filter((p) => f.name.has(p.name));
    if (f.store_category.size > 0) filtered = filtered.filter((p) => p.store_category && f.store_category.has(p.store_category));
    if (f.size.size > 0) filtered = filtered.filter((p) => f.size.has(p.size));
    if (f.specification.size > 0) filtered = filtered.filter((p) => f.specification.has(p.specification));
    if (f.installation_instructions.size > 0) filtered = filtered.filter((p) => f.installation_instructions.has(p.installation_instructions));
    if (f.kit_only.size > 0) {
      filtered = filtered.filter((p) => {
        const val = p.kit_only ? "Sim" : "Não";
        return f.kit_only.has(val);
      });
    }
    if (f.is_mockup.size > 0) {
      filtered = filtered.filter((p) => {
        const val = p.is_mockup ? "Sim" : "Não";
        return f.is_mockup.has(val);
      });
    }

    return filtered;
  }, [visiblePieces, storeCategoryFilter, pieceFilters]);

  // Kits appear as virtual columns in the matrix
  const matrixKits = kits;

  // Unified matrix columns sorted by display_order (same as pieces table)
  type MatrixCol = { type: "piece"; data: CampaignPiece } | { type: "kit"; data: CampaignKit };
  const matrixColumns: MatrixCol[] = [
    ...matrixPieces.map(p => ({ type: "piece" as const, data: p, display_order: p.display_order })),
    ...matrixKits.map(k => ({ type: "kit" as const, data: k, display_order: k.display_order })),
  ].sort((a, b) => a.display_order - b.display_order);

  const navigateMatrixCell = useCallback((dir: "up" | "down" | "left" | "right") => {
    if (!editingCell) return null;
    const storeIdx = activeFilteredStores.findIndex((s) => s.id === editingCell.storeId);
    const colIds = matrixColumns.map((c) => c.type === "piece" ? c.data.id : `kit-${c.data.id}`);
    const colIdx = colIds.indexOf(editingCell.pieceId);
    if (storeIdx === -1 || colIdx === -1) return null;

    let newStoreIdx = storeIdx;
    let newColIdx = colIdx;
    if (dir === "up") newStoreIdx = Math.max(0, storeIdx - 1);
    else if (dir === "down") newStoreIdx = Math.min(activeFilteredStores.length - 1, storeIdx + 1);
    else if (dir === "left") newColIdx = Math.max(0, colIdx - 1);
    else if (dir === "right") newColIdx = Math.min(colIds.length - 1, colIdx + 1);

    const newStore = activeFilteredStores[newStoreIdx];
    const newPieceId = colIds[newColIdx];
    if (newStore && newPieceId) {
      return { storeId: newStore.id, pieceId: newPieceId };
    }
    return null;
  }, [editingCell, activeFilteredStores, matrixColumns]);


  if (loadingCampaign) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t("campaigns.notFound")}</p>
      </div>
    );
  }

  return (
    <AppLayout
      breadcrumbs={(() => {
        const SECTION_LABELS: Record<string, string> = {
          stores: t("modules.stores"), matrix: t("modules.matrix"), pieces: t("modules.pieces"),
          occurrences: t("modules.occurrences"), scheduling: t("modules.scheduling"),
          installations: t("modules.installations"), budgets: t("modules.budgets"),
        };
        const crumbs = [
          { label: agency?.name || "Agência", href: isLimitedMode ? undefined : "/" },
          { label: client?.name || "Cliente", href: isLimitedMode ? undefined : `/agency/${agencyId}/clients/${clientId}` },
          { label: campaign.name, href: undefined as string | undefined },
        ];
        if (activeSection) {
          crumbs[crumbs.length - 1].href = isLimitedMode ? undefined : `/agency/${agencyId}/clients/${clientId}/campaigns/${campaignId}`;
          crumbs.push({ label: SECTION_LABELS[activeSection] || activeSection, href: undefined });
        }
        return crumbs;
      })()}
    >
        {/* ─── HOME VIEW: Material de Apoio + Nav Buttons ─── */}
        {!activeSection && !isLimitedMode && (
          <>
            {/* Inline KPI stats */}
            <div className="flex items-baseline gap-3 mb-4 flex-wrap">
              <button onClick={() => setActiveSection("stores")} className="inline-flex items-baseline gap-1.5 group cursor-pointer">
                <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{stores.length}</span>
                <span className="text-[13px] group-hover:underline" style={{ color: "var(--text-muted)" }}>{t("stores.registered")}</span>
              </button>
              <span style={{ color: "var(--border-default)", fontSize: "16px" }}>·</span>
              <button onClick={() => setActiveSection("pieces")} className="inline-flex items-baseline gap-1.5 group cursor-pointer">
                <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{visiblePieces.length + kits.length}</span>
                <span className="text-[13px] group-hover:underline" style={{ color: "var(--text-muted)" }}>{t("pieces.registered")}</span>
              </button>
            </div>

            <SupportMaterialsSection campaignId={campaignId!} canEdit={canEditCampaign} />

            {/* Navigation Buttons */}
            <ModuleGrid
              items={[
                { key: "stores", label: t("modules.stores"), icon: Store, visible: canViewStores || canViewCampaignStores, color: "#6B4F2E" },
                { key: "matrix", label: t("modules.matrix"), icon: Grid3X3, visible: canViewCampaignStores, color: "#8C6F4E" },
                { key: "pieces", label: t("modules.pieces"), icon: LayoutList, visible: canViewPieces, color: "#A07850" },
                { key: "occurrences", label: t("modules.occurrences"), icon: AlertTriangle, visible: canViewOccurrences, color: "#7A3B2E" },
                { key: "scheduling", label: t("modules.scheduling"), icon: CalendarDays, visible: canViewSchedules, color: "#5C6B3F" },
                { key: "installations", label: t("modules.installations"), icon: Camera, visible: canViewInstallations, color: "#7B5E3A" },
                { key: "budgets", label: t("modules.budgets"), icon: DollarSign, visible: isAdmin, color: "#4A5568" },
                { key: "chat", label: t("modules.chat"), icon: MessageSquare, visible: canViewCampaigns, color: "#5A4A3A" },
              ]}
              onSelect={(key) => setActiveSection(key)}
            />
          </>
        )}

        {/* ─── SECTION VIEW: Show active section with Home button ─── */}
        {activeSection && (
          <>

          {/* ─── TAB: LOJAS ─── */}
          {activeSection === "stores" && (<>
            {/* View mode toggle */}
            <div className="flex items-center gap-2 mb-3">
              <Button
                size="sm"
                variant={storesViewMode === "table" ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setStoresViewMode("table")}
              >
                <Store className="w-3.5 h-3.5 mr-1" /> {t("modules.stores")}
              </Button>
              <Button
                size="sm"
                variant={storesViewMode === "contacts" ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setStoresViewMode("contacts")}
              >
                <Users className="w-3.5 h-3.5 mr-1" /> {t("stores.contacts")}
              </Button>
            </div>

            {storesViewMode === "contacts" ? (
              <StoreContactsCardView
                clientId={clientId}
                stores={stores}
                agencyName={agency?.name || ""}
                clientName={client?.name || ""}
                canEdit={canEditStores}
                onEditStore={handleOpenEditStore}
                countryCode={(client as any)?.country_code}
              />
            ) : (
            <>
            {renderStoreFilters()}

            {filteredStores.length === 0 ? (
              <div className="text-center py-16">
                <Store className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">{t("stores.noStoreFound")}</p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-x-auto -mx-1 sm:mx-0">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("matrix.store")}</TableHead>
                      <TableHead>{t("stores.cityState")}</TableHead>
                      <TableHead>{t("common.model")}</TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{t("common.active")}</span>
                          {canEditCampaignStores && (
                            <Switch
                              checked={allEnabled}
                              onCheckedChange={(checked) => {
                                if (!campaignId) return;
                                bulkUpsertStoreStatus.mutate({
                                  campaignId,
                                  storeIds: filteredStores.map(s => s.id),
                                  enabled: checked,
                                });
                              }}
                              className="scale-75"
                            />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="text-center">{t("common.auto")}</TableHead>
                      <TableHead className="text-center">{t("stores.scheduling")}</TableHead>
                      <TableHead className="text-center">{t("modules.pieces")}</TableHead>
                      <TableHead className="text-center">{t("stores.totalQty")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStores.map((store) => {
                      const stats = storeStats[store.id] || { totalQty: 0, pieceCount: 0 };
                      const enabled = isStoreEnabled(store.id);
                      return (
                        <TableRow key={store.id} className={!enabled ? "opacity-50" : ""}>
                          <TableCell>
                            <div>
                              <button
                                className={`font-medium text-left transition-colors ${enabled ? "text-foreground hover:text-primary hover:underline" : "text-muted-foreground cursor-not-allowed"}`}
                                onClick={() => enabled && setSelectedStoreId(store.id)}
                                disabled={!enabled}
                              >
                                {store.name}
                              </button>
                              {store.nickname && store.nickname !== store.name && (
                                <span className="text-xs text-muted-foreground ml-1.5">({store.nickname})</span>
                              )}
                            </div>
                            {store.cnpj && <p className="text-[10px] text-muted-foreground mt-0.5">CNPJ: {store.cnpj}</p>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              {[store.city, store.state].filter(Boolean).join(" / ") || "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">{store.store_model || "—"}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={enabled}
                              onCheckedChange={(checked) => {
                                if (!campaignId) return;
                                if (!checked && stats.pieceCount > 0) {
                                  // Has pieces — ask for confirmation
                                  setDeactivateStoreId(store.id);
                                } else {
                                  upsertStoreStatus.mutate({ campaignId, storeId: store.id, enabled: checked });
                                }
                              }}
                              disabled={!canEditCampaignStores}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={store.auto_distribute}
                              onCheckedChange={(checked) => {
                                updateClientStore.mutate({ id: store.id, auto_distribute: checked });
                              }}
                              disabled={!canEditCampaignStores}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={store.show_in_scheduling}
                              onCheckedChange={(checked) => {
                                updateClientStore.mutate({ id: store.id, show_in_scheduling: checked });
                              }}
                              disabled={!canEditCampaignStores}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`text-sm font-medium ${stats.pieceCount > 0 ? "text-primary" : "text-muted-foreground"}`}>
                              {stats.pieceCount} / {visiblePieces.length + kits.length}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`text-sm font-semibold ${stats.totalQty > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                              {stats.totalQty}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            </>
            )}

            {/* Edit Store Dialog */}
            <Dialog open={editStoreDialogOpen} onOpenChange={setEditStoreDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{t("stores.editStore")}</DialogTitle></DialogHeader>
                <form onSubmit={handleEditStoreSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("common.name")} *</label>
                      <Input value={editStoreForm.name} onChange={(e) => setEditStoreForm(f => ({ ...f, name: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("stores.nickname")}</label>
                      <Input value={editStoreForm.nickname} onChange={(e) => setEditStoreForm(f => ({ ...f, nickname: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("stores.cnpj")}</label>
                      <Input value={editStoreForm.cnpj} onChange={(e) => setEditStoreForm(f => ({ ...f, cnpj: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("stores.stateRegistration")}</label>
                      <Input value={editStoreForm.state_registration} onChange={(e) => setEditStoreForm(f => ({ ...f, state_registration: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("stores.zipCode")}</label>
                      <Input value={editStoreForm.zip_code} onChange={(e) => setEditStoreForm(f => ({ ...f, zip_code: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("stores.street")}</label>
                      <Input value={editStoreForm.street} onChange={(e) => setEditStoreForm(f => ({ ...f, street: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("stores.number")}</label>
                      <Input value={editStoreForm.number} onChange={(e) => setEditStoreForm(f => ({ ...f, number: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("stores.complement")}</label>
                      <Input value={editStoreForm.complement} onChange={(e) => setEditStoreForm(f => ({ ...f, complement: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("stores.neighborhood")}</label>
                      <Input value={editStoreForm.neighborhood} onChange={(e) => setEditStoreForm(f => ({ ...f, neighborhood: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("stores.city")}</label>
                      <Input value={editStoreForm.city} onChange={(e) => setEditStoreForm(f => ({ ...f, city: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("stores.state")}</label>
                      <Input value={editStoreForm.state} onChange={(e) => setEditStoreForm(f => ({ ...f, state: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("stores.country")}</label>
                      <Input value={editStoreForm.country} onChange={(e) => setEditStoreForm(f => ({ ...f, country: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("common.phone")}</label>
                      <Input value={editStoreForm.phone} onChange={(e) => setEditStoreForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("common.email")}</label>
                      <Input value={editStoreForm.email} onChange={(e) => setEditStoreForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("common.contact")}</label>
                      <Input value={editStoreForm.manager_name} onChange={(e) => setEditStoreForm(f => ({ ...f, manager_name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("pieces.storeModelLabel")}</label>
                      <Select value={editStoreForm.store_model || ""} onValueChange={(val) => setEditStoreForm(f => ({ ...f, store_model: val === "__none__" ? "" : val }))}>
                        <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t("common.none")}</SelectItem>
                          {clientStoreModels.map((m) => (
                            <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("stores.storeCode")}</label>
                      <Input value={editStoreForm.store_code} onChange={(e) => setEditStoreForm(f => ({ ...f, store_code: e.target.value }))} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("common.observations")}</label>
                      <textarea
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={editStoreForm.observations}
                        onChange={(e) => setEditStoreForm(f => ({ ...f, observations: e.target.value }))}
                      />
                    </div>
                  </div>
                  <StoreContactsSection storeId={editStoreId || undefined} clientId={clientId} canEdit={canEditStores} storeName={editStoreForm.nickname || editStoreForm.name} countryCode={(client as any)?.country_code} />
                  <Button type="submit" className="w-full" disabled={updateClientStore.isPending}>{t("common.saveChanges")}</Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* ─── Store Detail Panel ─── */}
            {selectedStoreId && (() => {
              const selectedStore = stores.find(s => s.id === selectedStoreId);
              if (!selectedStore) return null;
              // Filter pieces by store model compatibility: same model + "Todas"
              const storeModel = selectedStore.store_model;
              const compatiblePieces = visiblePieces.filter(p => {
                if (!p.store_category || p.store_category === "Todas") return true;
                if (!storeModel) return true;
                return p.store_category === storeModel;
              });
              const storePiecesForStore = compatiblePieces.map(p => ({
                ...p,
                quantity: qtyMap[`${selectedStoreId}-${p.id}`] || 0,
              }));
              const assignedPieces = storePiecesForStore.filter(p => p.quantity > 0);
              const unassignedPieces = storePiecesForStore.filter(p => p.quantity === 0);
              const totalQty = assignedPieces.reduce((s, p) => s + p.quantity, 0);

              const CARD_COLORS = [
                "from-primary/15 to-primary/5 border-primary/25",
                "from-secondary/15 to-secondary/5 border-secondary/25",
                "from-accent/15 to-accent/5 border-accent/25",
                "from-info/15 to-info/5 border-info/25",
              ];

              return (
                <div className="mt-6 border border-border rounded-xl bg-card overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-secondary/10 to-primary/10 px-3 sm:px-5 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg gradient-secondary flex items-center justify-center shadow-glow-secondary flex-shrink-0">
                        <Store className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-foreground text-base sm:text-lg truncate">{selectedStore.name}</h3>
                        <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">
                            {[selectedStore.city, selectedStore.state].filter(Boolean).join(" / ") || t("stores.noLocation")}
                            {selectedStore.store_model && ` · ${selectedStore.store_model}`}
                            {" · "}{assignedPieces.length} {t("pieces.pieceCount")} · {totalQty} un.
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                      {canEditCampaignStores && (
                        <Button
                          size="sm"
                          className="text-xs gap-1 gradient-accent text-white border-0"
                          onClick={() => setAddPieceToStoreOpen(true)}
                        >
                          <Plus className="w-3.5 h-3.5" /> {t("pieces.includePiece")}
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedStoreId(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Piece Cards */}
                  <div className="p-4">
                    {assignedPieces.length === 0 ? (
                      <div className="text-center py-10">
                        <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">{t("pieces.noPieceAssigned")}</p>
                        {canEditCampaignStores && (
                          <Button size="sm" variant="outline" className="mt-3 text-xs gap-1" onClick={() => setAddPieceToStoreOpen(true)}>
                            <Plus className="w-3.5 h-3.5" /> {t("pieces.includeFirst")}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {assignedPieces.map((p, idx) => {
                          const colorClass = CARD_COLORS[idx % CARD_COLORS.length];
                          const isEditingQty = storeEditingPieceId === p.id;
                          return (
                            <div key={p.id} className={`bg-gradient-to-br ${colorClass} border rounded-xl p-4 transition-all hover:shadow-md`}>
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <PieceThumbnail imageUrl={p.image_url} name={p.name} size="sm" />
                                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                      #{p.code}
                                    </span>
                                    {p.store_category && (
                                      <span className="text-[10px] bg-accent/20 text-accent-foreground px-1.5 py-0.5 rounded">
                                        {p.store_category}
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="font-semibold text-foreground text-sm truncate">{p.name}</h4>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">{p.category}</p>
                                  {p.size && <p className="text-[10px] text-muted-foreground">📐 {p.size}</p>}
                                </div>
                              </div>

                              {/* Quantity controls */}
                              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                                {isEditingQty ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      min={0}
                                      value={storeEditQtyValue}
                                      onChange={(e) => setStoreEditQtyValue(e.target.value)}
                                      onBlur={() => {
                                        if (campaignId) {
                                          updateStorePiece.mutate({
                                            campaignId, storeId: selectedStoreId, pieceId: p.id,
                                            quantity: Math.max(0, parseInt(storeEditQtyValue) || 0),
                                          });
                                        }
                                        setStoreEditingPieceId(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          if (campaignId) {
                                            updateStorePiece.mutate({
                                              campaignId, storeId: selectedStoreId, pieceId: p.id,
                                              quantity: Math.max(0, parseInt(storeEditQtyValue) || 0),
                                            });
                                          }
                                          setStoreEditingPieceId(null);
                                        }
                                        if (e.key === "Escape") setStoreEditingPieceId(null);
                                      }}
                                      className="w-20 h-8 text-center text-sm"
                                      autoFocus
                                    />
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      if (!canEditCampaignStores) return;
                                      setStoreEditingPieceId(p.id);
                                      setStoreEditQtyValue(String(p.quantity));
                                    }}
                                    className="flex items-center gap-1.5 text-sm font-bold text-foreground hover:text-primary transition-colors"
                                    disabled={!canEditCampaignStores}
                                  >
                                    <Package className="w-3.5 h-3.5" />
                                    {p.quantity} un.
                                    {canEditCampaignStores && <Edit3 className="w-3 h-3 text-muted-foreground" />}
                                  </button>
                                )}

                                {canEditCampaignStores && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>{t("pieces.removePieceStore")}</AlertDialogTitle>
                                        <AlertDialogDescription>{t("pieces.removePieceStoreDesc", { name: p.name })}</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          onClick={() => {
                                            if (campaignId) {
                                              updateStorePiece.mutate({
                                                campaignId, storeId: selectedStoreId, pieceId: p.id, quantity: 0,
                                              });
                                            }
                                          }}
                                        >
                                          {t("common.remove")}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Add piece to store dialog */}
                  <Dialog open={addPieceToStoreOpen} onOpenChange={setAddPieceToStoreOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("pieces.addPieceToStore", { store: selectedStore.name })}</DialogTitle>
                        <DialogDescription>{t("pieces.addPieceToStoreDesc")}</DialogDescription>
                      </DialogHeader>
                      {unassignedPieces.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">{t("pieces.allPiecesIncluded")}</p>
                      ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                          {unassignedPieces.map((p) => (
                            <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-primary">#{p.code}</span>
                                  <span className="text-sm font-medium truncate">{p.name}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">{p.category} {p.size ? `· ${p.size}` : ""}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs gap-1 ml-2"
                                onClick={() => {
                                  if (campaignId) {
                                    updateStorePiece.mutate({
                                      campaignId, storeId: selectedStoreId, pieceId: p.id, quantity: 1,
                                    });
                                    toast.success(t("pieces.addedWithQty", { name: p.name }));
                                  }
                                }}
                              >
                                <Plus className="w-3.5 h-3.5" /> {t("pieces.include")}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              );
            })()}

            {/* Deactivate store confirmation dialog */}
            <AlertDialog open={!!deactivateStoreId} onOpenChange={(open) => { if (!open) setDeactivateStoreId(null); }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("stores.deactivateStore")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("stores.deactivateStoreDesc")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      if (!campaignId || !deactivateStoreId) return;
                      const storePiecesToRemove = pieces.filter(p => qtyMap[`${deactivateStoreId}-${p.id}`] > 0);
                      for (const p of storePiecesToRemove) {
                        await updateStorePiece.mutateAsync({
                          campaignId, storeId: deactivateStoreId, pieceId: p.id, quantity: 0,
                        });
                      }
                      upsertStoreStatus.mutate({ campaignId, storeId: deactivateStoreId, enabled: false });
                      setDeactivateStoreId(null);
                      toast.success(t("stores.storeDeactivated"));
                    }}
                  >
                    SIM
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>)}

          {activeSection === "matrix" && (
            <div className="flex flex-col lg:flex-row border border-border rounded-xl overflow-hidden bg-card -mx-2 sm:-mx-4" style={{ minHeight: "calc(100vh - 200px)" }}>
              {/* Filter Sidebar */}
              <MatrixFilterSidebar
                pieces={pieces}
                stores={stores}
                filters={pieceFilters}
                storeFilters={storeFilters}
                onFiltersChange={setPieceFilters}
                onStoreFiltersChange={setStoreFilters}
                collapsed={filterSidebarCollapsed}
                onCollapsedChange={handleFilterSidebarCollapsedChange}
                customFieldLabels={[
                  ...(client?.custom_field_1_label ? [{ key: "custom_field_1" as const, label: client.custom_field_1_label }] : []),
                  ...(client?.custom_field_2_label ? [{ key: "custom_field_2" as const, label: client.custom_field_2_label }] : []),
                  ...(client?.custom_field_3_label ? [{ key: "custom_field_3" as const, label: client.custom_field_3_label }] : []),
                  ...(client?.custom_field_4_label ? [{ key: "custom_field_4" as const, label: client.custom_field_4_label }] : []),
                  ...(client?.custom_field_5_label ? [{ key: "custom_field_5" as const, label: client.custom_field_5_label }] : []),
                ]}
              />

              {/* Matrix Content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Toolbar */}
                <div className="px-3 py-2.5 border-b border-border bg-muted/30">
                  {renderStoreFilters()}
                  <div className="flex items-center gap-2">
                    <QuickMatrixEditor
                      stores={activeFilteredStores}
                      pieces={matrixPieces}
                      kits={matrixKits}
                      kitPieces={kitPieces}
                      qtyMap={qtyMap}
                      campaignId={campaignId!}
                      isAdmin={canEditCampaign}
                      onSaveBatch={async (changes) => {
                        for (const c of changes) {
                          await updateStorePiece.mutateAsync({
                            campaignId: campaignId!, storeId: c.storeId, pieceId: c.pieceId, quantity: c.quantity,
                          });
                        }
                      }}
                      onEditingChange={setQuickEditActive}
                      customFieldLabels={[
                        ...(client?.custom_field_1_label ? [{ key: "custom_field_1", label: client.custom_field_1_label }] : []),
                        ...(client?.custom_field_2_label ? [{ key: "custom_field_2", label: client.custom_field_2_label }] : []),
                        ...(client?.custom_field_3_label ? [{ key: "custom_field_3", label: client.custom_field_3_label }] : []),
                        ...(client?.custom_field_4_label ? [{ key: "custom_field_4", label: client.custom_field_4_label }] : []),
                        ...(client?.custom_field_5_label ? [{ key: "custom_field_5", label: client.custom_field_5_label }] : []),
                      ]}
                    />

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="text-xs gap-1.5">
                          <MoreHorizontal className="w-4 h-4" />
                          <span className="hidden sm:inline">{t("common.moreActions") || "Mais ações"}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        {/* Export group */}
                        <DropdownMenuItem onClick={() => exportMatrix(activeFilteredStores, matrixPieces, storePieces, campaign?.name || "Campanha", kits, kitPieces, pieces, agency?.name, client?.name)}>
                          <Download className="w-4 h-4 mr-2" />
                          {t("common.export")} {t("modules.matrix")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setMatrixCustomExportOpen(true)}>
                          <Download className="w-4 h-4 mr-2" />
                          {t("matrix.customExport")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={async () => {
                          toast.loading("Gerando planilha com imagens...", { id: "matrix-excel" });
                          try {
                            await exportMatrixExcelJS(activeFilteredStores, matrixPieces, qtyMap, campaign?.name || "Campanha", kits, kitPieces);
                            toast.success("Planilha exportada com sucesso!", { id: "matrix-excel" });
                          } catch (err) {
                            console.error(err);
                            toast.error("Erro ao exportar planilha", { id: "matrix-excel" });
                          }
                        }}>
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          Exportar Orçamento
                        </DropdownMenuItem>

                        {canEditCampaign && (
                          <>
                            <DropdownMenuSeparator />
                            {/* Import group */}
                            <DropdownMenuItem onSelect={() => {
                              const input = document.getElementById("matrix-import-input") as HTMLInputElement;
                              input?.click();
                            }}>
                              <Upload className="w-4 h-4 mr-2" />
                              {t("common.import")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setImportMatrixDialogOpen(true)}>
                              <Copy className="w-4 h-4 mr-2" />
                              {t("matrix.fromOtherCampaign")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setAutomationOpen(true)}>
                              <Sparkles className="w-4 h-4 mr-2" />
                              {t("automation.title")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Hidden file input for matrix import */}
                    {canEditCampaign && (
                      <input id="matrix-import-input" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !campaignId) return;
                        try {
                          const items = await parseMatrixImport(file, pieces, stores);
                          if (items.length === 0) { toast.error(t("matrix.noDataFound")); return; }
                          for (const item of items) {
                            await updateStorePiece.mutateAsync({ campaignId, storeId: item.storeId, pieceId: item.pieceId, quantity: item.quantity });
                          }
                          toast.success(t("matrix.quantitiesImported", { count: items.length }));
                        } catch { toast.error(t("matrix.errorImport")); }
                        e.target.value = "";
                      }} />
                    )}
                  </div>
                </div>

                <ImportMatrixFromCampaignDialog
                  open={importMatrixDialogOpen}
                  onOpenChange={setImportMatrixDialogOpen}
                  clientId={clientId!}
                  currentCampaignId={campaignId!}
                  currentPieces={matrixPieces}
                  currentKits={kits}
                  currentStores={activeFilteredStores}
                  onImport={async (changes) => {
                    for (const c of changes) {
                      await updateStorePiece.mutateAsync({
                        campaignId: campaignId!, storeId: c.storeId, pieceId: c.pieceId, quantity: c.quantity,
                      });
                    }
                  }}
                />

                <MatrixAutomationDialog
                  open={automationOpen}
                  onOpenChange={setAutomationOpen}
                  campaignId={campaignId!}
                  clientId={clientId!}
                  stores={activeFilteredStores}
                  pieces={matrixPieces}
                  kits={kits}
                  kitPieces={kitPieces}
                  qtyMap={qtyMap}
                  customFieldLabels={[
                    ...(client?.custom_field_1_label ? [{ key: "custom_field_1", label: client.custom_field_1_label, index: 1 }] : []),
                    ...(client?.custom_field_2_label ? [{ key: "custom_field_2", label: client.custom_field_2_label, index: 2 }] : []),
                    ...(client?.custom_field_3_label ? [{ key: "custom_field_3", label: client.custom_field_3_label, index: 3 }] : []),
                    ...(client?.custom_field_4_label ? [{ key: "custom_field_4", label: client.custom_field_4_label, index: 4 }] : []),
                    ...(client?.custom_field_5_label ? [{ key: "custom_field_5", label: client.custom_field_5_label, index: 5 }] : []),
                  ]}
                  onComplete={() => {
                    queryClient.invalidateQueries({ queryKey: ["campaign_store_pieces", campaignId] });
                  }}
                />

                <CustomExportDialog
                  open={matrixCustomExportOpen}
                  onOpenChange={setMatrixCustomExportOpen}
                  title="Exportação Personalizada — Matriz/Rateio"
                  fileName={`Matriz_Rateio_${campaign?.name || "Campanha"}`}
                  agencyName={agency?.name}
                  clientName={client?.name}
                  sheetName="Matriz"
                  data={activeFilteredStores}
                  fields={(() => {
                    const base: ExportFieldDef[] = [
                      { key: "store_name", label: "Loja", getValue: (s: ClientStore) => s.name || "" },
                      { key: "store_nickname", label: "Apelido", getValue: (s: ClientStore) => s.nickname || "" },
                      { key: "store_code", label: "Código Loja", getValue: (s: ClientStore) => s.store_code || "" },
                      { key: "store_city", label: "Cidade", getValue: (s: ClientStore) => s.city || "" },
                      { key: "store_state", label: "UF", getValue: (s: ClientStore) => s.state || "" },
                      { key: "store_model", label: "Modelo", getValue: (s: ClientStore) => s.store_model || "" },
                      { key: "store_cnpj", label: "CNPJ", getValue: (s: ClientStore) => s.cnpj || "" },
                      { key: "store_zip", label: "CEP", getValue: (s: ClientStore) => s.zip_code || "" },
                      { key: "store_street", label: "Rua", getValue: (s: ClientStore) => s.street || "" },
                      { key: "store_number", label: "Nº", getValue: (s: ClientStore) => s.number || "" },
                      { key: "store_complement", label: "Complemento", getValue: (s: ClientStore) => s.complement || "" },
                      { key: "store_neighborhood", label: "Bairro", getValue: (s: ClientStore) => s.neighborhood || "" },
                      { key: "store_country", label: "País", getValue: (s: ClientStore) => s.country || "" },
                      { key: "store_phone", label: "Telefone", getValue: (s: ClientStore) => s.phone || "" },
                      { key: "store_email", label: "E-mail", getValue: (s: ClientStore) => s.email || "" },
                      { key: "store_manager", label: "Contato", getValue: (s: ClientStore) => s.manager_name || "" },
                    ];
                    [1, 2, 3, 4, 5].forEach((i) => {
                      const label = (client as any)?.[`custom_field_${i}_label`];
                      if (label) {
                        const parsed = label.split("|")[0];
                        if (parsed) {
                          base.push({
                            key: `store_cf_${i}`,
                            label: parsed,
                            getValue: (s: ClientStore) => (s as any)[`custom_field_${i}`] || "",
                          });
                        }
                      }
                    });
                    matrixPieces.forEach((p) => {
                      base.push({
                        key: `piece_${p.id}`,
                        label: `${p.code} - ${p.name}`,
                        getValue: (s: ClientStore) => qtyMap[`${s.id}-${p.id}`] || 0,
                      });
                    });
                    kits.forEach((kit) => {
                      const kpForKit = kitPieces.filter(kp => kp.kit_id === kit.id);
                      base.push({
                        key: `kit_${kit.id}`,
                        label: `Kit ${kit.code} - ${kit.name}`,
                        getValue: (s: ClientStore) => {
                          if (kpForKit.length === 0) return 0;
                          return Math.min(...kpForKit.map(kp => {
                            const storeQty = qtyMap[`${s.id}-${kp.piece_id}`] || 0;
                            return Math.floor(storeQty / (kp.quantity || 1));
                          }));
                        },
                      });
                    });
                    base.push({
                      key: "total",
                      label: "Total",
                      getValue: (s: ClientStore) => matrixPieces.reduce((sum, p) => sum + (qtyMap[`${s.id}-${p.id}`] || 0), 0),
                    });
                    return base;
                  })()}
                />

                {/* Matrix Table - hidden during quick edit */}
                {!quickEditActive && <div className="flex-1 overflow-auto p-3">
                  {pieces.length === 0 ? (
                    <div className="text-center py-20">
                      <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                      <h2 className="text-lg font-display font-bold text-foreground mb-2">{t("pieces.noPieceRegisteredMatrix")}</h2>
                      <p className="text-muted-foreground text-sm">{t("pieces.addPiecesFirst")}</p>
                    </div>
                  ) : activeFilteredStores.length === 0 ? (
                    <div className="text-center py-20">
                      <Store className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                      <h2 className="text-lg font-display font-bold text-foreground mb-2">{t("pieces.noStoreFoundMatrix")}</h2>
                      <p className="text-muted-foreground text-sm">{t("pieces.adjustFilters")}</p>
                    </div>
                  ) : matrixPieces.length === 0 ? (
                    <div className="text-center py-20">
                      <Filter className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                      <h2 className="text-lg font-display font-bold text-foreground mb-2">{t("pieces.noMatchFilters")}</h2>
                      <p className="text-muted-foreground text-sm">{t("pieces.adjustSideFilters")}</p>
                      <Button size="sm" variant="outline" className="mt-3" onClick={() => { setPieceFilters({ ...EMPTY_FILTERS }); setStoreFilters({ ...EMPTY_STORE_FILTERS }); }}>
                        {t("pieces.clearFilters")}
                      </Button>
                    </div>
                  ) : (
                    <div className="border border-border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-card z-[5] min-w-[180px]">{t("matrix.store")}</TableHead>
                            {matrixColumns.map((col) => {
                              if (col.type === "piece") {
                                const p = col.data;
                                return (
                                  <TableHead key={p.id} className="text-center min-w-[100px]">
                                    <button
                                      className="flex flex-col items-center gap-0.5 w-full hover:opacity-80 transition-opacity"
                                      onClick={() => handleOpenEditPiece(p)}
                                    >
                                      <PieceThumbnail imageUrl={p.image_url} name={p.name} size="sm" />
                                      <span className="text-xs font-bold">{p.code}</span>
                                      <span className="text-[10px] text-muted-foreground truncate max-w-[90px]">{p.name}</span>
                                      {p.store_category && (
                                        <span className="text-[9px] bg-accent text-accent-foreground px-1 rounded">{p.store_category}</span>
                                      )}
                                    </button>
                                  </TableHead>
                                );
                              }
                              const kit = col.data;
                              return (
                                <TableHead key={`kit-${kit.id}`} className="text-center min-w-[100px]">
                                  <button onClick={() => setViewKitDetail(kit)} className="flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity">
                                    {kit.image_url ? (
                                      <PieceThumbnail imageUrl={kit.image_url} name={kit.name} size="sm" />
                                    ) : (
                                      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                                        <Package className="w-4 h-4 text-primary" />
                                      </div>
                                    )}
                                    <span className="text-xs font-bold text-primary">{kit.code}</span>
                                    <span className="text-[10px] text-muted-foreground truncate max-w-[90px]">{kit.name}</span>
                                  </button>
                                </TableHead>
                              );
                            })}
                            <TableHead className="text-center font-bold">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeFilteredStores.map((store) => {
                            const storeTotal = matrixPieces.reduce((s, p) => s + (qtyMap[`${store.id}-${p.id}`] || 0), 0);
                            const hasAnyStoreWithQty = activeFilteredStores.some(
                              (st) => st.id !== store.id && matrixPieces.some((p) => (qtyMap[`${st.id}-${p.id}`] || 0) > 0)
                            );
                            const isEmptyStore = storeTotal === 0 && hasAnyStoreWithQty;
                            return (
                              <TableRow key={store.id}>
                                <TableCell className="sticky left-0 bg-card z-[5] font-medium">
                                  <div>
                                    <span className="text-sm">{store.name}</span>
                                    {store.nickname && store.nickname !== store.name && (
                                      <span className="text-[10px] text-muted-foreground ml-1">({store.nickname})</span>
                                    )}
                                    {store.store_model && (
                                      <p className="text-[10px] text-muted-foreground">{store.store_model}</p>
                                    )}
                                  </div>
                                </TableCell>
                                {matrixColumns.map((col) => {
                                  if (col.type === "piece") {
                                    const p = col.data;
                                    const key = `${store.id}-${p.id}`;
                                    const qty = qtyMap[key] || 0;
                                    const isEditing = editingCell?.storeId === store.id && editingCell?.pieceId === p.id;
                                    return (
                                      <TableCell key={p.id} className="text-center p-1">
                                        {isEditing ? (
                                          <Input
                                            ref={(el) => { editingInputRefs.current[`${store.id}-${p.id}`] = el; }}
                                            type="number"
                                            min={0}
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handlePieceBlur}
                                            onKeyDown={(e) => {
                                              if (e.key === "Tab") {
                                                e.preventDefault();
                                                skipBlurSaveRef.current = true;
                                                const next = navigateMatrixCell(e.shiftKey ? "left" : "right");
                                                handleCellSave(next ? { navigateTo: next } : undefined);
                                              } else if (e.key === "Enter") {
                                                e.preventDefault();
                                                skipBlurSaveRef.current = true;
                                                const next = navigateMatrixCell(e.shiftKey ? "up" : "down");
                                                handleCellSave(next ? { navigateTo: next } : undefined);
                                              } else if (e.key === "ArrowUp") {
                                                e.preventDefault();
                                                skipBlurSaveRef.current = true;
                                                const next = navigateMatrixCell("up");
                                                handleCellSave(next ? { navigateTo: next } : undefined);
                                              } else if (e.key === "ArrowDown") {
                                                e.preventDefault();
                                                skipBlurSaveRef.current = true;
                                                const next = navigateMatrixCell("down");
                                                handleCellSave(next ? { navigateTo: next } : undefined);
                                              } else if (e.key === "ArrowLeft") {
                                                e.preventDefault();
                                                skipBlurSaveRef.current = true;
                                                const next = navigateMatrixCell("left");
                                                handleCellSave(next ? { navigateTo: next } : undefined);
                                              } else if (e.key === "ArrowRight") {
                                                e.preventDefault();
                                                skipBlurSaveRef.current = true;
                                                const next = navigateMatrixCell("right");
                                                handleCellSave(next ? { navigateTo: next } : undefined);
                                              } else if (e.key === "Escape") {
                                                setEditingCell(null);
                                              }
                                            }}
                                            className="w-16 h-8 text-center mx-auto text-sm"
                                            autoFocus
                                          />
                                        ) : (
                                          <button
                                            onClick={() => handleCellClick(store.id, p.id)}
                                            className={`w-full h-8 text-sm rounded transition-colors ${
                                              qty > 0
                                                ? "bg-primary/10 text-primary font-semibold hover:bg-primary/20"
                                                : isEmptyStore
                                                ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 font-medium"
                                                : canEditCampaign
                                                ? "text-muted-foreground/40 hover:bg-muted"
                                                : "text-muted-foreground/40"
                                            }`}
                                            disabled={!canEditCampaign}
                                            title={isEmptyStore && qty === 0 ? "Loja sem quantidades — preencha manualmente" : undefined}
                                          >
                                            {qty > 0 ? qty : isEmptyStore ? "⚠" : "—"}
                                          </button>
                                        )}
                                      </TableCell>
                                    );
                                  }
                                  // Kit column
                                  const kit = col.data;
                                  const kitPiecesForKit = kitPieces.filter(kp => kp.kit_id === kit.id);
                                  const kitQty = kitPiecesForKit.length > 0
                                    ? Math.min(...kitPiecesForKit.map(kp => {
                                        const storeQty = qtyMap[`${store.id}-${kp.piece_id}`] || 0;
                                        return Math.floor(storeQty / (kp.quantity || 1));
                                      }))
                                    : 0;
                                  const isEditing = editingCell?.storeId === store.id && editingCell?.pieceId === `kit-${kit.id}`;
                                  return (
                                    <TableCell key={`kit-${kit.id}`} className="text-center p-1 bg-primary/5">
                                      {isEditing ? (
                                        <Input
                                          ref={(el) => { editingInputRefs.current[`${store.id}-kit-${kit.id}`] = el; }}
                                          type="number"
                                          min={0}
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          onBlur={async () => {
                                            if (skipBlurSaveRef.current) {
                                              skipBlurSaveRef.current = false;
                                              return;
                                            }

                                            const qty = Math.max(0, parseInt(editValue) || 0);
                                            if (campaignId) {
                                              for (const kp of kitPiecesForKit) {
                                                await updateStorePiece.mutateAsync({
                                                  campaignId,
                                                  storeId: store.id,
                                                  pieceId: kp.piece_id,
                                                  quantity: qty * (kp.quantity || 1),
                                                });
                                              }
                                            }

                                            setEditValue(String(qty));

                                            const currentCell = { storeId: store.id, pieceId: `kit-${kit.id}` };
                                            if (
                                              editingCellRef.current?.storeId === currentCell.storeId &&
                                              editingCellRef.current?.pieceId === currentCell.pieceId
                                            ) {
                                              requestAnimationFrame(() => focusEditingCell(currentCell));
                                            }
                                          }}
                                          onKeyDown={async (e) => {
                                            const saveKit = async () => {
                                              const qty = Math.max(0, parseInt(editValue) || 0);
                                              if (campaignId) {
                                                for (const kp of kitPiecesForKit) {
                                                  await updateStorePiece.mutateAsync({
                                                    campaignId,
                                                    storeId: store.id,
                                                    pieceId: kp.piece_id,
                                                    quantity: qty * (kp.quantity || 1),
                                                  });
                                                }
                                              }
                                            };

                                            const saveAndNavigate = async (dir: "up" | "down" | "left" | "right") => {
                                              skipBlurSaveRef.current = true;
                                              await saveKit();
                                              const next = navigateMatrixCell(dir);
                                              if (next) {
                                                setEditingCell(next);
                                                setEditValue(String(getCellQty(next.storeId, next.pieceId)));
                                              } else {
                                                setEditingCell(null);
                                              }
                                            };

                                            if (e.key === "Tab") {
                                              e.preventDefault();
                                              await saveAndNavigate(e.shiftKey ? "left" : "right");
                                            } else if (e.key === "Enter") {
                                              e.preventDefault();
                                              await saveAndNavigate(e.shiftKey ? "up" : "down");
                                            } else if (e.key === "ArrowUp") {
                                              e.preventDefault();
                                              await saveAndNavigate("up");
                                            } else if (e.key === "ArrowDown") {
                                              e.preventDefault();
                                              await saveAndNavigate("down");
                                            } else if (e.key === "ArrowLeft") {
                                              e.preventDefault();
                                              await saveAndNavigate("left");
                                            } else if (e.key === "ArrowRight") {
                                              e.preventDefault();
                                              await saveAndNavigate("right");
                                            } else if (e.key === "Escape") {
                                              setEditingCell(null);
                                            }
                                          }}
                                          className="w-16 h-8 text-center mx-auto text-sm"
                                          autoFocus
                                        />
                                      ) : (
                                        <button
                                          onClick={() => {
                                            if (!canEditCampaign) return;
                                            setEditingCell({ storeId: store.id, pieceId: `kit-${kit.id}` });
                                            setEditValue(String(kitQty));
                                          }}
                                          className={`w-full h-8 text-sm rounded transition-colors ${
                                            kitQty > 0
                                              ? "bg-primary/15 text-primary font-semibold hover:bg-primary/25"
                                              : isEmptyStore
                                              ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 font-medium"
                                              : canEditCampaign
                                              ? "text-muted-foreground/40 hover:bg-muted"
                                              : "text-muted-foreground/40"
                                          }`}
                                          disabled={!canEditCampaign}
                                          title={isEmptyStore && kitQty === 0 ? "Loja sem quantidades — preencha manualmente" : undefined}
                                        >
                                          {kitQty > 0 ? kitQty : isEmptyStore ? "⚠" : "—"}
                                        </button>
                                      )}
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-center font-bold text-sm">{storeTotal}</TableCell>
                              </TableRow>
                            );
                          })}
                          {/* Totals row */}
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell className="sticky left-0 bg-muted/50 z-[5]">Total</TableCell>
                            {matrixColumns.map((col) => {
                              if (col.type === "piece") {
                                const p = col.data;
                                const pieceTotal = filteredStores.reduce((s, st) => s + (qtyMap[`${st.id}-${p.id}`] || 0), 0);
                                return <TableCell key={p.id} className="text-center text-sm">{pieceTotal}</TableCell>;
                              }
                              const kit = col.data;
                              const kitPiecesForKit = kitPieces.filter(kp => kp.kit_id === kit.id);
                              const kitTotal = kitPiecesForKit.length > 0
                                ? filteredStores.reduce((total, st) => {
                                    const minQty = Math.min(...kitPiecesForKit.map(kp => {
                                      const storeQty = qtyMap[`${st.id}-${kp.piece_id}`] || 0;
                                      return Math.floor(storeQty / (kp.quantity || 1));
                                    }));
                                    return total + minQty;
                                  }, 0)
                                : 0;
                              return <TableCell key={`kit-total-${kit.id}`} className="text-center text-sm">{kitTotal}</TableCell>;
                            })}
                            <TableCell className="text-center text-sm text-primary">
                              {matrixPieces.reduce((total, p) => total + filteredStores.reduce((s, st) => s + (qtyMap[`${st.id}-${p.id}`] || 0), 0), 0)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>}
              </div>
            </div>
          )}

          {/* ─── SECTION: PEÇAS ─── */}
          {activeSection === "pieces" && (<>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-4">
              {/* Group 1 — Counter (left) */}
              <span className="px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-accent/15 text-accent-foreground">
                {visiblePieces.length + kits.length} {t("pieces.pieceCount")}
              </span>

              <div className="flex-1" />

              {/* Group 3 — "Mais ações" dropdown (middle-right) */}
              {canEditPieces && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="text-[10px] sm:text-xs gap-1">
                      <MoreHorizontal className="w-3.5 h-3.5" /> Mais ações
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => exportCampaignPieces(pieces, campaign?.name || "Campanha", kits, kitPieces, pieces, agency?.name, client?.name)}>
                      <Download className="w-4 h-4 mr-2" /> {t("common.export")}
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <label className="cursor-pointer flex items-center w-full">
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !campaignId) return;
                          try {
                            const items = await parsePiecesImport(file);
                            if (items.length === 0) { toast.error("Nenhuma peça encontrada."); return; }
                            let added = 0, updated = 0;
                            for (const item of items) {
                              const existing = pieces.find(p => p.name.toLowerCase() === item.name.toLowerCase());
                              if (existing) {
                                await updatePiece.mutateAsync({ id: existing.id, ...item });
                                updated++;
                              } else {
                                await addPiece.mutateAsync({ campaign_id: campaignId, ...item });
                                added++;
                              }
                            }
                            toast.success(`${added} adicionada(s), ${updated} atualizada(s)!`);
                          } catch { toast.error("Erro ao importar."); }
                          e.target.value = "";
                        }} />
                        <Upload className="w-4 h-4 mr-2" /> Importar
                      </label>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleReviewPieceCodes}>
                      <Sparkles className="w-4 h-4 mr-2" /> {t("pieces.reviewCodes")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleRecodificar}>
                      <RefreshCw className="w-4 h-4 mr-2" /> {t("pieces.recode")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocationDialogOpen(true)}>
                      <MapPin className="w-4 h-4 mr-2" /> {t("pieces.storeLocation")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setImportPiecesDialogOpen(true)}>
                      <Copy className="w-4 h-4 mr-2" /> {t("pieces.fromCampaign")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setBulkDeleteOpen(true)} className="text-destructive focus:text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" /> {t("pieces.bulkDelete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Group 2 — Primary actions (right) */}
              {canEditPieces && (
                <>
                <Dialog open={pieceDialogOpen} onOpenChange={setPieceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="text-[10px] sm:text-xs gap-1 gradient-accent text-white border-0">
                      <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {t("pieces.newPiece")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                       <DialogTitle>{t("pieces.newPiece")}</DialogTitle>
                       <DialogDescription>{t("pieces.addPieceDesc")}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddPiece} className="space-y-3">
                      {renderPieceFormFields(pieceForm, setPieceForm)}
                      <Button type="submit" className="w-full gradient-accent text-white border-0" disabled={addPiece.isPending}>{t("common.add")}</Button>
                    </form>
                  </DialogContent>
                </Dialog>
                <Button size="sm" className="text-[10px] sm:text-xs gap-1 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => setCreateKitDialogOpen(true)}>
                  <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {t("pieces.newKit")}
                </Button>
                </>
              )}
            </div>

            {/* Search bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("pieces.searchPiece")}
                value={pieceSearch}
                onChange={(e) => setPieceSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
              {pieceSearch && (
                <button onClick={() => setPieceSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {(() => {
              const search = pieceSearch.toLowerCase().trim();
              const filteredVisiblePieces = search
                ? visiblePieces.filter(p =>
                    p.name.toLowerCase().includes(search) ||
                    String(p.code).includes(search) ||
                    (p.category || "").toLowerCase().includes(search) ||
                    (p.store_category || "").toLowerCase().includes(search)
                  )
                : visiblePieces;
              const filteredKits = search
                ? kits.filter(k => {
                    if (k.name.toLowerCase().includes(search) || String(k.code).includes(search)) return true;
                    const kpIds = kitPieces.filter(kp => kp.kit_id === k.id).map(kp => kp.piece_id);
                    return pieces.some(p => kpIds.includes(p.id) && p.name.toLowerCase().includes(search));
                  })
                : kits;

              if (filteredVisiblePieces.length === 0 && filteredKits.length === 0) {
                return (
                  <div className="text-center py-16">
                    <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">
                      {search ? t("pieces.noPieceFound") : t("pieces.noPieceRegistered")}
                    </p>
                  </div>
                );
              }

              return (
                <SortablePiecesTable
                  pieces={filteredVisiblePieces}
                  kits={filteredKits}
                  kitPieces={kitPieces}
                  allPieces={pieces}
                  stores={stores}
                  qtyMap={qtyMap}
                  canEditPieces={canEditPieces}
                  canDeletePieces={canDeletePieces}
                  onEdit={handleOpenEditPiece}
                  onDelete={(id) => deletePiece.mutate(id)}
                  onDistribute={handleDistributePiece}
                  onMarkKitOnly={async (p) => { await updatePiece.mutateAsync({ id: p.id, kit_only: true }); }}
                  onToggleMockup={async (p) => { await updatePiece.mutateAsync({ id: p.id, is_mockup: !p.is_mockup }); }}
                   onKitClick={(kit) => setViewKitDetail(kit)}
                   onDeleteKit={(id) => deleteKit.mutate(id)}
                   onToggleKitMockup={async (kit) => {
                     const newVal = !kit.is_mockup;
                     await updateKit.mutateAsync({ id: kit.id, is_mockup: newVal });
                     // Propagar para peças do kit
                     const kpForKit = kitPieces.filter(kp => kp.kit_id === kit.id);
                     for (const kp of kpForKit) {
                       await updatePiece.mutateAsync({ id: kp.piece_id, is_mockup: newVal });
                     }
                   }}
                  onDuplicate={async (piece) => {
                    const maxOrder = pieces.length > 0 ? Math.max(...pieces.map(p => p.display_order)) : 0;
                    const maxCode = pieces.length > 0 ? Math.max(...pieces.map(p => p.code)) : 0;
                    await addPiece.mutateAsync({
                      campaign_id: campaignId,
                      code: maxCode + 1,
                      category: piece.category,
                      name: `${piece.name} - Cópia`,
                      size: piece.size,
                      store_category: piece.store_category || undefined,
                      specification: piece.specification,
                      installation_instructions: piece.installation_instructions,
                      kit_only: piece.kit_only,
                      is_mockup: piece.is_mockup,
                      display_order: maxOrder + 1,
                      image_url: piece.image_url || undefined,
                    });
                    toast.success("Peça duplicada com sucesso!");
                  }}
                  onDuplicateKit={async (kit) => {
                    const maxOrder = [...pieces, ...kits].reduce((max, item) => Math.max(max, item.display_order), 0);
                    const maxCode = kits.length > 0 ? Math.max(...kits.map(k => k.code)) : 0;
                    const createdKit = await addKit.mutateAsync({
                      campaign_id: campaignId,
                      name: `${kit.name} - Cópia`,
                      code: maxCode + 1,
                      display_order: maxOrder + 1,
                    });
                    if (kit.image_url) await updateKit.mutateAsync({ id: createdKit.id, image_url: kit.image_url });
                    if (kit.is_mockup) await updateKit.mutateAsync({ id: createdKit.id, is_mockup: true });
                    // Duplicate kit pieces
                    const kpForKit = kitPieces.filter(kp => kp.kit_id === kit.id);
                    for (const kp of kpForKit) {
                      await addKitPiece.mutateAsync({ kit_id: createdKit.id, piece_id: kp.piece_id, quantity: kp.quantity });
                    }
                    toast.success("Kit duplicado com sucesso!");
                  }}
                  onReorder={handleReorderUnified}
                />
              );
            })()}
          </>)}

          {/* ─── SECTION: OCORRÊNCIAS ─── */}
          {activeSection === "occurrences" && (
            <OccurrencesTab campaignId={campaignId!} clientId={clientId} stores={stores} pieces={pieces} canEdit={canEditOccurrences} canDelete={canDeleteOccurrences} canEditReporter={canEditReporterData} />
          )}

          {/* ─── SECTION: AGENDAMENTO ─── */}
          {activeSection === "scheduling" && (
            <SchedulingTab
              campaignId={campaignId!}
              stores={stores.filter((s) => isStoreEnabled(s.id) && s.show_in_scheduling)}
              canEdit={canEditSchedules}
              agencyName={agency?.name || ""}
              clientName={client?.name || ""}
              campaignName={campaign?.name || ""}
              clientId={clientId!}
            />
          )}

          {/* ─── SECTION: INSTALAÇÕES ─── */}
          {activeSection === "installations" && (
            <InstallationsTab
              campaignId={campaignId!}
              campaignName={campaign?.name || ""}
              stores={stores.filter((s) => isStoreEnabled(s.id) && s.show_in_scheduling)}
              canEdit={canEditInstallations}
              clientId={clientId!}
              agencyName={agency?.name || ""}
              clientName={client?.name || ""}
            />
          )}

          {/* ─── SECTION: ORÇAMENTOS ─── */}
          {activeSection === "budgets" && (
            <BudgetsTab campaignId={campaignId!} canEdit={canEditCampaign} currencyCode={client?.currency_code} />
          )}

          {/* ─── SECTION: CHAT ─── */}
          {activeSection === "chat" && campaignId && (
            <CampaignChatSection campaignId={campaignId} />
          )}
          </>
        )}
      

      {/* Edit Piece Dialog */}
      <Dialog open={editPieceDialogOpen} onOpenChange={setEditPieceDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
             <DialogTitle>{t("pieces.editPiece")}</DialogTitle>
             <DialogDescription>{t("pieces.editPieceDesc")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditPiece} className="space-y-3">
            {renderPieceFormFields(editPieceForm, setEditPieceForm as any)}
            <Button type="submit" className="w-full" disabled={updatePiece.isPending}>{t("common.save")}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Locations Dialog */}
      {campaignId && clientId && (
        <ManageLocationsDialog
          open={locationDialogOpen}
          onOpenChange={setLocationDialogOpen}
          campaignId={campaignId}
          clientId={clientId}
          pieceLocations={pieceLocations}
          subLocations={pieceSubLocations}
          pieces={pieces}
        />
      )}

      {/* Create Kit Dialog */}
      {campaignId && (
        <CreateKitDialog
          open={createKitDialogOpen}
          onOpenChange={setCreateKitDialogOpen}
          campaignId={campaignId}
          kitOnlyPieces={kitOnlyPieces}
          existingKits={kits}
          onCreateKit={async (kit) => await addKit.mutateAsync(kit)}
          onAddKitPiece={async (kp) => await addKitPiece.mutateAsync(kp)}
          onUpdateKit={async (kit) => await updateKit.mutateAsync(kit)}
        />
      )}

      {/* Kit Detail Dialog */}
      <KitDetailDialog
        open={!!viewKitDetail}
        onOpenChange={(open) => { if (!open) setViewKitDetail(null); }}
        kit={viewKitDetail}
        kitPieces={kitPieces}
        allPieces={pieces}
        canEdit={canEditPieces}
        onDeleteKitPiece={(id) => deleteKitPiece.mutate(id)}
        onDeleteKit={(id) => deleteKit.mutate(id)}
        onAddKitPiece={async (kp) => await addKitPiece.mutateAsync(kp)}
        onUpdateKit={async (kit) => await updateKit.mutateAsync(kit)}
        onUpdatePiece={async (piece) => { await updatePiece.mutateAsync(piece as any); }}
        onDeletePiece={(id) => deletePiece.mutate(id)}
        onUpdateKitPiece={async (update) => { await updateKitPiece.mutateAsync(update); }}
      />

      {/* Bulk Delete Pieces Dialog */}
      <BulkDeletePiecesDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        pieces={pieces}
        onDeletePieces={async (ids) => {
          for (const id of ids) {
            await deletePiece.mutateAsync(id);
          }
          toast.success(`${ids.length} peça(s) excluída(s) com sucesso!`);
        }}
      />

      {/* Import Pieces from Campaign Dialog */}
      {clientId && campaignId && (
        <ImportPiecesFromCampaignDialog
          open={importPiecesDialogOpen}
          onOpenChange={setImportPiecesDialogOpen}
          clientId={clientId}
          currentCampaignId={campaignId}
          existingPieces={pieces}
          existingKitCodes={kits.map(k => k.code)}
          onImport={async ({ pieces: piecesToImport, kits: kitsToImport, storeQuantities }) => {
            try {
              const originalIdToNewId: Record<string, string> = {};
              let pieceCount = 0;
              for (const p of piecesToImport) {
                const { _originalId, ...pieceData } = p as any;
                const { data: created, error } = await supabase.from("campaign_pieces").insert(pieceData).select().single();
                if (error) throw error;
                pieceCount++;
                if (_originalId && created) originalIdToNewId[_originalId] = created.id;
              }
              let kitCount = 0;
              for (const kit of kitsToImport) {
                const createdKit = await addKit.mutateAsync({ campaign_id: campaignId, name: kit.name, code: kit.code });
                kitCount++;
                if (kit.image_url) await updateKit.mutateAsync({ id: createdKit.id, image_url: kit.image_url });
                for (const kp of kit.pieces) {
                  const newPieceId = originalIdToNewId[kp.originalPieceId];
                  if (newPieceId) await addKitPiece.mutateAsync({ kit_id: createdKit.id, piece_id: newPieceId, quantity: kp.quantity });
                }
              }
              let qtyCount = 0;
              if (storeQuantities && storeQuantities.length > 0) {
                for (const sq of storeQuantities) {
                  const targetPieceId = originalIdToNewId[sq.originalPieceId];
                  if (targetPieceId) {
                    await updateStorePiece.mutateAsync({ campaignId: campaignId!, storeId: sq.storeId, pieceId: targetPieceId, quantity: sq.quantity });
                    qtyCount++;
                  }
                }
              }
              await queryClient.invalidateQueries({ queryKey: ["campaign_pieces"] });
              await queryClient.invalidateQueries({ queryKey: ["campaign_kits"] });
              await queryClient.invalidateQueries({ queryKey: ["campaign_kit_pieces"] });
              if (qtyCount > 0) await queryClient.invalidateQueries({ queryKey: ["campaign_store_pieces"] });
              const parts = [];
              if (pieceCount > 0) parts.push(`${pieceCount} peça(s)`);
              if (kitCount > 0) parts.push(`${kitCount} kit(s)`);
              if (qtyCount > 0) parts.push(`${qtyCount} quantidade(s) por loja`);
              toast.success(`${parts.join(" e ")} importado(s) com sucesso!`);
            } catch (e) {
              console.error("Import error:", e);
              toast.error("Erro ao importar.");
            }
          }}
        />
      )}
    </AppLayout>
  );
};

export default CampaignDetail;
