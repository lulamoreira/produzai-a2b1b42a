import React, { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, GripVertical, Plus, Trash2 } from "lucide-react";
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
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

import {
  useBudgetTimeline,
  useAddTimelineEntry,
  useUpdateTimelineEntry,
  useDeleteTimelineEntry,
  useReorderTimeline,
  type BudgetTimelineEntry,
} from "@/hooks/useBudgetTimeline";

interface BudgetTimelineSectionProps {
  campaignId: string;
}

// ─── Sortable row ────────────────────────────────────────
interface RowProps {
  entry: BudgetTimelineEntry;
  campaignId: string;
  onDelete: (id: string) => void;
}

function TimelineRow({ entry, campaignId, onDelete }: RowProps) {
  const updateEntry = useUpdateTimelineEntry();
  const [date, setDate] = useState<Date | undefined>(
    entry.entry_date ? new Date(entry.entry_date + "T00:00:00") : undefined,
  );
  const [description, setDescription] = useState(entry.description);
  const debounceRef = useRef<number | null>(null);

  // Sync external changes
  useEffect(() => {
    setDate(entry.entry_date ? new Date(entry.entry_date + "T00:00:00") : undefined);
    setDescription(entry.description);
  }, [entry.entry_date, entry.description]);

  const persist = (updates: Partial<Pick<BudgetTimelineEntry, "entry_date" | "description">>) => {
    updateEntry.mutate({ id: entry.id, campaign_id: campaignId, updates });
  };

  const handleDescriptionBlur = () => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (description !== entry.description) {
      persist({ description });
    }
  };

  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      if (val !== entry.description) persist({ description: val });
    }, 500);
  };

  const handleDateChange = (d: Date | undefined) => {
    if (!d) return;
    setDate(d);
    const iso = format(d, "yyyy-MM-dd");
    if (iso !== entry.entry_date) persist({ entry_date: iso });
  };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 p-3 rounded-md border border-border bg-card"
    >
      <button
        type="button"
        className="mt-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
        aria-label="Reordenar"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 min-w-[140px] justify-start text-left font-normal gap-2",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="w-4 h-4" />
            {date ? format(date, "dd/MM/yyyy") : "Data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateChange}
            locale={ptBR}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      <Textarea
        value={description}
        onChange={(e) => handleDescriptionChange(e.target.value)}
        onBlur={handleDescriptionBlur}
        placeholder="Descrição da entrega (ex: Aprovação da arte final)"
        className="flex-1 min-h-[40px] text-sm resize-y"
        rows={1}
      />

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(entry.id)}
        title="Excluir entrega"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────
export default function BudgetTimelineSection({ campaignId }: BudgetTimelineSectionProps) {
  const { data: entries = [] } = useBudgetTimeline(campaignId);
  const addEntry = useAddTimelineEntry();
  const deleteEntry = useDeleteTimelineEntry();
  const reorder = useReorderTimeline();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleAdd = () => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 7);
    addEntry.mutate({
      campaign_id: campaignId,
      entry_date: format(nextDate, "yyyy-MM-dd"),
      description: "",
      display_order: entries.length,
    });
  };

  const handleDelete = (id: string) => {
    deleteEntry.mutate({ id, campaign_id: campaignId });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = entries.findIndex((e) => e.id === active.id);
    const newIndex = entries.findIndex((e) => e.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(entries, oldIndex, newIndex);
    reorder.mutate({
      campaign_id: campaignId,
      entries: reordered.map((e, idx) => ({ id: e.id, display_order: idx })),
    });
  };

  return (
    <Card>
      <CardContent className="pt-5 pb-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Cronograma da Campanha</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Datas e entregas acordadas com o fornecedor
            </p>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma entrega cadastrada. Adicione as datas e descrições do cronograma.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={entries.map((e) => e.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {entries.map((entry) => (
                  <TimelineRow
                    key={entry.id}
                    entry={entry}
                    campaignId={campaignId}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleAdd}>
            <Plus className="w-3.5 h-3.5" />
            Adicionar entrega
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
