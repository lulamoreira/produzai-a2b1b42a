import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as XLSX from "xlsx";
import { Sparkles, Upload, ArrowRight, ArrowLeft, AlertCircle, Loader2, Tag, History, Trash2, Eye, ArrowUp, ArrowDown, ArrowUpDown, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getStoreIdentityKey } from "@/lib/storeHelpers";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type ImportWizardMode = "stores" | "pieces";

interface SystemField {
  key: string;
  label: string;
  required?: boolean;
  isCustom?: boolean;
  index?: number;
}

export interface ImportWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ImportWizardMode;
  existingItems: { name: string; id: string; cnpj?: string | null }[];
  clientId?: string;
  campaignId?: string;
  onImport: (
    rows: Record<string, string>[],
    options: { 
      updateExisting: boolean;
      disableMissingIds?: string[];
      onProgress?: (current: number, total: number, name?: string) => void;
    },
  ) => Promise<void>;
  trigger?: React.ReactNode;
}

const STORE_FIELDS: SystemField[] = [
  { key: "name", label: "Nome", required: true },
  { key: "nickname", label: "Apelido" },
  { key: "store_code", label: "Código" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "UF" },
  { key: "cnpj", label: "CNPJ" },
  { key: "state_registration", label: "IE" },
  { key: "zip_code", label: "CEP" },
  { key: "street", label: "Rua" },
  { key: "number", label: "Número" },
  { key: "complement", label: "Complemento" },
  { key: "neighborhood", label: "Bairro" },
  { key: "phone", label: "Telefone" },
  { key: "manager_name", label: "Gerente" },
  { key: "email", label: "E-mail" },
  { key: "store_model", label: "Modelo" },
  { key: "country", label: "País" },
  { key: "showcase_count", label: "Vitrines" },
  { key: "observations", label: "Observações" },
];

const PIECE_FIELDS: SystemField[] = [
  { key: "name", label: "Nome", required: true },
  { key: "code", label: "Código" },
  { key: "category", label: "Localização" },
  { key: "size", label: "Tamanho" },
  { key: "specification", label: "Especificação" },
  { key: "store_model", label: "Modelo de Loja" },
  { key: "instructions", label: "Instruções" },
  { key: "sub_location", label: "Sublocalização" },
  { key: "kit_only", label: "Apenas em Kit" },
];

