import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, CheckCircle2, AlertCircle, Send, Clock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface PortalData {
  id: string;
  status: string;
  expires_at: string | null;
  submitted_at: string | null;
  submitted_prices: Record<string, number> | null;
  notes: string | null;
  rejection_notes: string | null;
  supplier: { id: string; company_name: string; contact_name: string };
  pieces: Array<{
    id: string; name: string; code: number;
    specification: string | null; image_url: string | null;
    is_kit: boolean;
    old_qty: number; new_qty: number;
  }>;

  baseline_prices: Record<string, number>;
  baseline_extras: { installation: number; freight: number };
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(Number.isFinite(n) ? n : 0);

const parseNum = (v: string): number => {
  const cleaned = (v || "").toString().replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

export default function BudgetQtyRequotePortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prices, setPrices] = useState<Record<string, string>>({});
  const [installation, setInstallation] = useState("");
  const [freight, setFreight] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data: rpc, error: err } = await supabase.rpc(
        "get_budget_qty_requote" as any,
        { p_token: token } as any
      );
      if (err) throw err;
      const payload = rpc as any;
      if (!payload || payload.error) {
        setError(payload?.error || "Token inválido");
        return;
      }
      const d = payload as PortalData;
      setData(d);

      const pre: Record<string, string> = {};
      const sub = d.submitted_prices || {};
      for (const p of d.pieces) {
        if (sub[p.id] != null) pre[p.id] = String(sub[p.id]);
        else if (d.baseline_prices[p.id] != null) pre[p.id] = String(d.baseline_prices[p.id]);
        else pre[p.id] = "";
      }
      setPrices(pre);
      setInstallation(String(sub.installation ?? d.baseline_extras.installation ?? 0));
      setFreight(String(sub.freight ?? d.baseline_extras.freight ?? 0));
      setNotes(d.notes || "");
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  const total = useMemo(() => {
    if (!data) return 0;
    let sum = 0;
    for (const p of data.pieces) {
      sum += (p.new_qty || 0) * parseNum(prices[p.id] ?? "");
    }
    return sum + parseNum(installation) + parseNum(freight);
  }, [data, prices, installation, freight]);

  const handleSubmit = async () => {
    if (!data || !token) return;
    const missing = data.pieces.filter((p) => !prices[p.id] || parseNum(prices[p.id]) <= 0);
    if (missing.length > 0) {
      toast.error(`Informe o preço de ${missing.length} peça(s)`);
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, number> = {
        installation: parseNum(installation),
        freight: parseNum(freight),
      };
      for (const p of data.pieces) payload[p.id] = parseNum(prices[p.id]);

      const { data: res, error: err } = await supabase.rpc(
        "submit_budget_qty_requote" as any,
        { p_token: token, p_prices: payload, p_notes: notes || null } as any
      );
      if (err) throw err;
      if ((res as any)?.error) throw new Error((res as any).error);
      toast.success("Recotação enviada!");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-3">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-foreground font-semibold">{error || "Não foi possível carregar"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.status === "approved") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="py-10 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <p className="text-emerald-800 dark:text-emerald-300 font-semibold text-lg">
              Recotação aprovada pela agência
            </p>
            <p className="text-sm text-muted-foreground">
              Os novos preços já constam como oficiais.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.status === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full border-destructive bg-destructive/5">
          <CardContent className="py-10 text-center space-y-3">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-destructive font-semibold text-lg">Recotação recusada</p>
            {data.rejection_notes && (
              <p className="text-sm text-muted-foreground border rounded p-3 bg-background text-left whitespace-pre-wrap">
                {data.rejection_notes}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.status === "submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full border-blue-300 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="py-10 text-center space-y-3">
            <Clock className="w-12 h-12 text-blue-600 mx-auto" />
            <p className="text-blue-800 dark:text-blue-300 font-semibold text-lg">
              Aguardando revisão da agência
            </p>
            {data.submitted_at && (
              <p className="text-sm text-muted-foreground">
                Preços enviados em {format(new Date(data.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // pending
  return (
    <div className="min-h-screen bg-background py-6 px-3 md:px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recotação por Quantidade</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Olá, <span className="font-medium">{data.supplier.contact_name || data.supplier.company_name}</span>!
            Revise os preços abaixo considerando as novas quantidades.
          </p>
          {data.expires_at && (
            <p className="text-xs text-muted-foreground mt-1">
              Prazo: {format(new Date(data.expires_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </p>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peça</TableHead>
                  <TableHead className="text-center w-24">Qtd. Anterior</TableHead>
                  <TableHead className="text-center w-24">Qtd. Nova</TableHead>
                  <TableHead className="text-right w-32">Preço unit. anterior</TableHead>
                  <TableHead className="text-right w-40">Novo preço unit.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pieces.map((p) => {
                  const baseline = data.baseline_prices[p.id];
                  const changed = p.old_qty !== p.new_qty;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {p.image_url && (
                            <img src={p.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                          )}
                          <div>
                            <div className="font-medium text-sm">
                              #{p.code} {p.name}
                              {changed && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-[#C2714F]/10 px-2 py-0.5 text-[10px] font-bold text-[#C2714F]">
                                  Alterado
                                </span>
                              )}
                            </div>
                            {p.specification && (
                              <div className="text-xs text-muted-foreground line-clamp-1">{p.specification}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={`text-center ${changed ? "text-muted-foreground line-through" : "text-muted-foreground"}`}>
                        {changed ? p.old_qty ?? 0 : p.new_qty ?? 0}
                      </TableCell>
                      <TableCell className={`text-center ${changed ? "font-bold text-[#C2714F]" : "font-semibold"}`}>
                        {p.new_qty ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {baseline != null ? fmtBRL(baseline) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="text-right h-9"
                          value={prices[p.id] ?? ""}
                          onChange={(e) => setPrices((s) => ({ ...s, [p.id]: e.target.value }))}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 space-y-2">
              <label className="text-xs text-muted-foreground">Instalação (R$)</label>
              <Input value={installation} onChange={(e) => setInstallation(e.target.value)} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-2">
              <label className="text-xs text-muted-foreground">Frete (R$)</label>
              <Input value={freight} onChange={(e) => setFreight(e.target.value)} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4 space-y-2">
            <label className="text-xs text-muted-foreground">Observações</label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Comentários para a agência (opcional)"
            />
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/30">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-sm font-semibold">Total estimado</span>
            <span className="text-2xl font-bold text-primary tabular-nums">{fmtBRL(total)}</span>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button size="lg" className="gap-2" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Confirmar Recotação
          </Button>
        </div>
      </div>
    </div>
  );
}
