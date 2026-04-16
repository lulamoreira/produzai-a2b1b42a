import { useState, useMemo } from "react";
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
import { Camera, X, Loader2, ExternalLink, RotateCw } from "lucide-react";
import { compressImage } from "@/lib/compressImage";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  occurrence: any | null;
  isAdmin: boolean;
  campaignId: string;
}

const PRIORITY_LABELS: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const TRATATIVA_LABELS: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  resolvida: "Resolvida",
};

function formatDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function OccurrenceDetailSheet({ open, onOpenChange, occurrence, isAdmin, campaignId }: Props) {
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
  const [initialized, setInitialized] = useState<string | null>(null);

  // Init when occurrence changes
  useMemo(() => {
    if (occurrence && occurrence.id !== initialized) {
      setPriority(occurrence.priority ?? "media");
      setTratativaStatus(occurrence.tratativa_status ?? "aberta");
      setExpectedDate(toLocalInput(occurrence.expected_resolution_date));
      setNeedsReinst(!!occurrence.needs_reinstallation);
      setTratativaNotes(occurrence.tratativa_notes ?? "");
      setResolutionPhotos(Array.isArray(occurrence.resolution_photo_urls) ? occurrence.resolution_photo_urls : []);
      setReinstallationDate(toLocalInput(occurrence.reinstallation_scheduled_at));
      setReinstallationOs(occurrence.reinstallation_os ?? "");
      setInitialized(occurrence.id);
    }
  }, [occurrence, initialized]);

  if (!occurrence) return null;

  const photoUrls: string[] = Array.isArray(occurrence.photo_urls) ? occurrence.photo_urls : [];
  const storeName = occurrence.client_stores?.name ?? "—";
  const pieceName = occurrence.loja_a_loja_pecas?.nome ?? "—";
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
          resolved_by_user_id: tratativaStatus === "resolvida" ? userId : null,
        } as any)
        .eq("id", occurrence.id);

      if (error) throw error;

      toast.success("Ocorrência atualizada.");
      qc.invalidateQueries({ queryKey: ["portal-occurrences", campaignId] });
      setInitialized(null);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  }

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
              <Field label="Loja" value={storeName} />
              <Field label="Peça" value={pieceName} />
              <Field label="Motivo" value={motivoDesc} />
              <Field label="Reportado por" value={reporterLabel} />
              <Field label="Data de abertura" value={formatDateTime(occurrence.created_at)} />

              {occurrence.needs_reinstallation && (
                <div className="flex items-center gap-2 text-orange-600 text-xs font-medium">
                  <RotateCw className="w-3.5 h-3.5" />
                  Reinstalação necessária
                  {occurrence.reinstallation_scheduled_at && (
                    <span className="text-muted-foreground font-normal">
                      — {new Date(occurrence.reinstallation_scheduled_at).toLocaleString('pt-BR')}
                      {occurrence.reinstallation_os && ` | OS: ${occurrence.reinstallation_os}`}
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
                        <img src={url} alt="" className="w-full h-full object-cover" />
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
                    {Object.entries(TRATATIVA_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Previsão de resolução</label>
                <Input type="datetime-local" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} disabled={!isAdmin} className="h-9" />
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
                    <input
                      type="datetime-local"
                      value={reinstallationDate}
                      onChange={(e) => setReinstallationDate(e.target.value)}
                      disabled={!isAdmin}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                        <img src={url} alt="" className="w-full h-full object-cover" />
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
      {lightboxUrl && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full object-contain" />
          <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full">
            <X className="w-6 h-6" />
          </button>
          <a href={lightboxUrl} target="_blank" rel="noreferrer" className="absolute top-4 right-16 text-white p-2 hover:bg-white/10 rounded-full" onClick={(e) => e.stopPropagation()}>
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      )}
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
