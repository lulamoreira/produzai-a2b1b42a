import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, ArrowRight, Check, AlertTriangle, Eye, Save, FolderOpen, Play, Layers, Shield, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { ClientStore, CampaignPiece, CampaignKit } from "@/hooks/useMultiClientData";
import { useAutomationTemplates, type AutomationTemplateItem, type AutomationKind } from "@/hooks/useAutomationTemplates";
import { GroupRunReviewDialog, buildValidations, type TemplateValidation } from "@/components/Matrix/GroupRunReviewDialog";
import { GroupRunErrorDialog, type GroupRunResult } from "@/components/Matrix/GroupRunErrorDialog";
import { applyRateioBulk } from "@/lib/applyRateioBulk";

/* ─── Types ──────────────────────────────────────────────── */

type CustomFieldDef = { key: string; label: string; index: number };

type SelectedItem = AutomationTemplateItem;

type OutsideFilterAction = "keep" | "zero";

type PreviewRow = {
  storeId: string;
  storeName: string;
  group: "update" | "outside_with_value" | "ignored";
  pieceId: string;
  pieceName: string;
  currentQty: number;
  newQty: number;
  action: OutsideFilterAction;
};

type FilterOperator = "igual" | "diferente" | "contem" | "nao_contem";
type FilterCondition = "E" | "OU";

interface AutomationFilter {
  id: string;
  campo: string;
  operador: FilterOperator;
  valor: string;
}

interface FilterGroup {
  filtros: AutomationFilter[];
  condicoes: FilterCondition[];
}

/* ─── Props ──────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  clientId: string;
  stores: ClientStore[];
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: { kit_id: string; piece_id: string; quantity: number }[];
  qtyMap: Record<string, number>;
  customFieldLabels: CustomFieldDef[];
  onComplete: () => void | Promise<void>;
  isNegotiationView?: boolean;
  negotiationSupplierId?: string | null;
  isAdjustmentView?: boolean;
  adjustmentId?: string | null;
  runBulkWithHistory?: (
    label: string,
    upserts: { campaignId: string; storeId: string; pieceId: string; quantity: number }[],
    deletes: { campaignId: string; storeId: string; pieceId: string }[],
  ) => Promise<void>;
}

/* ─── Helpers ────────────────────────────────────────────── */

function createEmptyFilter(): AutomationFilter {
  return { id: crypto.randomUUID(), campo: "", operador: "igual", valor: "" };
}

function avaliarFiltro(store: ClientStore, filtro: AutomationFilter): boolean {
  const valorLoja = String((store as any)[filtro.campo] ?? "").toLowerCase();
  const valorFiltro = filtro.valor.toLowerCase();
  switch (filtro.operador) {
    case "igual": return valorLoja === valorFiltro;
    case "diferente": return valorLoja !== valorFiltro;
    case "contem": return valorLoja.includes(valorFiltro);
    case "nao_contem": return !valorLoja.includes(valorFiltro);
    default: return false;
  }
}

function filtrarLojas(stores: ClientStore[], grupo: FilterGroup): ClientStore[] {
  const validFilters = grupo.filtros.filter(f => f.campo && f.valor);
  if (validFilters.length === 0) return stores;

  return stores.filter(store => {
    const resultados = validFilters.map(f => avaliarFiltro(store, f));
    let resultado = resultados[0];
    for (let i = 0; i < grupo.condicoes.length && i < resultados.length - 1; i++) {
      const op = grupo.condicoes[i];
      const prox = resultados[i + 1];
      if (op === "E") {
        resultado = resultado && prox;
      } else {
        resultado = resultado || prox;
      }
    }
    return resultado;
  });
}

type Operation = "multiply" | "divide";

/** Migrate legacy single-filter template to multi-filter format */
function migrateTemplate(tpl: any): { filtros: AutomationFilter[]; condicoes: FilterCondition[]; operation: Operation } {
  if (tpl.filter_field === "__multi_v2__") {
    try {
      const parsed = JSON.parse(tpl.filter_value);
      const op: Operation = parsed.operation === "divide" ? "divide" : "multiply";
      return { filtros: parsed.filtros || [], condicoes: parsed.condicoes || [], operation: op };
    } catch {
      return { filtros: [createEmptyFilter()], condicoes: [], operation: "multiply" };
    }
  }
  // Legacy single filter
  return {
    filtros: [{
      id: crypto.randomUUID(),
      campo: tpl.filter_field,
      operador: "igual" as FilterOperator,
      valor: tpl.filter_value,
    }],
    condicoes: [],
    operation: "multiply",
  };
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  igual: "é igual a",
  diferente: "é diferente de",
  contem: "contém",
  nao_contem: "não contém",
};

/** Extract display name and type from raw client custom_field label ("Name|type"). */
function parseCustomFieldLabel(raw: string): { name: string; type: "text" | "number" | "date" | "boolean" } {
  if (!raw) return { name: "", type: "text" };
  const [name, t] = raw.split("|");
  const type = (t as any) || "text";
  return {
    name: name || "",
    type: ["text", "number", "date", "boolean"].includes(type) ? type : "text",
  };
}

// AutomationKind imported from useAutomationTemplates

/* ─── Component ──────────────────────────────────────────── */

