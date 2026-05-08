import { Fragment, useState, useMemo, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { getStateColor } from "@/lib/stateColors";

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
  useCampaignKitPieces, useAddCampaignKitPiece, useDeleteCampaignKitPiece, useUpdateCampaignKitPiece, useReorderCampaignKitPieces,
  useBulkUpdateCampaignStorePieces,
  type CampaignPiece, type ClientStore, type CampaignKit, type CampaignStorePiece,
} from "@/hooks/useMultiClientData";

import { useClientPermission } from "@/hooks/useClientPermission";
import { useUserRole } from "@/hooks/useUserRole";
import { useLojaALojaPermissions } from "@/hooks/useLojaALojaPermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, Search, Package, Edit3, Store, Grid3X3, LayoutList, LayoutGrid, MapPin, Download, Upload, Sparkles, Hash, X, Minus, ChevronRight, ChevronDown, ChevronUp, CheckSquare, AlertTriangle, CalendarDays, Copy, RefreshCw, Home, DollarSign, Filter, Camera, MessageSquare, Users, FileSpreadsheet, FileText, MoreHorizontal, History, ArrowDownAZ, HelpCircle, Database, Layers, Palette } from "lucide-react";
import AdjustmentsTab from "@/components/AdjustmentsTab";
import MockupTab from "@/components/MockupTab";
import { useActiveAdjustment, useAdjustmentStorePieces, useUpdateAdjustmentStorePiece } from "@/hooks/useAdjustments";
import StoreContactsCardView from "@/components/StoreContactsCardView";

import PieceThumbnail from "@/components/PieceThumbnail";
import CampaignPieceImageUpload from "@/components/CampaignPieceImageUpload";
import AppLayout from "@/components/AppLayout";

import { toast } from "sonner";
import { findDuplicateName, duplicateNameMessage } from "@/lib/duplicateName";
import { exportCampaignPieces, parsePiecesImport, exportMatrix, parseMatrixImport } from "@/lib/exportMultiClient";
import ImportWizardDialog from "@/components/ImportWizardDialog";
import { exportMatrixExcelJS } from "@/lib/exportMatrixExcelJS";
import { exportRateioGrid } from "@/lib/exportRateioGrid";
import { exportRateioGridPDF } from "@/lib/exportRateioGridPDF";
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
import { OrderByLocationDialog } from "@/components/OrderByLocationDialog";
import ImportMatrixFromCampaignDialog from "@/components/ImportMatrixFromCampaignDialog";
import MatrixFilterSidebar, { EMPTY_FILTERS, EMPTY_STORE_FILTERS, type PieceFilters, type StoreFilters, type FilterLogicMode } from "@/components/MatrixFilterSidebar";
import ModuleGrid from "@/components/ModuleGrid";
import CampaignStatusDashboard, { type DashboardFilter } from "@/components/CampaignStatusDashboard";

import StoreContactsSection from "@/components/StoreContactsSection";
import MatrixAutomationDialog from "@/components/MatrixAutomationDialog";
import CopyQuantitiesDialog from "@/components/Matrix/CopyQuantitiesDialog";
import { ResetMatrixDialog } from "@/components/Matrix/ResetMatrixDialog";
import CampaignActivityHistory from "@/components/CampaignActivityHistory";
import ExportReportDropdown from "@/components/ExportReportDropdown";
import ExportAllPhotosDialog from "@/components/ExportAllPhotosDialog";
import CampaignBackupDialog from "@/components/CampaignBackupDialog";
import RateioBackupSheet from "@/components/RateioBackupSheet";
import RateioExportColorDialog, { type ColorPalette } from "@/components/RateioExportColorDialog";
import LojaALojaTab from "@/components/LojaALoja/LojaALojaTab";
// Lazy: defers recharts (~80KB) until the user opens the pending dashboard
const PendingOccurrencesDashboard = lazy(() => import("@/components/PendingOccurrencesDashboard"));
import BudgetTab from "@/components/Budget/BudgetTab";
import {
  useNegotiationStorePieces,
  useUpdateNegotiationStorePiece,
  cancelNegotiationRateio,
  resetNegotiationRateioFromOriginal,
} from "@/hooks/useNegotiationStorePieces";
import MatrixDistributionDashboard from "@/components/Matrix/MatrixDistributionDashboard";
import { Table2, BarChart3 as BarChart3Icon } from "lucide-react";
import { useOccurrenceMotives, useOccurrenceStatuses } from "@/hooks/useOccurrences";

type StoreDetailCustomField = { key: string; label: string };

const cleanCustomFieldLabel = (label: string) => label.split("|")[0]?.trim() || label;

const hasStoreDetailValue = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== "";

