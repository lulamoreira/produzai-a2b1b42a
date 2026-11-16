/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ClipboardCheck, Download, Loader2, ImageOff, CheckCircle2, ChevronDown, RotateCcw, RefreshCw, CopyPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { reviewRateio, FINDING_TYPE_LABELS, itemCodeLabel, storeQtyLine, storeSuffixes, withQuantities, type RateioFinding, type RateioFindingType } from "@/lib/reviewRateio";
import { buildJustRow, countSameTodas, sameTodasFindings, splitByJust, type JustEscopo, type Justificativa } from "@/lib/rateioReviewJust";
import { exportRateioReviewPDF } from "@/lib/exportRateioReviewPDF";
import { buildStoreLookup, normalizeStoreKey } from "@/lib/storeFicha";
import { StoreFichaDialog } from "@/components/StoreFichaDialog";
import { RateioFillMissingDialog, type FillMissingRequest } from "@/components/RateioFillMissingDialog";
import { quantityDistribution } from "@/lib/rateioFillMissing";
import { EMPTY_FILTERS, filterFindings, topReasons, type FindingFilters } from "@/lib/rateioReviewView";
import { buildItemDetail } from "@/lib/rateioItemDetail";
import { SEV_LABEL, SEV_STYLE } from "@/components/rateioReviewStyles";
import { RateioShowcaseGroups } from "@/components/RateioShowcaseGroups";
import { RateioReviewFilters } from "@/components/RateioReviewFilters";
import { RateioItemDetailDialog } from "@/components/RateioItemDetailDialog";
import { RateioJustCoverageList } from "@/components/RateioJustCoverageList";

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
  /**
   * Grava "Colocar nas que não têm" pelo caminho do Rateio (histórico + desfazer).
   * Só é passado para quem pode editar a matriz; sem ele o botão não aparece.
   */
  onFillMissing?: (req: FillMissingRequest) => Promise<boolean>;
}

type StoreLookup = Map<string, any>;

/** "Colocar nas que não têm" só vale para "Falta em lojas do mesmo modelo" com dados completos. */
const canFill = (f: RateioFinding) =>
  f.type === "modelo_divergente" &&
  !!f.itemId && !!f.itemKind &&
  (f.storesWithQty?.length ?? 0) > 0 &&
  (f.storesWithoutIds?.length ?? 0) > 0;

/** Nomes de loja separados por vírgula; os encontrados viram botão que abre a ficha (só leitura). */
function StoreNames({ names, lookup, onOpen, suffixes }: { names: string[]; lookup: StoreLookup; onOpen: (store: any) => void; suffixes?: string[] }) {
  return (
    <>
      {names.map((name, idx) => {
        const store = lookup.get(normalizeStoreKey(name));
        return (
          <span key={`${idx}-${name}`}>
            {idx > 0 ? ", " : ""}
            {store ? (
              <button
                type="button"
                onClick={() => onOpen(store)}
                className="text-primary hover:underline cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {name}
              </button>
            ) : (
              name
            )}
            {suffixes && suffixes[idx] !== undefined ? (
              <span className="text-[10px] text-muted-foreground tabular-nums"> ({suffixes[idx]})</span>
            ) : null}
          </span>
        );
      })}
    </>
  );
}

interface FindingCardProps {
  f: RateioFinding;
  children?: React.ReactNode;
  lookup: StoreLookup;
  onOpenStore: (store: any) => void;
  onOpenItem: (f: RateioFinding) => void;
}

