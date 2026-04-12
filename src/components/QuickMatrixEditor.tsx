import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Edit3, Save, X, Package, Sparkles, Loader2, Send, GripVertical } from "lucide-react";
import { toast } from "sonner";
import PieceThumbnail from "@/components/PieceThumbnail";
import { supabase } from "@/integrations/supabase/client";
import type { CampaignPiece, CampaignKit, CampaignKitPiece, ClientStore } from "@/hooks/useMultiClientData";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, horizontalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface CustomFieldLabel {
  key: string;
  label: string;
}

interface QuickMatrixEditorProps {
  stores: ClientStore[];
  pieces: CampaignPiece[];
  kits?: CampaignKit[];
  kitPieces?: CampaignKitPiece[];
  qtyMap: Record<string, number>;
  campaignId: string;
  isAdmin: boolean;
  onSaveBatch: (changes: { storeId: string; pieceId: string; quantity: number }[]) => Promise<void>;
  onEditingChange?: (editing: boolean) => void;
  onReorderColumns?: (reordered: { id: string; type: "piece" | "kit"; display_order: number }[]) => Promise<void>;
  customFieldLabels?: CustomFieldLabel[];
}

type MatrixCol = { type: "piece"; data: CampaignPiece } | { type: "kit"; data: CampaignKit };

// Use a separator that won't appear in UUIDs for internal draft keys
const SEP = ":::";
const mk = (a: string, b: string) => `${a}${SEP}${b}`;
const splitMk = (key: string): [string, string] => {
  const idx = key.indexOf(SEP);
  return [key.slice(0, idx), key.slice(idx + SEP.length)];
};
// Parent qtyMap key (uses dash)
const parentKey = (storeId: string, pieceId: string) => `${storeId}-${pieceId}`;

// ─── Draggable column header ──────────────────────────────
function DraggableColHeader({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
  };
  return (
    <TableHead ref={setNodeRef} style={style} className="text-center min-w-[100px]">
      <div className="flex flex-col items-center gap-0.5">
        <div {...attributes} {...listeners} className="cursor-grab hover:text-primary transition-colors">
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </div>
        {children}
      </div>
    </TableHead>
  );
}

