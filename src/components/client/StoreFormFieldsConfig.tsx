import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Plus, X, Loader2, Link2, Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { buildPublicAppUrl } from "@/lib/publicAppOrigin";
import {
  useClientFieldConfig,
  useUpsertClientFieldConfig,
  useCustomFieldFilledCounts,
  type ClientFieldConfig,
  type FieldType,
} from "@/hooks/useClientFieldConfig";
import { MAX_CUSTOM_FIELDS, customFieldIndices, customFieldLabelKey } from "@/lib/customFields";
import { useUpdateClient } from "@/hooks/useMultiClientData";

interface Props {
  clientId: string;
  canEdit: boolean;
}

const TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto",
  number: "Número",
  boolean: "Sim / Não",
  select: "Lista",
  date: "Data",
};

interface RowState {
  fillable_by_store: boolean;
  field_type: FieldType;
  options: string[];
  help_text: string;
  required: boolean;
  dirty: boolean;
  saving: boolean;
}

const emptyRow = (): RowState => ({
  fillable_by_store: false,
  field_type: "text",
  options: [],
  help_text: "",
  required: false,
  dirty: false,
  saving: false,
});

const fromConfig = (c: ClientFieldConfig): RowState => ({
  fillable_by_store: c.fillable_by_store,
  field_type: c.field_type,
  options: c.options ?? [],
  help_text: c.help_text ?? "",
  required: c.required,
  dirty: false,
  saving: false,
});