function FindingCard({ f, children, lookup, onOpenStore, onOpenItem }: FindingCardProps) {
  // Rótulos por loja (quantidade, vitrines ou peças do kit): mesma regra da tela e do PDF.
  const { with: withSuffixes, without: withoutSuffixes } = storeSuffixes(f);
  const qtyLine = storeQtyLine(f);
  const canOpenItem = !!f.itemId && !!f.itemKind;
  const withQ = withQuantities(f);
  const dist = withQ?.length ? quantityDistribution(withQ) : null;
  const totalWith = withQ?.reduce((a, q) => a + q, 0) ?? 0;
  const lojas = (n: number) => `${n} ${n === 1 ? "loja" : "lojas"}`;
  return (
    <div className="flex gap-3 rounded-lg border bg-card p-3">
      {(() => {
        const thumb = f.itemImage ? (
          <img src={f.itemImage} alt={f.itemName ?? ""} loading="lazy" className="w-full h-full object-contain" />
        ) : (
          <ImageOff className="w-5 h-5 text-muted-foreground" aria-hidden />
        );
        const base = "w-14 h-14 shrink-0 rounded border bg-muted flex items-center justify-center overflow-hidden";
        return canOpenItem ? (
          <button
            type="button"
            onClick={() => onOpenItem(f)}
            aria-label={`Ver detalhes do item ${f.itemName ?? ""}`.trim()}
            title="Ver detalhes do item"
            className={cn(base, "cursor-zoom-in hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
          >
            {thumb}
          </button>
        ) : (
          <div className={base}>{thumb}</div>
        );
      })()}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge className={cn("border-0 text-[10px]", SEV_STYLE[f.severity])}>{SEV_LABEL[f.severity]}</Badge>
          {itemCodeLabel(f.itemCode) ? (
            <span className="font-mono text-[10px] text-muted-foreground shrink-0">{itemCodeLabel(f.itemCode)}</span>
          ) : null}
          <span className="min-w-0 text-sm font-medium">{f.title}</span>
        </div>
        <p className="text-xs text-muted-foreground">{f.detail}</p>
        {qtyLine ? <p className="text-[11px] text-muted-foreground tabular-nums">{qtyLine}</p> : null}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 [&>div]:min-w-0 [&>div]:break-words">
            {f.storesWith?.length ? <div><span className="font-semibold">Tem:</span> <StoreNames names={f.storesWith} lookup={lookup} onOpen={onOpenStore} suffixes={withSuffixes} /></div> : null}
            {f.storesWithout?.length ? <div><span className="font-semibold">Não tem:</span> <StoreNames names={f.storesWithout} lookup={lookup} onOpen={onOpenStore} suffixes={withoutSuffixes} /></div> : null}
          </div>
        ) : null}
        {dist ? (
          <p className="text-[11px] text-muted-foreground break-words">
            Quem tem: {lojas(withQ?.length ?? 0)}, total {totalWith} un. → {dist.map((d) => `${d.qty} un.: ${lojas(d.stores)}`).join(" · ")}.
            {f.storesWithoutIds?.length ? <>{" "}Quem não tem: {lojas(f.storesWithoutIds.length)}, total 0.</> : null}
          </p>
        ) : null}
        {f.storesWithQty?.length && f.storesWithoutIds?.length ? <RateioShowcaseGroups f={f} /> : null}
        {children}
      </div>
    </div>
  );
}

interface JustifyButtonProps {
  f: RateioFinding;
  onSave: (f: RateioFinding, escopo: JustEscopo, motivo: string) => Promise<boolean>;
  reasons: string[];
  /** Apontamentos ativos (para contar quantas lojas a regra "Todas as lojas" cobre agora). */
  ativos: RateioFinding[];
}

