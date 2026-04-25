import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TableHead, TableRow } from "@/components/ui/table";
import { GripVertical } from "lucide-react";

export type LocationGroup = {
  /** Identificador estável do grupo: nome da localização */
  key: string;
  label: string;
  span: number;
};

interface SortableLocationHeaderProps {
  groups: LocationGroup[];
  canEdit: boolean;
  onReorder: (newOrder: string[]) => void;
}

function SortableGroupCell({ group, canEdit }: { group: LocationGroup; canEdit: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.key,
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      colSpan={group.span}
      className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-l border-border py-1 select-none"
    >
      <div className="flex items-center justify-center gap-1">
        {canEdit && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground transition-colors"
            aria-label={`Reordenar ${group.label}`}
          >
            <GripVertical className="w-3 h-3" />
          </button>
        )}
        <span>{group.label}</span>
      </div>
    </TableHead>
  );
}

export function SortableLocationHeader({ groups, canEdit, onReorder }: SortableLocationHeaderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = groups.findIndex(g => g.key === active.id);
    const newIndex = groups.findIndex(g => g.key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(groups, oldIndex, newIndex).map(g => g.key);
    onReorder(reordered);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <TableRow className="bg-muted/30">
        <TableHead className="sticky left-0 bg-muted/30 z-[5]" />
        <SortableContext items={groups.map(g => g.key)} strategy={horizontalListSortingStrategy}>
          {groups.map((g) => (
            <SortableGroupCell key={g.key} group={g} canEdit={canEdit} />
          ))}
        </SortableContext>
        <TableHead />
      </TableRow>
    </DndContext>
  );
}