const StoreFormFieldsConfig = ({ clientId, canEdit }: Props) => {
  // Load client labels (custom_field_1_label .. 15_label)
  const { data: client, isLoading: loadingClient } = useQuery({
    queryKey: ["client-field-labels", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: configs = [], isLoading: loadingConfigs } = useClientFieldConfig(clientId);
  const { data: filledCounts = {}, isLoading: loadingCounts } = useCustomFieldFilledCounts(clientId);
  const upsert = useUpsertClientFieldConfig();

  const { data: tokenRow } = useQuery({
    queryKey: ["client-form-token", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_form_tokens")
        .select("token")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const publicUrl = tokenRow?.token ? buildPublicAppUrl(`/ficha/${tokenRow.token}`) : null;
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast({ title: "Link copiado" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const labels = useMemo(() => {
    const out: { index: number; label: string }[] = [];
    for (const i of customFieldIndices()) {
      const lbl = (client as any)?.[customFieldLabelKey(i)];
      if (lbl && String(lbl).trim() !== "") out.push({ index: i, label: String(lbl) });
    }
    return out;
  }, [client]);

  const emptySlots = useMemo(() => {
    const used = new Set(labels.map((l) => l.index));
    return customFieldIndices().filter((i) => !used.has(i));
  }, [labels]);

  const updateClient = useUpdateClient();
  const [newNames, setNewNames] = useState<Record<number, string>>({});
  const [creatingIdx, setCreatingIdx] = useState<number | null>(null);

  const createField = async (idx: number) => {
    const name = (newNames[idx] ?? "").trim();
    if (!name) {
      toast({ title: "Digite um nome para o campo", variant: "destructive" });
      return;
    }
    setCreatingIdx(idx);
    try {
      await updateClient.mutateAsync({
        id: clientId,
        [customFieldLabelKey(idx)]: name,
      } as any);
      setNewNames((p) => ({ ...p, [idx]: "" }));
      toast({ title: "Campo criado" });
    } catch (e: any) {
      toast({ title: "Erro ao criar campo", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setCreatingIdx(null);
    }
  };

  const [rows, setRows] = useState<Record<number, RowState>>({});

  // Seed local rows from server data when it lands
  useEffect(() => {
    if (loadingConfigs) return;
    setRows((prev) => {
      const next = { ...prev };
      const byIdx = new Map<number, ClientFieldConfig>();
      configs.forEach((c) => byIdx.set(c.field_index, c));
      for (const { index } of labels) {
        // Only reseed if row is not locally dirty
        if (!next[index] || !next[index].dirty) {
          const c = byIdx.get(index);
          next[index] = c ? fromConfig(c) : emptyRow();
        }
      }
      return next;
    });
  }, [configs, labels, loadingConfigs]);

  const updateRow = (idx: number, patch: Partial<RowState>) => {
    setRows((prev) => ({
      ...prev,
      [idx]: { ...(prev[idx] ?? emptyRow()), ...patch, dirty: true },
    }));
  };

  const saveRow = async (idx: number) => {
    const row = rows[idx];
    if (!row) return;
    setRows((prev) => ({ ...prev, [idx]: { ...prev[idx], saving: true } }));
    try {
      await upsert.mutateAsync({
        client_id: clientId,
        field_index: idx,
        fillable_by_store: row.fillable_by_store,
        field_type: row.field_type,
        options: row.field_type === "select" ? row.options.filter((o) => o.trim() !== "") : [],
        help_text: row.help_text.trim() === "" ? null : row.help_text.trim(),
        required: row.required,
      });
      setRows((prev) => ({ ...prev, [idx]: { ...prev[idx], dirty: false, saving: false } }));
      toast({ title: "Configuração salva" });
    } catch (e: any) {
      setRows((prev) => ({ ...prev, [idx]: { ...prev[idx], saving: false } }));
      toast({ title: "Erro ao salvar", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  if (loadingClient) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const usedCount = labels.length;
  const remaining = MAX_CUSTOM_FIELDS - usedCount;

  return (
    <div className="mt-4 space-y-3">
      {publicUrl && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Link2 className="w-4 h-4" /> Link público da Ficha da Loja
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input readOnly value={publicUrl} className="flex-1 min-w-[220px] text-xs font-mono" />
            <Button size="sm" variant="outline" onClick={copyLink}>
              {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Compartilhe com os lojistas. Eles escolhem a loja e preenchem apenas os campos marcados abaixo.
          </p>
        </div>
      )}
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground flex items-center justify-between gap-3 flex-wrap">
        <span>
          Marque quais dos campos personalizados do cliente o lojista poderá preencher na Ficha da Loja.
          O valor final continua indo para os mesmos campos personalizados das lojas.
        </span>
        <span className="text-xs font-medium text-foreground whitespace-nowrap">
          {usedCount} de {MAX_CUSTOM_FIELDS} campos usados
        </span>
      </div>

      {loadingConfigs || loadingCounts ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {labels.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum campo personalizado criado ainda. Crie um abaixo.
            </div>
          )}
          {labels.map(({ index, label }) => {
            const row = rows[index] ?? emptyRow();
            const filled = filledCounts[index] ?? 0;
            return (
              <div key={index} className="rounded-lg border border-border bg-card">
                <div className="flex items-center gap-3 p-3 flex-wrap">
                  <Checkbox
                    checked={row.fillable_by_store}
                    disabled={!canEdit || row.saving}
                    onCheckedChange={(v) =>
                      updateRow(index, { fillable_by_store: !!v })
                    }
                  />
                  <div className="flex-1 min-w-[160px]">
                    <div className="text-sm font-medium text-foreground">{label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Campo #{index} · coluna <code>custom_field_{index}</code>
                    </div>
                  </div>
                  {row.dirty && (
                    <Button
                      size="sm"
                      onClick={() => saveRow(index)}
                      disabled={!canEdit || row.saving}
                    >
                      {row.saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Salvar"}
                    </Button>
                  )}
                </div>

                {row.fillable_by_store && filled > 0 && (
                  <div className="mx-3 mb-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[12px] text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      {filled} loja{filled > 1 ? "s" : ""} já {filled > 1 ? "têm" : "tem"} dados neste campo.
                      Se o lojista preencher, esses dados serão substituídos.
                    </span>
                  </div>
                )}

                {row.fillable_by_store && (
                  <div className="border-t border-border p-3 space-y-3 bg-muted/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Tipo do campo
                        </label>
                        <Select
                          value={row.field_type}
                          onValueChange={(v) =>
                            updateRow(index, { field_type: v as FieldType })
                          }
                          disabled={!canEdit || row.saving}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(TYPE_LABELS) as FieldType[]).map((t) => (
                              <SelectItem key={t} value={t}>
                                {TYPE_LABELS[t]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={row.required}
                            disabled={!canEdit || row.saving}
                            onCheckedChange={(v) =>
                              updateRow(index, { required: !!v })
                            }
                          />
                          Obrigatório
                        </label>
                      </div>
                    </div>

                    {row.field_type === "select" && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Opções da lista
                        </label>
                        <div className="space-y-1.5">
                          {row.options.map((opt, i) => (
                            <div key={i} className="flex gap-2">
                              <Input
                                value={opt}
                                onChange={(e) => {
                                  const next = [...row.options];
                                  next[i] = e.target.value;
                                  updateRow(index, { options: next });
                                }}
                                placeholder={`Opção ${i + 1}`}
                                disabled={!canEdit || row.saving}
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                disabled={!canEdit || row.saving}
                                onClick={() =>
                                  updateRow(index, {
                                    options: row.options.filter((_, j) => j !== i),
                                  })
                                }
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!canEdit || row.saving}
                            onClick={() =>
                              updateRow(index, { options: [...row.options, ""] })
                            }
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Adicionar opção
                          </Button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Texto de ajuda
                      </label>
                      <Input
                        value={row.help_text}
                        onChange={(e) => updateRow(index, { help_text: e.target.value })}
                        placeholder="Instrução mostrada ao lojista (opcional)"
                        disabled={!canEdit || row.saving}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="mt-4 rounded-lg border border-border bg-card p-3">
            <div className="text-sm font-medium text-foreground mb-1">Adicionar novo campo</div>
            <div className="text-[11px] text-muted-foreground mb-3">
              Nomeie um slot disponível para criar um novo campo personalizado no cliente.
            </div>
            {remaining <= 0 ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[12px] text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Limite de {MAX_CUSTOM_FIELDS} campos atingido.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {emptySlots.map((i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-[11px] text-muted-foreground w-14 shrink-0">#{i}</span>
                    <Input
                      value={newNames[i] ?? ""}
                      onChange={(e) => setNewNames((p) => ({ ...p, [i]: e.target.value }))}
                      placeholder="Nome do campo"
                      disabled={!canEdit || creatingIdx === i}
                    />
                    <Button
                      size="sm"
                      onClick={() => createField(i)}
                      disabled={!canEdit || creatingIdx === i || !(newNames[i] ?? "").trim()}
                    >
                      {creatingIdx === i ? <Loader2 className="w-3 h-3 animate-spin" /> : "Criar"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreFormFieldsConfig;
