import { useParams } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabaseAnon as supabase } from "@/integrations/supabase/anonClient";
import { Loader2, AlertTriangle, Search, ArrowLeft, CheckCircle2, Store as StoreIcon, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type FieldType = "text" | "number" | "boolean" | "select" | "date";

interface FieldDef {
  field_index: number;
  label: string | null;
  field_type: FieldType;
  options: string[] | null;
  help_text: string | null;
  required: boolean;
}

interface StoreItem {
  id: string;
  name: string;
  store_code: string | null;
  city: string | null;
  state: string | null;
  form_locked: boolean;
  form_submitted_at: string | null;
  values: Record<string, string | null> | null;
}

interface Directory {
  client: { id: string; name: string };
  fields: FieldDef[];
  stores: StoreItem[];
}

export default function StoreFormPortal() {
  const { token } = useParams<{ token: string }>();
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["store-form-portal", token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_client_form_directory_by_token", { p_token: token! });
      if (error) throw error;
      return data as Directory | null;
    },
  });

  const store = useMemo(
    () => data?.stores.find((s) => s.id === selectedStoreId) ?? null,
    [data, selectedStoreId],
  );

  useEffect(() => {
    if (!store || !data) {
      setAnswers({});
      return;
    }
    const init: Record<string, string> = {};
    for (const f of data.fields) {
      const key = `custom_field_${f.field_index}`;
      init[key] = String(store.values?.[String(f.field_index)] ?? "");
    }
    setAnswers(init);
  }, [store, data]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold mb-2">Link inválido ou expirado</h1>
          <p className="text-muted-foreground text-sm">
            Verifique o endereço enviado pelo responsável ou solicite um novo link.
          </p>
        </div>
      </div>
    );
  }

  const filteredStores = data.stores.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.store_code ?? "").toLowerCase().includes(q) ||
      (s.city ?? "").toLowerCase().includes(q)
    );
  });

  const handleSubmit = async () => {
    if (!store) return;
    // Validate required
    for (const f of data.fields) {
      if (!f.required) continue;
      const v = (answers[`custom_field_${f.field_index}`] ?? "").trim();
      if (!v) {
        toast.error(`Preencha o campo obrigatório: ${f.label ?? `Campo ${f.field_index}`}`);
        return;
      }
      if (f.field_type === "number" && isNaN(Number(v))) {
        toast.error(`Valor numérico inválido em: ${f.label}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const { data: res, error } = await supabase.rpc("submit_client_store_form", {
        p_token: token!,
        p_store_id: store.id,
        p_answers: answers as any,
      });
      if (error) throw error;
      const r = res as { success: boolean; error?: string };
      if (!r?.success) {
        const msg =
          r?.error === "already_submitted" ? "Esta ficha já foi enviada." :
          r?.error === "store_mismatch" ? "Loja não pertence a este cliente." :
          r?.error === "invalid_token" ? "Link inválido." :
          "Não foi possível enviar.";
        toast.error(msg);
      } else {
        toast.success("Dados enviados com sucesso!");
        await refetch();
        setSelectedStoreId(null);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar");
    } finally {
      setSubmitting(false);
    }
  };

  // Form view
  if (store) {
    const locked = store.form_locked;
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="bg-background border-b border-border">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedStoreId(null)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground truncate">{data.client.name}</div>
              <h1 className="text-base font-semibold truncate">
                {store.name}
                {store.store_code ? ` · ${store.store_code}` : ""}
              </h1>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {locked && (
            <Alert>
              <Lock className="w-4 h-4" />
              <AlertTitle>Dados já enviados</AlertTitle>
              <AlertDescription>
                Para alterar, solicite liberação ao responsável.
              </AlertDescription>
            </Alert>
          )}

          {data.fields.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum campo disponível para preenchimento.
            </div>
          )}

          <div className="space-y-4">
            {data.fields.map((f) => {
              const key = `custom_field_${f.field_index}`;
              const value = answers[key] ?? "";
              const setValue = (v: string) => setAnswers((p) => ({ ...p, [key]: v }));
              const label = f.label ?? `Campo ${f.field_index}`;
              return (
                <div key={f.field_index} className="rounded-lg border border-border bg-background p-4">
                  <Label className="text-sm font-medium">
                    {label}{f.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <div className="mt-2">
                    {f.field_type === "text" && (
                      <Textarea
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        disabled={locked}
                        rows={2}
                      />
                    )}
                    {f.field_type === "number" && (
                      <Input
                        type="number"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        disabled={locked}
                      />
                    )}
                    {f.field_type === "date" && (
                      <Input
                        type="date"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        disabled={locked}
                      />
                    )}
                    {f.field_type === "boolean" && (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={value === "true"}
                          onCheckedChange={(v) => setValue(v ? "true" : "false")}
                          disabled={locked}
                        />
                        <span className="text-sm text-muted-foreground">
                          {value === "true" ? "Sim" : "Não"}
                        </span>
                      </div>
                    )}
                    {f.field_type === "select" && (
                      <Select value={value} onValueChange={setValue} disabled={locked}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(f.options ?? []).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {f.help_text && (
                    <p className="mt-1.5 text-xs text-muted-foreground">{f.help_text}</p>
                  )}
                </div>
              );
            })}
          </div>

          {!locked && data.fields.length > 0 && (
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Enviar dados
            </Button>
          )}
        </main>
      </div>
    );
  }

  // Directory view
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Ficha da Loja</div>
          <h1 className="text-xl font-bold">{data.client.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione sua loja para preencher a ficha.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, código ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filteredStores.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nenhuma loja encontrada.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {filteredStores.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStoreId(s.id)}
                className="text-left rounded-lg border border-border bg-background p-4 hover:border-primary hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StoreIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm truncate">{s.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {s.store_code ? `${s.store_code} · ` : ""}
                      {[s.city, s.state].filter(Boolean).join(" / ") || "—"}
                    </div>
                  </div>
                  {s.form_locked ? (
                    <Badge variant="secondary" className="shrink-0">Enviada</Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0">Pendente</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
