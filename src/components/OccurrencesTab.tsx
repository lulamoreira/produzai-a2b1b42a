import { useState, useRef, useMemo, useEffect } from "react";
import {
  useOccurrences, useUpdateOccurrenceStatus, useUpdateOccurrenceFields, useDeleteOccurrence,
  useCampaignEmails, useAddCampaignEmail, useDeleteCampaignEmail,
  useOccurrenceMotives, useAddOccurrenceMotive, useUpdateOccurrenceMotive, useDeleteOccurrenceMotive,
  useOccurrenceStatuses, useAddOccurrenceStatus, useUpdateOccurrenceStatus2, useDeleteOccurrenceStatusItem,
  useReorderOccurrenceMotives, useReorderOccurrenceStatuses,
} from "@/hooks/useOccurrences";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CampaignKit, CampaignKitPiece, CampaignPiece, ClientStore } from "@/hooks/useMultiClientData";
import { useCampaignKitPieces, useCampaignKits, useCampaignPieceLocations } from "@/hooks/useMultiClientData";
import OccurrenceDetailFields from "./OccurrenceDetailFields";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Mail, Settings, AlertTriangle, Copy, ExternalLink, Eye, QrCode, Download, Store, Puzzle, Calendar, Palette, CircleDot, Link2, MessageCircle, Phone, MapPin, GripVertical, User, Pencil, Flag } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import OccurrencesDashboard from "./OccurrencesDashboard";
import PhotoLightbox from "./PhotoLightbox";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableConfigItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50">
      <button type="button" className="cursor-grab touch-none mr-2 text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
        <GripVertical className="w-4 h-4" />
      </button>
      {children}
    </div>
  );
}

const GERAL_LOCATION = "GERAL - NA LOJA TODA";

type OccurrencePieceOption = {
  value: string;
  label: string;
  sortOrder: number;
};

function getOccurrencePieceOptions({
  location,
  pieces,
  kits,
  kitPieces,
}: {
  location: string | null | undefined;
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: CampaignKitPiece[];
}) {
  if (!location || location === GERAL_LOCATION) return [] as OccurrencePieceOption[];

  const filteredPieces = pieces.filter((piece) => piece.category === location);
  const kitPieceIds = new Set(kitPieces.map((kitPiece) => kitPiece.piece_id));

  const standalonePieces: OccurrencePieceOption[] = filteredPieces
    .filter((piece) => !piece.kit_only && !kitPieceIds.has(piece.id))
    .map((piece) => ({
      value: piece.id,
      label: `${piece.code} - ${piece.name}`,
      sortOrder: piece.display_order,
    }));

  const kitItems: OccurrencePieceOption[] = kits
    .map((kit) => {
      const memberPieceIds = kitPieces
        .filter((kitPiece) => kitPiece.kit_id === kit.id)
        .map((kitPiece) => kitPiece.piece_id);
      const firstMemberPiece = filteredPieces.find((piece) => memberPieceIds.includes(piece.id));

      if (!firstMemberPiece) return null;

      return {
        value: firstMemberPiece.id,
        label: `Kit ${kit.code} - ${kit.name}`,
        sortOrder: kit.display_order,
      } satisfies OccurrencePieceOption;
    })
    .filter((item): item is OccurrencePieceOption => item !== null);

  return [...standalonePieces, ...kitItems].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "pt-BR")
  );
}

