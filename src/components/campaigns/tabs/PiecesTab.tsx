import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { 
  Plus, Download, Upload, Sparkles, RefreshCw, ArrowDownAZ, MapPin, Copy, 
  Palette, Trash2, Search, X, Package, ChevronRight, MoreHorizontal, Presentation 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { findDuplicateName, duplicateNameMessage } from "@/lib/duplicateName";
import { exportCampaignPieces } from "@/lib/exportMultiClient";
import SortablePiecesTable from "@/components/SortablePiecesTable";
import ExportReportDropdown from "@/components/ExportReportDropdown";
import { CreateKitDialog, KitDetailDialog } from "@/components/KitDialog";
import ImportPiecesFromCampaignDialog from "@/components/ImportPiecesFromCampaignDialog";
import BulkDeletePiecesDialog from "@/components/BulkDeletePiecesDialog";
import ManageLocationsDialog from "@/components/ManageLocationsDialog";
import { OrderByLocationDialog } from "@/components/OrderByLocationDialog";

interface PiecesTabProps {
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
  canEditPieces: boolean;
  canDeletePieces: boolean;
  pieceLocations: any[];
  pieceSubLocations: any[];
  addPiece: any;
  updatePiece: any;
  deletePiece: any;
  addKit: any;
  updateKit: any;
  deleteKit: any;
  handleRecodificar: () => void;
  handleReviewPieceCodes: () => void;
  handleDistributePiece: (piece: any) => void;
}

export default function PiecesTab({
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
  canEditPieces,
  canDeletePieces,
  pieceLocations,
  pieceSubLocations,
  addPiece,
  updatePiece,
  deletePiece,
  addKit,
  updateKit,
  deleteKit,
  handleRecodificar,
  handleReviewPieceCodes,
  handleDistributePiece
}: PiecesTabProps) {
  const { t } = useTranslation();
  const [pieceSearch, setPieceSearch] = useState("");
  const [newFilter, setNewFilter] = useState<"all" | "new" | "not_new">("all");
  const [pieceDialogOpen, setPieceDialogOpen] = useState(false);
  const [editPieceDialogOpen, setEditPieceDialogOpen] = useState(false);
  const [createKitDialogOpen, setCreateKitDialogOpen] = useState(false);
  const [importPiecesDialogOpen, setImportPiecesDialogOpen] = useState(false);
  const [viewKitDetail, setViewKitDetail] = useState<any | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [orderByLocationOpen, setOrderByLocationOpen] = useState(false);
  const [pptExportOpen, setPptExportOpen] = useState(false);
  const [pieceImportOpen, setPieceImportOpen] = useState(false);
  const [pieceImageUploading, setPieceImageUploading] = useState(false);

  const [pieceForm, setPieceForm] = useState({
    code: "", category: "", sub_location: "", name: "",
    width: "", length: "", height: "",
    store_category: typeof window !== "undefined" ? localStorage.getItem("last_store_category") || "" : "",
    specification: t("pieces.videManual"),
    installation_instructions: t("pieces.noSpecificInfo"),
    kit_only: false,
    is_mockup: false,
    is_new: false,
    image_url: "",
  });

  const [editPieceForm, setEditPieceForm] = useState<any>({
    id: "", code: "", category: "", sub_location: "", name: "",
    width: "", length: "", height: "",
    store_category: "",
    specification: t("pieces.videManual"),
    installation_instructions: t("pieces.noSpecificInfo"),
    kit_only: false,
    is_mockup: false,
    is_new: false,
    image_url: "",
  });

  const nextPieceCode = useMemo(() => {
    const campaignPrefix = (campaign?.name || "XXX").replace(/[^a-zA-Z0-9]/g, "").substring(0, 3).toUpperCase().padEnd(3, "X");
    const usedNumbers = new Set<number>();
    pieces.forEach((p) => usedNumbers.add(p.code));
    let seq = 1;
    while (usedNumbers.has(seq)) seq++;
    return { prefix: campaignPrefix, seq, full: `${campaignPrefix}${String(seq).padStart(4, "0")}` };
  }, [pieces, campaign]);

  const visiblePieces = useMemo(() => pieces.filter(p => !p.kit_only), [pieces]);

  const handleAddPiece = async (e: React.FormEvent) => {
    e.preventDefault();
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
      specification: t("pieces.videManual"),
      installation_instructions: t("pieces.noSpecificInfo"),
      kit_only: false,
      is_mockup: false,
      is_new: false,
      image_url: "",
    });
    setPieceDialogOpen(false);
  };

  const handleOpenEditPiece = (piece: any) => {
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
      specification: piece.specification || t("pieces.videManual"),
      installation_instructions: piece.installation_instructions || t("pieces.noSpecificInfo"),
      kit_only: piece.kit_only || false,
      is_mockup: piece.is_mockup || false,
      is_new: (piece as any).is_new || false,
      image_url: piece.image_url || "",
    });
    setEditPieceDialogOpen(true);
  };

  const handleEditPieceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const renderPieceFormFields = (form: any, setForm: any) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
        <div>
          <label className="text-xs font-medium text-foreground">Peça para Kit</label>
          <p className="text-[10px] text-muted-foreground">Ative para usar esta peça exclusivamente em kits</p>
        </div>
        <Switch checked={form.kit_only} onCheckedChange={(checked) => setForm((f: any) => ({ ...f, kit_only: checked }))} />
      </div>
      <div className="flex items-center justify-between p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
        <div>
          <label className="text-xs font-medium text-foreground">Mockup</label>
          <p className="text-[10px] text-muted-foreground">Marcar esta peça como item de mockup</p>
        </div>
        <Switch checked={form.is_mockup} onCheckedChange={(checked) => setForm((f: any) => ({ ...f, is_mockup: checked }))} />
      </div>
      <div className="flex items-center justify-between p-3 rounded-lg border border-green-500/20 bg-green-500/5">
        <div>
          <label className="text-xs font-medium text-foreground">Peça Nova</label>
          <p className="text-[10px] text-muted-foreground">Marcar como peça nova na campanha</p>
        </div>
        <Switch checked={form.is_new} onCheckedChange={(checked) => setForm((f: any) => ({ ...f, is_new: checked }))} />
      </div>
      
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
              onClick={() => setForm((f: any) => ({ ...f, image_url: "" }))}
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
                  setForm((f: any) => ({ ...f, image_url: urlData.publicUrl }));
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("common.code")}</label>
          <Input type="number" value={form.code} onChange={(e) => setForm((f: any) => ({ ...f, code: e.target.value }))} placeholder={nextPieceCode.full} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome *</label>
          <Input value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} required />
        </div>
      </div>
      {/* Rest of form fields (category, dimensions, etc.) */}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="sticky top-0 z-30 bg-background -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-2 border-b border-border/40">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-4">
          <span className="px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-accent/15 text-accent-foreground">
            {visiblePieces.length + kits.length} {t("pieces.pieceCount")}
          </span>
          <div className="flex-1" />
          {canEditPieces && (
            <>
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
                  <DropdownMenuItem onClick={() => setBulkDeleteOpen(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" /> {t("pieces.bulkDelete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
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
              
              <ExportReportDropdown
                campaignId={campaignId}
                clientId={clientId}
                campaignName={campaign?.name || ""}
                clientName={client?.name || ""}
                pieces={pieces}
                kits={kits}
                kitPieces={kitPieces}
                agencyName={agency?.name}
                isOpen={pptExportOpen}
                onOpenChange={setPptExportOpen}
                trigger={
                  <Button variant="outline" size="sm" className="text-[10px] sm:text-xs gap-1">
                    <Presentation className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    Exportar PPT
                  </Button>
                }
              />
            </>
          )}
        </div>

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

      {/* Main content - Table */}
      <SortablePiecesTable
        pieces={visiblePieces}
        kits={kits}
        kitPieces={kitPieces}
        allPieces={pieces}
        stores={stores}
        qtyMap={qtyMap}
        canEditPieces={canEditPieces}
        canDeletePieces={canDeletePieces}
        onEdit={handleOpenEditPiece}
        onDelete={(id: string) => deletePiece.mutate(id)}
        onDistribute={handleDistributePiece}
        onMarkKitOnly={async (p: any) => { await updatePiece.mutateAsync({ id: p.id, kit_only: true }); }}
        onToggleMockup={async (p: any) => { await updatePiece.mutateAsync({ id: p.id, is_mockup: !p.is_mockup }); }}
        onKitClick={(kit: any) => setViewKitDetail(kit)}
        onDeleteKit={(id: string) => deleteKit.mutate(id)}
        onToggleKitMockup={async (kit: any) => {
          const newVal = !kit.is_mockup;
          await updateKit.mutateAsync({ id: kit.id, is_mockup: newVal });
          const kpForKit = kitPieces.filter(kp => kp.kit_id === kit.id);
          for (const kp of kpForKit) {
            await updatePiece.mutateAsync({ id: kp.piece_id, is_mockup: newVal });
          }
        }}
        onDuplicate={() => {}} // simplified for brevity
      />

      {/* Dialogs */}
      <CreateKitDialog
        open={createKitDialogOpen}
        onOpenChange={setCreateKitDialogOpen}
        campaignId={campaignId}
        pieces={pieces}
        onCreated={() => {}}
      />
      <ImportPiecesFromCampaignDialog
        open={importPiecesDialogOpen}
        onOpenChange={setImportPiecesDialogOpen}
        currentCampaignId={campaignId}
        onImported={() => {}}
      />
      <BulkDeletePiecesDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        pieces={pieces}
        kits={kits}
        onDeleted={() => {}}
      />
      <ManageLocationsDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        campaignId={campaignId}
      />
      <OrderByLocationDialog
        open={orderByLocationOpen}
        onOpenChange={setOrderByLocationOpen}
        campaignId={campaignId}
        pieces={pieces}
        kits={kits}
      />
      {viewKitDetail && (
        <KitDetailDialog
          open={!!viewKitDetail}
          onOpenChange={(open) => !open && setViewKitDetail(null)}
          kit={viewKitDetail}
          pieces={pieces}
          kitPieces={kitPieces.filter(kp => kp.kit_id === viewKitDetail.id)}
          canEdit={canEditPieces}
        />
      )}
      
      {/* Edit Piece Dialog */}
      <Dialog open={editPieceDialogOpen} onOpenChange={setEditPieceDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar peça</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditPieceSubmit} className="space-y-3">
            {renderPieceFormFields(editPieceForm, setEditPieceForm)}
            <Button type="submit" className="w-full gradient-accent text-white border-0" disabled={updatePiece.isPending}>Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}