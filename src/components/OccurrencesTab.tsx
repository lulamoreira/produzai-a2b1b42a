import { useState, useRef, useMemo, useEffect } from "react";
import { PRIORITY_OPTIONS } from "@/types/occurrence";
import { getDefaultStatusValue } from "@/lib/occurrenceHelpers";
import { useClientPermission } from "@/hooks/useClientPermission";
import {
  useOccurrences,
  useCampaignEmails, useAddCampaignEmail, useDeleteCampaignEmail,
  useOccurrenceMotives, useAddOccurrenceMotive, useUpdateOccurrenceMotive, useDeleteOccurrenceMotive,
  useOccurrenceStatuses, useAddOccurrenceStatus, useUpdateOccurrenceStatus2, useDeleteOccurrenceStatusItem,
  useReorderOccurrenceMotives, useReorderOccurrenceStatuses,
} from "@/hooks/useOccurrences";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CampaignKit, CampaignKitPiece, CampaignPiece, ClientStore } from "@/hooks/useMultiClientData";
import { useCampaignKitPieces, useCampaignKits, useCampaignPieceLocations } from "@/hooks/useMultiClientData";
import OccurrenceCard from "./OccurrenceCard";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Trash2, Mail, Settings, AlertTriangle, Copy, ExternalLink, QrCode, Download, Calendar, CircleDot, GripVertical, Flag, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";

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
  // Read initial store filter from URL params
  const initialStoreFilter = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("filterStore") || "";
  }, []);
  const { isAdmin, isAdminOrMaster } = useUserRole();
  const canEdit = canEditProp ?? isAdminOrMaster;
  const canDelete = canDeleteProp ?? isAdmin;
  const canEditReporter = canEditReporterProp ?? isAdminOrMaster;
  const { hasPermission: canLockCards } = useClientPermission(clientId, "can_lock_cards");
  const [bulkLockLoading, setBulkLockLoading] = useState(false);
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


  const defaultStatus = useMemo(() => getDefaultStatusValue(statuses), [statuses]);

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
  const [searchStore, setSearchStore] = useState(initialStoreFilter);
  const [filterCity, setFilterCity] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);

  const toggleStatus = (value: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  };

  // PRIORITY_OPTIONS is now imported from @/types/occurrence

  const togglePriority = (value: string) => {
    setSelectedPriorities((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  };

  const cityOptions = useMemo(() => {
    const cities = new Set<string>();
    stores.forEach((s) => { if (s.city) cities.add(s.city); });
    return Array.from(cities).sort();
  }, [stores]);

  const stateOptions = useMemo(() => {
    const states = new Set<string>();
    stores.forEach((s) => { if (s.state) states.add(s.state); });
    return Array.from(states).sort();
  }, [stores]);

  const filteredOccurrences = useMemo(() => {
    let result = occurrences;
    if (selectedStatuses.length > 0) {
      result = result.filter((occ) => selectedStatuses.includes(occ.status || defaultStatus));
    }
    if (selectedPriorities.length > 0) {
      result = result.filter((occ) => selectedPriorities.includes((occ as any).priority || "media"));
    }
    if (filterState) {
      const storeIdsInState = new Set(stores.filter((s) => s.state === filterState).map((s) => s.id));
      result = result.filter((occ) => occ.store_id && storeIdsInState.has(occ.store_id));
    }
    if (filterCity) {
      const storeIdsInCity = new Set(stores.filter((s) => s.city === filterCity).map((s) => s.id));
      result = result.filter((occ) => occ.store_id && storeIdsInCity.has(occ.store_id));
    }
    if (searchStore.trim()) {
      const term = searchStore.trim().toLowerCase();
      result = result.filter((occ) => {
        if (!occ.store_id) return false;
        const s = stores.find((st) => st.id === occ.store_id);
        if (!s) return false;
        return (
          (s.name || "").toLowerCase().includes(term) ||
          (s.nickname || "").toLowerCase().includes(term) ||
          (s.store_code || "").toLowerCase().includes(term)
        );
      });
    }
    if (filterDateFrom) {
      result = result.filter((occ) => occ.created_at && occ.created_at >= filterDateFrom);
    }
    if (filterDateTo) {
      const toEnd = filterDateTo + "T23:59:59";
      result = result.filter((occ) => occ.created_at && occ.created_at <= toEnd);
    }
    return result;
  }, [occurrences, selectedStatuses, selectedPriorities, defaultStatus, filterCity, filterState, filterDateFrom, filterDateTo, searchStore, stores]);

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

      {/* Summary Dashboard */}
      {!isLoading && occurrences.length > 0 && (() => {
        const total = filteredOccurrences.length;
        const totalAll = occurrences.length;
        const byStatus: Record<string, number> = {};
        filteredOccurrences.forEach(o => {
          const st = o.status || "sem_status";
          byStatus[st] = (byStatus[st] || 0) + 1;
        });
        const byPriority: Record<string, number> = {};
        filteredOccurrences.forEach(o => {
          const p = o.priority || "media";
          byPriority[p] = (byPriority[p] || 0) + 1;
        });
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {/* Total */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
              <p className="text-2xl font-bold text-primary">{total}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{total !== totalAll ? `de ${totalAll}` : ''} ocorrência(s)</p>
            </div>
            {/* By status */}
            {activeStatuses.map((s) => {
              const count = byStatus[s.value] || 0;
              return (
                <div key={s.id} className="rounded-lg border p-3 text-center" style={{ borderColor: `${s.color}40`, backgroundColor: `${s.color}08` }}>
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{count}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              );
            })}
            {/* By priority */}
            {PRIORITY_OPTIONS.map((p) => {
              const count = byPriority[p.value] || 0;
              return (
                <div key={p.value} className="rounded-lg border p-3 text-center" style={{ borderColor: `${p.color}40`, backgroundColor: `${p.color}08` }}>
                  <p className="text-2xl font-bold" style={{ color: p.color }}>{count}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{p.label}</p>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Filters */}
      {!isLoading && occurrences.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-3">
          {/* Status filter */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-muted-foreground font-medium mr-1"><CircleDot className="w-3.5 h-3.5 inline mr-1" />Status:</span>
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

          {/* Priority filter */}
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

          {/* Location + date filters */}
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground font-medium">Buscar loja</label>
              <Input
                placeholder="Nome, apelido ou código..."
                value={searchStore}
                onChange={(e) => setSearchStore(e.target.value)}
                className="h-8 text-xs w-44"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground font-medium">Estado</label>
              <Select value={filterState || "__all__"} onValueChange={(v) => setFilterState(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs w-28">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {stateOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground font-medium">Cidade</label>
              <Select value={filterCity || "__all__"} onValueChange={(v) => setFilterCity(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {cityOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground font-medium">Data de</label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground font-medium">Data até</label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
            {(searchStore || filterCity || filterState || filterDateFrom || filterDateTo) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setSearchStore(""); setFilterCity(""); setFilterState(""); setFilterDateFrom(""); setFilterDateTo(""); }}>
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
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
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 2xl:grid-cols-3">
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
              <OccurrenceCard
                key={occ.id}
                occ={occ}
                campaignId={campaignId}
                stores={stores}
                pieces={pieces}
                kits={kits}
                kitPieces={kitPieces}
                pieceLocations={pieceLocations}
                canEdit={canEdit}
                canDelete={canDelete}
                canEditReporter={canEditReporter}
                motives={motives}
                statuses={statuses}
                defaultStatus={defaultStatus}
                photosMap={photosMap}
                campaignName={campaignInfo?.name || ""}
                agencyName={agencyName}
                clientName={clientName}
                getReporterLabel={getReporterLabel}
                firstPieceKitLabels={firstPieceKitLabels}
                whatsappLinkTemplate={whatsappLinkTemplate}
                whatsappContactTemplate={whatsappContactTemplate}
                onOpenLightbox={(photos, index) => { setLightboxPhotos(photos); setLightboxIndex(index); setLightboxOpen(true); }}
                motiveColor={motiveColor}
                PRIORITY_OPTIONS={PRIORITY_OPTIONS}
                canLockCards={canLockCards}
              />
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
