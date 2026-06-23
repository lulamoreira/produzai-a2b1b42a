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

interface PieceItem {
  id: string; name: string; code: number;
  specification: string | null; image_url: string | null;
  old_qty: number; new_qty: number;
}

interface KitPieceRef { piece_id: string; quantity: number; }

interface KitItem {
  id: string; name: string; code: number;
  old_qty: number; new_qty: number;
  kit_pieces: KitPieceRef[];
}

interface PortalData {
  id: string; status: string;
  expires_at: string | null; submitted_at: string | null;
  submitted_prices: Record<string, number> | null;
  notes: string | null; rejection_notes: string | null;
  supplier: { id: string; company_name: string; contact_name: string };
  pieces: PieceItem[];
  kits: KitItem[];
  baseline_prices: Record<string, number>;
  baseline_extras: { installation: number; freight: number };
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(Number.isFinite(n) ? n : 0);

const parseNum = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  const s = String(v).trim().replace(/[^\d,.-]/g, "");
  if (!s) return 0;

  const n = parseFloat(
    s.includes(",")
      ? s.replace(/\./g, "").replace(",", ".")
      : s
  );
  return Number.isFinite(n) ? n : 0;
};

const fmtInput = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

const kitKey = (kitId: string) => `kit:${kitId}`;

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
        "get_budget_qty_requote" as any, { p_token: token } as any
      );
      if (err) throw err;
      const payload = rpc as any;
      if (!payload || payload.error) { setError(payload?.error || "Token inválido"); return; }
      const d = payload as PortalData;
      setData(d);
      const sub = (d.submitted_prices || {}) as Record<string, number>;
      const pre: Record<string, string> = {};
      for (const p of d.pieces) {
        if (sub[p.id] != null) pre[p.id] = String(sub[p.id]);
        else if (d.baseline_prices[p.id] != null) pre[p.id] = String(d.baseline_prices[p.id]);
        else pre[p.id] = "";
      }
      for (const k of d.kits ?? []) {
        const key = kitKey(k.id);
        if (sub[key] != null) pre[key] = String(sub[key]);
        else if (d.baseline_prices[key] != null) pre[key] = String(d.baseline_prices[key]);
        else pre[key] = "";
      }
      setPrices(pre);
      setInstallation(fmtInput((sub as any).installation ?? d.baseline_extras.installation ?? 0));
      setFreight(fmtInput((sub as any).freight ?? d.baseline_extras.freight ?? 0));
      setNotes(d.notes || "");
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  const kitComponentUnitValue = (kit: KitItem) =>
    (kit.kit_pieces ?? []).reduce((s, kp) => s + kp.quantity * parseNum(prices[kp.piece_id]), 0);

  // Kits usam preço unitário próprio quando existir; caso contrário, derivam do somatório dos componentes.
  const kitUnitValue = (kit: KitItem) => {
    const directUnit = parseNum(prices[kitKey(kit.id)]);
    return directUnit > 0 ? directUnit : kitComponentUnitValue(kit);
  };

  const kitBaselineUnit = (kit: KitItem) => {
    const directUnit = data?.baseline_prices[kitKey(kit.id)] ?? 0;
    if (directUnit > 0) return directUnit;
    return (kit.kit_pieces ?? []).reduce((s, kp) => s + kp.quantity * (data?.baseline_prices[kp.piece_id] ?? 0), 0);
  };

  // Lista ordenada por código: peças soltas e kits no mesmo nível; componentes ficam abaixo do kit.
  const orderedRows = useMemo(() => {
    type Row =
      | { kind: "kit"; item: KitItem }
      | { kind: "piece"; item: PieceItem; inKit: boolean };
    if (!data) return [] as Row[];

    const rows: Row[] = [];
    const pieceMap = new Map(data.pieces.map((p) => [p.id, p]));
    const componentIds = new Set<string>();

    for (const kit of data.kits ?? []) {
      for (const kp of kit.kit_pieces ?? []) componentIds.add(kp.piece_id);
    }

    const topLevelRows: Row[] = [
      ...(data.kits ?? []).map((kit) => ({ kind: "kit" as const, item: kit })),
      ...data.pieces
        .filter((piece) => !componentIds.has(piece.id))
        .map((piece) => ({ kind: "piece" as const, item: piece, inKit: false })),
    ].sort((a, b) => a.item.code - b.item.code);

    for (const topLevelRow of topLevelRows) {
      rows.push(topLevelRow);

      if (topLevelRow.kind !== "kit") continue;

      const components = [...(topLevelRow.item.kit_pieces ?? [])].sort((a, b) => {
        const pieceA = pieceMap.get(a.piece_id);
        const pieceB = pieceMap.get(b.piece_id);
        return (pieceA?.code ?? 0) - (pieceB?.code ?? 0);
      });

      for (const kp of components) {
        const piece = pieceMap.get(kp.piece_id);
        if (piece) rows.push({ kind: "piece", item: piece, inKit: true });
      }
    }

    return rows;
  }, [data]);

  const oldTotal = useMemo(() => {
    if (!data) return 0;
    const kitComponentIds = new Set(
      (data.kits ?? []).flatMap((kit) => (kit.kit_pieces ?? []).map((kp) => kp.piece_id))
    );
    return data.pieces
      .filter((p) => !kitComponentIds.has(p.id))
      .reduce((s, p) => s + (p.old_qty ?? 0) * (data.baseline_prices[p.id] ?? 0), 0)
      + (data.kits ?? []).reduce((s, k) => s + (k.old_qty ?? 0) * kitBaselineUnit(k), 0)
      + (data.baseline_extras.installation ?? 0)
      + (data.baseline_extras.freight ?? 0);
  }, [data]);

  const newTotal = useMemo(() => {
    if (!data) return 0;
    const kitComponentIds = new Set(
      (data.kits ?? []).flatMap((kit) => (kit.kit_pieces ?? []).map((kp) => kp.piece_id))
    );
    return data.pieces
      .filter((p) => !kitComponentIds.has(p.id))
      .reduce((s, p) => s + (p.new_qty ?? 0) * parseNum(prices[p.id]), 0)
      + (data.kits ?? []).reduce((s, k) => s + (k.new_qty ?? 0) * kitUnitValue(k), 0)
      + parseNum(installation)
      + parseNum(freight);
  }, [data, prices, installation, freight]);

  const handleSubmit = async () => {
    if (!data || !token) return;
    const missingPieces = data.pieces.filter((p) => !prices[p.id] || parseNum(prices[p.id]) <= 0);
    const missingKits = (data.kits ?? []).filter(
      (k) => data.baseline_prices[kitKey(k.id)] != null && (!prices[kitKey(k.id)] || parseNum(prices[kitKey(k.id)]) <= 0)
    );
    const missing = [...missingPieces, ...missingKits];
    if (missing.length > 0) { toast.error(`Informe o preço de ${missing.length} peça(s)`); return; }
    setSubmitting(true);
    try {
      const payload: Record<string, number> = {
        installation: parseNum(installation),
        freight: parseNum(freight),
      };
      for (const p of data.pieces) payload[p.id] = parseNum(prices[p.id]);
      for (const k of data.kits ?? []) payload[kitKey(k.id)] = kitUnitValue(k);
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
            <p className="text-emerald-800 dark:text-emerald-300 font-semibold text-lg">Recotação aprovada pela agência</p>
            <p className="text-sm text-muted-foreground">Os novos preços já constam como oficiais.</p>
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
            <p className="text-blue-800 dark:text-blue-300 font-semibold text-lg">Aguardando revisão da agência</p>
            {data.submitted_at && (
              <p className="text-sm text-muted-foreground">
                Enviado em {format(new Date(data.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-6 px-3 md:px-6">
      <div className="max-w-6xl mx-auto space-y-6">
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
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peça / Kit</TableHead>
                  <TableHead className="text-center w-20">Qtd. ant.</TableHead>
                  <TableHead className="text-center w-20">Qtd. nova</TableHead>
                  <TableHead className="text-right w-32">Preço unit. ant.</TableHead>
                  <TableHead className="text-right w-40">Novo preço unit.</TableHead>
                  <TableHead className="text-right w-32">Total anterior</TableHead>
                  <TableHead className="text-right w-32">Total novo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderedRows.map((row) => {
                  if (row.kind === "kit") {
                    const k = row.item;
                    const changed = k.old_qty !== k.new_qty;
                    const baseUnit = kitBaselineUnit(k);
                    const newUnit = kitUnitValue(k);
                    const totalAnt = (k.old_qty ?? 0) * baseUnit;
                    const totalNov = (k.new_qty ?? 0) * newUnit;
                    return (
                      <TableRow key={`kit-${k.id}`} className="bg-blue-50/40 dark:bg-blue-950/10">
                        <TableCell>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">KIT</span>
                            <span className="font-medium text-sm">#{k.code} {k.name}</span>
                            {changed && (
                              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Alterado</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={`text-center ${changed ? "text-muted-foreground line-through" : "text-muted-foreground"}`}>
                          {k.old_qty ?? 0}
                        </TableCell>
                        <TableCell className={`text-center ${changed ? "font-bold text-[#C2714F]" : "font-semibold"}`}>
                          {k.new_qty ?? 0}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {baseUnit > 0 ? fmtBRL(baseUnit) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {newUnit > 0 ? fmtBRL(newUnit) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {totalAnt > 0 ? fmtBRL(totalAnt) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {totalNov > 0 ? fmtBRL(totalNov) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const p = row.item;
                  const baseline = data.baseline_prices[p.id] ?? 0;
                  const newPrice = parseNum(prices[p.id]);
                  const changed = p.old_qty !== p.new_qty;
                  const totalAnt = (p.old_qty ?? 0) * baseline;
                  const totalNov = (p.new_qty ?? 0) * newPrice;
                  return (
                    <TableRow key={`piece-${p.id}${row.inKit ? "-inkit" : ""}`}>
                      <TableCell>
                        <div className={`flex items-center gap-2 ${row.inKit ? "pl-6" : ""}`}>
                          {row.inKit && <span className="text-xs text-muted-foreground">↳</span>}
                          {p.image_url && (
                            <img src={p.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                          )}
                          <div>
                            <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                              <span>#{p.code} {p.name}</span>
                              {changed && (
                                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Alterado</span>
                              )}
                            </div>
                            {p.specification && (
                              <div className="text-xs text-muted-foreground line-clamp-1">{p.specification}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={`text-center ${changed ? "text-muted-foreground line-through" : "text-muted-foreground"}`}>
                        {p.old_qty ?? 0}
                      </TableCell>
                      <TableCell className={`text-center ${changed ? "font-bold text-[#C2714F]" : "font-semibold"}`}>
                        {p.new_qty ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {baseline > 0 ? fmtBRL(baseline) : "—"}
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
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {totalAnt > 0 ? fmtBRL(totalAnt) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {newPrice > 0 ? fmtBRL(totalNov) : "—"}
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
              <Input
                value={installation}
                onChange={(e) => setInstallation(e.target.value)}
                onBlur={() => setInstallation(fmtInput(parseNum(installation)))}
                className="text-right"
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-2">
              <label className="text-xs text-muted-foreground">Frete (R$)</label>
              <Input
                value={freight}
                onChange={(e) => setFreight(e.target.value)}
                onBlur={() => setFreight(fmtInput(parseNum(freight)))}
                className="text-right"
              />
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-muted">
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Total anterior</p>
                <p className="text-xs text-muted-foreground mt-0.5">Qtd. antiga × preços anteriores + extras</p>
              </div>
              <span className="text-2xl font-bold text-muted-foreground tabular-nums whitespace-nowrap">
                {fmtBRL(oldTotal)}
              </span>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/30">
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Total proposto</p>
                <p className="text-xs text-muted-foreground mt-0.5">Qtd. nova × novos preços + extras</p>
              </div>
              <span className="text-2xl font-bold text-primary tabular-nums whitespace-nowrap">
                {fmtBRL(newTotal)}
              </span>
            </CardContent>
          </Card>
        </div>

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
