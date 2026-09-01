import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownToLine, ArrowUpToLine, GripVertical, Layers, Package, X } from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { UnifiedRow } from "@/components/SortablePiecesTable";
import type { CampaignPiece, CampaignKit, CampaignKitPiece } from "@/hooks/useMultiClientData";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: CampaignKitPiece[];
  /** Same persistence routine used by the drag-and-drop table. */
  onReorder: (rows: UnifiedRow[]) => Promise<void> | void;
}

type Item = {
  id: string;
  row: UnifiedRow;
  type: "piece" | "kit";
  code: string;
  name: string;
  location: string;
};

const NO_LOCATION = "__none__";

export default function OrganizePiecesDialog({
  open, onOpenChange, pieces, kits, kitPieces, onReorder,
}: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const lastClickedIndex = useRef<number | null>(null);
  const pendingRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );


  const getKitLocation = (kit: CampaignKit) => {
    const cat = (kit.category ?? "").trim();
    if (cat) return cat;
    const kp = kitPieces.filter((k) => k.kit_id === kit.id);
    if (kp.length === 0) return "";
    const firstPiece = pieces.find((p) => p.id === kp[0].piece_id);
    return (firstPiece?.category ?? "").trim();
  };

  const buildItems = (): Item[] => {
    const rows: Array<Item & { display_order: number }> = [
      // Only standalone pieces (kit components are hidden, exactly like the main table)
      ...pieces.filter((p) => !p.kit_only).map((p) => ({
        id: p.id,
        row: { type: "piece" as const, data: p },
        type: "piece" as const,
        code: String(p.code ?? ""),
        name: p.name ?? "",
        location: (p.category ?? "").trim(),
        display_order: p.display_order ?? 0,
      })),

      ...kits.map((k) => ({
        id: `kit-${k.id}`,
        row: {
          type: "kit" as const,
          data: k,
          kitPieces: kitPieces.filter((kp) => kp.kit_id === k.id),
          allPieces: pieces,
        },
        type: "kit" as const,
        code: String(k.code ?? ""),
        name: k.name ?? "",
        location: getKitLocation(k),
        display_order: k.display_order ?? 0,
      })),
    ];
    rows.sort((a, b) => a.display_order - b.display_order);
    return rows.map(({ display_order, ...rest }) => rest);
  };

  useEffect(() => {
    // Do not clobber the optimistic order while a background save is in flight.
    if (pendingRef.current) return;
    if (open) {
      setItems(buildItems());
      setSelected([]);
      lastClickedIndex.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pieces, kits, kitPieces]);


  const locations = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.location));
    return Array.from(set).sort((a, b) => {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
    });
  }, [items]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleRow = (index: number, shiftKey: boolean) => {
    const id = items[index].id;
    if (shiftKey && lastClickedIndex.current !== null) {
      const start = Math.min(lastClickedIndex.current, index);
      const end = Math.max(lastClickedIndex.current, index);
      const rangeIds = items.slice(start, end + 1).map((i) => i.id);
      setSelected((prev) => Array.from(new Set([...prev, ...rangeIds])));
    } else {
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
    lastClickedIndex.current = index;
  };

  const selectByLocation = (loc: string) => {
    const value = loc === NO_LOCATION ? "" : loc;
    const ids = items.filter((i) => i.location === value).map((i) => i.id);
    setSelected((prev) => Array.from(new Set([...prev, ...ids])));
  };

  /** Move the selected block (relative order preserved) to a target position. */
  const buildMoved = (target: "top" | "bottom" | { refId: string; where: "before" | "after" }) => {
    const block = items.filter((i) => selectedSet.has(i.id));
    const rest = items.filter((i) => !selectedSet.has(i.id));
    if (block.length === 0) return null;

    if (target === "top") return [...block, ...rest];
    if (target === "bottom") return [...rest, ...block];

    const idx = rest.findIndex((i) => i.id === target.refId);
    if (idx === -1) return null;
    const insertAt = target.where === "before" ? idx : idx + 1;
    return [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)];
  };

  /**
   * Expands the top-level order (kits + standalone pieces) into the full sequence
   * that is persisted: right after each kit come its own components (kit_only pieces).
   * A component linked to several kits is placed only once (after the first kit).
   */
  const expandRows = (top: Item[]): UnifiedRow[] => {
    const placed = new Set<string>();
    const out: UnifiedRow[] = [];
    for (const item of top) {
      out.push(item.row);
      if (item.type !== "kit") continue;
      const kitId = item.id.replace(/^kit-/, "");
      for (const kp of kitPieces.filter((k) => k.kit_id === kitId)) {
        if (placed.has(kp.piece_id)) continue;
        const child = pieces.find((p) => p.id === kp.piece_id && p.kit_only);
        if (!child) continue;
        placed.add(child.id);
        out.push({ type: "piece", data: child });
      }
    }
    return out;
  };

  const persist = async (next: Item[]) => {
    setSaving(true);
    try {
      setItems(next);
      await onReorder(expandRows(next));
      setSelected([]);
      lastClickedIndex.current = null;
    } finally {
      setSaving(false);
    }
  };

  /** Optimistic reorder: UI updates instantly, persistence runs in background. */
  const persistOptimistic = (next: Item[]) => {
    const prev = items;
    setItems(next);
    pendingRef.current = true;
    Promise.resolve(onReorder(expandRows(next)))
      .catch((err) => {
        console.error("Falha ao gravar a nova ordem:", err);
        setItems(prev);
        toast.error("Não foi possível salvar a nova ordem.");
      })
      .finally(() => {
        pendingRef.current = false;
      });
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const isBlock = selectedSet.has(activeIdStr) && selected.length > 1;

    if (!isBlock) {
      const from = items.findIndex((i) => i.id === activeIdStr);
      const to = items.findIndex((i) => i.id === overIdStr);
      if (from === -1 || to === -1) return;
      if (selectedSet.has(activeIdStr) === false && selected.length > 0) {
        setSelected([]);
        lastClickedIndex.current = null;
      }
      persistOptimistic(arrayMove(items, from, to));
      return;
    }

    // Move the whole selected block, preserving relative order, to the drop position.
    if (selectedSet.has(overIdStr)) return;
    const block = items.filter((i) => selectedSet.has(i.id));
    const rest = items.filter((i) => !selectedSet.has(i.id));
    const overIdx = rest.findIndex((i) => i.id === overIdStr);
    if (overIdx === -1) return;
    const activeIdx = items.findIndex((i) => i.id === activeIdStr);
    const overOriginalIdx = items.findIndex((i) => i.id === overIdStr);
    const insertAt = overOriginalIdx > activeIdx ? overIdx + 1 : overIdx;
    persistOptimistic([...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)]);
  };

  const applyMove = async (target: Parameters<typeof buildMoved>[0]) => {
    const next = buildMoved(target);
    if (!next) return;
    await persist(next);
  };


  const groupByLocation = async () => {
    const groups = new Map<string, Item[]>();
    items.forEach((i) => {
      const arr = groups.get(i.location) ?? [];
      arr.push(i);
      groups.set(i.location, arr);
    });
    const keys = Array.from(groups.keys()).sort((a, b) => {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
    });
    await persist(keys.flatMap((k) => groups.get(k)!));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Organizar peças e kits</DialogTitle>
          <DialogDescription>
            Selecione várias linhas (use shift para intervalos) e mova-as em bloco. A ordem é gravada imediatamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 pb-2 border-b">
          <Button size="sm" variant="outline" onClick={() => setSelected(items.map((i) => i.id))} disabled={saving}>
            Selecionar tudo
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelected([])} disabled={saving || selected.length === 0}>
            Limpar seleção
          </Button>
          <Select value="" onValueChange={selectByLocation}>
            <SelectTrigger className="h-8 w-[220px] text-xs">
              <SelectValue placeholder="Selecionar por Localização" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc || NO_LOCATION} value={loc || NO_LOCATION} className="text-xs">
                  {loc || "Sem localização"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={groupByLocation} disabled={saving}>
            <Layers className="w-3.5 h-3.5 mr-1.5" /> Agrupar por Localização
          </Button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto -mx-1 px-1">
          {items.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">Nenhuma peça ou kit.</div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              autoScroll={{ enabled: true }}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveId(null)}
            >
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col divide-y">
                  {items.map((item, index) => (
                    <SortableItemRow
                      key={item.id}
                      item={item}
                      selected={selectedSet.has(item.id)}
                      dragging={activeId === item.id}
                      blockDrag={activeId !== null && selectedSet.has(activeId) && selected.length > 1 && selectedSet.has(item.id)}
                      onToggle={(shiftKey) => toggleRow(index, shiftKey)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>


        {selected.length > 0 && (
          <div className="border-t pt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium mr-1">{selected.length} selecionado(s)</span>
            <Button size="sm" variant="outline" onClick={() => applyMove("top")} disabled={saving}>
              <ArrowUpToLine className="w-3.5 h-3.5 mr-1.5" /> Mover para o topo
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyMove("bottom")} disabled={saving}>
              <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" /> Mover para o fim
            </Button>
            <MoveRelativeButton
              label="Mover para antes de…"
              items={items.filter((i) => !selectedSet.has(i.id))}
              disabled={saving}
              onPick={(refId) => applyMove({ refId, where: "before" })}
            />
            <MoveRelativeButton
              label="Mover para depois de…"
              items={items.filter((i) => !selectedSet.has(i.id))}
              disabled={saving}
              onPick={(refId) => applyMove({ refId, where: "after" })}
            />
            <Button size="sm" variant="ghost" onClick={() => setSelected([])} disabled={saving}>
              <X className="w-3.5 h-3.5 mr-1.5" /> Cancelar seleção
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SortableItemRow({
  item, selected, dragging, blockDrag, onToggle,
}: {
  item: Item;
  selected: boolean;
  dragging: boolean;
  blockDrag: boolean;
  onToggle: (shiftKey: boolean) => void;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging, isOver,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/50 bg-background",
        selected && "bg-accent/50",
        (isDragging || dragging) && "opacity-40",
        blockDrag && !isDragging && "opacity-60",
        isOver && !isDragging && "border-t-2 border-primary",
      )}
      onClick={(e) => onToggle(e.shiftKey)}
    >
      <button
        type="button"
        aria-label="Arrastar para reordenar"
        className="shrink-0 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <Checkbox checked={selected} className="pointer-events-none" />
      <span
        className={cn(
          "text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0",
          item.type === "kit" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {item.type === "kit" ? "KIT" : "PEÇA"}
      </span>
      <span className="font-mono text-xs text-primary w-16 shrink-0 truncate">{item.code || "—"}</span>
      <span className="flex-1 truncate">{item.name}</span>
      <span className="text-xs text-muted-foreground w-40 truncate hidden sm:block">
        {item.location || "—"}
      </span>
    </div>
  );
}


function MoveRelativeButton({
  label, items, disabled, onPick,
}: {
  label: string;
  items: Item[];
  disabled?: boolean;
  onPick: (refId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <Package className="w-3.5 h-3.5 mr-1.5" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por código ou nome..." />
          <CommandList>
            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            <CommandGroup>
              {items.map((i) => (
                <CommandItem
                  key={i.id}
                  value={`${i.code} ${i.name}`}
                  onSelect={() => {
                    setOpen(false);
                    onPick(i.id);
                  }}
                >
                  <span className="font-mono text-xs text-primary mr-2">{i.code || "—"}</span>
                  <span className="truncate">{i.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