function JustifyButton({ f, onSave, reasons, ativos }: JustifyButtonProps) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [escopo, setEscopo] = useState<JustEscopo>("caso");
  // Só calcula quando o usuário escolhe "Todas as lojas" (contagem ao vivo).
  const cobertos = useMemo(() => (escopo === "item_todas" ? sameTodasFindings(f, ativos) : []), [escopo, f, ativos]);
  const alcance = cobertos.length;
  const isVitrine = f.type === "vitrine_excesso";
  const ids = `${f.type}-${f.storeName ?? ""}-${f.itemId ?? f.itemName ?? ""}-${f.title}`.replace(/[^\w-]/g, "_");
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
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto space-y-3" align="start" collisionPadding={8}>
        {reasons.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">Motivos frequentes</span>
            <div className="flex flex-wrap gap-1.5">
              {reasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setMotivo(r)}
                  aria-pressed={motivo.trim() === r}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] max-w-full truncate transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    motivo.trim() === r ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
                  )}
                  title={r}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor={`motivo-${ids}`} className="text-xs">Motivo (obrigatório)</Label>
          <Textarea id={`motivo-${ids}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Ex.: loja pediu sem esse item" />
        </div>
        <RadioGroup value={escopo} onValueChange={(v) => setEscopo(v as JustEscopo)} className="gap-2">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="caso" id={`esc-caso-${ids}`} />
            <Label htmlFor={`esc-caso-${ids}`} className="text-xs font-normal">Só este caso</Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="item_todas" id={`esc-todas-${ids}`} className="mt-0.5" />
            <div className="min-w-0">
              <Label htmlFor={`esc-todas-${ids}`} className="text-xs font-normal">Todas as lojas</Label>
              <p className="text-[10px] leading-snug text-muted-foreground">
                {isVitrine
                  ? "Todas as lojas na mesma situação (mesmo nº de vitrines e mesmos itens e quantidades)"
                  : "Este item em todas as lojas"}
              </p>
            </div>
          </div>
        </RadioGroup>
        {escopo === "item_todas" ? (
          <RateioJustCoverageList
            findings={cobertos}
            current={f}
            label={`Vale para ${alcance} loja(s) agora — ver quais`}
            footerTotal={ativos.length}
          />
        ) : null}
        <Button size="sm" className="w-full" onClick={confirm} disabled={!motivo.trim() || saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : escopo === "item_todas" ? `Confirmar para ${alcance} loja(s)` : "Confirmar"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export default function RateioReviewDialog(props: RateioReviewDialogProps) {
  const { open, onOpenChange, pieces, kits, kitPieces, stores, qtyMap, campaignName, clientName, clientId, customFieldLabels, onFillMissing } = props;
  // Apontamento aberto na prévia "Colocar nas que não têm".
  const [fillFinding, setFillFinding] = useState<RateioFinding | null>(null);
  const [exporting, setExporting] = useState(false);
  const [justMap, setJustMap] = useState<Map<string, Justificativa>>(new Map());
  const [showJust, setShowJust] = useState(false);
  const [rev, setRev] = useState(0);
  const [reanalyzing, setReanalyzing] = useState(false);
  // Espelho síncrono do justMap: o "Reanalisar" conta com os dados recém-carregados.
  const justMapRef = useRef<Map<string, Justificativa>>(new Map());
  // Ficha da loja (somente leitura) aberta a partir das listas "Tem"/"Não tem".
  const [fichaStore, setFichaStore] = useState<any | null>(null);
  const storeLookup = useMemo(() => buildStoreLookup(stores ?? []), [stores]);
  // Detalhe do item (somente leitura) aberto pela miniatura.
  const [itemRef, setItemRef] = useState<{ kind: "piece" | "kit"; id: string } | null>(null);
  const itemDetail = useMemo(
    () => (itemRef ? buildItemDetail(itemRef.kind, itemRef.id, pieces ?? [], kits ?? [], kitPieces ?? [], stores ?? [], qtyMap) : null),
    [itemRef, pieces, kits, kitPieces, stores, qtyMap],
  );
  const openItem = useCallback((f: RateioFinding) => {
    if (f.itemId && f.itemKind) setItemRef({ kind: f.itemKind, id: f.itemId });
  }, []);
  // Busca/filtros: só mudam o que é exibido (contadores do topo e PDF usam todos os ativos).
  const [filters, setFilters] = useState<FindingFilters>(EMPTY_FILTERS);

  const findings = useMemo(
    () => (open && rev >= 0 ? reviewRateio(pieces, kits, kitPieces, stores, qtyMap, customFieldLabels) : []),
    [open, rev, pieces, kits, kitPieces, stores, qtyMap, customFieldLabels],
  );
  const types = useMemo(() => Object.keys(FINDING_TYPE_LABELS) as RateioFindingType[], []);

  const loadJust = useCallback(async (): Promise<boolean> => {
    if (!clientId) return false;
    const { data, error } = await supabase
      .from("rateio_review_justificativas")
      .select("id, fingerprint, motivo, escopo, created_at")
      .eq("client_id", clientId);
    if (error) { console.error(error); toast.error("Não foi possível carregar as justificativas."); return false; }
    const map = new Map((data ?? []).map((j) => [j.fingerprint, j as Justificativa]));
    justMapRef.current = map;
    setJustMap(map);
    return true;
  }, [clientId]);

  useEffect(() => { if (open) void loadJust(); }, [open, loadJust]);
  // Ao fechar a revisão, a próxima abertura começa sem filtros.
  useEffect(() => { if (!open) setFilters(EMPTY_FILTERS); }, [open]);

  const { ativos, justificados } = useMemo(() => splitByJust(findings, justMap), [findings, justMap]);
  const ativosVisiveis = useMemo(() => filterFindings(ativos, filters, (f) => f), [ativos, filters]);
  const justificadosVisiveis = useMemo(() => filterFindings(justificados, filters, (j) => j.f), [justificados, filters]);
  const justificadosF = useMemo(() => justificados.map((j) => j.f), [justificados]);
  const typesPresentes = useMemo(() => {
    const present = new Set(findings.map((f) => f.type));
    return types.filter((t) => present.has(t));
  }, [findings, types]);
  // Motivos mais usados por este cliente (do justMap já carregado; sem consulta nova).
  const reasons = useMemo(() => topReasons([...justMap.values()]), [justMap]);

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      const ok = await loadJust();
      if (!ok) throw new Error("justificativas não carregadas");
      // Varredura local com os mesmos dados que a tela vai usar após o novo ciclo.
      const fresh = reviewRateio(pieces, kits, kitPieces, stores, qtyMap, customFieldLabels);
      const { ativos: a, justificados: j } = splitByJust(fresh, justMapRef.current);
      setRev((r) => r + 1);
      toast.success(`Análise atualizada: ${a.length} ativo(s), ${j.length} justificado(s).`);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível reanalisar.");
    } finally {
      setReanalyzing(false);
    }
  };

  const saveJust = async (f: RateioFinding, escopo: JustEscopo, motivo: string) => {
    // Contado antes de gravar: os mesmos apontamentos mostrados na prévia.
    const n = escopo === "item_todas" ? countSameTodas(f, ativos) : 1;
    const row = buildJustRow(f, escopo);
    const { error } = await supabase.from("rateio_review_justificativas").upsert(
      { client_id: clientId, ...row, motivo },
      { onConflict: "client_id,fingerprint" },
    );
    if (error) { console.error(error); toast.error("Não foi possível salvar a justificativa."); return false; }
    toast.success(
      escopo === "item_todas"
        ? `Justificado para ${n} loja(s). Reabra em Justificadas se precisar desfazer.`
        : "Apontamento justificado.",
    );
    // Recarrega e reanalisa: os demais apontamentos iguais somem na hora.
    await loadJust();
    setRev((r) => r + 1);
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
          <DialogDescription>Análise automática da matriz atual. Nada é alterado sem a sua confirmação.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Total: {ativos.length}</Badge>
          {(["alta", "media", "baixa"] as const).map((s) => (
            <Badge key={s} className={cn("border-0", SEV_STYLE[s])}>
              {SEV_LABEL[s]}: {ativos.filter((f) => f.severity === s).length}
            </Badge>
          ))}
          <Button size="sm" variant="outline" className="ml-auto gap-2" onClick={handleReanalyze} disabled={reanalyzing}>
            {reanalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Reanalisar
          </Button>
          <Button size="sm" className="gap-2" onClick={handlePdf} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Baixar PDF completo
          </Button>
        </div>

        {findings.length > 0 ? (
          <RateioReviewFilters value={filters} onChange={setFilters} types={typesPresentes} shown={ativosVisiveis.length} total={ativos.length} />
        ) : null}

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {ativos.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">Nenhuma inconsistência encontrada 🎉</p>
          ) : ativosVisiveis.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum apontamento com esses filtros.</p>
          ) : (
            types.map((t) => {
              const list = ativosVisiveis.filter((f) => f.type === t);
              if (!list.length) return null;
              return (
                <section key={t} className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">{FINDING_TYPE_LABELS[t]} ({list.length})</h3>
                  {list.map((f, i) => (
                    <FindingCard key={`${t}-${i}-${f.detail}`} f={f} lookup={storeLookup} onOpenStore={setFichaStore} onOpenItem={openItem}>
                      <div className="flex flex-wrap items-center gap-2">
                        <JustifyButton f={f} onSave={saveJust} reasons={reasons} ativos={ativos} />
                        {onFillMissing && canFill(f) ? (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 mt-1" onClick={() => setFillFinding(f)}>
                            <CopyPlus className="w-3.5 h-3.5" /> Colocar nas que não têm
                          </Button>
                        ) : null}
                      </div>
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
                Justificadas ({justificadosVisiveis.length === justificados.length ? justificados.length : `${justificadosVisiveis.length} de ${justificados.length}`})
              </button>
              {showJust &&
                justificadosVisiveis.map(({ f, reg }, i) => (
                  <FindingCard key={`j-${i}-${f.detail}`} f={f} lookup={storeLookup} onOpenStore={setFichaStore} onOpenItem={openItem}>
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      <span className="rounded bg-muted px-2 py-1">
                        <span className="font-semibold">Motivo:</span> {reg.motivo}
                        {reg.escopo === "item_todas" ? " (todas as lojas)" : ""} ·{" "}
                        {new Date(reg.created_at).toLocaleDateString("pt-BR")}
                      </span>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => reopen(reg.id)}>
                        <RotateCcw className="w-3.5 h-3.5" /> Reabrir
                      </Button>
                    </div>
                    {reg.escopo === "item_todas" ? (() => {
                      // Auditoria: apontamentos que hoje casam com esta regra "todas as lojas".
                      const cobertos = sameTodasFindings(f, justificadosF);
                      return (
                        <div className="pt-1">
                          <RateioJustCoverageList findings={cobertos} current={f} label={`Ver lojas cobertas (${cobertos.length})`} defaultOpen={false} />
                        </div>
                      );
                    })() : null}
                  </FindingCard>
                ))}
            </section>
          )}
        </div>
      </DialogContent>
      {onFillMissing ? (
        <RateioFillMissingDialog
          finding={fillFinding}
          onOpenChange={(v) => { if (!v) setFillFinding(null); }}
          onConfirm={async (req) => {
            const ok = await onFillMissing(req);
            // A matriz é recarregada por quem grava; reanalisa para o apontamento sumir se foi corrigido.
            if (ok) setRev((r) => r + 1);
            return ok;
          }}
        />
      ) : null}
      <StoreFichaDialog
        store={fichaStore}
        onOpenChange={(v) => { if (!v) setFichaStore(null); }}
        pieces={pieces}
        kits={kits}
        kitPieces={kitPieces}
        qtyMap={qtyMap}
        customFieldLabels={customFieldLabels}
        findings={ativos}
        justifiedFindings={justificadosF}
      />
      <RateioItemDetailDialog detail={itemDetail} onOpenChange={(v) => { if (!v) setItemRef(null); }} />
    </Dialog>
  );
}
