import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { useParams, useNavigate } from "react-router-dom";
import {
  useCampaign, useClient, useClientStores, useCampaignPieces, useCampaignStorePieces,
  useAddCampaignPiece, useDeleteCampaignPiece, useUpdateCampaignPiece, useUpdateCampaignStorePiece,
  useCampaignPieceLocations, useAddCampaignPieceLocation, useDeleteCampaignPieceLocation,
  useUpdateClientStore,
  useCampaignStoreStatus, useUpsertCampaignStoreStatus, useBulkUpsertCampaignStoreStatus,
  useClientStoreModels,
  useCampaignKits, useAddCampaignKit, useDeleteCampaignKit, useUpdateCampaignKit,
  useCampaignKitPieces, useAddCampaignKitPiece, useDeleteCampaignKitPiece, useUpdateCampaignKitPiece,
  type CampaignPiece, type ClientStore, type CampaignKit,
} from "@/hooks/useMultiClientData";

import { useClientPermission } from "@/hooks/useClientPermission";
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
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, Search, Package, Edit3, Store, Grid3X3, LayoutList, MapPin, Download, Upload, Sparkles, Hash, X, Minus, ChevronRight, CheckSquare, AlertTriangle, CalendarDays, Copy, RefreshCw, Home } from "lucide-react";
import PieceThumbnail from "@/components/PieceThumbnail";
import CampaignPieceImageUpload from "@/components/CampaignPieceImageUpload";
import AppHeader from "@/components/AppHeader";
import QuickMatrixEditor from "@/components/QuickMatrixEditor";
import { toast } from "sonner";
import { exportCampaignPieces, parsePiecesImport, exportMatrix, parseMatrixImport } from "@/lib/exportMultiClient";
import OccurrencesTab from "@/components/OccurrencesTab";
import { CreateKitDialog, KitDetailDialog } from "@/components/KitDialog";
import SchedulingTab from "@/components/SchedulingTab";
import ImportPiecesFromCampaignDialog from "@/components/ImportPiecesFromCampaignDialog";
import SortablePiecesTable, { type UnifiedRow } from "@/components/SortablePiecesTable";
import SupportMaterialsSection from "@/components/SupportMaterialsSection";
import ImportSpecFromCampaign from "@/components/ImportSpecFromCampaign";
import ImportMatrixFromCampaignDialog from "@/components/ImportMatrixFromCampaignDialog";

