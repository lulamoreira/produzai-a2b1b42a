import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Trash2, Undo2, Plus, FileSpreadsheet, X, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { saveBlobAs } from "@/lib/saveBlobAs";
import { useHistory } from "@/lib/undo/useHistory";
import { historyStore } from "@/lib/undo/historyStore";
import { UndoRedoToolbar } from "@/components/UndoRedoToolbar";
import {
  useAdjustmentPieces,
  useAdjustmentKits,
  useAdjustmentStorePieces,
  useUpdateAdjustmentPiece,
  useAddAdjustmentPiece,
  useRestoreAdjustmentPiece,
  useUpdateAdjustmentKit,
  useRestoreAdjustmentKit,
  type CampaignAdjustment,
} from "@/hooks/useAdjustments";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  adjustment: CampaignAdjustment;
  campaignId: string;
  campaignName: string;
}

const PIECE_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "Nome" },
  { key: "specification", label: "Especificação" },
  { key: "size", label: "Tamanho" },
  { key: "category", label: "Categoria" },
  { key: "sub_location", label: "Sub-localização" },
];

function ChangeBadge({ type }: { type: string }) {
  if (type === "modified") return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Modificado</Badge>;
  if (type === "added") return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Nova</Badge>;
  if (type === "removed") return <Badge className="bg-destructive text-destructive-foreground">Removida</Badge>;
  return null;
}

