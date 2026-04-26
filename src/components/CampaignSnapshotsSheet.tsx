import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Camera, ChevronDown, ChevronRight, Loader2, Plus, Trash2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { saveXlsxAs } from "@/lib/saveBlobAs";
import {
  useCampaignSnapshot,
  useCampaignSnapshotContext,
  useCampaignSnapshots,
  useCreateSnapshot,
  useDeleteSnapshot,
  type SnapshotData,
} from "@/hooks/useCampaignSnapshots";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
  campaignName?: string;
}

const CURRENT = "__current__";

interface PieceLike {
  id: string;
  name?: string | null;
  code?: string | null;
  category?: string | null;
  specification?: string | null;
}

interface KitLike {
  id: string;
  name?: string | null;
  code?: string | null;
}

interface StorePiece {
  store_id: string;
  piece_id?: string | null;
  kit_id?: string | null;
  quantity?: number | null;
}

type DiffStatus = "equal" | "modified" | "added" | "removed";

function statusOrder(s: DiffStatus) {
  return { removed: 0, modified: 1, added: 2, equal: 3 }[s];
}

function StatusBadge({ s }: { s: DiffStatus }) {
  if (s === "equal") return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">✅ Igual</Badge>;
  if (s === "modified") return <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300">⚠ Modificado</Badge>;
  if (s === "added") return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">🆕 Adicionado</Badge>;
  return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">❌ Removido</Badge>;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export default function CampaignSnapshotsSheet({ open, onOpenChange, campaignId, campaignName }: Props) {
  const { data: snapshots = [], isLoading: loadingList } = useCampaignSnapshots(campaignId);
  const { data: currentCtx, isLoading: loadingCtx } = useCampaignSnapshotContext(campaignId, open);
  const createMut = useCreateSnapshot();
  const deleteMut = useDeleteSnapshot();

  // ---- Tab 1: Save form ----
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Informe um nome para a versão");
      return;
    }
    try {
      await createMut.mutateAsync({
        campaign_id: campaignId,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast.success("Versão salva");
      setName("");
      setDescription("");
      setShowForm(false);
    } catch (e: any) {
      toast.error("Erro ao salvar versão", { description: e?.message });
    }
  };

  // ---- Tab 2: Compare ----
  const defaultA = snapshots[0]?.id;
  const [versionA, setVersionA] = useState<string | undefined>(undefined);
  const [versionB, setVersionB] = useState<string | undefined>(undefined);

  // initialize defaults when list arrives
  const effectiveA = versionA ?? defaultA;
  const effectiveB = versionB ?? CURRENT;

  const snapAQuery = useCampaignSnapshot(effectiveA && effectiveA !== CURRENT ? effectiveA : null);
  const snapBQuery = useCampaignSnapshot(effectiveB && effectiveB !== CURRENT ? effectiveB : null);

  const dataA: SnapshotData | null = useMemo(() => {
    if (!effectiveA) return null;
    if (effectiveA === CURRENT)
      return currentCtx
        ? {
            pieces: currentCtx.pieces,
            kits: currentCtx.kits,
            kitPieces: currentCtx.kitPieces,
            storePieces: currentCtx.storePieces,
            capturedAt: new Date().toISOString(),
          }
        : null;
    return (snapAQuery.data?.snapshot_data as SnapshotData) || null;
  }, [effectiveA, currentCtx, snapAQuery.data]);

  const dataB: SnapshotData | null = useMemo(() => {
    if (!effectiveB) return null;
    if (effectiveB === CURRENT)
      return currentCtx
        ? {
            pieces: currentCtx.pieces,
            kits: currentCtx.kits,
            kitPieces: currentCtx.kitPieces,
            storePieces: currentCtx.storePieces,
            capturedAt: new Date().toISOString(),
          }
        : null;
    return (snapBQuery.data?.snapshot_data as SnapshotData) || null;
  }, [effectiveB, currentCtx, snapBQuery.data]);

  const labelFor = (id?: string) => {
    if (!id) return "";
    if (id === CURRENT) return "Estado Atual";
    return snapshots.find((s) => s.id === id)?.name || "Versão";
  };

  const compareLoading =
    (effectiveA !== CURRENT && snapAQuery.isLoading) ||
    (effectiveB !== CURRENT && snapBQuery.isLoading) ||
    (effectiveA === CURRENT || effectiveB === CURRENT ? loadingCtx : false);

  const piecesDiff = useMemo(() => diffItems(dataA?.pieces || [], dataB?.pieces || [], "piece"), [dataA, dataB]);
  const kitsDiff = useMemo(
    () => diffKits(dataA?.kits || [], dataB?.kits || [], dataA?.kitPieces || [], dataB?.kitPieces || []),
    [dataA, dataB],
  );
  const rateioDiff = useMemo(
    () =>
      diffStorePieces(
        dataA?.storePieces || [],
        dataB?.storePieces || [],
        dataA?.pieces || [],
        dataB?.pieces || [],
        dataA?.kits || [],
        dataB?.kits || [],
        currentCtx?.stores || [],
      ),
    [dataA, dataB, currentCtx?.stores],
  );

  const handleExport = async () => {
    if (!dataA || !dataB) return;
    try {
      await exportComparison({
        campaignName: campaignName || "Campanha",
        versionA: labelFor(effectiveA),
        versionB: labelFor(effectiveB),
        piecesDiff,
        kitsDiff,
        rateioDiff,
      });
    } catch (e: any) {
      toast.error("Erro ao exportar", { description: e?.message });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>Versões da campanha</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="versoes" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 grid grid-cols-2 w-auto">
            <TabsTrigger value="versoes">Versões</TabsTrigger>
            <TabsTrigger value="comparar">Comparar</TabsTrigger>
          </TabsList>

          {/* TAB 1 */}
          <TabsContent value="versoes" className="flex-1 overflow-y-auto px-6 pb-6 pt-3 space-y-3">
            {!showForm ? (
              <Button onClick={() => setShowForm(true)} className="w-full" variant="default">
                <Plus className="w-4 h-4 mr-2" /> Salvar versão atual
              </Button>
            ) : (
              <div className="border rounded-md p-3 space-y-2 bg-muted/30">
                <Input
                  placeholder="Ex: Antes do mockup"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={createMut.isPending}
                />
                <Textarea
                  placeholder="Notas sobre esta versão"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  disabled={createMut.isPending}
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={createMut.isPending}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={createMut.isPending}>
                    {createMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </div>
            )}

            {loadingList ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : snapshots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma versão salva. Salve uma versão antes de fazer modificações importantes.
              </p>
            ) : (
              snapshots.map((s) => (
                <div key={s.id} className="border rounded-md p-3 flex items-start gap-3">
                  <Camera className="w-4 h-4 mt-1 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(s.created_at)}
                      {s.authorName ? ` · ${s.authorName}` : ""}
                    </div>
                    {s.description && (
                      <div className="text-xs text-muted-foreground mt-1 break-words">{s.description}</div>
                    )}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir versão?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. A versão "{s.name}" será removida permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            try {
                              await deleteMut.mutateAsync(s.id);
                              toast.success("Versão excluída");
                            } catch (e: any) {
                              toast.error("Erro ao excluir", { description: e?.message });
                            }
                          }}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))
            )}
          </TabsContent>

          {/* TAB 2 */}
          <TabsContent value="comparar" className="flex-1 overflow-y-auto px-6 pb-6 pt-3 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Versão A</label>
                <Select value={effectiveA} onValueChange={(v) => setVersionA(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {snapshots.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={CURRENT}>Estado Atual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Versão B</label>
                <Select value={effectiveB} onValueChange={(v) => setVersionB(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {snapshots.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={CURRENT}>Estado Atual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {compareLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : !dataA || !dataB ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Selecione duas versões para comparar.
              </p>
            ) : (
              <>
                <DiffSection title="Peças" count={piecesDiff.length}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2">Nome</th>
                          <th className="text-left p-2">Código</th>
                          <th className="text-left p-2">Localização</th>
                          <th className="text-left p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {piecesDiff.map((d) => (
                          <tr key={d.key} className="border-t">
                            <td className="p-2">
                              {d.b?.name || d.a?.name || "—"}
                              {d.status === "modified" && d.changes?.length ? (
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  {d.changes.map((c, i) => (
                                    <div key={i}>
                                      <strong>{c.field}:</strong> {String(c.before ?? "—")} → {String(c.after ?? "—")}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </td>
                            <td className="p-2">{d.b?.code || d.a?.code || "—"}</td>
                            <td className="p-2">{d.b?.category || d.a?.category || "—"}</td>
                            <td className="p-2"><StatusBadge s={d.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DiffSection>

                <DiffSection title="Kits" count={kitsDiff.length}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2">Nome</th>
                          <th className="text-left p-2">Código</th>
                          <th className="text-left p-2">Composição</th>
                          <th className="text-left p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kitsDiff.map((d) => (
                          <tr key={d.key} className="border-t">
                            <td className="p-2">
                              {d.b?.name || d.a?.name || "—"}
                              {d.status === "modified" && d.changes?.length ? (
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  {d.changes.map((c, i) => (
                                    <div key={i}>
                                      <strong>{c.field}:</strong> {String(c.before ?? "—")} → {String(c.after ?? "—")}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </td>
                            <td className="p-2">{d.b?.code || d.a?.code || "—"}</td>
                            <td className="p-2">{d.b?.pieceCount ?? d.a?.pieceCount ?? 0} peças</td>
                            <td className="p-2"><StatusBadge s={d.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DiffSection>

                <DiffSection
                  title="Rateio"
                  count={rateioDiff.stores.length}
                  summary={`${rateioDiff.stores.length} lojas com alterações de ${rateioDiff.totalChangedItems} total`}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2">Loja</th>
                          <th className="text-right p-2">Peças alteradas</th>
                          <th className="text-right p-2">Qtd antes</th>
                          <th className="text-right p-2">Qtd depois</th>
                          <th className="text-right p-2">Diferença</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rateioDiff.stores.map((s) => <RateioStoreRow key={s.storeId} row={s} />)}
                      </tbody>
                    </table>
                  </div>
                </DiffSection>

                <Button onClick={handleExport} variant="outline" className="w-full">
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar comparação
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function DiffSection({
  title,
  count,
  summary,
  children,
}: {
  title: string;
  count: number;
  summary?: string;
  children: React.ReactNode;
}) {
  const [openState, setOpenState] = useState(true);
  return (
    <Collapsible open={openState} onOpenChange={setOpenState} className="border rounded-md">
      <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50">
        <div className="flex items-center gap-2">
          {openState ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="font-semibold text-sm">{title}</span>
          <Badge variant="secondary" className="text-[10px]">{count}</Badge>
        </div>
        {summary && <span className="text-xs text-muted-foreground">{summary}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function RateioStoreRow({ row }: { row: RateioStoreDiff }) {
  const [exp, setExp] = useState(false);
  const diff = row.totalAfter - row.totalBefore;
  const diffColor = diff > 0 ? "text-green-700" : diff < 0 ? "text-red-700" : "text-muted-foreground";
  return (
    <>
      <tr className="border-t cursor-pointer hover:bg-muted/40" onClick={() => setExp(!exp)}>
        <td className="p-2 flex items-center gap-1">
          {exp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {row.storeName}
        </td>
        <td className="p-2 text-right">{row.changedItems}</td>
        <td className="p-2 text-right">{row.totalBefore}</td>
        <td className="p-2 text-right">{row.totalAfter}</td>
        <td className={`p-2 text-right font-semibold ${diffColor}`}>{diff > 0 ? `+${diff}` : diff}</td>
      </tr>
      {exp &&
        row.items.map((it, i) => {
          const idiff = it.after - it.before;
          const ic = idiff > 0 ? "text-green-700" : idiff < 0 ? "text-red-700" : "text-muted-foreground";
          return (
            <tr key={i} className="border-t bg-muted/20">
              <td className="p-2 pl-7 text-muted-foreground">{it.name}</td>
              <td className="p-2"></td>
              <td className="p-2 text-right">{it.before}</td>
              <td className="p-2 text-right">{it.after}</td>
              <td className={`p-2 text-right ${ic}`}>{idiff > 0 ? `+${idiff}` : idiff}</td>
            </tr>
          );
        })}
    </>
  );
}

// ===================== Diff helpers =====================

interface ItemDiff<T> {
  key: string;
  status: DiffStatus;
  a?: T;
  b?: T;
  changes?: { field: string; before: any; after: any }[];
}

function keyOf(item: PieceLike | KitLike) {
  return item.code?.trim() || item.id;
}

function diffItems(a: PieceLike[], b: PieceLike[], _kind: "piece"): ItemDiff<PieceLike>[] {
  const mapA = new Map(a.map((i) => [keyOf(i), i]));
  const mapB = new Map(b.map((i) => [keyOf(i), i]));
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
  const out: ItemDiff<PieceLike>[] = [];
  for (const k of allKeys) {
    const ia = mapA.get(k);
    const ib = mapB.get(k);
    if (ia && !ib) out.push({ key: k, status: "removed", a: ia });
    else if (!ia && ib) out.push({ key: k, status: "added", b: ib });
    else if (ia && ib) {
      const changes: { field: string; before: any; after: any }[] = [];
      for (const f of ["name", "code", "category", "specification"] as const) {
        if ((ia as any)[f] !== (ib as any)[f]) changes.push({ field: f, before: (ia as any)[f], after: (ib as any)[f] });
      }
      out.push({ key: k, status: changes.length ? "modified" : "equal", a: ia, b: ib, changes });
    }
  }
  return out.sort((x, y) => statusOrder(x.status) - statusOrder(y.status));
}

interface KitWithCount extends KitLike { pieceCount: number }

function diffKits(a: KitLike[], b: KitLike[], kpA: any[], kpB: any[]): ItemDiff<KitWithCount>[] {
  const countA = new Map<string, number>();
  for (const r of kpA) countA.set(r.kit_id, (countA.get(r.kit_id) || 0) + 1);
  const countB = new Map<string, number>();
  for (const r of kpB) countB.set(r.kit_id, (countB.get(r.kit_id) || 0) + 1);
  const enrichA: KitWithCount[] = a.map((k) => ({ ...k, pieceCount: countA.get(k.id) || 0 }));
  const enrichB: KitWithCount[] = b.map((k) => ({ ...k, pieceCount: countB.get(k.id) || 0 }));

  const mapA = new Map(enrichA.map((i) => [keyOf(i), i]));
  const mapB = new Map(enrichB.map((i) => [keyOf(i), i]));
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
  const out: ItemDiff<KitWithCount>[] = [];
  for (const k of allKeys) {
    const ia = mapA.get(k);
    const ib = mapB.get(k);
    if (ia && !ib) out.push({ key: k, status: "removed", a: ia });
    else if (!ia && ib) out.push({ key: k, status: "added", b: ib });
    else if (ia && ib) {
      const changes: { field: string; before: any; after: any }[] = [];
      if (ia.name !== ib.name) changes.push({ field: "name", before: ia.name, after: ib.name });
      if (ia.code !== ib.code) changes.push({ field: "code", before: ia.code, after: ib.code });
      if (ia.pieceCount !== ib.pieceCount)
        changes.push({ field: "pieceCount", before: ia.pieceCount, after: ib.pieceCount });
      out.push({ key: k, status: changes.length ? "modified" : "equal", a: ia, b: ib, changes });
    }
  }
  return out.sort((x, y) => statusOrder(x.status) - statusOrder(y.status));
}

interface RateioItem {
  name: string;
  before: number;
  after: number;
}

interface RateioStoreDiff {
  storeId: string;
  storeName: string;
  changedItems: number;
  totalBefore: number;
  totalAfter: number;
  items: RateioItem[];
}

interface RateioDiff {
  stores: RateioStoreDiff[];
  totalChangedItems: number;
}

function diffStorePieces(
  a: StorePiece[],
  b: StorePiece[],
  piecesA: PieceLike[],
  piecesB: PieceLike[],
  kitsA: KitLike[],
  kitsB: KitLike[],
  stores: { id: string; name?: string | null }[],
): RateioDiff {
  const nameMap = new Map<string, string>();
  for (const p of piecesA) nameMap.set(`p:${p.id}`, p.name || p.code || "Peça");
  for (const p of piecesB) nameMap.set(`p:${p.id}`, p.name || p.code || "Peça");
  for (const k of kitsA) nameMap.set(`k:${k.id}`, `Kit: ${k.name || k.code || ""}`);
  for (const k of kitsB) nameMap.set(`k:${k.id}`, `Kit: ${k.name || k.code || ""}`);

  const storeNameMap = new Map(stores.map((s) => [s.id, s.name || "Loja"]));

  const itemKey = (sp: StorePiece) => (sp.kit_id ? `k:${sp.kit_id}` : `p:${sp.piece_id}`);

  const byStore = new Map<string, Map<string, { before: number; after: number }>>();
  for (const sp of a) {
    if (!byStore.has(sp.store_id)) byStore.set(sp.store_id, new Map());
    const m = byStore.get(sp.store_id)!;
    const k = itemKey(sp);
    if (!m.has(k)) m.set(k, { before: 0, after: 0 });
    m.get(k)!.before += sp.quantity || 0;
  }
  for (const sp of b) {
    if (!byStore.has(sp.store_id)) byStore.set(sp.store_id, new Map());
    const m = byStore.get(sp.store_id)!;
    const k = itemKey(sp);
    if (!m.has(k)) m.set(k, { before: 0, after: 0 });
    m.get(k)!.after += sp.quantity || 0;
  }

  const stores2: RateioStoreDiff[] = [];
  let totalChangedItems = 0;
  for (const [storeId, m] of byStore) {
    const items: RateioItem[] = [];
    let totalBefore = 0, totalAfter = 0, changedItems = 0;
    for (const [k, v] of m) {
      totalBefore += v.before;
      totalAfter += v.after;
      if (v.before !== v.after) {
        changedItems++;
        items.push({ name: nameMap.get(k) || k, before: v.before, after: v.after });
      }
    }
    if (changedItems === 0) continue;
    items.sort((x, y) => x.name.localeCompare(y.name));
    stores2.push({
      storeId,
      storeName: storeNameMap.get(storeId) || "Loja",
      changedItems,
      totalBefore,
      totalAfter,
      items,
    });
    totalChangedItems += changedItems;
  }
  stores2.sort((x, y) => x.storeName.localeCompare(y.storeName));
  return { stores: stores2, totalChangedItems };
}

// ===================== Excel export =====================

const COLORS = {
  added: "FFDBEAFE",     // light blue
  removed: "FFFEE2E2",   // light red
  modified: "FFFEF3C7",  // light amber
  header: "FFE5E7EB",
};

async function exportComparison(args: {
  campaignName: string;
  versionA: string;
  versionB: string;
  piecesDiff: ItemDiff<PieceLike>[];
  kitsDiff: ItemDiff<KitWithCount>[];
  rateioDiff: RateioDiff;
}) {
  const wb = new ExcelJS.Workbook();

  const colorFor = (s: DiffStatus) =>
    s === "added" ? COLORS.added : s === "removed" ? COLORS.removed : s === "modified" ? COLORS.modified : undefined;

  const addHeader = (ws: ExcelJS.Worksheet, columns: number) => {
    ws.addRow([`Campanha: ${args.campaignName}`]);
    ws.addRow([`Comparação: ${args.versionA} × ${args.versionB}`]);
    ws.addRow([`Gerado em: ${new Date().toLocaleString("pt-BR")}`]);
    ws.addRow([]);
    for (let i = 1; i <= 3; i++) {
      ws.mergeCells(i, 1, i, columns);
      ws.getCell(i, 1).font = { bold: true };
    }
  };

  // Peças
  const wsP = wb.addWorksheet("Peças");
  addHeader(wsP, 5);
  const pHeader = wsP.addRow(["Nome", "Código", "Localização", "Status", "Mudanças"]);
  pHeader.eachCell((c) => {
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.header } };
  });
  for (const d of args.piecesDiff) {
    const row = wsP.addRow([
      d.b?.name || d.a?.name || "",
      d.b?.code || d.a?.code || "",
      d.b?.category || d.a?.category || "",
      statusLabel(d.status),
      (d.changes || []).map((c) => `${c.field}: ${c.before ?? "—"} → ${c.after ?? "—"}`).join("; "),
    ]);
    const fill = colorFor(d.status);
    if (fill) row.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } }));
  }
  wsP.columns.forEach((c) => (c.width = 22));

  // Kits
  const wsK = wb.addWorksheet("Kits");
  addHeader(wsK, 5);
  const kHeader = wsK.addRow(["Nome", "Código", "Composição", "Status", "Mudanças"]);
  kHeader.eachCell((c) => {
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.header } };
  });
  for (const d of args.kitsDiff) {
    const row = wsK.addRow([
      d.b?.name || d.a?.name || "",
      d.b?.code || d.a?.code || "",
      `${d.b?.pieceCount ?? d.a?.pieceCount ?? 0} peças`,
      statusLabel(d.status),
      (d.changes || []).map((c) => `${c.field}: ${c.before ?? "—"} → ${c.after ?? "—"}`).join("; "),
    ]);
    const fill = colorFor(d.status);
    if (fill) row.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } }));
  }
  wsK.columns.forEach((c) => (c.width = 22));

  // Rateio
  const wsR = wb.addWorksheet("Rateio");
  addHeader(wsR, 6);
  wsR.addRow([`Resumo: ${args.rateioDiff.stores.length} lojas alteradas, ${args.rateioDiff.totalChangedItems} itens`]);
  wsR.addRow([]);
  const rHeader = wsR.addRow(["Loja", "Item", "Qtd antes", "Qtd depois", "Diferença", "Tipo"]);
  rHeader.eachCell((c) => {
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.header } };
  });
  for (const s of args.rateioDiff.stores) {
    for (const it of s.items) {
      const diff = it.after - it.before;
      const status: DiffStatus =
        it.before === 0 && it.after > 0 ? "added" : it.after === 0 && it.before > 0 ? "removed" : "modified";
      const row = wsR.addRow([s.storeName, it.name, it.before, it.after, diff, statusLabel(status)]);
      const fill = colorFor(status);
      if (fill) row.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } }));
    }
  }
  wsR.columns.forEach((c) => (c.width = 22));

  const buf = await wb.xlsx.writeBuffer();
  const filename = `${args.campaignName} — Comparação ${args.versionA} × ${args.versionB}.xlsx`;
  await saveXlsxAs(buf as ArrayBuffer, filename);
}

function statusLabel(s: DiffStatus) {
  return s === "equal" ? "Igual" : s === "modified" ? "Modificado" : s === "added" ? "Adicionado" : "Removido";
}
