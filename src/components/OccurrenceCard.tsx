import { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { getStatusLabel as _getStatusLabel, getStatusColor as _getStatusColor } from "@/lib/occurrenceHelpers";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import type { Schedule } from "@/types/schedule";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Occurrence } from "@/hooks/useOccurrences";
import { useUpdateOccurrenceFields, useUpdateOccurrenceStatus, useDeleteOccurrence } from "@/hooks/useOccurrences";
import type { CampaignPiece, CampaignKit, CampaignKitPiece, ClientStore } from "@/hooks/useMultiClientData";
import OccurrenceDetailFields from "./OccurrenceDetailFields";
import { useInstallationPhotos } from "@/hooks/useInstallationPhotos";
const PhotoCheckinDialog = lazy(() => import("@/components/PhotoCheckinDialog"));
import ActivityLogPanel from "./ActivityLogPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Puzzle, Calendar, MapPin, User, Pencil, Flag, Trash2,
  ExternalLink, Link2, MessageCircle, Phone, Save, ClipboardList, Loader2, Lock, LockOpen,
  CheckCircle2, AlertCircle, Camera,
} from "lucide-react";
import { toast } from "sonner";

const GERAL_LOCATION = "GERAL - NA LOJA TODA";
const NAO_SEI_LOCATION = "NÃO SEI O LOCAL";

type OccurrencePieceOption = {
  value: string;
  label: string;
  sortOrder: number;
};

function getOccurrencePieceOptions({
  location, pieces, kits, kitPieces,
}: {
  location: string | null | undefined;
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: CampaignKitPiece[];
}) {
  if (!location || location === GERAL_LOCATION) return [] as OccurrencePieceOption[];
  const showAll = location === NAO_SEI_LOCATION;
  const normalizeWs = (s: string) => s.replace(/\s+/g, " ").trim();
  const filteredPieces = showAll ? pieces : pieces.filter((p) => normalizeWs(p.category) === normalizeWs(location));
  const kitPieceIds = new Set(kitPieces.map((kp) => kp.piece_id));
  const standalonePieces: OccurrencePieceOption[] = filteredPieces
    .filter((p) => !p.kit_only && !kitPieceIds.has(p.id))
    .map((p) => ({ value: p.id, label: `${p.code} - ${p.name}`, sortOrder: p.display_order }));
  // Kits as selectable items + their individual member pieces
  const kitAndMemberItems: OccurrencePieceOption[] = [];
  kits.forEach((kit) => {
    const memberIds = kitPieces.filter((kp) => kp.kit_id === kit.id).map((kp) => kp.piece_id);
    const members = filteredPieces.filter((p) => memberIds.includes(p.id));
    if (members.length === 0) return;
    // Add the kit itself as selectable with kit: prefix
    kitAndMemberItems.push({ value: `kit:${kit.id}`, label: `KIT ${kit.code} - ${kit.name}`, sortOrder: kit.display_order });
    // Add each individual kit member piece
    members.forEach((p) => {
      kitAndMemberItems.push({ value: p.id, label: `  ↳ ${p.code} - ${p.name}`, sortOrder: kit.display_order + 0.001 });
    });
  });
  return [...standalonePieces, ...kitAndMemberItems].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "pt-BR"));
}

interface OccurrenceCardProps {
  occ: Occurrence;
  campaignId: string;
  stores: ClientStore[];
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: CampaignKitPiece[];
  pieceLocations: { id: string; name: string }[];
  canEdit: boolean;
  canDelete: boolean;
  canEditReporter: boolean;
  motives: { id: string; description: string }[];
  statuses: { id: string; label: string; value: string; color: string; active: boolean }[];
  defaultStatus: string;
  photosMap: Record<string, string[]>;
  campaignName: string;
  agencyName: string;
  clientName: string;
  getReporterLabel: (t?: string) => string | null;
  firstPieceKitLabels: Map<string, string>;
  whatsappLinkTemplate?: string;
  whatsappContactTemplate?: string;
  onOpenLightbox: (photos: string[], index: number) => void;
  motiveColor: string;
  PRIORITY_OPTIONS: { value: string; label: string; color: string }[];
  canLockCards?: boolean;
  schedule?: Schedule;
  agencyId?: string;
  clientId?: string;
}

