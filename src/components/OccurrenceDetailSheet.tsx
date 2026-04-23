import { useState, useRef } from "react";
import { getThumbnailUrl } from "@/lib/imageUrl";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useQueryClient } from "@tanstack/react-query";
import type { Occurrence } from "@/hooks/useOccurrences";
import { useDeleteOccurrence } from "@/hooks/useOccurrences";
import type { CampaignPiece, CampaignKit, CampaignKitPiece, ClientStore } from "@/hooks/useMultiClientData";
import OccurrenceDetailFields from "./OccurrenceDetailFields";
import ActivityLogPanel from "./ActivityLogPanel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Trash2, ExternalLink, Link2, MessageCircle,
  Save, ClipboardList, Loader2, Lock, LockOpen,
  MapPin, Puzzle, Calendar as CalendarIcon,
  FileText, CalendarClock, Building2, Wrench, CalendarCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PRIORITY_OPTIONS } from "@/types/occurrence";
import { getStatusLabel, getStatusColor, parseLocalDate } from "@/lib/occurrenceHelpers";
import DebouncedTextarea from "@/components/DebouncedTextarea";

export interface OccurrenceDetailSheetProps {
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
  agencyId?: string;
  clientId?: string;
  getStoreName: (id: string | null) => string;
  getStoreInfo: (id: string | null) => { code: string; state: string; city: string };
  getMotiveName: (id: string | null) => string;
  getPieceName: (id: string | null) => string;
}