function EditableLocationPiece({
  occ, campaignId, pieceLocations, pieces, kits, kitPieces, canEdit, getPieceName, updateFields,
}: {
  occ: any; campaignId: string; pieceLocations: { id: string; name: string }[];
  pieces: CampaignPiece[]; kits: CampaignKit[]; kitPieces: CampaignKitPiece[]; canEdit: boolean; getPieceName: (id: string | null) => string;
  updateFields: any;
}) {
  const [editingLocation, setEditingLocation] = useState(false);
  const [editingPiece, setEditingPiece] = useState(false);
  const isGeral = occ.location_in_store === GERAL_LOCATION;
  const pieceOptions = useMemo(
    () => getOccurrencePieceOptions({ location: occ.location_in_store, pieces, kits, kitPieces }),
    [occ.location_in_store, pieces, kits, kitPieces]
  );
  const selectedPieceOption = pieceOptions.find((option) => option.value === occ.piece_id);
  const pieceDisplayName = selectedPieceOption?.label ?? (occ.location_in_store ? "—" : getPieceName(occ.piece_id));

  const handleLocationChange = (value: string) => {
    const nextOptions = getOccurrencePieceOptions({ location: value, pieces, kits, kitPieces });
    const shouldClearPiece = value === GERAL_LOCATION || !occ.piece_id || !nextOptions.some((option) => option.value === occ.piece_id);

    updateFields.mutate({
      id: occ.id,
      campaignId,
      location_in_store: value,
      ...(shouldClearPiece ? { piece_id: null } : {}),
    });

    setEditingLocation(false);
    if (shouldClearPiece) setEditingPiece(false);
  };

  return (
    <>
      <div className="flex items-center gap-1.5 mb-1.5">
        <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        {editingLocation ? (
          <Select
            value={occ.location_in_store || ""}
            onValueChange={handleLocationChange}
          >
            <SelectTrigger className="h-6 text-xs border-0 bg-muted/50 flex-1 min-w-0">
              <SelectValue placeholder="Selecione local..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GERAL_LOCATION}>🏪 GERAL - NA LOJA TODA</SelectItem>
              {pieceLocations.map((loc) => (
                <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <>
            <span className="text-xs text-muted-foreground truncate">{occ.location_in_store || "—"}</span>
            {canEdit && (
              <button type="button" onClick={() => setEditingLocation(true)} className="text-muted-foreground hover:text-primary transition-colors ml-auto flex-shrink-0">
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </>
        )}
      </div>

      {!isGeral ? (
        <div className="flex items-center gap-1.5 mb-3">
          <Puzzle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          {editingPiece ? (
            <Select
              value={selectedPieceOption?.value || ""}
              onValueChange={(val) => {
                updateFields.mutate({ id: occ.id, campaignId, piece_id: val });
                setEditingPiece(false);
              }}
            >
              <SelectTrigger className="h-6 text-xs border-0 bg-muted/50 flex-1 min-w-0">
                <SelectValue placeholder="Selecione a peça ou kit..." />
              </SelectTrigger>
              <SelectContent>
                {pieceOptions.length > 0 ? (
                  pieceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Nenhuma peça ou kit disponível para este local.
                  </div>
                )}
              </SelectContent>
            </Select>
          ) : (
            <>
              <span className="text-xs text-muted-foreground truncate">{pieceDisplayName}</span>
              {canEdit && (
                <button type="button" onClick={() => setEditingPiece(true)} className="text-muted-foreground hover:text-primary transition-colors ml-auto flex-shrink-0">
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground italic mb-3 ml-5">
          Ocorrência geral — sem peça específica vinculada.
        </p>
      )}
    </>
  );
}

interface Props {
  campaignId: string;
  clientId?: string;
  stores: ClientStore[];
  pieces: CampaignPiece[];
  canEdit?: boolean;
  canDelete?: boolean;
  canEditReporter?: boolean;
}


const OccurrencesTab = ({ campaignId, clientId, stores, pieces, canEdit: canEditProp, canDelete: canDeleteProp, canEditReporter: canEditReporterProp }: Props) => {
  const { isAdmin, isAdminOrMaster } = useUserRole();
  const canEdit = canEditProp ?? isAdminOrMaster;
  const canDelete = canDeleteProp ?? isAdmin;
  const canEditReporter = canEditReporterProp ?? isAdminOrMaster;
  const { data: occurrences = [], isLoading } = useOccurrences(campaignId);
  const { data: pieceLocations = [] } = useCampaignPieceLocations(campaignId);
  const { data: kits = [] } = useCampaignKits(campaignId);
  const { data: kitPieces = [] } = useCampaignKitPieces(campaignId);
  const { data: motives = [] } = useOccurrenceMotives();
  const { data: emails = [] } = useCampaignEmails(campaignId);
  const { data: statuses = [] } = useOccurrenceStatuses();
  const { data: campaignInfo, refetch: refetchCampaignInfo } = useQuery({
    queryKey: ["campaign_info", campaignId],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("name, occurrence_start_date, occurrence_end_date, clients(agency_id, agencies(name))").eq("id", campaignId).maybeSingle();
      return data;
    },
    enabled: !!campaignId,
  });
  const agencyName = (campaignInfo as any)?.clients?.agencies?.name || "Agência";
  const clientName = (campaignInfo as any)?.clients?.name || "Cliente";

  // Fetch WhatsApp message templates
  const { data: whatsappLinkTemplate } = useQuery({
    queryKey: ["system_message", "whatsapp_occurrence_link"],
    queryFn: async () => {
      const { data } = await supabase.from("system_messages").select("content").eq("key", "whatsapp_occurrence_link").is("agency_id", null).maybeSingle();
      return data?.content as string | undefined;
    },
  });
  const { data: whatsappContactTemplate } = useQuery({
    queryKey: ["system_message", "whatsapp_occurrence_contact"],
    queryFn: async () => {
      const { data } = await supabase.from("system_messages").select("content").eq("key", "whatsapp_occurrence_contact").is("agency_id", null).maybeSingle();
      return data?.content as string | undefined;
    },
  });
  const activeStatuses = useMemo(() => statuses.filter((s) => s.active), [statuses]);
  const updateStatus = useUpdateOccurrenceStatus();
  const updateFields = useUpdateOccurrenceFields();
  const deleteOcc = useDeleteOccurrence();
  const addEmail = useAddCampaignEmail();
  const deleteEmail = useDeleteCampaignEmail();
  const addMotive = useAddOccurrenceMotive();
  const updateMotive = useUpdateOccurrenceMotive();
  const deleteMotive = useDeleteOccurrenceMotive();
  const addStatusItem = useAddOccurrenceStatus();
  const updateStatusItem = useUpdateOccurrenceStatus2();
  const deleteStatusItem = useDeleteOccurrenceStatusItem();
  const reorderMotives = useReorderOccurrenceMotives();
  const reorderStatuses = useReorderOccurrenceStatuses();
  const queryClient = useQueryClient();

  // Realtime subscription for occurrences
  useEffect(() => {
    const channel = supabase
      .channel(`occurrences-realtime-${campaignId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'occurrences', filter: `campaign_id=eq.${campaignId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["occurrences", campaignId] });
          queryClient.invalidateQueries({ queryKey: ["occurrence_photos", campaignId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [campaignId, queryClient]);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleMotiveDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = motives.findIndex((m) => m.id === active.id);
    const newIndex = motives.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(motives, oldIndex, newIndex);
    queryClient.setQueryData(["occurrence_motives"], reordered);
    reorderMotives.mutate(reordered.map((m, i) => ({ id: m.id, display_order: i })));
  };

  const handleStatusDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = statuses.findIndex((s) => s.id === active.id);
    const newIndex = statuses.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(statuses, oldIndex, newIndex);
    queryClient.setQueryData(["occurrence_statuses"], reordered);
    reorderStatuses.mutate(reordered.map((s, i) => ({ id: s.id, order: i })));
  };


  const getStatusLabel = (value: string) => {
    return statuses.find((s) => s.value === value)?.label || value;
  };
  const getStatusColor = (value: string) => {
    return statuses.find((s) => s.value === value)?.color || "#6366f1";
  };
  const defaultStatus = useMemo(() => statuses.find((s) => s.is_default)?.value || "pending", [statuses]);

  // Fetch all photos for occurrences in this campaign
  const occurrenceIds = useMemo(() => occurrences.map((o) => o.id), [occurrences]);
  const { data: allPhotos = [] } = useQuery({
    queryKey: ["occurrence_photos", campaignId],
    queryFn: async () => {
      if (occurrenceIds.length === 0) return [];
      const { data, error } = await supabase
        .from("occurrence_photos")
        .select("*")
        .in("occurrence_id", occurrenceIds);
      if (error) throw error;
      return data as { id: string; occurrence_id: string; photo_url: string }[];
    },
    enabled: occurrenceIds.length > 0,
  });

  const photosMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    allPhotos.forEach((p) => {
      if (!map[p.occurrence_id]) map[p.occurrence_id] = [];
      map[p.occurrence_id].push(p.photo_url);
    });
    // Also include legacy photo_url from occurrences table
    occurrences.forEach((occ) => {
      if (occ.photo_url && (!map[occ.id] || !map[occ.id].includes(occ.photo_url))) {
        if (!map[occ.id]) map[occ.id] = [];
        map[occ.id].unshift(occ.photo_url);
      }
    });
    return map;
  }, [allPhotos, occurrences]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newMotive, setNewMotive] = useState("");
  const [newStatusLabel, setNewStatusLabel] = useState("");
  const [newStatusValue, setNewStatusValue] = useState("");
  const [newStatusColor, setNewStatusColor] = useState("#6366f1");
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [occStartDate, setOccStartDate] = useState("");
  const [occEndDate, setOccEndDate] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const qrRef = useRef<HTMLDivElement>(null);

  const toggleStatus = (value: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  };

  const PRIORITY_OPTIONS = [
    { value: "critica", label: "Crítica", color: "#dc2626" },
    { value: "alta", label: "Alta", color: "#f97316" },
    { value: "media", label: "Média", color: "#eab308" },
    { value: "baixa", label: "Baixa", color: "#22c55e" },
  ];

  const togglePriority = (value: string) => {
    setSelectedPriorities((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  };

  const filteredOccurrences = useMemo(() => {
    let result = occurrences;
    if (selectedStatuses.length > 0) {
      result = result.filter((occ) => selectedStatuses.includes(occ.status || defaultStatus));
    }
    if (selectedPriorities.length > 0) {
      result = result.filter((occ) => selectedPriorities.includes((occ as any).priority || "media"));
    }
    return result;
  }, [occurrences, selectedStatuses, selectedPriorities, defaultStatus]);

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = 512;
      canvas.height = 512;
      ctx?.drawImage(img, 0, 0, 512, 512);
      const a = document.createElement("a");
      a.download = `qrcode-ocorrencias-${campaignId}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const publicLink = `${typeof window !== "undefined" ? window.location.origin : "https://produzai.lovable.app"}/ocorrencias/${campaignId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicLink);
    toast.success("Link copiado!");
  };

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MAX_EMAIL_LENGTH = 254;

  const handleAddEmail = () => {
    const trimmed = newEmail.trim();
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      toast.error("Por favor, insira um email válido");
      return;
    }
    if (trimmed.length > MAX_EMAIL_LENGTH) {
      toast.error("Email muito longo");
      return;
    }
    addEmail.mutate({ campaignId, email: trimmed }, {
      onSuccess: () => setNewEmail(""),
      onError: (e) => toast.error(e.message),
    });
  };

  const handleAddMotive = () => {
    if (!newMotive.trim()) return;
    addMotive.mutate(newMotive.trim(), { onSuccess: () => setNewMotive("") });
  };

  const getReporterLabel = (reporterType?: string) => {
    if (reporterType === "agency") return agencyName;
    if (reporterType === "fornecedor") return "Fornecedor";
    if (reporterType === "cliente") return clientName;
    return null;
  };

  const getStoreName = (id: string | null) => {
    if (!id) return "—";
    const s = stores.find((s) => s.id === id);
    return s?.nickname || s?.name || "—";
  };

  const firstPieceKitLabels = useMemo(() => {
    const labels = new Map<string, string>();

    kits.forEach((kit) => {
      const memberPieceIds = kitPieces
        .filter((kitPiece) => kitPiece.kit_id === kit.id)
        .map((kitPiece) => kitPiece.piece_id);
      const firstMemberPiece = pieces.find((piece) => memberPieceIds.includes(piece.id));

      if (firstMemberPiece) {
        labels.set(firstMemberPiece.id, `Kit ${kit.code} - ${kit.name}`);
      }
    });

    return labels;
  }, [kits, kitPieces, pieces]);

  const getPieceName = (id: string | null) => {
    if (!id) return "—";
    const kitLabel = firstPieceKitLabels.get(id);
    if (kitLabel) return kitLabel;
    const p = pieces.find((p) => p.id === id);
    return p?.name || "—";
  };

  const getMotiveName = (id: string | null) => {
    if (!id) return "—";
    return motives.find((m) => m.id === id)?.description || "—";
  };

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" className="text-xs" onClick={handleCopyLink}>
            <Copy className="w-3.5 h-3.5 mr-1" /> <span className="hidden sm:inline">Copiar Link para acesso a essa página</span><span className="sm:hidden">Copiar Link</span>
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setQrOpen(true)}>
            <QrCode className="w-3.5 h-3.5 mr-1" /> <span className="hidden sm:inline">QR-Code para acesso a essa página</span><span className="sm:hidden">QR-Code</span>
          </Button>
          <a href={publicLink} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="text-xs">
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> <span className="hidden sm:inline">Incluir Ocorrência</span><span className="sm:hidden">Incluir</span>
            </Button>
          </a>
          {canEdit && (
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setSettingsOpen(true)}>
              <Settings className="w-3.5 h-3.5 mr-1" /> <span className="hidden sm:inline">Configurar</span><span className="sm:hidden">Config.</span>
            </Button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{filteredOccurrences.length} de {occurrences.length} ocorrência(s)</span>

        {/* Período de inclusão de ocorrências */}
        {campaignInfo && (
          <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
            campaignInfo.occurrence_start_date || campaignInfo.occurrence_end_date
              ? 'border-primary/30 bg-primary/5 text-foreground'
              : 'border-destructive/30 bg-destructive/5 text-destructive'
          }`}>
            <Calendar className="w-4 h-4 shrink-0" />
            {campaignInfo.occurrence_start_date || campaignInfo.occurrence_end_date ? (
              <span>
                <strong>Período de inclusão:</strong>{' '}
                {campaignInfo.occurrence_start_date
                  ? format(new Date(campaignInfo.occurrence_start_date + 'T12:00:00'), 'dd/MM/yyyy')
                  : '—'}{' '}
                até{' '}
                {campaignInfo.occurrence_end_date
                  ? format(new Date(campaignInfo.occurrence_end_date + 'T12:00:00'), 'dd/MM/yyyy')
                  : '—'}
              </span>
            ) : (
              <span><strong>Nenhum período configurado.</strong> A inclusão de ocorrências está bloqueada.</span>
            )}
          </div>
        )}
      </div>

      {/* Dashboard */}
      {/* Status filter buttons */}
      {!isLoading && occurrences.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={selectedStatuses.length === 0 ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedStatuses([])}
          >
            Todos
          </Button>
          {activeStatuses.map((s) => (
            <Button
              key={s.id}
              variant={selectedStatuses.includes(s.value) ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs gap-1.5"
              style={selectedStatuses.includes(s.value) ? { backgroundColor: s.color, borderColor: s.color, color: '#fff' } : { borderColor: s.color, color: s.color }}
              onClick={() => toggleStatus(s.value)}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: selectedStatuses.includes(s.value) ? '#fff' : s.color }} />
              {s.label}
            </Button>
          ))}
        </div>
      )}

      {/* Priority filter buttons */}
      {!isLoading && occurrences.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted-foreground font-medium mr-1"><Flag className="w-3.5 h-3.5 inline mr-1" />Prioridade:</span>
          <Button
            variant={selectedPriorities.length === 0 ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedPriorities([])}
          >
            Todas
          </Button>
          {PRIORITY_OPTIONS.map((p) => (
            <Button
              key={p.value}
              variant={selectedPriorities.includes(p.value) ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs gap-1.5"
              style={selectedPriorities.includes(p.value) ? { backgroundColor: p.color, borderColor: p.color, color: '#fff' } : { borderColor: p.color, color: p.color }}
              onClick={() => togglePriority(p.value)}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: selectedPriorities.includes(p.value) ? '#fff' : p.color }} />
              {p.label}
            </Button>
          ))}
        </div>
      )}

      {!isLoading && occurrences.length > 0 && (
        <OccurrencesDashboard occurrences={filteredOccurrences} stores={stores} pieces={pieces} motives={motives} statuses={statuses} />
      )}

      {/* Occurrences list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" /></div>
      ) : occurrences.length === 0 ? (
        <div className="text-center py-16">
          <AlertTriangle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhuma ocorrência registrada.</p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredOccurrences.map((occ) => {
            const motiveIdx = motives.findIndex((m) => m.id === occ.motive_id);
            const MOTIVE_COLORS = [
              "border-l-primary from-primary/8 to-primary/3",
              "border-l-secondary from-secondary/8 to-secondary/3",
              "border-l-accent from-accent/8 to-accent/3",
              "border-l-info from-info/8 to-info/3",
              "border-l-destructive from-destructive/8 to-destructive/3",
              "border-l-[hsl(280,75%,55%)] from-[hsl(280,75%,55%)]/8 to-[hsl(280,75%,55%)]/3",
              "border-l-success from-success/8 to-success/3",
              "border-l-warning from-warning/8 to-warning/3",
            ];
            const motiveColor = motiveIdx >= 0 ? MOTIVE_COLORS[motiveIdx % MOTIVE_COLORS.length] : MOTIVE_COLORS[0];

            return (
              <div
                key={occ.id}
                className={`group aqua-card bg-gradient-to-br ${motiveColor} border border-border border-l-4 p-4 hover:shadow-lg transition-all duration-200`}
              >
                {/* Header: date */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {occ.created_at ? format(new Date(occ.created_at), "dd/MM/yyyy HH:mm") : "—"}
                  </span>
                </div>

                {/* Priority */}
                <div className="flex items-center gap-2 mb-2">
                  <Flag className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  {canEdit ? (
                    <Select
                      value={(occ as any).priority || "media"}
                      onValueChange={(val) => updateFields.mutate({ id: occ.id, campaignId, priority: val })}
                    >
                      <SelectTrigger className="h-6 text-[10px] border-0 bg-muted/50 w-[100px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                              {p.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-2 py-0" style={{ borderColor: PRIORITY_OPTIONS.find(p => p.value === ((occ as any).priority || "media"))?.color, color: PRIORITY_OPTIONS.find(p => p.value === ((occ as any).priority || "media"))?.color }}>
                      {PRIORITY_OPTIONS.find(p => p.value === ((occ as any).priority || "media"))?.label || "Média"}
                    </Badge>
                  )}
                </div>

                {/* Status da Ocorrência */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status da Ocorrência:</span>
                  {canEdit ? (
                    <Select
                      value={occ.status || defaultStatus}
                      onValueChange={(val) => updateStatus.mutate({ id: occ.id, status: val, campaignId })}
                    >
                      <SelectTrigger className="w-[110px] h-6 text-[10px] border-0 bg-muted/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {activeStatuses.map((s) => (
                          <SelectItem key={s.id} value={s.value}>
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                              {s.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-2 py-0" style={{ borderColor: getStatusColor(occ.status || defaultStatus), color: getStatusColor(occ.status || defaultStatus) }}>
                      {getStatusLabel(occ.status || defaultStatus)}
                    </Badge>
                  )}
                </div>

                {/* Reporter + Store */}
                {getReporterLabel((occ as any).reporter_type) && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">{getReporterLabel((occ as any).reporter_type)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Store className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-semibold text-foreground truncate">{getStoreName(occ.store_id)}</span>
                </div>

                <EditableLocationPiece
                  occ={occ}
                  campaignId={campaignId}
                  pieceLocations={pieceLocations}
                  pieces={pieces}
                  kits={kits}
                  kitPieces={kitPieces}
                  canEdit={canEdit}
                  getPieceName={getPieceName}
                  updateFields={updateFields}
                />

                {/* Motive badge */}
                <Badge variant="secondary" className="text-[10px] font-medium mb-2">
                  {getMotiveName(occ.motive_id)}
                </Badge>

                {/* Description */}
                {occ.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{occ.description}</p>
                )}

                {/* Photo thumbnails */}
                {(photosMap[occ.id]?.length ?? 0) > 0 && (
                  <div className="flex gap-1.5 mt-3">
                    {photosMap[occ.id].slice(0, 3).map((url, pi) => (
                      <button
                        key={pi}
                        type="button"
                        className="w-16 h-16 rounded-lg border border-border overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all flex-shrink-0"
                        onClick={() => { setLightboxPhotos(photosMap[occ.id]); setLightboxIndex(pi); setLightboxOpen(true); }}
                      >
                        <img src={url} alt={`Foto ${pi + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Detail fields (all 9 new fields) */}
                <OccurrenceDetailFields
                  occ={occ}
                  campaignId={campaignId}
                  pieceLocations={pieceLocations}
                  canEdit={canEdit}
                  canEditReporter={canEditReporter}
                />


                <div className="flex items-center justify-between gap-1 mt-3 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1">
                    <a href={`https://produzai.lovable.app/ocorrencia/${occ.id}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver página pública">
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Copiar link"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://produzai.lovable.app/ocorrencia/${occ.id}`);
                        toast.success("Link copiado!");
                      }}
                    >
                      <Link2 className="w-3.5 h-3.5 text-primary" />
                    </Button>
                    <a
                      href={`https://wa.me/${occ.reporter_phone_ddd && occ.reporter_phone_number ? `55${occ.reporter_phone_ddd}${occ.reporter_phone_number}` : ''}?text=${encodeURIComponent((whatsappLinkTemplate || 'Ocorrência: {url}').replace(/\{url\}/g, `https://produzai.lovable.app/ocorrencia/${occ.id}`).replace(/\{id\}/g, occ.id.slice(0, 8)).replace(/\{store\}/g, (() => { const s = stores.find(st => st.id === occ.store_id); return s?.nickname || s?.name || ''; })()))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Enviar link de acompanhamento via WhatsApp">
                        <MessageCircle className="w-3.5 h-3.5 text-success" />
                      </Button>
                    </a>
                    {occ.reporter_phone_ddd && occ.reporter_phone_number && (
                      <a
                        href={`https://wa.me/55${occ.reporter_phone_ddd}${occ.reporter_phone_number}?text=${encodeURIComponent((whatsappContactTemplate || 'Olá, tudo bem? Gostaríamos de falar sobre a sua ocorrência #{id} da Campanha "{campaign}", registrada em: {date}.').replace(/\{id\}/g, occ.id.slice(0, 8)).replace(/\{campaign\}/g, campaignInfo?.name || '').replace(/\{date\}/g, occ.created_at ? format(new Date(occ.created_at), "dd/MM/yyyy 'às' HH:mm") : '—').replace(/\{store\}/g, (() => { const s = stores.find(st => st.id === occ.store_id); return s?.nickname || s?.name || ''; })()))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Falar com o lojista via WhatsApp">
                          <Phone className="w-3.5 h-3.5 text-primary" />
                        </Button>
                      </a>
                    )}
                  </div>
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir ocorrência?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteOcc.mutate({ id: occ.id, campaignId })}>
                            SIM
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

      {/* Photo lightbox */}
      <PhotoLightbox
        photos={lightboxPhotos}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />

      {/* QR Code dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>QR Code - Ocorrências</DialogTitle>
            <DialogDescription>Escaneie para abrir o formulário público.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div ref={qrRef} className="bg-white p-4 rounded-xl">
              <QRCodeSVG value={publicLink} size={200} level="M" />
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadQR}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar PNG
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings dialog (emails + motives) */}
      <Dialog open={settingsOpen} onOpenChange={(open) => {
        setSettingsOpen(open);
        if (open && campaignInfo) {
          setOccStartDate((campaignInfo as any).occurrence_start_date || "");
          setOccEndDate((campaignInfo as any).occurrence_end_date || "");
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurações de Ocorrências</DialogTitle>
            <DialogDescription>Gerencie emails, motivos, status e período.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="emails">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="emails" className="gap-1.5"><Mail className="w-3.5 h-3.5" /> Emails</TabsTrigger>
              <TabsTrigger value="motives" className="gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Motivos</TabsTrigger>
              <TabsTrigger value="statuses" className="gap-1.5"><CircleDot className="w-3.5 h-3.5" /> Status</TabsTrigger>
              <TabsTrigger value="period" className="gap-1.5"><Calendar className="w-3.5 h-3.5" /> Período</TabsTrigger>
            </TabsList>

            <TabsContent value="emails" className="space-y-3 mt-4">
              <p className="text-xs text-muted-foreground">Até 5 emails receberão notificação de novas ocorrências.</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddEmail())}
                />
                <Button size="sm" onClick={handleAddEmail} disabled={emails.length >= 5 || addEmail.isPending}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {emails.map((em) => (
                <div key={em.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50">
                  <span className="text-sm">{em.email}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteEmail.mutate({ id: em.id, campaignId })}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="motives" className="space-y-3 mt-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Novo motivo"
                  value={newMotive}
                  onChange={(e) => setNewMotive(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddMotive())}
                />
                <Button size="sm" onClick={handleAddMotive} disabled={addMotive.isPending}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleMotiveDragEnd}>
                <SortableContext items={motives.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                  {motives.map((m) => (
                    <SortableConfigItem key={m.id} id={m.id}>
                      <span className="text-sm flex-1">{m.description}</span>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={m.active}
                          onCheckedChange={(checked) => updateMotive.mutate({ id: m.id, active: checked })}
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir motivo?</AlertDialogTitle>
                              <AlertDialogDescription>Ocorrências existentes com este motivo não serão afetadas.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMotive.mutate(m.id)}>
                                SIM
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </SortableConfigItem>
                  ))}
                </SortableContext>
              </DndContext>
            </TabsContent>

            <TabsContent value="statuses" className="space-y-3 mt-4">
              <p className="text-xs text-muted-foreground">Gerencie os status disponíveis para as ocorrências.</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome (ex: Em análise)"
                  value={newStatusLabel}
                  onChange={(e) => setNewStatusLabel(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Valor (ex: analyzing)"
                  value={newStatusValue}
                  onChange={(e) => setNewStatusValue(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  className="w-[120px]"
                />
                <input
                  type="color"
                  value={newStatusColor}
                  onChange={(e) => setNewStatusColor(e.target.value)}
                  className="w-9 h-9 rounded-md border border-input cursor-pointer p-0.5"
                />
                <Button size="sm" onClick={() => {
                  if (!newStatusLabel.trim() || !newStatusValue.trim()) { toast.error("Preencha nome e valor."); return; }
                  addStatusItem.mutate({ label: newStatusLabel.trim(), value: newStatusValue.trim(), color: newStatusColor }, {
                    onSuccess: () => { setNewStatusLabel(""); setNewStatusValue(""); setNewStatusColor("#6366f1"); },
                    onError: (e) => toast.error(e.message),
                  });
                }} disabled={addStatusItem.isPending}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleStatusDragEnd}>
                <SortableContext items={statuses.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  {statuses.map((s) => (
                    <SortableConfigItem key={s.id} id={s.id}>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-sm font-medium">{s.label}</span>
                        <span className="text-[10px] text-muted-foreground">({s.value})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={s.color}
                          onChange={(e) => updateStatusItem.mutate({ id: s.id, color: e.target.value })}
                          className="w-7 h-7 rounded border border-input cursor-pointer p-0.5"
                        />
                        <Switch
                          checked={s.active}
                          onCheckedChange={(checked) => updateStatusItem.mutate({ id: s.id, active: checked })}
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir status "{s.label}"?</AlertDialogTitle>
                              <AlertDialogDescription>Ocorrências existentes com este status não serão afetadas.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteStatusItem.mutate(s.id)}>
                                SIM
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </SortableConfigItem>
                  ))}
                </SortableContext>
              </DndContext>
            </TabsContent>

            <TabsContent value="period" className="space-y-3 mt-4">
              <p className="text-xs text-muted-foreground">Defina o período em que a inclusão de ocorrências estará liberada. Fora desse período, o formulário será bloqueado.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Data Início</label>
                  <Input type="date" value={occStartDate} onChange={(e) => setOccStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Data Fim</label>
                  <Input type="date" value={occEndDate} onChange={(e) => setOccEndDate(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={async () => {
                  const { error } = await supabase.from("campaigns").update({
                    occurrence_start_date: occStartDate || null,
                    occurrence_end_date: occEndDate || null,
                  } as any).eq("id", campaignId);
                  if (error) { toast.error("Erro ao salvar período."); return; }
                  toast.success("Período salvo!");
                  refetchCampaignInfo();
                }}>Salvar</Button>
                <Button variant="outline" size="sm" onClick={async () => {
                  setOccStartDate("");
                  setOccEndDate("");
                  await supabase.from("campaigns").update({
                    occurrence_start_date: null,
                    occurrence_end_date: null,
                  } as any).eq("id", campaignId);
                  toast.success("Período removido!");
                  refetchCampaignInfo();
                }}>Limpar</Button>
              </div>
              {occStartDate && occEndDate && (
                <p className="text-xs text-muted-foreground">Ocorrências liberadas de <strong>{format(new Date(occStartDate + "T00:00:00"), "dd/MM/yyyy")}</strong> até <strong>{format(new Date(occEndDate + "T00:00:00"), "dd/MM/yyyy")}</strong>.</p>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OccurrencesTab;
