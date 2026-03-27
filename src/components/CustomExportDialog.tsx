import { useState, useCallback, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical, Download, ArrowDown, ArrowRight } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as XLSX from "xlsx";
import { buildExportFileName } from "@/lib/exportFileName";

// ─── Types ──────────────────────────────────────────────

export interface ExportFieldDef {
  key: string;
  label: string;
  getValue: (item: any) => string | number;
}

export interface CustomExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: ExportFieldDef[];
  data: any[];
  fileName: string;
  sheetName?: string;
  agencyName?: string;
  clientName?: string;
}

// ─── Sortable Field Item ────────────────────────────────

function SortableFieldItem({
  field,
  selected,
  onToggle,
}: {
  field: ExportFieldDef;
  selected: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.key });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors"
    >
      <button
        className="cursor-grab active:cursor-grabbing touch-none p-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        className="shrink-0"
      />
      <span className="text-sm flex-1">{field.label}</span>
    </div>
  );
}

// ─── Main Dialog ────────────────────────────────────────

export default function CustomExportDialog({
  open,
  onOpenChange,
  title,
  fields,
  data,
  fileName,
  sheetName = "Dados",
}: CustomExportDialogProps) {
  const [fieldOrder, setFieldOrder] = useState<string[]>(() => fields.map((f) => f.key));
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set(fields.map((f) => f.key)));
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");

  // Sync field order when fields change
  const orderedFields = useMemo(() => {
    const fieldMap = new Map(fields.map((f) => [f.key, f]));
    // Merge: keep existing order, add new fields at end
    const allKeys = new Set(fields.map((f) => f.key));
    const ordered = fieldOrder.filter((k) => allKeys.has(k));
    fields.forEach((f) => {
      if (!ordered.includes(f.key)) ordered.push(f.key);
    });
    if (ordered.length !== fieldOrder.length || ordered.some((k, i) => k !== fieldOrder[i])) {
      // Don't setState during render — just compute
    }
    return ordered.map((k) => fieldMap.get(k)!).filter(Boolean);
  }, [fields, fieldOrder]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFieldOrder((prev) => {
      const oldIdx = prev.indexOf(active.id as string);
      const newIdx = prev.indexOf(over.id as string);
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const toggleField = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = () => setSelectedKeys(new Set(fields.map((f) => f.key)));
  const deselectAll = () => setSelectedKeys(new Set());

  const selectedFields = useMemo(() => {
    return orderedFields.filter((f) => selectedKeys.has(f.key));
  }, [orderedFields, selectedKeys]);

  const handleExport = () => {
    if (selectedFields.length === 0) return;

    const wb = XLSX.utils.book_new();

    if (orientation === "horizontal") {
      // Normal: rows = items, columns = fields
      const rows = data.map((item) => {
        const row: Record<string, string | number> = {};
        selectedFields.forEach((f) => {
          row[f.label] = f.getValue(item);
        });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [Object.fromEntries(selectedFields.map((f) => [f.label, ""]))]);
      ws["!cols"] = selectedFields.map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    } else {
      // Vertical: rows = fields, columns = items
      const wsData: (string | number)[][] = [];

      // Header row (item identifiers — use first field as label or index)
      const headerRow: (string | number)[] = ["Campo"];
      data.forEach((_, i) => {
        // Use first selected field as column header
        headerRow.push(selectedFields.length > 0 ? String(selectedFields[0].getValue(data[i])) : `Item ${i + 1}`);
      });
      wsData.push(headerRow);

      // Each selected field becomes a row
      selectedFields.forEach((f) => {
        const row: (string | number)[] = [f.label];
        data.forEach((item) => {
          row.push(f.getValue(item));
        });
        wsData.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = [{ wch: 25 }, ...data.map(() => ({ wch: 18 }))];
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    }

    XLSX.writeFile(wb, buildExportFileName(fileName, { agencyName, clientName }));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Selecione, reordene e escolha a orientação dos dados para exportar.
          </DialogDescription>
        </DialogHeader>

        {/* Orientation toggle */}
        <div className="flex items-center gap-4 px-1 py-2">
          <span className="text-sm font-medium text-muted-foreground">Orientação:</span>
          <div className="flex items-center gap-2">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                orientation === "horizontal"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
              onClick={() => setOrientation("horizontal")}
            >
              <ArrowRight className="w-3.5 h-3.5" /> Horizontal
            </button>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                orientation === "vertical"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
              onClick={() => setOrientation("vertical")}
            >
              <ArrowDown className="w-3.5 h-3.5" /> Vertical
            </button>
          </div>
        </div>

        {/* Select all / none */}
        <div className="flex items-center gap-2 px-1">
          <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={selectAll}>
            Selecionar todos
          </Button>
          <span className="text-muted-foreground text-xs">·</span>
          <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={deselectAll}>
            Limpar seleção
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {selectedKeys.size}/{fields.length} campos
          </span>
        </div>

        {/* Draggable field list */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedFields.map((f) => f.key)} strategy={verticalListSortingStrategy}>
              {orderedFields.map((field) => (
                <SortableFieldItem
                  key={field.key}
                  field={field}
                  selected={selectedKeys.has(field.key)}
                  onToggle={() => toggleField(field.key)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Export button */}
        <div className="pt-3 border-t border-border">
          <Button
            className="w-full gap-2"
            onClick={handleExport}
            disabled={selectedKeys.size === 0}
          >
            <Download className="w-4 h-4" />
            Exportar {data.length} registro(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
