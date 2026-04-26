import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Edit3, Save, X, Package, Sparkles, Loader2, Send, GripVertical, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import PieceThumbnail from "@/components/PieceThumbnail";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

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

// ─── Memoized piece cell ──────────────────────────────────
const MatrixPieceCell = React.memo(({
  gridKey,
  draftKey,
  current,
  changed,
  isEmptyStore,
  onSetDraft,
  onKeyDown,
  inputRefs,
}: {
  gridKey: string;
  draftKey: string;
  current: string;
  changed: boolean;
  isEmptyStore: boolean;
  onSetDraft: (key: string, value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, key: string) => void;
  inputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
}) => {
  return (
    <TableCell className="p-0.5 text-center">
      <input
        ref={(el) => { inputRefs.current[gridKey] = el; }}
        type="number"
        min={0}
        value={current}
        onChange={(e) => onSetDraft(draftKey, e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => onKeyDown(e, gridKey)}
        className={`w-14 h-7 text-center text-sm rounded border outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
          changed
            ? "border-primary bg-primary/10 font-bold text-primary"
            : isEmptyStore && parseInt(current) === 0
            ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20 text-amber-600"
            : "border-border bg-background text-foreground"
        } focus:ring-2 focus:ring-primary/40 focus:border-primary`}
      />
    </TableCell>
  );
}, (prev, next) =>
  prev.current === next.current &&
  prev.changed === next.changed &&
  prev.isEmptyStore === next.isEmptyStore
);

MatrixPieceCell.displayName = "MatrixPieceCell";

// ─── Memoized kit cell ────────────────────────────────────
const MatrixKitCell = React.memo(({
  gridKey,
  storeId,
  kitId,
  kitQtyVal,
  kitChanged,
  onSetKitDraft,
  onKeyDown,
  inputRefs,
}: {
  gridKey: string;
  storeId: string;
  kitId: string;
  kitQtyVal: number;
  kitChanged: boolean;
  onSetKitDraft: (storeId: string, kitId: string, val: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, key: string) => void;
  inputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
}) => {
  return (
    <TableCell className="p-0.5 text-center bg-primary/5">
      <input
        ref={(el) => { inputRefs.current[gridKey] = el; }}
        type="number"
        min={0}
        value={String(kitQtyVal)}
        onChange={(e) => {
          const val = Math.max(0, parseInt(e.target.value) || 0);
          onSetKitDraft(storeId, kitId, val);
        }}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => onKeyDown(e, gridKey)}
        className={`w-14 h-7 text-center text-sm rounded border outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
          kitChanged
            ? "border-primary bg-primary/10 font-bold text-primary"
            : "border-border bg-background text-foreground"
        } focus:ring-2 focus:ring-primary/40 focus:border-primary`}
      />
    </TableCell>
  );
}, (prev, next) =>
  prev.kitQtyVal === next.kitQtyVal &&
  prev.kitChanged === next.kitChanged
);

MatrixKitCell.displayName = "MatrixKitCell";

