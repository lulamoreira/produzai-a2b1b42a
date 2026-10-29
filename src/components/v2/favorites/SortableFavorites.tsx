import React from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableFavoritesListProps {
  ids: string[];
  layout: "grid" | "vertical";
  onReorder: (ids: string[]) => void;
  children: React.ReactNode;
}

/** Shared drag-and-drop context for reordering campaign favorites. */
export function SortableFavoritesList({ ids, layout, onReorder, children }: SortableFavoritesListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

interface SortableFavoriteItemProps {
  id: string;
  className?: string;
  handleClassName?: string;
  handleSize?: number;
  children: React.ReactNode;
}

/** Sortable wrapper; drag listeners live only on the grip handle so clicks keep working. */
export function SortableFavoriteItem({ id, className, handleClassName, handleSize = 14, children }: SortableFavoriteItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "opacity-50 z-20", className)}
    >
      <button
        type="button"
        aria-label="Arrastar para reordenar"
        title="Arrastar para reordenar"
        className={cn("cursor-grab active:cursor-grabbing touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded", handleClassName)}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        {...attributes}
        {...listeners}
      >
        <GripVertical style={{ width: handleSize, height: handleSize }} />
      </button>
      {children}
    </div>
  );
}