export default function OccurrenceCard({
  occ, campaignId, stores, pieces, kits, kitPieces, pieceLocations,
  canEdit: canEditProp, canDelete, canEditReporter: canEditReporterProp, motives, statuses, defaultStatus,
  photosMap, campaignName, agencyName, clientName, getReporterLabel,
  firstPieceKitLabels, whatsappLinkTemplate, whatsappContactTemplate,
  onOpenLightbox, motiveColor, PRIORITY_OPTIONS, canLockCards, schedule,
  agencyId, clientId,
}: OccurrenceCardProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const updateFields = useUpdateOccurrenceFields();
  const updateStatus = useUpdateOccurrenceStatus();
  const deleteOcc = useDeleteOccurrence();

  const isLocked = !!(occ as any).locked;
  const { isAdminOrMaster } = useUserRole();
  const canEdit = canEditProp && (!isLocked || isAdminOrMaster);
  const canEditReporter = canEditReporterProp && (!isLocked || isAdminOrMaster);

  // Draft state: accumulate local changes
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const hasPendingChanges = Object.keys(draft).length > 0;

  // Merged occurrence (server + draft)
  const merged = useMemo(() => ({ ...occ, ...draft }), [occ, draft]) as Occurrence;

  // Profile for logging
  const { data: profile } = useQuery({
    queryKey: ["my_profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name, nickname").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  // Photos for this store
  const store = stores.find((s) => s.id === occ.store_id);
  const { data: storePhotos = [] } = useInstallationPhotos(campaignId);
  const filteredStorePhotos = useMemo(
    () => storePhotos.filter((p) => p.store_id === occ.store_id),
    [storePhotos, occ.store_id]
  );

  const setDraftField = useCallback((field: string, value: unknown) => {
    setDraft((prev) => {
      // If value is same as server, remove from draft
      if ((occ as any)[field] === value) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: value };
    });
  }, [occ]);

  // Build change log description
  const buildChangeLog = useCallback(() => {
    const lines: string[] = [];
    const fieldLabels: Record<string, string> = {
      status: "Status",
      priority: "Prioridade",
      location_in_store: "Local do problema",
      piece_id: "Peça",
      agency_observation: "Obs. Agência",
      actions_taken: "Ações Tomadas",
      expected_resolution_date: "Previsão Resolução",
      needs_reinstallation: "Precisa Reinstalação",
      reinstallation_os: "OS Reinstalação",
      reinstallation_datetime: "Data Reinstalação",
      resolved_date: "Data Resolução",
      reporter_name: "Nome Reclamante",
      reporter_phone_ddd: "DDD Reclamante",
      reporter_phone_number: "Telefone Reclamante",
      reporter_email: "Email Reclamante",
    };

    for (const [field, newVal] of Object.entries(draft)) {
      const label = fieldLabels[field] || field;
      const oldVal = (occ as any)[field];

      if (field === "status") {
        const oldLabel = statuses.find((s) => s.value === oldVal)?.label || String(oldVal || "—");
        const newLabel = statuses.find((s) => s.value === newVal)?.label || String(newVal || "—");
        lines.push(`${label}: ${oldLabel} → ${newLabel}`);
      } else if (field === "priority") {
        const oldLabel = PRIORITY_OPTIONS.find((p) => p.value === oldVal)?.label || oldVal || "—";
        const newLabel = PRIORITY_OPTIONS.find((p) => p.value === (newVal as string))?.label || (newVal as string) || "—";
        lines.push(`${label}: ${oldLabel} → ${newLabel}`);
      } else if (field === "piece_id") {
        const getLabel = (id: string | null) => {
          if (!id) return "—";
          if (typeof id === "string" && id.startsWith("kit:")) {
            const kitId = id.replace("kit:", "");
            const kit = kits.find((k) => k.id === kitId);
            return kit ? `Kit ${kit.code} - ${kit.name}` : "Kit";
          }
          const kitLabel = firstPieceKitLabels.get(id);
          if (kitLabel) return kitLabel;
          return pieces.find((p) => p.id === id)?.name || "—";
        };
        lines.push(`${label}: ${getLabel(oldVal)} → ${getLabel(newVal as string)}`);
      } else if (field === "needs_reinstallation") {
        lines.push(`${label}: ${oldVal ? "Sim" : "Não"} → ${newVal ? "Sim" : "Não"}`);
      } else if (typeof newVal === "string" && (newVal.length > 50 || (oldVal || "").length > 50)) {
        lines.push(`${label}: alterado`);
      } else {
        lines.push(`${label}: ${String(oldVal || "—")} → ${String(newVal || "—")}`);
      }
    }
    return lines.join("\n");
  }, [draft, occ, statuses, PRIORITY_OPTIONS, firstPieceKitLabels, pieces]);

  const handleSave = async () => {
    if (!hasPendingChanges || !user) return;
    setSaving(true);
    try {
      // Resolve kit: prefix — store kit_id and clear piece_id
      const resolvedDraft = { ...draft };
      if (typeof resolvedDraft.piece_id === "string" && resolvedDraft.piece_id.startsWith("kit:")) {
        const kitId = resolvedDraft.piece_id.replace("kit:", "");
        resolvedDraft.kit_id = kitId;
        resolvedDraft.piece_id = null;
      } else if (resolvedDraft.piece_id && typeof resolvedDraft.piece_id === "string") {
        // Selecting a specific piece clears kit_id
        resolvedDraft.kit_id = null;
      }

      // Persist changes
      const { status, ...otherFields } = resolvedDraft;
      
      if (Object.keys(otherFields).length > 0) {
        const { error } = await supabase.from("occurrences").update(otherFields).eq("id", occ.id);
        if (error) throw error;
      }
      
      if (status !== undefined) {
        const { error } = await supabase.from("occurrences").update({ status: status as string }).eq("id", occ.id);
        if (error) throw error;
      }

      // Fetch full updated record to trigger notification
      const { data: record } = await supabase.from("occurrences").select("*").eq("id", occ.id).maybeSingle();
      if (record) {
        supabase.functions.invoke("notify-occurrence", { body: { record, event_type: "updated" } }).catch(console.error);
      }

      // Log activity
      const changeLog = buildChangeLog();
      if (changeLog) {
        await supabase.from("activity_logs").insert({
          campaign_id: campaignId,
          store_id: occ.id, // Use occurrence ID as reference
          user_id: user.id,
          module: "occurrences",
          action: "Campos alterados",
          details: changeLog,
        });
      }

      // Dispatch notification if status changed to a resolved value
      if (draft.status && agencyId) {
        const resolvedValues = ["resolvida", "concluida", "finalizada"];
        if (resolvedValues.includes(String(draft.status).toLowerCase())) {
          const storeName = stores.find(s => s.id === occ.store_id)?.name || "";
          try {
            const { criarNotificacao } = await import("@/lib/criarNotificacao");
            await criarNotificacao({
              agency_id: agencyId,
              campaign_id: campaignId,
              store_id: occ.store_id || undefined,
              client_id: clientId,
              type: "ocorrencia_resolvida",
              title: "Ocorrência resolvida",
              body: `A ocorrência em ${storeName} foi marcada como resolvida`,
              action_url: `/campanhas/${campaignId}/ocorrencias`,
            });
          } catch { /* silent */ }
        }
      }

      setDraft({});
      qc.invalidateQueries({ queryKey: ["occurrences", campaignId] });
      qc.invalidateQueries({ queryKey: ["activity_logs", campaignId, occ.id, "occurrences"] });
      toast.success("Alterações salvas!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setDraft({});
  };

  // --- Location/Piece editing ---
  const [editingLocation, setEditingLocation] = useState(false);
  const [editingPiece, setEditingPiece] = useState(false);

  const pieceOptions = useMemo(
    () => getOccurrencePieceOptions({ location: merged.location_in_store, pieces, kits, kitPieces }),
    [merged.location_in_store, pieces, kits, kitPieces]
  );
  const selectedPieceOption = useMemo(() => {
    // If kit_id is set, match the kit option
    if (merged.kit_id) {
      return pieceOptions.find((o) => o.value === `kit:${merged.kit_id}`);
    }
    // Otherwise match by piece_id
    const direct = pieceOptions.find((o) => o.value === merged.piece_id);
    if (direct) return direct;
    // Legacy: check if stored piece_id is the first member of a kit
    if (merged.piece_id) {
      for (const kit of kits) {
        const members = kitPieces.filter((kp) => kp.kit_id === kit.id);
        if (members.length > 0 && members[0].piece_id === merged.piece_id) {
          return pieceOptions.find((o) => o.value === `kit:${kit.id}`);
        }
      }
    }
    return undefined;
  }, [pieceOptions, merged.piece_id, merged.kit_id, kits, kitPieces]);
  const getPieceName = (id: string | null) => {
    if (!id) return "—";
    const kitLabel = firstPieceKitLabels.get(id);
    if (kitLabel) return kitLabel;
    return pieces.find((p) => p.id === id)?.name || "—";
  };
  const pieceDisplayName = selectedPieceOption?.label ?? (merged.location_in_store ? "—" : getPieceName(merged.piece_id));
  const isGeral = merged.location_in_store === GERAL_LOCATION;

  const handleLocationChange = (value: string) => {
    setDraftField("location_in_store", value);
    const nextOptions = getOccurrencePieceOptions({ location: value, pieces, kits, kitPieces });
    const shouldClearPiece = value === GERAL_LOCATION || !merged.piece_id || !nextOptions.some((o) => o.value === merged.piece_id);
    if (shouldClearPiece) {
      setDraftField("piece_id", null);
      setEditingPiece(false);
    }
    setEditingLocation(false);
  };

  const getStoreName = (id: string | null) => {
    if (!id) return "—";
    const s = stores.find((s) => s.id === id);
    return s?.nickname || s?.name || "—";
  };

  const getMotiveName = (id: string | null) => {
    if (!id) return "—";
    return motives.find((m) => m.id === id)?.description || "—";
  };

  const activeStatuses = statuses.filter((s) => s.active);
  const getStatusColor = (v: string) => _getStatusColor(statuses, v);
  const getStatusLabel = (v: string) => _getStatusLabel(statuses, v);

  const handleToggleLock = async () => {
    setLockLoading(true);
    try {
      const newLocked = !isLocked;
      const { error } = await supabase.from("occurrences").update({ locked: newLocked } as any).eq("id", occ.id);
      if (error) throw error;
      // Log
      if (user) {
        await supabase.from("activity_logs").insert({
          campaign_id: campaignId,
          store_id: occ.id,
          user_id: user.id,
          module: "occurrences",
          action: newLocked ? "Card bloqueado" : "Card desbloqueado",
          details: newLocked ? "Card bloqueado para edição" : "Card desbloqueado para edição",
        });
      }
      qc.invalidateQueries({ queryKey: ["occurrences", campaignId] });
      toast.success(newLocked ? "Card bloqueado!" : "Card desbloqueado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar bloqueio.");
    } finally {
      setLockLoading(false);
    }
  };

  return (
    <div className={`group aqua-card bg-gradient-to-br ${motiveColor} border border-border border-l-4 hover:shadow-lg transition-all duration-200 flex flex-col ${isLocked ? "opacity-80" : ""}`}>
      {/* Header - colored, matching Scheduling/Installations */}
      <div className="px-4 py-3 relative rounded-t-[1rem] bg-primary/10">
        <div className="font-semibold text-sm break-words leading-snug text-foreground">{getStoreName(occ.store_id)}</div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg leading-none text-foreground">
              {(() => { const s = stores.find((s) => s.id === occ.store_id); return s?.store_code || "—"; })()}
            </span>
            <span className="text-xs text-muted-foreground">
              {(() => { const s = stores.find((s) => s.id === occ.store_id); return s ? `${s.state || ""} · ${s.city || "—"}` : "—"; })()}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            {canLockCards && (
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 shrink-0 ${isLocked ? "text-destructive" : "text-muted-foreground"}`}
                title={isLocked ? "Desbloquear card" : "Bloquear card"}
                onClick={handleToggleLock}
                disabled={lockLoading}
              >
                {isLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              title="Log de atividades"
              onClick={() => setLogOpen(true)}
            >
              <ClipboardList className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
        {isLocked && (
          <Badge variant="outline" className="absolute top-2 right-2 text-[9px] px-1.5 py-0 border-destructive/50 text-destructive gap-0.5">
            <Lock className="w-2.5 h-2.5" /> Bloqueado
          </Badge>
        )}
      </div>

      {/* Photo check-in status + gallery button */}
      {schedule && (
        <div className="mx-4 mt-2 flex items-center gap-2">
          <div className={`flex-1 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium border ${
            schedule.photo_checkin
              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
              : "bg-orange-500/10 text-orange-700 border-orange-500/30"
          }`}>
            {schedule.photo_checkin && schedule.photo_checkin_at ? (
              <><CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> Fotos para ocorrências verificadas em: {format(new Date(schedule.photo_checkin_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</>
            ) : (
              <><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> Check-in de fotos para ocorrências pendente</>
            )}
          </div>
          <Button variant="outline" size="sm" className="gap-1 text-xs shrink-0" onClick={() => setShowPhotos(true)}>
            <Camera className="w-3.5 h-3.5" /> Ver fotos
          </Button>
        </div>
      )}

      <div className="p-4 flex flex-col flex-1">
      {/* Date */}
      <div className="flex items-center gap-2 mb-2">
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
            value={(merged as any).priority || "media"}
            onValueChange={(val) => setDraftField("priority", val)}
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
          <Badge variant="outline" className="text-[10px] px-2 py-0" style={{ borderColor: PRIORITY_OPTIONS.find(p => p.value === ((merged as any).priority || "media"))?.color, color: PRIORITY_OPTIONS.find(p => p.value === ((merged as any).priority || "media"))?.color }}>
            {PRIORITY_OPTIONS.find(p => p.value === ((merged as any).priority || "media"))?.label || "Média"}
          </Badge>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status:</span>
        {canEdit ? (
          <Select
            value={merged.status || defaultStatus}
            onValueChange={(val) => setDraftField("status", val)}
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
          <Badge variant="outline" className="text-[10px] px-2 py-0" style={{ borderColor: getStatusColor(merged.status || defaultStatus), color: getStatusColor(merged.status || defaultStatus) }}>
            {getStatusLabel(merged.status || defaultStatus)}
          </Badge>
        )}
      </div>

      {/* Store info moved to header */}

      {/* Reporter */}
      {getReporterLabel((occ as any).reporter_type) && (
        <div className="flex items-start gap-1.5 mb-1">
          <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground break-words">{getReporterLabel((occ as any).reporter_type)}</span>
        </div>
      )}

      {/* Editable Location */}
      <div className="flex items-start gap-1.5 mb-1.5">
        <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        {editingLocation ? (
          <Select value={merged.location_in_store || ""} onValueChange={handleLocationChange}>
            <SelectTrigger className="h-6 text-xs border-0 bg-muted/50 flex-1 min-w-0"><SelectValue placeholder="Selecione local..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value={GERAL_LOCATION}>🏪 GERAL - NA LOJA TODA</SelectItem>
              <SelectItem value={NAO_SEI_LOCATION}>❓ NÃO SEI O LOCAL</SelectItem>
              {pieceLocations.map((loc) => <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <>
            <span className="text-xs text-muted-foreground break-words">{merged.location_in_store || "—"}</span>
            {canEdit && (
              <button type="button" onClick={() => setEditingLocation(true)} className="text-muted-foreground hover:text-primary transition-colors ml-auto flex-shrink-0">
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Editable Piece */}
      {!isGeral ? (
        <div className="flex items-start gap-1.5 mb-3">
          <Puzzle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          {editingPiece ? (
            <Select
              value={selectedPieceOption?.value || ""}
              onValueChange={(val) => { setDraftField("piece_id", val); setEditingPiece(false); }}
            >
              <SelectTrigger className="h-6 text-xs border-0 bg-muted/50 flex-1 min-w-0"><SelectValue placeholder="Selecione a peça ou kit..." /></SelectTrigger>
              <SelectContent>
                {pieceOptions.length > 0 ? pieceOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>) : (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma peça ou kit disponível.</div>
                )}
              </SelectContent>
            </Select>
          ) : (
            <>
              <span className="text-xs text-muted-foreground break-words">{pieceDisplayName}</span>
              {canEdit && (
                <button type="button" onClick={() => setEditingPiece(true)} className="text-muted-foreground hover:text-primary transition-colors ml-auto flex-shrink-0">
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground italic mb-3 ml-5">Ocorrência geral — sem peça específica vinculada.</p>
      )}

      {/* Motive badge */}
      <Badge variant="secondary" className="text-[10px] font-medium mb-2 w-fit">
        {getMotiveName(occ.motive_id)}
      </Badge>

      {/* Description */}
      {occ.description && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">{occ.description}</p>}

      {/* Photo thumbnails */}
      {(photosMap[occ.id]?.length ?? 0) > 0 && (
        <div className="flex gap-1.5 mt-3">
          {photosMap[occ.id].slice(0, 3).map((url, pi) => (
            <button key={pi} type="button" className="w-16 h-16 rounded-lg border border-border overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all flex-shrink-0"
              onClick={() => onOpenLightbox(photosMap[occ.id], pi)}>
              <img src={url} alt={`Foto ${pi + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Detail fields - pass draft setters */}
      <OccurrenceDetailFields
        occ={merged}
        campaignId={campaignId}
        pieceLocations={pieceLocations}
        canEdit={canEdit}
        canEditReporter={canEditReporter}
        onFieldChange={setDraftField}
      />

      {/* Save button */}
      {canEdit && hasPendingChanges && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-primary/30 bg-primary/5 -mx-4 px-4 pb-1 rounded-b-lg">
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar alterações
          </Button>
          <Button variant="outline" size="sm" onClick={handleDiscard} disabled={saving}>
            Descartar
          </Button>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-1 mt-3 pt-2 border-t border-border/50">
        <div className="flex items-center gap-1">
          <a href={`https://produzai.lovable.app/ocorrencia/${occ.id}`} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver página pública">
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </a>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Copiar link"
            onClick={() => { navigator.clipboard.writeText(`https://produzai.lovable.app/ocorrencia/${occ.id}`); toast.success("Link copiado!"); }}>
            <Link2 className="w-3.5 h-3.5 text-primary" />
          </Button>
          <a
            href={`https://wa.me/${occ.reporter_phone_ddd && occ.reporter_phone_number ? `55${occ.reporter_phone_ddd}${occ.reporter_phone_number}` : ''}?text=${encodeURIComponent((whatsappLinkTemplate || 'Ocorrência: {url}').replace(/\{url\}/g, `https://produzai.lovable.app/ocorrencia/${occ.id}`).replace(/\{id\}/g, occ.id.slice(0, 8)).replace(/\{store\}/g, getStoreName(occ.store_id)))}`}
            target="_blank" rel="noopener noreferrer"
          >
            <Button variant="ghost" size="icon" className="h-7 w-7" title="WhatsApp link acompanhamento">
              <MessageCircle className="w-3.5 h-3.5 text-success" />
            </Button>
          </a>
          {occ.reporter_phone_ddd && occ.reporter_phone_number && (
            <a
              href={`https://wa.me/55${occ.reporter_phone_ddd}${occ.reporter_phone_number}?text=${encodeURIComponent((whatsappContactTemplate || 'Olá, gostaríamos de falar sobre a ocorrência #{id}.').replace(/\{id\}/g, occ.id.slice(0, 8)).replace(/\{campaign\}/g, campaignName || '').replace(/\{date\}/g, occ.created_at ? format(new Date(occ.created_at), "dd/MM/yyyy 'às' HH:mm") : '—').replace(/\{store\}/g, getStoreName(occ.store_id)))}`}
              target="_blank" rel="noopener noreferrer"
            >
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Falar com lojista via WhatsApp">
                <Phone className="w-3.5 h-3.5 text-primary" />
              </Button>
            </a>
          )}
        </div>
        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir ocorrência?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteOcc.mutate({ id: occ.id, campaignId })}>SIM</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      </div>

      {/* Activity Log Panel */}
      <ActivityLogPanel
        open={logOpen}
        onOpenChange={setLogOpen}
        campaignId={campaignId}
        storeId={occ.id}
        storeName={`Ocorrência #${occ.id.slice(0, 8)}`}
        module="occurrences"
      />

      {/* Photo Checkin Dialog */}
      {showPhotos && store && (
        <Suspense fallback={null}>
          <PhotoCheckinDialog
            open={showPhotos}
            onOpenChange={setShowPhotos}
            store={store as any}
            photos={filteredStorePhotos}
          />
        </Suspense>
      )}
    </div>
  );
}