export default function MatrixAutomationDialog({
  open, onOpenChange, campaignId, clientId,
  stores, pieces, kits, kitPieces, qtyMap,
  customFieldLabels, onComplete,
  isNegotiationView = false, negotiationSupplierId = null,
  isAdjustmentView = false, adjustmentId = null,
  runBulkWithHistory,
}: Props) {
  const { t } = useTranslation();
  const rateioOptions = { isNegotiationView, negotiationSupplierId, isAdjustmentView, adjustmentId };
  const applyBulk = useCallback(async (
    label: string,
    upserts: { campaignId: string; storeId: string; pieceId: string; quantity: number }[],
    deletes: { campaignId: string; storeId: string; pieceId: string }[],
  ) => {
    if (runBulkWithHistory) return runBulkWithHistory(label, upserts, deletes);
    return applyRateioBulk(upserts, deletes, rateioOptions);
  }, [runBulkWithHistory, rateioOptions]);


  const [mainTab, setMainTab] = useState<string>("new");
  const [step, setStep] = useState<1 | 2>(1);

  // Multi-filter state
  const [filterGroup, setFilterGroup] = useState<FilterGroup>({
    filtros: [createEmptyFilter()],
    condicoes: [],
  });

  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [itemSearch, setItemSearch] = useState("");

  // Automation kind: 'fixed' = quantity per item; 'by_field' = computed from store_field
  const [kind, setKind] = useState<AutomationKind>("fixed");
  const [baseField, setBaseField] = useState<string>("");
  const [operation, setOperation] = useState<Operation>("multiply");

  // Replacement mode state
  const [replacementPieceId, setReplacementPieceId] = useState<string>("");
  const [replacementSourceQtys, setReplacementSourceQtys] = useState<number[]>([]);
  const [replacementTargetQty, setReplacementTargetQty] = useState<number>(1);
  const [replaceAnyNonZero, setReplaceAnyNonZero] = useState<boolean>(false);
  const [replacementPieceSearch, setReplacementPieceSearch] = useState<string>("");

  // Reset operation when leaving by_field mode
  useEffect(() => {
    if (kind !== "by_field") setOperation("multiply");
    if (kind !== "replacement") {
      setReplacementPieceId("");
      setReplacementSourceQtys([]);
      setReplacementTargetQty(1);
      setReplaceAnyNonZero(false);
      setReplacementPieceSearch("");
    }
  }, [kind]);

  // Step 2 state
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [outsideActions, setOutsideActions] = useState<Record<string, OutsideFilterAction>>({});
  const [executing, setExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<{
    step: number;
    totalSteps: number;
    label: string;
    details?: string;
  } | null>(null);

  // Overwrite dialog state
  const [overwriteDialog, setOverwriteDialog] = useState<{ open: boolean; count: number }>({ open: false, count: 0 });


  // Save template state
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  // Group state
  const [newGroupName, setNewGroupName] = useState("");
  const [addingTemplateToGroup, setAddingTemplateToGroup] = useState<string | null>(null);

  // Group run review/error state
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; groupId: string; groupName: string; validations: TemplateValidation[] }>({
    open: false, groupId: "", groupName: "", validations: [],
  });
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; groupName: string; groupId: string; results: GroupRunResult[] }>({
    open: false, groupName: "", groupId: "", results: [],
  });

  // Hook
  const {
    templates, saveTemplate, updateTemplate, deleteTemplate,
    groups, saveGroup, deleteGroup,
    groupItems, addToGroup, removeFromGroup, toggleGroupItem,
  } = useAutomationTemplates(campaignId);

  // Editing state: when set, "salvar" updates this template instead of creating a new one
  const [editingId, setEditingId] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setMainTab("new");
      setStep(1);
      setFilterGroup({ filtros: [createEmptyFilter()], condicoes: [] });
      setSelectedItems([]);
      setItemSearch("");
      setPreview([]);
      setOutsideActions({});
      setShowSaveInput(false);
      setSaveName("");
      setNewGroupName("");
      setAddingTemplateToGroup(null);
      setOverwriteDialog({ open: false, count: 0 });
      setKind("fixed");
      setBaseField("");
      setOperation("multiply");
      setReplacementPieceId("");
      setReplacementSourceQtys([]);
      setReplacementTargetQty(1);
      setReplaceAnyNonZero(false);
      setReplacementPieceSearch("");
      setEditingId(null);
    }
  }, [open]);

  // Numeric fields available as the multiplication base (showcase_count + custom Number fields)
  const numericFields = useMemo(() => {
    const list: { key: string; label: string }[] = [
      { key: "showcase_count", label: "Qtd. Vitrines" },
    ];
    for (const cf of customFieldLabels) {
      const parsed = parseCustomFieldLabel(cf.label);
      if (parsed.type === "number") {
        list.push({ key: cf.key, label: parsed.name || cf.label });
      }
    }
    return list;
  }, [customFieldLabels]);

  // All filterable fields
  const allFilterFields = useMemo(() => {
    const standard: { key: string; label: string }[] = [
      { key: "name", label: t("automation.fieldName") },
      { key: "nickname", label: t("automation.fieldNickname") },
      { key: "store_code", label: t("automation.fieldStoreCode") },
      { key: "city", label: t("automation.fieldCity") },
      { key: "state", label: t("automation.fieldState") },
      { key: "store_model", label: t("automation.fieldModel") },
      { key: "neighborhood", label: t("automation.fieldNeighborhood") },
      { key: "country", label: t("automation.fieldCountry") },
      { key: "showcase_count", label: "Qtd. Vitrines" },
    ];
    const custom = customFieldLabels.map(f => ({ key: f.key, label: f.label }));
    return [...standard, ...custom];
  }, [customFieldLabels, t]);

  // Get unique values for a given field
  const getFieldValues = useCallback((campo: string): string[] => {
    if (!campo) return [];
    return [...new Set(
      stores.map(s => String((s as any)[campo] ?? "")).filter(Boolean)
    )].sort();
  }, [stores]);

  // Filtered stores (real-time count)
  const matchingStores = useMemo(() => filtrarLojas(stores, filterGroup), [stores, filterGroup]);

  // Replacement: compute qty distribution for selected piece
  const replacementQtyDistribution = useMemo(() => {
    if (kind !== "replacement" || !replacementPieceId) return [] as { qty: number; count: number }[];
    const countMap = new Map<number, number>();
    for (const store of stores) {
      const qty = qtyMap[`${store.id}-${replacementPieceId}`] || 0;
      if (qty > 0) countMap.set(qty, (countMap.get(qty) || 0) + 1);
    }
    return Array.from(countMap.entries())
      .map(([qty, count]) => ({ qty, count }))
      .sort((a, b) => a.qty - b.qty);
  }, [kind, replacementPieceId, stores, qtyMap]);

  // Replacement: stores affected by current selection
  const replacementAffectedStores = useMemo(() => {
    if (kind !== "replacement" || !replacementPieceId) return [] as ClientStore[];
    return stores.filter(store => {
      const currentQty = qtyMap[`${store.id}-${replacementPieceId}`] || 0;
      if (replaceAnyNonZero) return currentQty > 0;
      return replacementSourceQtys.includes(currentQty);
    });
  }, [kind, replacementPieceId, stores, qtyMap, replaceAnyNonZero, replacementSourceQtys]);

  // Filter update helpers
  const updateFilter = (index: number, patch: Partial<AutomationFilter>) => {
    setFilterGroup(prev => ({
      ...prev,
      filtros: prev.filtros.map((f, i) => i === index ? { ...f, ...patch } : f),
    }));
  };

  const removeFilter = (index: number) => {
    setFilterGroup(prev => {
      const newFiltros = prev.filtros.filter((_, i) => i !== index);
      const newCondicoes = [...prev.condicoes];
      if (index === 0) {
        newCondicoes.splice(0, 1);
      } else {
        newCondicoes.splice(index - 1, 1);
      }
      return { filtros: newFiltros, condicoes: newCondicoes };
    });
  };

  const addFilter = () => {
    setFilterGroup(prev => ({
      filtros: [...prev.filtros, createEmptyFilter()],
      condicoes: [...prev.condicoes, "E"],
    }));
  };

  const updateCondition = (index: number, value: FilterCondition) => {
    setFilterGroup(prev => ({
      ...prev,
      condicoes: prev.condicoes.map((c, i) => i === index ? value : c),
    }));
  };

  // Available items for search
  const availableItems = useMemo(() => {
    const all: { id: string; type: "piece" | "kit"; code: number; name: string }[] = [
      ...pieces.map(p => ({ id: p.id, type: "piece" as const, code: p.code, name: p.name })),
      ...kits.map(k => ({ id: k.id, type: "kit" as const, code: k.code, name: k.name })),
    ];
    const usedIds = new Set(selectedItems.map(i => `${i.type}-${i.id}`));
    return all.filter(i => {
      if (usedIds.has(`${i.type}-${i.id}`)) return false;
      if (!itemSearch) return true;
      const s = itemSearch.toLowerCase();
      return String(i.code).includes(s) || i.name.toLowerCase().includes(s);
    });
  }, [pieces, kits, selectedItems, itemSearch]);

  const addItem = (item: typeof availableItems[0]) => {
    setSelectedItems(prev => [...prev, { ...item, quantity: 1 }]);
    setItemSearch("");
  };

  const removeItem = (idx: number) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItemQty = (idx: number, qty: number) => {
    setSelectedItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, qty) } : item));
  };

  // Resolve items to piece-level changes (FIXED mode)
  const resolveItemsToPieces = useCallback((items: SelectedItem[]): { pieceId: string; pieceName: string; quantity: number }[] => {
    const result: { pieceId: string; pieceName: string; quantity: number }[] = [];
    for (const item of items) {
      if (item.type === "piece") {
        result.push({ pieceId: item.id, pieceName: item.name, quantity: Math.ceil(item.quantity) });
      } else {
        const components = kitPieces.filter(kp => kp.kit_id === item.id);
        if (components.length === 0) {
          console.warn("Kit has no components — falling back to kit.id as piece_id", { kitId: item.id, kitName: item.name });
          result.push({
            pieceId: item.id,
            pieceName: `[KIT sem componentes] ${item.name}`,
            quantity: Math.ceil(item.quantity),
          });
          continue;
        }
        for (const comp of components) {
          const piece = pieces.find(p => p.id === comp.piece_id);
          const existing = result.find(r => r.pieceId === comp.piece_id);
          const addQty = item.quantity * comp.quantity;
          if (existing) {
            existing.quantity += addQty;
          } else {
            result.push({
              pieceId: comp.piece_id,
              pieceName: piece?.name || `Peça ${comp.piece_id.slice(0, 6)}`,
              quantity: addQty,
            });
          }
        }
      }
    }
    // Final ceil pass to ensure no decimals leak through (kit aggregates above use raw sums).
    return result.map(r => ({ ...r, quantity: Math.ceil(r.quantity) }));
  }, [kitPieces, pieces]);

  /**
   * Resolve items computed from a numeric store field (BY_FIELD mode).
   * Supports two operations:
   *   - multiply: Math.ceil(item.quantity * baseValue)
   *   - divide:   Math.ceil(baseValue / item.quantity)  (divides the store
   *               field value by the user-provided factor; rounds UP, e.g.
   *               12/3 → 4, 8/3 → 3)
   * Returns [] when the store has no valid numeric value (or division-by-zero) —
   * the store is then skipped entirely from the automation.
   */
  const resolveItemsForStore = useCallback(
    (items: SelectedItem[], store: ClientStore, field: string, op: Operation = "multiply"): { pieceId: string; pieceName: string; quantity: number }[] => {
      const raw = (store as any)[field];
      const baseValue = Number(raw);
      if (!Number.isFinite(baseValue) || baseValue <= 0) return [];
      const computed = items.map(it => {
        const factor = Number(it.quantity);
        if (!Number.isFinite(factor) || factor <= 0) return { ...it, quantity: 0 };
        const q = op === "divide"
          ? Math.ceil(baseValue / factor)
          : Math.ceil(factor * baseValue);
        return { ...it, quantity: q };
      }).filter(it => it.quantity > 0);
      return resolveItemsToPieces(computed);
    },
    [resolveItemsToPieces],
  );

  // Compute resolved pieces for a single store, respecting current `kind`/`baseField`/`operation`.
  const resolveForStore = useCallback(
    (store: ClientStore, items: SelectedItem[], k: AutomationKind, bf: string, op: Operation = "multiply") => {
      if (k === "by_field") {
        if (!bf) return [];
        return resolveItemsForStore(items, store, bf, op);
      }
      return resolveItemsToPieces(items);
    },
    [resolveItemsForStore, resolveItemsToPieces],
  );

  // Check for overwrite before preview
  const handlePreviewClick = async () => {
    // Replacement mode → build preview rows and go to step 2
    if (kind === "replacement") {
      if (!replacementPieceId) { toast.error("Selecione a peça."); return; }
      if (!Number.isFinite(replacementTargetQty) || replacementTargetQty < 0) {
        toast.error("Informe a quantidade de substituição (>= 0)."); return;
      }
      if (!replaceAnyNonZero && replacementSourceQtys.length === 0) {
        toast.error("Selecione ao menos uma quantidade de origem ou marque \"qualquer valor diferente de 0\"."); return;
      }
      const piece = pieces.find(p => p.id === replacementPieceId);
      const pieceName = piece ? `${piece.code} — ${piece.name}` : "Peça";
      const rows: PreviewRow[] = replacementAffectedStores.map(store => ({
        storeId: store.id,
        storeName: store.name,
        group: "update" as const,
        pieceId: replacementPieceId,
        pieceName,
        currentQty: qtyMap[`${store.id}-${replacementPieceId}`] || 0,
        newQty: replacementTargetQty,
        action: "keep" as const,
      }));
      if (rows.length === 0) {
        toast.error("Nenhuma loja corresponde aos critérios.");
        return;
      }
      setPreview(rows);
      setOutsideActions({});
      setStep(2);
      return;
    }

    const validFilters = filterGroup.filtros.filter(f => f.campo && f.valor);
    if (selectedItems.length === 0) {
      toast.error(t("automation.fillAllFields"));
      return;
    }

    if (kind === "by_field" && !baseField) {
      toast.error("Selecione o campo base para o cálculo.");
      return;
    }

    // Check for custom field validity
    for (const filtro of validFilters) {
      if (filtro.campo.startsWith("custom_field_")) {
        const { data: clientData } = await supabase.from("clients").select("*").eq("id", clientId).single();
        if (!clientData) { toast.error(t("automation.clientNotFound")); return; }
        const fieldDef = customFieldLabels.find(f => f.key === filtro.campo);
        if (!fieldDef) { toast.error(t("automation.fieldRemoved", { field: filtro.campo })); return; }
        const labelKey = `custom_field_${fieldDef.index}_label` as keyof typeof clientData;
        if (!clientData[labelKey]) {
          toast.error(t("automation.fieldRemoved", { field: fieldDef.label }));
          return;
        }
      }
    }

    // Check overwrite
    const filtered = filtrarLojas(stores, filterGroup);
    let overwriteCount = 0;
    for (const store of filtered) {
      const resolvedPieces = resolveForStore(store, selectedItems, kind, baseField, operation);
      for (const rp of resolvedPieces) {
        const currentQty = qtyMap[`${store.id}-${rp.pieceId}`] || 0;
        if (currentQty > 0) overwriteCount++;
      }
    }

    if (overwriteCount > 0) {
      setOverwriteDialog({ open: true, count: overwriteCount });
      return;
    }

    executePreview(false);
  };

  const executePreview = (sobrescrever: boolean) => {
    const filtered = filtrarLojas(stores, filterGroup);
    const filteredIds = new Set(filtered.map(s => s.id));
    const nonMatchingStores = stores.filter(s => !filteredIds.has(s.id));

    // For non-matching stores, in by_field mode we still need a "default" piece list
    // to know which pieces could conflict — pre-resolve assuming factor=1 (a virtual store).
    const fallbackPieces = resolveItemsToPieces(selectedItems);

    const rows: PreviewRow[] = [];
    const actions: Record<string, OutsideFilterAction> = {};

    for (const store of filtered) {
      const resolvedPieces = resolveForStore(store, selectedItems, kind, baseField, operation);
      // by_field: store sem valor numérico válido cai como ignorada (1 linha agregada)
      if (resolvedPieces.length === 0 && kind === "by_field") {
        rows.push({
          storeId: store.id,
          storeName: store.name,
          group: "ignored",
          pieceId: "__no_value__",
          pieceName: `(sem valor em ${baseField})`,
          currentQty: 0,
          newQty: 0,
          action: "keep",
        });
        continue;
      }
      for (const rp of resolvedPieces) {
        const currentQty = qtyMap[`${store.id}-${rp.pieceId}`] || 0;
        if (!sobrescrever && currentQty > 0) {
          rows.push({
            storeId: store.id, storeName: store.name, group: "update",
            pieceId: rp.pieceId, pieceName: rp.pieceName,
            currentQty, newQty: currentQty, action: "keep",
          });
        } else {
          rows.push({
            storeId: store.id, storeName: store.name, group: "update",
            pieceId: rp.pieceId, pieceName: rp.pieceName,
            currentQty, newQty: rp.quantity, action: "keep",
          });
        }
      }
    }

    for (const store of nonMatchingStores) {
      for (const rp of fallbackPieces) {
        const currentQty = qtyMap[`${store.id}-${rp.pieceId}`] || 0;
        if (currentQty > 0) {
          const key = `${store.id}-${rp.pieceId}`;
          actions[key] = "keep";
          rows.push({
            storeId: store.id, storeName: store.name, group: "outside_with_value",
            pieceId: rp.pieceId, pieceName: rp.pieceName,
            currentQty, newQty: 0, action: "keep",
          });
        } else {
          rows.push({
            storeId: store.id, storeName: store.name, group: "ignored",
            pieceId: rp.pieceId, pieceName: rp.pieceName,
            currentQty: 0, newQty: 0, action: "keep",
          });
        }
      }
    }

    setPreview(rows);
    setOutsideActions(actions);
    setStep(2);
  };

  // Counts
  const updateRows = preview.filter(r => r.group === "update");
  const outsideRows = preview.filter(r => r.group === "outside_with_value");
  const ignoredCount = preview.filter(r => r.group === "ignored").length;
  const uniqueUpdateStores = new Set(updateRows.map(r => r.storeId)).size;
  const uniqueOutsideStores = new Set(outsideRows.map(r => r.storeId)).size;

  const setAllOutside = (action: OutsideFilterAction) => {
    const updated = { ...outsideActions };
    outsideRows.forEach(r => { updated[`${r.storeId}-${r.pieceId}`] = action; });
    setOutsideActions(updated);
  };

  // Execute replacement (reusable for single + group)
  const executeReplacementMulti = async (
    pieceId: string,
    sourceQtys: number[],
    targetQty: number,
    anyNonZero: boolean,
  ): Promise<{ updated: number }> => {
    const affected = stores.filter(store => {
      const currentQty = qtyMap[`${store.id}-${pieceId}`] || 0;
      if (anyNonZero) return currentQty > 0;
      return sourceQtys.includes(currentQty);
    });
    if (affected.length === 0) return { updated: 0 };

    if (targetQty > 0) {
      const upserts = affected.map(s => ({
        campaignId, storeId: s.id, pieceId, quantity: targetQty,
      }));
      await applyBulk("Automação (intervalo)", upserts, []);
    } else {
      // targetQty === 0 → delete rows
      const dels = affected.map(s => ({ campaignId, storeId: s.id, pieceId }));
      await applyBulk("Automação (zerar)", [], dels);
    }
    return { updated: affected.length };
  };

  const executeAutomationMulti = async (
    fg: FilterGroup,
    items: SelectedItem[],
    k: AutomationKind = "fixed",
    bf: string | null = null,
    op: Operation = "multiply",
  ): Promise<{ updated: number; kept: number; zeroed: number }> => {
    const matching = filtrarLojas(stores, fg);
    const matchingIds = new Set(matching.map(s => s.id));
    const nonMatchingStores = stores.filter(s => !matchingIds.has(s.id));

    const upserts: { campaignId: string; storeId: string; pieceId: string; quantity: number }[] = [];
    const deletes: { campaignId: string; storeId: string; pieceId: string }[] = [];
    let touchedStores = 0;

    for (const store of matching) {
      const resolvedPieces = k === "by_field" && bf
        ? resolveItemsForStore(items, store, bf, op)
        : resolveItemsToPieces(items);
      if (resolvedPieces.length === 0) continue;
      touchedStores++;
      for (const rp of resolvedPieces) {
        if (rp.quantity > 0) {
          upserts.push({ campaignId, storeId: store.id, pieceId: rp.pieceId, quantity: rp.quantity });
        } else {
          deletes.push({ campaignId, storeId: store.id, pieceId: rp.pieceId });
        }
      }
    }

    const fallbackPieces = resolveItemsToPieces(items);
    let keepCount = 0;
    for (const store of nonMatchingStores) {
      for (const rp of fallbackPieces) {
        const currentQty = qtyMap[`${store.id}-${rp.pieceId}`] || 0;
        if (currentQty > 0) keepCount++;
      }
    }

    // Deduplicate: same (storeId, pieceId) cannot appear twice in a single upsert.
    // When a kit references the same piece more than once, sum the quantities.
    const dedupMap = new Map<string, typeof upserts[number]>();
    for (const u of upserts) {
      const key = `${u.storeId}-${u.pieceId}`;
      const existing = dedupMap.get(key);
      if (existing) {
        existing.quantity += u.quantity;
      } else {
        dedupMap.set(key, { ...u });
      }
    }
    const dedupedUpserts = Array.from(dedupMap.values());

    await applyBulk("Automação por filtro", dedupedUpserts, deletes);

    return { updated: touchedStores, kept: keepCount, zeroed: 0 };
  };

  // Step 2: Execute with preview-based actions
  const handleExecute = async () => {
    setExecuting(true);
    setExecutionStatus({ step: 1, totalSteps: 4, label: "Validando dados..." });
    try {
      // Validate custom fields
      for (const filtro of filterGroup.filtros) {
        if (filtro.campo.startsWith("custom_field_")) {
          const { data: clientData } = await supabase.from("clients").select("*").eq("id", clientId).single();
          const fieldDef = customFieldLabels.find(f => f.key === filtro.campo);
          if (!clientData || !fieldDef) {
            toast.error(t("automation.fieldRemoved", { field: filtro.campo }));
            setExecuting(false); return;
          }
          const labelKey = `custom_field_${fieldDef.index}_label` as keyof typeof clientData;
          if (!clientData[labelKey]) {
            toast.error(t("automation.fieldRemoved", { field: fieldDef.label }));
            setExecuting(false); setStep(1); return;
          }
        }
      }

      setExecutionStatus({ step: 2, totalSteps: 4, label: "Calculando alterações...", details: "Processando lojas e peças..." });
      const upserts: { campaignId: string; storeId: string; pieceId: string; quantity: number }[] = [];
      const deletes: { campaignId: string; storeId: string; pieceId: string }[] = [];

      for (const row of updateRows) {
        if (row.newQty > 0) {
          upserts.push({ campaignId, storeId: row.storeId, pieceId: row.pieceId, quantity: row.newQty });
        } else {
          deletes.push({ campaignId, storeId: row.storeId, pieceId: row.pieceId });
        }
      }

      let zeroCount = 0;
      let keepCount = 0;
      for (const row of outsideRows) {
        const action = outsideActions[`${row.storeId}-${row.pieceId}`] || "keep";
        if (action === "zero") {
          deletes.push({ campaignId, storeId: row.storeId, pieceId: row.pieceId });
          zeroCount++;
        } else {
          keepCount++;
        }
      }

      // Deduplicate same (storeId, pieceId) entries before upserting (sum quantities).
      const dedupMap = new Map<string, typeof upserts[number]>();
      for (const u of upserts) {
        const key = `${u.storeId}-${u.pieceId}`;
        const existing = dedupMap.get(key);
        if (existing) {
          existing.quantity += u.quantity;
        } else {
          dedupMap.set(key, { ...u });
        }
      }
      const dedupedUpserts = Array.from(dedupMap.values());

      setExecutionStatus({ 
        step: 3, 
        totalSteps: 4, 
        label: "Sincronizando com o banco...", 
        details: `${dedupedUpserts.length} inclusões/alterações e ${deletes.length} exclusões.` 
      });
      await applyBulk("Automação", dedupedUpserts, deletes);

      setExecutionStatus({ step: 4, totalSteps: 4, label: "Finalizando...", details: "Atualizando interface." });
      toast.success(t("automation.successMessage", { updated: uniqueUpdateStores, kept: keepCount, zeroed: zeroCount }));
      await onComplete();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(t("automation.executionError") + ": " + (err.message || ""));
    } finally {
      setExecuting(false);
      setExecutionStatus(null);
    }
  };

  // Save current config as template (multi-filter format) — creates new OR updates existing
  const handleSaveTemplate = async () => {
    if (!saveName.trim()) return;
    if (kind === "by_field" && !baseField) {
      toast.error("Selecione o campo base para o cálculo.");
      return;
    }
    if (kind === "replacement") {
      if (!replacementPieceId) { toast.error("Selecione a peça."); return; }
      if (!replaceAnyNonZero && replacementSourceQtys.length === 0) {
        toast.error("Selecione ao menos uma quantidade de origem."); return;
      }
    }
    try {
      const filterValue = kind === "replacement"
        ? JSON.stringify({
            filtros: [], condicoes: [],
            replacementPieceId,
            replacementSourceQtys,
            replacementTargetQty,
            replaceAnyNonZero,
          })
        : JSON.stringify({ filtros: filterGroup.filtros, condicoes: filterGroup.condicoes, operation });

      const payload = {
        name: saveName.trim(),
        filter_field: "__multi_v2__",
        filter_value: filterValue,
        items: kind === "replacement" ? [] : selectedItems,
        outside_action: "keep",
        kind,
        base_field: kind === "by_field" ? baseField : null,
      };
      if (editingId) {
        await updateTemplate.mutateAsync({ id: editingId, ...payload });
        toast.success("Automação atualizada");
      } else {
        await saveTemplate.mutateAsync(payload);
        toast.success(t("automation.saved"));
      }
      setSaveName("");
      setShowSaveInput(false);
      setEditingId(null);
    } catch {
      toast.error(t("automation.errorSaving"));
    }
  };

  // Helper: parse replacement payload from template filter_value
  const parseReplacementFromTpl = (tpl: typeof templates[0]) => {
    try {
      const parsed = JSON.parse(tpl.filter_value);
      return {
        replacementPieceId: parsed.replacementPieceId || "",
        replacementSourceQtys: Array.isArray(parsed.replacementSourceQtys) ? parsed.replacementSourceQtys : [],
        replacementTargetQty: Number(parsed.replacementTargetQty) || 0,
        replaceAnyNonZero: !!parsed.replaceAnyNonZero,
      };
    } catch {
      return { replacementPieceId: "", replacementSourceQtys: [], replacementTargetQty: 0, replaceAnyNonZero: false };
    }
  };

  // Load template into form (read-only "carregar" — não entra em modo edição)
  const loadTemplate = (tpl: typeof templates[0]) => {
    const tplKind = tpl.kind ?? "fixed";
    if (tplKind === "replacement") {
      const r = parseReplacementFromTpl(tpl);
      setReplacementPieceId(r.replacementPieceId);
      setReplacementSourceQtys(r.replacementSourceQtys);
      setReplacementTargetQty(r.replacementTargetQty);
      setReplaceAnyNonZero(r.replaceAnyNonZero);
      setFilterGroup({ filtros: [createEmptyFilter()], condicoes: [] });
      setSelectedItems([]);
    } else {
      const migrated = migrateTemplate(tpl);
      setFilterGroup({ filtros: migrated.filtros, condicoes: migrated.condicoes });
      setSelectedItems(tpl.items);
      setOperation(migrated.operation);
    }
    setKind(tplKind);
    setBaseField(tpl.base_field ?? "");
    setEditingId(null);
    setMainTab("new");
    setStep(1);
  };

  // Edit template: load into form AND mark as editing so save updates in place
  const editTemplate = (tpl: typeof templates[0]) => {
    const tplKind = tpl.kind ?? "fixed";
    if (tplKind === "replacement") {
      const r = parseReplacementFromTpl(tpl);
      setReplacementPieceId(r.replacementPieceId);
      setReplacementSourceQtys(r.replacementSourceQtys);
      setReplacementTargetQty(r.replacementTargetQty);
      setReplaceAnyNonZero(r.replaceAnyNonZero);
      setFilterGroup({ filtros: [createEmptyFilter()], condicoes: [] });
      setSelectedItems([]);
    } else {
      const migrated = migrateTemplate(tpl);
      setFilterGroup({ filtros: migrated.filtros, condicoes: migrated.condicoes });
      setSelectedItems(tpl.items);
      setOperation(migrated.operation);
    }
    setKind(tplKind);
    setBaseField(tpl.base_field ?? "");
    setEditingId(tpl.id);
    setSaveName(tpl.name);
    setShowSaveInput(true);
    setMainTab("new");
    setStep(1);
  };

  // Run group
  // Filter helper that accepts the legacy/multi format used in templates
  const filterStoresFromTemplate = useCallback((srcStores: ClientStore[], filterValue: string, filterField: string): ClientStore[] => {
    let fg: FilterGroup;
    if (filterField === "__multi_v2__") {
      try {
        const parsed = JSON.parse(filterValue);
        fg = { filtros: parsed.filtros || [], condicoes: parsed.condicoes || [] };
      } catch {
        fg = { filtros: [createEmptyFilter()], condicoes: [] };
      }
    } else {
      fg = {
        filtros: [{ id: "x", campo: filterField, operador: "igual" as FilterOperator, valor: filterValue }],
        condicoes: [],
      };
    }
    return filtrarLojas(srcStores, fg);
  }, []);

  // Step 1: open review dialog before running
  const handleRunGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const items = groupItems
      .filter(gi => gi.group_id === groupId)
      .sort((a, b) => a.display_order - b.display_order);

    const validations = buildValidations({
      groupItems: items,
      templates,
      pieces,
      kits,
      kitPieces,
      stores,
      customFieldLabels,
      numericFieldKeys: numericFields.map(f => f.key),
      filterStores: filterStoresFromTemplate,
    });

    setReviewDialog({ open: true, groupId, groupName: group.name, validations });
  };

  // Step 2: actually execute after user confirms in review dialog
  const executeGroupRun = async () => {
    const { groupId, groupName } = reviewDialog;
    setReviewDialog(prev => ({ ...prev, open: false }));
    setExecuting(true);

    const items = groupItems
      .filter(gi => gi.group_id === groupId && gi.enabled)
      .sort((a, b) => a.display_order - b.display_order);

    const total = items.length;
    const results: GroupRunResult[] = [];
    let count = 0;

    for (const gi of items) {
      count++;
      const tpl = templates.find(t => t.id === gi.template_id);
      const tplName = tpl?.name || "(Automação removida)";
      setExecutionStatus({ 
        step: count, 
        totalSteps: total, 
        label: `Executando: ${tplName}`, 
        details: `Automação ${count} de ${total} do grupo ${groupName}` 
      });

      if (!tpl) {
        results.push({
          templateId: gi.template_id,
          templateName: "(Automação removida)",
          status: "error",
          errorMessage: "A automação foi excluída do banco.",
        });
        continue;
      }
      try {
        const tplKind = tpl.kind ?? "fixed";
        let result: { updated: number };
        if (tplKind === "replacement") {
          let parsed: any = {};
          try { parsed = JSON.parse(tpl.filter_value); } catch {}
          result = await executeReplacementMulti(
            parsed.replacementPieceId || "",
            Array.isArray(parsed.replacementSourceQtys) ? parsed.replacementSourceQtys : [],
            Number(parsed.replacementTargetQty) || 0,
            !!parsed.replaceAnyNonZero,
          );
        } else {
          const migrated = migrateTemplate(tpl);
          result = await executeAutomationMulti(
            { filtros: migrated.filtros, condicoes: migrated.condicoes },
            tpl.items,
            tplKind,
            tpl.base_field ?? null,
            migrated.operation,
          );
        }
        results.push({
          templateId: tpl.id,
          templateName: tpl.name,
          status: "success",
          storesUpdated: result.updated,
        });
      } catch (err: any) {
        results.push({
          templateId: tpl.id,
          templateName: tpl.name,
          status: "error",
          errorMessage: err?.message || String(err),
        });
      }
    }

    setExecutionStatus({ step: total, totalSteps: total, label: "Finalizando...", details: "Processando resultados." });
    setExecuting(false);
    setExecutionStatus(null);
    await onComplete();

    const failures = results.filter(r => r.status === "error");
    if (failures.length === 0) {
      const totalUpdated = results.reduce((s, r) => s + (r.storesUpdated || 0), 0);
      toast.success(t("automation.groupExecuted") + ` (${totalUpdated} ${t("automation.stores")})`);
      onOpenChange(false);
    } else {
      // Open detailed error dialog
      setErrorDialog({ open: true, groupName, groupId, results });
    }
  };

  // Recovery: replace a problematic item in a template
  const handleReplaceItem = useCallback(async (templateId: string, itemIndex: number, newItem: AutomationTemplateItem) => {
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return;
    const newItems = tpl.items.map((it, i) => i === itemIndex ? newItem : it);
    await updateTemplate.mutateAsync({
      id: tpl.id,
      name: tpl.name,
      filter_field: tpl.filter_field,
      filter_value: tpl.filter_value,
      items: newItems,
      outside_action: tpl.outside_action,
      kind: tpl.kind,
      base_field: tpl.base_field,
    });
    toast.success("Item substituído");
    // Refresh validations in the open review dialog
    setReviewDialog(prev => {
      if (!prev.open) return prev;
      const refreshed = buildValidations({
        groupItems: groupItems.filter(gi => gi.group_id === prev.groupId),
        templates: templates.map(t => t.id === templateId ? { ...t, items: newItems } : t),
        pieces, kits, kitPieces, stores, customFieldLabels,
        numericFieldKeys: numericFields.map(f => f.key),
        filterStores: filterStoresFromTemplate,
      });
      return { ...prev, validations: refreshed };
    });
  }, [templates, updateTemplate, groupItems, pieces, kits, kitPieces, stores, customFieldLabels, numericFields, filterStoresFromTemplate]);

  // Recovery: remove a problematic item from a template
  const handleRemoveItemFromTemplate = useCallback(async (templateId: string, itemIndex: number) => {
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return;
    const newItems = tpl.items.filter((_, i) => i !== itemIndex);
    await updateTemplate.mutateAsync({
      id: tpl.id,
      name: tpl.name,
      filter_field: tpl.filter_field,
      filter_value: tpl.filter_value,
      items: newItems,
      outside_action: tpl.outside_action,
      kind: tpl.kind,
      base_field: tpl.base_field,
    });
    toast.success("Item removido da automação");
    setReviewDialog(prev => {
      if (!prev.open) return prev;
      const refreshed = buildValidations({
        groupItems: groupItems.filter(gi => gi.group_id === prev.groupId),
        templates: templates.map(t => t.id === templateId ? { ...t, items: newItems } : t),
        pieces, kits, kitPieces, stores, customFieldLabels,
        numericFieldKeys: numericFields.map(f => f.key),
        filterStores: filterStoresFromTemplate,
      });
      return { ...prev, validations: refreshed };
    });
  }, [templates, updateTemplate, groupItems, pieces, kits, kitPieces, stores, customFieldLabels, numericFields, filterStoresFromTemplate]);

  // Recovery: toggle group item enabled
  const handleToggleGroupItemFromReview = useCallback(async (groupItemId: string, enabled: boolean) => {
    await toggleGroupItem.mutateAsync({ id: groupItemId, enabled });
    setReviewDialog(prev => {
      if (!prev.open) return prev;
      return {
        ...prev,
        validations: prev.validations.map(v => v.groupItemId === groupItemId ? { ...v, enabled } : v),
      };
    });
  }, [toggleGroupItem]);

  // Recovery: edit template (close review and load it in form)
  const handleEditTemplateFromReview = useCallback((templateId: string) => {
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return;
    setReviewDialog(prev => ({ ...prev, open: false }));
    editTemplate(tpl);
  }, [templates]); // editTemplate is declared above; safe due to component scope


  const getFieldLabel = (key: string) => allFilterFields.find(f => f.key === key)?.label || key;
  const getNumericFieldLabel = (key: string) => numericFields.find(f => f.key === key)?.label || key;

  const hasValidFilters = filterGroup.filtros.some(f => f.campo && f.valor);
  // Filtros vazios aplicam a TODAS as lojas em ambos os modos (fixed e by_field).
  const canProceed =
    kind === "replacement"
      ? !!replacementPieceId && (replaceAnyNonZero || replacementSourceQtys.length > 0)
      : selectedItems.length > 0 && (kind === "fixed" || !!baseField);
  const applyingToAll = !hasValidFilters;

  // Stores within filter that have a valid numeric value in baseField
  const matchingStoresWithValue = useMemo(() => {
    if (kind !== "by_field" || !baseField) return matchingStores.length;
    return matchingStores.filter(s => {
      const v = Number((s as any)[baseField]);
      return Number.isFinite(v) && v > 0;
    }).length;
  }, [matchingStores, kind, baseField]);

  // Template display helper
  const getTemplateFilterSummary = (tpl: typeof templates[0]): string => {
    if ((tpl.kind ?? "fixed") === "replacement") {
      const r = parseReplacementFromTpl(tpl);
      const piece = pieces.find(p => p.id === r.replacementPieceId);
      const pieceLabel = piece ? `Peça ${piece.code}` : "Peça ?";
      const src = r.replaceAnyNonZero
        ? "qualquer valor ≠ 0"
        : `qty=${r.replacementSourceQtys.join(",")}`;
      return `${pieceLabel}: ${src} → ${r.replacementTargetQty}`;
    }
    let base: string;
    if (tpl.filter_field === "__multi_v2__") {
      try {
        const parsed = JSON.parse(tpl.filter_value);
        const filtros = parsed.filtros || [];
        const condicoes = parsed.condicoes || [];
        base = filtros.map((f: AutomationFilter, i: number) => {
          const label = getFieldLabel(f.campo);
          const op = OPERATOR_LABELS[f.operador] || f.operador;
          const prefix = i > 0 ? ` ${condicoes[i - 1] || "E"} ` : "";
          return `${prefix}${label} ${op} "${f.valor}"`;
        }).join("");
      } catch {
        base = "Filtro inválido";
      }
    } else {
      base = `${getFieldLabel(tpl.filter_field)} = ${tpl.filter_value}`;
    }
    if ((tpl.kind ?? "fixed") === "by_field" && tpl.base_field) {
      const op = migrateTemplate(tpl).operation;
      const sym = op === "divide" ? "÷" : "×";
      const verb = op === "divide" ? "dividir por" : "multiplicar por";
      base += ` · ${verb} ${getNumericFieldLabel(tpl.base_field)} (fator ${sym} valor)`;
    }
    return base;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
        {executing && executionStatus && (
          <div className="absolute inset-0 z-[100] bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-full max-w-md space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  {executionStatus.label}
                </h3>
                {executionStatus.details && (
                  <p className="text-sm text-muted-foreground">{executionStatus.details}</p>
                )}
              </div>
              
              <div className="space-y-1">
                <Progress value={(executionStatus.step / executionStatus.totalSteps) * 100} className="h-2" />
                <div className="flex justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  <span>Etapa {executionStatus.step} de {executionStatus.totalSteps}</span>
                  <span>{Math.round((executionStatus.step / executionStatus.totalSteps) * 100)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle>{t("automation.title")}</DialogTitle>
          <DialogDescription>
            {step === 1 && mainTab === "new" && t("automation.step1Desc")}
            {step === 2 && t("automation.step2Desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-0">
          {step === 1 && (
            <Tabs value={mainTab} onValueChange={setMainTab}>
              <TabsList className="w-full">
                <TabsTrigger value="new" className="flex-1 gap-1 text-xs">
                  <Plus className="w-3 h-3" /> {t("automation.newAutomation")}
                </TabsTrigger>
                <TabsTrigger value="saved" className="flex-1 gap-1 text-xs">
                  <FolderOpen className="w-3 h-3" /> {t("automation.savedTemplates")}
                </TabsTrigger>
                <TabsTrigger value="groups" className="flex-1 gap-1 text-xs">
                  <Layers className="w-3 h-3" /> {t("automation.groups")}
                </TabsTrigger>
              </TabsList>
              ...
              {/* ──── TAB: Grupos ──── */}
              <TabsContent value="groups" className="space-y-3 mt-3">
                ...
              </TabsContent>
            </Tabs>
          )}

          {/* ──── STEP 2: Preview ──── */}
          {step === 2 && (
            <div className="space-y-4">
              ...
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  {t("common.back")}
                </Button>
                <Button onClick={handleExecute} disabled={executing} className="flex-1">
                  {executing ? t("common.loading") : t("automation.apply")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {/* ──── Overwrite confirmation dialog ──── */}
      <Dialog open={overwriteDialog.open} onOpenChange={(o) => setOverwriteDialog({ ...overwriteDialog, open: o })}>
        <DialogContent className="w-full max-w-sm">
          <DialogHeader>
            <DialogTitle>Valores existentes encontrados</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>
                <strong>{overwriteDialog.count} célula(s)</strong> nas lojas selecionadas já possuem valores preenchidos para as peças escolhidas.
              </p>
            </div>

            <p className="text-sm font-medium">O que deseja fazer com os valores existentes?</p>

            <div className="space-y-2">
              <button
                className="w-full flex items-start gap-3 p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-all text-left"
                onClick={() => {
                  setOverwriteDialog({ open: false, count: 0 });
                  executePreview(false);
                }}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Manter valores existentes</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Apenas preenche células que estão vazias. Não altera o que já foi preenchido.
                  </p>
                </div>
              </button>

              <button
                className="w-full flex items-start gap-3 p-3 rounded-lg border hover:border-destructive/50 hover:bg-destructive/5 transition-all text-left"
                onClick={() => {
                  setOverwriteDialog({ open: false, count: 0 });
                  executePreview(true);
                }}
              >
                <div className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Apagar e substituir tudo</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Substitui todos os valores existentes pelos novos definidos nesta automação.
                  </p>
                </div>
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOverwriteDialog({ open: false, count: 0 })}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GroupRunReviewDialog
        open={reviewDialog.open}
        onOpenChange={(o) => setReviewDialog(prev => ({ ...prev, open: o }))}
        groupName={reviewDialog.groupName}
        validations={reviewDialog.validations}
        pieces={pieces}
        kits={kits}
        templates={templates}
        onReplaceItem={handleReplaceItem}
        onRemoveItemFromTemplate={handleRemoveItemFromTemplate}
        onToggleGroupItem={handleToggleGroupItemFromReview}
        onEditTemplate={handleEditTemplateFromReview}
        onConfirmRun={executeGroupRun}
      />

      <GroupRunErrorDialog
        open={errorDialog.open}
        onOpenChange={(o) => setErrorDialog(prev => ({ ...prev, open: o }))}
        groupName={errorDialog.groupName}
        results={errorDialog.results}
        onReview={() => {
          setErrorDialog(prev => ({ ...prev, open: false }));
          handleRunGroup(errorDialog.groupId);
        }}
      />
    </Dialog>
  );
}
