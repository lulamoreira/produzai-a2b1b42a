import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, ArrowUpDown, GripVertical, Check, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getStateColor } from "@/lib/stateColors";
import type { ClientStore } from "@/hooks/useMultiClientData";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, horizontalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

// ─── Column definitions ──────────────────────────────────

export type ColumnDef = {
  key: string;
  label: string;
  storeField: string;
  fieldType?: "text" | "number" | "date" | "boolean";
};

const BASE_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Nome", storeField: "name" },
  { key: "nickname", label: "Apelido", storeField: "nickname" },
  { key: "store_code", label: "Código", storeField: "store_code" },
  { key: "cnpj", label: "CNPJ", storeField: "cnpj" },
  { key: "state_registration", label: "Inscrição Estadual", storeField: "state_registration" },
  { key: "zip_code", label: "CEP", storeField: "zip_code" },
  { key: "street", label: "Rua", storeField: "street" },
  { key: "number", label: "Nº", storeField: "number" },
  { key: "complement", label: "Complemento", storeField: "complement" },
  { key: "neighborhood", label: "Bairro", storeField: "neighborhood" },
  { key: "city", label: "Cidade", storeField: "city" },
  { key: "state", label: "UF", storeField: "state" },
  { key: "country", label: "País", storeField: "country" },
  { key: "store_model", label: "Modelo", storeField: "store_model" },
  { key: "phone", label: "Telefone", storeField: "phone" },
  { key: "email", label: "E-mail", storeField: "email" },
  { key: "manager_name", label: "Contato", storeField: "manager_name" },
  { key: "showcase_count", label: "Qtd. Vitrines", storeField: "showcase_count" },
  { key: "observations", label: "Observações", storeField: "observations" },
];

function buildColumns(customFieldLabels: { label: string; index: number; type?: string }[]): ColumnDef[] {
  const cols = [...BASE_COLUMNS];
  customFieldLabels.forEach(({ label, index, type }) => {
    if (label) {
      cols.push({
        key: `custom_field_${index}`,
        label,
        storeField: `custom_field_${index}`,
        fieldType: (type as ColumnDef["fieldType"]) || "text",
      });
    }
  });
  return cols;
}

// ─── LocalStorage helpers ────────────────────────────────

