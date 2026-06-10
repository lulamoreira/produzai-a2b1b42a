import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  ArrowUp, ArrowDown, ArrowUpDown, GripVertical, Check, X, ChevronsRight, 
  ClipboardPaste, AlertTriangle, Info, Wrench, Package
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  { key: "tipo_entrega", label: "Entrega", storeField: "tipo_entrega", fieldType: "text" },
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

function loadColumnOrder(id: string): string[] | null {
  try {
    const raw = localStorage.getItem(`store_col_order_${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveColumnOrder(id: string, order: string[]) {
  localStorage.setItem(`store_col_order_${id}`, JSON.stringify(order));
}

function loadSortState(id: string): { key: string; dir: "asc" | "desc" } | null {
  try {
    const raw = localStorage.getItem(`store_sort_state_${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSortState(id: string, state: { key: string; dir: "asc" | "desc" }) {
  localStorage.setItem(`store_sort_state_${id}`, JSON.stringify(state));
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

  // First column ("name") is sticky on the left and needs an opaque bg so scrolling
  // doesn't bleed cells underneath. We also paint the header opaque for the sticky-top header.
  const isFirstCol = col.storeField === "name";

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700",
        isFirstCol && "sticky left-0 z-[11] shadow-[1px_0_0_0_rgba(0,0,0,0.1)]",
      )}
    >
      <div className="flex items-center gap-0.5">
        <button
          className="cursor-grab active:cursor-grabbing touch-none p-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          {...attributes}
          {...listeners}
          onPointerDown={(e) => {
            e.stopPropagation();
            listeners?.onPointerDown?.(e as any);
          }}
        >
          <GripVertical className="w-3 h-3" />
        </button>
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer select-none text-xs font-medium"
          onClick={() => onSort(col.key)}
        >
          {col.label}
          {col.storeField === "tipo_entrega" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-muted-foreground/70" />
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">Frete + Instalação ou Frete Apenas</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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

// ─── Editable Cell (memoized) ───────────────────────────

interface EditableCellProps {
  value: string;
  storeId: string;
  fieldKey: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (storeId: string, field: string, value: string) => void;
  onCancel: () => void;
  onNavigate: (dir: "up" | "down" | "left" | "right") => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  cellRef: (el: HTMLElement | null) => void;
  suggestions: string[];
}

const EditableCell = React.memo(function EditableCell({
  value,
  storeId,
  fieldKey,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onNavigate,
  onPaste,
  cellRef,
  suggestions,
}: EditableCellProps) {
  const [editValue, setEditValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);

  // Only sync external value when NOT editing (prevents reset during typing)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditValue(value);
      savingRef.current = false;
      // Use rAF for smoother focus
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        setShowSuggestions(true);
      });
    } else {
      setShowSuggestions(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

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
      onCancel();
    }
  }, [storeId, fieldKey, onSave, onNavigate, onCancel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
  }, [doSave, editValue, onCancel, showSuggestions]);

  const handleSelectSuggestion = useCallback((val: string) => {
    setEditValue(val);
    setShowSuggestions(false);
    savingRef.current = false;
    onSave(storeId, fieldKey, val);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [onSave, storeId, fieldKey]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
    setShowSuggestions(true);
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (wrapperRef.current?.contains(e.relatedTarget as Node)) return;
    doSave(editValue);
  }, [doSave, editValue]);

  if (isEditing) {
    return (
      <div ref={(el) => { cellRef(el); (wrapperRef as any).current = el; }} className="relative">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onPaste={onPaste}
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
      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 py-0.5 min-h-[28px] flex items-center text-xs text-gray-900 dark:text-gray-100 transition-colors"
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
});

// ─── Main component ─────────────────────────────────────

type Props = {
  stores: ClientStore[];
  clientId: string;
  campaignId?: string;
  customFieldLabels: { label: string; index: number; type?: string }[];
  canEdit: boolean;
  onUpdateStore: (data: { id: string } & Partial<ClientStore>) => Promise<void>;
  onOpenEditStore?: (store: ClientStore) => void;
  storeSearch: string;
  storeStateFilter: string;
  onDisplayOrderChange?: (stores: ClientStore[]) => void;
  disableInternalSort?: boolean;
};

export default function StoresMatrixTable({
  stores,
  clientId,
  campaignId,
  customFieldLabels,
  canEdit,
  onUpdateStore,
  onOpenEditStore,
  storeSearch,
  storeStateFilter,
  onDisplayOrderChange,
  disableInternalSort = false,
}: Props) {
  const persistenceId = campaignId ? `campaign_${campaignId}` : `client_${clientId}`;

  const allColumns = useMemo(() => buildColumns(customFieldLabels), [customFieldLabels]);

  // Column order
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = loadColumnOrder(persistenceId);
    if (saved) {
      const allKeys = new Set(allColumns.map((c) => c.key));
      const ordered = saved.filter((k) => allKeys.has(k));
      allColumns.forEach((c) => { if (!ordered.includes(c.key)) ordered.push(c.key); });
      return ordered;
    }
    return allColumns.map((c) => c.key);
  });

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
  const [sortKey, setSortKey] = useState(() => {
    const saved = loadSortState(persistenceId);
    return saved?.key || "state";
  });
  const [sortDir, setSortDir] = useState<"asc" | "desc">(() => {
    const saved = loadSortState(persistenceId);
    return saved?.dir || "asc";
  });

  const handleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      let newDir: "asc" | "desc" = "asc";
      let newKey = key;
      if (prev === key) {
        newDir = sortDir === "asc" ? "desc" : "asc";
        setSortDir(newDir);
        newKey = prev;
      } else {
        setSortDir("asc");
        newKey = key;
      }
      saveSortState(persistenceId, { key: newKey, dir: newDir });
      return newKey;
    });
  }, [sortDir, persistenceId]);


  // Filter + sort stores
  const filteredStores = useMemo(() => {
    const filtered = stores.filter((s) => {
      if (storeStateFilter && storeStateFilter !== "all" && s.state?.trim() !== storeStateFilter) return false;
      const q = storeSearch.toLowerCase().trim();
      return !q || Object.values(s).some(val => 
        (typeof val === 'string' || typeof val === 'number') && 
        val.toString().toLowerCase().includes(q)
      );
    });

    if (disableInternalSort) return filtered;

    return [...filtered].sort((a, b) => {
      const field = orderedColumns.find(c => c.key === sortKey) || allColumns.find(c => c.key === sortKey);
      const storeField = field?.storeField || sortKey;
      
      let valA = (a as any)[storeField];
      let valB = (b as any)[storeField];

      // Handle nulls
      if (valA === null || valA === undefined) valA = "";
      if (valB === null || valB === undefined) valB = "";

      // Detect type from field definition or data
      const fieldType = field?.fieldType;
      
      if (fieldType === "number" || (typeof valA === "number" && typeof valB === "number")) {
        const numA = Number(valA);
        const numB = Number(valB);
        return sortDir === "asc" ? numA - numB : numB - numA;
      }

      // Default to string comparison
      const strA = valA.toString().toLowerCase();
      const strB = valB.toString().toLowerCase();
      const cmp = strA.localeCompare(strB, 'pt-BR', { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });

  }, [stores, storeSearch, storeStateFilter, sortKey, sortDir, disableInternalSort, orderedColumns, allColumns]);

  const lastOrderSigRef = useRef<string>("");
  useEffect(() => {
    const sig = filteredStores.map((s) => s.id).join(",");
    if (sig === lastOrderSigRef.current) return;
    lastOrderSigRef.current = sig;
    onDisplayOrderChange?.(filteredStores);
  }, [filteredStores, onDisplayOrderChange]);

  const [editingCell, setEditingCell] = useState<{ storeId: string; field: string } | null>(null);
  const [anchorCell, setAnchorCell] = useState<{ rowIndex: number; colKey: string } | null>(null);
  const [pastePreview, setPastePreview] = useState<{
    open: boolean;
    changes: Array<{
      storeId: string;
      storeName: string;
      field: string;
      fieldLabel: string;
      oldValue: string;
      newValue: string;
      hasExistingValue: boolean;
    }>;
  }>({ open: false, changes: [] });

  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());

  const getCellKey = (storeId: string, field: string) => `${storeId}__${field}`;

  const parseExcelTSV = (text: string): string[][] => {
    // Normaliza quebras de linha: \r\n e \r viram \n
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Remove linha vazia no final (Excel adiciona \n no final)
    const trimmed = normalized.replace(/\n$/, '');
    
    // Divide em linhas
    const lines = trimmed.split('\n');
    
    // Divide cada linha em colunas por tab
    return lines.map(line => line.split('\t').map(cell => cell.trim()));
  };

  const handleExcelPaste = useCallback((text: string, anchor: { rowIndex: number; colKey: string }) => {
    const parsedData = parseExcelTSV(text);
    if (parsedData.length === 0) return;

    const changes: typeof pastePreview.changes = [];
    const startColIdx = orderedColumns.findIndex(c => c.storeField === anchor.colKey);

    parsedData.forEach((row, rOffset) => {
      const targetStoreIdx = anchor.rowIndex + rOffset;
      if (targetStoreIdx >= filteredStores.length) return;

      const store = filteredStores[targetStoreIdx];

      row.forEach((value, cOffset) => {
        const targetColIdx = startColIdx + cOffset;
        if (targetColIdx >= orderedColumns.length) return;

        const col = orderedColumns[targetColIdx];
        // Only paste into editable fields (skipping name and boolean switches if they shouldn't be bulk pasted)
        // User said "works only in editable columns"
        if (col.storeField === "cnpj" || col.fieldType === "boolean") return;

        const oldValue = ((store as any)[col.storeField] || "").toString();
        if (oldValue === value) return;

        changes.push({
          storeId: store.id,
          storeName: store.name,
          field: col.storeField,
          fieldLabel: col.label,
          oldValue,
          newValue: value,
          hasExistingValue: oldValue !== ""
        });
      });
    });

    if (changes.length > 0) {
      setPastePreview({ open: true, changes });
    } else {
      toast.info("Nenhuma alteração detectada na colagem.");
    }
  }, [filteredStores, orderedColumns]);

  const confirmPaste = async () => {
    const changesByStore = new Map<string, Record<string, any>>();
    
    pastePreview.changes.forEach(change => {
      if (!changesByStore.has(change.storeId)) {
        changesByStore.set(change.storeId, {});
      }
      const storeChanges = changesByStore.get(change.storeId)!;
      const finalValue = change.field === "showcase_count" ? (parseInt(change.newValue, 10) || 0) : (change.newValue || null);
      storeChanges[change.field] = finalValue;
    });

    let successCount = 0;
    let storeCount = 0;
    let failCount = 0;

    setPastePreview(prev => ({ ...prev, open: false }));

    for (const [storeId, fields] of changesByStore.entries()) {
      try {
        await onUpdateStore({ id: storeId, ...fields });
        successCount += Object.keys(fields).length;
        storeCount++;
      } catch (error) {
        console.error("Paste error for store", storeId, error);
        failCount += Object.keys(fields).length;
      }
    }

    if (failCount > 0) {
      toast.error(`Falha ao atualizar ${failCount} células. ${successCount} atualizadas com sucesso.`);
    } else {
      toast.success(`${successCount} células atualizadas em ${storeCount} lojas.`);
    }
    
    setAnchorCell(null);
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!anchorCell || editingCell) return;
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') || '';
      handleExcelPaste(text, anchorCell);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAnchorCell(null);
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorCell, editingCell, handleExcelPaste]);

  const navigateToCell = useCallback((dir: "up" | "down" | "left" | "right") => {
    setEditingCell((prev) => {
      if (!prev) return prev;
      const storeIdx = filteredStores.findIndex((s) => s.id === prev.storeId);
      const colIdx = orderedColumns.findIndex((c) => c.storeField === prev.field);
      if (storeIdx === -1 || colIdx === -1) return prev;

      let newStoreIdx = storeIdx;
      let newColIdx = colIdx;

      if (dir === "up") newStoreIdx = Math.max(0, storeIdx - 1);
      else if (dir === "down") newStoreIdx = Math.min(filteredStores.length - 1, storeIdx + 1);
      else if (dir === "left") newColIdx = Math.max(0, colIdx - 1);
      else if (dir === "right") newColIdx = Math.min(orderedColumns.length - 1, colIdx + 1);

      const newStore = filteredStores[newStoreIdx];
      const newCol = orderedColumns[newColIdx];
      if (newStore && newCol) {
        return { storeId: newStore.id, field: newCol.storeField };
      }
      return prev;
    });
  }, [filteredStores, orderedColumns]);

  // Fire-and-forget save (optimistic update already applied by hook)
  const handleSave = useCallback((storeId: string, field: string, value: string) => {
    const store = stores.find((s) => s.id === storeId);
    if (!store) return;
    const oldValue = ((store as any)[field] || "").toString();
    if (value === oldValue) return;
    const finalValue = field === "showcase_count" ? (parseInt(value, 10) || 0) : (value || null);
    // Don't await — optimistic update handles UI immediately
    onUpdateStore({ id: storeId, [field]: finalValue }).catch(() => {});
  }, [stores, onUpdateStore]);

  const handleCancel = useCallback(() => setEditingCell(null), []);

  // Pre-compute suggestions per field (avoids recomputing per cell on each render)
  const suggestionsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    orderedColumns.forEach((col) => {
      if (col.storeField === "name" || col.fieldType === "boolean") return;
      const vals = new Set<string>();
      stores.forEach((s) => {
        const v = ((s as any)[col.storeField] || "").toString().trim();
        if (v) vals.add(v);
      });
      map[col.storeField] = Array.from(vals).sort((a, b) => a.localeCompare(b));
    });
    return map;
  }, [stores, orderedColumns]);

  // DnD for columns
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumnOrder((prev) => {
      const oldIdx = prev.indexOf(active.id as string);
      const newIdx = prev.indexOf(over.id as string);
      const next = arrayMove(prev, oldIdx, newIdx);
      saveColumnOrder(persistenceId, next);

      // Automatic sorting by the first column after reordering
      if (newIdx === 0 && oldIdx !== 0) {
        const firstColKey = next[0];
        setSortKey(firstColKey);
        setSortDir("asc");
        saveSortState(persistenceId, { key: firstColKey, dir: "asc" });
      }

      return next;
    });
  }, [persistenceId]);


  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)})${d.slice(2)}`;
    return `(${d.slice(0, 2)})${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const getCellDisplay = useCallback((store: ClientStore, col: ColumnDef) => {
    const val = (store as any)[col.storeField];
    if (col.fieldType === "boolean") return val === "true" || val === true ? "Sim" : "Não";
    if (!val) return "";
    if (col.storeField === "phone") return formatPhone(val);
    return val;
  }, []);

  // Stable callback refs for cell editing
  const startEdit = useCallback((storeId: string, field: string) => {
    setEditingCell({ storeId, field });
  }, []);

  const isMobile = useIsMobile();

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden isolate relative">
      <div className="overflow-x-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <Table className="min-w-[1200px] border-collapse">
            <TableHeader className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <TableRow className="hover:bg-transparent border-gray-200 dark:border-gray-700">
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
              {filteredStores.map((store, rowIndex) => (
                <TableRow key={store.id} className="group odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 border-gray-200 dark:border-gray-700">
                  {orderedColumns.map((col) => {
                    const isNameCol = col.storeField === "name";
                    const isEditingThis = editingCell?.storeId === store.id && editingCell?.field === col.storeField;
                    const isAnchor = anchorCell?.rowIndex === rowIndex && anchorCell?.colKey === col.storeField;
                    const displayVal = getCellDisplay(store, col);

                    if (isNameCol) {
                      return (
                        <TableCell
                          key={col.key}
                          className={cn(
                            "font-medium sticky left-0 z-[5] text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700",
                            "bg-white dark:bg-gray-900 group-even:bg-gray-50 dark:group-even:bg-gray-800/50 text-gray-900 dark:text-gray-100 group-hover:bg-gray-100 dark:group-hover:bg-gray-700 transition-colors cursor-cell",
                            "shadow-[1px_0_0_0_rgba(0,0,0,0.1)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)]",
                            isAnchor && "ring-2 ring-inset ring-blue-500 z-[6]"
                          )}
                          onClick={() => setAnchorCell({ rowIndex, colKey: col.storeField })}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="text-left hover:underline underline-offset-2 transition-colors cursor-pointer px-2 py-0.5 rounded-md text-xs"
                              style={{ backgroundColor: getStateColor(store.state).bg, color: getStateColor(store.state).text }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenEditStore?.(store);
                              }}
                            >
                              {store.name}
                            </button>
                          </div>
                        </TableCell>
                      );
                    }

                  if (col.storeField === "tipo_entrega") {
                    const val = (store.tipo_entrega ?? 'frete_instalacao') as string;

                    const CYCLE: Record<string, string> = {
                      frete_instalacao: 'frete_apenas',
                      frete_apenas: 'sem_logistica',
                      sem_logistica: 'frete_instalacao',
                    };

                    const LABELS: Record<string, { label: string; className: string; tooltip: string }> = {
                      frete_instalacao: {
                        label: '📦🔧 Frete + Instalação',
                        className: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200',
                        tooltip: 'Esta loja recebe o material E tem instalação agendada. Clique para alterar.',
                      },
                      frete_apenas: {
                        label: '📦 Frete Apenas',
                        className: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200',
                        tooltip: 'Esta loja recebe apenas o material — sem instalação. Clique para alterar.',
                      },
                      sem_logistica: {
                        label: '🏪 Sem Logística',
                        className: 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200',
                        tooltip: 'Ponto virtual ou retira na agência. Clique para alterar.',
                      },
                    };

                    const current = LABELS[val] ?? LABELS['frete_instalacao'];

                    return (
                      <TableCell 
                        key={col.key} 
                        className={cn(
                          "p-1 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 cursor-cell transition-all", 
                          isAnchor && "ring-2 ring-inset ring-blue-500 z-[6]"
                        )} 
                        onClick={() => setAnchorCell({ rowIndex, colKey: col.storeField })}
                      >
                        <div className="flex items-center justify-center gap-1.5 px-1 py-0.5 min-h-[28px]">
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors border",
                              current.className
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateStore({ id: store.id, tipo_entrega: CYCLE[val] ?? 'frete_instalacao' as any });
                            }}
                            title={current.tooltip}
                          >
                            {current.label}
                          </button>
                        </div>
                      </TableCell>
                    );
                  }

                  // Boolean field: render as Switch
                  if (col.fieldType === "boolean") {
                    const boolVal = (store as any)[col.storeField];
                    const isTrue = boolVal === "true" || boolVal === true;

                    return (
                      <TableCell 
                        key={col.key} 
                        className={cn(
                          "p-1 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 cursor-cell transition-all", 
                          isAnchor && "ring-2 ring-inset ring-blue-500 z-[6]"
                        )} 
                        onClick={() => setAnchorCell({ rowIndex, colKey: col.storeField })}
                      >
                        <div className="flex items-center justify-center gap-1.5 px-1 py-0.5 min-h-[28px]">
                          {canEdit ? (
                            <>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={isTrue}
                                  onCheckedChange={(checked) => {
                                    handleSave(store.id, col.storeField, checked ? "true" : "false");
                                  }}
                                  className="scale-75"
                                />
                                <span className="text-xs text-muted-foreground">{isTrue ? "Sim" : "Não"}</span>
                              </div>

                            </>
                          ) : (
                            <span className="text-xs px-1 text-gray-900 dark:text-gray-100">{isTrue ? "Sim" : "Não"}</span>
                          )}
                        </div>
                      </TableCell>
                    );
                  }

                  if (!canEdit) {
                    return (
                      <TableCell key={col.key} className={cn("text-xs text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700 cursor-cell transition-all px-2", isAnchor && "ring-2 ring-inset ring-blue-500 z-[6]")} onClick={() => setAnchorCell({ rowIndex, colKey: col.storeField })}>
                        <div className="flex items-center justify-between gap-2">
                          <span>{displayVal || "—"}</span>
                        </div>
                      </TableCell>
                    );
                  }


                  return (
                    <TableCell 
                      key={col.key} 
                      className={cn(
                        "p-1 border-gray-200 dark:border-gray-700 transition-all cursor-cell relative",
                        isAnchor && "ring-2 ring-inset ring-blue-500 z-[6]"
                      )}
                      onClick={() => setAnchorCell({ rowIndex, colKey: col.storeField })}
                    >
                      <EditableCell
                        value={((store as any)[col.storeField] || "").toString()}
                        storeId={store.id}
                        fieldKey={col.storeField}
                        isEditing={isEditingThis}
                        onStartEdit={() => startEdit(store.id, col.storeField)}
                        onSave={handleSave}
                        onCancel={handleCancel}
                        onNavigate={navigateToCell}
                        onPaste={(e) => {
                          e.preventDefault();
                          const text = e.clipboardData.getData('text/plain');
                          handleExcelPaste(text, { rowIndex, colKey: col.storeField });
                        }}
                        suggestions={suggestionsMap[col.storeField] || []}
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
      {isMobile && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground px-2 py-1 border-t">
          <ChevronsRight className="w-3 h-3" />
          Deslize para ver mais colunas
        </div>
      )}

      {/* Paste Preview Modal */}
      <AlertDialog open={pastePreview.open} onOpenChange={(open) => !open && setPastePreview(prev => ({ ...prev, open }))}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ClipboardPaste className="w-5 h-5 text-primary" />
              Colar dados do Excel
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pastePreview.changes.length} células serão atualizadas a partir de{" "}
              <strong>{pastePreview.changes[0]?.storeName}</strong> /{" "}
              <strong>{pastePreview.changes[0]?.fieldLabel}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex-1 overflow-auto my-4 border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-muted">
                <TableRow>
                  <TableHead className="text-xs">Loja</TableHead>
                  <TableHead className="text-xs">Campo</TableHead>
                  <TableHead className="text-xs">Valor Atual</TableHead>
                  <TableHead className="text-xs">Novo Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastePreview.changes.slice(0, 10).map((change, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs font-medium">{change.storeName}</TableCell>
                    <TableCell className="text-xs">{change.fieldLabel}</TableCell>
                    <TableCell className="text-xs text-muted-foreground italic">
                      {change.oldValue || "vazio"}
                    </TableCell>
                    <TableCell className={cn(
                      "text-xs font-medium",
                      change.newValue === change.oldValue ? "text-muted-foreground" : "text-primary",
                      change.hasExistingValue && change.newValue !== change.oldValue && "bg-amber-50 text-amber-700 px-1 rounded"
                    )}>
                      {change.newValue === change.oldValue ? (
                        "sem alteração"
                      ) : (
                        <div className="flex items-center gap-1">
                          {change.hasExistingValue && <AlertTriangle className="w-3 h-3" />}
                          {change.newValue}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {pastePreview.changes.length > 10 && (
              <div className="p-2 text-center text-xs text-muted-foreground border-t bg-muted/30">
                ... e mais {pastePreview.changes.length - 10} alterações
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPaste}>
              Confirmar colagem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
