import React, { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyRateioBulk } from "@/lib/applyRateioBulk";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowRight, Copy, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ClientStore, CampaignPiece, CampaignKit } from "@/hooks/useMultiClientData";

type ItemRef = { kind: "piece" | "kit"; id: string };

type WriteMode = "replace" | "add";
type ConflictMode = "skip" | "overwrite";

type PreviewRow = {
  storeId: string;
  storeName: string;
  sourceQty: number;
  destChanges: { pieceId: string; pieceName: string; current: number; next: number; willWrite: boolean }[];
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  stores: ClientStore[];
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: { kit_id: string; piece_id: string; quantity: number }[];
  qtyMap: Record<string, number>;
  onComplete: () => void | Promise<void>;
  isNegotiationView?: boolean;
  negotiationSupplierId?: string | null;
}

/** Compute the available "kit count" for a given store, i.e. how many full kits fit. */
function kitQtyForStore(
  kitId: string,
  storeId: string,
  qtyMap: Record<string, number>,
  kitPieces: { kit_id: string; piece_id: string; quantity: number }[],
): number {
  const components = kitPieces.filter((kp) => kp.kit_id === kitId);
  if (components.length === 0) return 0;
  let min = Infinity;
  for (const c of components) {
    const have = qtyMap[`${storeId}-${c.piece_id}`] || 0;
    const fits = Math.floor(have / (c.quantity || 1));
    if (fits < min) min = fits;
  }
  return Number.isFinite(min) ? min : 0;
}