const IGNORE = "__ignore__";

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export default function ImportWizardDialog({
  open,
  onOpenChange,
  mode,
  existingItems,
  clientId,
  campaignId,
  onImport,
  trigger,
}: ImportWizardDialogProps) {
  const { t } = useTranslation();

  // ─── Custom Fields Logic ──────────────────────────────────────────────────
  const { data: client } = useQuery({
    queryKey: ["clients", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase.from("clients").select("*").eq("id", clientId).single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!clientId && mode === "stores",
  });

  const { data: campaign } = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      const { data, error } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!campaignId && mode === "pieces",
  });

  const customFields: SystemField[] = useMemo(() => {
    if (mode === "stores" && client) {
      return Array.from({ length: 15 }, (_, i) => {
        const idx = i + 1;
        const rawLabel = (client as any)[`custom_field_${idx}_label`];
        if (!rawLabel) return null;
        const name = rawLabel.split("|")[0];
        return {
          key: `custom_field_${idx}`,
          label: name,
          isCustom: true,
          index: idx
        } as SystemField;
      }).filter((f): f is SystemField => f !== null);
    }
    
    if (mode === "pieces" && campaign) {
      return Array.from({ length: 5 }, (_, i) => {
        const idx = i + 1;
        const label = (campaign as any)[`piece_custom_field_${idx}_label`];
        if (!label) return null;
        return {
          key: `custom_field_${idx}`,
          label: label,
          isCustom: true,
          index: idx
        } as SystemField;
      }).filter((f): f is SystemField => f !== null);
    }
    
    return [];
  }, [client, campaign, mode]);

  const systemFields = useMemo(() => {
    const base = mode === "stores" ? STORE_FIELDS : PIECE_FIELDS;
    return [...base, ...customFields];
  }, [mode, customFields]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState<string>("");
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [samples, setSamples] = useState<Record<string, string>>({});
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [aiMapped, setAiMapped] = useState<Set<string>>(new Set());
  const [loadingAI, setLoadingAI] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [disableMissing, setDisableMissing] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [currentStoreName, setCurrentStoreName] = useState('');
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusSelectedFields, setStatusSelectedFields] = useState<Set<string>>(new Set(["name", "cnpj"]));
  const [statusSort, setStatusSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "action", dir: "asc" });
  const [statusActionFilter, setStatusActionFilter] = useState<string>("all");

  const queryClient = useQueryClient();

  // ─── Mapping history ──────────────────────────────────────────────────────
  const historyKey = ["import_mapping_history", mode, campaignId ?? null, clientId ?? null];
  const { data: history = [] } = useQuery({
    queryKey: historyKey,
    enabled: open,
    queryFn: async () => {
      let q = (supabase.from("import_mapping_history" as any) as any)
        .select("id, file_name, columns, mapping, ai_mapped_columns, source, rows_count, created_at, created_by")
        .eq("mode", mode)
        .order("created_at", { ascending: false })
        .limit(20);
      if (campaignId) q = q.eq("campaign_id", campaignId);
      else if (clientId) q = q.eq("client_id", clientId);
      else return [];
      const { data, error } = await q;
      if (error) { console.error(error); return []; }
      return (data ?? []) as Array<{
        id: string; file_name: string; columns: string[]; mapping: Record<string, string>;
        ai_mapped_columns: string[]; source: string; rows_count: number; created_at: string; created_by: string | null;
      }>;
    },
  });

  const applyHistoryEntry = useCallback((entry: {
    mapping: Record<string, string>; ai_mapped_columns: string[];
  }) => {
    if (columns.length === 0) {
      toast.error("Carregue um arquivo antes de aplicar um mapeamento.");
      return;
    }
    const next: Record<string, string> = {};
    for (const c of columns) {
      const v = entry.mapping?.[c];
      next[c] = v && systemFields.some((f) => f.key === v) ? v : IGNORE;
    }
    setMapping(next);
    setAiMapped(new Set((entry.ai_mapped_columns ?? []).filter((c) => columns.includes(c))));
    toast.success("Mapeamento anterior aplicado.");
  }, [columns, systemFields]);

  const deleteHistoryEntry = useCallback(async (id: string) => {
    const { error } = await (supabase.from("import_mapping_history" as any) as any).delete().eq("id", id);
    if (error) { toast.error("Não foi possível excluir."); return; }
    queryClient.invalidateQueries({ queryKey: historyKey });
    toast.success("Registro removido.");
  }, [queryClient, historyKey]);



  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setFileName("");
      setRawRows([]);
      setColumns([]);
      setSamples({});
      setMapping({});
      setAiMapped(new Set());
      setLoadingAI(false);
      setUpdateExisting(true);
      setDisableMissing(true);
      setImporting(false);
      setImportProgress({ current: 0, total: 0 });
      setCurrentStoreName('');
      setStatusSelectedFields(new Set(["name", "cnpj"]));
    }
  }, [open]);

  // ─── Step 1 — file parse ──────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Use range: 0 to ensure we get all rows including the header for manual mapping detection if needed,
        // but sheet_to_json with default options usually treats first row as header and returns objects.
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
        
        if (rows.length === 0) {
          toast.error("Planilha vazia.");
          return;
        }

        // rows already has the first row (header) removed and used as keys.
        // So rawRows[0] is the FIRST DATA ROW.
        
        const cols = Object.keys(rows[0] ?? {});
        const sampleMap: Record<string, string> = {};
        for (const c of cols) {
          const found = rows.find((r) => String(r[c] ?? "").trim() !== "");
          sampleMap[c] = found ? String(found[c]) : "";
        }
        // Default mapping: ignore everything; AI step will fill in.
        const initial: Record<string, string> = {};
        for (const c of cols) initial[c] = IGNORE;

        setFileName(file.name);
        setRawRows(rows);
        setColumns(cols);
        setSamples(sampleMap);
        setMapping(initial);
        setAiMapped(new Set());
      } catch (e) {
        console.error(e);
        toast.error("Erro ao ler a planilha.");
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  // ─── Step 2 — AI auto-mapping ─────────────────────────────────────────────
  const runAIMapping = useCallback(async () => {
    if (columns.length === 0) return;
    setLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-field-mapping", {
        body: { columns, samples, systemFields },
      });
      if (error) throw error;
      const aiMapping = (data?.mapping ?? {}) as Record<string, string | null>;
      const next: Record<string, string> = { ...mapping };
      const flagged = new Set<string>();
      for (const col of columns) {
        const suggested = aiMapping[col];
        if (suggested) {
          const field = systemFields.find((f) => f.key === suggested || f.label === suggested);
          if (field) {
            next[col] = field.key;
            flagged.add(col);
          }
        }
      }
      setMapping(next);
      setAiMapped(flagged);
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("429") || /rate/i.test(msg)) {
        toast.error("Limite de requisições. Tente novamente em instantes.");
      } else if (msg.includes("402") || /credit/i.test(msg)) {
        toast.error("Créditos de IA esgotados. Adicione em Configurações.");
      } else {
        toast.warning("Não foi possível auto-mapear. Mapeie manualmente.");
      }
    } finally {
      setLoadingAI(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, samples, systemFields]);

  // Trigger AI mapping when entering Step 2 the first time
  useEffect(() => {
    if (step === 2 && columns.length > 0 && aiMapped.size === 0 && !loadingAI) {
      // only if mapping is still all-ignored
      const allIgnored = columns.every((c) => mapping[c] === IGNORE);
      if (allIgnored) runAIMapping();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ─── Validation ───────────────────────────────────────────────────────────
  const requiredKeys = systemFields.filter((f) => f.required).map((f) => f.key);
  const mappedSystemKeys = useMemo(() => {
    const keys = new Set<string>();
    Object.values(mapping).forEach((v) => {
      if (v === IGNORE) return;
      const field = systemFields.find((f) => f.key === v || f.label === v);
      keys.add(field ? field.key : v);
    });
    return keys;
  }, [mapping, systemFields]);
  const missingRequired = requiredKeys.filter((k) => !mappedSystemKeys.has(k));
  const canAdvanceFromStep2 = missingRequired.length === 0;

  // ─── Step 3 — preview transformed rows ────────────────────────────────────
  const transformedRows = useMemo(() => {
    // rawRows already has the header removed and objects with correct keys.
    // So rawRows[0] is the first store (e.g., GEA).
    return rawRows.map((row) => {
      const out: Record<string, string> = {};
      for (const [col, mappingValue] of Object.entries(mapping)) {
        if (mappingValue === IGNORE) continue;
        
        // Find the system field to get the correct key (e.g. custom_field_1)
        const field = systemFields.find(f => f.key === mappingValue || f.label === mappingValue);
        const targetKey = field ? field.key : mappingValue;

        const value = row[col];
        // Ensure values like 0 or "0" are not treated as empty.
        // Also ensure everything is converted to a trimmed string for consistency.
        out[targetKey] = (value !== null && value !== undefined && value !== "") 
          ? String(value).trim() 
          : "";
      }
      return out;
    });
  }, [rawRows, mapping, systemFields]);

  const fileDuplicates = useMemo(() => {
    if (mode !== "stores") return [] as Record<string, string>[];
    const seen = new Set<string>();
    const dups: Record<string, string>[] = [];
    transformedRows.forEach((row) => {
      const identityKey = getStoreIdentityKey({ name: row.name, cnpj: row.cnpj });
      if (!identityKey) return;
      if (seen.has(identityKey)) dups.push(row);
      else seen.add(identityKey);
    });
    return dups;
  }, [mode, transformedRows]);

  const importRows = useMemo(() => {
    if (mode !== "stores") return transformedRows;

    const rowsByIdentity = new Map<string, Record<string, string>>();
    const rowsWithoutIdentity: Record<string, string>[] = [];

    transformedRows.forEach((row) => {
      const identityKey = getStoreIdentityKey({ name: row.name, cnpj: row.cnpj });
      if (!identityKey) {
        rowsWithoutIdentity.push(row);
        return;
      }
      rowsByIdentity.set(identityKey, row);
    });

    return [...rowsByIdentity.values(), ...rowsWithoutIdentity];
  }, [mode, transformedRows]);

  const stats = useMemo(() => {
    const existingKeys = new Set(existingItems.map((i) => getStoreIdentityKey(i)).filter(Boolean));
    const toCreateRows: Record<string, string>[] = [];
    const toUpdateRows: Record<string, string>[] = [];
    const ignoredRows: { row: Record<string, string>; missing: string[]; index: number }[] = [];
    importRows.forEach((r, idx) => {
      const missing = requiredKeys.filter((k) => (r[k] ?? "").trim() === "");
      if (missing.length > 0) {
        ignoredRows.push({ row: r, missing, index: idx + 2 });
        return;
      }
      const identityKey = getStoreIdentityKey({ name: r.name, cnpj: r.cnpj });
      if (updateExisting && identityKey && existingKeys.has(identityKey)) toUpdateRows.push(r);
      else toCreateRows.push(r);
    });
    return {
      toCreate: toCreateRows.length,
      toUpdate: toUpdateRows.length,
      ignored: ignoredRows.length,
      toCreateRows,
      toUpdateRows,
      ignoredRows,
    };
  }, [importRows, existingItems, updateExisting, requiredKeys]);

  // Existing items whose name + CNPJ identity is NOT present in the incoming file (stores mode only)
  const missingStores = useMemo(() => {
    if (mode !== "stores") return [] as { id: string; name: string; cnpj?: string | null }[];
    const incomingKeys = new Set(
      importRows
        .map((r) => getStoreIdentityKey({ name: r.name, cnpj: r.cnpj }))
        .filter((key) => key !== "")
    );
    return existingItems.filter((s) => !incomingKeys.has(getStoreIdentityKey(s)));
  }, [mode, existingItems, importRows]);

  // Pre-existing duplicates in DB: same name + CNPJ identity appears more than once.
  // Keep the first as canonical, mark the extras to be auto-disabled — otherwise
  // they surface as ghost "Atualizar" rows in the status view and every future
  // import keeps propagating the dedup problem forward.
  const duplicateExtras = useMemo(() => {
    if (mode !== "stores") return [] as { id: string; name: string; cnpj?: string | null }[];
    const seen = new Set<string>();
    const extras: { id: string; name: string; cnpj?: string | null }[] = [];
    for (const s of existingItems) {
      const k = getStoreIdentityKey(s);
      if (!k) continue;
      if (seen.has(k)) extras.push(s);
      else seen.add(k);
    }
    return extras;
  }, [mode, existingItems]);
  const duplicateExtraIds = useMemo(
    () => new Set(duplicateExtras.map((s) => s.id)),
    [duplicateExtras]
  );

  // How many stores will be active after import (stores mode)
  const activeAfterImport = useMemo(() => {
    if (mode !== "stores") return 0;
    const keptExisting =
      existingItems.length -
      (disableMissing ? missingStores.length : 0) -
      duplicateExtras.length;
    return keptExisting + stats.toCreate;
  }, [mode, existingItems.length, disableMissing, missingStores.length, duplicateExtras.length, stats.toCreate]);

  // Unified status list — every store classified with its action
  type StatusRow = {
    action: "criar" | "atualizar" | "manter" | "desativar" | "ignorar";
    name: string;
    data: Record<string, string>;
    key: string;
  };
  const statusRows = useMemo<StatusRow[]>(() => {
    if (mode !== "stores") return [];
    const rows: StatusRow[] = [];
    const incomingByIdentity = new Map<string, Record<string, string>>();
    importRows.forEach((r) => {
      const key = getStoreIdentityKey({ name: r.name, cnpj: r.cnpj });
      if (key) incomingByIdentity.set(key, r);
    });
    const existingIdentityKeys = new Set(existingItems.map((i) => getStoreIdentityKey(i)).filter(Boolean));

    // Enforce dedup here directly: first occurrence of each normalized name +
    // CNPJ identity is canonical; only later records with the same identity are disabled.
    const seenExistingIdentityKeys = new Set<string>();

    existingItems.forEach((s) => {
      const identityKey = getStoreIdentityKey(s);
      const isDuplicate = identityKey !== "" && seenExistingIdentityKeys.has(identityKey);
      if (identityKey) seenExistingIdentityKeys.add(identityKey);

      if (isDuplicate || duplicateExtraIds.has(s.id)) {
        rows.push({
          action: "desativar",
          name: `${s.name} (duplicada)`,
          data: { name: s.name, cnpj: s.cnpj ?? "" },
          key: `e-${s.id}`,
        });
        return;
      }

      const incoming = incomingByIdentity.get(identityKey);
      if (incoming) {
        rows.push({
          action: updateExisting ? "atualizar" : "manter",
          name: s.name,
          data: incoming,
          key: `e-${s.id}`,
        });
      } else {
        rows.push({
          action: disableMissing ? "desativar" : "manter",
          name: s.name,
          data: { name: s.name, cnpj: s.cnpj ?? "" },
          key: `e-${s.id}`,
        });
      }
    });

    // New/ignored from file
    stats.toCreateRows.forEach((r, i) => {
      const identityKey = getStoreIdentityKey({ name: r.name, cnpj: r.cnpj });
      if (identityKey && existingIdentityKeys.has(identityKey)) return; // already accounted (update)
      rows.push({ action: "criar", name: r.name || `(sem nome) #${i + 1}`, data: r, key: `c-${i}` });
    });
    stats.ignoredRows.forEach((r, i) => {
      rows.push({
        action: "ignorar",
        name: r.row.name || `(linha ${r.index})`,
        data: r.row,
        key: `i-${i}`,
      });
    });
    return rows;
  }, [mode, existingItems, importRows, stats.toCreateRows, stats.ignoredRows, updateExisting, disableMissing, duplicateExtraIds]);

  const filteredStatusRows = useMemo(() => {
    const filtered = statusActionFilter === "all"
      ? statusRows
      : statusRows.filter((r) => r.action === statusActionFilter);
    const dir = statusSort.dir === "asc" ? 1 : -1;
    const f = statusSort.field;
    return [...filtered].sort((a, b) => {
      const av = f === "action" ? a.action : f === "name" ? a.name : (a.data[f] ?? "");
      const bv = f === "action" ? b.action : f === "name" ? b.name : (b.data[f] ?? "");
      return String(av).localeCompare(String(bv), "pt-BR", { numeric: true }) * dir;
    });
  }, [statusRows, statusActionFilter, statusSort]);

  const toggleStatusSort = (field: string) => {
    setStatusSort((s) => s.field === field ? { field, dir: s.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" });
  };

  const actionBadgeClass = (action: StatusRow["action"]) => {
    switch (action) {
      case "criar": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
      case "atualizar": return "bg-primary/15 text-primary";
      case "manter": return "bg-muted text-muted-foreground";
      case "desativar": return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
      case "ignorar": return "bg-destructive/15 text-destructive";
    }
  };


  // ─── Confirm import ───────────────────────────────────────────────────────
  const handleConfirm = async () => {
    const valid = importRows.filter((r) =>
      requiredKeys.every((k) => (r[k] ?? "").trim() !== ""),
    );
    if (valid.length === 0) {
      toast.error("Nenhuma linha válida para importar.");
      return;
    }
    setImporting(true);
    setImportProgress({ current: 0, total: valid.length });
    setCurrentStoreName('');
    
    try {
      await onImport(valid, { 
        updateExisting,
        disableMissingIds: mode === "stores"
          ? [
              ...(disableMissing ? missingStores.map((s) => s.id) : []),
              ...duplicateExtras.map((s) => s.id),
            ]
          : [],
        onProgress: (current, total, name) => {
          setImportProgress({ current, total });
          if (name) setCurrentStoreName(name);
        }
      });

      // Save mapping history (fire-and-forget)
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes?.user?.id;
        if (uid && (campaignId || clientId)) {
          const cleanMapping: Record<string, string> = {};
          for (const [c, v] of Object.entries(mapping)) if (v !== IGNORE) cleanMapping[c] = v;
          const aiCols = Array.from(aiMapped);
          const source = aiCols.length === 0
            ? "manual"
            : aiCols.length === Object.keys(cleanMapping).length ? "ai" : "mixed";
          await (supabase.from("import_mapping_history" as any) as any).insert({
            campaign_id: campaignId ?? null,
            client_id: clientId ?? null,
            mode,
            file_name: fileName,
            columns,
            mapping: cleanMapping,
            ai_mapped_columns: aiCols,
            source,
            rows_count: valid.length,
            created_by: uid,
          });
          queryClient.invalidateQueries({ queryKey: historyKey });
        }
      } catch (err) {
        console.warn("Falha ao salvar histórico de mapeamento:", err);
      }

      toast.success(t("common.import") + " concluída: " + valid.length + " registro(s).");
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro durante importação.");
    } finally {
      setImporting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {t("common.import")} {mode === "stores" ? t("modules.stores") : t("modules.pieces")}
            <span className="text-xs font-normal text-muted-foreground ml-2">
              Etapa {step} de 3
            </span>
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Selecione um arquivo .xlsx, .xls ou .csv."}
            {step === 2 && "Mapeie as colunas da planilha para os campos do sistema."}
            {step === 3 && "Revise e confirme a importação."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
        {/* ─── STEP 1 ─── */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <label className="block">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {fileName ? fileName : "Clique para selecionar um arquivo"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  .xlsx, .xls ou .csv
                </p>
              </div>
            </label>

            {rawRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  <strong>{rawRows.length}</strong> linha(s) detectada(s),{" "}
                  <strong>{columns.length}</strong> coluna(s).
                </p>
                <div className="border rounded-md overflow-x-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {columns.map((c) => (
                          <TableHead key={c} className="text-xs whitespace-nowrap">
                            {c}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rawRows.slice(0, 5).map((r, i) => (
                        <TableRow key={i}>
                          {columns.map((c) => (
                            <TableCell key={c} className="text-xs whitespace-nowrap">
                              {String(r[c] ?? "")}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {history.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <History className="w-3.5 h-3.5" />
                  Mapeamentos anteriores desta {campaignId ? "campanha" : "cliente"}
                </div>
                <div className="border rounded-md divide-y max-h-56 overflow-y-auto">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-center gap-2 p-2 text-xs hover:bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{h.file_name}</div>
                        <div className="text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                          <Badge variant="outline" className="h-4 px-1 text-[9px]">{h.source}</Badge>
                          <span>{Object.keys(h.mapping || {}).length} col.</span>
                          <span>{h.rows_count} linhas</span>
                        </div>
                      </div>
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs"
                        disabled={columns.length === 0}
                        onClick={() => applyHistoryEntry(h)}
                      >
                        Reaplicar
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => deleteHistoryEntry(h.id)}
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                {columns.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Selecione um arquivo para poder reaplicar um mapeamento.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── STEP 2 ─── */}
        {step === 2 && (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Campos com <span className="text-destructive">*</span> são obrigatórios.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 gap-1"
                onClick={runAIMapping}
                disabled={loadingAI}
              >
                {loadingAI ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Mapear com IA
              </Button>
            </div>

            {loadingAI && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                <Loader2 className="w-3 h-3 animate-spin" />
                A IA está analisando suas colunas...
              </div>
            )}

            <div className="space-y-2">
              {columns.map((col) => (
                <div
                  key={col}
                  className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 items-start p-2 rounded border bg-card"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{col}</p>
                      {aiMapped.has(col) && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" /> IA
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      Ex: {samples[col] || <em>vazio</em>}
                    </p>
                  </div>
                  <Select
                    value={mapping[col] ?? IGNORE}
                    onValueChange={(v) => {
                      setMapping((m) => ({ ...m, [col]: v }));
                      setAiMapped((s) => {
                        const next = new Set(s);
                        next.delete(col);
                        return next;
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={IGNORE}>Ignorar campo</SelectItem>
                      <SelectGroup>
                        <SelectLabel>Campos do Sistema</SelectLabel>
                        {systemFields.filter(f => !f.isCustom).map((f) => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.label}
                            {f.required && <span className="text-destructive ml-1">*</span>}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      {systemFields.some(f => f.isCustom) && (
                        <>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel>Campos Personalizados</SelectLabel>
                            {systemFields.filter(f => f.isCustom).map((f) => (
                              <SelectItem key={f.key} value={f.key}>
                                <div className="flex items-center gap-1.5">
                                  <Tag className="w-3 h-3 text-primary" />
                                  {f.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {missingRequired.length > 0 && (
              <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  Mapeie os campos obrigatórios:{" "}
                  <strong>
                    {missingRequired
                      .map((k) => systemFields.find((f) => f.key === k)?.label ?? k)
                      .join(", ")}
                  </strong>
                </div>
              </div>
            )}
          </div>
        )}


        {/* ─── STEP 3 ─── */}
        {step === 3 && (
          <div className="space-y-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded border bg-muted/30">
              <div className="text-xs space-y-0.5">
                <p>
                  <strong>{stats.toCreate}</strong> registro(s) serão criados
                </p>
                {updateExisting && (
                  <p>
                    <strong>{stats.toUpdate}</strong> serão atualizados (por nome + CNPJ)
                  </p>
                {mode === "stores" && fileDuplicates.length > 0 && (
                  <p className="text-amber-600 dark:text-amber-500 font-medium">
                    <strong>{fileDuplicates.length}</strong> linha(s) duplicada(s) no arquivo (mesmo nome + CNPJ) — apenas a última ocorrência será usada
                  </p>
                )}
                {stats.ignored > 0 && (
                  <p className="text-muted-foreground">
                    <strong>{stats.ignored}</strong> ignorado(s) (campos obrigatórios ausentes)
                  </p>
                )}
                {mode === "stores" && missingStores.length > 0 && (
                  <p className={disableMissing ? "text-amber-600 dark:text-amber-500 font-medium" : "text-muted-foreground"}>
                    <strong>{missingStores.length}</strong>{" "}
                    {disableMissing
                      ? "loja(s) serão desativadas (ausentes no arquivo — preservadas em campanhas passadas)"
                      : "loja(s) ausentes no arquivo permanecerão ativas"}
                  </p>
                )}
                {mode === "stores" && customFields.length > 0 && mappedSystemKeys.size > 0 && (
                  <p className="text-primary font-medium">
                    {(() => {
                      const standardMapped = Array.from(mappedSystemKeys).filter(k => !systemFields.find(f => f.key === k)?.isCustom).length;
                      const customMapped = Array.from(mappedSystemKeys).filter(k => systemFields.find(f => f.key === k)?.isCustom).length;
                      return `${standardMapped} campos padrão + ${customMapped} campos personalizados por loja`;
                    })()}
                  </p>
                )}
                {mode === "stores" && (
                  <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500 font-semibold pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span><strong>{activeAfterImport}</strong> loja(s) ativas para a próxima campanha</span>
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 items-end">
                <div className="flex items-center gap-2">
                  <Switch
                    id="update-existing"
                    checked={updateExisting}
                    onCheckedChange={setUpdateExisting}
                  />
                  <Label htmlFor="update-existing" className="text-xs cursor-pointer">
                    Atualizar duplicados por nome + CNPJ
                  </Label>
                </div>
                {mode === "stores" && missingStores.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="disable-missing"
                      checked={disableMissing}
                      onCheckedChange={setDisableMissing}
                    />
                    <Label htmlFor="disable-missing" className="text-xs cursor-pointer">
                      Desativar lojas ausentes
                    </Label>
                  </div>
                )}
              </div>
            </div>

            {mode === "stores" && statusRows.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center"
                onClick={() => setStatusDialogOpen(true)}
              >
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                Ver status detalhado das {statusRows.length} loja(s)
              </Button>
            )}


            {mode === "stores" && missingStores.length > 0 && (
              <details className="border rounded-md p-2 text-xs">
                <summary className="cursor-pointer text-amber-600 dark:text-amber-500 font-medium">
                  Ver {missingStores.length} loja(s) que {disableMissing ? "serão desativadas" : "estão fora do arquivo"}
                </summary>
                <div className="mt-2 max-h-40 overflow-y-auto flex flex-wrap gap-1">
                  {missingStores.map((s) => (
                    <Badge key={s.id} variant="secondary" className="text-[10px]">
                      {s.name}
                    </Badge>
                  ))}
                </div>
              </details>
            )}

            {stats.toCreate > 0 && (
              <details className="border rounded-md p-2 text-xs">
                <summary className="cursor-pointer text-emerald-600 dark:text-emerald-500 font-medium">
                  Ver {stats.toCreate} registro(s) que serão criados
                </summary>
                <div className="mt-2 max-h-40 overflow-y-auto flex flex-wrap gap-1">
                  {stats.toCreateRows.map((r, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">
                      {r.name || `(sem nome) #${i + 1}`}
                    </Badge>
                  ))}
                </div>
              </details>
            )}

            {updateExisting && stats.toUpdate > 0 && (
              <details className="border rounded-md p-2 text-xs">
                <summary className="cursor-pointer text-primary font-medium">
                  Ver {stats.toUpdate} registro(s) que serão atualizados (por nome + CNPJ)
                </summary>
                <div className="mt-2 max-h-40 overflow-y-auto flex flex-wrap gap-1">
                  {stats.toUpdateRows.map((r, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">
                      {r.name}
                    </Badge>
                  ))}
                </div>
              </details>
            )}

            {stats.ignored > 0 && (
              <details className="border rounded-md p-2 text-xs">
                <summary className="cursor-pointer text-destructive font-medium">
                  Ver {stats.ignored} registro(s) ignorado(s) — campos obrigatórios ausentes
                </summary>
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {stats.ignoredRows.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 border-b border-border/50 pb-1 last:border-0">
                      <span className="text-muted-foreground shrink-0">Linha {r.index}:</span>
                      <span className="truncate">{r.row.name || "(sem nome)"}</span>
                      <span className="ml-auto text-destructive text-[10px] shrink-0">
                        faltando:{" "}
                        {r.missing
                          .map((k) => systemFields.find((f) => f.key === k)?.label ?? k)
                          .join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div className="border rounded-md overflow-x-auto max-h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Array.from(mappedSystemKeys).map((k) => {
                      const f = systemFields.find((x) => x.key === k);
                      return (
                        <TableHead key={k} className="text-xs whitespace-nowrap">
                          {f?.label ?? k}
                          {f?.required && <span className="text-destructive ml-1">*</span>}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transformedRows.slice(0, 10).map((r, i) => (
                    <TableRow key={i}>
                      {Array.from(mappedSystemKeys).map((k) => (
                        <TableCell key={k} className="text-xs whitespace-nowrap">
                          {r[k] || <span className="text-muted-foreground italic">—</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {importing && (
              <div className="space-y-2 mt-4">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Importando lojas...</span>
                  <span>{importProgress.current} de {importProgress.total}</span>
                </div>
                <Progress value={(importProgress.current / (importProgress.total || 1)) * 100} className="h-2" />
                {currentStoreName && (
                  <p className="text-[10px] text-muted-foreground truncate italic">
                    Processando: {currentStoreName}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between gap-2 p-6 pt-2 border-t mt-auto bg-background sticky bottom-0 z-20">


          <Button
            variant="outline"
            size="sm"
            disabled={step === 1 || importing}
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
          >
            <ArrowLeft className="w-3 h-3 mr-1" /> {t("common.back")}
          </Button>
          {step < 3 ? (
            <Button
              size="sm"
              disabled={
                (step === 1 && rawRows.length === 0) ||
                (step === 2 && !canAdvanceFromStep2) ||
                loadingAI
              }
              onClick={() => setStep((s) => ((s + 1) as 1 | 2 | 3))}
            >
              {t("common.next")} <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={importing || stats.toCreate + stats.toUpdate === 0}
              onClick={handleConfirm}
            >
              {importing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" /> {t("common.loading")}
                </>
              ) : (
                <>{t("common.confirm")} {t("common.import")}</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* ─── Status detalhado ─── */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Status detalhado das lojas
            </DialogTitle>
            <DialogDescription>
              O que vai acontecer com cada loja quando você confirmar a importação.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-3 space-y-3 border-b">
            <div>
              <p className="text-xs font-medium mb-1.5">Campos a exibir:</p>
              <div className="flex flex-wrap gap-2">
                {[{ key: "name", label: "Nome" }, { key: "cnpj", label: "CNPJ" }, ...Array.from(mappedSystemKeys).filter((k) => k !== "name" && k !== "cnpj").map((k) => ({ key: k, label: systemFields.find((f) => f.key === k)?.label ?? k }))].map((f) => (
                  <label key={f.key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox
                      checked={statusSelectedFields.has(f.key)}
                      disabled={f.key === "name"}
                      onCheckedChange={(v) => {
                        setStatusSelectedFields((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(f.key); else next.delete(f.key);
                          return next;
                        });
                      }}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium">Filtrar:</span>
              {[
                { v: "all", l: `Todas (${statusRows.length})` },
                { v: "criar", l: `Criar (${statusRows.filter(r => r.action === "criar").length})` },
                { v: "atualizar", l: `Atualizar (${statusRows.filter(r => r.action === "atualizar").length})` },
                { v: "manter", l: `Manter (${statusRows.filter(r => r.action === "manter").length})` },
                { v: "desativar", l: `Desativar (${statusRows.filter(r => r.action === "desativar").length})` },
                { v: "ignorar", l: `Ignorar (${statusRows.filter(r => r.action === "ignorar").length})` },
              ].map((o) => (
                <Button
                  key={o.v}
                  variant={statusActionFilter === o.v ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setStatusActionFilter(o.v)}
                >
                  {o.l}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto px-6 py-3">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="text-xs whitespace-nowrap cursor-pointer" onClick={() => toggleStatusSort("action")}>
                    <span className="inline-flex items-center gap-1">
                      Ação
                      {statusSort.field === "action" ? (statusSort.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </span>
                  </TableHead>
                  {Array.from(statusSelectedFields).map((k) => {
                    const label = k === "name" ? "Nome" : (systemFields.find((f) => f.key === k)?.label ?? k);
                    return (
                      <TableHead key={k} className="text-xs whitespace-nowrap cursor-pointer" onClick={() => toggleStatusSort(k)}>
                        <span className="inline-flex items-center gap-1">
                          {label}
                          {statusSort.field === k ? (statusSort.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                        </span>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStatusRows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="whitespace-nowrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${actionBadgeClass(r.action)}`}>
                        {r.action}
                      </span>
                    </TableCell>
                    {Array.from(statusSelectedFields).map((k) => (
                      <TableCell key={k} className="text-xs whitespace-nowrap">
                        {k === "name" ? r.name : (r.data[k] || <span className="text-muted-foreground italic">—</span>)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {filteredStatusRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={statusSelectedFields.size + 1} className="text-center text-xs text-muted-foreground py-6">
                      Nenhum registro nesta categoria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="p-6 pt-3 border-t">
            <div className="text-xs text-muted-foreground mr-auto">
              Exibindo {filteredStatusRows.length} de {statusRows.length} loja(s).
            </div>
            <Button size="sm" onClick={() => setStatusDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>

  );
}