// ─── Memoized row ─────────────────────────────────────────
const MatrixRow = React.memo(({
  store,
  matrixColumns,
  draft,
  getQty,
  getKitDraftQty,
  getKitOriginalQty,
  isEmptyStore,
  rowTotal,
  onSetDraft,
  onSetKitDraft,
  onKeyDown,
  inputRefs,
  customFieldLabels = [],
}: {
  store: ClientStore;
  matrixColumns: MatrixCol[];
  draft: Record<string, string>;
  getQty: (storeId: string, pieceId: string) => number;
  getKitDraftQty: (storeId: string, kitId: string) => number;
  getKitOriginalQty: (storeId: string, kitId: string) => number;
  isEmptyStore: boolean;
  rowTotal: number;
  onSetDraft: (key: string, value: string) => void;
  onSetKitDraft: (storeId: string, kitId: string, val: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, key: string) => void;
  inputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  customFieldLabels?: CustomFieldLabel[];
}) => {
  const getColId = (col: MatrixCol) => col.type === "piece" ? col.data.id : `kit${SEP}${col.data.id}`;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const closeDetailsTimer = useRef<number | null>(null);

  const storeAny = store as any;
  const filledCustomFields = customFieldLabels
    .map((cf) => ({ label: cf.label, value: storeAny[cf.key] }))
    .filter((f) => f.value !== null && f.value !== undefined && String(f.value).trim() !== "");
  const locationParts = [store.city, store.state].filter(Boolean).join(" / ");
  const cancelDetailsClose = () => {
    if (closeDetailsTimer.current) {
      window.clearTimeout(closeDetailsTimer.current);
      closeDetailsTimer.current = null;
    }
  };
  const scheduleDetailsClose = () => {
    cancelDetailsClose();
    closeDetailsTimer.current = window.setTimeout(() => setDetailsOpen(false), 160);
  };

  return (
    <TableRow className={isEmptyStore ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
      <TableCell className={`sticky left-0 z-[5] font-medium ${isEmptyStore ? "bg-amber-50/50 dark:bg-amber-950/10" : "bg-card"}`}>
        <div className="inline-flex items-baseline flex-wrap gap-1.5">
          <span className="text-sm">{store.name}</span>
          {store.nickname && store.nickname !== store.name && (
            <span className="text-[10px] text-muted-foreground">({store.nickname})</span>
          )}
          <Popover open={detailsOpen} onOpenChange={setDetailsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Ver detalhes da loja ${store.name}`}
                onMouseEnter={() => {
                  cancelDetailsClose();
                  setDetailsOpen(true);
                }}
                onMouseLeave={scheduleDetailsClose}
                onClick={(event) => {
                  event.preventDefault();
                  setDetailsOpen((open) => !open);
                }}
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-warning/40 bg-warning/10 text-warning transition-colors hover:bg-warning/20 focus:outline-none focus:ring-2 focus:ring-warning/40"
              >
                <HelpCircle className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              align="start"
              className="w-72 text-xs p-3 z-50"
              onMouseEnter={cancelDetailsClose}
              onMouseLeave={scheduleDetailsClose}
            >
            <div className="space-y-2">
              <div>
                <div className="font-semibold text-sm leading-tight">{store.name}</div>
                {store.nickname && store.nickname !== store.name && (
                  <div className="text-muted-foreground text-[11px]">{store.nickname}</div>
                )}
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <span className="text-muted-foreground">Localização</span>
                <span className={locationParts ? "" : "italic text-muted-foreground/70"}>
                  {locationParts || "Não informada"}
                </span>
                <span className="text-muted-foreground">Código</span>
                <span className={store.store_code ? "" : "italic text-muted-foreground/70"}>
                  {store.store_code || "Não informado"}
                </span>
                <span className="text-muted-foreground">Modelo</span>
                <span className={store.store_model ? "" : "italic text-muted-foreground/70"}>
                  {store.store_model || "Não informado"}
                </span>
                <span className="text-muted-foreground">Vitrines</span>
                <span className={storeAny.showcase_count ? "" : "italic text-muted-foreground/70"}>
                  {storeAny.showcase_count ?? "Não informado"}
                </span>
                {filledCustomFields.length > 0 ? (
                  filledCustomFields.map((f) => (
                    <React.Fragment key={f.label}>
                      <span className="text-muted-foreground">{f.label}</span>
                      <span className="break-words">{String(f.value)}</span>
                    </React.Fragment>
                  ))
                ) : customFieldLabels.length > 0 ? (
                  <>
                    <span className="text-muted-foreground">Campos extras</span>
                    <span className="italic text-muted-foreground/70">Nenhum preenchido</span>
                  </>
                ) : null}
              </div>
            </div>
            </PopoverContent>
          </Popover>
        </div>
        {isEmptyStore && (
          <span className="text-amber-500 ml-1 text-[10px]" title="Loja sem quantidades — preencha manualmente">⚠</span>
        )}
      </TableCell>
      {matrixColumns.map((col) => {
        const colId = getColId(col);
        const gridKey = mk(store.id, colId);

        if (col.type === "piece") {
          const p = col.data;
          const draftKey = mk(store.id, p.id);
          const original = getQty(store.id, p.id);
          const current = draft[draftKey] ?? String(original);
          const changed = parseInt(current) !== original;
          return (
            <MatrixPieceCell
              key={p.id}
              gridKey={gridKey}
              draftKey={draftKey}
              current={current}
              changed={changed}
              isEmptyStore={isEmptyStore}
              onSetDraft={onSetDraft}
              onKeyDown={onKeyDown}
              inputRefs={inputRefs}
            />
          );
        }

        const kit = col.data;
        const kitQtyVal = getKitDraftQty(store.id, kit.id);
        const originalKitQty = getKitOriginalQty(store.id, kit.id);
        const kitChanged = kitQtyVal !== originalKitQty;
        return (
          <MatrixKitCell
            key={`kit-${kit.id}`}
            gridKey={gridKey}
            storeId={store.id}
            kitId={kit.id}
            kitQtyVal={kitQtyVal}
            kitChanged={kitChanged}
            onSetKitDraft={onSetKitDraft}
            onKeyDown={onKeyDown}
            inputRefs={inputRefs}
          />
        );
      })}
      <TableCell className="text-center font-bold text-sm">{rowTotal}</TableCell>
    </TableRow>
  );
}, (prev, next) =>
  prev.isEmptyStore === next.isEmptyStore &&
  prev.rowTotal === next.rowTotal &&
  prev.draft === next.draft
);

MatrixRow.displayName = "MatrixRow";

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

  // Helper: derive a kit's location from its underlying pieces when not set explicitly
  const getKitCategory = useCallback((kit: CampaignKit) => {
    if (kit.category) return kit.category;
    const kpRows = kitPieces.filter((kp) => kp.kit_id === kit.id);
    for (const kp of kpRows) {
      const p = pieces.find((pp) => pp.id === kp.piece_id);
      if (p?.category) return p.category;
    }
    return null;
  }, [kitPieces, pieces]);

  // Category group headers
  const categoryGroups = useMemo(() => {
    const groups: { label: string; span: number }[] = [];
    let currentCat: string | null = null;
    let currentSpan = 0;
    matrixColumns.forEach((col) => {
      const cat = col.type === "piece"
        ? (col.data.category || "Sem localização")
        : (getKitCategory(col.data) || "Sem localização");
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
  }, [matrixColumns, getKitCategory]);

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

  const cancelEditing = useCallback(() => {
    setDraft({});
    setEditing(false);
  }, []);

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

  // Stable callbacks for memoized cells
  const handleSetDraft = useCallback((key: string, value: string) => {
    setDraft(d => ({ ...d, [key]: value }));
  }, []);

  const handleSetKitDraft = useCallback((storeId: string, kitId: string, val: number) => {
    setKitDraftQty(storeId, kitId, val);
  }, [setKitDraftQty]);

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

  const focusCell = useCallback((key: string) => {
    requestAnimationFrame(() => {
      const el = inputRefs.current[key];
      if (el) {
        el.focus();
        el.select();
      }
    });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, key: string) => {
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
  }, [gridKeys, matrixColumns.length, focusCell, cancelEditing]);

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
      requestAnimationFrame(() => focusCell(gridKeys[0]));
    }
  }, [editing, gridKeys, focusCell]);

  // Per-store draft slices for memoized rows
  const storeDraftSlices = useMemo(() => {
    const slices: Record<string, Record<string, string>> = {};
    for (const store of stores) {
      const slice: Record<string, string> = {};
      for (const col of matrixColumns) {
        if (col.type === "piece") {
          const key = mk(store.id, col.data.id);
          if (draft[key] !== undefined) {
            slice[key] = draft[key];
          }
        }
      }
      slices[store.id] = slice;
    }
    return slices;
  }, [stores, matrixColumns, draft]);

  // Pre-compute row data for memoization
  const rowData = useMemo(() => {
    // Build a deduped list of piece ids that count toward "store has any qty":
    // visible matrix pieces + all kit component piece ids (kit_only pieces).
    const allPieceIds = new Set<string>(pieces.map((p) => p.id));
    kitPieces.forEach((kp) => allPieceIds.add(kp.piece_id));
    const allPieceIdList = Array.from(allPieceIds);

    return stores.map(store => {
      const storeSlice = storeDraftSlices[store.id] || {};
      const rowTotal = pieces.reduce((s, p) => {
        const key = mk(store.id, p.id);
        return s + (parseInt(draft[key]) || 0);
      }, 0);
      // Real total includes kit_only piece quantities so stores filled only via kits
      // are not falsely flagged as empty.
      const storeTotalReal = allPieceIdList.reduce((sum, pid) => sum + getQty(store.id, pid), 0);
      const hasAnyStoreWithQty = stores.some(
        (st) => st.id !== store.id && allPieceIdList.some((pid) => getQty(st.id, pid) > 0)
      );
      const isEmptyStore = storeTotalReal === 0 && hasAnyStoreWithQty;
      return { store, storeSlice, rowTotal, isEmptyStore };
    });
  }, [stores, pieces, kitPieces, draft, storeDraftSlices, getQty]);

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
                            {(p as any).is_new && <span className="bg-green-500 text-white text-[9px] px-1.5 rounded-full font-bold mt-0.5">NOVO</span>}
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
                          <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[120px] whitespace-normal break-words">{kit.name}</span>
                          {(kit as any).is_new && <span className="bg-green-500 text-white text-[9px] px-1.5 rounded-full font-bold mt-0.5">NOVO</span>}
                        </DraggableColHeader>
                      );
                    })}
                  </SortableContext>
                  <TableHead className="text-center font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowData.map(({ store, storeSlice, rowTotal, isEmptyStore }) => (
                  <MatrixRow
                    key={store.id}
                    store={store}
                    matrixColumns={matrixColumns}
                    draft={storeSlice}
                    getQty={getQty}
                    getKitDraftQty={getKitDraftQty}
                    getKitOriginalQty={getKitOriginalQty}
                    isEmptyStore={isEmptyStore}
                    rowTotal={rowTotal}
                    onSetDraft={handleSetDraft}
                    onSetKitDraft={handleSetKitDraft}
                    onKeyDown={handleKeyDown}
                    inputRefs={inputRefs}
                    customFieldLabels={customFieldLabels}
                  />
                ))}
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
