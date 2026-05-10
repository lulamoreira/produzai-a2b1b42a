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
import { Trash2, Plus, ArrowRight, Check, AlertTriangle, Eye, Save, FolderOpen, Play, Layers, Shield, Pencil } from "lucide-react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
      await applyRateioBulk(upserts, [], rateioOptions);
    } else {
      // targetQty === 0 → delete rows
      const dels = affected.map(s => ({ campaignId, storeId: s.id, pieceId }));
      await applyRateioBulk([], dels, rateioOptions);
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

    await applyRateioBulk(dedupedUpserts, deletes, rateioOptions);

    return { updated: touchedStores, kept: keepCount, zeroed: 0 };
  };

  // Step 2: Execute with preview-based actions
  const handleExecute = async () => {
    setExecuting(true);
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

      await applyRateioBulk(dedupedUpserts, deletes, rateioOptions);

      toast.success(t("automation.successMessage", { updated: uniqueUpdateStores, kept: keepCount, zeroed: zeroCount }));
      await onComplete();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(t("automation.executionError") + ": " + (err.message || ""));
    } finally {
      setExecuting(false);
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

    const results: GroupRunResult[] = [];
    for (const gi of items) {
      const tpl = templates.find(t => t.id === gi.template_id);
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

    setExecuting(false);
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
      <DialogContent className="w-full max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("automation.title")}</DialogTitle>
          <DialogDescription>
            {step === 1 && mainTab === "new" && t("automation.step1Desc")}
            {step === 2 && t("automation.step2Desc")}
          </DialogDescription>
        </DialogHeader>

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

            {/* ──── TAB: Nova automação ──── */}
            <TabsContent value="new" className="space-y-4 mt-3">
              {editingId && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-primary/40 bg-primary/5">
                  <div className="flex items-center gap-2 text-xs">
                    <Pencil className="w-3.5 h-3.5 text-primary" />
                    <span>
                      Editando automação salva: <span className="font-semibold">{saveName || "—"}</span>
                    </span>
                  </div>
                  <Button
                    size="sm" variant="ghost" className="h-7 text-xs"
                    onClick={() => {
                      setEditingId(null);
                      setSaveName("");
                      setShowSaveInput(false);
                      setFilterGroup({ filtros: [createEmptyFilter()], condicoes: [] });
                      setSelectedItems([]);
                      setKind("fixed");
                      setBaseField("");
                    }}
                  >
                    Cancelar edição
                  </Button>
                </div>
              )}
              {/* ── Tipo de automação ── */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Tipo de automação</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setKind("fixed")}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      kind === "fixed"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <p className="text-sm font-medium">Quantidade fixa</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Cada item recebe uma quantidade definida por você
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind("by_field")}
                    disabled={numericFields.length === 0}
                    className={`text-left p-3 rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      kind === "by_field"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                    title={numericFields.length === 0 ? "Nenhum campo numérico disponível" : undefined}
                  >
                    <p className="text-sm font-medium">Calcular por campo da loja</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Quantidade calculada a partir de um campo numérico da loja
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind("replacement")}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      kind === "replacement"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <p className="text-sm font-medium">Substituição</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Substituir valores existentes
                    </p>
                  </button>
                </div>
              </div>

              {/* ── Substituição UI (apenas no modo replacement) ── */}
              {kind === "replacement" && (
                <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
                  <div>
                    <Label className="text-sm font-semibold mb-1 block">Peça</Label>
                    <Input
                      placeholder="Buscar por código ou nome..."
                      value={replacementPieceSearch}
                      onChange={e => setReplacementPieceSearch(e.target.value)}
                      className="mb-1 h-8 text-xs"
                    />
                    <div className="border rounded-md max-h-40 overflow-y-auto bg-background">
                      {(() => {
                        const q = replacementPieceSearch.toLowerCase().trim();
                        const filtered = pieces.filter(p => {
                          if (!q) return true;
                          return String(p.code).includes(q) || p.name.toLowerCase().includes(q);
                        });
                        if (filtered.length === 0) {
                          return <p className="text-xs text-muted-foreground p-2">Nenhuma peça encontrada</p>;
                        }
                        return filtered.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center gap-2 border-b last:border-b-0 ${
                              p.id === replacementPieceId ? "bg-primary/10 font-semibold" : ""
                            }`}
                            onClick={() => {
                              setReplacementPieceId(p.id);
                              setReplacementSourceQtys([]);
                            }}
                          >
                            <span className="font-mono">{p.code}</span>
                            <span className="truncate">{p.name}</span>
                          </button>
                        ));
                      })()}
                    </div>
                  </div>

                  {replacementPieceId && (
                    <>
                      <div>
                        <Label className="text-sm font-semibold mb-1 block">Quantidades existentes nas lojas</Label>
                        {replacementQtyDistribution.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhuma loja tem essa peça preenchida.</p>
                        ) : (
                          <div className="space-y-1">
                            {replacementQtyDistribution.map(({ qty, count }) => {
                              const checked = replacementSourceQtys.includes(qty);
                              return (
                                <label
                                  key={qty}
                                  className={`flex items-center gap-2 px-2 py-1 rounded border cursor-pointer text-xs ${
                                    replaceAnyNonZero ? "opacity-50 cursor-not-allowed" : "hover:bg-accent"
                                  } ${checked && !replaceAnyNonZero ? "border-primary bg-primary/5" : "border-border"}`}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={replaceAnyNonZero}
                                    checked={checked}
                                    onChange={() => {
                                      setReplacementSourceQtys(prev =>
                                        prev.includes(qty) ? prev.filter(q => q !== qty) : [...prev, qty]
                                      );
                                    }}
                                  />
                                  <span className="font-semibold">Quantidade de itens: {qty}</span>
                                  <span className="text-muted-foreground">— em {count} loja(s)</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 my-1">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] text-muted-foreground tracking-wider">OU</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>

                      <label className="flex items-start gap-2 px-2 py-1.5 rounded border border-border hover:bg-accent cursor-pointer">
                        <input
                          type="checkbox"
                          checked={replaceAnyNonZero}
                          onChange={e => setReplaceAnyNonZero(e.target.checked)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-xs font-medium">Qualquer valor diferente de 0</p>
                          <p className="text-[10px] text-muted-foreground">
                            Substitui independente da quantidade atual
                          </p>
                        </div>
                      </label>

                      <div>
                        <Label className="text-sm font-semibold mb-1 block">Substituir por</Label>
                        <Input
                          type="number"
                          min={0}
                          value={replacementTargetQty}
                          onChange={e => setReplacementTargetQty(parseInt(e.target.value) || 0)}
                          className="h-9 text-sm w-32"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Use 0 para apagar (remover a peça da loja).
                        </p>
                      </div>

                      <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
                        <span className="text-lg font-bold text-primary">{replacementAffectedStores.length}</span>
                        <span className="text-xs text-muted-foreground">loja(s) serão atualizadas</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Campo base (apenas no modo by_field) ── */}
              {kind === "by_field" && (
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Campo base (numérico)</Label>
                  <Select value={baseField} onValueChange={setBaseField}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione o campo numérico..." />
                    </SelectTrigger>
                    <SelectContent>
                      {numericFields.map(f => (
                        <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Lojas sem valor neste campo serão ignoradas pela automação.
                  </p>

                  {/* ── Operação (Multiplicar / Dividir) ── */}
                  <Label className="text-sm font-semibold mt-3 mb-2 block">Operação</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOperation("multiply")}
                      className={`text-left p-2.5 rounded-lg border transition-all ${
                        operation === "multiply"
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border bg-background hover:border-primary/40"
                      }`}
                    >
                      <p className="text-sm font-medium">Multiplicar</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        fator × valor do campo
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOperation("divide")}
                      className={`text-left p-2.5 rounded-lg border transition-all ${
                        operation === "divide"
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border bg-background hover:border-primary/40"
                      }`}
                    >
                      <p className="text-sm font-medium">Dividir</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        fator ÷ valor do campo (arredonda p/ cima)
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Multi-filter + Items selection (hidden in replacement mode) */}
              {kind !== "replacement" && (
              <>
              <div>
                <Label className="text-sm font-semibold mb-1 block">Filtros de Lojas</Label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  💡 Deixe os filtros de lojas vazios para aplicar a <span className="font-semibold text-foreground">todas as lojas</span>{kind === "by_field" ? " que tiverem valor no campo base" : ""}.
                </p>

                {filterGroup.filtros.map((filtro, index) => {
                  const fieldValues = getFieldValues(filtro.campo);
                  return (
                    <div key={filtro.id} className="flex flex-col">
                      {/* Condition operator between filters */}
                      {index > 0 && (
                        <div className="flex items-center gap-2 my-2">
                          <div className="flex-1 h-px bg-border" />
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className={`px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wider border transition-all ${
                                filterGroup.condicoes[index - 1] === "E"
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-primary"
                              }`}
                              onClick={() => updateCondition(index - 1, "E")}
                            >
                              E
                            </button>
                            <button
                              type="button"
                              className={`px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wider border transition-all ${
                                filterGroup.condicoes[index - 1] === "OU"
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-primary"
                              }`}
                              onClick={() => updateCondition(index - 1, "OU")}
                            >
                              OU
                            </button>
                          </div>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}

                      {/* Filter card */}
                      <div className="flex items-start gap-2 p-3 bg-muted/30 border rounded-lg">
                        <div className="flex-1 space-y-2">
                          {/* Campo */}
                          <Select value={filtro.campo} onValueChange={(v) => updateFilter(index, { campo: v, valor: "" })}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecione o campo..." />
                            </SelectTrigger>
                            <SelectContent>
                              {allFilterFields.map(f => (
                                <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Operador */}
                          <Select
                            value={filtro.operador}
                            onValueChange={(v) => updateFilter(index, { operador: v as FilterOperator })}
                            disabled={!filtro.campo}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.entries(OPERATOR_LABELS) as [FilterOperator, string][]).map(([k, label]) => (
                                <SelectItem key={k} value={k}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Valor */}
                          {filtro.campo && (
                            fieldValues.length > 0 ? (
                              <Select value={filtro.valor} onValueChange={(v) => updateFilter(index, { valor: v })}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Selecione o valor..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {fieldValues.map(v => (
                                    <SelectItem key={v} value={v}>{v}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-xs text-muted-foreground">{t("automation.noValues")}</p>
                            )
                          )}
                        </div>

                        {/* Remove button */}
                        {filterGroup.filtros.length > 1 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeFilter(index)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add filter button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 text-xs border-dashed"
                  onClick={addFilter}
                >
                  <Plus className="w-3 h-3 mr-1" /> Adicionar filtro
                </Button>

                {/* Matching stores counter */}
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg mt-2">
                  <span className="text-lg font-bold text-primary">{matchingStores.length}</span>
                  <span className="text-xs text-muted-foreground">
                    {applyingToAll
                      ? `de ${stores.length} lojas (sem filtros — aplicará a todas)`
                      : `de ${stores.length} lojas correspondem a estes filtros`}
                  </span>
                  {hasValidFilters && matchingStores.length === 0 && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                      ⚠ Nenhuma loja encontrada
                    </span>
                  )}
                  {kind === "by_field" && baseField && matchingStores.length > 0 && (
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      <span className="font-semibold text-foreground">{matchingStoresWithValue}</span> com valor em {getNumericFieldLabel(baseField)}
                    </span>
                  )}
                </div>
              </div>

              {/* Items selection */}
              <div>
                <Label className="text-sm font-medium">{t("automation.selectItems")}</Label>
                {kind === "by_field" && baseField && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Quantidade por loja = {operation === "divide" ? (
                      <>fator do item ÷ <span className="font-semibold text-foreground">{getNumericFieldLabel(baseField)}</span> (arredondado p/ cima; lojas com valor 0 são ignoradas)</>
                    ) : (
                      <><span className="font-semibold text-foreground">{getNumericFieldLabel(baseField)}</span> × fator do item (abaixo)</>
                    )}
                  </p>
                )}
                <div className="relative mt-1">
                  <Input
                    placeholder={t("automation.searchByCode")}
                    value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)}
                    className="mb-1"
                  />
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    {availableItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2">{t("automation.noItemsAvailable")}</p>
                    ) : (
                      availableItems.map(item => (
                        <button
                          key={`${item.type}-${item.id}`}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2 border-b last:border-b-0"
                          onClick={() => addItem(item)}
                        >
                          <Plus className="w-3 h-3 text-muted-foreground" />
                          <Badge variant="outline" className="text-[10px]">
                            {item.type === "kit" ? "Kit" : t("automation.piece")}
                          </Badge>
                          <span className="font-mono text-xs">{item.code}</span>
                          <span className="truncate">{item.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {selectedItems.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {selectedItems.map((item, idx) => (
                      <div key={`${item.type}-${item.id}`} className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1">
                        <Badge variant="outline" className="text-[10px]">
                          {item.type === "kit" ? "Kit" : t("automation.piece")}
                        </Badge>
                        <span className="font-mono text-xs">{item.code}</span>
                        <span className="text-sm truncate flex-1">{item.name}</span>
                        {kind === "by_field" && (
                          <span className="text-xs text-muted-foreground font-semibold">{operation === "divide" ? "÷" : "×"}</span>
                        )}
                        <Input
                          type="number" min={1} value={item.quantity}
                          onChange={e => updateItemQty(idx, parseInt(e.target.value) || 1)}
                          className="w-20 h-7 text-xs"
                          title={kind === "by_field" ? (operation === "divide" ? "Fator (será dividido pelo valor do campo)" : "Fator multiplicador") : "Quantidade"}
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(idx)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </>
              )}
              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={!canProceed || (kind !== "replacement" && selectedItems.length === 0)}
                  onClick={handlePreviewClick}
                >
                  <Eye className="w-4 h-4 mr-1" /> {kind === "replacement" ? "Aplicar substituição" : t("automation.preview")}
                </Button>
                {canProceed && (kind === "replacement" || selectedItems.length > 0) && (
                  <>
                    {!showSaveInput ? (
                      <Button variant="outline" size="icon" onClick={() => setShowSaveInput(true)} title={editingId ? "Atualizar automação" : t("automation.saveTemplate")}>
                        {editingId ? <Pencil className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                      </Button>
                    ) : (
                      <div className="flex gap-1 items-center">
                        <Input
                          placeholder={t("automation.templateNamePlaceholder")}
                          value={saveName}
                          onChange={e => setSaveName(e.target.value)}
                          className="w-40 h-9 text-xs"
                          onKeyDown={e => e.key === "Enter" && handleSaveTemplate()}
                        />
                        <Button size="sm" onClick={handleSaveTemplate} disabled={!saveName.trim()} title={editingId ? "Atualizar" : "Salvar"}>
                          <Check className="w-3 h-3" />
                          {editingId && <span className="ml-1 text-xs">Atualizar</span>}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            {/* ──── TAB: Automações salvas ──── */}
            <TabsContent value="saved" className="space-y-2 mt-3">
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t("automation.noSavedTemplates")}</p>
              ) : (
                templates.map(tpl => (
                  <div key={tpl.id} className="border rounded-lg p-3 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{tpl.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getTemplateFilterSummary(tpl)}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(() => {
                          const tplOp = (tpl.kind ?? "fixed") === "by_field" ? migrateTemplate(tpl).operation : "multiply";
                          const sym = (tpl.kind ?? "fixed") === "by_field" ? (tplOp === "divide" ? "f÷" : "f×") : "×";
                          return tpl.items.map(it => (
                            <Badge key={`${it.type}-${it.id}`} variant="secondary" className="text-[10px]">
                              {it.type === "kit" ? "Kit" : ""} {it.code} {sym} {it.quantity}
                            </Badge>
                          ));
                        })()}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => loadTemplate(tpl)}>
                        {t("automation.load")}
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7"
                        title="Editar automação"
                        onClick={() => editTemplate(tpl)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        title="Excluir automação"
                        onClick={async () => {
                          await deleteTemplate.mutateAsync(tpl.id);
                          toast.success(t("automation.deleted"));
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* ──── TAB: Grupos ──── */}
            <TabsContent value="groups" className="space-y-3 mt-3">
              {/* Create new group */}
              <div className="flex gap-2">
                <Input
                  placeholder={t("automation.groupNamePlaceholder")}
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  className="text-sm"
                  onKeyDown={e => {
                    if (e.key === "Enter" && newGroupName.trim()) {
                      saveGroup.mutateAsync(newGroupName.trim()).then(() => {
                        toast.success(t("automation.groupSaved"));
                        setNewGroupName("");
                      });
                    }
                  }}
                />
                <Button
                  size="sm"
                  disabled={!newGroupName.trim()}
                  onClick={() => {
                    saveGroup.mutateAsync(newGroupName.trim()).then(() => {
                      toast.success(t("automation.groupSaved"));
                      setNewGroupName("");
                    });
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" /> {t("automation.newGroup")}
                </Button>
              </div>

              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("automation.noGroups")}</p>
              ) : (
                groups.map(group => {
                  const gItems = groupItems.filter(gi => gi.group_id === group.id);
                  const enabledCount = gItems.filter(gi => gi.enabled).length;

                  return (
                    <div key={group.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{group.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("automation.templateCount", { count: gItems.length })} ({enabledCount} {t("automation.enabled").toLowerCase()})
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm" variant="default" className="text-xs h-7 gap-1"
                            disabled={enabledCount === 0 || executing}
                            onClick={() => handleRunGroup(group.id)}
                          >
                            <Play className="w-3 h-3" /> {t("automation.runGroup")}
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                            onClick={async () => {
                              await deleteGroup.mutateAsync(group.id);
                              toast.success(t("automation.groupDeleted"));
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Items in group */}
                      {gItems.length > 0 && (
                        <div className="space-y-1">
                          {gItems.map(gi => {
                            const tpl = templates.find(t => t.id === gi.template_id);
                            if (!tpl) return null;
                            return (
                              <div key={gi.id} className="flex items-center gap-2 bg-muted/30 rounded px-2 py-1.5 text-sm">
                                <Switch
                                  checked={gi.enabled}
                                  onCheckedChange={async (checked) => {
                                    await toggleGroupItem.mutateAsync({ id: gi.id, enabled: checked });
                                  }}
                                />
                                <span className={`flex-1 truncate ${!gi.enabled ? "opacity-50 line-through" : ""}`}>
                                  {tpl.name}
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                  {getTemplateFilterSummary(tpl)}
                                </Badge>
                                <Button
                                  size="icon" variant="ghost" className="h-6 w-6"
                                  onClick={async () => {
                                    await removeFromGroup.mutateAsync(gi.id);
                                  }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add template to group */}
                      {addingTemplateToGroup === group.id ? (
                        <div className="space-y-1">
                          {templates
                            .filter(tpl => !gItems.some(gi => gi.template_id === tpl.id))
                            .map(tpl => (
                              <button
                                key={tpl.id}
                                className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent rounded flex items-center gap-2 border"
                                onClick={async () => {
                                  await addToGroup.mutateAsync({ groupId: group.id, templateId: tpl.id });
                                  setAddingTemplateToGroup(null);
                                }}
                              >
                                <Plus className="w-3 h-3" />
                                <span className="truncate">{tpl.name}</span>
                                <Badge variant="outline" className="text-[10px] ml-auto">
                                  {getTemplateFilterSummary(tpl)}
                                </Badge>
                              </button>
                            ))}
                          {templates.filter(tpl => !gItems.some(gi => gi.template_id === tpl.id)).length === 0 && (
                            <p className="text-xs text-muted-foreground p-2">{t("automation.noSavedTemplates")}</p>
                          )}
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setAddingTemplateToGroup(null)}>
                            {t("common.cancel")}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm" variant="outline" className="text-xs w-full"
                          onClick={() => setAddingTemplateToGroup(group.id)}
                          disabled={templates.length === 0}
                        >
                          <Plus className="w-3 h-3 mr-1" /> {t("automation.addToGroup")}
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* ──── STEP 2: Preview ──── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Group ✅ */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-green-700 dark:text-green-400">
                <Check className="w-4 h-4" /> {t("automation.willUpdate")} ({uniqueUpdateStores} {t("automation.stores")})
              </h3>
              {updateRows.length > 0 && (
                <div className="max-h-40 overflow-y-auto mt-1 border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{t("automation.store")}</TableHead>
                        <TableHead className="text-xs">{t("automation.item")}</TableHead>
                        <TableHead className="text-xs text-right">{t("automation.current")}</TableHead>
                        <TableHead className="text-xs text-center"></TableHead>
                        <TableHead className="text-xs text-right">{t("automation.new")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {updateRows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs py-1">{row.storeName}</TableCell>
                          <TableCell className="text-xs py-1">{row.pieceName}</TableCell>
                          <TableCell className="text-xs py-1 text-right">{row.currentQty}</TableCell>
                          <TableCell className="text-xs py-1 text-center"><ArrowRight className="w-3 h-3 mx-auto" /></TableCell>
                          <TableCell className="text-xs py-1 text-right font-semibold">{row.newQty}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Group ⚠️ */}
            {outsideRows.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" /> {t("automation.outsideFilter")} ({uniqueOutsideStores} {t("automation.stores")})
                </h3>
                <div className="flex gap-2 mt-1 mb-1">
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setAllOutside("zero")}>
                    {t("automation.zeroAll")}
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setAllOutside("keep")}>
                    {t("automation.keepAll")}
                  </Button>
                </div>
                <div className="max-h-40 overflow-y-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{t("automation.store")}</TableHead>
                        <TableHead className="text-xs">{t("automation.item")}</TableHead>
                        <TableHead className="text-xs text-right">{t("automation.currentQty")}</TableHead>
                        <TableHead className="text-xs">{t("automation.action")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outsideRows.map((row, i) => {
                        const key = `${row.storeId}-${row.pieceId}`;
                        return (
                          <TableRow key={i}>
                            <TableCell className="text-xs py-1">{row.storeName}</TableCell>
                            <TableCell className="text-xs py-1">{row.pieceName}</TableCell>
                            <TableCell className="text-xs py-1 text-right">{row.currentQty}</TableCell>
                            <TableCell className="py-1">
                              <RadioGroup
                                value={outsideActions[key] || "keep"}
                                onValueChange={(v) => setOutsideActions(prev => ({ ...prev, [key]: v as OutsideFilterAction }))}
                                className="flex gap-3"
                              >
                                <div className="flex items-center gap-1">
                                  <RadioGroupItem value="keep" id={`keep-${key}`} />
                                  <Label htmlFor={`keep-${key}`} className="text-[10px]">{t("automation.keep")}</Label>
                                </div>
                                <div className="flex items-center gap-1">
                                  <RadioGroupItem value="zero" id={`zero-${key}`} />
                                  <Label htmlFor={`zero-${key}`} className="text-[10px]">{t("automation.zero")}</Label>
                                </div>
                              </RadioGroup>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Group ⏭️ */}
            {ignoredCount > 0 && (
              <p className="text-xs text-muted-foreground">
                ⏭️ {t("automation.ignoredStores", { count: ignoredCount })}
              </p>
            )}

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
