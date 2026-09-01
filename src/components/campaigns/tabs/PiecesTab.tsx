import React, { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { 
  Plus, Download, Upload, Sparkles, RefreshCw, ArrowDownAZ, MapPin, Copy, 
  Trash2, Search, X, Package, MoreHorizontal, Presentation, Settings2, Columns, CaseSensitive,
  FileSpreadsheet
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
import ChangeCaseDialog from "@/components/ChangeCaseDialog";
import { exportRequoteSheet } from "@/lib/exportRequoteSheet";
import { disambiguateKitPieceNames } from "@/lib/disambiguateKitPieces";
import { splitKitByVariant, normalizeBareKitName } from "@/lib/splitKitPrimarySecondary";

import { ensureCampaignLocations } from "@/lib/ensureCampaignLocations";
import { OneNoteImportDialog } from "@/components/OneNoteImportDialog";
import { parseOneNoteFile, type OneNoteParsedPiece } from "@/lib/parseOneNoteSheet";


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
  const [oneNoteOpen, setOneNoteOpen] = useState(false);
  const [oneNoteParsed, setOneNoteParsed] = useState<OneNoteParsedPiece[]>([]);
  const oneNoteInputRef = useRef<HTMLInputElement>(null);

  /** Lê o arquivo cru do OneNote e abre o diálogo de confirmação. */
  const handleOneNoteFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed = await parseOneNoteFile(file);
      if (parsed.length === 0) {
        toast.error("Nenhuma peça encontrada na planilha.");
        return;
      }
      setOneNoteParsed(parsed);
      setOneNoteOpen(true);
    } catch (err: any) {
      toast.error(`Erro ao ler planilha: ${err?.message || err}`);
    }
  };

  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [kitOnlyDialogOpen, setKitOnlyDialogOpen] = useState(false);
  const [customExportOpen, setCustomExportOpen] = useState(false);
  const [changeCaseOpen, setChangeCaseOpen] = useState(false);
  const [selectedPieceIds, setSelectedPieceIds] = useState<string[]>([]);
  const [convertSelectionDialogOpen, setConvertSelectionDialogOpen] = useState(false);
  const [preSelectedForKit, setPreSelectedForKit] = useState<string[]>([]);
  const [bulkLocationDialogOpen, setBulkLocationDialogOpen] = useState(false);
  const [bulkLocationValue, setBulkLocationValue] = useState("");
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

  const [showKitPieces, setShowKitPieces] = useState(false);
  const searchTerm = pieceSearch.trim().toLowerCase();
  const matchesSearch = (item: { name?: string; code?: number; category?: string | null }) => {
    if (!searchTerm) return true;
    const name = (item.name || "").toLowerCase();
    const code = String(item.code ?? "").toLowerCase();
    const category = (item.category || "").toLowerCase();
    return name.includes(searchTerm) || code.includes(searchTerm) || category.includes(searchTerm);
  };

  const visiblePieces = useMemo(
    () => {
      const base = showKitPieces ? pieces : pieces.filter(p => !p.kit_only);
      return base.filter(matchesSearch);
    },
    [pieces, showKitPieces, searchTerm]
  );
  const filteredKits = useMemo(
    () => kits.filter(matchesSearch),
    [kits, searchTerm]
  );
  const kitOnlyPieces = useMemo(() => pieces.filter(p => p.kit_only), [pieces]);

  const handleExportRequoteSheet = async () => {
    if (selectedPieceIds.length === 0) {
      toast.info("Selecione ao menos uma peça (use as caixas de seleção) para gerar a recotação.");
      return;
    }
    const toastId = "export-requote-sheet";
    toast.loading("Gerando planilha de recotação...", { id: toastId });
    try {
      const selectedSet = new Set(selectedPieceIds);
      // Pieces (kit_only=false) that were selected go as columns directly.
      const standalonePieces = pieces.filter((p) => selectedSet.has(p.id) && !p.kit_only);
      // For kit_only pieces selected, include their parent kits as columns automatically.
      const kitIdsFromSelectedComponents = new Set<string>();
      const selectedKitOnlyIds = pieces.filter((p) => selectedSet.has(p.id) && p.kit_only).map((p) => p.id);
      for (const kp of kitPieces) {
        if (selectedKitOnlyIds.includes(kp.piece_id)) kitIdsFromSelectedComponents.add(kp.kit_id);
      }
      // Also include kits explicitly selected (if any kit ids ever appear in selectedPieceIds).
      for (const k of kits) if (selectedSet.has(k.id)) kitIdsFromSelectedComponents.add(k.id);
      const includedKits = kits.filter((k) => kitIdsFromSelectedComponents.has(k.id));

      if (standalonePieces.length + includedKits.length === 0) {
        toast.error("Nenhuma peça válida selecionada para recotação.", { id: toastId });
        return;
      }

      await exportRequoteSheet({
        stores,
        pieces: standalonePieces,
        allPieces: pieces,
        kits: includedKits,
        kitPieces,
        qtyMap,
        campaignName: campaign?.name || "Campanha",
        agencyName: agency?.name,
        clientName: client?.name,
        currencyCode: campaign?.currency_code,
      });
      toast.success("Planilha de recotação gerada!", { id: toastId });
    } catch (e: any) {
      toast.error(`Erro ao gerar recotação: ${e?.message || e}`, { id: toastId });
    }
  };

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

    // (b) Registro kit-aware: guarda { kitName, category, code } de cada peça
    //     Kits são agrupados por (nome + localização), nunca só pelo nome.
    const kitMembers: { kitName: string; category: string; code: number; name: string }[] = [];
    const kitKeyOrder: Array<{ kitName: string; category: string }> = [];


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

        // (a) Coluna "Kit" preenchida => componente de kit (kit_only forçado)
        const kitName = (row.kit ?? "").trim();
        const kitOnlyFromColumn = ["true", "1", "sim", "yes"].includes(String(row.kit_only ?? "").toLowerCase());

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
          kit_only: kitName ? true : kitOnlyFromColumn,
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
        
        if (kitName) {
          const kitCategory = String(pieceData.category ?? "").trim();
          kitMembers.push({ kitName, category: kitCategory, code: finalCode, name });
          if (!kitKeyOrder.some((k) => k.kitName === kitName && k.category === kitCategory)) {
            kitKeyOrder.push({ kitName, category: kitCategory });
          }
        }


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
    
    // (c) Criar kits e ligar componentes
    let kitsCreated = 0;
    if (kitKeyOrder.length > 0) {
      options.onProgress?.(total, total, "Criando kits...");

      // 1. Mapa code→id das peças da campanha
      const { data: allPieces } = await supabase
        .from("campaign_pieces")
        .select("id, code")
        .eq("campaign_id", campaignId)
        .eq("is_deleted", false);
      const codeToId = new Map((allPieces || []).map(p => [p.code, p.id]));

      // 2. Próximo código de kit
      const { data: existingKits } = await supabase
        .from("campaign_kits")
        .select("id, name, code")
        .eq("campaign_id", campaignId)
        .eq("is_deleted", false);
      const kitByName = new Map((existingKits || []).map(k => [k.name, k.id]));
      const maxKitCode = (existingKits || []).reduce((max, k) => Math.max(max, k.code ?? 0), 0);
      let nextKitCode = maxKitCode + 1;

      // Nome final: sufixo da localização só quando o mesmo nome colide
      // entre localizações diferentes dentro desta importação.
      const nameCollisions = new Map<string, number>();
      for (const k of kitKeyOrder) {
        nameCollisions.set(k.kitName, (nameCollisions.get(k.kitName) ?? 0) + 1);
      }

      // 3. Para cada par (nome, localização) distinto, na ordem de aparição
      for (const key of kitKeyOrder) {
        const baseName =
          (nameCollisions.get(key.kitName) ?? 0) > 1 && key.category
            ? `${key.kitName} - ${key.category}`
            : key.kitName;

        const groupMembers = kitMembers.filter(
          m => m.kitName === key.kitName && m.category === key.category,
        );

        // Primária x Secundária nunca no mesmo kit (neutras entram nos dois).
        const variants = splitKitByVariant(
          baseName,
          key.category || null,
          groupMembers,
          m => m.name,
        );

        for (const variant of variants) {
          const finalName = normalizeBareKitName(variant.name, key.category);
          let kitId = kitByName.get(finalName) as string | undefined;

          if (!kitId) {
            const { data: newKit, error: kitError } = await supabase
              .from("campaign_kits")
              .insert({
                campaign_id: campaignId,
                name: finalName,
                category: key.category || null,
                code: nextKitCode++,
              })
              .select()
              .single();
            if (kitError) {
              console.error(`Erro ao criar kit "${finalName}":`, kitError);
              continue;
            }
            kitId = newKit.id;
            kitByName.set(finalName, kitId);
            kitsCreated++;
          }

          // Ligar componentes (quantity sempre 1)
          let displayOrder = 0;
          for (const member of variant.members) {
            const pieceId = codeToId.get(member.code);
            if (!pieceId) continue;
            const { error: kpError } = await supabase
              .from("campaign_kit_pieces")
              .insert({ kit_id: kitId, piece_id: pieceId, quantity: 1, display_order: displayOrder++ });
            if (kpError) console.error(`Erro ao ligar peça ${member.code} ao kit "${finalName}":`, kpError);
          }
        }
      }


    }

    // Desambiguação automática de nomes duplicados entre peças de kits
    let renamedCount = 0;
    try {
      renamedCount = await disambiguateKitPieceNames(campaignId);
    } catch (err) {
      console.error("Falha na desambiguação de nomes de peças de kit:", err);
    }

    toast.success(`Importação concluída: ${importedCount} peças importadas${kitsCreated > 0 ? ` e ${kitsCreated} kits criados` : ""}.${renamedCount > 0 ? ` ${renamedCount} nome(s) desambiguado(s).` : ""}${skippedCount > 0 ? ` ${skippedCount} linhas ignoradas (sem nome).` : ""}`);
    
    
    // Registra no dialog "Gerenciar Localizações" toda localização nova vinda da planilha
    try {
      await ensureCampaignLocations(campaignId);
    } catch (err) {
      console.error("Falha ao registrar localizações da campanha:", err);
    }

    qc.invalidateQueries({ queryKey: ["campaign_pieces", campaignId] });
    qc.invalidateQueries({ queryKey: ["campaign_kits", campaignId] });
    qc.invalidateQueries({ queryKey: ["campaign_kit_pieces", campaignId] });
    qc.invalidateQueries({ queryKey: ["campaign_piece_locations"] });
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

  /** Localização (categoria pai) de um kit: metadado próprio ou herdado da 1ª peça componente. */
  const getKitLocation = useCallback((kit: any): string => {
    const own = (kit?.category ?? "").trim();
    if (own) return own;
    const kps = kitPieces
      .filter((kp: any) => kp.kit_id === kit.id)
      .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const firstPiece = pieces.find((p: any) => p.id === kps[0]?.piece_id);
    return (firstPiece?.category ?? "").trim();
  }, [pieces, kitPieces]);

  const countsByLocation = useMemo(() => {
    const counts: Record<string, number> = {};
    pieces.filter(p => !p.kit_only).forEach(p => {
      const loc = (p.category || "").trim();
      counts[loc] = (counts[loc] || 0) + 1;
    });
    kits.forEach(k => {
      const loc = getKitLocation(k);
      counts[loc] = (counts[loc] || 0) + 1;
    });
    return counts;
  }, [pieces, kits, getKitLocation]);

  /**
   * Aplica a ordem de localizações escolhida no dialog:
   * agrupa peças/kits por localização (na ordem definida), ordena
   * alfabeticamente pelo nome dentro de cada grupo, grava display_order
   * e recodifica todos os códigos sequencialmente.
   */
  const handleApplyLocationOrder = async (orderedLocations: string[]) => {
    const rank = new Map<string, number>();
    orderedLocations.forEach((loc, i) => rank.set((loc || "").trim(), i));
    const rankOf = (loc: string) => rank.get((loc || "").trim()) ?? Number.MAX_SAFE_INTEGER;

    type Entry = { type: "piece" | "kit"; item: any; loc: string; name: string };
    const entries: Entry[] = [
      ...pieces
        .filter((p: any) => !p.kit_only)
        .map((p: any) => ({ type: "piece" as const, item: p, loc: (p.category || "").trim(), name: p.name || "" })),
      ...kits.map((k: any) => ({ type: "kit" as const, item: k, loc: getKitLocation(k), name: k.name || "" })),
    ];

    entries.sort((a, b) => {
      const ra = rankOf(a.loc);
      const rb = rankOf(b.loc);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name, "pt-BR", { numeric: true, sensitivity: "base" });
    });

    const toastId = "apply-location-order";
    toast.loading("Aplicando ordenação e recodificando...", { id: toastId });

    try {
      // 1) display_order sequencial no nível superior
      const pieceUpdates: Array<{ id: string; display_order: number; code: number }> = [];
      const kitUpdates: Array<{ id: string; display_order: number; code: number }> = [];
      const kitChildUpdates: Array<{ id: string; code: number }> = [];

      let nextCode = 1;
      entries.forEach((entry, index) => {
        if (entry.type === "piece") {
          pieceUpdates.push({ id: entry.item.id, display_order: index, code: nextCode++ });
        } else {
          kitUpdates.push({ id: entry.item.id, display_order: index, code: nextCode++ });
          // peças componentes recebem códigos logo após o kit
          const children = kitPieces
            .filter((kp: any) => kp.kit_id === entry.item.id)
            .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
          for (const kp of children) {
            const child = pieces.find((p: any) => p.id === kp.piece_id && p.kit_only);
            if (child) kitChildUpdates.push({ id: child.id, code: nextCode++ });
          }
        }
      });

      // 2) Persistência em lotes
      const chunk = <T,>(arr: T[], size: number) =>
        Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

      for (const batch of chunk(pieceUpdates, 25)) {
        const results = await Promise.all(
          batch.map(u =>
            supabase.from("campaign_pieces").update({ display_order: u.display_order, code: u.code }).eq("id", u.id)
          )
        );
        const err = results.find(r => r.error)?.error;
        if (err) throw err;
      }

      for (const batch of chunk(kitChildUpdates, 25)) {
        const results = await Promise.all(
          batch.map(u => supabase.from("campaign_pieces").update({ code: u.code }).eq("id", u.id))
        );
        const err = results.find(r => r.error)?.error;
        if (err) throw err;
      }

      for (const batch of chunk(kitUpdates, 25)) {
        const results = await Promise.all(
          batch.map(u =>
            supabase.from("campaign_kits").update({ display_order: u.display_order, code: u.code }).eq("id", u.id)
          )
        );
        const err = results.find(r => r.error)?.error;
        if (err) throw err;
      }

      toast.success(`Ordenação aplicada a ${entries.length} item(ns) e códigos recodificados.`, { id: toastId });

      qc.invalidateQueries({ queryKey: ["campaign_pieces", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign_kits", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign_kit_pieces", campaignId] });
      if (refetch) await refetch();
    } catch (error: any) {
      toast.error("Erro ao aplicar ordenação: " + (error?.message ?? "desconhecido"), { id: toastId });
    }
  };


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
      category: kit.category ?? null,
      sub_location: kit.sub_location ?? null,
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
      <div className="sticky top-0 z-30 bg-background -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3 pb-3 border-b border-border/40 space-y-3">
        {/* Linha de filtros e contadores */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <span className="shrink-0 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-accent/15 text-accent-foreground">
            {visiblePieces.length + filteredKits.length} {t("pieces.pieceCountShort")}
          </span>
          <div className="relative flex-1 min-w-0 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("common.search") + " peça/kit"}
              value={pieceSearch}
              onChange={(e) => setPieceSearch(e.target.value)}
              className="h-9 w-full pl-9 pr-8 text-sm"
            />
            {pieceSearch && (
              <button
                onClick={() => setPieceSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {kitOnlyPieces.length > 0 && (
            <Button
              size="sm"
              variant={showKitPieces ? "default" : "outline"}
              onClick={() => setShowKitPieces(v => !v)}
              className="shrink-0 text-[10px] sm:text-xs gap-1 h-9"
              title="Mostra as peças que existem somente dentro de kits, para permitir selecioná-las (o kit pai é incluído automaticamente na recotação)."
            >
              {showKitPieces ? "✓ " : ""}Mostrar peças de kits ({kitOnlyPieces.length})
            </Button>
          )}
        </div>

        {/* Linha de ações */}
        <div className="flex flex-wrap items-center gap-2">
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
                  <DropdownMenuItem onClick={() => setCustomExportOpen(true)}>
                    <Settings2 className="w-4 h-4 mr-2" /> Exportar Personalizado
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setChangeCaseOpen(true)}>
                    <CaseSensitive className="w-4 h-4 mr-2" /> Maiúsculas e Minúsculas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPieceImportOpen(true)}>
                    <Upload className="w-4 h-4 mr-2" /> {t("common.import")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => oneNoteInputRef.current?.click()}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Importar do OneNote
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
                  <DropdownMenuItem
                    onClick={handleExportRequoteSheet}
                    disabled={selectedPieceIds.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" /> Planilha de recotação (selecionadas)
                    {selectedPieceIds.length > 0 && (
                      <span className="ml-auto text-[10px] text-muted-foreground">{selectedPieceIds.length}</span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setBulkDeleteOpen(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" /> {t("pieces.bulkDelete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <div className="flex-1" />

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
        kits={filteredKits}
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
                size="sm"
                variant="outline"
                className="gap-2 rounded-full h-8 px-4"
                onClick={() => setBulkLocationDialogOpen(true)}
              >
                <MapPin className="w-3.5 h-3.5" />
                Localização na Loja
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
        onSuccess={async () => {
          setSelectedPieceIds([]);
          try {
            await disambiguateKitPieceNames(campaignId);
          } catch (err) {
            console.error("Falha na desambiguação de nomes de peças de kit:", err);
          }
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

      <Dialog open={bulkLocationDialogOpen} onOpenChange={setBulkLocationDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Localização na Loja</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-location-input">Localização na Loja</Label>
              <Input
                id="bulk-location-input"
                list="bulk-location-categories"
                value={bulkLocationValue}
                onChange={(e) => setBulkLocationValue(e.target.value.toUpperCase())}
                placeholder="Ex: STANDARD P, PAREDE"
                autoFocus
              />
              <datalist id="bulk-location-categories">
                {Array.from(
                  new Set(
                    pieces
                      .map((p: any) => (p.category || "").toString().trim().toUpperCase())
                      .filter(Boolean)
                  )
                )
                  .sort()
                  .map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
              </datalist>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkLocationDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={async () => {
                const value = bulkLocationValue.trim().toUpperCase();
                if (!value) {
                  toast.error("Digite a localização");
                  return;
                }
                const { error } = await supabase
                  .from("campaign_pieces")
                  .update({ category: value })
                  .in("id", selectedPieceIds)
                  .eq("campaign_id", campaignId);
                if (error) {
                  toast.error("Erro: " + error.message);
                  return;
                }
                toast.success(`Localização "${value}" aplicada a ${selectedPieceIds.length} peça(s).`);
                qc.invalidateQueries({ queryKey: ["campaign_pieces", campaignId] });
                if (refetch) refetch();
                setSelectedPieceIds([]);
                setBulkLocationValue("");
                setBulkLocationDialogOpen(false);
              }}
            >
              Aplicar a {selectedPieceIds.length} peça(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        onAddKitPiece={async (kp: any) => {
          await addKitPiece?.mutateAsync?.(kp);
          try {
            await disambiguateKitPieceNames(campaignId);
          } catch (err) {
            console.error("Falha na desambiguação de nomes de peças de kit:", err);
          }
          qc.invalidateQueries({ queryKey: ["campaign_pieces", campaignId] });
          qc.invalidateQueries({ queryKey: ["campaign_kit_pieces"] });
        }}
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
        onApply={handleApplyLocationOrder}
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
          onAddKitPiece={async (kp) => {
            await addKitPiece?.mutateAsync?.(kp);
            try {
              await disambiguateKitPieceNames(campaignId);
            } catch (err) {
              console.error("Falha na desambiguação de nomes de peças de kit:", err);
            }
            qc.invalidateQueries({ queryKey: ["campaign_pieces", campaignId] });
            qc.invalidateQueries({ queryKey: ["campaign_kit_pieces"] });
          }}
          onUpdateKit={(k) => updateKit?.mutateAsync?.(k)}
          onUpdateKitPiece={(kp) => updateKitPiece?.mutateAsync?.(kp)}
          onReorderKitPieces={(updates) => reorderKitPieces?.mutateAsync?.(updates)}
          onUpdatePiece={(p) => updatePiece?.mutateAsync?.(p)}
        />
      )}
      
      <input
        ref={oneNoteInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleOneNoteFile}
      />
      <OneNoteImportDialog
        open={oneNoteOpen}
        onOpenChange={setOneNoteOpen}
        campaignId={campaignId}
        campaignName={campaign?.name || "campanha atual"}
        parsed={oneNoteParsed}
      />


      <ImportWizardDialog
        open={pieceImportOpen}
        onOpenChange={setPieceImportOpen}
        mode="pieces"
        clientId={clientId}
        campaignId={campaignId}
        existingItems={pieces.map(p => ({ id: p.id, name: p.name || p.code }))}
        onImport={handlePiecesImport}
      />

      <CustomExportDialog
        open={customExportOpen}
        onOpenChange={setCustomExportOpen}
        pieces={pieces}
        kits={kits}
        kitPieces={kitPieces}
        customFieldLabels={customFieldLabels}
        campaignName={campaign?.name || "Campanha"}
        clientId={clientId}
      />

      <ChangeCaseDialog
        open={changeCaseOpen}
        onOpenChange={setChangeCaseOpen}
        pieces={pieces}
        kits={kits}
        customFieldLabels={customFieldLabels}
        campaignId={campaignId}
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