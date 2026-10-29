/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ClipboardCheck, Download, Loader2, ImageOff, CheckCircle2, ChevronDown, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { reviewRateio, FINDING_TYPE_LABELS, type RateioFinding, type RateioFindingType } from "@/lib/reviewRateio";
import { exportRateioReviewPDF } from "@/lib/exportRateioReviewPDF";

export interface RateioReviewDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pieces: any[];
  kits: any[];
  kitPieces: any[];
  stores: any[];
  qtyMap: Record<string, number>;
  campaignName: string;
  clientName?: string;
  clientId: string;
  customFieldLabels?: { index: number; label: string }[];
}

interface Justificativa {
  id: string;
  fingerprint: string;
  motivo: string;
  escopo: string;
  created_at: string;
}

const SEV_STYLE: Record<RateioFinding["severity"], string> = {
  alta: "bg-destructive text-destructive-foreground",
  media: "bg-amber-500/90 text-white",
  baixa: "bg-muted text-muted-foreground",
};
const SEV_LABEL = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;

const norm = (s: unknown) =>
  (s ?? "").toString().trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const fpEspecifico = (f: RateioFinding) =>
  f.type === "modelo_divergente"
    ? `${f.type}::${norm(f.itemName)}::MOD:${norm(f.storeModel)}`
    : `${f.type}::${norm(f.itemName)}::LOJA:${norm(f.storeName)}`;
const fpTodas = (f: RateioFinding) => `${f.type}::${norm(f.itemName)}::ALL`;

