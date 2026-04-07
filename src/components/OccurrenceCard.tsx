import { useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Occurrence } from "@/hooks/useOccurrences";
import { useUpdateOccurrenceFields, useUpdateOccurrenceStatus, useDeleteOccurrence } from "@/hooks/useOccurrences";
import type { CampaignPiece, CampaignKit, CampaignKitPiece, ClientStore } from "@/hooks/useMultiClientData";
import OccurrenceDetailFields from "./OccurrenceDetailFields";
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
  Store, Puzzle, Calendar, MapPin, User, Pencil, Flag, Trash2,
  ExternalLink, Link2, MessageCircle, Phone, Save, ClipboardList, Loader2,
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
  const filteredPieces = showAll ? pieces : pieces.filter((p) => p.category === location);
  const kitPieceIds = new Set(kitPieces.map((kp) => kp.piece_id));
  const standalonePieces: OccurrencePieceOption[] = filteredPieces
    .filter((p) => !p.kit_only && !kitPieceIds.has(p.id))
    .map((p) => ({ value: p.id, label: `${p.code} - ${p.name}`, sortOrder: p.display_order }));
  const kitItems: OccurrencePieceOption[] = kits
    .map((kit) => {
      const memberIds = kitPieces.filter((kp) => kp.kit_id === kit.id).map((kp) => kp.piece_id);
      const first = filteredPieces.find((p) => memberIds.includes(p.id));
      if (!first) return null;
      return { value: first.id, label: `Kit ${kit.code} - ${kit.name}`, sortOrder: kit.display_order } satisfies OccurrencePieceOption;
    })
    .filter((i): i is OccurrencePieceOption => i !== null);
  return [...standalonePieces, ...kitItems].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "pt-BR"));
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
}

export default function OccurrenceCard({
  occ, campaignId, stores, pieces, kits, kitPieces, pieceLocations,
  canEdit, canDelete, canEditReporter, motives, statuses, defaultStatus,
  photosMap, campaignName, agencyName, clientName, getReporterLabel,
  firstPieceKitLabels, whatsappLinkTemplate, whatsappContactTemplate,
  onOpenLightbox, motiveColor, PRIORITY_OPTIONS,
}: OccurrenceCardProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const updateFields = useUpdateOccurrenceFields();
  const updateStatus = useUpdateOccurrenceStatus();
  const deleteOcc = useDeleteOccurrence();

  // Draft state: accumulate local changes
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
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
      // Persist changes
      const { status, ...otherFields } = draft;
      
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
  const selectedPieceOption = pieceOptions.find((o) => o.value === merged.piece_id);
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
  const getStatusColor = (v: string) => statuses.find((s) => s.value === v)?.color || "#6366f1";
  const getStatusLabel = (v: string) => statuses.find((s) => s.value === v)?.label || v;

  return (
    <div className={`group aqua-card bg-gradient-to-br ${motiveColor} border border-border border-l-4 p-4 hover:shadow-lg transition-all duration-200 flex flex-col`}>
      {/* Header: date */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {occ.created_at ? format(new Date(occ.created_at), "dd/MM/yyyy HH:mm") : "—"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="Log de atividades"
          onClick={() => setLogOpen(true)}
        >
          <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
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

      {/* Editable Location */}
      <div className="flex items-center gap-1.5 mb-1.5">
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
            <span className="text-xs text-muted-foreground truncate">{merged.location_in_store || "—"}</span>
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
        <div className="flex items-center gap-1.5 mb-3">
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
        <p className="text-[10px] text-muted-foreground italic mb-3 ml-5">Ocorrência geral — sem peça específica vinculada.</p>
      )}

      {/* Motive badge */}
      <Badge variant="secondary" className="text-[10px] font-medium mb-2 w-fit">
        {getMotiveName(occ.motive_id)}
      </Badge>

      {/* Description */}
      {occ.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{occ.description}</p>}

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

      {/* Activity Log Panel */}
      <ActivityLogPanel
        open={logOpen}
        onOpenChange={setLogOpen}
        campaignId={campaignId}
        storeId={occ.id}
        storeName={`Ocorrência #${occ.id.slice(0, 8)}`}
        module="occurrences"
      />
    </div>
  );
}