export default function CopyQuantitiesDialog({
  open, onOpenChange, campaignId, stores, pieces, kits, kitPieces, qtyMap, onComplete,
}: Props) {
  const [source, setSource] = useState<ItemRef | null>(null);
  const [dest, setDest] = useState<ItemRef | null>(null);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [writeMode, setWriteMode] = useState<WriteMode>("replace");
  const [conflictMode, setConflictMode] = useState<ConflictMode>("overwrite");

  const [step, setStep] = useState<1 | 2>(1);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [executing, setExecuting] = useState(false);

  // Searchable item list (pieces + kits)
  const [search, setSearch] = useState("");
  const allItems = useMemo(() => {
    const list: { ref: ItemRef; code: number | string; name: string; label: string }[] = [];
    for (const p of pieces) {
      list.push({ ref: { kind: "piece", id: p.id }, code: p.code, name: p.name, label: `${p.code} · ${p.name}` });
    }
    for (const k of kits) {
      list.push({ ref: { kind: "kit", id: k.id }, code: k.code, name: k.name, label: `KIT ${k.code} · ${k.name}` });
    }
    return list;
  }, [pieces, kits]);

  const findItem = useCallback((ref: ItemRef | null) => {
    if (!ref) return null;
    return allItems.find((i) => i.ref.kind === ref.kind && i.ref.id === ref.id) || null;
  }, [allItems]);

  const reset = () => {
    setSource(null);
    setDest(null);
    setMultiplier(1);
    setWriteMode("replace");
    setConflictMode("overwrite");
    setStep(1);
    setPreview([]);
    setSearch("");
  };

  /** Compute source qty for a store given current source ref */
  const computeSourceQty = useCallback((storeId: string): number => {
    if (!source) return 0;
    if (source.kind === "piece") return qtyMap[`${storeId}-${source.id}`] || 0;
    return kitQtyForStore(source.id, storeId, qtyMap, kitPieces);
  }, [source, qtyMap, kitPieces]);

  /** Compute the (pieceId, deltaQty) writes for destination given a source qty */
  const computeDestWrites = useCallback((srcQty: number): { pieceId: string; quantity: number }[] => {
    if (!dest || srcQty <= 0) return [];
    const target = Math.max(0, Math.ceil(srcQty * (multiplier || 0)));
    if (target <= 0) return [];
    if (dest.kind === "piece") {
      return [{ pieceId: dest.id, quantity: target }];
    }
    const components = kitPieces.filter((kp) => kp.kit_id === dest.id);
    if (components.length === 0) return [];
    return components.map((c) => ({ pieceId: c.piece_id, quantity: target * (c.quantity || 1) }));
  }, [dest, multiplier, kitPieces]);

  const pieceNameById = useCallback((pid: string) => {
    return pieces.find((p) => p.id === pid)?.name || `Peça ${pid.slice(0, 6)}`;
  }, [pieces]);

  const buildPreview = () => {
    if (!source || !dest) {
      toast.error("Selecione a peça/kit de origem e destino.");
      return;
    }
    if (source.kind === dest.kind && source.id === dest.id) {
      toast.error("Origem e destino não podem ser o mesmo item.");
      return;
    }
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      toast.error("O multiplicador deve ser maior que zero.");
      return;
    }

    const rows: PreviewRow[] = [];
    for (const store of stores) {
      const srcQty = computeSourceQty(store.id);
      if (srcQty <= 0) continue;
      const writes = computeDestWrites(srcQty);
      if (writes.length === 0) continue;

      // Aggregate per piece (kit dest already produces per-piece rows)
      const aggregated = new Map<string, number>();
      for (const w of writes) {
        aggregated.set(w.pieceId, (aggregated.get(w.pieceId) || 0) + w.quantity);
      }

      const destChanges = Array.from(aggregated.entries()).map(([pieceId, addQty]) => {
        const current = qtyMap[`${store.id}-${pieceId}`] || 0;
        const next = writeMode === "add" ? current + addQty : addQty;
        const willWrite = !(conflictMode === "skip" && current > 0 && writeMode === "replace");
        return { pieceId, pieceName: pieceNameById(pieceId), current, next, willWrite };
      });

      rows.push({
        storeId: store.id,
        storeName: store.name,
        sourceQty: srcQty,
        destChanges,
      });
    }

    if (rows.length === 0) {
      toast.error("Nenhuma loja possui quantidade na origem para copiar.");
      return;
    }

    setPreview(rows);
    setStep(2);
  };

  const execute = async () => {
    setExecuting(true);
    try {
      const upserts: { campaign_id: string; store_id: string; piece_id: string; quantity: number }[] = [];
      const deletes: { storeId: string; pieceId: string }[] = [];

      for (const row of preview) {
        for (const ch of row.destChanges) {
          if (!ch.willWrite) continue;
          if (ch.next > 0) {
            upserts.push({ campaign_id: campaignId, store_id: row.storeId, piece_id: ch.pieceId, quantity: ch.next });
          } else {
            deletes.push({ storeId: row.storeId, pieceId: ch.pieceId });
          }
        }
      }

      // Dedup (store, piece) – sum quantities (defensive; aggregation already happened per row)
      if (upserts.length > 0) {
        const map = new Map<string, typeof upserts[number]>();
        for (const u of upserts) {
          const key = `${u.store_id}-${u.piece_id}`;
          const existing = map.get(key);
          if (existing) existing.quantity = u.quantity; // last-wins per store/piece
          else map.set(key, { ...u });
        }
        // Chunk to keep payload small
        const arr = Array.from(map.values());
        const CHUNK = 500;
        for (let i = 0; i < arr.length; i += CHUNK) {
          const slice = arr.slice(i, i + CHUNK);
          const { error } = await supabase
            .from("campaign_store_pieces")
            .upsert(slice, { onConflict: "campaign_id,store_id,piece_id" });
          if (error) throw error;
        }
      }

      for (const d of deletes) {
        await supabase
          .from("campaign_store_pieces")
          .delete()
          .eq("campaign_id", campaignId)
          .eq("store_id", d.storeId)
          .eq("piece_id", d.pieceId);
      }

      const totalStores = preview.length;
      toast.success(`Quantidades copiadas em ${totalStores} loja(s).`);
      await onComplete();
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao copiar: " + (err?.message || String(err)));
    } finally {
      setExecuting(false);
    }
  };

  const filteredItems = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return allItems.slice(0, 100);
    return allItems.filter((i) => i.label.toLowerCase().includes(s)).slice(0, 100);
  }, [allItems, search]);

  const sourceItem = findItem(source);
  const destItem = findItem(dest);

  // Stats
  const totalStoresWithSource = useMemo(() => {
    if (!source) return 0;
    return stores.filter((s) => computeSourceQty(s.id) > 0).length;
  }, [source, stores, computeSourceQty]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="w-full max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5" /> Copiar quantidades entre itens
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Copie a quantidade de uma peça ou kit para outra peça/kit em todas as lojas. Funciona com kits — a quantidade equivalente é calculada a partir das peças componentes."
              : "Revise as alterações antes de aplicar."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            {/* Item picker (single, used for both via radio) */}
            <div>
              <Label className="text-sm font-semibold">Buscar peça ou kit</Label>
              <Input
                placeholder="Digite código ou nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1"
              />
              <div className="mt-2 border rounded-md max-h-44 overflow-y-auto">
                {filteredItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">Nenhum item encontrado.</p>
                ) : (
                  filteredItems.map((it) => {
                    const isSrc = source && source.kind === it.ref.kind && source.id === it.ref.id;
                    const isDst = dest && dest.kind === it.ref.kind && dest.id === it.ref.id;
                    return (
                      <div
                        key={`${it.ref.kind}-${it.ref.id}`}
                        className="flex items-center gap-2 px-2 py-1.5 border-b last:border-b-0 text-sm hover:bg-accent/40"
                      >
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {it.ref.kind === "kit" ? "Kit" : "Peça"}
                        </Badge>
                        <span className="truncate flex-1">{it.label}</span>
                        <Button
                          size="sm"
                          variant={isSrc ? "default" : "outline"}
                          className="h-6 text-[11px] px-2"
                          onClick={() => setSource(it.ref)}
                        >
                          Origem
                        </Button>
                        <Button
                          size="sm"
                          variant={isDst ? "default" : "outline"}
                          className="h-6 text-[11px] px-2"
                          onClick={() => setDest(it.ref)}
                        >
                          Destino
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Source / Destination summary */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 min-h-[72px]">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Origem (A)</p>
                {sourceItem ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{sourceItem.ref.kind === "kit" ? "Kit" : "Peça"}</Badge>
                    <span className="text-sm font-medium truncate">{sourceItem.label}</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Selecione uma peça ou kit acima.</p>
                )}
                {sourceItem && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Lojas com quantidade: <span className="font-semibold text-foreground">{totalStoresWithSource}</span>
                  </p>
                )}
              </div>
              <ArrowRight className="hidden md:block w-5 h-5 text-muted-foreground mx-auto" />
              <div className="rounded-lg border bg-muted/30 p-3 min-h-[72px]">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Destino (B)</p>
                {destItem ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{destItem.ref.kind === "kit" ? "Kit" : "Peça"}</Badge>
                    <span className="text-sm font-medium truncate">{destItem.label}</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Selecione uma peça ou kit acima.</p>
                )}
              </div>
            </div>

            {/* Multiplier + modes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-sm font-semibold">Multiplicador</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={multiplier}
                  onChange={(e) => setMultiplier(parseFloat(e.target.value) || 1)}
                  className="mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  destino = origem × multiplicador (arredondado p/ cima)
                </p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Modo de escrita</Label>
                <RadioGroup value={writeMode} onValueChange={(v) => setWriteMode(v as WriteMode)} className="mt-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="replace" id="cq-replace" />
                    <Label htmlFor="cq-replace" className="text-xs font-normal cursor-pointer">Substituir quantidade do destino</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="add" id="cq-add" />
                    <Label htmlFor="cq-add" className="text-xs font-normal cursor-pointer">Somar à quantidade existente</Label>
                  </div>
                </RadioGroup>
              </div>
              <div>
                <Label className="text-sm font-semibold">Conflitos</Label>
                <Select value={conflictMode} onValueChange={(v) => setConflictMode(v as ConflictMode)} disabled={writeMode === "add"}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overwrite">Sobrescrever destinos com valor</SelectItem>
                    <SelectItem value="skip">Pular destinos que já têm quantidade</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Aplica-se apenas no modo "Substituir".
                </p>
              </div>
            </div>

            {dest?.kind === "kit" && (
              <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/40 p-3 text-xs">
                ⚠ Destino é um <span className="font-semibold">kit</span>: a quantidade calculada será aplicada às peças componentes
                (cada componente recebe <span className="font-mono">qtd × componente</span>).
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <p>
                <span className="font-semibold">{preview.length}</span> loja(s) serão atualizadas.
                Origem: <span className="font-medium">{sourceItem?.label}</span> · Destino:{" "}
                <span className="font-medium">{destItem?.label}</span> · Multiplicador: ×{multiplier} · Modo:{" "}
                {writeMode === "replace" ? "Substituir" : "Somar"}
                {writeMode === "replace" && ` (${conflictMode === "overwrite" ? "sobrescrever" : "pular"})`}
              </p>
            </div>

            <div className="border rounded-md max-h-[40vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="text-xs">Loja</TableHead>
                    <TableHead className="text-xs text-right">Qtd. origem</TableHead>
                    <TableHead className="text-xs">Peça destino</TableHead>
                    <TableHead className="text-xs text-right">Atual</TableHead>
                    <TableHead className="text-xs text-right">Novo</TableHead>
                    <TableHead className="text-xs">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.flatMap((row) =>
                    row.destChanges.map((ch, i) => (
                      <TableRow key={`${row.storeId}-${ch.pieceId}`}>
                        {i === 0 && (
                          <>
                            <TableCell rowSpan={row.destChanges.length} className="text-xs align-top">
                              {row.storeName}
                            </TableCell>
                            <TableCell rowSpan={row.destChanges.length} className="text-xs text-right align-top font-mono">
                              {row.sourceQty}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-xs">{ch.pieceName}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{ch.current}</TableCell>
                        <TableCell className="text-xs text-right font-mono font-semibold">{ch.next}</TableCell>
                        <TableCell className="text-xs">
                          {ch.willWrite ? (
                            <Badge variant="outline" className="text-[10px]">Aplicar</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Pular</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )),
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 1 ? (
            <>
              <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
              <Button onClick={buildPreview} disabled={!source || !dest}>
                <Eye className="w-4 h-4 mr-1" /> Pré-visualizar
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep(1)} disabled={executing}>Voltar</Button>
              <Button onClick={execute} disabled={executing}>
                {executing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Copy className="w-4 h-4 mr-1" />}
                Aplicar cópia
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
