import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  RadioGroup, RadioGroupItem,
} from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Database, Loader2, Plus, Trash2, RotateCcw, ChevronDown, ChevronRight, Download, Upload,
} from "lucide-react";
import { saveBlobAs } from "@/lib/saveBlobAs";
import { toast } from "sonner";
import { applyRateioBulk } from "@/lib/applyRateioBulk";
import type { CampaignPiece, CampaignKit, ClientStore } from "@/hooks/useMultiClientData";

interface KitPiece { kit_id: string; piece_id: string; quantity: number }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
  campaignName: string;
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: KitPiece[];
  stores: ClientStore[];
  qtyMap: Record<string, number>; // `${storeId}-${pieceId}` → qty
  isNegotiationView: boolean;
  negotiationSupplierId?: string | null;
  isAdjustmentView?: boolean;
  adjustmentId?: string | null;
}

interface BackupRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
  authorName?: string;
}

interface SnapshotStorePiece {
  store_id: string;
  piece_id: string;
  quantity: number;
}

interface RateioSnapshotData {
  storePieces: SnapshotStorePiece[];
  capturedAt: string;
  isNegotiation?: boolean;
  supplierId?: string | null;
}

const CURRENT = "__current__";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

function defaultName() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `Backup ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function RateioBackupSheet({
  open, onOpenChange, campaignId, campaignName,
  pieces, kits, kitPieces, stores, qtyMap,
  isNegotiationView, negotiationSupplierId,
}: Props) {
  const qc = useQueryClient();

  // -------- Backups list --------
  const { data: backups = [], isLoading: loadingList } = useQuery({
    queryKey: ["rateio_backups", campaignId],
    enabled: !!campaignId && open,
    queryFn: async (): Promise<BackupRow[]> => {
      const { data, error } = await supabase
        .from("campaign_snapshots")
        .select("id, name, description, created_at, created_by")
        .eq("campaign_id", campaignId)
        .eq("kind" as never, "rateio_backup" as never)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (data || []) as BackupRow[];
      const userIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean) as string[])];
      const map: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, nickname")
          .in("user_id", userIds);
        for (const p of (profs || []) as any[]) {
          map[p.user_id] = p.nickname || p.display_name || "Usuário";
        }
      }
      return rows.map((r) => ({ ...r, authorName: r.created_by ? map[r.created_by] || "Usuário" : "Sistema" }));
    },
  });

  // -------- Save backup --------
  const [backupName, setBackupName] = useState<string>(defaultName());
  const [backupDescription, setBackupDescription] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const currentSnapshot = useMemo<RateioSnapshotData>(() => {
    const sp: SnapshotStorePiece[] = [];
    for (const store of stores) {
      for (const p of pieces) {
        const qty = qtyMap[`${store.id}-${p.id}`] || 0;
        if (qty > 0) sp.push({ store_id: store.id, piece_id: p.id, quantity: qty });
      }
    }
    return {
      storePieces: sp,
      capturedAt: new Date().toISOString(),
      isNegotiation: isNegotiationView,
      supplierId: negotiationSupplierId || null,
    };
  }, [stores, pieces, qtyMap, isNegotiationView, negotiationSupplierId]);

  const handleSave = async () => {
    const name = backupName.trim() || defaultName();
    setIsSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("campaign_snapshots").insert({
        campaign_id: campaignId,
        name,
        description: backupDescription.trim() || null,
        snapshot_data: currentSnapshot as any,
        created_by: userRes?.user?.id ?? null,
        kind: "rateio_backup",
      } as any);
      if (error) throw error;
      toast.success("Backup do rateio salvo");
      setBackupName(defaultName());
      setBackupDescription("");
      qc.invalidateQueries({ queryKey: ["rateio_backups", campaignId] });
    } catch (e: any) {
      toast.error("Erro ao salvar backup", { description: e?.message });
    } finally {
      setIsSaving(false);
    }
  };

  // -------- Delete backup --------
  const [deleteTarget, setDeleteTarget] = useState<BackupRow | null>(null);
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from("campaign_snapshots").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Backup excluído");
      qc.invalidateQueries({ queryKey: ["rateio_backups", campaignId] });
    } catch (e: any) {
      toast.error("Erro ao excluir", { description: e?.message });
    } finally {
      setDeleteTarget(null);
    }
  };

  // -------- Download backup as JSON file --------
  const slugify = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "backup";

  const handleDownload = async (b: BackupRow) => {
    try {
      const { data, error } = await supabase
        .from("campaign_snapshots")
        .select("name, description, created_at, snapshot_data")
        .eq("id", b.id)
        .single();
      if (error) throw error;
      const payload = {
        format: "rateio_backup",
        version: 1,
        campaignName,
        exportedAt: new Date().toISOString(),
        backup: {
          name: (data as any).name,
          description: (data as any).description,
          created_at: (data as any).created_at,
          snapshot_data: (data as any).snapshot_data,
        },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const date = new Date(b.created_at).toISOString().slice(0, 10);
      const fname = `rateio-backup-${slugify(campaignName)}-${slugify(b.name)}-${date}.json`;
      await saveBlobAs(blob, fname, {
        mimeType: "application/json",
        description: "Backup do rateio (.json)",
        extension: ".json",
      });
    } catch (e: any) {
      toast.error("Erro ao baixar backup", { description: e?.message });
    }
  };

  // -------- Import backup from JSON file --------
  const fileRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const backup = parsed?.backup;
      const snap = backup?.snapshot_data;
      if (!snap || !Array.isArray(snap.storePieces)) {
        throw new Error("Arquivo inválido: snapshot_data.storePieces ausente");
      }
      const { data: userRes } = await supabase.auth.getUser();
      const importedName = backup?.name ? `${backup.name} (importado)` : `Importado ${defaultName()}`;
      const { error } = await supabase.from("campaign_snapshots").insert({
        campaign_id: campaignId,
        name: importedName,
        description: backup?.description || `Importado de arquivo em ${new Date().toLocaleString("pt-BR")}`,
        snapshot_data: snap,
        created_by: userRes?.user?.id ?? null,
        kind: "rateio_backup",
      } as any);
      if (error) throw error;
      toast.success("Backup importado");
      qc.invalidateQueries({ queryKey: ["rateio_backups", campaignId] });
    } catch (err: any) {
      toast.error("Erro ao importar", { description: err?.message });
    } finally {
      setIsImporting(false);
    }
  };
  const [restoreTarget, setRestoreTarget] = useState<BackupRow | null>(null);
  const [restoreMode, setRestoreMode] = useState<"full" | "diff_only">("full");
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setIsRestoring(true);
    try {
      const { data, error } = await supabase
        .from("campaign_snapshots")
        .select("snapshot_data")
        .eq("id", restoreTarget.id)
        .single();
      if (error) throw error;
      const snap = ((data as any)?.snapshot_data || {}) as RateioSnapshotData;
      // Map keyed by `${store_id}|${piece_id}` — UUIDs contain "-", so we MUST
      // use a separator that never appears inside a UUID.
      const snapMap = new Map<string, { storeId: string; pieceId: string; qty: number }>();
      for (const sp of snap.storePieces || []) {
        if (!sp?.store_id || !sp?.piece_id) continue;
        snapMap.set(`${sp.store_id}|${sp.piece_id}`, {
          storeId: sp.store_id,
          pieceId: sp.piece_id,
          qty: Number(sp.quantity) || 0,
        });
      }

      // Build a parallel map of the current state keyed the same way, by
      // re-deriving (storeId, pieceId) from the existing qtyMap whose keys
      // are `${storeId}-${pieceId}` — but instead of splitting on "-" (which
      // breaks UUIDs), we reconstruct via the known `stores` and `pieces`.
      const currentMap = new Map<string, { storeId: string; pieceId: string; qty: number }>();
      for (const store of stores) {
        for (const p of pieces) {
          const qty = qtyMap[`${store.id}-${p.id}`] || 0;
          if (qty > 0) {
            currentMap.set(`${store.id}|${p.id}`, { storeId: store.id, pieceId: p.id, qty });
          }
        }
      }

      const upserts: { campaignId: string; storeId: string; pieceId: string; quantity: number }[] = [];
      const deletes: { campaignId: string; storeId: string; pieceId: string }[] = [];

      if (restoreMode === "full") {
        for (const { storeId, pieceId, qty } of snapMap.values()) {
          upserts.push({ campaignId, storeId, pieceId, quantity: qty });
        }
        for (const [key, { storeId, pieceId }] of currentMap) {
          if (!snapMap.has(key)) {
            deletes.push({ campaignId, storeId, pieceId });
          }
        }
      } else {
        // diff_only: only touch cells where snapshot differs from current.
        for (const [key, { storeId, pieceId, qty }] of snapMap) {
          const cur = currentMap.get(key)?.qty || 0;
          if (cur !== qty) {
            upserts.push({ campaignId, storeId, pieceId, quantity: qty });
          }
        }
        for (const [key, { storeId, pieceId }] of currentMap) {
          if (!snapMap.has(key)) {
            deletes.push({ campaignId, storeId, pieceId });
          }
        }
      }

      await applyRateioBulk(upserts, deletes, {
        isNegotiationView,
        negotiationSupplierId: negotiationSupplierId || null,
      });

      toast.success(`Rateio restaurado (${upserts.length} atualizações, ${deletes.length} remoções)`);
      qc.invalidateQueries({ queryKey: ["campaign_store_pieces", campaignId] });
      if (negotiationSupplierId) {
        qc.invalidateQueries({ queryKey: ["negotiation_store_pieces", negotiationSupplierId] });
      }
      setRestoreTarget(null);
    } catch (e: any) {
      toast.error("Erro ao restaurar", { description: e?.message });
    } finally {
      setIsRestoring(false);
    }
  };

  // -------- Compare --------
  const [compareA, setCompareA] = useState<string>(CURRENT);
  const [compareB, setCompareB] = useState<string>("");

  const snapAQuery = useQuery({
    queryKey: ["rateio_backup_detail", compareA],
    enabled: open && !!compareA && compareA !== CURRENT,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_snapshots").select("snapshot_data").eq("id", compareA).single();
      if (error) throw error;
      return (data as any)?.snapshot_data as RateioSnapshotData;
    },
  });
  const snapBQuery = useQuery({
    queryKey: ["rateio_backup_detail", compareB],
    enabled: open && !!compareB && compareB !== CURRENT,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_snapshots").select("snapshot_data").eq("id", compareB).single();
      if (error) throw error;
      return (data as any)?.snapshot_data as RateioSnapshotData;
    },
  });

  const dataA = compareA === CURRENT ? currentSnapshot : snapAQuery.data;
  const dataB = compareB === CURRENT ? currentSnapshot : snapBQuery.data;

  const labelFor = (id: string) => {
    if (id === CURRENT) return "Estado Atual";
    return backups.find((b) => b.id === id)?.name || "—";
  };

  const diff = useMemo(() => {
    if (!dataA || !dataB) return null;
    return diffStorePieces(dataA.storePieces, dataB.storePieces, pieces, kits, stores);
  }, [dataA, dataB, pieces, kits, stores]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" /> Backup do Rateio
          </SheetTitle>
          <SheetDescription>
            Salve, restaure e compare versões do rateio de <strong>{campaignName}</strong>.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="backups" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 grid grid-cols-2 w-auto">
            <TabsTrigger value="backups">Backups</TabsTrigger>
            <TabsTrigger value="comparar">Comparar</TabsTrigger>
          </TabsList>

          {/* TAB 1 */}
          <TabsContent value="backups" className="flex-1 overflow-y-auto px-6 pb-6 pt-3 space-y-3">
            <div className="border rounded-md p-3 space-y-2 bg-muted/30">
              <div className="text-xs font-medium text-muted-foreground">Salvar backup do estado atual</div>
              <Input
                placeholder="Nome do backup"
                value={backupName}
                onChange={(e) => setBackupName(e.target.value)}
                disabled={isSaving}
              />
              <Textarea
                placeholder="Descrição (opcional)"
                value={backupDescription}
                onChange={(e) => setBackupDescription(e.target.value)}
                rows={2}
                disabled={isSaving}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {currentSnapshot.storePieces.length} célula(s) com quantidade
                </span>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    disabled={isImporting || isSaving}
                  >
                    {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Importar arquivo
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Salvar backup
                  </Button>
                </div>
              </div>
            </div>

            {loadingList ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" /> <Skeleton className="h-16 w-full" />
              </div>
            ) : backups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum backup ainda. Salve um antes de fazer alterações importantes.
              </p>
            ) : (
              backups.map((b) => (
                <div key={b.id} className="border rounded-md p-3 flex items-start gap-3">
                  <Database className="w-4 h-4 mt-1 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{b.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(b.created_at)}{b.authorName ? ` · ${b.authorName}` : ""}
                    </div>
                    {b.description && (
                      <div className="text-xs text-muted-foreground mt-1 break-words">{b.description}</div>
                    )}
                  </div>
                  <Button
                    size="sm" variant="outline" className="h-7 gap-1"
                    onClick={() => handleDownload(b)}
                    title="Baixar arquivo .json"
                  >
                    <Download className="w-3.5 h-3.5" /> Baixar
                  </Button>
                  <Button
                    size="sm" variant="outline" className="h-7 gap-1"
                    onClick={() => { setRestoreMode("full"); setRestoreTarget(b); }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => setDeleteTarget(b)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          {/* TAB 2 */}
          <TabsContent value="comparar" className="flex-1 overflow-y-auto px-6 pb-6 pt-3 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Versão A</Label>
                <Select value={compareA} onValueChange={setCompareA}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CURRENT}>Estado Atual</SelectItem>
                    {backups.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Versão B</Label>
                <Select value={compareB} onValueChange={setCompareB}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CURRENT}>Estado Atual</SelectItem>
                    {backups.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!compareB ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Selecione duas versões para comparar.
              </p>
            ) : (snapAQuery.isLoading || snapBQuery.isLoading) ? (
              <Skeleton className="h-32 w-full" />
            ) : !diff ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem dados para comparar.</p>
            ) : diff.stores.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6 border rounded-md">
                As duas versões são idênticas ✅
              </div>
            ) : (
              <div className="border rounded-md">
                <div className="px-3 py-2 border-b bg-muted/40 text-sm font-medium flex items-center justify-between">
                  <span>Diferenças: {labelFor(compareA)} → {labelFor(compareB)}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {diff.stores.length} lojas · {diff.totalChangedItems} itens
                  </Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="text-left p-2">Loja</th>
                        <th className="text-right p-2">Itens alterados</th>
                        <th className="text-right p-2">Total A</th>
                        <th className="text-right p-2">Total B</th>
                        <th className="text-right p-2">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diff.stores.map((s) => <DiffStoreRow key={s.storeId} row={s} />)}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Delete confirm */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir backup?</AlertDialogTitle>
              <AlertDialogDescription>
                "{deleteTarget?.name}" será removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Restore confirm */}
        <AlertDialog open={!!restoreTarget} onOpenChange={(v) => !v && !isRestoring && setRestoreTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restaurar rateio</AlertDialogTitle>
              <AlertDialogDescription>
                Substituir o rateio atual pelo backup <strong>"{restoreTarget?.name}"</strong>.
                {isNegotiationView && " A operação será aplicada ao rateio da negociação."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <RadioGroup value={restoreMode} onValueChange={(v) => setRestoreMode(v as any)} className="space-y-2 py-2">
              <div className="flex items-start gap-2">
                <RadioGroupItem value="full" id="m-full" className="mt-0.5" />
                <Label htmlFor="m-full" className="font-normal cursor-pointer">
                  <div className="font-medium">Restauração completa</div>
                  <div className="text-xs text-muted-foreground">
                    Apaga células atuais ausentes no backup e aplica todas as quantidades do backup.
                  </div>
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="diff_only" id="m-diff" className="mt-0.5" />
                <Label htmlFor="m-diff" className="font-normal cursor-pointer">
                  <div className="font-medium">Apenas diferenças</div>
                  <div className="text-xs text-muted-foreground">
                    Atualiza somente as células onde o backup difere do atual.
                  </div>
                </Label>
              </div>
            </RadioGroup>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRestoring}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleRestore} disabled={isRestoring}>
                {isRestoring && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Restaurar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

// ===================== Diff helpers =====================

interface DiffItem { name: string; before: number; after: number }
interface DiffStore {
  storeId: string;
  storeName: string;
  changedItems: number;
  totalBefore: number;
  totalAfter: number;
  items: DiffItem[];
}

function diffStorePieces(
  a: SnapshotStorePiece[],
  b: SnapshotStorePiece[],
  pieces: CampaignPiece[],
  _kits: CampaignKit[],
  stores: ClientStore[],
): { stores: DiffStore[]; totalChangedItems: number } {
  const pieceName = new Map<string, string>();
  for (const p of pieces) pieceName.set(p.id, p.name || (p.code != null ? String(p.code) : "Peça"));
  const storeName = new Map<string, string>();
  for (const s of stores) storeName.set(s.id, s.name || "Loja");

  const byStore = new Map<string, Map<string, { before: number; after: number }>>();
  const ensure = (sid: string, pid: string) => {
    if (!byStore.has(sid)) byStore.set(sid, new Map());
    const m = byStore.get(sid)!;
    if (!m.has(pid)) m.set(pid, { before: 0, after: 0 });
    return m.get(pid)!;
  };
  for (const sp of a || []) ensure(sp.store_id, sp.piece_id).before += sp.quantity || 0;
  for (const sp of b || []) ensure(sp.store_id, sp.piece_id).after += sp.quantity || 0;

  const out: DiffStore[] = [];
  let totalChanged = 0;
  for (const [sid, m] of byStore) {
    const items: DiffItem[] = [];
    let tb = 0, ta = 0, ci = 0;
    for (const [pid, v] of m) {
      tb += v.before; ta += v.after;
      if (v.before !== v.after) {
        ci++;
        items.push({ name: pieceName.get(pid) || "Peça", before: v.before, after: v.after });
      }
    }
    if (ci === 0) continue;
    items.sort((x, y) => x.name.localeCompare(y.name));
    out.push({
      storeId: sid, storeName: storeName.get(sid) || "Loja",
      changedItems: ci, totalBefore: tb, totalAfter: ta, items,
    });
    totalChanged += ci;
  }
  out.sort((x, y) => x.storeName.localeCompare(y.storeName));
  return { stores: out, totalChangedItems: totalChanged };
}

function DiffStoreRow({ row }: { row: DiffStore }) {
  const [exp, setExp] = useState(false);
  const d = row.totalAfter - row.totalBefore;
  const dc = d > 0 ? "text-green-700" : d < 0 ? "text-red-700" : "text-muted-foreground";
  return (
    <Collapsible open={exp} onOpenChange={setExp} asChild>
      <>
        <tr className="border-t cursor-pointer hover:bg-muted/40">
          <td className="p-2">
            <CollapsibleTrigger className="flex items-center gap-1 w-full text-left">
              {exp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {row.storeName}
            </CollapsibleTrigger>
          </td>
          <td className="p-2 text-right">{row.changedItems}</td>
          <td className="p-2 text-right">{row.totalBefore}</td>
          <td className="p-2 text-right">{row.totalAfter}</td>
          <td className={`p-2 text-right font-semibold ${dc}`}>{d > 0 ? `+${d}` : d}</td>
        </tr>
        {exp && row.items.map((it, i) => {
          const id = it.after - it.before;
          const ic = id > 0 ? "text-green-700" : id < 0 ? "text-red-700" : "text-muted-foreground";
          return (
            <tr key={i} className="border-t bg-muted/20">
              <td className="p-2 pl-7 text-muted-foreground">{it.name}</td>
              <td className="p-2"></td>
              <td className="p-2 text-right">{it.before}</td>
              <td className="p-2 text-right">{it.after}</td>
              <td className={`p-2 text-right ${ic}`}>{id > 0 ? `+${id}` : id}</td>
            </tr>
          );
        })}
      </>
    </Collapsible>
  );
}
