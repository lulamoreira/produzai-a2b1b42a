import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GripVertical, MapPin } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** All distinct locations (already de-duplicated, in current order). The "no location" bucket comes last with id `__none__`. */
  locations: string[];
  /** Map: location name -> count of pieces/kits in that location. */
  countsByLocation: Record<string, number>;
  /** Called with the user-defined ordering of location names (in order). */
  onApply: (orderedLocations: string[]) => Promise<void> | void;
}

const NONE_KEY = "__none__";
const NONE_LABEL = "Sem localização";

function SortableLocation({ id, label, count }: { id: string; label: string; count: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 select-none",
        isDragging && "opacity-60 shadow-md",
      )}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        aria-label="Arrastar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <MapPin className="w-4 h-4 text-primary shrink-0" />
      <span className="flex-1 text-sm font-medium truncate">{label}</span>
      <span className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
        {count} {count === 1 ? "item" : "itens"}
      </span>
    </div>
  );
}

export function OrderByLocationDialog({
  open,
  onOpenChange,
  locations,
  countsByLocation,
  onApply,
}: Props) {
  // Internal order (uses NONE_KEY for the "no location" bucket)
  const initialOrder = useMemo(() => {
    return locations.map((l) => (l ? l : NONE_KEY));
  }, [locations]);

  const [order, setOrder] = useState<string[]>(initialOrder);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setOrder(initialOrder);
  }, [open, initialOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    setOrder(arrayMove(order, oldIndex, newIndex));
  };

  const handleApply = async () => {
    setSaving(true);
    try {
      // Map back NONE_KEY → ""
      const mapped = order.map((k) => (k === NONE_KEY ? "" : k));
      await onApply(mapped);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Ordenar por localização</DialogTitle>
          <DialogDescription>
            Arraste as localizações para definir a ordem. Peças e kits da mesma localização serão agrupados e ordenados alfabeticamente pelo nome. Ao confirmar, a nova ordem será aplicada às Peças e ao Rateio, e <strong>todos os códigos serão recodificados sequencialmente</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {order.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Nenhuma localização disponível.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2">
                  {order.map((key) => {
                    const label = key === NONE_KEY ? NONE_LABEL : key;
                    const count = countsByLocation[key === NONE_KEY ? "" : key] || 0;
                    return <SortableLocation key={key} id={key} label={label} count={count} />;
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={saving || order.length === 0}>
            {saving ? "Aplicando..." : "Aplicar ordem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
