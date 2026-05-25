import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { 
  Plus, Download, Upload, Sparkles, RefreshCw, ArrowDownAZ, MapPin, Copy, 
  Trash2, Search, X, Package, MoreHorizontal, Presentation, Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { 
  Popover, PopoverContent, PopoverTrigger 
} from "@/components/ui/popover";
import { toast } from "sonner";
import { exportCampaignPieces } from "@/lib/exportMultiClient";
import SortablePiecesTable from "@/components/SortablePiecesTable";
import ExportReportDropdown from "@/components/ExportReportDropdown";
import { CreateKitDialog, KitDetailDialog } from "@/components/KitDialog";
import ImportPiecesFromCampaignDialog from "@/components/ImportPiecesFromCampaignDialog";
import BulkDeletePiecesDialog from "@/components/BulkDeletePiecesDialog";
import ManageLocationsDialog from "@/components/ManageLocationsDialog";
import { OrderByLocationDialog } from "@/components/OrderByLocationDialog";
import ImportWizardDialog from "@/components/ImportWizardDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import AddPieceDialog from "@/components/AddPieceDialog";

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
  addKitPiece: any;
  updateKitPiece: any;
  deleteKitPiece: any;
  reorderKitPieces: any;
  handleRecodificar: () => void;
  handleReviewPieceCodes: () => void;
  handleDistributePiece: (piece: any) => void;
  refetch?: () => void;
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
  addKitPiece,
  updateKitPiece,
  deleteKitPiece,
  reorderKitPieces,
  handleRecodificar,
  handleReviewPieceCodes,
  handleDistributePiece,
  refetch
}: PiecesTabProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { isAdminOrMaster } = useUserRole();
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
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  
  const [configLabels, setConfigLabels] = useState({
    field1: campaign?.piece_custom_field_1_label || "",
    field2: campaign?.piece_custom_field_2_label || "",
    field3: campaign?.piece_custom_field_3_label || "",
    field4: campaign?.piece_custom_field_4_label || "",
    field5: campaign?.piece_custom_field_5_label || "",
  });
  const [isSavingLabels, setIsSavingLabels] = useState(false);

  const customFieldLabels = useMemo(() => [
    campaign?.piece_custom_field_1_label,
    campaign?.piece_custom_field_2_label,
    campaign?.piece_custom_field_3_label,
    campaign?.piece_custom_field_4_label,
    campaign?.piece_custom_field_5_label,
  ], [campaign]);

  const hasAnyCustomField = useMemo(() => customFieldLabels.some(l => !!l), [customFieldLabels]);

  const handleSaveCustomLabels = async () => {
    setIsSavingLabels(true);
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({
          piece_custom_field_1_label: configLabels.field1 || null,
          piece_custom_field_2_label: configLabels.field2 || null,
          piece_custom_field_3_label: configLabels.field3 || null,
          piece_custom_field_4_label: configLabels.field4 || null,
          piece_custom_field_5_label: configLabels.field5 || null,
        })
        .eq("id", campaignId);

      if (error) throw error;
      toast.success("Labels salvos com sucesso!");
      qc.invalidateQueries({ queryKey: ["campaign", campaignId] });
      setCustomFieldsOpen(false);
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setIsSavingLabels(false);
    }
  };

  const visiblePieces = useMemo(() => pieces.filter(p => !p.kit_only), [pieces]);
  const kitOnlyPieces = useMemo(() => pieces.filter(p => p.kit_only), [pieces]);

  const handlePiecesImport = async (rows: Record<string, any>[], options: { updateExisting: boolean; onProgress?: (curr: number, total: number, name?: string) => void }) => {
    if (!addPiece?.mutateAsync) return;
    
    const total = rows.length;
    for (let i = 0; i < total; i++) {
      const row = rows[i];
      const pieceName = row.name || "Sem nome";
      
      options.onProgress?.(i + 1, total, pieceName);
      
      try {
        const pieceData = {
          ...row,
          code: row.code?.trim() || `PCA-${Date.now()}-${i}`,
          campaign_id: campaignId,
          is_deleted: false,
          display_order: i,
          kit_only: ['true', '1', 'sim', 'yes'].includes(String(row.kit_only).toLowerCase())
        };
        
        if (options.updateExisting && row.code) {
          const existing = pieces.find(p => p.code === row.code);
          if (existing && updatePiece?.mutateAsync) {
            await updatePiece.mutateAsync({ id: existing.id, ...pieceData });
            continue;
          }
        }
        
        await addPiece.mutateAsync(pieceData);
      } catch (error) {
        console.error(`Error importing piece ${pieceName}:`, error);
      }
    }
    
    if (refetch) {
      await refetch();
    }
  };

  const countsByLocation = useMemo(() => {
    const counts: Record<string, number> = {};
    pieces.forEach(p => {
      const loc = p.category || "";
      counts[loc] = (counts[loc] || 0) + 1;
    });
    kits.forEach(k => {
      const kp = kitPieces.filter(kp => kp.kit_id === k.id);
      if (kp.length > 0) {
        const p = pieces.find(p => p.id === kp[0].piece_id);
        const loc = p?.category || "";
        counts[loc] = (counts[loc] || 0) + 1;
      }
    });
    return counts;
  }, [pieces, kits, kitPieces]);

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-30 bg-background -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-2 border-b border-border/40">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-4">
          <span className="px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-accent/15 text-accent-foreground">
            {visiblePieces.length + kits.length} {t("pieces.pieceCountShort")}
          </span>
          <div className="flex-1" />
          {canEditPieces && (
            <>
              {isAdminOrMaster && (
                <Popover open={customFieldsOpen} onOpenChange={setCustomFieldsOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="text-[10px] sm:text-xs gap-1">
                      <Settings2 className="w-3.5 h-3.5" />
                      {"⚙ Campos Personalizados"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium leading-none">Campos Personalizados</h4>
                        <p className="text-sm text-muted-foreground">
                          Configure os nomes dos campos extras para esta campanha.
                        </p>
                      </div>
                      <div className="grid gap-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className="grid grid-cols-3 items-center gap-4">
                            <label className="text-sm">Campo {i}</label>
                            <Input
                              value={(configLabels as any)[`field${i}`]}
                              onChange={(e) => setConfigLabels({ ...configLabels, [`field${i}`]: e.target.value })}
                              className="col-span-2 h-8"
                              placeholder="Ex: Material, Fornecedor..."
                            />
                          </div>
                        ))}
                      </div>
                      <Button size="sm" onClick={handleSaveCustomLabels} disabled={isSavingLabels}>
                        {isSavingLabels ? t("common.saving") : t("common.save")}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="text-[10px] sm:text-xs gap-1">
                    <MoreHorizontal className="w-3.5 h-3.5" /> {t("common.moreActions")}
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
                    <Upload className="w-4 h-4 mr-2" /> {t("common.import")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleReviewPieceCodes}>
                    <Sparkles className="w-4 h-4 mr-2" /> {t("pieces.reviewCodes")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleRecodificar}>
                    <RefreshCw className="w-4 h-4 mr-2" /> {t("pieces.recode")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setOrderByLocationOpen(true)}>
                    <ArrowDownAZ className="w-4 h-4 mr-2" /> {t("common.orderByLocation")}
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
              
              <AddPieceDialog existingPieces={pieces} customFieldLabels={customFieldLabels} campaignId={campaignId} clientId={clientId} />

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
                    {t("common.exportPPT")}
                  </Button>
                }
              />
            </>
          )}
        </div>
      </div>

      <SortablePiecesTable
        pieces={visiblePieces}
        kits={kits}
        kitPieces={kitPieces}
        allPieces={pieces}
        stores={stores}
        qtyMap={qtyMap}
        canEditPieces={canEditPieces}
        canDeletePieces={canDeletePieces}
        onEdit={() => {}}
        onDelete={(id) => deletePiece?.mutate?.(id)}
        onDistribute={handleDistributePiece}
        onMarkKitOnly={async (p) => { await updatePiece?.mutateAsync?.({ id: p.id, kit_only: true }); }}
        onToggleMockup={async (p) => { await updatePiece?.mutateAsync?.({ id: p.id, is_mockup: !p.is_mockup }); }}
        onKitClick={(kit) => setViewKitDetail(kit)}
        onDeleteKit={(id) => deleteKit?.mutate?.(id)}
        onToggleKitMockup={async (kit) => {
          const newVal = !kit.is_mockup;
          await updateKit?.mutateAsync?.({ id: kit.id, is_mockup: newVal });
        }}
        onDuplicate={() => {}}
        onDuplicateKit={() => {}}
        onReorder={() => {}}
        customFieldLabels={customFieldLabels}
      />

      <CreateKitDialog
        open={createKitDialogOpen}
        onOpenChange={setCreateKitDialogOpen}
        campaignId={campaignId}
        kitOnlyPieces={kitOnlyPieces}
        existingKits={kits}
        existingPieces={pieces}
        onCreateKit={(k) => addKit?.mutateAsync?.(k)}
        onAddKitPiece={(kp) => addKitPiece?.mutateAsync?.(kp)}
        onUpdateKit={(k) => updateKit?.mutateAsync?.(k)}
      />
      <ImportPiecesFromCampaignDialog
        open={importPiecesDialogOpen}
        onOpenChange={setImportPiecesDialogOpen}
        clientId={clientId}
        currentCampaignId={campaignId}
        existingPieces={pieces}
        onImport={() => {}}
      />
      <BulkDeletePiecesDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        pieces={pieces}
        onDeletePieces={async (ids) => {
          if (deletePiece?.mutateAsync) {
            for (const id of ids) await deletePiece.mutateAsync(id);
          }
        }}
      />
      <ManageLocationsDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        campaignId={campaignId}
        clientId={clientId}
        pieceLocations={pieceLocations}
        subLocations={pieceSubLocations}
        pieces={pieces}
      />
      <OrderByLocationDialog
        open={orderByLocationOpen}
        onOpenChange={setOrderByLocationOpen}
        locations={Object.keys(countsByLocation)}
        countsByLocation={countsByLocation}
        onApply={() => {}}
      />
      {viewKitDetail && (
        <KitDetailDialog
          open={!!viewKitDetail}
          onOpenChange={(open) => !open && setViewKitDetail(null)}
          kit={viewKitDetail}
          kitPieces={kitPieces.filter(kp => kp.kit_id === viewKitDetail.id)}
          allPieces={pieces}
          canEdit={canEditPieces}
          onDeleteKitPiece={(id) => deleteKitPiece?.mutate?.(id)}
          onAddKitPiece={(kp) => addKitPiece?.mutateAsync?.(kp)}
          onUpdateKit={(k) => updateKit?.mutateAsync?.(k)}
          onUpdateKitPiece={(kp) => updateKitPiece?.mutateAsync?.(kp)}
          onReorderKitPieces={(updates) => reorderKitPieces?.mutateAsync?.(updates)}
        />
      )}
      
      <ImportWizardDialog
        open={pieceImportOpen}
        onOpenChange={setPieceImportOpen}
        mode="pieces"
        clientId={clientId}
        campaignId={campaignId}
        existingItems={pieces.map(p => ({ id: p.id, name: p.name || p.code }))}
        onImport={handlePiecesImport}
      />
    </div>
  );
}