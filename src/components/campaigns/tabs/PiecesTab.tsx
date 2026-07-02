import React, { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { 
  Plus, Download, Upload, Sparkles, RefreshCw, ArrowDownAZ, MapPin, Copy, 
  Trash2, Search, X, Package, MoreHorizontal, Presentation, Settings2, Columns
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { 
  Popover, PopoverContent, PopoverTrigger 
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { exportCampaignPieces } from "@/lib/exportMultiClient";
import SortablePiecesTable, { type UnifiedRow } from "@/components/SortablePiecesTable";
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
import FindReplaceSpecDialog from "@/components/FindReplaceSpecDialog";
import KitOnlyPiecesDialog from "@/components/KitOnlyPiecesDialog";
import CustomExportDialog from "@/components/CustomExportDialog";

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
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [kitOnlyDialogOpen, setKitOnlyDialogOpen] = useState(false);
  const [customExportOpen, setCustomExportOpen] = useState(false);
  const [selectedPieceIds, setSelectedPieceIds] = useState<string[]>([]);
  const [convertSelectionDialogOpen, setConvertSelectionDialogOpen] = useState(false);
  const [preSelectedForKit, setPreSelectedForKit] = useState<string[]>([]);
  const [editingPiece, setEditingPiece] = useState<any>(null);
  const editScrollSnapshotRef = useRef<Array<{ element: Element | Window; top: number; left: number }> | null>(null);
  const restoreTimersRef = useRef<number[]>([]);

  const captureScrollSnapshot = useCallback(() => {
    restoreTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    restoreTimersRef.current = [];

    const snapshots: Array<{ element: Element | Window; top: number; left: number }> = [
      { element: window, top: window.scrollY, left: window.scrollX },
    ];

    const scrollingElement = document.scrollingElement;
    if (scrollingElement) {
      snapshots.push({ element: scrollingElement, top: scrollingElement.scrollTop, left: scrollingElement.scrollLeft });
    }

    document.querySelectorAll<HTMLElement>("*").forEach((element) => {
      const style = window.getComputedStyle(element);
      const scrollableY = /(auto|scroll|overlay)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
      const scrollableX = /(auto|scroll|overlay)/.test(style.overflowX) && element.scrollWidth > element.clientWidth;
      if (scrollableY || scrollableX) {
        snapshots.push({ element, top: element.scrollTop, left: element.scrollLeft });
      }
    });

    editScrollSnapshotRef.current = snapshots;
  }, []);

  const restoreScroll = useCallback(() => {
    const snapshots = editScrollSnapshotRef.current;
    if (!snapshots) return;

    restoreTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    restoreTimersRef.current = [];

    const applySnapshot = () => {
      snapshots.forEach(({ element, top, left }) => {
        if (element === window) {
          window.scrollTo({ top, left, behavior: "auto" });
          return;
        }

        if (element instanceof Element && element.isConnected) {
          element.scrollTop = top;
          element.scrollLeft = left;
        }
      });
    };

    // Restore through dialog close, Radix focus restoration, optimistic update and realtime refetch.
    requestAnimationFrame(() => {
      applySnapshot();
      requestAnimationFrame(applySnapshot);
    });

    [50, 120, 250, 500, 900, 1400].forEach((delay, index, delays) => {
      const timer = window.setTimeout(() => {
        applySnapshot();
        if (index === delays.length - 1) {
          editScrollSnapshotRef.current = null;
          restoreTimersRef.current = [];
        }
      }, delay);
      restoreTimersRef.current.push(timer);
    });
  }, []);

  useEffect(() => () => {
    restoreTimersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);
  
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(`pieces_columns_${campaignId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing visible columns", e);
      }
    }
    return {
      code: true,
      location: true,
      name: true,
      size: true,
      store_category: true,
      specification: true,
      installation_instructions: true,
      custom_field_1: true,
      custom_field_2: true,
      custom_field_3: true,
      custom_field_4: true,
      custom_field_5: true,
    };
  });

  useEffect(() => {
    localStorage.setItem(`pieces_columns_${campaignId}`, JSON.stringify(visibleColumns));
  }, [visibleColumns, campaignId]);
  
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

  useLayoutEffect(() => {
    if (editScrollSnapshotRef.current) {
      restoreScroll();
    }
  }, [pieces, kits, restoreScroll]);

  const handlePiecesImport = async (rows: Record<string, any>[], options: { updateExisting: boolean; onProgress?: (curr: number, total: number, name?: string) => void }) => {
    if (!addPiece?.mutateAsync) return;
    
    const total = rows.length;
    let importedCount = 0;
    let skippedCount = 0;

    const { data: existingMax } = await supabase
      .from("campaign_pieces")
      .select("code")
      .eq("campaign_id", campaignId)
      .eq("is_deleted", false)
      .order("code", { ascending: false })
      .limit(1)
      .maybeSingle();

    const maxCode = existingMax?.code ?? 0;

    for (let i = 0; i < total; i++) {
      const row = rows[i];
      const name = (row.name ?? "").trim();
      
      if (!name) {
        skippedCount++;
        continue;
      }

      options.onProgress?.(i + 1, total, `Peça: ${name}`);
      
      try {
        const parsedCode = parseInt(String(row.code ?? ""), 10);
        const finalCode = isNaN(parsedCode) ? maxCode + i + 1 : parsedCode;

        const pieceData = {
          campaign_id: campaignId,
          name: name,
          code: finalCode,
          category: row.category ?? "",
          size: row.size ?? "",
          specification: row.specification ?? "Vide Book/Manual",
          store_category: row.store_category ?? null,
          installation_instructions: row.installation_instructions ?? "Sem informações específicas",
          sub_location: row.sub_location ?? null,
          kit_only: ["true", "1", "sim", "yes"].includes(String(row.kit_only ?? "").toLowerCase()),
          is_deleted: false,
          display_order: i,
          is_mockup: false,
          is_new: false,
          custom_field_1: row.custom_field_1 ?? null,
          custom_field_2: row.custom_field_2 ?? null,
          custom_field_3: row.custom_field_3 ?? null,
          custom_field_4: row.custom_field_4 ?? null,
          custom_field_5: row.custom_field_5 ?? null,
        };
        
        if (options.updateExisting && !isNaN(parsedCode)) {
          const existing = pieces.find(p => p.code === finalCode);
          if (existing && updatePiece?.mutateAsync) {
            await updatePiece.mutateAsync({ id: existing.id, ...pieceData });
            importedCount++;
            continue;
          }
        }
        
        await addPiece.mutateAsync(pieceData);
        importedCount++;
      } catch (error) {
        console.error(`Error importing piece ${name}:`, error);
      }
    }
    
    toast.success(`Importação concluída: ${importedCount} peças importadas.${skippedCount > 0 ? ` ${skippedCount} linhas ignoradas (sem nome).` : ""}`);
    
    qc.invalidateQueries({ queryKey: ["campaign_pieces", campaignId] });
    if (refetch) {
      await refetch();
    }
  };

  const handleToggleSelection = (id: string) => {
    setSelectedPieceIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allSelectableIds = visiblePieces.map(p => p.id);
      setSelectedPieceIds(allSelectableIds);
    } else {
      setSelectedPieceIds([]);
    }
  };

  useEffect(() => {
    setSelectedPieceIds([]);
  }, [campaignId]);

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

  const handleReorder = async (rows: UnifiedRow[]) => {
    // 1. ATUALIZAÇÃO OTIMISTA — reflita a nova ordem na UI imediatamente
    qc.setQueryData(["campaign_pieces", campaignId], (old: any) => {
      if (!old) return old;
      return old.map((p: any) => {
        const matchingRow = rows.find(r => r.type === "piece" && r.data.id === p.id);
        if (matchingRow) {
          return { ...p, display_order: rows.indexOf(matchingRow) };
        }
        return p;
      });
    });

    qc.setQueryData(["campaign_kits", campaignId], (old: any) => {
      if (!old) return old;
      return old.map((k: any) => {
        const matchingRow = rows.find(r => r.type === "kit" && r.data.id === k.id);
        if (matchingRow) {
          return { ...k, display_order: rows.indexOf(matchingRow) };
        }
        return k;
      });
    });

    // 2. Para cada row no array reordenado, o novo display_order é o índice (0, 1, 2...)
    const updates = rows.map((row, index) => ({ row, display_order: index }));

    // 3. Persista no banco em paralelo:
    await Promise.allSettled([
      ...updates
        .filter(u => u.row.type === "piece")
        .map(u => updatePiece?.mutateAsync?.({ 
          id: (u.row.data as any).id, 
          display_order: u.display_order 
        })),
      ...updates
        .filter(u => u.row.type === "kit")
        .map(u => updateKit?.mutateAsync?.({ 
          id: (u.row.data as any).id, 
          display_order: u.display_order 
        }))
    ]);
  };

  const handleDuplicatePiece = async (piece: any) => {
    const maxCode = Math.max(...pieces.map(p => p.code ?? 0), 0);
    
    await addPiece?.mutateAsync?.({
      campaign_id: piece.campaign_id,
      name: `${piece.name} (cópia)`,
      code: maxCode + 1,
      category: piece.category,
      size: piece.size,
      specification: piece.specification,
      installation_instructions: piece.installation_instructions,
      sub_location: piece.sub_location,
      kit_only: false,
      is_deleted: false,
      is_mockup: false,
      is_new: piece.is_new,
      display_order: (piece.display_order ?? 0) + 1,
      custom_field_1: piece.custom_field_1,
      custom_field_2: piece.custom_field_2,
      custom_field_3: piece.custom_field_3,
      custom_field_4: piece.custom_field_4,
      custom_field_5: piece.custom_field_5,
      image_url: null,
      image_thumb_url: null,
      image_full_url: null,
      image_report_url: null,
    });
    
    toast.success(t("pieces.pieceDuplicated"));
  };

  const handleDuplicateKit = async (kit: any) => {
    const maxKitCode = Math.max(...kits.map(k => k.code ?? 0), 0);
    let maxPieceCode = Math.max(...pieces.map(p => p.code ?? 0), 0);

    const novoKit = await addKit?.mutateAsync?.({
      campaign_id: kit.campaign_id,
      name: `${kit.name} (cópia)`,
      code: maxKitCode + 1,
      is_new: kit.is_new,
      is_deleted: false,
      display_order: (kit.display_order ?? 0) + 1,
    });

    if (!novoKit) return;

    // Clone each component piece so the new kit is fully independent of the original.
    const pecasDoKit = kitPieces.filter(kp => kp.kit_id === kit.id);
    const piecesById = new Map(pieces.map(p => [p.id, p]));

    for (const kp of pecasDoKit) {
      const orig = piecesById.get(kp.piece_id);
      if (!orig) continue;
      maxPieceCode += 1;
      const novaPeca: any = await addPiece?.mutateAsync?.({
        campaign_id: orig.campaign_id,
        name: `${orig.name} (cópia)`,
        code: maxPieceCode,
        category: orig.category,
        size: orig.size,
        store_category: orig.store_category,
        sub_location: orig.sub_location,
        specification: orig.specification,
        installation_instructions: orig.installation_instructions,
        kit_only: orig.kit_only ?? true,
        is_mockup: orig.is_mockup ?? false,
        image_url: orig.image_url,
        image_thumb_url: orig.image_thumb_url,
        image_full_url: orig.image_full_url,
        image_report_url: orig.image_report_url,
      });
      if (novaPeca?.id) {
        await addKitPiece?.mutateAsync?.({
          kit_id: novoKit.id,
          piece_id: novaPeca.id,
          quantity: kp.quantity ?? 1,
        });
      }
    }

    toast.success(t("pieces.kitDuplicated"));
  };

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

              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="text-[10px] sm:text-xs gap-1">
                    <Columns className="w-3.5 h-3.5" />
                    {"Colunas"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-4" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium leading-none">Configurar Colunas</h4>
                      <p className="text-xs text-muted-foreground">
                        Selecione quais colunas deseja exibir na tabela de peças.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="col-name" className="text-sm">Nome (Obrigatório)</Label>
                        <Switch id="col-name" checked disabled />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="col-code" className="text-sm">Código</Label>
                        <Switch 
                          id="col-code" 
                          checked={visibleColumns.code} 
                          onCheckedChange={(val) => setVisibleColumns(prev => ({ ...prev, code: val }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="col-location" className="text-sm">Localização na Loja</Label>
                        <Switch 
                          id="col-location" 
                          checked={visibleColumns.location} 
                          onCheckedChange={(val) => setVisibleColumns(prev => ({ ...prev, location: val }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="col-size" className="text-sm">Medidas</Label>
                        <Switch 
                          id="col-size" 
                          checked={visibleColumns.size} 
                          onCheckedChange={(val) => setVisibleColumns(prev => ({ ...prev, size: val }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="col-store_category" className="text-sm">Modelo de Loja</Label>
                        <Switch 
                          id="col-store_category" 
                          checked={visibleColumns.store_category} 
                          onCheckedChange={(val) => setVisibleColumns(prev => ({ ...prev, store_category: val }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="col-specification" className="text-sm">Especificação</Label>
                        <Switch 
                          id="col-specification" 
                          checked={visibleColumns.specification} 
                          onCheckedChange={(val) => setVisibleColumns(prev => ({ ...prev, specification: val }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="col-installation_instructions" className="text-sm">Instruções de Instalação</Label>
                        <Switch 
                          id="col-installation_instructions" 
                          checked={visibleColumns.installation_instructions} 
                          onCheckedChange={(val) => setVisibleColumns(prev => ({ ...prev, installation_instructions: val }))}
                        />
                      </div>
                      
                      {customFieldLabels.map((label, idx) => {
                        if (!label) return null;
                        const fieldKey = `custom_field_${idx + 1}`;
                        return (
                          <div key={fieldKey} className="flex items-center justify-between">
                            <Label htmlFor={`col-${fieldKey}`} className="text-sm">{label}</Label>
                            <Switch 
                              id={`col-${fieldKey}`} 
                              checked={visibleColumns[fieldKey]} 
                              onCheckedChange={(val) => setVisibleColumns(prev => ({ ...prev, [fieldKey]: val }))}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

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
                      const labels: Array<string | null> = [
                        campaign?.piece_custom_field_1_label ?? null,
                        campaign?.piece_custom_field_2_label ?? null,
                        campaign?.piece_custom_field_3_label ?? null,
                        campaign?.piece_custom_field_4_label ?? null,
                        campaign?.piece_custom_field_5_label ?? null,
                      ];
                      await exportCampaignPieces(pieces, campaign?.name || "Campanha", kits, kitPieces, pieces, agency?.name, client?.name, labels);
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
                  <DropdownMenuItem onClick={() => setFindReplaceOpen(true)}>
                    <Search className="w-4 h-4 mr-2" /> Localizar e Substituir
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setKitOnlyDialogOpen(true)}>
                    <Package className="w-4 h-4 mr-2" /> Peças de kits
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setBulkDeleteOpen(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" /> {t("pieces.bulkDelete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <AddPieceDialog 
                open={pieceDialogOpen}
                onOpenChange={setPieceDialogOpen}
                existingPieces={pieces} 
                existingKits={kits}
                customFieldLabels={customFieldLabels} 
                campaignId={campaignId} 
                clientId={clientId} 
                addPieceMutation={addPiece}
                updatePieceMutation={updatePiece}
              />

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
        onEdit={(p: any) => { captureScrollSnapshot(); setEditingPiece(p); }}
        onDelete={(id: string) => deletePiece?.mutate?.(id)}
        onDistribute={handleDistributePiece}
        onMarkKitOnly={async (p: any) => { await updatePiece?.mutateAsync?.({ id: p.id, kit_only: true }); }}
        onToggleMockup={async (p: any) => { await updatePiece?.mutateAsync?.({ id: p.id, is_mockup: !p.is_mockup }); }}
        onKitClick={(kit: any) => { captureScrollSnapshot(); setViewKitDetail(kit); }}
        onDeleteKit={(id: string) => deleteKit?.mutate?.(id)}
        onToggleKitMockup={async (kit: any) => {
          const newVal = !kit.is_mockup;
          await updateKit?.mutateAsync?.({ id: kit.id, is_mockup: newVal });
        }}
        onDuplicate={handleDuplicatePiece}
        onDuplicateKit={handleDuplicateKit}
        onReorder={handleReorder}
        customFieldLabels={customFieldLabels}
        visibleColumns={visibleColumns}
        selectedPieceIds={selectedPieceIds}
        onToggleSelection={handleToggleSelection}
        onToggleSelectAll={handleToggleSelectAll}
      />

      <AddPieceDialog
        open={editingPiece !== null}
        onOpenChange={(open) => { if (!open) { setEditingPiece(null); restoreScroll(); } }}
        initialPiece={editingPiece}
        existingPieces={pieces}
        existingKits={kits}
        customFieldLabels={customFieldLabels}
        campaignId={campaignId}
        clientId={clientId}
        addPieceMutation={addPiece}
        updatePieceMutation={updatePiece}
        preserveScrollOnClose
        hideTrigger
        onBeforeSave={captureScrollSnapshot}
      />
      <FindReplaceSpecDialog
        open={findReplaceOpen}
        onOpenChange={setFindReplaceOpen}
        pieces={pieces}
        updatePiece={updatePiece}
      />

      <KitOnlyPiecesDialog
        open={kitOnlyDialogOpen}
        onOpenChange={setKitOnlyDialogOpen}
        pieces={pieces}
        kits={kits}
        kitPieces={kitPieces}
        canEdit={canEditPieces}
        canDelete={canDeletePieces}
        onEditPiece={(p) => { captureScrollSnapshot(); setEditingPiece(p); }}
        updatePiece={updatePiece}
        deletePiece={deletePiece}
        deleteKitPiece={deleteKitPiece}
      />



      {selectedPieceIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-background border border-border shadow-xl rounded-full px-4 py-2 flex items-center gap-4">
            <span className="text-sm font-medium">
              {t("pieces.piecesSelected", { count: selectedPieceIds.length })}
            </span>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                className="gap-2 rounded-full h-8 px-4"
                disabled={selectedPieceIds.length < 2}
                onClick={() => setConvertSelectionDialogOpen(true)}
                title={selectedPieceIds.length < 2 ? t("pieces.minPiecesForKit") : ""}
              >
                <Package className="w-3.5 h-3.5" />
                {t("pieces.groupInKit")}
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 rounded-full"
                onClick={() => setSelectedPieceIds([])}
                title={t("pieces.clearSelection")}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConvertSelectionToKitDialog
        open={convertSelectionDialogOpen}
        onOpenChange={(open) => {
          setConvertSelectionDialogOpen(open);
          if (!open) setSelectedPieceIds([]);
        }}
        campaignId={campaignId}
        selectedPieceIds={selectedPieceIds}
        kits={kits}
        kitPieces={kitPieces}
        pieces={pieces}
        onSuccess={() => {
          setSelectedPieceIds([]);
          qc.invalidateQueries({ queryKey: ["campaign_pieces", campaignId] });
          qc.invalidateQueries({ queryKey: ["campaign_kits", campaignId] });
          qc.invalidateQueries({ queryKey: ["campaign_kit_pieces"] });
          if (refetch) refetch();
        }}
        onCreateNewKit={() => {
          setPreSelectedForKit(selectedPieceIds);
          setCreateKitDialogOpen(true);
          setConvertSelectionDialogOpen(false);
          setSelectedPieceIds([]); // User requested immediate visual feedback
        }}
        addKitPiece={addKitPiece}
        updatePiece={updatePiece}
      />

      <CreateKitDialog
        open={createKitDialogOpen}
        onOpenChange={(open) => {
          setCreateKitDialogOpen(open);
          if (!open) {
            setPreSelectedForKit([]);
            setSelectedPieceIds([]);
          }
        }}
        campaignId={campaignId}
        kitOnlyPieces={pieces}
        existingKits={kits}
        existingPieces={pieces}
        allKitPieces={kitPieces}
        onCreateKit={(k: any) => addKit?.mutateAsync?.(k)}
        onAddKitPiece={(kp: any) => addKitPiece?.mutateAsync?.(kp)}
        onUpdateKit={(k: any) => updateKit?.mutateAsync?.(k)}
        onUpdatePiece={(p: any) => updatePiece?.mutateAsync?.(p)}
        preSelectedPieceIds={preSelectedForKit}
        displayOrder={preSelectedForKit.length > 0 ? Math.min(...preSelectedForKit.map(id => pieces.find(p => p.id === id)?.display_order ?? 999)) : undefined}
      />
      <ImportPiecesFromCampaignDialog
        open={importPiecesDialogOpen}
        onOpenChange={setImportPiecesDialogOpen}
        clientId={clientId}
        currentCampaignId={campaignId}
        existingPieces={pieces}
        existingKitCodes={kits.map((k: any) => k.code)}
        onImport={async (data) => {
          if (data.pieces.length === 0 && data.kits.length === 0) return;
          const toastId = toast.loading(
            `Importando ${data.pieces.length} peça(s) e ${data.kits.length} kit(s)...`
          );
          try {
            const { data: maxPieceRow } = await supabase
              .from("campaign_pieces")
              .select("display_order")
              .eq("campaign_id", campaignId)
              .eq("is_deleted", false)
              .lt("display_order", 10000)
              .order("display_order", { ascending: false })
              .limit(1)
              .maybeSingle();
            let nextOrder = (maxPieceRow?.display_order ?? -1) + 1;
            const idMap = new Map<string, string>();
            for (const p of data.pieces) {
              const { _originalId, ...pieceData } = p as any;
              const { data: inserted, error } = await supabase
                .from("campaign_pieces")
                .insert({ ...pieceData, display_order: nextOrder++, is_deleted: false })
                .select("id")
                .single();
              if (error) throw new Error(`Erro ao inserir peça "${pieceData.name}": ${error.message}`);
              if (inserted?.id && _originalId) idMap.set(_originalId, inserted.id);
            }
            const maxKitOrder = (await supabase
              .from("campaign_kits")
              .select("display_order")
              .eq("campaign_id", campaignId)
              .order("display_order", { ascending: false })
              .limit(1)
              .maybeSingle()).data?.display_order ?? 9999;
            let nextKitOrder = maxKitOrder + 1;
            for (const k of data.kits) {
              const { data: newKit, error: kitErr } = await supabase
                .from("campaign_kits")
                .insert({ campaign_id: campaignId, name: k.name, code: k.code, image_url: k.image_url ?? null, display_order: nextKitOrder++ })
                .select("id")
                .single();
              if (kitErr) throw new Error(`Erro ao inserir kit "${k.name}": ${kitErr.message}`);
              if (newKit?.id) {
                let kitPieceOrder = 0;
                for (const kp of k.pieces) {
                  const newPieceId = idMap.get(kp.originalPieceId);
                  if (newPieceId) {
                    const { error: kpErr } = await supabase
                      .from("campaign_kit_pieces")
                      .insert({ kit_id: newKit.id, piece_id: newPieceId, quantity: kp.quantity ?? 1, display_order: kitPieceOrder++ });
                    if (kpErr) throw new Error(`Erro ao vincular peça ao kit: ${kpErr.message}`);
                  }
                }
              }
            }
            await qc.invalidateQueries({ queryKey: ["campaign_pieces", campaignId] });
            await qc.invalidateQueries({ queryKey: ["campaign_kits", campaignId] });
            await qc.invalidateQueries({ queryKey: ["campaign_kit_pieces", campaignId] });
            toast.success(
              `${data.pieces.length} peça(s) e ${data.kits.length} kit(s) importados com sucesso!`,
              { id: toastId }
            );
          } catch (err: any) {
            toast.error(err?.message || "Erro ao importar", { id: toastId });
          }
        }}
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
          onOpenChange={(open) => { if (!open) { setViewKitDetail(null); restoreScroll(); } }}
          kit={viewKitDetail}
          kitPieces={kitPieces.filter(kp => kp.kit_id === viewKitDetail.id)}
          allPieces={pieces}
          canEdit={canEditPieces}
          onDeleteKitPiece={(id) => deleteKitPiece?.mutate?.(id)}
          onAddKitPiece={(kp) => addKitPiece?.mutateAsync?.(kp)}
          onUpdateKit={(k) => updateKit?.mutateAsync?.(k)}
          onUpdateKitPiece={(kp) => updateKitPiece?.mutateAsync?.(kp)}
          onReorderKitPieces={(updates) => reorderKitPieces?.mutateAsync?.(updates)}
          onUpdatePiece={(p) => updatePiece?.mutateAsync?.(p)}
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

interface ConvertSelectionToKitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  selectedPieceIds: string[];
  kits: any[];
  kitPieces: any[];
  pieces: any[];
  onSuccess: () => void;
  onCreateNewKit: () => void;
  addKitPiece: any;
  updatePiece: any;
}

function ConvertSelectionToKitDialog({
  open, onOpenChange, campaignId, selectedPieceIds, kits, kitPieces, pieces, onSuccess, onCreateNewKit, addKitPiece, updatePiece
}: ConvertSelectionToKitDialogProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [selectedKitId, setSelectedKitId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const existingKits = useMemo(() => kits.filter(k => !k.is_deleted), [kits]);

  const handleConfirm = async () => {
    if (mode === "new") {
      onCreateNewKit();
      return;
    }

    if (!selectedKitId) return;

    setSaving(true);
    try {
      const results = await Promise.allSettled(selectedPieceIds.map(async (pieceId) => {
        // Check if piece is already in this kit
        const alreadyInKit = kitPieces.some(kp => kp.kit_id === selectedKitId && kp.piece_id === pieceId);
        if (alreadyInKit) return;

        await addKitPiece.mutateAsync({ kit_id: selectedKitId, piece_id: pieceId });
        await updatePiece.mutateAsync({ id: pieceId, kit_only: true });
      }));

      const errors = results.filter(r => r.status === "rejected");
      if (errors.length > 0) {
        toast.error(`${errors.length} peças falharam ao serem adicionadas.`);
      } else {
        const kit = existingKits.find(k => k.id === selectedKitId);
        toast.success(t("pieces.kitGroupSuccess", { count: selectedPieceIds.length, name: kit?.name }));
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao adicionar peças: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("pieces.addToKitTitle")}</DialogTitle>
          <DialogDescription>
            {t("pieces.addToKitDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={mode} onValueChange={(v: any) => setMode(v)}>
            <div className="flex items-center space-x-2 p-3 rounded-lg border border-border bg-muted/20">
              <RadioGroupItem value="new" id="mode-new" />
              <Label htmlFor="mode-new" className="flex-1 cursor-pointer">
                <span className="font-medium">{t("pieces.createNewKit")}</span>
                <p className="text-xs text-muted-foreground">{t("pieces.createNewKitSub")}</p>
              </Label>
            </div>
            {existingKits.length > 0 && (
              <div className="flex items-center space-x-2 p-3 rounded-lg border border-border bg-muted/20">
                <RadioGroupItem value="existing" id="mode-existing" />
                <Label htmlFor="mode-existing" className="flex-1 cursor-pointer">
                  <span className="font-medium">{t("pieces.addToExistingKit")}</span>
                  <p className="text-xs text-muted-foreground">{t("pieces.addToExistingKitSub")}</p>
                </Label>
              </div>
            )}
          </RadioGroup>

          {mode === "existing" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <Label className="text-xs">{t("pieces.selectKit")}</Label>
              <Select value={selectedKitId} onValueChange={setSelectedKitId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("pieces.selectKitPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {existingKits.map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={saving || (mode === "existing" && !selectedKitId)}>
            {saving ? t("common.wait") : t("pieces.continueButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}