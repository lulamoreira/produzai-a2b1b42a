import { useState, useMemo, useCallback, useRef, lazy, Suspense } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Occurrence } from "@/hooks/useOccurrences";
import { useUpdateOccurrenceFields, useUpdateOccurrenceStatus, useDeleteOccurrence } from "@/hooks/useOccurrences";
import type { CampaignPiece, CampaignKit, CampaignKitPiece, ClientStore } from "@/hooks/useMultiClientData";
import type { Schedule } from "@/types/schedule";
import OccurrenceDetailFields from "./OccurrenceDetailFields";
import ActivityLogPanel from "./ActivityLogPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Flag, Trash2, ExternalLink, Link2, MessageCircle, Phone,
  Save, ClipboardList, Loader2, Lock, LockOpen, ChevronRight,
  MapPin, Puzzle, Calendar, User, Pencil, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { PRIORITY_OPTIONS } from "@/types/occurrence";
import { getStatusLabel, getStatusColor, getDefaultStatusValue } from "@/lib/occurrenceHelpers";
import PhotoLightbox from "./PhotoLightbox";

const GERAL_LOCATION = "GERAL - NA LOJA TODA";
const NAO_SEI_LOCATION = "NÃO SEI O LOCAL";

interface OccurrenceListViewProps {
  occurrences: Occurrence[];
  campaignId: string;
  stores: ClientStore[];
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: CampaignKitPiece[];
  pieceLocations: { id: string; name: string }[];
  canEdit: boolean;
  canDelete: boolean;
  canEditReporter: boolean;
  motives: { id: string; description: string; active?: boolean }[];
  statuses: { id: string; label: string; value: string; color: string; active: boolean; is_default?: boolean }[];
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
  canLockCards?: boolean;
  scheduleMap: Record<string, Schedule>;
  agencyId?: string;
  clientId?: string;
}