function StoreDetailsPopover({ store, customFieldLabels }: { store: ClientStore; customFieldLabels: StoreDetailCustomField[] }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const closeDetailsTimer = useRef<number | null>(null);
  const storeAny = store as any;
  const locationParts = [store.city, store.state].filter(Boolean).join(" / ");
  const typeField = customFieldLabels.find((field) => cleanCustomFieldLabel(field.label).toLowerCase().includes("tipo"));
  const typeValue = typeField ? storeAny[typeField.key] : storeAny.store_type ?? storeAny.type ?? storeAny.tipo;
  const seenCustomKeys = new Set<string>();
  const filledCustomFields = [
    ...customFieldLabels.map((field) => {
      seenCustomKeys.add(field.key);
      return { label: cleanCustomFieldLabel(field.label), value: storeAny[field.key] };
    }),
    ...Array.from({ length: 10 }, (_, idx) => {
      const key = `custom_field_${idx + 1}`;
      return seenCustomKeys.has(key) ? null : { label: `Campo personalizado ${idx + 1}`, value: storeAny[key] };
    }).filter((field): field is { label: string; value: unknown } => field !== null),
  ].filter((field) => hasStoreDetailValue(field.value));

  const cancelDetailsClose = () => {
    if (closeDetailsTimer.current) {
      window.clearTimeout(closeDetailsTimer.current);
      closeDetailsTimer.current = null;
    }
  };
  const scheduleDetailsClose = () => {
    cancelDetailsClose();
    closeDetailsTimer.current = window.setTimeout(() => setDetailsOpen(false), 160);
  };

  useEffect(() => () => cancelDetailsClose(), []);

  return (
    <Popover open={detailsOpen} onOpenChange={setDetailsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Ver detalhes da loja ${store.name}`}
          onMouseEnter={() => {
            cancelDetailsClose();
            setDetailsOpen(true);
          }}
          onMouseLeave={scheduleDetailsClose}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDetailsOpen(true);
          }}
          className="ml-1.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-warning/50 bg-warning/15 text-warning align-middle shadow-sm transition-colors hover:bg-warning/25 focus:outline-none focus:ring-2 focus:ring-warning/40"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        className="z-50 w-80 p-3 text-xs"
        onMouseEnter={cancelDetailsClose}
        onMouseLeave={scheduleDetailsClose}
      >
        <div className="space-y-2">
          <div>
            <div className="text-sm font-semibold leading-tight">{store.name}</div>
            {store.nickname && store.nickname !== store.name && <div className="text-[11px] text-muted-foreground">{store.nickname}</div>}
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <span className="text-muted-foreground">Modelo</span>
            <span className={hasStoreDetailValue(store.store_model) ? "" : "italic text-muted-foreground/70"}>{hasStoreDetailValue(store.store_model) ? store.store_model : "Modelo não informado"}</span>
            <span className="text-muted-foreground">Tipo</span>
            <span className={hasStoreDetailValue(typeValue) ? "" : "italic text-muted-foreground/70"}>{hasStoreDetailValue(typeValue) ? String(typeValue) : "Tipo não informado"}</span>
            <span className="text-muted-foreground">Vitrines</span>
            <span className={hasStoreDetailValue(storeAny.showcase_count) ? "" : "italic text-muted-foreground/70"}>{hasStoreDetailValue(storeAny.showcase_count) ? String(storeAny.showcase_count) : "Quantidade não informada"}</span>
            <span className="text-muted-foreground">Localização</span>
            <span className={locationParts ? "" : "italic text-muted-foreground/70"}>{locationParts || "Localização não informada"}</span>
            {filledCustomFields.length > 0 ? filledCustomFields.map((field) => (
              <Fragment key={field.label}>
                <span className="text-muted-foreground">{field.label}</span>
                <span className="break-words">{String(field.value)}</span>
              </Fragment>
            )) : (
              <>
                <span className="text-muted-foreground">Campos personalizados</span>
                <span className="italic text-muted-foreground/70">Nenhum preenchido</span>
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

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

  const { isAdmin, isAdminOrMaster } = useUserRole();
  const lalPerms = useLojaALojaPermissions(campaignId, clientId);

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
  const storeDetailCustomFieldLabels = useMemo(() => Array.from({ length: 10 }, (_, idx) => {
    const i = idx + 1;
    const label = (client as any)?.[`custom_field_${i}_label`];
    return label ? { key: `custom_field_${i}`, label } : null;
  }).filter((field): field is StoreDetailCustomField => field !== null), [client]);
  // Auto-sync language based on client config
  useLanguage((client as any)?.language);
  const { data: campaign, isLoading: loadingCampaign } = useCampaign(campaignId);
  const { data: stores = [] } = useClientStores(clientId);
  const { data: clientStoreModels = [] } = useClientStoreModels(clientId);
  const { data: pieces = [], isLoading: loadingPieces } = useCampaignPieces(campaignId);
  const { data: storePieces = [] } = useCampaignStorePieces(campaignId);
  const { data: activeAdjustment } = useActiveAdjustment(campaignId);
  const addPiece = useAddCampaignPiece();
  const deletePiece = useDeleteCampaignPiece();
  const updatePiece = useUpdateCampaignPiece();
  const updateStorePiece = useUpdateCampaignStorePiece();
  const bulkUpdateStorePieces = useBulkUpdateCampaignStorePieces();

  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [rateioBackupOpen, setRateioBackupOpen] = useState(false);

  // ─── Negotiation rateio (isolated distribution for the winning supplier) ───
  const [rateioSource, setRateioSource] = useState<"original" | "negotiation" | "adjustment">("original");
  const { data: winnerNegSupplier } = useQuery({
    queryKey: ["winner_neg_supplier", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_suppliers")
        .select("id, company_name, negotiation_status")
        .eq("campaign_id", campaignId as string)
        .eq("is_winner", true)
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data as { id: string; company_name: string; negotiation_status: string | null } | null;
    },
  });
  const winnerSupplierId = winnerNegSupplier?.id ?? null;
  const winnerSupplierName = winnerNegSupplier?.company_name ?? "";
  const { data: negRateioExists, isFetching: negRateioFetching } = useQuery({
    queryKey: ["neg_rateio_exists", winnerSupplierId],
    enabled: !!winnerSupplierId,
    queryFn: async () => {
      const { count } = await supabase
        .from("budget_negotiation_store_pieces" as never)
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", winnerSupplierId as string);
      return (count ?? 0) > 0;
    },
  });
  const hasNegotiationRateio = negRateioExists === true;
  const isNegotiationView = rateioSource === "negotiation" && hasNegotiationRateio && !!winnerSupplierId;
  const isAdjustmentView = rateioSource === "adjustment" && !!activeAdjustment;
  const activeAdjustmentId = activeAdjustment?.id ?? null;
  // Only revert to original once the existence query has settled, to avoid
  // racing the snapshot insert triggered by "Editar Rateio da Negociação".
  useEffect(() => {
    if (rateioSource === "negotiation" && !hasNegotiationRateio && !negRateioFetching) {
      setRateioSource("original");
    }
    if (rateioSource === "adjustment" && !activeAdjustment) {
      setRateioSource("original");
    }
  }, [rateioSource, hasNegotiationRateio, negRateioFetching, activeAdjustment]);

  const handleCancelNegotiationRateio = useCallback(async () => {
    if (!winnerSupplierId) return;
    const toastId = "cancel-negotiation-rateio";
    toast.loading("Cancelando negociação...", { id: toastId });
    try {
      await cancelNegotiationRateio(winnerSupplierId, campaignId);
      setRateioSource("original");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["winner_neg_supplier", campaignId] }),
        queryClient.invalidateQueries({ queryKey: ["neg_rateio_exists", winnerSupplierId] }),
        queryClient.invalidateQueries({ queryKey: ["negotiation_store_pieces", winnerSupplierId] }),
        queryClient.invalidateQueries({ queryKey: ["budget_suppliers", campaignId] }),
        queryClient.invalidateQueries({ queryKey: ["budget_prices", campaignId] }),
        queryClient.invalidateQueries({ queryKey: ["budget_extra_costs", campaignId] }),
        queryClient.invalidateQueries({ queryKey: ["budget_negotiation_rateio_totals", campaignId] }),
      ]);
      toast.success("Negociação cancelada. O rateio original congelado foi preservado.", { id: toastId });
    } catch (error: any) {
      toast.error(error?.message || "Erro ao cancelar negociação.", { id: toastId });
    }
  }, [campaignId, queryClient, winnerSupplierId]);

  const handleResetNegotiationRateio = useCallback(async () => {
    if (!campaignId || !winnerSupplierId) return;
    const toastId = "reset-negotiation-rateio";
    toast.loading("Restaurando rateio da negociação...", { id: toastId });
    try {
      await resetNegotiationRateioFromOriginal(winnerSupplierId, campaignId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["negotiation_store_pieces", winnerSupplierId] }),
        queryClient.invalidateQueries({ queryKey: ["neg_rateio_exists", winnerSupplierId] }),
        queryClient.invalidateQueries({ queryKey: ["budget_negotiation_rateio_totals", campaignId] }),
      ]);
      toast.success("Rateio da negociação restaurado igual ao original congelado.", { id: toastId });
    } catch (error: any) {
      toast.error(error?.message || "Erro ao restaurar rateio da negociação.", { id: toastId });
    }
  }, [campaignId, queryClient, winnerSupplierId]);

  const { data: negotiationStorePieces = [] } = useNegotiationStorePieces(
    winnerSupplierId,
    campaignId,
    isNegotiationView
  );
  const updateNegotiationStorePiece = useUpdateNegotiationStorePiece();
  const { data: adjustmentStorePieces = [] } = useAdjustmentStorePieces(
    isAdjustmentView ? (activeAdjustmentId ?? undefined) : undefined
  );
  const updateAdjustmentStorePiece = useUpdateAdjustmentStorePiece();
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
  const reorderKitPieces = useReorderCampaignKitPieces();

  const [pieceImportOpen, setPieceImportOpen] = useState(false);

  const handlePiecesImport = async (
    rows: Record<string, string>[],
    { updateExisting }: { updateExisting: boolean },
  ) => {
    if (!campaignId) return;
    const total = rows.length;
    const toastId = "pieces-import";
    toast.loading(`Importando ${total} peça(s)...`, { id: toastId });
    let added = 0, updated = 0, processed = 0;
    try {
      for (const row of rows) {
        const item = {
          name: row.name ?? "",
          code: parseInt(row.code ?? "0", 10) || 0,
          category: row.category || "",
          size: row.size || "",
          specification: row.specification || "Vide Book/Manual",
          store_category: row.store_category || null,
          installation_instructions: row.installation_instructions || "Sem informações específicas",
          sub_location: row.sub_location || null,
          kit_only: ["true", "1", "sim", "yes"].includes(String(row.kit_only ?? "").toLowerCase()),
        };
        const existing = pieces.find(p => p.name.toLowerCase() === item.name.toLowerCase());
        if (existing && updateExisting) {
          await updatePiece.mutateAsync({ id: existing.id, ...item } as any);
          updated++;
        } else {
          await addPiece.mutateAsync({ campaign_id: campaignId, ...item } as any);
          added++;
        }
        processed++;
        toast.loading(`Importando ${processed}/${total} peça(s)...`, { id: toastId });
      }
      const parts: string[] = [];
      if (added > 0) parts.push(`${added} adicionada(s)`);
      if (updated > 0) parts.push(`${updated} atualizada(s)`);
      toast.success(parts.length > 0 ? parts.join(", ") + "!" : "Nenhuma alteração.", { id: toastId });
    } catch (e: any) {
      toast.error(`Erro ao importar: ${e?.message || e}`, { id: toastId });
    }
  };

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
  const [orderByLocationOpen, setOrderByLocationOpen] = useState(false);

  // ─── Pending occurrences dashboard ─────────────────────
  const [pendingDashOpen, setPendingDashOpen] = useState(false);
  const { data: occMotives = [] } = useOccurrenceMotives();
  const { data: occStatuses = [] } = useOccurrenceStatuses();

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
    is_new: false,
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
    is_new: false,
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
  const [pendingInitialFilter, setPendingInitialFilter] = useState<DashboardFilter | null>(null);
  const [pieceSearch, setPieceSearch] = useState("");
  const [newFilter, setNewFilter] = useState<"all" | "new" | "not_new">("all");

  // Sync section from router state/search/path. Campaign changes without ?section must always open the campaign hub.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextSection = params.get("section") || locationState?.initialSection || null;
    setActiveSectionState((current) => current === nextSection ? current : nextSection);
    if (!nextSection) setPendingInitialFilter(null);
  }, [campaignId, location.pathname, location.search, locationState?.initialSection]);

  const setActiveSection = useCallback((section: string | null) => {
    setActiveSectionState(section);
    // Keep React Router location in sync so changing campaigns can reset to the hub reliably.
    const params = new URLSearchParams(location.search);
    if (section) {
      params.set("section", section);
    } else {
      params.delete("section");
    }
    const newUrl = `${location.pathname}${params.toString() ? `?${params}` : ""}`;
    navigate(newUrl, { replace: true, state: location.state });
  }, [location.pathname, location.search, location.state, navigate]);

  // ─── Matrix editing ────────────────────────────────────
  const [editingCell, setEditingCell] = useState<{ storeId: string; pieceId: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const editingInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const editingCellRef = useRef<{ storeId: string; pieceId: string } | null>(null);
  const editValueRef = useRef("");
  const skipBlurSaveRef = useRef<string | null>(null);
  const [importMatrixDialogOpen, setImportMatrixDialogOpen] = useState(false);
  const [pieceFilters, setPieceFilters] = useState<PieceFilters>({ ...EMPTY_FILTERS });
  const [storeFilters, setStoreFilters] = useState<StoreFilters>({ ...EMPTY_STORE_FILTERS });
  const [filterLogicMode, setFilterLogicMode] = useState<FilterLogicMode>("and_or");
  const [filterSidebarCollapsed, setFilterSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('produzai_matrix_filters_open');
      return saved === null ? true : saved === 'collapsed';
    } catch { return true; }
  });
  
  const [matrixCustomExportOpen, setMatrixCustomExportOpen] = useState(false);
  const [resetMatrixOpen, setResetMatrixOpen] = useState(false);
  const [resettingMatrix, setResettingMatrix] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [copyQtyOpen, setCopyQtyOpen] = useState(false);
  const [budgetExportDialogOpen, setBudgetExportDialogOpen] = useState(false);
  const [rateioGridExportOpen, setRateioGridExportOpen] = useState(false);
  const [rateioView, setRateioView] = useState<"planilha" | "dashboard">(() => {
    try {
      const v = localStorage.getItem("produzai_rateio_view");
      return v === "dashboard" ? "dashboard" : "planilha";
    } catch { return "planilha"; }
  });
  const handleRateioViewChange = useCallback((v: string) => {
    const next = v === "dashboard" ? "dashboard" : "planilha";
    setRateioView(next);
    try { localStorage.setItem("produzai_rateio_view", next); } catch {}
  }, []);
  const [matrixToolbarCollapsed, setMatrixToolbarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('produzai_matrix_toolbar') === 'collapsed'; } catch { return false; }
  });
  const toggleMatrixToolbar = useCallback(() => {
    setMatrixToolbarCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem('produzai_matrix_toolbar', next ? 'collapsed' : 'expanded'); } catch {}
      return next;
    });
  }, []);

  const handleFilterSidebarCollapsedChange = useCallback((collapsed: boolean) => {
    setFilterSidebarCollapsed(collapsed);
    try { localStorage.setItem('produzai_matrix_filters_open', collapsed ? 'collapsed' : 'expanded'); } catch {}
  }, []);

  // Dynamic height for matrix container — fits to remaining viewport
  const matrixContainerRef = useRef<HTMLDivElement | null>(null);
  const [matrixHeight, setMatrixHeight] = useState<number>(() =>
    typeof window !== "undefined" ? Math.max(400, window.innerHeight - 200) : 600,
  );
  useEffect(() => {
    const recompute = () => {
      const el = matrixContainerRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const available = window.innerHeight - top - 16; // small bottom gap
      setMatrixHeight(Math.max(360, available));
    };
    recompute();
    window.addEventListener("resize", recompute);
    const id = window.setTimeout(recompute, 50);
    return () => {
      window.removeEventListener("resize", recompute);
      window.clearTimeout(id);
    };
  }, [activeSection, filterSidebarCollapsed]);

  // ─── Derived data ──────────────────────────────────────
  const qtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (isNegotiationView) {
      negotiationStorePieces.forEach((sp) => { map[`${sp.store_id}-${sp.piece_id}`] = Number(sp.quantity) || 0; });
    } else if (isAdjustmentView) {
      (adjustmentStorePieces as any[]).forEach((sp) => { map[`${sp.store_id}-${sp.piece_id}`] = Number(sp.quantity) || 0; });
    } else {
      storePieces.forEach((sp) => { map[`${sp.store_id}-${sp.piece_id}`] = sp.quantity; });
    }
    return map;
  }, [storePieces, negotiationStorePieces, adjustmentStorePieces, isNegotiationView, isAdjustmentView]);

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

      // Apply sidebar store filters with logic mode
      const sf = storeFilters;
      const storeChecks: boolean[] = [];
      if (sf.city.size > 0) storeChecks.push(!!s.city && sf.city.has(s.city));
      if (sf.state.size > 0) storeChecks.push(!!s.state && sf.state.has(s.state.trim()));
      if (sf.store_model.size > 0) storeChecks.push(!!s.store_model && sf.store_model.has(s.store_model));
      for (let i = 1; i <= 15; i++) {
        const key = `custom_field_${i}` as keyof typeof sf;
        const set = (sf as any)[key] as Set<string> | undefined;
        if (set && set.size > 0) {
          const val = (s as any)[key];
          storeChecks.push(!!val && set.has(val));
        }
      }

      if (storeChecks.length > 0) {
        if (filterLogicMode === "and" || filterLogicMode === "and_or") {
          if (!storeChecks.every(Boolean)) return false;
        } else {
          // "or" mode
          if (!storeChecks.some(Boolean)) return false;
        }
      }

      return matchesSearch && matchesCity && matchesState && matchesStoreCategory;
    }).sort((a, b) => {
      const stateComp = (a.state || "").localeCompare(b.state || "");
      if (stateComp !== 0) return stateComp;
      return a.name.localeCompare(b.name);
    });
  }, [stores, storeSearch, cityFilter, stateFilter, storeCategoryFilter, storeFilters, filterLogicMode]);

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
    // Validate duplicate name (against pieces + kits in this campaign)
    const dup = findDuplicateName(pieceForm.name, pieces, kits);
    if (dup) {
      toast.error(duplicateNameMessage(dup));
      return;
    }
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
      sub_location: (pieceForm.sub_location && pieceForm.sub_location !== "__none__") ? pieceForm.sub_location : undefined,
      specification: pieceForm.specification,
      installation_instructions: pieceForm.installation_instructions,
      kit_only: pieceForm.kit_only,
      is_mockup: pieceForm.is_mockup,
      is_new: pieceForm.is_new,
      display_order: maxOrder + 1,
      image_url: pieceForm.image_url || undefined,
    } as any);
    setPieceForm({
      code: "", category: "", sub_location: "", name: "",
      width: "", length: "", height: "",
      store_category: pieceForm.store_category,
      specification: "Vide Book/Manual",
      installation_instructions: "Sem informações específicas",
      kit_only: false,
      is_mockup: false,
      is_new: false,
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
      sub_location: piece.sub_location || "",
      name: piece.name,
      width: sizeParts[0] || "",
      height: sizeParts[1] || "",
      length: sizeParts[2] || "",
      store_category: piece.store_category || "",
      specification: piece.specification || "Vide Book/Manual",
      installation_instructions: piece.installation_instructions || "Sem informações específicas",
      kit_only: piece.kit_only || false,
      is_mockup: piece.is_mockup || false,
      is_new: (piece as any).is_new || false,
      image_url: piece.image_url || "",
    });
    setEditPieceDialogOpen(true);
  };

  const handleEditPiece = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate duplicate name (ignore the piece being edited)
    const dup = findDuplicateName(editPieceForm.name, pieces, kits, { ignorePieceId: editPieceForm.id });
    if (dup) {
      toast.error(duplicateNameMessage(dup));
      return;
    }
    const size = [editPieceForm.width, editPieceForm.height, editPieceForm.length].filter(Boolean).join(" x ");
    const code = editPieceForm.code ? parseInt(editPieceForm.code) : nextPieceCode.seq;
    await updatePiece.mutateAsync({
      id: editPieceForm.id,
      code,
      category: editPieceForm.category,
      name: editPieceForm.name,
      size,
      store_category: editPieceForm.store_category || null,
      sub_location: (editPieceForm.sub_location && editPieceForm.sub_location !== "__none__") ? editPieceForm.sub_location : null,
      specification: editPieceForm.specification,
      installation_instructions: editPieceForm.installation_instructions,
      kit_only: editPieceForm.kit_only,
      is_mockup: editPieceForm.is_mockup,
      is_new: editPieceForm.is_new,
      image_url: editPieceForm.image_url || null,
    } as any);
    setEditPieceDialogOpen(false);
  };

  const handleReviewPieceCodes = async () => {
    const piecesWithoutCode = pieces.filter((p) => !p.code || p.code === 0);
    if (piecesWithoutCode.length === 0) {
      toast.info("Todas as peças já possuem código.");
      return;
    }
    const total = piecesWithoutCode.length;
    const toastId = "review-piece-codes";
    toast.loading(`Revisando códigos de ${total} peça(s)...`, { id: toastId });
    const usedNumbers = new Set<number>(pieces.filter((p) => p.code && p.code > 0).map((p) => p.code));
    let count = 0;
    try {
      for (const piece of piecesWithoutCode) {
        let seq = 1;
        while (usedNumbers.has(seq)) seq++;
        usedNumbers.add(seq);
        await updatePiece.mutateAsync({ id: piece.id, code: seq });
        count++;
        toast.loading(`Revisando códigos ${count}/${total}...`, { id: toastId });
      }
      toast.success(`${count} peça(s) receberam código automaticamente.`, { id: toastId });
    } catch (e: any) {
      toast.error(`Erro ao revisar códigos: ${e?.message || e}`, { id: toastId });
    }
  };

  const focusEditingCell = useCallback((cell: { storeId: string; pieceId: string } | null) => {
    if (!cell) return;
    const el = editingInputRefs.current[`${cell.storeId}-${cell.pieceId}`];
    if (el && document.activeElement !== el) {
      el.focus();
    }
  }, []);

  useEffect(() => {
    editingCellRef.current = editingCell;
  }, [editingCell]);

  // Focus only depends on editingCell — never on qtyMap or query data.
  useEffect(() => {
    if (!editingCell) return;
    const rafId = requestAnimationFrame(() => focusEditingCell(editingCell));
    return () => cancelAnimationFrame(rafId);
  }, [editingCell, focusEditingCell]);

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

  // ─── Unified save: handles both piece and kit cells ───
  // Kit cells write to N component pieces. We use a SINGLE bulk mutation that
  // performs one optimistic update + parallel writes + ONE final invalidation.
  // This eliminates the prior race where N independent mutations could each
  // trigger their own onSettled → invalidateQueries, causing a partial refetch
  // to render Math.min(...) over kit components and make the value appear to
  // "disappear" — a bug that surfaced only on stores whose ONLY editable
  // cells are kit cells (Jardim Sul, Leblon, Outlet Premium Itupeva).
  const saveCell = useCallback((cell: { storeId: string; pieceId: string }, rawValue: string) => {
    if (!campaignId) return;
    const qty = Math.max(0, parseInt(rawValue) || 0);

    if (typeof window !== "undefined" && (window as any).__rateioDebug) {
      // eslint-disable-next-line no-console
      console.log("[CELL][SAVE]", { ...cell, rawValue, qty, isKit: cell.pieceId.startsWith("kit-"), source: isNegotiationView ? "negotiation" : "original" });
    }

    // ─── Adjustment rateio: write to campaign_adjustment_store_pieces ───
    if (isAdjustmentView && activeAdjustmentId) {
      if (cell.pieceId.startsWith("kit-")) {
        const kitId = cell.pieceId.replace("kit-", "");
        const piecesInKit = kitPieces.filter((kp) => kp.kit_id === kitId);
        for (const kp of piecesInKit) {
          updateAdjustmentStorePiece.mutate({
            adjustmentId: activeAdjustmentId,
            storeId: cell.storeId,
            pieceId: kp.piece_id,
            quantity: qty * (kp.quantity || 1),
          });
        }
        return;
      }
      updateAdjustmentStorePiece.mutate({
        adjustmentId: activeAdjustmentId,
        storeId: cell.storeId,
        pieceId: cell.pieceId,
        quantity: qty,
      });
      return;
    }

    // ─── Negotiation rateio: write to isolated table for the winning supplier ───
    if (isNegotiationView && winnerSupplierId) {
      if (cell.pieceId.startsWith("kit-")) {
        const kitId = cell.pieceId.replace("kit-", "");
        const piecesInKit = kitPieces.filter((kp) => kp.kit_id === kitId);
        for (const kp of piecesInKit) {
          updateNegotiationStorePiece.mutate({
            supplier_id: winnerSupplierId,
            campaign_id: campaignId,
            store_id: cell.storeId,
            piece_id: kp.piece_id,
            quantity: qty * (kp.quantity || 1),
          });
        }
        return;
      }
      updateNegotiationStorePiece.mutate({
        supplier_id: winnerSupplierId,
        campaign_id: campaignId,
        store_id: cell.storeId,
        piece_id: cell.pieceId,
        quantity: qty,
      });
      return;
    }

    if (cell.pieceId.startsWith("kit-")) {
      const kitId = cell.pieceId.replace("kit-", "");
      const piecesInKit = kitPieces.filter((kp) => kp.kit_id === kitId);
      if (piecesInKit.length === 0) return;

      bulkUpdateStorePieces.mutate({
        campaignId,
        storeId: cell.storeId,
        updates: piecesInKit.map((kp) => ({
          pieceId: kp.piece_id,
          quantity: qty * (kp.quantity || 1),
        })),
      });
      return;
    }

    updateStorePiece.mutate({
      campaignId,
      storeId: cell.storeId,
      pieceId: cell.pieceId,
      quantity: qty,
    });
  }, [campaignId, kitPieces, updateStorePiece, bulkUpdateStorePieces, isNegotiationView, winnerSupplierId, updateNegotiationStorePiece, isAdjustmentView, activeAdjustmentId, updateAdjustmentStorePiece]);

  // ─── Atomic transition: save current cell (if any) and open the new one ───
  // The save runs SYNCHRONOUSLY using editValueRef.current as the source of
  // truth — no setTimeout, no stale state. The ref is updated synchronously
  // by the input's onChange, so it always holds the very last keystroke.
  const getEditingCellKey = (storeId: string, pieceId: string) => `${storeId}-${pieceId}`;

  const markCurrentBlurAsHandled = useCallback(() => {
    const current = editingCellRef.current;
    skipBlurSaveRef.current = current ? getEditingCellKey(current.storeId, current.pieceId) : null;
  }, []);

  const switchToCell = useCallback((newStoreId: string, newPieceId: string) => {
    if (!canEditCampaign) return;
    const current = editingCellRef.current;
    const valueToSave = editValueRef.current ?? "";

    // Persist the previous cell first using the latest typed value.
    if (current && (current.storeId !== newStoreId || current.pieceId !== newPieceId)) {
      saveCell(current, valueToSave);
    }

    // Snapshot target qty for the destination cell AFTER the save call so
    // any optimistic update has already been folded into qtyMap-derived
    // reads on the next render. Using getCellQty here reads the current
    // cache snapshot directly (it does not need a re-render to be correct).
    const targetQty = getCellQty(newStoreId, newPieceId);
    const nextValue = targetQty > 0 ? String(targetQty) : "";

    // Update both ref and state synchronously so onBlur firing after this
    // transition reads the new (empty/numeric) value, never the previous.
    const nextCell = { storeId: newStoreId, pieceId: newPieceId };
    editValueRef.current = nextValue;
    editingCellRef.current = nextCell;
    setEditingCell(nextCell);
    setEditValue(nextValue);
  }, [canEditCampaign, saveCell, getCellQty]);

  // ─── Close editing: save current value and clear state ───
  const closeEditing = useCallback(() => {
    const current = editingCellRef.current;
    if (current) {
      // Read from ref — editValue closure may be stale relative to the
      // very last keystroke right before blur fires.
      saveCell(current, editValueRef.current ?? "");
    }
    editValueRef.current = "";
    editingCellRef.current = null;
    setEditingCell(null);
    setEditValue("");
  }, [saveCell]);

  const handleCellClick = (storeId: string, pieceId: string) => {
    // Suppress the blur-save from the previously-focused input; switchToCell
    // already handles saving the previous cell atomically.
    markCurrentBlurAsHandled();
    switchToCell(storeId, pieceId);
  };

  const handlePieceBlur = (storeId: string, pieceId: string) => {
    const blurredKey = getEditingCellKey(storeId, pieceId);
    if (skipBlurSaveRef.current === blurredKey) {
      skipBlurSaveRef.current = null;
      return;
    }
    closeEditing();
  };

  // Note: shared keyboard handler is defined inline in JSX (uses navigateMatrixCell which is declared later).


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

  // ─── Order pieces & kits by location (drag location bucket order) ───
  const locationItemsForOrdering = useMemo(() => {
    // Combine pieces (excluding kit-only pieces) + kits with their effective location
    const items: { id: string; type: "piece" | "kit"; name: string; location: string }[] = [];
    visiblePieces.forEach((p) => {
      items.push({ id: p.id, type: "piece", name: p.name || "", location: (p.category || "").trim() });
    });
    kits.forEach((k) => {
      // Inline equivalent of getKitCategory (declared later) to avoid forward reference
      let kitLoc = (k.category || "").trim();
      if (!kitLoc) {
        const kpRows = kitPieces.filter((kp) => kp.kit_id === k.id);
        for (const kp of kpRows) {
          const piece = pieces.find((p) => p.id === kp.piece_id);
          if (piece?.category) { kitLoc = piece.category.trim(); break; }
        }
      }
      items.push({ id: k.id, type: "kit", name: k.name || "", location: kitLoc });
    });
    return items;
  }, [visiblePieces, kits, kitPieces, pieces]);

  const distinctLocations = useMemo(() => {
    const set = new Set<string>();
    locationItemsForOrdering.forEach((it) => set.add(it.location));
    // Stable order: alphabetical, "" (no location) last
    const arr = Array.from(set);
    const named = arr.filter((l) => l !== "").sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    const hasNone = arr.includes("");
    return hasNone ? [...named, ""] : named;
  }, [locationItemsForOrdering]);

  const countsByLocation = useMemo(() => {
    const map: Record<string, number> = {};
    locationItemsForOrdering.forEach((it) => {
      map[it.location] = (map[it.location] || 0) + 1;
    });
    return map;
  }, [locationItemsForOrdering]);

  const handleApplyOrderByLocation = useCallback(async (orderedLocations: string[]) => {
    if (!campaignId) return;
    // Build the new global order: for each location in given order, items sorted alphabetically by name (pieces+kits mixed)
    const grouped = new Map<string, { id: string; type: "piece" | "kit"; name: string }[]>();
    orderedLocations.forEach((loc) => grouped.set(loc, []));
    locationItemsForOrdering.forEach((it) => {
      const bucket = grouped.get(it.location);
      if (bucket) bucket.push({ id: it.id, type: it.type, name: it.name });
    });

    const finalSequence: { id: string; type: "piece" | "kit" }[] = [];
    orderedLocations.forEach((loc) => {
      const bucket = grouped.get(loc) || [];
      bucket.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
      bucket.forEach((b) => finalSequence.push({ id: b.id, type: b.type }));
    });

    const toastId = "order-by-location";
    const totalOps = finalSequence.length + finalSequence.filter(i => i.type === "kit").reduce((acc, i) => acc + kitPieces.filter(kp => kp.kit_id === i.id).length, 0);
    toast.loading(`Aplicando ordem a ${totalOps} item(ns)...`, { id: toastId });

    // Persist new display_order (1-indexed) to DB, only when changed
    let reorderCount = 0;
    let processed = 0;
    try {
      for (let i = 0; i < finalSequence.length; i++) {
        const item = finalSequence[i];
        const newOrder = i + 1;
        if (item.type === "piece") {
          const p = visiblePieces.find((x) => x.id === item.id);
          if (p && p.display_order !== newOrder) {
            await supabase.from("campaign_pieces").update({ display_order: newOrder }).eq("id", item.id);
            reorderCount++;
          }
        } else {
          const k = kits.find((x) => x.id === item.id);
          if (k && k.display_order !== newOrder) {
            await supabase.from("campaign_kits").update({ display_order: newOrder }).eq("id", item.id);
            reorderCount++;
          }
        }
        processed++;
        toast.loading(`Reordenando ${processed}/${totalOps}...`, { id: toastId });
      }

      // Recodificar sequencialmente
      let code = 1;
      let recodeCount = 0;
      processed = 0;
      for (const item of finalSequence) {
        if (item.type === "piece") {
          const piece = visiblePieces.find((p) => p.id === item.id);
          if (piece && piece.code !== code) {
            await supabase.from("campaign_pieces").update({ code }).eq("id", item.id);
            recodeCount++;
          }
          code++;
          processed++;
          toast.loading(`Recodificando ${processed}/${totalOps}...`, { id: toastId });
        } else {
          const kit = kits.find((k) => k.id === item.id);
          if (kit && kit.code !== code) {
            await supabase.from("campaign_kits").update({ code }).eq("id", item.id);
            recodeCount++;
          }
          processed++;
          toast.loading(`Recodificando ${processed}/${totalOps}...`, { id: toastId });
          const kitPiecesForKit = kitPieces.filter((kp) => kp.kit_id === item.id);
          let kitPieceCode = code + 1;
          for (const kp of kitPiecesForKit) {
            const piece = kitOnlyPieces.find((p) => p.id === kp.piece_id);
            if (piece && piece.code !== kitPieceCode) {
              await supabase.from("campaign_pieces").update({ code: kitPieceCode }).eq("id", kp.piece_id);
              recodeCount++;
            }
            kitPieceCode++;
            processed++;
            toast.loading(`Recodificando ${processed}/${totalOps}...`, { id: toastId });
          }
          code = kitPieceCode;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["campaign_pieces"] });
      queryClient.invalidateQueries({ queryKey: ["campaign_kits"] });
      toast.success(`Ordem aplicada! ${reorderCount} item(ns) reordenado(s) e ${recodeCount} código(s) atualizado(s).`, { id: toastId });
    } catch (e: any) {
      toast.error(`Erro ao aplicar ordem: ${e?.message || e}`, { id: toastId });
    }
  }, [campaignId, locationItemsForOrdering, visiblePieces, kits, kitPieces, kitOnlyPieces, queryClient]);

  const handleRecodificar = async () => {
    const allItems: { type: "piece" | "kit"; id: string; display_order: number }[] = [
      ...visiblePieces.map(p => ({ type: "piece" as const, id: p.id, display_order: p.display_order })),
      ...kits.map(k => ({ type: "kit" as const, id: k.id, display_order: k.display_order })),
    ].sort((a, b) => a.display_order - b.display_order);

    const toastId = "recodificar";
    const totalItems = allItems.length + kits.reduce((acc, k) => acc + kitPieces.filter(kp => kp.kit_id === k.id).length, 0);
    toast.loading(`Recodificando ${totalItems} item(ns)...`, { id: toastId });

    let code = 1;
    let count = 0;
    let processed = 0;
    try {
      for (const item of allItems) {
        if (item.type === "piece") {
          const piece = visiblePieces.find(p => p.id === item.id);
          if (piece && piece.code !== code) {
            await supabase.from("campaign_pieces").update({ code }).eq("id", item.id);
            count++;
          }
          processed++;
          toast.loading(`Recodificando ${processed}/${totalItems}...`, { id: toastId });
        } else {
          const kit = kits.find(k => k.id === item.id);
          if (kit && kit.code !== code) {
            await supabase.from("campaign_kits").update({ code }).eq("id", item.id);
            count++;
          }
          processed++;
          toast.loading(`Recodificando ${processed}/${totalItems}...`, { id: toastId });
          const kitPiecesForKit = kitPieces.filter(kp => kp.kit_id === item.id);
          let kitPieceCode = code + 1;
          for (const kp of kitPiecesForKit) {
            const piece = kitOnlyPieces.find(p => p.id === kp.piece_id);
            if (piece && piece.code !== kitPieceCode) {
              await supabase.from("campaign_pieces").update({ code: kitPieceCode }).eq("id", kp.piece_id);
              count++;
            }
            kitPieceCode++;
            processed++;
            toast.loading(`Recodificando ${processed}/${totalItems}...`, { id: toastId });
          }
          code = kitPieceCode;
          continue;
        }
        code++;
      }
      queryClient.invalidateQueries({ queryKey: ["campaign_pieces"] });
      queryClient.invalidateQueries({ queryKey: ["campaign_kits"] });
      if (count > 0) {
        toast.success(`${count} código(s) atualizado(s) sequencialmente!`, { id: toastId });
      } else {
        toast.info("Os códigos já estão em ordem sequencial.", { id: toastId });
      }
    } catch (e: any) {
      toast.error(`Erro ao recodificar: ${e?.message || e}`, { id: toastId });
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
      <div className="flex items-center justify-between p-3 rounded-lg border border-green-500/20 bg-green-500/5">
        <div>
          <label className="text-xs font-medium text-foreground">Peça Nova</label>
          <p className="text-[10px] text-muted-foreground">Marcar como peça nova na campanha</p>
        </div>
        <Switch checked={form.is_new} onCheckedChange={(checked) => setForm((f) => ({ ...f, is_new: checked }))} />
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
          <Select value={form.category} onValueChange={(val) => setForm((f) => ({ ...f, category: val, sub_location: "" }))}>
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
      {/* Sub-location selector */}
      {(() => {
        const selectedParent = pieceLocations.find((l) => l.name === form.category);
        const availableSubs = selectedParent ? pieceSubLocations.filter((s) => s.location_id === selectedParent.id) : [];
        if (availableSubs.length === 0) return null;
        return (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Sub-localização</label>
            <Select value={form.sub_location} onValueChange={(val) => setForm((f) => ({ ...f, sub_location: val }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhuma —</SelectItem>
                {availableSubs.map((sub) => <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        );
      })()}
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
      <div className="flex flex-wrap gap-3 items-end">
        {uniqueStates.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t("stores.state")}</label>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[110px] sm:w-[150px] text-xs">
                <SelectValue placeholder={t("stores.state")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("common.all")}</SelectItem>
                {uniqueStates.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {uniqueCities.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t("stores.city")}</label>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-[120px] sm:w-[190px] text-xs">
                <SelectValue placeholder={t("stores.city")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("common.allFeminine")}</SelectItem>
                {uniqueCities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {uniqueStoreCategories.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Categoria de loja</label>
            <Select value={storeCategoryFilter} onValueChange={setStoreCategoryFilter}>
              <SelectTrigger className="w-[120px] sm:w-[190px] text-xs">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("common.allFeminine")}</SelectItem>
                {uniqueStoreCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <span className="text-xs text-muted-foreground pb-2">{filteredStores.length} {t("stores.storeCount")}</span>
      </div>
    </div>
  );

  // ─── Filtered pieces for matrix (by store_category + piece filters) ───
  const matrixPieces = useMemo(() => {
    let filtered = storeCategoryFilter === "__all__"
      ? visiblePieces
      : visiblePieces.filter((p) => p.store_category === storeCategoryFilter);

    // Apply piece sidebar filters with logic mode
    const f = pieceFilters;
    const activeChecks: ((p: typeof filtered[0]) => boolean)[] = [];
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
        if (filterLogicMode === "and" || filterLogicMode === "and_or") {
          return results.every(Boolean);
        } else {
          return results.some(Boolean);
        }
      });
    }

    return filtered;
  }, [visiblePieces, storeCategoryFilter, pieceFilters, filterLogicMode]);

  // Kits appear as virtual columns in the matrix
  const matrixKits = kits;

  const getKitCategory = useCallback((kit: CampaignKit) => {
    if (kit.category) return kit.category;
    const kpRows = kitPieces.filter((kp) => kp.kit_id === kit.id);
    for (const kp of kpRows) {
      const piece = pieces.find((p) => p.id === kp.piece_id);
      if (piece?.category) return piece.category;
    }
    return null;
  }, [kitPieces, pieces]);

  // Unified matrix columns sorted by display_order with deterministic tiebreakers.
  // Memoized to keep stable column identity across re-renders (prevents focus loss
  // / value drop when display_order collisions exist between pieces and kits).
  type MatrixCol = { type: "piece"; data: CampaignPiece; display_order: number } | { type: "kit"; data: CampaignKit; display_order: number };
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

  // Alternating background tints per column based on location (changes whenever location changes)
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
          history: "Histórico", mockup: "Mockup",
        };
        const crumbs = [
          { label: agency?.name || "Agência", href: isLimitedMode ? undefined : "/" },
          { label: client?.name || "Cliente", href: isLimitedMode ? undefined : `/agency/${agencyId}/clients/${clientId}` },
          { label: campaign.name, href: isLimitedMode ? undefined : `/agency/${agencyId}/clients/${clientId}/campaigns/${campaignId}` as string | undefined },
        ];
        if (activeSection) {
          crumbs.push({ label: SECTION_LABELS[activeSection] || activeSection, href: undefined });
        }
        return crumbs;
      })()}
    >
        {/* ─── HOME VIEW: Material de Apoio + Nav Buttons ─── */}
        {!activeSection && !isLimitedMode && (
          <>
            {/* Inline KPI stats */}
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-baseline gap-3 flex-wrap">
                <button onClick={() => setActiveSection("stores")} className="inline-flex items-baseline gap-1.5 group cursor-pointer">
                  <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{stores.length}</span>
                  <span className="text-[13px] group-hover:underline" style={{ color: "var(--text-muted)" }}>{t("stores.registered")}</span>
                </button>
                <span style={{ color: "var(--border-default)", fontSize: "16px" }}>·</span>
                <button onClick={() => setActiveSection("pieces")} className="inline-flex items-baseline gap-1.5 group cursor-pointer">
                  <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{visiblePieces.length + kits.length}</span>
                  <span className="text-[13px] group-hover:underline" style={{ color: "var(--text-muted)" }}>{t("pieces.registered")}</span>
                </button>
                {activeAdjustment && (
                  <button
                    onClick={() => setActiveSection("adjustments")}
                    className="ml-2"
                    title="Ver ajustes de mockup"
                  >
                    <Badge variant="outline" className="border-amber-400 text-amber-700 gap-1 cursor-pointer">
                      <Layers className="w-3 h-3" />
                      Ajuste ativo: {activeAdjustment.name}
                    </Badge>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isAdminOrMaster && (
                  <ExportAllPhotosDialog
                    campaignId={campaignId!}
                    campaignName={campaign?.name || ""}
                  />
                )}
                {isAdminOrMaster && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8"
                    onClick={() => setBackupDialogOpen(true)}
                  >
                    <Database className="w-3.5 h-3.5" /> Backup
                  </Button>
                )}
                {(isAdmin || canEditCampaign) && (
                  <ExportReportDropdown
                    campaignId={campaignId!}
                    clientId={clientId!}
                    campaignName={campaign?.name || ""}
                    clientName={client?.name || ""}
                  />
                )}
              </div>
            </div>

            <CampaignStatusDashboard
              campaignId={campaignId!}
              onNavigate={(section, filter) => {
                setPendingInitialFilter(filter ?? null);
                setActiveSection(section);
              }}
            />

            {/* [REMOVE-CANDIDATE] Botão "Pendências" do módulo antigo de Ocorrências — desabilitado.
            {canViewOccurrences && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setPendingDashOpen(true)}>
                <AlertTriangle className="w-3.5 h-3.5" /> Pendências
              </Button>
            )}
            */}

            <SupportMaterialsSection campaignId={campaignId!} canEdit={canEditCampaign} />

            {/* Navigation Buttons */}
            <ModuleGrid
              items={[
                { key: "scheduling", label: t("modules.scheduling"), icon: CalendarDays, visible: canViewSchedules, color: "#5C6B3F" },
                { key: "installations", label: t("modules.installations"), icon: Camera, visible: canViewInstallations, color: "#7B5E3A" },
                { key: "loja_a_loja", label: t("modules.loja_a_loja"), icon: LayoutGrid, visible: lalPerms.canViewModule, color: "#5B7B5E" },
                { key: "stores", label: t("modules.stores"), icon: Store, visible: canViewStores || canViewCampaignStores, color: "#6B4F2E" },
                { key: "occurrences", label: t("modules.occurrences"), icon: AlertTriangle, visible: lalPerms.ocorrencias.canView, color: "#7A3B2E" },
                { key: "budgets", label: t("modules.budgets"), icon: DollarSign, visible: isAdmin, color: "#4A5568" },
                { key: "adjustments", label: "Ajustes", icon: Layers, visible: isAdminOrMaster, color: "#6E5A7A" },
                { key: "pieces", label: t("modules.pieces"), icon: LayoutList, visible: canViewPieces, color: "#A07850" },
                { key: "matrix", label: t("modules.matrix"), icon: Grid3X3, visible: canViewCampaignStores, color: "#8C6F4E" },
                { key: "mockup", label: "Mockup", icon: LayoutGrid, visible: true, color: "#7A6A8C" },
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
            <div ref={matrixContainerRef} className="flex flex-col lg:flex-row border border-border rounded-xl overflow-hidden bg-card -mx-2 sm:-mx-4" style={{ height: matrixHeight }}>
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
                customFieldLabels={Array.from({ length: 15 }, (_, idx) => {
                  const i = idx + 1;
                  const label = (client as any)?.[`custom_field_${i}_label`];
                  return label ? { key: `custom_field_${i}` as any, label } : null;
                }).filter((x): x is { key: any; label: string } => x !== null)}
                filterLogicMode={filterLogicMode}
                onFilterLogicModeChange={setFilterLogicMode}
              />

              {/* Matrix Content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <Tabs value={rateioView} onValueChange={handleRateioViewChange} className="flex-1 flex flex-col overflow-hidden">
                  <div className="border-b border-border bg-muted/20 px-2 sm:px-3 pt-2">
                    <TabsList className="h-8 bg-muted/60">
                      <TabsTrigger value="planilha" className="text-xs gap-1.5 h-6 px-2.5">
                        <Table2 className="w-3.5 h-3.5" />
                        Planilha
                      </TabsTrigger>
                      <TabsTrigger value="dashboard" className="text-xs gap-1.5 h-6 px-2.5">
                        <BarChart3Icon className="w-3.5 h-3.5" />
                        Dashboard
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="planilha" className="flex-1 flex flex-col overflow-hidden mt-0 data-[state=inactive]:hidden">
                {/* Active adjustment hint */}
                {activeAdjustment && rateioSource === "original" && (
                  <div className="border-b border-amber-200 bg-amber-50 dark:bg-amber-900/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Existe um ajuste ativo (<strong>{activeAdjustment.name}</strong>). O rateio original está sendo exibido.{" "}
                      <button className="underline ml-1" onClick={() => setRateioSource("adjustment")}>
                        Ver rateio do ajuste
                      </button>
                    </span>
                  </div>
                )}
                {/* Negotiation rateio banner + source toggle */}
                {hasNegotiationRateio && winnerSupplierId && (
                  <div
                    className={`border-b px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      isNegotiationView
                        ? "border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/10"
                        : "border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10"
                    }`}
                  >
                    <div className={`text-xs flex items-start gap-2 ${
                      isNegotiationView ? "text-blue-900 dark:text-blue-200" : "text-amber-900 dark:text-amber-200"
                    }`}>
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>
                        {isNegotiationView
                          ? <>Editando <strong>rateio de negociação</strong> — <strong>{winnerSupplierName}</strong>. Alterações aqui não afetam o rateio original.</>
                          : <>⚠️ Existe uma negociação ativa com <strong>{winnerSupplierName}</strong>. O rateio de negociação é independente do rateio original.</>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant={rateioSource === "original" ? "default" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => setRateioSource("original")}
                      >
                        Rateio Original
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={rateioSource === "negotiation" ? "default" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => setRateioSource("negotiation")}
                      >
                        Rateio da Negociação
                      </Button>
                      {isNegotiationView && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs ml-1"
                          onClick={() => setActiveSection("budgets")}
                        >
                          ← Voltar à Negociação
                        </Button>
                      )}
                      {isNegotiationView && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" size="sm" variant="outline" className="h-7 text-xs">
                              Restaurar original
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Restaurar rateio da negociação?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Isso descarta as alterações feitas no rateio da negociação e copia novamente o rateio original congelado.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={handleResetNegotiationRateio}>
                                Restaurar original
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive">
                            Cancelar negociação
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancelar negociação?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Isso remove o rateio e os ajustes da negociação. O rateio original congelado permanece preservado.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={handleCancelNegotiationRateio}>
                              Confirmar cancelamento
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}
                {/* Adjustment rateio banner + source toggle */}
                {activeAdjustment && (
                  <div
                    className={`border-b px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      isAdjustmentView
                        ? "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/10"
                        : "border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10"
                    }`}
                  >
                    <div className={`text-xs flex items-start gap-2 ${
                      isAdjustmentView ? "text-emerald-900 dark:text-emerald-200" : "text-amber-900 dark:text-amber-200"
                    }`}>
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>
                        {isAdjustmentView
                          ? <>Editando rateio do ajuste <strong>{activeAdjustment.name}</strong>. Alterações aqui não afetam o rateio original.</>
                          : <>📐 Existe um ajuste ativo: <strong>{activeAdjustment.name}</strong>. O rateio do ajuste pode ser diferente do original.</>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant={rateioSource === "original" ? "default" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => setRateioSource("original")}
                      >
                        Rateio Original
                      </Button>
                      {hasNegotiationRateio && winnerSupplierId && (
                        <Button
                          type="button"
                          size="sm"
                          variant={rateioSource === "negotiation" ? "default" : "outline"}
                          className="h-7 text-xs"
                          onClick={() => setRateioSource("negotiation")}
                        >
                          Rateio da Negociação
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant={rateioSource === "adjustment" ? "default" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => setRateioSource("adjustment")}
                      >
                        Rateio do Ajuste
                      </Button>
                    </div>
                  </div>
                )}
                {/* Toolbar */}
                <div className="border-b border-border bg-muted/30">
                  <div className="flex items-center justify-between px-3 py-1">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      {matrixToolbarCollapsed ? "Filtros e ações ocultos" : "Filtros e ações"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={toggleMatrixToolbar}
                      className="h-6 px-2 text-xs gap-1"
                      title={matrixToolbarCollapsed ? "Expandir" : "Recolher"}
                    >
                      {matrixToolbarCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                      {matrixToolbarCollapsed ? "Expandir" : "Recolher"}
                    </Button>
                  </div>
                  {!matrixToolbarCollapsed && (
                  <div className="px-3 pb-2.5">
                  {renderStoreFilters()}
                  <div className="flex flex-wrap items-center gap-2">
                    {canEditCampaign && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/50"
                        onClick={() => setAutomationOpen(true)}
                      >
                        <Sparkles className="w-4 h-4" />
                        <span className="hidden sm:inline">{t("automation.title")}</span>
                      </Button>
                    )}
                    {canEditCampaign && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/50"
                        onClick={() => setCopyQtyOpen(true)}
                        title="Copiar quantidades de uma peça/kit para outra"
                      >
                        <Copy className="w-4 h-4" />
                        <span className="hidden sm:inline">Copiar quantidades</span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1.5"
                      onClick={() => setBudgetExportDialogOpen(true)}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span className="hidden sm:inline">Exportar Rateio</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1.5"
                      onClick={() => setRateioGridExportOpen(true)}
                    >
                      <LayoutGrid className="w-4 h-4" />
                      <span className="hidden sm:inline">Exportar rateio por Loja</span>
                    </Button>

                    <AlertDialog open={rateioGridExportOpen} onOpenChange={setRateioGridExportOpen}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Exportar Rateio por Loja</AlertDialogTitle>
                          <AlertDialogDescription>Selecione o formato de exportação:</AlertDialogDescription>
                        </AlertDialogHeader>
                        {(() => {
                          const runExport = async (
                            fn: typeof exportRateioGrid | typeof exportRateioGridPDF,
                            mode: "pieces" | "pieces_and_kits",
                            kind: "Excel" | "PDF",
                          ) => {
                            setRateioGridExportOpen(false);
                            toast.loading("Iniciando exportação...", { id: "rateio-grid" });
                            try {
                              await fn(
                                pieces,
                                kits,
                                kitPieces,
                                activeFilteredStores,
                                qtyMap,
                                campaign?.name || "Campanha",
                                client?.name || "",
                                agency?.name || "",
                                mode,
                                (current, total, storeName) => {
                                  toast.loading(
                                    `Exportando loja ${current} de ${total}: ${storeName}...`,
                                    { id: "rateio-grid" },
                                  );
                                },
                              );
                              toast.success(`${kind} exportado com sucesso!`, { id: "rateio-grid" });
                            } catch (err) {
                              console.error(err);
                              toast.error(
                                err instanceof Error ? err.message : "Erro ao exportar rateio.",
                                { id: "rateio-grid" },
                              );
                            }
                          };
                          return (
                            <div className="grid grid-cols-2 gap-2 py-2">
                              <Button
                                variant="default"
                                className="h-auto py-3 flex flex-col items-center gap-1"
                                onClick={() => runExport(exportRateioGrid, "pieces", "Excel")}
                              >
                                <FileSpreadsheet className="w-5 h-5" />
                                <span className="text-sm font-semibold">Peças</span>
                                <span className="text-[11px] opacity-80">Excel</span>
                              </Button>
                              <Button
                                variant="default"
                                className="h-auto py-3 flex flex-col items-center gap-1"
                                onClick={() => runExport(exportRateioGrid, "pieces_and_kits", "Excel")}
                              >
                                <FileSpreadsheet className="w-5 h-5" />
                                <span className="text-sm font-semibold">Peças e Kits</span>
                                <span className="text-[11px] opacity-80">Excel</span>
                              </Button>
                              <Button
                                variant="outline"
                                className="h-auto py-3 flex flex-col items-center gap-1"
                                onClick={() => runExport(exportRateioGridPDF, "pieces", "PDF")}
                              >
                                <FileText className="w-5 h-5" />
                                <span className="text-sm font-semibold">Peças</span>
                                <span className="text-[11px] opacity-70">PDF</span>
                              </Button>
                              <Button
                                variant="outline"
                                className="h-auto py-3 flex flex-col items-center gap-1"
                                onClick={() => runExport(exportRateioGridPDF, "pieces_and_kits", "PDF")}
                              >
                                <FileText className="w-5 h-5" />
                                <span className="text-sm font-semibold">Peças e Kits</span>
                                <span className="text-[11px] opacity-70">PDF</span>
                              </Button>
                            </div>
                          );
                        })()}
                        <AlertDialogFooter>
                          <AlertDialogCancel className="mt-0">Cancelar</AlertDialogCancel>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="secondary" className="text-xs gap-1.5 bg-muted hover:bg-muted/70 text-foreground border border-border">
                          <MoreHorizontal className="w-4 h-4" />
                          <span className="hidden sm:inline">{t("common.moreActions") || "Mais ações"}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        {/* Export group */}
                        <DropdownMenuItem onClick={async () => {
                          const toastId = "export-matrix";
                          toast.loading("Gerando planilha do rateio...", { id: toastId });
                          try {
                            await exportMatrix(activeFilteredStores, matrixPieces, storePieces, campaign?.name || "Campanha", kits, kitPieces, pieces, agency?.name, client?.name);
                            toast.success("Planilha do rateio exportada!", { id: toastId });
                          } catch (e: any) { toast.error(`Erro ao exportar: ${e?.message || e}`, { id: toastId }); }
                        }}>
                          <Download className="w-4 h-4 mr-2" />
                          {t("common.export")} {t("modules.matrix")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setMatrixCustomExportOpen(true)}>
                          <Download className="w-4 h-4 mr-2" />
                          {t("matrix.customExport")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setRateioBackupOpen(true)}>
                          <Database className="w-4 h-4 mr-2" />
                          Backup do Rateio
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
                            {/* Destructive: reset all quantities */}
                            <DropdownMenuItem
                              onClick={() => setResetMatrixOpen(true)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Zerar planilha
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
                        const toastId = "matrix-import";
                        toast.loading("Lendo planilha...", { id: toastId });
                        try {
                          const items = await parseMatrixImport(file, pieces, stores);
                          if (items.length === 0) { toast.error(t("matrix.noDataFound"), { id: toastId }); e.target.value = ""; return; }
                          const total = items.length;
                          let processed = 0;
                          toast.loading(`Importando ${total} quantidade(s)...`, { id: toastId });
                          for (const item of items) {
                            await updateStorePiece.mutateAsync({ campaignId, storeId: item.storeId, pieceId: item.pieceId, quantity: item.quantity });
                            processed++;
                            if (processed % 10 === 0 || processed === total) {
                              toast.loading(`Importando ${processed}/${total} quantidade(s)...`, { id: toastId });
                            }
                          }
                          toast.success(t("matrix.quantitiesImported", { count: items.length }), { id: toastId });
                        } catch { toast.error(t("matrix.errorImport"), { id: toastId }); }
                        e.target.value = "";
                      }} />
                    )}
                  </div>
                  </div>
                  )}
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
                    if (isNegotiationView && winnerSupplierId) {
                      for (const c of changes) {
                        await updateNegotiationStorePiece.mutateAsync({
                          supplier_id: winnerSupplierId,
                          campaign_id: campaignId!,
                          store_id: c.storeId,
                          piece_id: c.pieceId,
                          quantity: c.quantity,
                        });
                      }
                    } else {
                      for (const c of changes) {
                        await updateStorePiece.mutateAsync({
                          campaignId: campaignId!, storeId: c.storeId, pieceId: c.pieceId, quantity: c.quantity,
                        });
                      }
                    }
                  }}
                />

                <MatrixAutomationDialog
                  open={automationOpen}
                  onOpenChange={setAutomationOpen}
                  campaignId={campaignId!}
                  clientId={clientId!}
                  stores={activeFilteredStores}
                  pieces={pieces}
                  kits={kits}
                  kitPieces={kitPieces}
                  qtyMap={qtyMap}
                  isNegotiationView={isNegotiationView}
                  negotiationSupplierId={winnerSupplierId}
                  isAdjustmentView={isAdjustmentView}
                  adjustmentId={activeAdjustmentId}
                  customFieldLabels={Array.from({ length: 15 }, (_, idx) => {
                    const i = idx + 1;
                    const label = (client as any)?.[`custom_field_${i}_label`];
                    return label ? { key: `custom_field_${i}`, label, index: i } : null;
                  }).filter((x): x is { key: string; label: string; index: number } => x !== null)}
                  onComplete={async () => {
                    if (isAdjustmentView && activeAdjustmentId) {
                      await queryClient.refetchQueries({ queryKey: ["adjustment_store_pieces", activeAdjustmentId], exact: true, type: "active" });
                    } else if (isNegotiationView && winnerSupplierId) {
                      await queryClient.refetchQueries({ queryKey: ["negotiation_store_pieces", winnerSupplierId], exact: true, type: "active" });
                      queryClient.invalidateQueries({ queryKey: ["neg_rateio_exists", winnerSupplierId] });
                      queryClient.invalidateQueries({ queryKey: ["budget_negotiation_rateio_totals", campaignId] });
                    } else {
                      await queryClient.refetchQueries({ queryKey: ["campaign_store_pieces", campaignId], exact: true, type: "active" });
                    }
                  }}
                />

                <RateioExportColorDialog
                  open={budgetExportDialogOpen}
                  onOpenChange={setBudgetExportDialogOpen}
                  customFieldLabels={Array.from({ length: 15 }, (_, idx) => {
                    const i = idx + 1;
                    const label = (client as any)?.[`custom_field_${i}_label`];
                    return label ? { key: `custom_field_${i}` as any, label } : null;
                  }).filter((x): x is { key: any; label: string } => x !== null)}
                  onExport={async (palette: ColorPalette, selectedFields) => {
                    setBudgetExportDialogOpen(false);
                    toast.loading("Gerando planilha com imagens...", { id: "matrix-excel" });
                    try {
                      await exportMatrixExcelJS(activeFilteredStores, matrixPieces, qtyMap, campaign?.name || "Campanha", kits, kitPieces, palette, pieceLocations, pieceSubLocations, pieces, agency?.name, client?.name, selectedFields);
                      toast.success("Planilha exportada com sucesso!", { id: "matrix-excel" });
                    } catch (err) {
                      console.error(err);
                      try {
                        await exportMatrix(activeFilteredStores, matrixPieces, storePieces, campaign?.name || "Campanha", kits, kitPieces, pieces, agency?.name, client?.name);
                        toast.success("Planilha exportada sem imagens.", { id: "matrix-excel" });
                      } catch (fallbackErr) {
                        console.error(fallbackErr);
                        toast.error("Erro ao exportar planilha", { id: "matrix-excel" });
                      }
                    }
                  }}
                />

                <CopyQuantitiesDialog
                  open={copyQtyOpen}
                  onOpenChange={setCopyQtyOpen}
                  campaignId={campaignId!}
                  stores={activeFilteredStores}
                  pieces={pieces}
                  kits={kits}
                  kitPieces={kitPieces}
                  qtyMap={qtyMap}
                  isNegotiationView={isNegotiationView}
                  negotiationSupplierId={winnerSupplierId}
                  isAdjustmentView={isAdjustmentView}
                  adjustmentId={activeAdjustmentId}
                  onComplete={async () => {
                    if (isAdjustmentView && activeAdjustmentId) {
                      await queryClient.refetchQueries({ queryKey: ["adjustment_store_pieces", activeAdjustmentId], exact: true, type: "active" });
                    } else if (isNegotiationView && winnerSupplierId) {
                      await queryClient.refetchQueries({ queryKey: ["negotiation_store_pieces", winnerSupplierId], exact: true, type: "active" });
                      queryClient.invalidateQueries({ queryKey: ["neg_rateio_exists", winnerSupplierId] });
                      queryClient.invalidateQueries({ queryKey: ["budget_negotiation_rateio_totals", campaignId] });
                    } else {
                      await queryClient.refetchQueries({ queryKey: ["campaign_store_pieces", campaignId], exact: true, type: "active" });
                    }
                  }}
                />


                {/* Reset Matrix Dialog (zera quantidades do rateio: tudo ou colunas selecionadas) */}
                <ResetMatrixDialog
                  open={resetMatrixOpen}
                  onOpenChange={setResetMatrixOpen}
                  campaignName={campaign?.name || ""}
                  totalEntries={storePieces.length}
                  pieces={pieces}
                  kits={kits}
                  onConfirm={async (payload) => {
                    if (!campaignId || resettingMatrix) return;
                    setResettingMatrix(true);
                    const isAll = payload.mode === "all";
                    const toastId = toast.loading(
                      isAll
                        ? "Zerando planilha do Rateio..."
                        : "Zerando colunas selecionadas...",
                    );
                    try {
                      if (isAll) {
                        if (isAdjustmentView && activeAdjustmentId) {
                          const { error } = await supabase
                            .from("campaign_adjustment_store_pieces" as never)
                            .delete()
                            .eq("adjustment_id", activeAdjustmentId);
                          if (error) throw error;
                        } else if (isNegotiationView && winnerSupplierId) {
                          const { error } = await supabase
                            .from("budget_negotiation_store_pieces" as never)
                            .delete()
                            .eq("supplier_id", winnerSupplierId);
                          if (error) throw error;
                        } else {
                          const { error } = await supabase
                            .from("campaign_store_pieces")
                            .delete()
                            .eq("campaign_id", campaignId);
                          if (error) throw error;
                        }
                      } else {
                        // Expande kits → peças componentes e mescla com peças selecionadas
                        const pieceIdSet = new Set<string>(payload.pieceIds);
                        for (const kitId of payload.kitIds) {
                          kitPieces
                            .filter((kp) => kp.kit_id === kitId)
                            .forEach((kp) => pieceIdSet.add(kp.piece_id));
                        }
                        const finalPieceIds = Array.from(pieceIdSet);
                        if (finalPieceIds.length === 0) {
                          toast.error("Nenhuma peça válida para zerar.", { id: toastId });
                          return;
                        }
                        if (isAdjustmentView && activeAdjustmentId) {
                          const { error } = await supabase
                            .from("campaign_adjustment_store_pieces" as never)
                            .delete()
                            .eq("adjustment_id", activeAdjustmentId)
                            .in("piece_id", finalPieceIds);
                          if (error) throw error;
                        } else if (isNegotiationView && winnerSupplierId) {
                          const { error } = await supabase
                            .from("budget_negotiation_store_pieces" as never)
                            .delete()
                            .eq("supplier_id", winnerSupplierId)
                            .in("piece_id", finalPieceIds);
                          if (error) throw error;
                        } else {
                          const { error } = await supabase
                            .from("campaign_store_pieces")
                            .delete()
                            .eq("campaign_id", campaignId)
                            .in("piece_id", finalPieceIds);
                          if (error) throw error;
                        }
                      }
                      if (isAdjustmentView && activeAdjustmentId) {
                        await queryClient.invalidateQueries({ queryKey: ["adjustment_store_pieces", activeAdjustmentId] });
                      } else if (isNegotiationView && winnerSupplierId) {
                        await queryClient.invalidateQueries({ queryKey: ["negotiation_store_pieces", winnerSupplierId] });
                        queryClient.invalidateQueries({ queryKey: ["neg_rateio_exists", winnerSupplierId] });
                      } else {
                        await queryClient.invalidateQueries({ queryKey: ["campaign_store_pieces", campaignId] });
                        await queryClient.refetchQueries({ queryKey: ["campaign_store_pieces", campaignId], exact: true });
                      }
                      toast.success(
                        isAll
                          ? "Planilha do Rateio zerada com sucesso."
                          : "Quantidades das colunas selecionadas zeradas.",
                        { id: toastId },
                      );
                    } catch (err) {
                      console.error(err);
                      toast.error("Erro ao zerar. Tente novamente.", { id: toastId });
                    } finally {
                      setResettingMatrix(false);
                    }
                  }}
                />

                <CustomExportDialog
                  open={matrixCustomExportOpen}
                  onOpenChange={setMatrixCustomExportOpen}
                  title={t("matrix.customExportTitle")}
                  fileName={`Rateio_${campaign?.name || "Campanha"}`}
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
                    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach((i) => {
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
                        label: `${kit.code} - ${kit.name}`,
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

                {/* Matrix Table */}
                {<div className="flex-1 min-h-0 overflow-hidden p-3">
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
                      <div className="h-full border border-border rounded-lg overflow-auto [&>div]:overflow-visible [&>div]:min-w-max">
                       <Table className="min-w-max border-separate border-spacing-0">
                        <TableHeader>
                          {/* Category group header row */}
                          {(() => {
                            const groups = matrixCategoryGroups;
                            // Only show if there's more than one group
                            if (groups.length <= 1) return null;
                            return (
                              <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableHead className="sticky left-0 top-0 h-7 bg-muted z-[30]" />
                                {groups.map((g, i) => (
                                  <TableHead key={i} colSpan={g.span} className="sticky top-0 z-[20] h-7 bg-muted px-2 py-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-l border-border">
                                    {g.label}
                                  </TableHead>
                                ))}
                                <TableHead className="sticky top-0 z-[20] h-7 bg-muted" />
                              </TableRow>
                            );
                          })()}
                          <TableRow className="hover:bg-transparent">
                            <TableHead className={`sticky left-0 ${matrixCategoryGroups.length > 1 ? "top-7" : "top-0"} z-[30] min-w-[180px] bg-card`}>{t("matrix.store")}</TableHead>
                            {matrixColumns.map((col, colIdx) => {
                              const tint = columnTints[colIdx] || "";
                              if (col.type === "piece") {
                                const p = col.data;
                                return (
                                  <TableHead key={p.id} className={`sticky ${matrixCategoryGroups.length > 1 ? "top-7" : "top-0"} z-[20] ${tint} bg-card text-center min-w-[72px] sm:min-w-[100px] px-1 sm:px-2 border-l border-border/70 align-top`}>
                                    <button
                                      className="flex flex-col items-center gap-0.5 w-full hover:opacity-80 transition-opacity"
                                      onClick={() => handleOpenEditPiece(p)}
                                    >
                                      <PieceThumbnail imageUrl={p.image_url} name={p.name} size="sm" />
                                      <span className="text-[10px] sm:text-xs font-bold leading-tight">{p.code}</span>
                                      {/* Spacer to align with kit "(X pçs)" line */}
                                      <span className="text-[9px] sm:text-[10px] font-semibold leading-tight invisible" aria-hidden="true">.</span>
                                      <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight max-w-[68px] sm:max-w-[100px] whitespace-normal break-words">{p.name}</span>
                                      {(p as any).is_new && <span className="bg-green-500 text-white text-[9px] px-1.5 rounded-full font-bold mt-0.5">NOVO</span>}
                                    </button>
                                  </TableHead>
                                );
                              }
                              const kit = col.data;
                              const kitPieceCount = kitPieces.filter(kp => kp.kit_id === kit.id).reduce((s, kp) => s + (kp.quantity || 0), 0);
                              return (
                                <TableHead key={`kit-${kit.id}`} className={`sticky ${matrixCategoryGroups.length > 1 ? "top-7" : "top-0"} z-[20] ${tint} bg-card text-center min-w-[72px] sm:min-w-[100px] px-1 sm:px-2 border-l border-border/70 align-top`}>
                                  <button onClick={() => setViewKitDetail(kit)} className="flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity w-full">
                                    {kit.image_url ? (
                                      <PieceThumbnail imageUrl={kit.image_url} name={kit.name} size="sm" />
                                    ) : (
                                      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                                        <Package className="w-4 h-4 text-primary" />
                                      </div>
                                    )}
                                    <span className="text-[10px] sm:text-xs font-bold text-primary leading-tight">{kit.code}</span>
                                    <span className="text-[9px] sm:text-[10px] font-semibold text-foreground leading-tight">({kitPieceCount} {kitPieceCount === 1 ? "pç" : "pçs"})</span>
                                    <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight max-w-[68px] sm:max-w-[100px] whitespace-normal break-words">{kit.name}</span>
                                    {(kit as any).is_new && <span className="bg-green-500 text-white text-[9px] px-1.5 rounded-full font-bold mt-0.5">NOVO</span>}
                                  </button>
                                </TableHead>
                              );
                            })}
                            <TableHead className={`sticky ${matrixCategoryGroups.length > 1 ? "top-7" : "top-0"} z-[20] bg-card text-center font-bold`}>Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeFilteredStores.map((store) => {
                            // Total real considera TODAS as peças (incluindo kit_only),
                            // refletindo a soma efetiva de itens enviados para a loja —
                            // tanto via peças individuais quanto via composição de kits.
                            const storeTotalReal = pieces.reduce((sum, p) => sum + (qtyMap[`${store.id}-${p.id}`] || 0), 0);
                            const storeTotal = storeTotalReal;
                            const hasAnyStoreWithQty = activeFilteredStores.some(
                              (st) => st.id !== store.id && pieces.some((p) => (qtyMap[`${st.id}-${p.id}`] || 0) > 0)
                            );
                            const isEmptyStore = storeTotalReal === 0 && hasAnyStoreWithQty;
                            return (
                              <TableRow key={store.id}>
                                <TableCell className="sticky left-0 bg-card z-[5] font-medium">
                                  <div>
                                    <span className="text-sm">{store.name}</span>
                                    {store.state && (
                                      <span
                                        className="ml-1.5 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                        style={{ backgroundColor: getStateColor(store.state).bg, color: getStateColor(store.state).text }}
                                      >
                                        {store.state}
                                      </span>
                                    )}
                                    <StoreDetailsPopover store={store} customFieldLabels={storeDetailCustomFieldLabels} />
                                    {store.nickname && store.nickname !== store.name && (
                                      <span className="text-[10px] text-muted-foreground ml-1">({store.nickname})</span>
                                    )}
                                    {store.store_model && (
                                      <p className="text-[10px] text-muted-foreground">{store.store_model}</p>
                                    )}
                                  </div>
                                </TableCell>
                                {matrixColumns.map((col, colIdx) => {
                                  const tint = columnTints[colIdx] || "";
                                  if (col.type === "piece") {
                                    const p = col.data;
                                    const key = `${store.id}-${p.id}`;
                                    const qty = qtyMap[key] || 0;
                                    const isEditing = editingCell?.storeId === store.id && editingCell?.pieceId === p.id;
                                    return (
                                      <TableCell key={p.id} className={`text-center p-1 border-l border-border/70 ${tint}`}>
                                        {isEditing ? (
                                          <Input
                                            ref={(el) => { editingInputRefs.current[`${store.id}-${p.id}`] = el; }}
                                            type="number"
                                            min={0}
                                            value={editValue}
                                            onChange={(e) => { editValueRef.current = e.target.value; setEditValue(e.target.value); }}
                                            onBlur={() => handlePieceBlur(store.id, p.id)}
                                            onKeyDown={(e) => {
                                              const move = (dir: "up" | "down" | "left" | "right") => {
                                                e.preventDefault();
                                                markCurrentBlurAsHandled();
                                                const next = navigateMatrixCell(dir);
                                                if (next) {
                                                  switchToCell(next.storeId, next.pieceId);
                                                } else {
                                                  closeEditing();
                                                }
                                              };
                                              if (e.key === "Tab") move(e.shiftKey ? "left" : "right");
                                              else if (e.key === "Enter") move(e.shiftKey ? "up" : "down");
                                              else if (e.key === "ArrowUp") move("up");
                                              else if (e.key === "ArrowDown") move("down");
                                              else if (e.key === "ArrowLeft") move("left");
                                              else if (e.key === "ArrowRight") move("right");
                                              else if (e.key === "Escape") {
                                                e.preventDefault();
                                                markCurrentBlurAsHandled();
                                                setEditingCell(null);
                                                setEditValue("");
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
                                                : canEditCampaign
                                                ? "text-muted-foreground/40 hover:bg-muted"
                                                : "text-muted-foreground/40"
                                            }`}
                                            disabled={!canEditCampaign}
                                          >
                                            {qty > 0 ? qty : "—"}
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
                                    <TableCell key={`kit-${kit.id}`} className={`text-center p-1 border-l border-border/70 ${tint}`}>
                                      {isEditing ? (
                                        <Input
                                          ref={(el) => { editingInputRefs.current[`${store.id}-kit-${kit.id}`] = el; }}
                                          type="number"
                                          min={0}
                                          value={editValue}
                                          onChange={(e) => { editValueRef.current = e.target.value; setEditValue(e.target.value); }}
                                          onBlur={() => handlePieceBlur(store.id, `kit-${kit.id}`)}
                                          onKeyDown={(e) => {
                                            const move = (dir: "up" | "down" | "left" | "right") => {
                                              e.preventDefault();
                                              markCurrentBlurAsHandled();
                                              const next = navigateMatrixCell(dir);
                                              if (next) {
                                                switchToCell(next.storeId, next.pieceId);
                                              } else {
                                                closeEditing();
                                              }
                                            };
                                            if (e.key === "Tab") move(e.shiftKey ? "left" : "right");
                                            else if (e.key === "Enter") move(e.shiftKey ? "up" : "down");
                                            else if (e.key === "ArrowUp") move("up");
                                            else if (e.key === "ArrowDown") move("down");
                                            else if (e.key === "ArrowLeft") move("left");
                                            else if (e.key === "ArrowRight") move("right");
                                            else if (e.key === "Escape") {
                                              e.preventDefault();
                                              markCurrentBlurAsHandled();
                                              setEditingCell(null);
                                              setEditValue("");
                                            }
                                          }}
                                          className="w-16 h-8 text-center mx-auto text-sm"
                                          autoFocus
                                        />
                                      ) : (
                                        <button
                                          onClick={() => handleCellClick(store.id, `kit-${kit.id}`)}
                                          className={`w-full h-8 text-sm rounded transition-colors ${
                                            kitQty > 0
                                              ? "bg-primary/15 text-primary font-semibold hover:bg-primary/25"
                                              : canEditCampaign
                                              ? "text-muted-foreground/40 hover:bg-muted"
                                              : "text-muted-foreground/40"
                                          }`}
                                          disabled={!canEditCampaign}
                                        >
                                          {kitQty > 0 ? kitQty : "—"}
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
                            {matrixColumns.map((col, colIdx) => {
                              const tint = columnTints[colIdx] || "";
                              if (col.type === "piece") {
                                const p = col.data;
                                const pieceTotal = filteredStores.reduce((s, st) => s + (qtyMap[`${st.id}-${p.id}`] || 0), 0);
                                return <TableCell key={p.id} className={`text-center text-sm border-l border-border/70 ${tint}`}>{pieceTotal}</TableCell>;
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
                              return <TableCell key={`kit-total-${kit.id}`} className={`text-center text-sm border-l border-border/70 ${tint}`}>{kitTotal}</TableCell>;
                            })}
                            <TableCell className="text-center text-sm text-primary">
                              {pieces.reduce((total, p) => total + filteredStores.reduce((s, st) => s + (qtyMap[`${st.id}-${p.id}`] || 0), 0), 0)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>}
                  </TabsContent>
                  <TabsContent value="dashboard" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
                    <MatrixDistributionDashboard
                      stores={activeFilteredStores}
                      pieces={pieces}
                      kits={kits}
                      kitPieces={kitPieces}
                      qtyMap={qtyMap}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}

          {/* ─── SECTION: PEÇAS ─── */}
          {activeSection === "pieces" && (<>
            <div className="sticky top-0 z-30 bg-background -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-2 border-b border-border/40">
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
                    <DropdownMenuItem onClick={async () => {
                      const toastId = "export-pieces";
                      toast.loading("Gerando planilha de peças...", { id: toastId });
                      try {
                        await exportCampaignPieces(pieces, campaign?.name || "Campanha", kits, kitPieces, pieces, agency?.name, client?.name);
                        toast.success("Planilha de peças exportada!", { id: toastId });
                      } catch (e: any) { toast.error(`Erro ao exportar: ${e?.message || e}`, { id: toastId }); }
                    }}>
                      <Download className="w-4 h-4 mr-2" /> {t("common.export")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPieceImportOpen(true)}>
                      <Upload className="w-4 h-4 mr-2" /> Importar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleReviewPieceCodes}>
                      <Sparkles className="w-4 h-4 mr-2" /> {t("pieces.reviewCodes")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleRecodificar}>
                      <RefreshCw className="w-4 h-4 mr-2" /> {t("pieces.recode")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setOrderByLocationOpen(true)}>
                      <ArrowDownAZ className="w-4 h-4 mr-2" /> Ordenar por localização
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocationDialogOpen(true)}>
                      <MapPin className="w-4 h-4 mr-2" /> {t("pieces.storeLocation")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setImportPiecesDialogOpen(true)}>
                      <Copy className="w-4 h-4 mr-2" /> {t("pieces.fromCampaign")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={async () => {
                      const targets = pieces.filter(p => !p.is_mockup);
                      const targetKits = kits.filter(k => !k.is_mockup);
                      const total = targets.length + targetKits.length;
                      if (total === 0) { toast.info("Todas as peças e kits já estão como mockup"); return; }
                      const toastId = "mark-all-mockup";
                      toast.loading(`Marcando ${total} item(ns) como mockup...`, { id: toastId });
                      try {
                        let done = 0;
                        for (const p of targets) {
                          await updatePiece.mutateAsync({ id: p.id, is_mockup: true });
                          done++;
                          toast.loading(`Marcando ${done}/${total} como mockup...`, { id: toastId });
                        }
                        for (const k of targetKits) {
                          await updateKit.mutateAsync({ id: k.id, is_mockup: true });
                          done++;
                          toast.loading(`Marcando ${done}/${total} como mockup...`, { id: toastId });
                        }
                        toast.success(`${total} item(ns) marcados como mockup`, { id: toastId });
                      } catch (e: any) {
                        toast.error(`Erro ao marcar como mockup: ${e?.message || e}`, { id: toastId });
                      }
                    }}>
                      <Palette className="w-4 h-4 mr-2 text-amber-600" /> Marcar tudo como mockup
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={async () => {
                      const targets = pieces.filter(p => p.is_mockup);
                      const targetKits = kits.filter(k => k.is_mockup);
                      const total = targets.length + targetKits.length;
                      if (total === 0) { toast.info("Nenhuma peça ou kit está marcado como mockup"); return; }
                      const toastId = "unmark-all-mockup";
                      toast.loading(`Removendo mockup de ${total} item(ns)...`, { id: toastId });
                      try {
                        let done = 0;
                        for (const p of targets) {
                          await updatePiece.mutateAsync({ id: p.id, is_mockup: false });
                          done++;
                          toast.loading(`Removendo mockup ${done}/${total}...`, { id: toastId });
                        }
                        for (const k of targetKits) {
                          await updateKit.mutateAsync({ id: k.id, is_mockup: false });
                          done++;
                          toast.loading(`Removendo mockup ${done}/${total}...`, { id: toastId });
                        }
                        toast.success(`Mockup removido de ${total} item(ns)`, { id: toastId });
                      } catch (e: any) {
                        toast.error(`Erro ao remover mockup: ${e?.message || e}`, { id: toastId });
                      }
                    }}>
                      <Palette className="w-4 h-4 mr-2" /> Remover mockup de todos
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
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
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
              <div className="inline-flex h-9 rounded-md border border-input bg-background p-0.5 shrink-0">
                {([
                  { value: "all", label: "Todos" },
                  { value: "new", label: "Novos" },
                  { value: "not_new", label: "Não novos" },
                ] as const).map((opt) => {
                  const active = newFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewFilter(opt.value)}
                      className={`px-3 text-xs font-medium rounded-sm transition-colors flex items-center gap-1.5 ${
                        active
                          ? opt.value === "new"
                            ? "bg-green-500 text-white"
                            : "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt.value === "new" && (
                        <span className={`inline-block w-2 h-2 rounded-full ${active ? "bg-white" : "bg-green-500"}`} />
                      )}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            </div>

            {(() => {
              const search = pieceSearch.toLowerCase().trim();
              let filteredVisiblePieces = search
                ? visiblePieces.filter(p =>
                    p.name.toLowerCase().includes(search) ||
                    String(p.code).includes(search) ||
                    (p.category || "").toLowerCase().includes(search) ||
                    (p.store_category || "").toLowerCase().includes(search)
                  )
                : visiblePieces;
              let filteredKits = search
                ? kits.filter(k => {
                    if (k.name.toLowerCase().includes(search) || String(k.code).includes(search)) return true;
                    const kpIds = kitPieces.filter(kp => kp.kit_id === k.id).map(kp => kp.piece_id);
                    return pieces.some(p => kpIds.includes(p.id) && p.name.toLowerCase().includes(search));
                  })
                : kits;

              if (newFilter === "new") {
                filteredVisiblePieces = filteredVisiblePieces.filter(p => (p as any).is_new === true);
                filteredKits = filteredKits.filter(k => (k as any).is_new === true);
              } else if (newFilter === "not_new") {
                filteredVisiblePieces = filteredVisiblePieces.filter(p => (p as any).is_new !== true);
                filteredKits = filteredKits.filter(k => (k as any).is_new !== true);
              }

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
                     const toastId = `dup-piece-${piece.id}`;
                     const origOrder = piece.display_order;
                     const maxCode = pieces.length > 0 ? Math.max(...pieces.map(p => p.code)) : 0;
                     const shiftPieces = pieces.filter(p => p.display_order > origOrder);
                     const shiftKits = kits.filter(k => k.display_order > origOrder);
                     try {
                       toast.loading(`Duplicando peça "${piece.name}"… reorganizando ${shiftPieces.length + shiftKits.length} item(s)`, { id: toastId });
                       await Promise.all([
                         ...shiftPieces.map(p =>
                           supabase.from("campaign_pieces").update({ display_order: p.display_order + 1 }).eq("id", p.id)
                         ),
                         ...shiftKits.map(k =>
                           supabase.from("campaign_kits").update({ display_order: k.display_order + 1 }).eq("id", k.id)
                         ),
                       ]);
                       toast.loading(`Criando cópia da peça "${piece.name}"…`, { id: toastId });
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
                         display_order: origOrder + 1,
                         image_url: piece.image_url || undefined,
                       });
                       queryClient.invalidateQueries({ queryKey: ["campaign_pieces"] });
                       queryClient.invalidateQueries({ queryKey: ["campaign_kits"] });
                       toast.success("Peça duplicada com sucesso!", { id: toastId });
                     } catch (e: any) {
                       toast.error(`Erro ao duplicar peça: ${e?.message || e}`, { id: toastId });
                     }
                   }}
                    onDuplicateKit={async (kit) => {
                       const toastId = `dup-kit-${kit.id}`;
                       const origOrder = kit.display_order;
                       const maxCode = kits.length > 0 ? Math.max(...kits.map(k => k.code)) : 0;
                       const maxPieceCode = pieces.length > 0 ? Math.max(...pieces.map(p => p.code)) : 0;
                       const kpForKit = kitPieces.filter(kp => kp.kit_id === kit.id);
                       const slotsNeeded = 1 + kpForKit.length;

                       toast.loading(`Duplicando kit "${kit.name}" com ${kpForKit.length} peça(s)… isso pode levar alguns segundos`, { id: toastId });

                       const { data, error } = await supabase.functions.invoke("duplicate-kit", {
                         body: {
                           kit_id: kit.id,
                           campaign_id: campaignId,
                           orig_order: origOrder,
                           slots_needed: slotsNeeded,
                           max_kit_code: maxCode,
                           max_piece_code: maxPieceCode,
                         },
                       });

                       if (error) {
                         toast.error(`Erro ao duplicar kit: ${error.message || "tente novamente"}`, { id: toastId });
                         console.error("duplicate-kit error:", error);
                         return;
                       }

                       queryClient.invalidateQueries({ queryKey: ["campaign_pieces"] });
                       queryClient.invalidateQueries({ queryKey: ["campaign_kits"] });
                       queryClient.invalidateQueries({ queryKey: ["campaign_kit_pieces"] });
                       toast.success(`Kit duplicado! ${data?.pieces_count ?? kpForKit.length} peça(s) copiada(s) de forma independente.`, { id: toastId });
                     }}
                  onReorder={handleReorderUnified}
                />
              );
            })()}
          </>)}

          {/* ─── SECTION: OCORRÊNCIAS (Loja a Loja) ─── */}
          {activeSection === "occurrences" && campaignId && clientId && (
            <LojaALojaTab campaignId={campaignId} clientId={clientId} permissions={lalPerms} initialTab="portal-dashboard" />
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
              agencyId={agencyId}
              initialFilter={
                pendingInitialFilter?.type === "summary" && pendingInitialFilter.value === "scheduled"
                  ? { type: "summary", value: "scheduled" }
                  : null
              }
              onInitialFilterApplied={() => setPendingInitialFilter(null)}
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
              initialFilter={
                pendingInitialFilter && (
                  pendingInitialFilter.type === "status" ||
                  pendingInitialFilter.type === "checkin" ||
                  (pendingInitialFilter.type === "summary" && pendingInitialFilter.value === "withPhotos")
                )
                  ? (pendingInitialFilter as any)
                  : null
              }
              onInitialFilterApplied={() => setPendingInitialFilter(null)}
            />
          )}

          {/* ─── SECTION: ORÇAMENTOS ─── */}
          {activeSection === "budgets" && (
            <>
              {activeAdjustment && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-900 dark:text-amber-200">
                    <strong>Atenção:</strong> Existe um ajuste de mockup ativo (<strong>{activeAdjustment.name}</strong>) para esta campanha.
                    O orçamento vigente pode ser diferente do original.
                  </p>
                </div>
              )}
              <BudgetTab
                campaignId={campaignId!}
                clientId={clientId!}
                campaignName={campaign?.name || ""}
                agencyName={agency?.name || ""}
                pieces={pieces}
                kits={kits}
                kitPieces={kitPieces}
                qtyMap={qtyMap}
                stores={stores}
                activeAdjustment={activeAdjustment ? { id: activeAdjustment.id, name: activeAdjustment.name } : null}
                onNavigateToRateio={() => {
                  setRateioSource("negotiation");
                  setRateioView("planilha");
                  setActiveSection("matrix");
                }}
              />
            </>
          )}

          {/* ─── SECTION: AJUSTES DE MOCKUP ─── */}
          {activeSection === "adjustments" && isAdminOrMaster && campaignId && (
            <AdjustmentsTab
              campaignId={campaignId}
              campaignName={campaign?.name || ""}
              pieces={pieces}
              kits={kits}
              kitPieces={kitPieces}
              storePieces={storePieces}
              stores={stores}
              agencyName={agency?.name || ""}
              clientName={client?.name || ""}
              currencyCode={(client as any)?.currency_code || "BRL"}
            />
          )}



          {/* ─── SECTION: HISTORY ─── */}
          {activeSection === "history" && campaignId && (
            <CampaignActivityHistory campaignId={campaignId} />
          )}

          {/* ─── SECTION: MOCKUP ─── */}
          {activeSection === "mockup" && campaignId && (
            <MockupTab
              campaignId={campaignId}
              campaignName={campaign?.name || ""}
              pieces={pieces}
              kits={kits}
              kitPieces={kitPieces}
            />
          )}

          {/* ─── SECTION: LOJA A LOJA ─── */}
          {activeSection === "loja_a_loja" && campaignId && clientId && (
            <LojaALojaTab campaignId={campaignId} clientId={clientId} permissions={lalPerms} />
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

      {/* Order by Location Dialog */}
      <OrderByLocationDialog
        open={orderByLocationOpen}
        onOpenChange={setOrderByLocationOpen}
        locations={distinctLocations}
        countsByLocation={countsByLocation}
        onApply={handleApplyOrderByLocation}
      />

      {/* Create Kit Dialog */}
      {campaignId && (
        <CreateKitDialog
          open={createKitDialogOpen}
          onOpenChange={setCreateKitDialogOpen}
          campaignId={campaignId}
          kitOnlyPieces={kitOnlyPieces}
          existingKits={kits}
          existingPieces={pieces}
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
        existingKits={kits}
        canEdit={canEditPieces}
        pieceLocations={pieceLocations}
        pieceSubLocations={pieceSubLocations}
        onDeleteKitPiece={(id) => deleteKitPiece.mutate(id)}
        onDeleteKit={(id) => deleteKit.mutate(id)}
        onAddKitPiece={async (kp) => await addKitPiece.mutateAsync(kp)}
        onUpdateKit={async (kit) => await updateKit.mutateAsync(kit)}
        onUpdatePiece={async (piece) => { await updatePiece.mutateAsync(piece as any); }}
        onDeletePiece={(id) => deletePiece.mutate(id)}
        onUpdateKitPiece={async (update) => { await updateKitPiece.mutateAsync(update); }}
        onReorderKitPieces={async (updates) => { await reorderKitPieces.mutateAsync(updates); }}
        onDuplicatePiece={async (piece) => {
          const toastId = `dup-kpiece-${piece.id}`;
          const origOrder = piece.display_order;
          const maxCode = pieces.length > 0 ? Math.max(...pieces.map(p => p.code)) : 0;
          const shiftPieces = pieces.filter(p => p.display_order > origOrder);
          const shiftKits = kits.filter(k => k.display_order > origOrder);
          try {
            toast.loading(`Duplicando peça "${piece.name}"… reorganizando ${shiftPieces.length + shiftKits.length} item(s)`, { id: toastId });
            for (const p of shiftPieces) {
              await supabase.from("campaign_pieces").update({ display_order: p.display_order + 1 }).eq("id", p.id);
            }
            for (const k of shiftKits) {
              await supabase.from("campaign_kits").update({ display_order: k.display_order + 1 }).eq("id", k.id);
            }
            toast.loading(`Criando cópia da peça "${piece.name}"…`, { id: toastId });
            const newPiece = await addPiece.mutateAsync({
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
              display_order: origOrder + 1,
              image_url: piece.image_url || undefined,
            });
            // If the piece is in a kit, also add the duplicated piece to the same kit
            if (viewKitDetail && newPiece) {
              const kitPieceEntry = kitPieces.find(kp => kp.piece_id === piece.id && kp.kit_id === viewKitDetail.id);
              if (kitPieceEntry) {
                toast.loading(`Vinculando cópia ao kit "${viewKitDetail.name}"…`, { id: toastId });
                await addKitPiece.mutateAsync({ kit_id: viewKitDetail.id, piece_id: newPiece.id, quantity: kitPieceEntry.quantity });
              }
            }
            queryClient.invalidateQueries({ queryKey: ["campaign_pieces"] });
            queryClient.invalidateQueries({ queryKey: ["campaign_kits"] });
            toast.success("Peça duplicada com sucesso!", { id: toastId });
          } catch (e: any) {
            toast.error(`Erro ao duplicar peça: ${e?.message || e}`, { id: toastId });
          }
        }}
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
                const importName = kit.name.startsWith("KIT ") ? kit.name : `KIT ${kit.name}`;
                const createdKit = await addKit.mutateAsync({ campaign_id: campaignId, name: importName, code: kit.code });
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
      {pendingDashOpen && (
        <Suspense fallback={null}>
          <PendingOccurrencesDashboard
            open={pendingDashOpen}
            onOpenChange={setPendingDashOpen}
            campaignId={campaignId!}
            campaignName={campaign?.name}
            clientName={client?.name}
            agencyName={agency?.name}
            agencyId={agencyId}
            clientId={clientId}
            stores={stores.map((s) => ({ id: s.id, name: s.name, city: s.city ?? null, state: s.state ?? null, nickname: s.nickname ?? null, store_code: s.store_code ?? null }))}
            pieces={pieces}
            motives={occMotives}
            statuses={occStatuses}
          />
        </Suspense>
      )}

      <ImportWizardDialog
        open={pieceImportOpen}
        onOpenChange={setPieceImportOpen}
        mode="pieces"
        existingItems={pieces.map(p => ({ name: p.name, id: p.id }))}
        onImport={handlePiecesImport}
      />

      <CampaignBackupDialog
        open={backupDialogOpen}
        onOpenChange={setBackupDialogOpen}
        campaignId={campaignId!}
        campaignName={campaign?.name || ""}
      />

      <RateioBackupSheet
        open={rateioBackupOpen}
        onOpenChange={setRateioBackupOpen}
        campaignId={campaignId!}
        campaignName={campaign?.name || ""}
        pieces={pieces}
        kits={kits}
        kitPieces={kitPieces}
        stores={stores}
        qtyMap={qtyMap}
        isNegotiationView={isNegotiationView}
        negotiationSupplierId={winnerSupplierId}
        isAdjustmentView={isAdjustmentView}
        adjustmentId={activeAdjustmentId}
      />
    </AppLayout>
  );
};

export default CampaignDetail;
