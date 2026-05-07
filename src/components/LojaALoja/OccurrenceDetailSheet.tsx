import { useState, useMemo, useEffect } from "react";
import { getThumbnailUrl } from "@/lib/imageUrl";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Camera, X, Loader2, ExternalLink, RotateCw, ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { compressImage } from "@/lib/compressImage";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { useEffectiveTratativaStatuses } from "@/hooks/useLalTratativaStatuses";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  occurrence: any | null;
  canEdit: boolean;
  canDelete: boolean;
  campaignId: string;
}

const PRIORITY_LABELS: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

// Fallback labels (used when no custom statuses are configured)
const TRATATIVA_LABELS: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  resolvida: "Resolvida",
};

function formatDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Note: legacy `toLocalInput` removed — DateTimePicker now handles parsing/formatting safely.

export default function OccurrenceDetailSheet({ open, onOpenChange, occurrence, canEdit, canDelete, campaignId }: Props) {
  const isAdmin = canEdit; // legacy alias for input disabled states
  const qc = useQueryClient();

  // Editable state — initialized from occurrence
  const [priority, setPriority] = useState<string>("");
  const [tratativaStatus, setTratativaStatus] = useState<string>("aberta");
  const [expectedDate, setExpectedDate] = useState<string>("");
  const [needsReinst, setNeedsReinst] = useState(false);
  const [tratativaNotes, setTratativaNotes] = useState("");
  const [resolutionPhotos, setResolutionPhotos] = useState<string[]>([]);
  const [reinstallationDate, setReinstallationDate] = useState<string>("");
  const [reinstallationOs, setReinstallationOs] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [initialized, setInitialized] = useState<string | null>(null);

  // Resolve clientId from the campaign so we can load custom statuses
  const { data: campaignRow } = useQuery({
    queryKey: ["campaign-client-id", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("client_id").eq("id", campaignId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const clientId = campaignRow?.client_id as string | undefined;
  const { statuses: tratativaStatuses } = useEffectiveTratativaStatuses(clientId);

  // Photo check-in for this campaign + store (lazy: only when user opens the modal)
  const checkinQuery = useQuery({
    queryKey: ["installation-photos-checkin", campaignId, occurrence?.store_id],
    enabled: checkinOpen && !!occurrence?.store_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installation_photos")
        .select("id, photo_url, category, caption, created_at, media_type")
        .eq("campaign_id", campaignId)
        .eq("store_id", occurrence.store_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Init when occurrence changes
  useMemo(() => {
    if (occurrence && occurrence.id !== initialized) {
      setPriority(occurrence.priority ?? "media");
      setTratativaStatus(occurrence.tratativa_status ?? "aberta");
      setExpectedDate(occurrence.expected_resolution_date ?? "");
      setNeedsReinst(!!occurrence.needs_reinstallation);
      setTratativaNotes(occurrence.tratativa_notes ?? "");
      setResolutionPhotos(Array.isArray(occurrence.resolution_photo_urls) ? occurrence.resolution_photo_urls : []);
      setReinstallationDate(occurrence.reinstallation_scheduled_at ?? "");
      setReinstallationOs(occurrence.reinstallation_os ?? "");
      setInitialized(occurrence.id);
      // Reset transient UI so leftover lightbox/check-in from a previous occurrence don't reappear
      setLightboxUrl(null);
      setCheckinOpen(false);
    }
  }, [occurrence, initialized]);

  // Reset transient UI when the sheet closes
  useEffect(() => {
    if (!open) {
      setLightboxUrl(null);
      setCheckinOpen(false);
    }
  }, [open]);

  if (!occurrence) return null;

  const photoUrls: string[] = Array.isArray(occurrence.photo_urls) ? occurrence.photo_urls : [];
  const storeName = occurrence.client_stores?.name ?? "—";
  const pieceName = occurrence.loja_a_loja_pecas?.nome ?? "—";
  const pieceImageUrl: string | null = occurrence.loja_a_loja_pecas?.image_url ?? null;
  const motivoDesc = occurrence.store_portal_motivos?.descricao ?? "—";

  const reporterLabel = (() => {
    const r = occurrence.reporter_type ?? "lojista";
    if (r.startsWith("agencia:")) return r.slice(8);
    if (r.startsWith("cliente:")) return r.slice(8);
    if (r === "lojista") return "Lojista";
    if (r === "fornecedor") return "Fornecedor";
    return r;
  })();

  async function handleAddPhoto(files: FileList | null) {
    if (!files || !occurrence) return;
    const remaining = 3 - resolutionPhotos.length;
    if (remaining <= 0) { toast.error("Máximo de 3 fotos."); return; }
    const list = Array.from(files).slice(0, remaining).filter(f => f.type.startsWith("image/"));
    if (list.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];
    for (const file of list) {
      try {
        const compressed = await compressImage(file, 400, 0.7);
        const fileName = `tratativa/${occurrence.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: upErr } = await supabase.storage.from("occurrence-images").upload(fileName, compressed, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("occurrence-images").getPublicUrl(fileName);
        newUrls.push(urlData.publicUrl);
      } catch (err) {
        console.error("Upload error:", err);
        toast.error("Erro ao enviar foto.");
      }
    }
    setResolutionPhotos([...resolutionPhotos, ...newUrls]);
    setUploading(false);
  }

  async function handleSave() {
    if (!occurrence) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;

      const { error } = await supabase
        .from("store_occurrence_reports")
        .update({
          priority,
          tratativa_status: tratativaStatus,
          expected_resolution_date: expectedDate ? new Date(expectedDate).toISOString() : null,
          needs_reinstallation: needsReinst,
          tratativa_notes: tratativaNotes || null,
          resolution_photo_urls: resolutionPhotos,
          reinstallation_scheduled_at: needsReinst && reinstallationDate ? new Date(reinstallationDate).toISOString() : null,
          reinstallation_os: needsReinst && reinstallationOs.trim() ? reinstallationOs.trim() : null,
          resolved_by_user_id: (tratativaStatuses.find((s) => s.value === tratativaStatus)?.is_resolved) ? userId : null,
        } as any)
        .eq("id", occurrence.id);

      if (error) throw error;

      toast.success("Ocorrência atualizada.");
      qc.invalidateQueries({ queryKey: ["portal-occurrences-v2", campaignId] });
      qc.invalidateQueries({ queryKey: ["portal-occurrences-by-store", campaignId] });
      qc.invalidateQueries({ queryKey: ["loja-a-loja-dashboard", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign-status-dashboard", campaignId] });
      setInitialized(null);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  }

  const lightbox = lightboxUrl && typeof document !== "undefined"
    ? createPortal(
      <div
        className="fixed inset-0 z-[9999] flex pointer-events-auto items-center justify-center p-4"
        style={{ background: "hsl(var(--foreground) / 0.92)" }}
        onClick={() => setLightboxUrl(null)}
      >
        <img
          src={lightboxUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="max-w-full max-h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          aria-label="Fechar foto"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLightboxUrl(null); }}
          className="absolute top-4 right-4 z-[10000] h-12 w-12 rounded-full bg-background text-foreground shadow-lg ring-2 ring-background/80 hover:scale-105 transition flex pointer-events-auto items-center justify-center"
        >
          <X className="w-6 h-6" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          aria-label="Abrir foto em nova aba"
          className="absolute top-4 right-20 z-[10000] h-12 w-12 rounded-full bg-background/20 text-background backdrop-blur hover:bg-background/30 transition flex pointer-events-auto items-center justify-center"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(lightboxUrl, "_blank", "noopener,noreferrer");
          }}
        >
          <ExternalLink className="w-5 h-5" />
        </button>
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) setInitialized(null); onOpenChange(o); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes da Ocorrência</SheetTitle>
          </SheetHeader>

          <div className="space-y-6 mt-4">
            {/* IDENTIFICAÇÃO */}
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Identificação</h3>
              <div className="flex items-start justify-between gap-3">
                <Field label="Loja" value={storeName} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 flex-shrink-0"
                  onClick={() => setCheckinOpen(true)}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Check-in da loja
                </Button>
              </div>

              <div className="flex items-start gap-3">
                {pieceImageUrl && (
                  <button
                    type="button"
                    onClick={() => setLightboxUrl(pieceImageUrl)}
                    className="w-16 h-16 rounded-md overflow-hidden border border-border flex-shrink-0 hover:opacity-80 transition"
                    title="Ampliar imagem da peça"
                  >
                    <img src={getThumbnailUrl(pieceImageUrl, 200)} alt={pieceName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <Field label="Peça" value={pieceName} />
                </div>
              </div>

              <Field label="Motivo" value={motivoDesc} />
              <Field label="Reportado por" value={reporterLabel} />
              <Field label="Data de abertura" value={formatDateTime(occurrence.created_at)} />

              {needsReinst && (
                <div className="flex items-center gap-2 text-orange-600 text-xs font-medium">
                  <RotateCw className="w-3.5 h-3.5" />
                  Reinstalação necessária
                  {reinstallationDate && (
                    <span className="text-muted-foreground font-normal">
                      — {new Date(reinstallationDate).toLocaleString('pt-BR')}
                      {reinstallationOs && ` | OS: ${reinstallationOs}`}
                    </span>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
                <p className="text-sm whitespace-pre-wrap p-2 rounded-md bg-muted/40 border border-border">{occurrence.description || "—"}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridade</label>
                <Select value={priority} onValueChange={setPriority} disabled={!isAdmin}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {photoUrls.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Fotos do reporte</label>
                  <div className="flex flex-wrap gap-2">
                    {photoUrls.map((url, i) => (
                      <button key={i} type="button" onClick={() => setLightboxUrl(url)} className="w-20 h-20 rounded-md overflow-hidden border border-border hover:opacity-80 transition">
                        <img src={getThumbnailUrl(url, 200)} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <Separator />

            {/* TRATATIVA */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tratativa</h3>
                {occurrence.resolved_at && (
                  <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 dark:bg-green-950/20">
                    Resolvida em {formatDateTime(occurrence.resolved_at)}
                  </Badge>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Status da tratativa</label>
                <Select value={tratativaStatus} onValueChange={setTratativaStatus} disabled={!isAdmin}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tratativaStatuses.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className="flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                    {tratativaStatus && !tratativaStatuses.find((s) => s.value === tratativaStatus) && (
                      <SelectItem value={tratativaStatus}>
                        {TRATATIVA_LABELS[tratativaStatus] ?? tratativaStatus}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Previsão de resolução</label>
                <DateTimePicker value={expectedDate} onChange={setExpectedDate} disabled={!isAdmin} buttonClassName="h-9" />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="reinst" checked={needsReinst} onCheckedChange={(v) => setNeedsReinst(!!v)} disabled={!isAdmin} />
                <label htmlFor="reinst" className="text-sm cursor-pointer">Precisa reinstalação</label>
              </div>

              {needsReinst && (
                <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-orange-400 mt-2">
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">
                      Data e horário da reinstalação
                    </label>
                    <DateTimePicker
                      value={reinstallationDate}
                      onChange={setReinstallationDate}
                      disabled={!isAdmin}
                      buttonClassName="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">
                      Número da OS
                    </label>
                    <input
                      type="text"
                      value={reinstallationOs}
                      onChange={(e) => setReinstallationOs(e.target.value)}
                      disabled={!isAdmin}
                      placeholder="Ex: OS-2024-001"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notas da tratativa</label>
                <Textarea value={tratativaNotes} onChange={(e) => setTratativaNotes(e.target.value)} disabled={!isAdmin} className="min-h-[80px]" placeholder="Descreva as ações tomadas..." />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Fotos da resolução ({resolutionPhotos.length}/3)</label>
                <div className="flex flex-wrap gap-2">
                  {resolutionPhotos.map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border border-border">
                      <button type="button" onClick={() => setLightboxUrl(url)} className="w-full h-full">
                        <img src={getThumbnailUrl(url, 200)} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      </button>
                      {isAdmin && (
                        <button type="button" onClick={() => setResolutionPhotos(resolutionPhotos.filter((_, x) => x !== i))} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {isAdmin && resolutionPhotos.length < 3 && (
                    <label className="w-20 h-20 rounded-md border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary cursor-pointer transition-colors">
                      {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleAddPhoto(e.target.files)} disabled={uploading} />
                    </label>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setInitialized(null); onOpenChange(false); }} disabled={saving}>Cancelar</Button>
                  <Button onClick={handleSave} disabled={saving || uploading}>
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvando...</> : "Salvar"}
                  </Button>
                </div>
              )}
            </section>
          </div>
        </SheetContent>
      </Sheet>

      {/* Lightbox */}
      {lightbox}

      {/* Check-in fotográfico da loja */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Check-in fotográfico — {storeName}</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {checkinQuery.isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando fotos...
              </div>
            ) : (checkinQuery.data ?? []).length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Nenhuma foto de check-in registrada para esta loja nesta campanha.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {(checkinQuery.data ?? []).map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLightboxUrl(p.photo_url)}
                    className="group relative aspect-square rounded-md overflow-hidden border border-border hover:border-primary transition"
                    title={p.caption || p.category || ""}
                  >
                    <img
                      src={getThumbnailUrl(p.photo_url, 400)}
                      alt={p.caption || ""}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                    {(p.caption || p.category) && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-[10px] text-white text-left">
                        <div className="truncate">{p.caption || p.category}</div>
                        <div className="opacity-70">{formatDateTime(p.created_at)}</div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-0.5 block">{label}</label>
      <p className="text-sm">{value}</p>
    </div>
  );
}