export default function AdjustmentDetailSheet({
  open, onOpenChange, adjustment, campaignId, campaignName,
}: Props) {
  const readOnly = adjustment.status !== "draft";
  const { data: pieces = [], isLoading: piecesLoading } = useAdjustmentPieces(adjustment.id);
  const { data: kits = [], isLoading: kitsLoading } = useAdjustmentKits(adjustment.id);
  const { data: adjStorePieces = [] } = useAdjustmentStorePieces(adjustment.id);

  // Original campaign store_pieces for rateio comparison
  const { data: origStorePieces = [] } = useQuery({
    queryKey: ["campaign_store_pieces_for_compare", campaignId],
    enabled: open,
    queryFn: async () => {
      return supabasePaginate<any>((from, to) =>
        (supabase.from("store_pieces") as any).select("piece_id, store_id, quantity").eq("campaign_id", campaignId).range(from, to)
      );
    },
  });

  const updatePiece = useUpdateAdjustmentPiece();
  const addPiece = useAddAdjustmentPiece();
  const restorePiece = useRestoreAdjustmentPiece();
  const updateKit = useUpdateAdjustmentKit();
  const restoreKit = useRestoreAdjustmentKit();

  // ─── Undo/Redo (adjustment piece field edits) ───
  const undoScope = `adjustment-sheet:${adjustment.id}`;
  const { canUndo, canRedo, undo, redo, run: runHistoryCommand, undoLabel, redoLabel, undoCount, redoCount } = useHistory(undoScope);
  useEffect(() => {
    return () => historyStore.clearScope(undoScope);
  }, [undoScope]);

  const [filter, setFilter] = useState<"all" | "modified" | "added" | "removed">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editingKitId, setEditingKitId] = useState<string | null>(null);
  const [kitNameDraft, setKitNameDraft] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newPiece, setNewPiece] = useState({ code: "", name: "", specification: "", size: "", category: "", sub_location: "" });

  const filteredPieces = useMemo(() => {
    let arr = pieces;
    if (filter !== "all") arr = arr.filter((p: any) => p.change_type === filter);
    return arr;
  }, [pieces, filter]);

  const counts = useMemo(() => {
    const c = { modified: 0, added: 0, removed: 0, kitsChanged: 0 };
    pieces.forEach((p: any) => {
      if (p.change_type === "modified") c.modified++;
      else if (p.change_type === "added") c.added++;
      else if (p.change_type === "removed") c.removed++;
    });
    kits.forEach((k: any) => {
      if (k.change_type === "modified" || k.change_type === "removed" || k.change_type === "added") c.kitsChanged++;
    });
    return c;
  }, [pieces, kits]);

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name || "",
      specification: p.specification || "",
      size: p.size || "",
      category: p.category || "",
      sub_location: p.sub_location || "",
    });
  };

  const handleSaveEdit = async (p: any) => {
    // Snapshot prev field values for undo
    const prevChanges: Record<string, any> = {};
    for (const k of Object.keys(editForm)) {
      prevChanges[k] = (p as any)[k] ?? "";
    }
    // Skip if nothing actually changed
    const hasDiff = Object.keys(editForm).some((k) => String(editForm[k] ?? "") !== String(prevChanges[k] ?? ""));
    if (!hasDiff) {
      setEditingId(null);
      return;
    }
    await runHistoryCommand({
      label: "Campos da peça (ajuste)",
      do: () => updatePiece.mutateAsync({ pieceId: p.id, adjustmentId: adjustment.id, changes: editForm }).then(() => undefined),
      undo: () => updatePiece.mutateAsync({ pieceId: p.id, adjustmentId: adjustment.id, changes: prevChanges }).then(() => undefined),
    });
    setEditingId(null);
  };

  const handleRemovePiece = async (p: any) => {
    if (!confirm(`Remover a peça "${p.name}" do ajuste?`)) return;
    await updatePiece.mutateAsync({
      pieceId: p.id,
      adjustmentId: adjustment.id,
      changes: { is_deleted: true },
    });
  };

  const handleRestorePiece = async (p: any) => {
    await restorePiece.mutateAsync({
      pieceId: p.id,
      adjustmentId: adjustment.id,
      originalSnapshot: p.original_snapshot,
    });
  };

  const handleAddPiece = async () => {
    if (!newPiece.code || !newPiece.name.trim()) {
      toast.error("Código e nome são obrigatórios");
      return;
    }
    await addPiece.mutateAsync({
      adjustmentId: adjustment.id,
      code: Number(newPiece.code),
      name: newPiece.name.trim(),
      specification: newPiece.specification || undefined,
      size: newPiece.size || undefined,
      category: newPiece.category || undefined,
      sub_location: newPiece.sub_location || undefined,
    });
    setAddOpen(false);
    setNewPiece({ code: "", name: "", specification: "", size: "", category: "", sub_location: "" });
  };

  // Comparison data
  const rateioCompare = useMemo(() => {
    const adjMap = new Map<string, number>(); // piece_id -> total qty in adjustment
    adjStorePieces.forEach((sp: any) => {
      adjMap.set(sp.piece_id, (adjMap.get(sp.piece_id) || 0) + Number(sp.quantity || 0));
    });
    // adjustment pieces -> source_piece_id
    const sourceByAdjPieceId = new Map<string, string | null>();
    pieces.forEach((p: any) => sourceByAdjPieceId.set(p.id, p.source_piece_id));

    const origMap = new Map<string, number>(); // source piece id -> qty
    origStorePieces.forEach((sp: any) => {
      origMap.set(sp.piece_id, (origMap.get(sp.piece_id) || 0) + Number(sp.quantity || 0));
    });

    let totalOrig = 0;
    let totalAdj = 0;
    const rows: { name: string; orig: number; adj: number; delta: number }[] = [];
    pieces.forEach((p: any) => {
      const adjQty = adjMap.get(p.id) || 0;
      const origQty = p.source_piece_id ? (origMap.get(p.source_piece_id) || 0) : 0;
      totalAdj += adjQty;
      totalOrig += origQty;
      if (adjQty !== origQty) {
        rows.push({ name: p.name, orig: origQty, adj: adjQty, delta: adjQty - origQty });
      }
    });
    return { rows, totalOrig, totalAdj };
  }, [adjStorePieces, origStorePieces, pieces]);

  const changedPieceRows = useMemo(() => {
    const out: { piece: string; field: string; orig: any; adj: any }[] = [];
    pieces.forEach((p: any) => {
      if (p.change_type !== "modified") return;
      const snap = p.original_snapshot || {};
      PIECE_FIELDS.forEach((f) => {
        const o = snap[f.key] ?? "";
        const a = (p as any)[f.key] ?? "";
        if (String(o) !== String(a)) {
          out.push({ piece: p.name, field: f.label, orig: o, adj: a });
        }
      });
    });
    return out;
  }, [pieces]);

  const handleExport = async () => {
    const tId = toast.loading("Gerando comparativo...");
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws1 = wb.addWorksheet("Peças");
      ws1.addRow(["Peça", "Campo", "Valor original", "Valor no ajuste"]);
      ws1.getRow(1).font = { bold: true };
      changedPieceRows.forEach((r) => ws1.addRow([r.piece, r.field, r.orig, r.adj]));
      pieces.filter((p: any) => p.change_type === "added").forEach((p: any) => {
        ws1.addRow([p.name, "(peça nova)", "", `${p.code} - ${p.name}`]);
      });
      pieces.filter((p: any) => p.change_type === "removed").forEach((p: any) => {
        ws1.addRow([p.name, "(peça removida)", `${p.code} - ${p.name}`, ""]);
      });
      ws1.columns.forEach((c) => (c.width = 28));

      const ws2 = wb.addWorksheet("Rateio");
      ws2.addRow(["Peça", "Qtd original", "Qtd ajuste", "Δ"]);
      ws2.getRow(1).font = { bold: true };
      rateioCompare.rows.forEach((r) => ws2.addRow([r.name, r.orig, r.adj, r.delta]));
      ws2.addRow([]);
      ws2.addRow(["TOTAL", rateioCompare.totalOrig, rateioCompare.totalAdj, rateioCompare.totalAdj - rateioCompare.totalOrig]).font = { bold: true } as any;
      ws2.columns.forEach((c) => (c.width = 20));

      const buf = await wb.xlsx.writeBuffer();
      await saveBlobAs(
        new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `Comparativo_${campaignName}_${adjustment.name}.xlsx`,
        { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", description: "Excel", extension: ".xlsx" }
      );
      toast.dismiss(tId);
      toast.success("Comparativo exportado");
    } catch (e: any) {
      toast.dismiss(tId);
      toast.error(e?.message || "Erro ao exportar");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            {adjustment.name}
            {readOnly && <Badge variant="secondary">Somente leitura</Badge>}
            {!readOnly && (
              <span className="ml-auto">
                <UndoRedoToolbar
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onUndo={undo}
                  onRedo={redo}
                  undoLabel={undoLabel}
                  redoLabel={redoLabel}
                  undoCount={undoCount}
                  redoCount={redoCount}
                />
              </span>
            )}
          </SheetTitle>
          <SheetDescription>
            Campanha: <strong>{campaignName}</strong> · {pieces.length} peças · {kits.length} kits
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="pieces" className="mt-4">
          <TabsList>
            <TabsTrigger value="pieces">Peças</TabsTrigger>
            <TabsTrigger value="kits">Kits</TabsTrigger>
            <TabsTrigger value="compare">Comparativo</TabsTrigger>
          </TabsList>

          {/* PIECES TAB */}
          <TabsContent value="pieces" className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {(["all", "modified", "added", "removed"] as const).map((f) => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="h-7 text-xs" onClick={() => setFilter(f)}>
                  {f === "all" ? "Todas" : f === "modified" ? "Modificadas" : f === "added" ? "Novas" : "Removidas"}
                </Button>
              ))}
              <div className="ml-auto" />
              {!readOnly && (
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setAddOpen(true)}>
                  <Plus className="w-3.5 h-3.5" /> Adicionar peça
                </Button>
              )}
            </div>

            {piecesLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Especificação</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead className="w-32 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPieces.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">Nenhuma peça nesse filtro.</TableCell></TableRow>
                    )}
                    {filteredPieces.map((p: any) => {
                      const isEditing = editingId === p.id;
                      const removed = p.change_type === "removed";
                      const snap = p.original_snapshot || {};
                      return (
                        <>
                          <TableRow key={p.id} className={removed ? "opacity-60" : ""}>
                            <TableCell className="text-xs">{p.code}</TableCell>
                            <TableCell className={`text-xs ${removed ? "line-through" : ""}`}>{p.name}</TableCell>
                            <TableCell className="text-xs">{p.specification || "—"}</TableCell>
                            <TableCell className="text-xs">{p.size || "—"}</TableCell>
                            <TableCell className="text-xs">{[p.category, p.sub_location].filter(Boolean).join(" / ") || "—"}</TableCell>
                            <TableCell><ChangeBadge type={p.change_type} /></TableCell>
                            <TableCell className="text-right">
                              {!readOnly && (
                                <div className="flex items-center gap-1 justify-end">
                                  {removed ? (
                                    <Button size="sm" variant="ghost" className="h-7 px-2" title="Restaurar" onClick={() => handleRestorePiece(p)}>
                                      <Undo2 className="w-3.5 h-3.5" />
                                    </Button>
                                  ) : (
                                    <>
                                      <Button size="sm" variant="ghost" className="h-7 px-2" title="Editar" onClick={() => startEdit(p)}>
                                        <Pencil className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" title="Remover" onClick={() => handleRemovePiece(p)}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                      {p.change_type === "modified" && p.original_snapshot && (
                                        <Button size="sm" variant="ghost" className="h-7 px-2" title="Restaurar original" onClick={() => handleRestorePiece(p)}>
                                          <Undo2 className="w-3.5 h-3.5" />
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                          {isEditing && (
                            <TableRow className="bg-muted/40">
                              <TableCell colSpan={7}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {PIECE_FIELDS.map((f) => (
                                    <div key={f.key} className="space-y-1">
                                      <Label className="text-[11px]">{f.label}</Label>
                                      <Input
                                        value={editForm[f.key] || ""}
                                        onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })}
                                        className="h-8 text-xs"
                                      />
                                      <p className="text-[10px] text-muted-foreground truncate">
                                        Original: {String(snap[f.key] ?? "—") || "—"}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex justify-end gap-2 mt-3">
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                                    <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                                  </Button>
                                  <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveEdit(p)} disabled={updatePiece.isPending}>
                                    <Save className="w-3.5 h-3.5 mr-1" /> Salvar
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* KITS TAB */}
          <TabsContent value="kits" className="space-y-3">
            {kitsLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead className="w-40 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kits.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-6">Nenhum kit.</TableCell></TableRow>
                    )}
                    {kits.map((k: any) => {
                      const removed = k.change_type === "removed";
                      const isEditing = editingKitId === k.id;
                      return (
                        <TableRow key={k.id} className={removed ? "opacity-60" : ""}>
                          <TableCell className={`text-xs ${removed ? "line-through" : ""}`}>
                            {isEditing ? (
                              <Input value={kitNameDraft} onChange={(e) => setKitNameDraft(e.target.value)} className="h-8 text-xs" />
                            ) : k.name}
                          </TableCell>
                          <TableCell><ChangeBadge type={k.change_type} /></TableCell>
                          <TableCell className="text-right">
                            {!readOnly && (
                              <div className="flex items-center gap-1 justify-end">
                                {isEditing ? (
                                  <>
                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingKitId(null)}>Cancelar</Button>
                                    <Button size="sm" className="h-7 text-xs" onClick={async () => {
                                      const prevName = k.name;
                                      const newName = kitNameDraft;
                                      if (prevName !== newName) {
                                        await runHistoryCommand({
                                          label: "Nome do kit (ajuste)",
                                          do: () => updateKit.mutateAsync({ kitId: k.id, adjustmentId: adjustment.id, changes: { name: newName } }).then(() => undefined),
                                          undo: () => updateKit.mutateAsync({ kitId: k.id, adjustmentId: adjustment.id, changes: { name: prevName } }).then(() => undefined),
                                        });
                                      }
                                      setEditingKitId(null);
                                    }}>Salvar</Button>
                                  </>
                                ) : removed ? (
                                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => restoreKit.mutateAsync({ kitId: k.id, adjustmentId: adjustment.id, originalName: k.name })}>
                                    <Undo2 className="w-3.5 h-3.5" />
                                  </Button>
                                ) : (
                                  <>
                                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditingKitId(k.id); setKitNameDraft(k.name); }}>
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={async () => {
                                      if (!confirm(`Remover o kit "${k.name}"?`)) return;
                                      await updateKit.mutateAsync({ kitId: k.id, adjustmentId: adjustment.id, changes: { is_deleted: true } });
                                    }}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* COMPARE TAB */}
          <TabsContent value="compare" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="border rounded-md p-3"><p className="text-[11px] text-muted-foreground">Modificadas</p><p className="text-lg font-bold text-amber-600">{counts.modified}</p></div>
              <div className="border rounded-md p-3"><p className="text-[11px] text-muted-foreground">Novas</p><p className="text-lg font-bold text-emerald-600">{counts.added}</p></div>
              <div className="border rounded-md p-3"><p className="text-[11px] text-muted-foreground">Removidas</p><p className="text-lg font-bold text-destructive">{counts.removed}</p></div>
              <div className="border rounded-md p-3"><p className="text-[11px] text-muted-foreground">Kits alterados</p><p className="text-lg font-bold">{counts.kitsChanged}</p></div>
            </div>

            <div className="flex justify-end">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={handleExport}>
                <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar comparativo Excel
              </Button>
            </div>

            <div>
              <h3 className="text-xs font-semibold mb-1">Peças alteradas</h3>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Peça</TableHead>
                      <TableHead className="text-xs">Campo</TableHead>
                      <TableHead className="text-xs">Valor original</TableHead>
                      <TableHead className="text-xs">Valor no ajuste</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {changedPieceRows.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">Nenhuma alteração de campo.</TableCell></TableRow>
                    )}
                    {changedPieceRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{r.piece}</TableCell>
                        <TableCell className="text-xs">{r.field}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{String(r.orig) || "—"}</TableCell>
                        <TableCell className="text-xs text-amber-600 font-semibold">{String(r.adj) || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold mb-1">Comparativo de rateio</h3>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="border rounded-md p-2"><p className="text-[11px] text-muted-foreground">Total original</p><p className="text-base font-bold">{rateioCompare.totalOrig}</p></div>
                <div className="border rounded-md p-2"><p className="text-[11px] text-muted-foreground">Total ajuste</p><p className="text-base font-bold">{rateioCompare.totalAdj}</p></div>
                <div className="border rounded-md p-2">
                  <p className="text-[11px] text-muted-foreground">Diferença</p>
                  <p className={`text-base font-bold ${rateioCompare.totalAdj - rateioCompare.totalOrig > 0 ? "text-emerald-600" : rateioCompare.totalAdj - rateioCompare.totalOrig < 0 ? "text-destructive" : ""}`}>
                    {rateioCompare.totalAdj - rateioCompare.totalOrig > 0 ? "+" : ""}{rateioCompare.totalAdj - rateioCompare.totalOrig}
                  </p>
                </div>
              </div>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Peça</TableHead>
                      <TableHead className="text-xs text-right">Qtd original</TableHead>
                      <TableHead className="text-xs text-right">Qtd ajuste</TableHead>
                      <TableHead className="text-xs text-right">Δ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rateioCompare.rows.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">Nenhuma diferença de rateio.</TableCell></TableRow>
                    )}
                    {rateioCompare.rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{r.name}</TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">{r.orig}</TableCell>
                        <TableCell className="text-xs text-right">{r.adj}</TableCell>
                        <TableCell className={`text-xs text-right font-semibold ${r.delta > 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {r.delta > 0 ? "+" : ""}{r.delta}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar nova peça ao ajuste</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Código *</Label>
                <Input type="number" value={newPiece.code} onChange={(e) => setNewPiece({ ...newPiece, code: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nome *</Label>
                <Input value={newPiece.name} onChange={(e) => setNewPiece({ ...newPiece, name: e.target.value })} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Especificação</Label>
                <Input value={newPiece.specification} onChange={(e) => setNewPiece({ ...newPiece, specification: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tamanho</Label>
                <Input value={newPiece.size} onChange={(e) => setNewPiece({ ...newPiece, size: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Categoria</Label>
                <Input value={newPiece.category} onChange={(e) => setNewPiece({ ...newPiece, category: e.target.value })} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Sub-localização</Label>
                <Input value={newPiece.sub_location} onChange={(e) => setNewPiece({ ...newPiece, sub_location: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addPiece.isPending}>Cancelar</Button>
              <Button onClick={handleAddPiece} disabled={addPiece.isPending}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