export default function OccurrenceListView({
  occurrences, campaignId, stores, pieces, kits, kitPieces, pieceLocations,
  canEdit, canDelete, canEditReporter, motives, statuses, defaultStatus,
  photosMap, campaignName, agencyName, clientName, getReporterLabel,
  firstPieceKitLabels, whatsappLinkTemplate, whatsappContactTemplate,
  onOpenLightbox, canLockCards, scheduleMap, agencyId, clientId,
}: OccurrenceListViewProps) {
  const [selectedOccId, setSelectedOccId] = useState<string | null>(null);
  const selectedOcc = useMemo(() => occurrences.find(o => o.id === selectedOccId), [occurrences, selectedOccId]);

  const getStoreName = (id: string | null) => {
    if (!id) return "—";
    const s = stores.find(s => s.id === id);
    return s?.nickname || s?.name || "—";
  };

  const getStoreInfo = (id: string | null) => {
    if (!id) return { code: "—", state: "", city: "" };
    const s = stores.find(s => s.id === id);
    return { code: s?.store_code || "—", state: s?.state || "", city: s?.city || "" };
  };

  const getMotiveName = (id: string | null) => {
    if (!id) return "—";
    return motives.find(m => m.id === id)?.description || "—";
  };

  const getPieceName = (id: string | null) => {
    if (!id) return "—";
    const kitLabel = firstPieceKitLabels.get(id);
    if (kitLabel) return kitLabel;
    return pieces.find(p => p.id === id)?.name || "—";
  };

  const getPriorityColor = (value: string) => PRIORITY_OPTIONS.find(p => p.value === value)?.color || "#6366f1";
  const getPriorityLabel = (value: string) => PRIORITY_OPTIONS.find(p => p.value === value)?.label || "Média";

  const activeStatuses = useMemo(() => statuses.filter(s => s.active), [statuses]);

  return (
    <>
      <div className="space-y-1.5">
        {occurrences.map(occ => {
          const priority = occ.priority || "media";
          const status = occ.status || defaultStatus;
          const storeInfo = getStoreInfo(occ.store_id);
          const motiveName = getMotiveName(occ.motive_id);
          const pieceName = occ.kit_id ? `Kit ${kits.find(k => k.id === occ.kit_id)?.name || ""}` : getPieceName(occ.piece_id);

          return (
            <div
              key={occ.id}
              onClick={() => setSelectedOccId(occ.id)}
              className="card-base p-3 cursor-pointer hover:bg-[var(--bg-page)] transition-colors duration-100"
              style={{ borderLeft: `4px solid ${getPriorityColor(priority)}` }}
            >
              {/* Row 1: Priority badge + Status badge + Store name */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="badge-base text-[10px] px-2 py-0.5"
                  style={{ backgroundColor: `${getPriorityColor(priority)}15`, color: getPriorityColor(priority), border: `1px solid ${getPriorityColor(priority)}40` }}
                >
                  ● {getPriorityLabel(priority)}
                </span>
                <span
                  className="badge-base text-[10px] px-2 py-0.5"
                  style={{ backgroundColor: `${getStatusColor(statuses, status)}15`, color: getStatusColor(statuses, status), border: `1px solid ${getStatusColor(statuses, status)}40` }}
                >
                  {getStatusLabel(statuses, status)}
                </span>
                <span className="text-sm font-semibold text-foreground">{getStoreName(occ.store_id)}</span>
                <span className="text-xs text-[var(--text-secondary)]">{storeInfo.code} · {storeInfo.state} · {storeInfo.city}</span>
                {(occ as any).locked && (
                  <Lock className="w-3 h-3 text-destructive" />
                )}
              </div>

              {/* Row 2: Motive + piece */}
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {motiveName}{pieceName !== "—" ? ` — ${pieceName}` : ""}
              </p>

              {/* Row 3: Dates + reporter */}
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] text-[var(--text-secondary)]">
                  Criado: {occ.created_at ? format(new Date(occ.created_at), "dd/MM/yyyy HH:mm") : "—"}
                  {occ.expected_resolution_date && ` · Res. prevista: ${format(new Date(occ.expected_resolution_date), "dd/MM/yyyy")}`}
                  {getReporterLabel(occ.reporter_type) && ` · ${getReporterLabel(occ.reporter_type)}`}
                </span>
                <div className="flex items-center gap-1.5">
                  {occ.needs_reinstallation && (
                    <span className="badge-base badge-warning text-[10px] px-1.5 py-0">✔ Reinstalação</span>
                  )}
                  <span className="text-[11px] text-primary flex items-center gap-0.5">
                    Abrir detalhe <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Sheet */}
      <OccurrenceDetailSheet
        occ={selectedOcc || null}
        open={!!selectedOccId}
        onOpenChange={(open) => { if (!open) setSelectedOccId(null); }}
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
        activeStatuses={activeStatuses}
        defaultStatus={defaultStatus}
        photosMap={photosMap}
        campaignName={campaignName}
        agencyName={agencyName}
        clientName={clientName}
        getReporterLabel={getReporterLabel}
        firstPieceKitLabels={firstPieceKitLabels}
        whatsappLinkTemplate={whatsappLinkTemplate}
        whatsappContactTemplate={whatsappContactTemplate}
        onOpenLightbox={onOpenLightbox}
        canLockCards={canLockCards}
        getStoreName={(id) => {
          if (!id) return "—";
          const s = stores.find(s => s.id === id);
          return s?.nickname || s?.name || "—";
        }}
        getStoreInfo={getStoreInfo}
        getMotiveName={getMotiveName}
        getPieceName={getPieceName}
      />
    </>
  );
}

/* ──────────────── Sheet Component ──────────────── */

interface OccurrenceDetailSheetProps {
  occ: Occurrence | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  activeStatuses: { id: string; label: string; value: string; color: string; active: boolean }[];
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
  canLockCards?: boolean;
  getStoreName: (id: string | null) => string;
  getStoreInfo: (id: string | null) => { code: string; state: string; city: string };
  getMotiveName: (id: string | null) => string;
  getPieceName: (id: string | null) => string;
}

function OccurrenceDetailSheet({
  occ, open, onOpenChange, campaignId, stores, pieces, kits, kitPieces, pieceLocations,
  canEdit: canEditProp, canDelete, canEditReporter: canEditReporterProp, motives, statuses, activeStatuses, defaultStatus,
  photosMap, campaignName, agencyName, clientName, getReporterLabel,
  firstPieceKitLabels, whatsappLinkTemplate, whatsappContactTemplate,
  onOpenLightbox, canLockCards, getStoreName, getStoreInfo, getMotiveName, getPieceName,
}: OccurrenceDetailSheetProps) {
  const { user } = useAuth();
  const { isAdminOrMaster } = useUserRole();
  const qc = useQueryClient();
  const deleteOcc = useDeleteOccurrence();

  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);

  // Reset draft when occ changes
  const prevOccId = useRef<string | null>(null);
  if (occ && occ.id !== prevOccId.current) {
    prevOccId.current = occ.id;
    if (Object.keys(draft).length > 0) setDraft({});
  }

  if (!occ) return null;

  const isLocked = !!(occ as any).locked;
  const canEdit = canEditProp && (!isLocked || isAdminOrMaster);
  const canEditReporter = canEditReporterProp && (!isLocked || isAdminOrMaster);
  const hasPendingChanges = Object.keys(draft).length > 0;
  const merged = { ...occ, ...draft } as Occurrence;

  const priority = merged.priority || "media";
  const status = merged.status || defaultStatus;
  const storeInfo = getStoreInfo(occ.store_id);
  const priorityColor = PRIORITY_OPTIONS.find(p => p.value === priority)?.color || "#6366f1";
  const priorityLabel = PRIORITY_OPTIONS.find(p => p.value === priority)?.label || "Média";
  const statusColor = getStatusColor(statuses, status);
  const statusLabel = getStatusLabel(statuses, status);

  const setDraftField = (field: string, value: unknown) => {
    setDraft(prev => {
      if ((occ as any)[field] === value) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSave = async () => {
    if (!hasPendingChanges || !user) return;
    setSaving(true);
    try {
      const resolvedDraft = { ...draft };
      if (typeof resolvedDraft.piece_id === "string" && resolvedDraft.piece_id.startsWith("kit:")) {
        resolvedDraft.kit_id = resolvedDraft.piece_id.replace("kit:", "");
        resolvedDraft.piece_id = null;
      } else if (resolvedDraft.piece_id && typeof resolvedDraft.piece_id === "string") {
        resolvedDraft.kit_id = null;
      }

      const { status: draftStatus, ...otherFields } = resolvedDraft;
      if (Object.keys(otherFields).length > 0) {
        const { error } = await supabase.from("occurrences").update(otherFields).eq("id", occ.id);
        if (error) throw error;
      }
      if (draftStatus !== undefined) {
        const { error } = await supabase.from("occurrences").update({ status: draftStatus as string }).eq("id", occ.id);
        if (error) throw error;
      }

      const { data: record } = await supabase.from("occurrences").select("*").eq("id", occ.id).maybeSingle();
      if (record) {
        supabase.functions.invoke("notify-occurrence", { body: { record, event_type: "updated" } }).catch(console.error);
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        campaign_id: campaignId,
        store_id: occ.id,
        user_id: user.id,
        module: "occurrences",
        action: "Campos alterados",
        details: "Alteração via lista",
      });

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
      toast.success("Alterações salvas!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLock = async () => {
    if (!user) return;
    setLockLoading(true);
    try {
      const newLocked = !isLocked;
      const { error } = await supabase.from("occurrences").update({ locked: newLocked } as any).eq("id", occ.id);
      if (error) throw error;
      await supabase.from("activity_logs").insert({
        campaign_id: campaignId, store_id: occ.id, user_id: user.id, module: "occurrences",
        action: newLocked ? "Card bloqueado" : "Card desbloqueado",
        details: newLocked ? "Card bloqueado para edição" : "Card desbloqueado para edição",
      });
      qc.invalidateQueries({ queryKey: ["occurrences", campaignId] });
      toast.success(newLocked ? "Bloqueado!" : "Desbloqueado!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLockLoading(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[520px] max-w-full p-0 flex flex-col overflow-y-auto sheet-responsive">
          <div className="sheet-handle md:hidden" />
          <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-sm flex items-center gap-2">
                  {getStoreName(occ.store_id)} · {storeInfo.code}
                </SheetTitle>
                <p className="text-xs text-muted-foreground">{storeInfo.state} · {storeInfo.city}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="badge-base text-[10px] px-2 py-0.5"
                  style={{ backgroundColor: `${priorityColor}15`, color: priorityColor, border: `1px solid ${priorityColor}40` }}
                >
                  ● {priorityLabel}
                </span>
                <span
                  className="badge-base text-[10px] px-2 py-0.5"
                  style={{ backgroundColor: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}40` }}
                >
                  {statusLabel}
                </span>
              </div>
            </div>
          </SheetHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Section 1: Identification */}
            <div className="space-y-2">
              <h4 className="section-label">Identificação</h4>

              {/* Status + Priority editable */}
              {canEdit && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground mb-0.5 block">Status</label>
                    <Select value={status} onValueChange={(v) => setDraftField("status", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {activeStatuses.map(s => (
                          <SelectItem key={s.id} value={s.value}>
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                              {s.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground mb-0.5 block">Prioridade</label>
                    <Select value={priority} onValueChange={(v) => setDraftField("priority", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map(p => (
                          <SelectItem key={p.value} value={p.value}>
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                              {p.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {getReporterLabel(occ.reporter_type) && (
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{getReporterLabel(occ.reporter_type)}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs">{merged.location_in_store || "—"}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Puzzle className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs">{getPieceName(merged.piece_id)}</span>
              </div>

              <div className="text-xs">
                <span className="text-muted-foreground font-medium">Motivo: </span>
                <span>{getMotiveName(occ.motive_id)}</span>
              </div>

              {occ.description && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{occ.description}</p>
              )}

              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Criado: {occ.created_at ? format(new Date(occ.created_at), "dd/MM/yyyy HH:mm") : "—"}
              </div>

              {/* Photos */}
              {(photosMap[occ.id]?.length ?? 0) > 0 && (
                <div className="flex gap-1.5 mt-1">
                  {photosMap[occ.id].map((url, i) => (
                    <button key={i} type="button" className="w-16 h-16 rounded-lg border border-border overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all"
                      onClick={() => onOpenLightbox(photosMap[occ.id], i)}>
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <hr className="border-border" />

            {/* Section 2: Reporter Data (Accordion) */}
            <Accordion type="single" collapsible>
              <AccordionItem value="reporter" className="border-none">
                <AccordionTrigger className="text-xs font-semibold py-2 hover:no-underline">
                  <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Dados do Reclamante</span>
                </AccordionTrigger>
                <AccordionContent className="pt-1">
                  <div className="space-y-1.5 text-xs">
                    <p><span className="text-muted-foreground">Tipo: </span>{occ.reporter_type === "agency" ? "Agência" : occ.reporter_type === "cliente" ? "Cliente" : occ.reporter_type === "fornecedor" ? "Fornecedor" : "Lojista"}</p>
                    <p><span className="text-muted-foreground">Nome: </span>{occ.reporter_name || "—"}</p>
                    <p><span className="text-muted-foreground">WhatsApp: </span>{occ.reporter_phone_ddd && occ.reporter_phone_number ? `(${occ.reporter_phone_ddd}) ${occ.reporter_phone_number}` : "—"}</p>
                    <p><span className="text-muted-foreground">E-mail: </span>{occ.reporter_email || "—"}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <hr className="border-border" />

            {/* Section 3-6: OccurrenceDetailFields handles Agency Obs, Actions, Resolution, Reinstallation, Comments, Photos */}
            <OccurrenceDetailFields
              occ={merged}
              campaignId={campaignId}
              pieceLocations={pieceLocations}
              canEdit={canEdit}
              canEditReporter={canEditReporter}
              onFieldChange={setDraftField}
            />

            {/* Save bar */}
            {canEdit && hasPendingChanges && (
              <div className="flex items-center gap-2 pt-3 border-t border-primary/30 bg-primary/5 px-3 py-2 rounded-lg">
                <Button size="sm" className="flex-1 gap-1.5" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar alterações
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDraft({})} disabled={saving}>Descartar</Button>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="border-t border-border px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Copiar link"
                onClick={() => { navigator.clipboard.writeText(`https://produzai.lovable.app/ocorrencia/${occ.id}`); toast.success("Link copiado!"); }}>
                <Link2 className="w-4 h-4 text-primary" />
              </Button>
              <a href={`https://produzai.lovable.app/ocorrencia/${occ.id}`} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Página pública">
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </Button>
              </a>
              <a
                href={`https://wa.me/${occ.reporter_phone_ddd && occ.reporter_phone_number ? `55${occ.reporter_phone_ddd}${occ.reporter_phone_number}` : ''}?text=${encodeURIComponent((whatsappLinkTemplate || 'Ocorrência: {url}').replace(/\{url\}/g, `https://produzai.lovable.app/ocorrencia/${occ.id}`).replace(/\{id\}/g, occ.id.slice(0, 8)).replace(/\{store\}/g, getStoreName(occ.store_id)))}`}
                target="_blank" rel="noopener noreferrer"
              >
                <Button variant="ghost" size="icon" className="h-8 w-8" title="WhatsApp">
                  <MessageCircle className="w-4 h-4 text-success" />
                </Button>
              </a>
              {canLockCards && (
                <Button variant="ghost" size="icon" className="h-8 w-8" title={isLocked ? "Desbloquear" : "Bloquear"}
                  onClick={handleToggleLock} disabled={lockLoading}>
                  {isLocked ? <Lock className="w-4 h-4 text-destructive" /> : <LockOpen className="w-4 h-4 text-muted-foreground" />}
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Log" onClick={() => setLogOpen(true)}>
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir ocorrência?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => { deleteOcc.mutate({ id: occ.id, campaignId }); onOpenChange(false); }}>
                      SIM
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Activity Log */}
      <ActivityLogPanel
        open={logOpen}
        onOpenChange={setLogOpen}
        campaignId={campaignId}
        storeId={occ.id}
        storeName={`Ocorrência #${occ.id.slice(0, 8)}`}
        module="occurrences"
      />
    </>
  );
}