function loadColumnOrder(clientId: string): string[] | null {
  try {
    const raw = localStorage.getItem(`store_col_order_${clientId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveColumnOrder(clientId: string, order: string[]) {
  localStorage.setItem(`store_col_order_${clientId}`, JSON.stringify(order));
}

// ─── Draggable Header Cell ──────────────────────────────

function DraggableHeaderCell({
  col, sortKey, sortDir, onSort,
}: {
  col: ColumnDef;
  sortKey: string;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.key });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
    whiteSpace: "nowrap",
  };

  return (
    <TableHead ref={setNodeRef} style={style}>
      <div className="flex items-center gap-0.5">
        <button
          className="cursor-grab active:cursor-grabbing touch-none p-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3 h-3" />
        </button>
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer select-none text-xs font-medium"
          onClick={() => onSort(col.key)}
        >
          {col.label}
          {sortKey === col.key ? (
            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-30" />
          )}
        </button>
      </div>
    </TableHead>
  );
}

// ─── Editable Cell ──────────────────────────────────────

function EditableCell({
  value,
  storeId,
  fieldKey,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onNavigate,
  cellRef,
  suggestions,
}: {
  value: string;
  storeId: string;
  fieldKey: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (storeId: string, field: string, value: string) => void;
  onCancel: () => void;
  onNavigate: (dir: "up" | "down" | "left" | "right") => void;
  cellRef: (el: HTMLElement | null) => void;
  suggestions: string[];
}) {
  const [editValue, setEditValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      setEditValue(value);
      savingRef.current = false;
      setTimeout(() => {
        inputRef.current?.focus();
        setShowSuggestions(true);
      }, 0);
    } else {
      setShowSuggestions(false);
    }
  }, [isEditing, value]);

  const filteredSuggestions = useMemo(() => {
    const q = editValue.toLowerCase().trim();
    if (!q) return suggestions;
    return suggestions.filter((s) => s.toLowerCase().includes(q));
  }, [suggestions, editValue]);

  const doSave = useCallback((val: string, navigate?: "up" | "down" | "left" | "right") => {
    if (savingRef.current) return;
    savingRef.current = true;
    onSave(storeId, fieldKey, val);
    if (navigate) {
      onNavigate(navigate);
    } else {
      onCancel(); // close cell when not navigating
    }
  }, [storeId, fieldKey, onSave, onNavigate, onCancel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      doSave(editValue, e.key === "Tab" ? (e.shiftKey ? "left" : "right") : (e.shiftKey ? "up" : "down"));
    } else if (e.key === "Escape") {
      onCancel();
    } else if (e.key === "ArrowUp" && !showSuggestions) {
      e.preventDefault();
      doSave(editValue, "up");
    } else if (e.key === "ArrowDown" && !showSuggestions) {
      e.preventDefault();
      doSave(editValue, "down");
    }
  };

  const handleSelectSuggestion = (val: string) => {
    setEditValue(val);
    setShowSuggestions(false);
    // Save but keep cell open so user can continue editing or navigate
    savingRef.current = false;
    onSave(storeId, fieldKey, val);
    // Re-focus input
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  if (isEditing) {
    return (
      <div ref={(el) => { cellRef(el); (wrapperRef as any).current = el; }} className="relative">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            setShowSuggestions(true);
          }}
          onKeyDown={handleKeyDown}
          onBlur={(e) => {
            // Don't blur if clicking a suggestion
            if (wrapperRef.current?.contains(e.relatedTarget as Node)) return;
            doSave(editValue);
          }}
          className="h-7 text-xs min-w-[60px] px-1.5"
          autoComplete="off"
        />
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-50 mt-0.5 w-full min-w-[120px] max-h-[160px] overflow-y-auto rounded-md border border-border bg-popover shadow-md">
            {filteredSuggestions.map((item) => (
              <button
                key={item}
                type="button"
                tabIndex={-1}
                className={cn(
                  "w-full text-left px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer",
                  item === editValue && "bg-accent/50 font-medium"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectSuggestion(item);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={cellRef}
      className="cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5 min-h-[28px] flex items-center text-xs transition-colors"
      onClick={onStartEdit}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          onStartEdit();
        }
      }}
    >
      {value || <span className="text-muted-foreground/40">—</span>}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────

type Props = {
  stores: ClientStore[];
  clientId: string;
  customFieldLabels: { label: string; index: number; type?: string }[];
  canEdit: boolean;
  onUpdateStore: (data: { id: string } & Partial<ClientStore>) => Promise<void>;
  onOpenEditStore?: (store: ClientStore) => void;
  storeSearch: string;
  storeStateFilter: string;
  onDisplayOrderChange?: (stores: ClientStore[]) => void;
};

export default function StoresMatrixTable({
  stores,
  clientId,
  customFieldLabels,
  canEdit,
  onUpdateStore,
  onOpenEditStore,
  storeSearch,
  storeStateFilter,
  onDisplayOrderChange,
}: Props) {
  const allColumns = useMemo(() => buildColumns(customFieldLabels), [customFieldLabels]);

  // Column order
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = loadColumnOrder(clientId);
    if (saved) {
      // Merge: add new columns not in saved, remove old ones
      const allKeys = new Set(allColumns.map((c) => c.key));
      const ordered = saved.filter((k) => allKeys.has(k));
      allColumns.forEach((c) => { if (!ordered.includes(c.key)) ordered.push(c.key); });
      return ordered;
    }
    return allColumns.map((c) => c.key);
  });

  // Update column order when custom fields change
  useEffect(() => {
    setColumnOrder((prev) => {
      const allKeys = new Set(allColumns.map((c) => c.key));
      const ordered = prev.filter((k) => allKeys.has(k));
      allColumns.forEach((c) => { if (!ordered.includes(c.key)) ordered.push(c.key); });
      return ordered;
    });
  }, [allColumns]);

  const orderedColumns = useMemo(() => {
    const colMap = new Map(allColumns.map((c) => [c.key, c]));
    return columnOrder.map((k) => colMap.get(k)!).filter(Boolean);
  }, [columnOrder, allColumns]);

  // Sort
  const [sortKey, setSortKey] = useState("state");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // Filter + sort stores
  const filteredStores = useMemo(() => {
    return stores
      .filter((s) => {
        if (storeStateFilter && storeStateFilter !== "all" && s.state?.trim() !== storeStateFilter) return false;
        const q = storeSearch.toLowerCase();
        return !q || s.name.toLowerCase().includes(q) ||
          s.nickname?.toLowerCase().includes(q) ||
          s.city?.toLowerCase().includes(q) ||
          s.store_code?.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const valA = ((a as any)[sortKey] || "").toString().toLowerCase();
        const valB = ((b as any)[sortKey] || "").toString().toLowerCase();
        const cmp = valA.localeCompare(valB);
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [stores, storeSearch, storeStateFilter, sortKey, sortDir]);

  // Notify parent of current display order
  useEffect(() => {
    onDisplayOrderChange?.(filteredStores);
  }, [filteredStores, onDisplayOrderChange]);


  const [editingCell, setEditingCell] = useState<{ storeId: string; field: string } | null>(null);
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());

  const getCellKey = (storeId: string, field: string) => `${storeId}__${field}`;

  const navigateToCell = useCallback((dir: "up" | "down" | "left" | "right") => {
    if (!editingCell) return;
    const storeIdx = filteredStores.findIndex((s) => s.id === editingCell.storeId);
    const colIdx = orderedColumns.findIndex((c) => c.storeField === editingCell.field);
    if (storeIdx === -1 || colIdx === -1) return;

    let newStoreIdx = storeIdx;
    let newColIdx = colIdx;

    if (dir === "up") newStoreIdx = Math.max(0, storeIdx - 1);
    else if (dir === "down") newStoreIdx = Math.min(filteredStores.length - 1, storeIdx + 1);
    else if (dir === "left") newColIdx = Math.max(0, colIdx - 1);
    else if (dir === "right") newColIdx = Math.min(orderedColumns.length - 1, colIdx + 1);

    const newStore = filteredStores[newStoreIdx];
    const newCol = orderedColumns[newColIdx];
    if (newStore && newCol) {
      setEditingCell({ storeId: newStore.id, field: newCol.storeField });
    }
  }, [editingCell, filteredStores, orderedColumns]);

  const handleSave = useCallback(async (storeId: string, field: string, value: string) => {
    const store = stores.find((s) => s.id === storeId);
    if (!store) return;
    const oldValue = ((store as any)[field] || "").toString();
    if (value === oldValue) return;
    try {
      await onUpdateStore({ id: storeId, [field]: value || null });
    } catch {
      // error handled by mutation
    }
  }, [stores, onUpdateStore]);

  const handleCancel = () => setEditingCell(null);

  // DnD for columns
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumnOrder((prev) => {
      const oldIdx = prev.indexOf(active.id as string);
      const newIdx = prev.indexOf(over.id as string);
      const next = arrayMove(prev, oldIdx, newIdx);
      saveColumnOrder(clientId, next);
      return next;
    });
  };

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)})${d.slice(2)}`;
    return `(${d.slice(0, 2)})${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const getCellDisplay = (store: ClientStore, col: ColumnDef) => {
    const val = (store as any)[col.storeField];
    if (col.fieldType === "boolean") return val === "true" || val === true ? "Sim" : "Não";
    if (!val) return "";
    if (col.storeField === "phone") return formatPhone(val);
    return val;
  };

  return (
    <div className="border border-border rounded-lg overflow-x-auto">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <Table className="min-w-[1200px]">
          <TableHeader>
            <TableRow>
              <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                {orderedColumns.map((col) => (
                  <DraggableHeaderCell
                    key={col.key}
                    col={col}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                ))}
              </SortableContext>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStores.map((store) => (
              <TableRow key={store.id}>
                {orderedColumns.map((col) => {
                  const isNameCol = col.storeField === "name";
                  const isEditingThis = editingCell?.storeId === store.id && editingCell?.field === col.storeField;
                  const displayVal = getCellDisplay(store, col);

                  if (isNameCol) {
                    return (
                      <TableCell key={col.key} className="font-medium">
                        <button
                          type="button"
                          className="text-left hover:underline underline-offset-2 transition-colors cursor-pointer px-2 py-0.5 rounded-md text-xs"
                          style={{ backgroundColor: getStateColor(store.state).bg, color: getStateColor(store.state).text }}
                          onClick={() => onOpenEditStore?.(store)}
                        >
                          {store.name}
                        </button>
                      </TableCell>
                    );
                  }

                  // Boolean field: render as Switch
                  if (col.fieldType === "boolean") {
                    const boolVal = (store as any)[col.storeField];
                    const isTrue = boolVal === "true" || boolVal === true;
                    return (
                      <TableCell key={col.key} className="p-1">
                        {canEdit ? (
                          <div className="flex items-center justify-center gap-1.5 px-1 py-0.5 min-h-[28px]">
                            <Switch
                              checked={isTrue}
                              onCheckedChange={(checked) => {
                                handleSave(store.id, col.storeField, checked ? "true" : "false");
                              }}
                              className="scale-75"
                            />
                            <span className="text-xs text-muted-foreground">{isTrue ? "Sim" : "Não"}</span>
                          </div>
                        ) : (
                          <span className="text-xs px-1">{isTrue ? "Sim" : "Não"}</span>
                        )}
                      </TableCell>
                    );
                  }

                  if (!canEdit) {
                    return (
                      <TableCell key={col.key} className="text-xs">
                        {displayVal || "—"}
                      </TableCell>
                    );
                  }

                  const fieldSuggestions = (() => {
                    const vals = new Set<string>();
                    stores.forEach((s) => {
                      const v = ((s as any)[col.storeField] || "").toString().trim();
                      if (v && s.id !== store.id) vals.add(v);
                    });
                    return Array.from(vals).sort((a, b) => a.localeCompare(b));
                  })();

                  return (
                    <TableCell key={col.key} className="p-1">
                      <EditableCell
                        value={(store as any)[col.storeField] || ""}
                        storeId={store.id}
                        fieldKey={col.storeField}
                        isEditing={isEditingThis}
                        onStartEdit={() => setEditingCell({ storeId: store.id, field: col.storeField })}
                        onSave={handleSave}
                        onCancel={handleCancel}
                        onNavigate={navigateToCell}
                        suggestions={fieldSuggestions}
                        cellRef={(el) => {
                          const key = getCellKey(store.id, col.storeField);
                          if (el) cellRefs.current.set(key, el);
                          else cellRefs.current.delete(key);
                        }}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DndContext>
    </div>
  );
}
