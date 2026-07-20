import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Plus, X, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  useClientFieldConfig,
  useUpsertClientFieldConfig,
  useCustomFieldFilledCounts,
  type ClientFieldConfig,
  type FieldType,
} from "@/hooks/useClientFieldConfig";

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

  const labels = useMemo(() => {
    const out: { index: number; label: string }[] = [];
    for (let i = 1; i <= 15; i++) {
      const lbl = (client as any)?.[`custom_field_${i}_label`];
      if (lbl && String(lbl).trim() !== "") out.push({ index: i, label: String(lbl) });
    }
    return out;
  }, [client]);

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

  if (labels.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Este cliente ainda não tem campos personalizados definidos.
        <br />
        Defina os rótulos dos campos personalizados na edição do cliente para poder configurá-los aqui.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Marque quais dos campos personalizados do cliente o lojista poderá preencher na Ficha da Loja.
        O valor final continua indo para os mesmos campos personalizados das lojas.
      </div>

      {loadingConfigs || loadingCounts ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
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
        </div>
      )}
    </div>
  );
};

export default StoreFormFieldsConfig;
