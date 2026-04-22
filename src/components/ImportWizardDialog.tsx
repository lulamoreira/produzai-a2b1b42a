import { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { Sparkles, Upload, ArrowRight, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type ImportWizardMode = "stores" | "pieces";

interface SystemField {
  key: string;
  label: string;
  required?: boolean;
}

export interface ImportWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ImportWizardMode;
  existingItems: { name: string; id: string }[];
  onImport: (
    rows: Record<string, string>[],
    options: { updateExisting: boolean },
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
  { key: "code", label: "Código", required: true },
  { key: "category", label: "Localização" },
  { key: "size", label: "Tamanho" },
  { key: "specification", label: "Especificação" },
  { key: "store_category", label: "Modelo de Loja" },
  { key: "installation_instructions", label: "Instruções" },
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
  onImport,
  trigger,
}: ImportWizardDialogProps) {
  const systemFields = mode === "stores" ? STORE_FIELDS : PIECE_FIELDS;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState<string>("");
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [samples, setSamples] = useState<Record<string, string>>({});
  // mapping: spreadsheet column -> system field key (or IGNORE)
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [aiMapped, setAiMapped] = useState<Set<string>>(new Set());
  const [loadingAI, setLoadingAI] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

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
      setImporting(false);
      setProgress(0);
    }
  }, [open]);

  // ─── Step 1 — file parse ──────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
        if (rows.length === 0) {
          toast.error("Planilha vazia.");
          return;
        }
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
        if (suggested && systemFields.some((f) => f.key === suggested)) {
          next[col] = suggested;
          flagged.add(col);
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
  const mappedSystemKeys = useMemo(
    () => new Set(Object.values(mapping).filter((v) => v !== IGNORE)),
    [mapping],
  );
  const missingRequired = requiredKeys.filter((k) => !mappedSystemKeys.has(k));
  const canAdvanceFromStep2 = missingRequired.length === 0;

  // ─── Step 3 — preview transformed rows ────────────────────────────────────
  const transformedRows = useMemo(() => {
    return rawRows.map((row) => {
      const out: Record<string, string> = {};
      for (const [col, fieldKey] of Object.entries(mapping)) {
        if (fieldKey === IGNORE) continue;
        out[fieldKey] = String(row[col] ?? "").trim();
      }
      return out;
    });
  }, [rawRows, mapping]);

  const stats = useMemo(() => {
    const existingNames = new Set(existingItems.map((i) => i.name.trim().toLowerCase()));
    let toCreate = 0;
    let toUpdate = 0;
    let ignored = 0;
    for (const r of transformedRows) {
      const hasRequired = requiredKeys.every((k) => (r[k] ?? "").trim() !== "");
      if (!hasRequired) {
        ignored++;
        continue;
      }
      if (updateExisting && existingNames.has(r.name.trim().toLowerCase())) toUpdate++;
      else toCreate++;
    }
    return { toCreate, toUpdate, ignored };
  }, [transformedRows, existingItems, updateExisting, requiredKeys]);

  // ─── Confirm import ───────────────────────────────────────────────────────
  const handleConfirm = async () => {
    const valid = transformedRows.filter((r) =>
      requiredKeys.every((k) => (r[k] ?? "").trim() !== ""),
    );
    if (valid.length === 0) {
      toast.error("Nenhuma linha válida para importar.");
      return;
    }
    setImporting(true);
    setProgress(0);
    try {
      // Wrap onImport so progress can advance — we expose a chunked-style call.
      // The caller decides processing order. We just animate progress to 100%.
      await onImport(valid, { updateExisting });
      setProgress(100);
      toast.success(`Importação concluída: ${valid.length} registro(s).`);
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar {mode === "stores" ? "Lojas" : "Peças"}
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
                      {systemFields.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}
                          {f.required && <span className="text-destructive ml-1">*</span>}
                        </SelectItem>
                      ))}
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
                    <strong>{stats.toUpdate}</strong> serão atualizados (por nome)
                  </p>
                )}
                {stats.ignored > 0 && (
                  <p className="text-muted-foreground">
                    <strong>{stats.ignored}</strong> ignorado(s) (campos obrigatórios ausentes)
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="update-existing"
                  checked={updateExisting}
                  onCheckedChange={setUpdateExisting}
                />
                <Label htmlFor="update-existing" className="text-xs cursor-pointer">
                  Atualizar duplicados por nome
                </Label>
              </div>
            </div>

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
              <div className="space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">Importando...</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={step === 1 || importing}
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
          >
            <ArrowLeft className="w-3 h-3 mr-1" /> Voltar
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
              Próximo <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={importing || stats.toCreate + stats.toUpdate === 0}
              onClick={handleConfirm}
            >
              {importing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Importando...
                </>
              ) : (
                <>Confirmar Importação</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