export function OccurrenceDetailSheet({
  occ, open, onOpenChange, campaignId, stores, pieces, kits, kitPieces, pieceLocations,
  canEdit: canEditProp, canDelete, canEditReporter: canEditReporterProp, motives, statuses, activeStatuses, defaultStatus,
  photosMap, campaignName, agencyName, clientName, getReporterLabel,
  firstPieceKitLabels, whatsappLinkTemplate, whatsappContactTemplate,
  onOpenLightbox, canLockCards, agencyId, clientId, getStoreName, getStoreInfo, getMotiveName, getPieceName,
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

      await supabase.from("activity_logs").insert({
        campaign_id: campaignId,
        store_id: occ.id,
        user_id: user.id,
        module: "occurrences",
        action: "Campos alterados",
        details: "Alteração via lista",
      });

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
            {/* Section 1: Identificação (always visible) */}
            <div className="space-y-0">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-2">
                <FileText className="w-3 h-3" /> Identificação
              </h4>

              {canEdit && (
                <div className="flex gap-2 mb-2">
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

              <div className="space-y-0">
                {getReporterLabel(occ.reporter_type) && (
                  <>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo</span>
                      <span className="text-xs text-foreground">{getReporterLabel(occ.reporter_type)}</span>
                    </div>
                    <Separator />
                  </>
                )}
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><MapPin className="w-3 h-3" /> Localização</span>
                  <span className="text-xs text-foreground">{merged.location_in_store || "—"}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Puzzle className="w-3 h-3" /> Peça / Kit</span>
                  <span className="text-xs text-foreground">{getPieceName(merged.piece_id)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Motivo</span>
                  <span className="text-xs text-foreground">{getMotiveName(occ.motive_id)}</span>
                </div>
                {occ.description && (
                  <>
                    <Separator />
                    <div className="py-1.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-0.5">Descrição</span>
                      <p className="text-xs text-foreground whitespace-pre-wrap">{occ.description}</p>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> Criado em</span>
                  <span className="text-xs text-foreground">{occ.created_at ? format(new Date(occ.created_at), "dd/MM/yyyy HH:mm") : "—"}</span>
                </div>
              </div>

              {(photosMap[occ.id]?.length ?? 0) > 0 && (
                <>
                  <Separator className="mt-1" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block pt-1.5">Fotos enviadas pelo reclamante</span>
                  <div className="flex gap-1.5 mt-1">
                    {photosMap[occ.id].map((url, i) => (
                      <button key={i} type="button" className="w-16 h-16 rounded-lg border border-border overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all"
                        onClick={() => onOpenLightbox(photosMap[occ.id], i)}>
                        <img src={getThumbnailUrl(url, 150)} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <Separator />

            {/* Section 2: Resolução (always visible) */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <CalendarClock className="w-3 h-3" /> Resolução
              </h4>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                  Resolução prevista para:
                </label>
                {canEdit ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-7 text-xs w-full justify-start">
                        <CalendarIcon className="w-3 h-3 mr-1.5" />
                        {merged.expected_resolution_date
                          ? format(parseLocalDate(merged.expected_resolution_date) || new Date(), "dd/MM/yyyy", { locale: ptBR })
                          : "Selecione uma data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={merged.expected_resolution_date ? parseLocalDate(merged.expected_resolution_date) || undefined : undefined}
                        onSelect={(date) => {
                          const val = date ? format(date, "yyyy-MM-dd") : null;
                          setDraftField("expected_resolution_date", val);
                          if (val && merged.status !== "resolved" && merged.status !== "nao_procede") {
                            setDraftField("status", "andamento");
                          }
                        }}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span className="text-xs font-semibold">
                    {merged.expected_resolution_date ? format(parseLocalDate(merged.expected_resolution_date) || new Date(), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                  </span>
                )}
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Building2 className="w-3 h-3" /> Observação da Agência
                </label>
                {canEdit ? (
                  <DebouncedTextarea
                    className="text-xs min-h-[2rem] max-h-[4rem] resize-none"
                    rows={2}
                    value={merged.agency_observation || ""}
                    onValueCommit={(v) => setDraftField("agency_observation", v)}
                    placeholder="Observação da agência..."
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">{merged.agency_observation || "—"}</span>
                )}
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Wrench className="w-3 h-3" /> Ações Tomadas
                </label>
                {canEdit ? (
                  <DebouncedTextarea
                    className="text-xs min-h-[3.5rem] max-h-[5rem] resize-none"
                    rows={3}
                    value={merged.actions_taken || ""}
                    onValueCommit={(v) => setDraftField("actions_taken", v)}
                    placeholder="Descreva as ações tomadas..."
                  />
                ) : (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{merged.actions_taken || "—"}</p>
                )}
              </div>

              {merged.status === "resolved" && (
                <div className="bg-success/10 rounded-lg p-2 border border-success/20">
                  <label className="text-[10px] font-bold text-success uppercase tracking-wider flex items-center gap-1 mb-1">
                    <CalendarCheck className="w-3 h-3" /> Resolvido dia:
                  </label>
                  {canEdit ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-7 text-xs w-full justify-start">
                          <CalendarIcon className="w-3 h-3 mr-1.5" />
                          {merged.resolved_date
                            ? format(new Date(merged.resolved_date), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : "Selecione uma data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={merged.resolved_date ? new Date(merged.resolved_date) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              const existing = merged.resolved_date ? new Date(merged.resolved_date) : new Date();
                              date.setHours(existing.getHours(), existing.getMinutes());
                              setDraftField("resolved_date", date.toISOString());
                            } else {
                              setDraftField("resolved_date", null);
                            }
                          }}
                          className="p-3 pointer-events-auto"
                        />
                        <div className="p-3 border-t flex gap-2 items-center">
                          <label className="text-xs text-muted-foreground">Hora:</label>
                          <input
                            type="time"
                            className="h-7 text-xs w-auto border rounded px-2"
                            value={merged.resolved_date ? format(new Date(merged.resolved_date), "HH:mm") : ""}
                            onChange={(e) => {
                              const [h, m] = e.target.value.split(":").map(Number);
                              const d = merged.resolved_date ? new Date(merged.resolved_date) : new Date();
                              d.setHours(h, m);
                              setDraftField("resolved_date", d.toISOString());
                            }}
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <span className="text-xs font-semibold">
                      {merged.resolved_date ? format(new Date(merged.resolved_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—"}
                    </span>
                  )}
                </div>
              )}
            </div>

            <Separator />

            <OccurrenceDetailFields
              occ={merged}
              campaignId={campaignId}
              pieceLocations={pieceLocations}
              canEdit={canEdit}
              canEditReporter={canEditReporter}
              onFieldChange={setDraftField}
            />

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