function FindingCard({ f, children }: { f: RateioFinding; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border bg-card p-3">
      <div className="w-14 h-14 shrink-0 rounded border bg-muted flex items-center justify-center overflow-hidden">
        {f.itemImage ? (
          <img src={f.itemImage} alt={f.itemName ?? ""} loading="lazy" className="w-full h-full object-contain" />
        ) : (
          <ImageOff className="w-5 h-5 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Badge className={cn("border-0 text-[10px]", SEV_STYLE[f.severity])}>{SEV_LABEL[f.severity]}</Badge>
          <span className="text-sm font-medium">{f.title}</span>
        </div>
        <p className="text-xs text-muted-foreground">{f.detail}</p>
        {f.breakdown?.length ? (
          <details className="text-xs pt-0.5">
            <summary className="cursor-pointer select-none text-primary hover:underline">
              Ver itens recebidos ({f.breakdown.length})
            </summary>
            <ul className="mt-1 ml-1 space-y-0.5">
              {f.breakdown.map((b, idx) => (
                <li key={idx} className="flex justify-between gap-2 border-b border-dashed border-border/50 py-0.5">
                  <span className="truncate">{b.name}</span>
                  <span className="font-medium shrink-0">{b.quantity}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {f.storesWith?.length || f.storesWithout?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
            {f.storesWith?.length ? <div><span className="font-semibold">Tem:</span> {f.storesWith.join(", ")}</div> : null}
            {f.storesWithout?.length ? <div><span className="font-semibold">Não tem:</span> {f.storesWithout.join(", ")}</div> : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function JustifyButton({ f, onSave }: { f: RateioFinding; onSave: (f: RateioFinding, escopo: "caso" | "item_todas", motivo: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [escopo, setEscopo] = useState<"caso" | "item_todas">("caso");
  const [saving, setSaving] = useState(false);
  const confirm = async () => {
    if (!motivo.trim()) return;
    setSaving(true);
    const ok = await onSave(f, escopo, motivo.trim());
    setSaving(false);
    if (ok) { setOpen(false); setMotivo(""); setEscopo("caso"); }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 mt-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Justificar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <div className="space-y-1">
          <Label htmlFor="motivo" className="text-xs">Motivo (obrigatório)</Label>
          <Textarea id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Ex.: loja pediu sem esse item" />
        </div>
        <RadioGroup value={escopo} onValueChange={(v) => setEscopo(v as "caso" | "item_todas")} className="gap-2">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="caso" id="esc-caso" />
            <Label htmlFor="esc-caso" className="text-xs font-normal">Só este caso</Label>
          </div>
          {f.itemName ? (
            <div className="flex items-center gap-2">
              <RadioGroupItem value="item_todas" id="esc-todas" />
              <Label htmlFor="esc-todas" className="text-xs font-normal">Este item em todas as lojas</Label>
            </div>
          ) : null}
        </RadioGroup>
        <Button size="sm" className="w-full" onClick={confirm} disabled={!motivo.trim() || saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export default function RateioReviewDialog(props: RateioReviewDialogProps) {
  const { open, onOpenChange, pieces, kits, kitPieces, stores, qtyMap, campaignName, clientName, clientId, customFieldLabels } = props;
  const [exporting, setExporting] = useState(false);
  const [justMap, setJustMap] = useState<Map<string, Justificativa>>(new Map());
  const [showJust, setShowJust] = useState(false);

  const findings = useMemo(
    () => (open ? reviewRateio(pieces, kits, kitPieces, stores, qtyMap, customFieldLabels) : []),
    [open, pieces, kits, kitPieces, stores, qtyMap, customFieldLabels],
  );
  const types = Object.keys(FINDING_TYPE_LABELS) as RateioFindingType[];

  const loadJust = useCallback(async () => {
    if (!clientId) return;
    const { data, error } = await supabase
      .from("rateio_review_justificativas")
      .select("id, fingerprint, motivo, escopo, created_at")
      .eq("client_id", clientId);
    if (error) { console.error(error); toast.error("Não foi possível carregar as justificativas."); return; }
    setJustMap(new Map((data ?? []).map((j) => [j.fingerprint, j as Justificativa])));
  }, [clientId]);

  useEffect(() => { if (open) void loadJust(); }, [open, loadJust]);

  const { ativos, justificados } = useMemo(() => {
    const a: RateioFinding[] = [];
    const j: { f: RateioFinding; reg: Justificativa }[] = [];
    for (const f of findings) {
      const reg = justMap.get(fpEspecifico(f)) ?? justMap.get(fpTodas(f));
      if (reg) j.push({ f, reg }); else a.push(f);
    }
    return { ativos: a, justificados: j };
  }, [findings, justMap]);

  const saveJust = async (f: RateioFinding, escopo: "caso" | "item_todas", motivo: string) => {
    const fingerprint = escopo === "item_todas" ? fpTodas(f) : fpEspecifico(f);
    const { error } = await supabase.from("rateio_review_justificativas").upsert(
      { client_id: clientId, fingerprint, finding_type: f.type, item_name: f.itemName ?? null, escopo, motivo },
      { onConflict: "client_id,fingerprint" },
    );
    if (error) { console.error(error); toast.error("Não foi possível salvar a justificativa."); return false; }
    toast.success("Apontamento justificado.");
    await loadJust();
    return true;
  };

  const reopen = async (id: string) => {
    const { error } = await supabase.from("rateio_review_justificativas").delete().eq("id", id);
    if (error) { console.error(error); toast.error("Não foi possível reabrir."); return; }
    toast.success("Apontamento reaberto.");
    await loadJust();
  };

  const handlePdf = async () => {
    setExporting(true);
    const id = toast.loading("Gerando PDF...");
    try {
      await exportRateioReviewPDF(ativos, {
        campaignName,
        clientName,
        onProgress: (c, t) => toast.loading(`Baixando imagens ${c}/${t}...`, { id }),
      });
      toast.success("PDF gerado.", { id });
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível gerar o PDF.", { id });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" /> Revisar Rateio
          </DialogTitle>
          <DialogDescription>Análise automática da matriz atual. Nada é alterado.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Total: {ativos.length}</Badge>
          {(["alta", "media", "baixa"] as const).map((s) => (
            <Badge key={s} className={cn("border-0", SEV_STYLE[s])}>
              {SEV_LABEL[s]}: {ativos.filter((f) => f.severity === s).length}
            </Badge>
          ))}
          <Button size="sm" className="ml-auto gap-2" onClick={handlePdf} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Baixar PDF completo
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {ativos.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">Nenhuma inconsistência encontrada 🎉</p>
          ) : (
            types.map((t) => {
              const list = ativos.filter((f) => f.type === t);
              if (!list.length) return null;
              return (
                <section key={t} className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">{FINDING_TYPE_LABELS[t]} ({list.length})</h3>
                  {list.map((f, i) => (
                    <FindingCard key={`${t}-${i}-${f.detail}`} f={f}>
                      <JustifyButton f={f} onSave={saveJust} />
                    </FindingCard>
                  ))}
                </section>
              );
            })
          )}

          {justificados.length > 0 && (
            <section className="space-y-2 border-t pt-3">
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-semibold text-foreground"
                onClick={() => setShowJust((v) => !v)}
                aria-expanded={showJust}
              >
                <ChevronDown className={cn("w-4 h-4 transition-transform", !showJust && "-rotate-90")} />
                Justificadas ({justificados.length})
              </button>
              {showJust &&
                justificados.map(({ f, reg }, i) => (
                  <FindingCard key={`j-${i}-${f.detail}`} f={f}>
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      <span className="rounded bg-muted px-2 py-1">
                        <span className="font-semibold">Motivo:</span> {reg.motivo}
                        {reg.escopo === "item_todas" ? " (item em todas as lojas)" : ""} ·{" "}
                        {new Date(reg.created_at).toLocaleDateString("pt-BR")}
                      </span>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => reopen(reg.id)}>
                        <RotateCcw className="w-3.5 h-3.5" /> Reabrir
                      </Button>
                    </div>
                  </FindingCard>
                ))}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