const CampaignDetail = () => {
  const { agencyId, clientId, campaignId } = useParams<{ agencyId: string; clientId: string; campaignId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Permission checks replace isAdmin for granular access control
  const { hasPermission: canEditCampaign } = useClientPermission(clientId, "can_edit_campaigns");
  const { hasPermission: canEditOccurrences } = useClientPermission(clientId, "can_edit_occurrences");
  const { hasPermission: canDeleteOccurrences } = useClientPermission(clientId, "can_delete_occurrences");
  const { hasPermission: canEditReporterData } = useClientPermission(clientId, "can_edit_reporter_data");
  const { hasPermission: canEditPieces } = useClientPermission(clientId, "can_edit_pieces");
  const { hasPermission: canDeletePieces } = useClientPermission(clientId, "can_delete_pieces");
  const { hasPermission: canEditCampaignStores } = useClientPermission(clientId, "can_edit_campaign_stores");
  const { hasPermission: canEditSchedules } = useClientPermission(clientId, "can_edit_schedules");
  const { data: client } = useClient(clientId);
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
  const addPieceLocation = useAddCampaignPieceLocation();
  const deletePieceLocation = useDeleteCampaignPieceLocation();
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
  const [newLocationName, setNewLocationName] = useState("");

  // ─── Kit dialogs ───────────────────────────────────────
  const [createKitDialogOpen, setCreateKitDialogOpen] = useState(false);
  const [importPiecesDialogOpen, setImportPiecesDialogOpen] = useState(false);
  const [viewKitDetail, setViewKitDetail] = useState<CampaignKit | null>(null);

  // ─── Piece dialogs ─────────────────────────────────────
  const [pieceDialogOpen, setPieceDialogOpen] = useState(false);
  const [pieceForm, setPieceForm] = useState({
    code: "", category: "", name: "",
    width: "", length: "", height: "",
    store_category: typeof window !== "undefined" ? localStorage.getItem("last_store_category") || "" : "",
    specification: "Vide Book/Manual",
    installation_instructions: "Sem informações específicas",
    kit_only: false,
    image_url: "",
  });
  const [pieceImageUploading, setPieceImageUploading] = useState(false);
  const [editPieceDialogOpen, setEditPieceDialogOpen] = useState(false);
  const [editPieceForm, setEditPieceForm] = useState({
    id: "", code: "", category: "", name: "",
    width: "", length: "", height: "",
    store_category: "",
    specification: "Vide Book/Manual",
    installation_instructions: "Sem informações específicas",
    kit_only: false,
    image_url: "",
  });

  // ─── Store filters ─────────────────────────────────────
  const [storeSearch, setStoreSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("__all__");
  const [stateFilter, setStateFilter] = useState("__all__");
  const [storeCategoryFilter, setStoreCategoryFilter] = useState("__all__");

  // ─── Store detail view ────────────────────────────────
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [deactivateStoreId, setDeactivateStoreId] = useState<string | null>(null);
  const [addPieceToStoreOpen, setAddPieceToStoreOpen] = useState(false);
  const [storeEditingPieceId, setStoreEditingPieceId] = useState<string | null>(null);
  const [storeEditQtyValue, setStoreEditQtyValue] = useState("");

  // ─── Active section (null = home) ──────────────────────
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [pieceSearch, setPieceSearch] = useState("");

  // ─── Matrix editing ────────────────────────────────────
  const [editingCell, setEditingCell] = useState<{ storeId: string; pieceId: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [importMatrixDialogOpen, setImportMatrixDialogOpen] = useState(false);

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
      // Store category filter: show stores that have pieces with matching store_category
      const matchesStoreCategory = storeCategoryFilter === "__all__" || true; // applied on matrix level
      return matchesSearch && matchesCity && matchesState && matchesStoreCategory;
    }).sort((a, b) => {
      const stateComp = (a.state || "").localeCompare(b.state || "");
      if (stateComp !== 0) return stateComp;
      return a.name.localeCompare(b.name);
    });
  }, [stores, storeSearch, cityFilter, stateFilter, storeCategoryFilter]);

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
      specification: pieceForm.specification,
      installation_instructions: pieceForm.installation_instructions,
      kit_only: pieceForm.kit_only,
      display_order: maxOrder + 1,
      image_url: pieceForm.image_url || undefined,
    });
    setPieceForm({
      code: "", category: "", name: "",
      width: "", length: "", height: "",
      store_category: pieceForm.store_category,
      specification: "Vide Book/Manual",
      installation_instructions: "Sem informações específicas",
      kit_only: false,
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

  const handleCellClick = (storeId: string, pieceId: string) => {
    if (!canEditCampaign) return;
    const qty = qtyMap[`${storeId}-${pieceId}`] || 0;
    setEditingCell({ storeId, pieceId });
    setEditValue(String(qty));
  };

  const handleCellSave = () => {
    if (!editingCell || !campaignId) return;
    const qty = parseInt(editValue) || 0;
    updateStorePiece.mutate({
      campaignId,
      storeId: editingCell.storeId,
      pieceId: editingCell.pieceId,
      quantity: Math.max(0, qty),
    });
    setEditingCell(null);
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
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Código</label>
        <Input type="number" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder={nextPieceCode.full} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Localização na Loja *</label>
        {pieceLocations.length > 0 ? (
          <Select value={form.category} onValueChange={(val) => setForm((f) => ({ ...f, category: val }))}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a localização" />
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
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome *</label>
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
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Medidas</label>
        <div className="grid grid-cols-3 gap-2">
           <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">Largura</label>
            <Input value={form.width} onChange={(e) => setForm((f) => ({ ...f, width: e.target.value }))} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">Altura</label>
            <Input value={form.height} onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">Comprimento</label>
            <Input value={form.length} onChange={(e) => setForm((f) => ({ ...f, length: e.target.value }))} />
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Modelo de Loja</label>
        <Select value={form.store_category || "Todas"} onValueChange={(val) => setForm((f) => ({ ...f, store_category: val }))}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o modelo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todas</SelectItem>
            {clientStoreModels.map((m) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Especificação</label>
        <Input value={form.specification} onChange={(e) => setForm((f) => ({ ...f, specification: e.target.value }))} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Instruções de Instalação</label>
        <Input value={form.installation_instructions} onChange={(e) => setForm((f) => ({ ...f, installation_instructions: e.target.value }))} />
      </div>
    </>
  );

  // ─── Store filters bar ─────────────────────────────────
  const renderStoreFilters = () => (
    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 mb-4">
      <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar loja..." value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} className="pl-10" />
      </div>
      <div className="flex flex-wrap gap-2">
        {uniqueStates.length > 0 && (
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[120px] sm:w-[140px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos estados</SelectItem>
              {uniqueStates.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {uniqueCities.length > 0 && (
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-[140px] sm:w-[180px]">
              <SelectValue placeholder="Cidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas cidades</SelectItem>
              {uniqueCities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {uniqueStoreCategories.length > 0 && (
          <Select value={storeCategoryFilter} onValueChange={setStoreCategoryFilter}>
            <SelectTrigger className="w-[140px] sm:w-[180px]">
              <SelectValue placeholder="Cat. de Loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas categorias</SelectItem>
              {uniqueStoreCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      <span className="text-xs sm:text-sm text-muted-foreground">{filteredStores.length} loja(s)</span>
    </div>
  );

  // ─── Loading / Not found ───────────────────────────────
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
        <p className="text-muted-foreground">Campanha não encontrada.</p>
      </div>
    );
  }

  // ─── Filtered pieces for matrix (by store_category) ───
  const matrixPieces = storeCategoryFilter === "__all__"
    ? visiblePieces
    : visiblePieces.filter((p) => p.store_category === storeCategoryFilter);

  // Kits appear as virtual columns in the matrix
  const matrixKits = kits;

  // Unified matrix columns sorted by display_order (same as pieces table)
  type MatrixCol = { type: "piece"; data: CampaignPiece } | { type: "kit"; data: CampaignKit };
  const matrixColumns: MatrixCol[] = [
    ...matrixPieces.map(p => ({ type: "piece" as const, data: p, display_order: p.display_order })),
    ...matrixKits.map(k => ({ type: "kit" as const, data: k, display_order: k.display_order })),
  ].sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        backTo={`/agency/${agencyId}/clients/${clientId}`}
        backLabel={client?.name || "Voltar"}
        title={campaign.name}
        subtitle={`${visiblePieces.length + kits.length} peça(s) · ${stores.length} loja(s) · ${totalPieces} unidade(s) total`}
        maxWidth="max-w-[95vw]"
        
      />

      <main className="max-w-[95vw] mx-auto px-2 sm:px-4 py-4 sm:py-6">
        {/* ─── HOME VIEW: Material de Apoio + Nav Buttons ─── */}
        {!activeSection && (
          <>
            <SupportMaterialsSection campaignId={campaignId!} canEdit={canEditCampaign} />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <div className="card-kpi flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                  <Store className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stores.length}</p>
                  <p className="text-[11px] text-muted-foreground">Lojas cadastradas</p>
                </div>
              </div>
              <div className="card-kpi flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/80 flex items-center justify-center">
                  <LayoutList className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{visiblePieces.length + kits.length}</p>
                  <p className="text-[11px] text-muted-foreground">Peças cadastradas</p>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { key: "stores", label: "Lojas", icon: Store },
                { key: "matrix", label: "Matriz", icon: Grid3X3 },
                { key: "pieces", label: "Peças", icon: LayoutList },
                { key: "occurrences", label: "Ocorrências", icon: AlertTriangle },
                { key: "scheduling", label: "Agendamento", icon: CalendarDays },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className="bg-primary/5 border border-primary/20 hover:bg-primary/10 rounded-xl p-5 flex flex-col items-center gap-3 transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-md">
                    <Icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <span className="font-bold text-sm text-foreground">{label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ─── SECTION VIEW: Show active section with Home button ─── */}
        {activeSection && (
          <>
            <div className="flex items-center gap-2 mb-4 overflow-x-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveSection(null)}
                className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 flex-shrink-0"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Início</span>
              </Button>
              <div className="flex gap-1 overflow-x-auto">
                {[
                  { key: "stores", label: "Lojas", icon: Store },
                  { key: "matrix", label: "Matriz", icon: Grid3X3 },
                  { key: "pieces", label: "Peças", icon: LayoutList },
                  { key: "occurrences", label: "Ocorrências", icon: AlertTriangle },
                  { key: "scheduling", label: "Agendamento", icon: CalendarDays },
                ].map(({ key, label, icon: Icon }) => (
                  <Button
                    key={key}
                    variant={activeSection === key ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveSection(key)}
                    className="gap-1 text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0"
                  >
                    <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{label.slice(0, 4)}</span>
                  </Button>
                ))}
              </div>
            </div>

          {/* ─── TAB: LOJAS ─── */}
          {activeSection === "stores" && (<>
            {renderStoreFilters()}

            {filteredStores.length === 0 ? (
              <div className="text-center py-16">
                <Store className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Nenhuma loja encontrada.</p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loja</TableHead>
                      <TableHead>Cidade/Estado</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Ativa</span>
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
                      <TableHead className="text-center">Auto</TableHead>
                      <TableHead className="text-center">Peças</TableHead>
                      <TableHead className="text-center">Qtd Total</TableHead>
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
                            {[selectedStore.city, selectedStore.state].filter(Boolean).join(" / ") || "Sem localização"}
                            {selectedStore.store_model && ` · ${selectedStore.store_model}`}
                            {" · "}{assignedPieces.length} peça(s) · {totalQty} un.
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
                          <Plus className="w-3.5 h-3.5" /> Incluir Peça
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
                        <p className="text-sm text-muted-foreground">Nenhuma peça atribuída a esta loja.</p>
                        {canEditCampaignStores && (
                          <Button size="sm" variant="outline" className="mt-3 text-xs gap-1" onClick={() => setAddPieceToStoreOpen(true)}>
                            <Plus className="w-3.5 h-3.5" /> Incluir primeira peça
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
                                        <AlertDialogTitle>Remover peça da loja?</AlertDialogTitle>
                                        <AlertDialogDescription>A quantidade será zerada para "{p.name}" nesta loja.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
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
                                          Remover
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
                        <DialogTitle>Incluir Peça em {selectedStore.name}</DialogTitle>
                        <DialogDescription>Selecione uma peça e defina a quantidade.</DialogDescription>
                      </DialogHeader>
                      {unassignedPieces.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Todas as peças já foram incluídas nesta loja.</p>
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
                                    toast.success(`"${p.name}" adicionada com 1 un.`);
                                  }
                                }}
                              >
                                <Plus className="w-3.5 h-3.5" /> Incluir
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
                  <AlertDialogTitle>Desativar loja?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta loja possui peças e quantidades atribuídas nesta campanha. Ao desativá-la, todas as peças e quantidades serão removidas permanentemente. Deseja continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
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
                      toast.success("Loja desativada e peças removidas!");
                    }}
                  >
                    SIM
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>)}

          {activeSection === "matrix" && (<>
            {renderStoreFilters()}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-4">
              <QuickMatrixEditor
                stores={activeFilteredStores}
                pieces={matrixPieces}
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
              />
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => exportMatrix(activeFilteredStores, matrixPieces, storePieces, campaign?.name || "Campanha", kits, kitPieces, pieces)}>
                <Download className="w-3.5 h-3.5" /> Exportar Matriz
              </Button>
              {canEditCampaign && (
                <label className="cursor-pointer">
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !campaignId) return;
                    try {
                      const items = await parseMatrixImport(file, pieces, stores);
                      if (items.length === 0) { toast.error("Nenhum dado encontrado."); return; }
                      for (const item of items) {
                        await updateStorePiece.mutateAsync({ campaignId, storeId: item.storeId, pieceId: item.pieceId, quantity: item.quantity });
                      }
                      toast.success(`${items.length} quantidade(s) importada(s)!`);
                    } catch { toast.error("Erro ao importar."); }
                    e.target.value = "";
                  }} />
                  <Button size="sm" variant="outline" asChild>
                    <span><Upload className="w-4 h-4 mr-1" /> Importar Matriz</span>
                  </Button>
                </label>
              )}
              {canEditCampaign && (
                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setImportMatrixDialogOpen(true)}>
                  <Copy className="w-3.5 h-3.5" /> Importar de outra campanha
                </Button>
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
                for (const c of changes) {
                  await updateStorePiece.mutateAsync({
                    campaignId: campaignId!, storeId: c.storeId, pieceId: c.pieceId, quantity: c.quantity,
                  });
                }
              }}
            />

            {pieces.length === 0 ? (
              <div className="text-center py-20">
                <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h2 className="text-lg font-display font-bold text-foreground mb-2">Nenhuma peça cadastrada</h2>
                <p className="text-muted-foreground text-sm">Adicione peças na aba "Peças" para começar a distribuir.</p>
              </div>
            ) : activeFilteredStores.length === 0 ? (
              <div className="text-center py-20">
                <Store className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h2 className="text-lg font-display font-bold text-foreground mb-2">Nenhuma loja encontrada</h2>
                <p className="text-muted-foreground text-sm">Ajuste os filtros ou cadastre lojas no cliente.</p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-[5] min-w-[180px]">Loja</TableHead>
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
                              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                                <Package className="w-4 h-4 text-primary" />
                              </div>
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
                                      type="number"
                                      min={0}
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={handleCellSave}
                                      onKeyDown={(e) => { if (e.key === "Enter") handleCellSave(); if (e.key === "Escape") setEditingCell(null); }}
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
                                    type="number"
                                    min={0}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={async () => {
                                      const qty = Math.max(0, parseInt(editValue) || 0);
                                      if (campaignId) {
                                        for (const kp of kitPiecesForKit) {
                                          await updateStorePiece.mutateAsync({ campaignId, storeId: store.id, pieceId: kp.piece_id, quantity: qty * (kp.quantity || 1) });
                                        }
                                      }
                                      setEditingCell(null);
                                    }}
                                    onKeyDown={async (e) => {
                                      if (e.key === "Enter") {
                                        const qty = Math.max(0, parseInt(editValue) || 0);
                                        if (campaignId) {
                                          for (const kp of kitPiecesForKit) {
                                            await updateStorePiece.mutateAsync({ campaignId, storeId: store.id, pieceId: kp.piece_id, quantity: qty * (kp.quantity || 1) });
                                          }
                                        }
                                        setEditingCell(null);
                                      }
                                      if (e.key === "Escape") setEditingCell(null);
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
          </>)}

          {/* ─── SECTION: PEÇAS ─── */}
          {activeSection === "pieces" && (<>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-4">
              <span className="px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-accent/15 text-accent-foreground">
                {visiblePieces.length + kits.length} peça(s)
              </span>
              <Button size="sm" variant="outline" className="text-[10px] sm:text-xs gap-1" onClick={() => exportCampaignPieces(pieces, campaign?.name || "Campanha", kits, kitPieces, pieces)}>
                <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Exportar
              </Button>
              {canEditPieces && (
                <>
                <Button size="sm" variant="outline" className="text-[10px] sm:text-xs gap-1" onClick={handleReviewPieceCodes}>
                  <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Revisar</span> Códigos
                </Button>
                <Button size="sm" variant="outline" className="text-[10px] sm:text-xs gap-1" onClick={handleRecodificar}>
                  <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Recodificar
                </Button>
                </>
               )}
              {canEditPieces && (
                <Button size="sm" variant="outline" className="text-[10px] sm:text-xs gap-1" onClick={() => setLocationDialogOpen(true)}>
                  <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Localização na</span> loja
                </Button>
              )}
              {canEditPieces && (
                <>
                <label className="cursor-pointer">
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
                  <Button size="sm" variant="outline" className="text-[10px] sm:text-xs gap-1" asChild>
                    <span><Upload className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Importar</span>
                  </Button>
                </label>
                <Button size="sm" variant="outline" className="text-[10px] sm:text-xs gap-1" onClick={() => setImportPiecesDialogOpen(true)}>
                  <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Buscar de outra</span> campanha
                </Button>
                <Dialog open={pieceDialogOpen} onOpenChange={setPieceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="text-[10px] sm:text-xs gap-1 gradient-accent text-white border-0">
                      <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Nova Peça
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Nova Peça</DialogTitle>
                      <DialogDescription>Preencha os dados da peça para adicioná-la à campanha.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddPiece} className="space-y-3">
                      {renderPieceFormFields(pieceForm, setPieceForm)}
                      <Button type="submit" className="w-full gradient-accent text-white border-0" disabled={addPiece.isPending}>Adicionar</Button>
                    </form>
                  </DialogContent>
                </Dialog>
                <Button size="sm" className="text-[10px] sm:text-xs gap-1 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => setCreateKitDialogOpen(true)}>
                  <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Novo Kit
                </Button>
                </>
              )}
            </div>

            {/* Search bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar peça por nome, código ou categoria..."
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
                      {search ? "Nenhuma peça encontrada para a busca." : "Nenhuma peça cadastrada nesta campanha."}
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
                  onKitClick={(kit) => setViewKitDetail(kit)}
                  onDeleteKit={(id) => deleteKit.mutate(id)}
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
              stores={stores.filter((s) => isStoreEnabled(s.id))}
              canEdit={canEditSchedules}
              agencyName={agency?.name || ""}
              clientName={client?.name || ""}
              campaignName={campaign?.name || ""}
              clientId={clientId!}
            />
          )}
          </>
        )}
      </main>

      {/* Edit Piece Dialog */}
      <Dialog open={editPieceDialogOpen} onOpenChange={setEditPieceDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Peça</DialogTitle>
            <DialogDescription>Altere os dados da peça.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditPiece} className="space-y-3">
            {renderPieceFormFields(editPieceForm, setEditPieceForm as any)}
            <Button type="submit" className="w-full" disabled={updatePiece.isPending}>Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Locations Dialog */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Localizações</DialogTitle>
            <DialogDescription>Cadastre localizações de peças para esta campanha.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nome da localização"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newLocationName.trim() && campaignId) {
                    e.preventDefault();
                    addPieceLocation.mutate({ campaign_id: campaignId, name: newLocationName.trim() });
                    setNewLocationName("");
                  }
                }}
              />
              <Button
                size="sm"
                disabled={!newLocationName.trim() || addPieceLocation.isPending}
                onClick={() => {
                  if (!campaignId || !newLocationName.trim()) return;
                  addPieceLocation.mutate({ campaign_id: campaignId, name: newLocationName.trim() });
                  setNewLocationName("");
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {pieceLocations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma localização cadastrada.</p>
            ) : (
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {[...pieceLocations].sort((a, b) => a.name.localeCompare(b.name)).map((loc) => (
                  <div key={loc.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50">
                    <span className="text-sm">{loc.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => deletePieceLocation.mutate(loc.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
    </div>
  );
};

export default CampaignDetail;
