import { useState, useMemo } from "react";

import { useParams, useNavigate } from "react-router-dom";
import {
  useCampaign, useClient, useClientStores, useCampaignPieces, useCampaignStorePieces,
  useAddCampaignPiece, useDeleteCampaignPiece, useUpdateCampaignPiece, useUpdateCampaignStorePiece,
  useCampaignPieceLocations, useAddCampaignPieceLocation, useDeleteCampaignPieceLocation,
  useUpdateClientStore,
  useCampaignStoreStatus, useUpsertCampaignStoreStatus, useBulkUpsertCampaignStoreStatus,
  useClientStoreModels,
  type CampaignPiece, type ClientStore,
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
import { ArrowLeft, Plus, Trash2, Search, Package, Edit3, Store, Grid3X3, LayoutList, MapPin, Download, Upload, Sparkles, Hash, X, Minus, ChevronRight, CheckSquare, AlertTriangle } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import QuickMatrixEditor from "@/components/QuickMatrixEditor";
import { toast } from "sonner";
import { exportCampaignPieces, parsePiecesImport, exportMatrix, parseMatrixImport } from "@/lib/exportMultiClient";
import OccurrencesTab from "@/components/OccurrencesTab";

const CampaignDetail = () => {
  const { agencyId, clientId, campaignId } = useParams<{ agencyId: string; clientId: string; campaignId: string }>();
  const navigate = useNavigate();
  // Permission checks replace isAdmin for granular access control
  const { hasPermission: canEditCampaign } = useClientPermission(clientId, "can_edit_campaigns");
  const { hasPermission: canEditOccurrences } = useClientPermission(clientId, "can_edit_occurrences");
  const { hasPermission: canDeleteOccurrences } = useClientPermission(clientId, "can_delete_occurrences");
  const { hasPermission: canEditReporterData } = useClientPermission(clientId, "can_edit_reporter_data");
  const { hasPermission: canEditPieces } = useClientPermission(clientId, "can_edit_pieces");
  const { hasPermission: canDeletePieces } = useClientPermission(clientId, "can_delete_pieces");
  const { hasPermission: canEditCampaignStores } = useClientPermission(clientId, "can_edit_campaign_stores");
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

  // Campaign store enabled map (default true if no record exists)
  const storeEnabledMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    campaignStoreStatus.forEach((s) => { map[s.store_id] = s.enabled; });
    return map;
  }, [campaignStoreStatus]);

  const isStoreEnabled = (storeId: string) => storeEnabledMap[storeId] !== false;

  // ─── Location management ──────────────────────────────
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");

  // ─── Piece dialogs ─────────────────────────────────────
  const [pieceDialogOpen, setPieceDialogOpen] = useState(false);
  const [pieceForm, setPieceForm] = useState({
    code: "", category: "", name: "",
    width: "", length: "", height: "",
    store_category: typeof window !== "undefined" ? localStorage.getItem("last_store_category") || "" : "",
    specification: "Vide Book/Manual",
    installation_instructions: "Sem informações específicas",
  });
  const [editPieceDialogOpen, setEditPieceDialogOpen] = useState(false);
  const [editPieceForm, setEditPieceForm] = useState({
    id: "", code: "", category: "", name: "",
    width: "", length: "", height: "",
    store_category: "",
    specification: "Vide Book/Manual",
    installation_instructions: "Sem informações específicas",
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

  // ─── Matrix editing ────────────────────────────────────
  const [editingCell, setEditingCell] = useState<{ storeId: string; pieceId: string } | null>(null);
  const [editValue, setEditValue] = useState("");

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
    const size = [pieceForm.width, pieceForm.length, pieceForm.height].filter(Boolean).join(" x ");
    const code = pieceForm.code ? parseInt(pieceForm.code) : nextPieceCode.seq;
    if (pieceForm.store_category) {
      localStorage.setItem("last_store_category", pieceForm.store_category);
    }
    await addPiece.mutateAsync({
      campaign_id: campaignId,
      code,
      category: pieceForm.category,
      name: pieceForm.name,
      size,
      store_category: pieceForm.store_category || undefined,
      specification: pieceForm.specification,
      installation_instructions: pieceForm.installation_instructions,
    });
    setPieceForm({
      code: "", category: "", name: "",
      width: "", length: "", height: "",
      store_category: pieceForm.store_category,
      specification: "Vide Book/Manual",
      installation_instructions: "Sem informações específicas",
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
      length: sizeParts[1] || "",
      height: sizeParts[2] || "",
      store_category: piece.store_category || "",
      specification: piece.specification || "Vide Book/Manual",
      installation_instructions: piece.installation_instructions || "Sem informações específicas",
    });
    setEditPieceDialogOpen(true);
  };

  const handleEditPiece = async (e: React.FormEvent) => {
    e.preventDefault();
    const size = [editPieceForm.width, editPieceForm.length, editPieceForm.height].filter(Boolean).join(" x ");
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

  // ─── Piece form fields (shared between add/edit) ──────
  const renderPieceFormFields = (
    form: typeof pieceForm,
    setForm: React.Dispatch<React.SetStateAction<typeof pieceForm>>,
  ) => (
    <>
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
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Medidas</label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">Largura</label>
            <Input value={form.width} onChange={(e) => setForm((f) => ({ ...f, width: e.target.value }))} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">Comprimento</label>
            <Input value={form.length} onChange={(e) => setForm((f) => ({ ...f, length: e.target.value }))} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">Altura</label>
            <Input value={form.height} onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))} />
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
    ? pieces
    : pieces.filter((p) => p.store_category === storeCategoryFilter);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        backTo={`/agency/${agencyId}/clients/${clientId}`}
        backLabel={client?.name || "Voltar"}
        title={campaign.name}
        subtitle={`${pieces.length} peça(s) · ${stores.length} loja(s) · ${totalPieces} unidade(s) total`}
        maxWidth="max-w-[95vw]"
      />

      <main className="max-w-[95vw] mx-auto px-2 sm:px-4 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gradient-secondary flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stores.length}</p>
              <p className="text-[11px] text-muted-foreground">Lojas cadastradas</p>
            </div>
          </div>
          <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center">
              <LayoutList className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{pieces.length}</p>
              <p className="text-[11px] text-muted-foreground">Peças cadastradas</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="stores">
          <TabsList className="mb-6 bg-card border border-border w-full overflow-x-auto flex justify-start">
            <TabsTrigger value="stores" className="gap-1 text-xs sm:text-sm sm:gap-1.5 data-[state=active]:bg-secondary/10 data-[state=active]:text-secondary"><Store className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" /> <span>Lojas</span></TabsTrigger>
            <TabsTrigger value="matrix" className="gap-1 text-xs sm:text-sm sm:gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Grid3X3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" /> <span>Matriz</span></TabsTrigger>
            <TabsTrigger value="pieces" className="gap-1 text-xs sm:text-sm sm:gap-1.5 data-[state=active]:bg-accent/10 data-[state=active]:text-accent-foreground"><LayoutList className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" /> <span>Peças</span></TabsTrigger>
            <TabsTrigger value="occurrences" className="gap-1 text-xs sm:text-sm sm:gap-1.5 data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive"><AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" /> <span>Ocorrências</span></TabsTrigger>
          </TabsList>

          {/* ─── TAB: LOJAS ─── */}
          <TabsContent value="stores">
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
                              {stats.pieceCount} / {pieces.length}
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
              const compatiblePieces = pieces.filter(p => {
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
                  <div className="bg-gradient-to-r from-secondary/10 to-primary/10 px-5 py-4 flex items-center justify-between border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg gradient-secondary flex items-center justify-center shadow-glow-secondary">
                        <Store className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-lg">{selectedStore.name}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {[selectedStore.city, selectedStore.state].filter(Boolean).join(" / ") || "Sem localização"}
                          {selectedStore.store_model && ` · Modelo: ${selectedStore.store_model}`}
                          {" · "}{assignedPieces.length} peça(s) · {totalQty} unidade(s)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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
          </TabsContent>

          <TabsContent value="matrix">
            {renderStoreFilters()}
            <div className="flex flex-wrap items-center gap-2 mb-4">
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
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => exportMatrix(activeFilteredStores, matrixPieces, storePieces, campaign?.name || "Campanha")}>
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
            </div>

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
                      {matrixPieces.map((p) => (
                        <TableHead key={p.id} className="text-center min-w-[100px]">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs font-bold">{p.code}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[90px]">{p.name}</span>
                            {p.store_category && (
                              <span className="text-[9px] bg-accent text-accent-foreground px-1 rounded">{p.store_category}</span>
                            )}
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeFilteredStores.map((store) => {
                      const storeTotal = matrixPieces.reduce((s, p) => s + (qtyMap[`${store.id}-${p.id}`] || 0), 0);
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
                          {matrixPieces.map((p) => {
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
                                        : canEditCampaign
                                        ? "text-muted-foreground/40 hover:bg-muted"
                                        : "text-muted-foreground/40"
                                    }`}
                                    disabled={!canEditCampaign}
                                  >
                                    {qty || "—"}
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
                      {matrixPieces.map((p) => {
                        const pieceTotal = filteredStores.reduce((s, st) => s + (qtyMap[`${st.id}-${p.id}`] || 0), 0);
                        return <TableCell key={p.id} className="text-center text-sm">{pieceTotal}</TableCell>;
                      })}
                      <TableCell className="text-center text-sm text-primary">
                        {matrixPieces.reduce((total, p) => total + filteredStores.reduce((s, st) => s + (qtyMap[`${st.id}-${p.id}`] || 0), 0), 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ─── TAB: PEÇAS ─── */}
          <TabsContent value="pieces">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-accent/15 text-accent-foreground">
                {pieces.length} peça(s)
              </span>
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => exportCampaignPieces(pieces, campaign?.name || "Campanha")}>
                <Download className="w-3.5 h-3.5" /> Exportar
              </Button>
              {canEditPieces && (
                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={handleReviewPieceCodes}>
                  <Sparkles className="w-3.5 h-3.5" /> Revisar Códigos
                </Button>
               )}
              {canEditPieces && (
                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setLocationDialogOpen(true)}>
                  <MapPin className="w-3.5 h-3.5" /> Localização na loja
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
                  <Button size="sm" variant="outline" className="text-xs gap-1" asChild>
                    <span><Upload className="w-3.5 h-3.5" /> Importar</span>
                  </Button>
                </label>
                <Dialog open={pieceDialogOpen} onOpenChange={setPieceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="text-xs gap-1 gradient-accent text-white border-0">
                      <Plus className="w-3.5 h-3.5" /> Nova Peça
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
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
                </>
              )}
            </div>

            {pieces.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Nenhuma peça cadastrada nesta campanha.</p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Código</TableHead>
                      <TableHead>Localização na Loja</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Medidas</TableHead>
                      <TableHead>Modelo de Loja</TableHead>
                      <TableHead>Especificação</TableHead>
                      <TableHead>Instruções de Instalação</TableHead>
                      <TableHead className="text-center">Total distribuído</TableHead>
                      {(canEditPieces || canDeletePieces) && <TableHead className="w-[80px]">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pieces.map((p) => {
                      const pieceTotal = stores.reduce((s, st) => s + (qtyMap[`${st.id}-${p.id}`] || 0), 0);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-bold text-primary">{p.code}</TableCell>
                          <TableCell className="text-muted-foreground">{p.category}</TableCell>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.size || "—"}</TableCell>
                          <TableCell>
                            {p.store_category ? (
                              <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded">{p.store_category}</span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.specification}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.installation_instructions}</TableCell>
                          <TableCell className="text-center font-semibold">{pieceTotal}</TableCell>
                          {(canEditPieces || canDeletePieces) && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {canEditPieces && (() => {
                                  const autoStores = stores.filter(s => s.auto_distribute);
                                  const targetStores = p.store_category === "Todas" || !p.store_category
                                    ? autoStores
                                    : autoStores.filter(s => s.store_model === p.store_category);
                                  const isDistributed = targetStores.some(s => qtyMap[`${s.id}-${p.id}`]);
                                  return (
                                    <Button variant="ghost" size="icon" className="h-7 w-7" title={isDistributed ? "Remover de todas as lojas" : "Distribuir para lojas compatíveis"} onClick={() => handleDistributePiece(p)}>
                                      <CheckSquare className={`w-3.5 h-3.5 ${isDistributed ? "text-primary" : "text-muted-foreground"}`} />
                                    </Button>
                                  );
                                })()}
                                {canEditPieces && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEditPiece(p)}>
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                {canDeletePieces && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7">
                                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir peça?</AlertDialogTitle>
                                        <AlertDialogDescription>A peça será removida de todas as lojas desta campanha.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deletePiece.mutate(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ─── TAB: OCORRÊNCIAS ─── */}
          <TabsContent value="occurrences">
            <OccurrencesTab campaignId={campaignId!} clientId={clientId} stores={stores} pieces={pieces} canEdit={canEditOccurrences} canDelete={canDeleteOccurrences} canEditReporter={canEditReporterData} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Piece Dialog */}
      <Dialog open={editPieceDialogOpen} onOpenChange={setEditPieceDialogOpen}>
        <DialogContent>
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
    </div>
  );
};

export default CampaignDetail;