const QuickMatrixEditor = ({
  stores,
  pieces,
  kits = [],
  kitPieces = [],
  customFieldLabels = [],
  qtyMap,
  campaignId,
  isAdmin,
  onSaveBatch,
  onEditingChange,
  onReorderColumns,
}: QuickMatrixEditorProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Helper to read from parent qtyMap using dash key
  const getQty = useCallback((storeId: string, pieceId: string) => {
    return qtyMap[parentKey(storeId, pieceId)] || 0;
  }, [qtyMap]);

  // Unified columns (pieces + kits) sorted by display_order
  const matrixColumns: MatrixCol[] = useMemo(() => {
    return [
      ...pieces.map(p => ({ type: "piece" as const, data: p, display_order: p.display_order })),
      ...kits.map(k => ({ type: "kit" as const, data: k, display_order: k.display_order })),
    ].sort((a, b) => a.display_order - b.display_order);
  }, [pieces, kits]);

  const getColId = (col: MatrixCol) => col.type === "piece" ? col.data.id : `kit${SEP}${col.data.id}`;

  const colIds = useMemo(() => matrixColumns.map(getColId), [matrixColumns]);

  // Category group headers
  const categoryGroups = useMemo(() => {
    const groups: { label: string; span: number }[] = [];
    let currentCat: string | null = null;
    let currentSpan = 0;
    matrixColumns.forEach((col) => {
      const cat = col.type === "piece" ? (col.data.category || "Sem localização") : (col.data.category || "Sem localização");
      if (cat !== currentCat) {
        if (currentCat !== null) groups.push({ label: currentCat, span: currentSpan });
        currentCat = cat;
        currentSpan = 1;
      } else {
        currentSpan++;
      }
    });
    if (currentCat !== null) groups.push({ label: currentCat, span: currentSpan });
    return groups;
  }, [matrixColumns]);

  // Build flat grid index for keyboard navigation
  const gridKeys = useMemo(() => {
    const keys: string[] = [];
    stores.forEach((s) => {
      matrixColumns.forEach((col) => {
        keys.push(mk(s.id, getColId(col)));
      });
    });
    return keys;
  }, [stores, matrixColumns]);

  const startEditing = useCallback(() => {
    const initial: Record<string, string> = {};
    stores.forEach((s) => {
      matrixColumns.forEach((col) => {
        if (col.type === "piece") {
          const key = mk(s.id, col.data.id);
          initial[key] = String(getQty(s.id, col.data.id));
        }
      });
    });
    setDraft(initial);
    setEditing(true);
  }, [stores, matrixColumns, getQty]);

  const cancelEditing = () => {
    setDraft({});
    setEditing(false);
  };

  // Get piece qty from draft with fallback to current matrix qty
  const getPieceDraftQty = useCallback((storeId: string, pieceId: string) => {
    const key = mk(storeId, pieceId);
    const draftValue = draft[key];
    if (draftValue === undefined || draftValue === "") {
      return getQty(storeId, pieceId);
    }
    return Math.max(0, parseInt(draftValue) || 0);
  }, [draft, getQty]);

  // Get kit draft value (derived from underlying piece drafts)
  const getKitDraftQty = useCallback((storeId: string, kitId: string) => {
    const piecesInKit = kitPieces.filter(kp => kp.kit_id === kitId);
    if (piecesInKit.length === 0) return 0;
    return Math.min(
      ...piecesInKit.map(kp => {
        return Math.floor(getPieceDraftQty(storeId, kp.piece_id) / (kp.quantity || 1));
      })
    );
  }, [kitPieces, getPieceDraftQty]);

  const getKitOriginalQty = useCallback((storeId: string, kitId: string) => {
    const piecesInKit = kitPieces.filter(kp => kp.kit_id === kitId);
    if (piecesInKit.length === 0) return 0;
    return Math.min(
      ...piecesInKit.map(kp => {
        return Math.floor(getQty(storeId, kp.piece_id) / (kp.quantity || 1));
      })
    );
  }, [kitPieces, getQty]);

  const setKitDraftQty = useCallback((storeId: string, kitId: string, kitQty: number) => {
    const piecesInKit = kitPieces.filter(kp => kp.kit_id === kitId);
    setDraft(d => {
      const next = { ...d };
      for (const kp of piecesInKit) {
        next[mk(storeId, kp.piece_id)] = String(kitQty * (kp.quantity || 1));
      }
      return next;
    });
  }, [kitPieces]);

  const changedCount = useMemo(() => {
    if (!editing) return 0;
    return Object.entries(draft).filter(([key, val]) => {
      const [storeId, pieceId] = splitMk(key);
      const original = getQty(storeId, pieceId);
      return parseInt(val) !== original;
    }).length;
  }, [draft, getQty, editing]);

  const handleAiPrompt = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const currentQuantities: Record<string, number> = {};
      stores.forEach(s => {
        pieces.forEach(p => {
          const key = mk(s.id, p.id);
          const val = parseInt(draft[key]) || 0;
          if (val > 0) {
            currentQuantities[parentKey(s.id, p.id)] = val;
          }
        });
      });

      const { data, error } = await supabase.functions.invoke("matrix-ai-fill", {
        body: {
          prompt: aiPrompt.trim(),
          stores: stores.map(s => {
            const storeData: Record<string, any> = {
              id: s.id,
              name: s.name,
              nickname: s.nickname,
              store_model: s.store_model,
              city: s.city,
              state: s.state,
            };
            for (const cf of customFieldLabels) {
              const val = (s as any)[cf.key];
              if (val) storeData[cf.label] = val;
            }
            return storeData;
          }),
          customFieldLabels: customFieldLabels.map(cf => ({ key: cf.key, label: cf.label })),
          pieces: pieces.map(p => ({
            id: p.id,
            code: p.code,
            name: p.name,
            category: p.category,
            size: p.size,
            kit_only: p.kit_only,
          })),
          kits: kits.map(k => ({ id: k.id, code: k.code, name: k.name })),
          kitPieces: kitPieces.map(kp => ({
            kit_id: kp.kit_id,
            piece_id: kp.piece_id,
            quantity: kp.quantity,
          })),
          currentQuantities,
        },
      });

      if (error) {
        const errMsg = error?.message || String(error);
        if (errMsg.includes("402") || errMsg.includes("Créditos insuficientes")) {
          toast.error("Créditos de IA insuficientes. Adicione créditos ao workspace Lovable em Settings → Workspace → Usage.");
          return;
        }
        if (errMsg.includes("429") || errMsg.includes("Limite de requisições")) {
          toast.error("Limite de requisições excedido. Aguarde alguns segundos e tente novamente.");
          return;
        }
        throw error;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const changes = data?.changes as { storeId: string; pieceId: string; quantity: number }[] | undefined;
      if (!changes || changes.length === 0) {
        toast.info("A IA não gerou alterações para este comando.");
        return;
      }

      setDraft(d => {
        const next = { ...d };
        for (const c of changes) {
          next[mk(c.storeId, c.pieceId)] = String(Math.max(0, c.quantity));
        }
        return next;
      });

      toast.success(`IA aplicou ${changes.length} alteração(ões) na planilha. Revise e salve.`);
      setAiPrompt("");
    } catch (err: any) {
      console.error("AI fill error:", err);
      toast.error(err?.message || "Erro ao processar comando da IA.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    const changes: { storeId: string; pieceId: string; quantity: number }[] = [];
    Object.entries(draft).forEach(([key, val]) => {
      const [storeId, pieceId] = splitMk(key);
      const original = getQty(storeId, pieceId);
      const newQty = Math.max(0, parseInt(val) || 0);
      if (newQty !== original) {
        changes.push({ storeId, pieceId, quantity: newQty });
      }
    });

    if (changes.length === 0) {
      toast.info("Nenhuma alteração detectada.");
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSaveBatch(changes);
      toast.success(`${changes.length} quantidade(s) atualizada(s)!`);
      setEditing(false);
      setDraft({});
    } catch {
      toast.error("Erro ao salvar alterações.");
    } finally {
      setSaving(false);
    }
  };

  const focusCell = (key: string) => {
    const el = inputRefs.current[key];
    if (el) {
      el.focus();
      el.select();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, key: string) => {
    const idx = gridKeys.indexOf(key);
    if (idx === -1) return;
    const cols = matrixColumns.length;

    let nextIdx = -1;

    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      nextIdx = e.shiftKey ? idx - 1 : idx + 1;
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      nextIdx = idx + 1;
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      nextIdx = idx - 1;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      nextIdx = idx + cols;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      nextIdx = idx - cols;
    } else if (e.key === "Escape") {
      cancelEditing();
      return;
    }

    if (nextIdx >= 0 && nextIdx < gridKeys.length) {
      focusCell(gridKeys[nextIdx]);
    }
  };

  // DnD column reorder handler
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = colIds.indexOf(String(active.id));
    const newIndex = colIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(matrixColumns, oldIndex, newIndex);
    const updates = reordered.map((col, i) => ({
      id: col.data.id,
      type: col.type,
      display_order: i + 1,
    }));

    if (onReorderColumns) {
      try {
        await onReorderColumns(updates);
        toast.success("Ordem das colunas atualizada!");
      } catch {
        toast.error("Erro ao reordenar colunas.");
      }
    }
  }, [matrixColumns, colIds, onReorderColumns]);

  // Notify parent of editing state changes
  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  // Auto-focus first cell when entering edit mode
  useEffect(() => {
    if (editing && gridKeys.length > 0) {
      setTimeout(() => focusCell(gridKeys[0]), 50);
    }
  }, [editing]);

  if (!isAdmin) return null;

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {!editing ? (
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            onClick={startEditing}
          >
            <Edit3 className="w-3.5 h-3.5" /> Edição Rápida
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              className="text-xs gap-1.5"
              onClick={handleSave}
              disabled={saving || changedCount === 0}
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Salvando..." : `Salvar (${changedCount})`}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs gap-1"
              onClick={cancelEditing}
              disabled={saving}
            >
              <X className="w-3.5 h-3.5" /> Cancelar
            </Button>
            <span className="text-[10px] text-muted-foreground hidden sm:inline ml-2">
              Tab/Enter = próxima · Setas = navegar · Esc = cancelar
            </span>
          </>
        )}
      </div>

      {/* AI Prompt */}
      {editing && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAiPrompt();
              }
            }}
            placeholder="Ex: Coloque 5 unidades de todas as peças em todas as lojas..."
            disabled={aiLoading}
            className="flex-1 h-8 px-3 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
          />
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 shrink-0"
            onClick={handleAiPrompt}
            disabled={aiLoading || !aiPrompt.trim()}
          >
            {aiLoading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando...</>
            ) : (
              <><Send className="w-3.5 h-3.5" /> Enviar</>
            )}
          </Button>
        </div>
      )}

      {/* Quick-edit table */}
      {editing && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="border border-primary/30 rounded-lg overflow-x-auto bg-card shadow-sm">
            <Table>
              <TableHeader>
                {/* Category group header row */}
                {categoryGroups.length > 1 && (
                  <TableRow className="bg-muted/30">
                    <TableHead className="sticky left-0 bg-muted/30 z-[5]" />
                    {categoryGroups.map((g, i) => (
                      <TableHead key={i} colSpan={g.span} className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-l border-border py-1">
                        {g.label}
                      </TableHead>
                    ))}
                    <TableHead />
                  </TableRow>
                )}
                <TableRow className="bg-primary/5">
                  <TableHead className="sticky left-0 bg-primary/5 z-[5] min-w-[180px]">Loja</TableHead>
                  <SortableContext items={colIds} strategy={horizontalListSortingStrategy}>
                    {matrixColumns.map((col) => {
                      const colId = getColId(col);
                      if (col.type === "piece") {
                        const p = col.data;
                        return (
                          <DraggableColHeader key={colId} id={colId}>
                            <PieceThumbnail imageUrl={p.image_url} name={p.name} size="sm" />
                            <span className="text-xs font-bold">{p.code}</span>
                            <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[120px] whitespace-normal break-words">{p.name}</span>
                          </DraggableColHeader>
                        );
                      }
                      const kit = col.data;
                      return (
                        <DraggableColHeader key={colId} id={colId}>
                          {kit.image_url ? (
                            <PieceThumbnail imageUrl={kit.image_url} name={kit.name} size="sm" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                              <Package className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          <span className="text-xs font-bold text-primary">{kit.code}</span>
                          <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[120px] whitespace-normal break-words">{getKitDisplayName(kit)}</span>
                        </DraggableColHeader>
                      );
                    })}
                  </SortableContext>
                  <TableHead className="text-center font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => {
                  const rowTotal = pieces.reduce((s, p) => {
                    const key = mk(store.id, p.id);
                    return s + (parseInt(draft[key]) || 0);
                  }, 0);
                  const hasAnyStoreWithQty = stores.some(
                    (st) => st.id !== store.id && pieces.some((p) => getQty(st.id, p.id) > 0)
                  );
                  const isEmptyStore = rowTotal === 0 && hasAnyStoreWithQty;
                  return (
                    <TableRow key={store.id} className={isEmptyStore ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                      <TableCell className={`sticky left-0 z-[5] font-medium ${isEmptyStore ? "bg-amber-50/50 dark:bg-amber-950/10" : "bg-card"}`}>
                        <span className="text-sm">{store.name}</span>
                        {store.nickname && store.nickname !== store.name && (
                          <span className="text-[10px] text-muted-foreground ml-1">({store.nickname})</span>
                        )}
                        {isEmptyStore && (
                          <span className="text-amber-500 ml-1 text-[10px]" title="Loja sem quantidades — preencha manualmente">⚠</span>
                        )}
                      </TableCell>
                      {matrixColumns.map((col) => {
                        const colId = getColId(col);
                        const gridKey = mk(store.id, colId);

                        if (col.type === "piece") {
                          const p = col.data;
                          const key = mk(store.id, p.id);
                          const original = getQty(store.id, p.id);
                          const current = draft[key] ?? String(original);
                          const changed = parseInt(current) !== original;
                          return (
                            <TableCell key={p.id} className="p-0.5 text-center">
                              <input
                                ref={(el) => { inputRefs.current[gridKey] = el; }}
                                type="number"
                                min={0}
                                value={current}
                                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => handleKeyDown(e, gridKey)}
                                className={`w-14 h-7 text-center text-sm rounded border outline-none transition-colors ${
                                  changed
                                    ? "border-primary bg-primary/10 font-bold text-primary"
                                    : isEmptyStore && parseInt(current) === 0
                                    ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20 text-amber-600"
                                    : "border-border bg-background text-foreground"
                                } focus:ring-2 focus:ring-primary/40 focus:border-primary`}
                              />
                            </TableCell>
                          );
                        }

                        // Kit column
                        const kit = col.data;
                        const kitQtyVal = getKitDraftQty(store.id, kit.id);
                        const originalKitQty = getKitOriginalQty(store.id, kit.id);
                        const kitChanged = kitQtyVal !== originalKitQty;
                        return (
                          <TableCell key={`kit-${kit.id}`} className="p-0.5 text-center bg-primary/5">
                            <input
                              ref={(el) => { inputRefs.current[gridKey] = el; }}
                              type="number"
                              min={0}
                              value={String(kitQtyVal)}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                setKitDraftQty(store.id, kit.id, val);
                              }}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={(e) => handleKeyDown(e, gridKey)}
                              className={`w-14 h-7 text-center text-sm rounded border outline-none transition-colors ${
                                kitChanged
                                  ? "border-primary bg-primary/10 font-bold text-primary"
                                  : "border-border bg-background text-foreground"
                              } focus:ring-2 focus:ring-primary/40 focus:border-primary`}
                            />
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold text-sm">{rowTotal}</TableCell>
                    </TableRow>
                  );
                })}
                {/* Totals */}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell className="sticky left-0 bg-muted/50 z-[5]">Total</TableCell>
                  {matrixColumns.map((col) => {
                    if (col.type === "piece") {
                      const p = col.data;
                      const colTotal = stores.reduce((s, st) => {
                        const key = mk(st.id, p.id);
                        return s + (parseInt(draft[key]) || 0);
                      }, 0);
                      return <TableCell key={p.id} className="text-center text-sm">{colTotal}</TableCell>;
                    }
                    const kit = col.data;
                    const kitTotal = stores.reduce((s, st) => s + getKitDraftQty(st.id, kit.id), 0);
                    return <TableCell key={`kit-${kit.id}`} className="text-center text-sm bg-primary/5">{kitTotal}</TableCell>;
                  })}
                  <TableCell className="text-center text-sm text-primary">
                    {stores.reduce((total, st) =>
                      total + pieces.reduce((s, p) => s + (parseInt(draft[mk(st.id, p.id)]) || 0), 0), 0
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </DndContext>
      )}
    </>
  );
};

export default QuickMatrixEditor;
