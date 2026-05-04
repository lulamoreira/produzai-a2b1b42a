import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TrendingDown, Send, Check, RotateCcw, Loader2, History, LayoutGrid } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { snapshotSupplierBudget } from "@/lib/budgetPriceSnapshot";
import {
  useNegotiationStorePieces,
  snapshotNegotiationRateio,
} from "@/hooks/useNegotiationStorePieces";

type Supplier = {
  id: string;
  campaign_id: string;
  company_name: string;
  email?: string | null;
  negotiation_status?: string | null;
};

type Piece = { id: string; name: string; code: number; kit_only?: boolean };
type Price = {
  supplier_id: string;
  piece_id: string | null;
  unit_price: number | string | null;
  adjusted_unit_price?: number | string | null;
};
type ExtraCost = {
  supplier_id: string;
  installation_value: number | string | null;
  freight_value: number | string | null;
  adjusted_installation_value?: number | string | null;
  adjusted_freight_value?: number | string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier;
  campaignId: string;
  campaignName: string;
  pieces: Piece[];
  prices: Price[];
  extraCosts: ExtraCost[];
  pieceTotals: Record<string, number>;
  settings: any;
  currencyCode: string;
  fmtCurrency: (v: number | null | undefined) => string;
  publicPortalUrl?: string;
  frozenTotal?: number | null;
  onNavigateToRateio?: () => void;
}

function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function BudgetNegotiationDialog({
  open, onOpenChange, supplier, campaignId, campaignName,
  pieces, prices, extraCosts, pieceTotals, settings, currencyCode, fmtCurrency, publicPortalUrl, frozenTotal, onNavigateToRateio,
}: Props) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<string>("");
  const [mode, setMode] = useState<"auto" | "manual">("manual");
  const [adjustScope, setAdjustScope] = useState<"all" | "pieces_only">("pieces_only");
  const [busy, setBusy] = useState(false);

  const supplierPrices = useMemo(
    () => prices.filter((p) => p.supplier_id === supplier.id && p.piece_id),
    [prices, supplier.id]
  );
  const supplierEC = useMemo(
    () => extraCosts.find((e) => e.supplier_id === supplier.id) || null,
    [extraCosts, supplier.id]
  );

  // Negotiation rateio (isolated quantities for this supplier)
  const { data: negotiationPieces = [] } = useNegotiationStorePieces(
    supplier.id,
    campaignId,
    open
  );
  const negPieceTotals = useMemo<Record<string, number>>(() => {
    if (!negotiationPieces.length) return {};
    const map: Record<string, number> = {};
    for (const row of negotiationPieces) {
      map[row.piece_id] = (map[row.piece_id] || 0) + Number(row.quantity || 0);
    }
    return map;
  }, [negotiationPieces]);
  const effectivePieceTotals = negotiationPieces.length > 0 ? negPieceTotals : pieceTotals;

  const currentTotal = useMemo(() => {
    // If a frozen winner total exists and there's no isolated negotiation rateio,
    // honor the frozen value (matches what's displayed everywhere else in BudgetTab).
    if (frozenTotal != null && frozenTotal > 0 && negotiationPieces.length === 0) {
      return frozenTotal;
    }
    let total = toNum(supplierEC?.installation_value) + toNum(supplierEC?.freight_value);
    for (const piece of pieces) {
      const qty = effectivePieceTotals[piece.id] || 0;
      if (qty <= 0) continue;
      const pr = supplierPrices.find((p) => p.piece_id === piece.id);
      total += toNum(pr?.unit_price) * qty;
    }
    return total;
  }, [pieces, effectivePieceTotals, supplierPrices, supplierEC, frozenTotal, negotiationPieces.length]);

  useEffect(() => {
    if (open) {
      setTarget(settings?.negotiation_target ? String(settings.negotiation_target) : "");
      setMode((settings?.negotiation_mode as "auto" | "manual") || "manual");
      setAdjustScope("pieces_only");
    }
  }, [open, settings?.negotiation_target, settings?.negotiation_mode]);

  const targetNum = useMemo(() => {
    const n = Number(target.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [target]);

  const fixedCosts = toNum(supplierEC?.installation_value) + toNum(supplierEC?.freight_value);
  const currentPiecesTotal = currentTotal - fixedCosts;
  const piecesOnlyTarget = targetNum - fixedCosts;
  const piecesOnlyInvalid = mode === "auto" && adjustScope === "pieces_only" && targetNum > 0 && piecesOnlyTarget <= 0;

  const ratio = useMemo(() => {
    if (targetNum <= 0) return 1;
    if (adjustScope === "pieces_only") {
      if (currentPiecesTotal <= 0 || piecesOnlyTarget <= 0) return 1;
      return piecesOnlyTarget / currentPiecesTotal;
    }
    return currentTotal > 0 ? targetNum / currentTotal : 1;
  }, [targetNum, adjustScope, currentPiecesTotal, piecesOnlyTarget, currentTotal]);

  const reductionPct = targetNum > 0 && currentTotal > 0
    ? Math.round((1 - targetNum / currentTotal) * 1000) / 10
    : 0;

  const autoPreview = useMemo(() => {
    if (mode !== "auto" || targetNum <= 0 || currentTotal <= 0) return [];
    return pieces
      .filter((p) => (effectivePieceTotals[p.id] || 0) > 0)
      .map((piece) => {
        const pr = supplierPrices.find((p) => p.piece_id === piece.id);
        const original = toNum(pr?.unit_price);
        const adjusted = Math.round(original * ratio * 100) / 100;
        return {
          pieceId: piece.id,
          name: piece.name,
          code: piece.code,
          original,
          adjusted,
          diff: adjusted - original,
        };
      });
  }, [mode, targetNum, currentTotal, pieces, effectivePieceTotals, supplierPrices, ratio]);

  const adjustedInstallation = supplierEC?.installation_value != null
    ? (adjustScope === "pieces_only"
        ? toNum(supplierEC.installation_value)
        : Math.round(toNum(supplierEC.installation_value) * ratio * 100) / 100)
    : null;
  const adjustedFreight = supplierEC?.freight_value != null
    ? (adjustScope === "pieces_only"
        ? toNum(supplierEC.freight_value)
        : Math.round(toNum(supplierEC.freight_value) * ratio * 100) / 100)
    : null;

  const newTotal = useMemo(() => {
    if (mode !== "auto") return targetNum;
    let t = (adjustedInstallation || 0) + (adjustedFreight || 0);
    for (const row of autoPreview) {
      t += row.adjusted * (effectivePieceTotals[row.pieceId] || 0);
    }
    return t;
  }, [mode, targetNum, autoPreview, adjustedInstallation, adjustedFreight, effectivePieceTotals]);

  // History
  const { data: history = [] } = useQuery({
    queryKey: ["budget_price_history", supplier.id, "negotiation"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_price_history" as never)
        .select("id, version, reason, created_at, snapshot")
        .eq("supplier_id", supplier.id)
        .order("version", { ascending: false });
      if (error) throw error;
      return ((data as any[]) || []).filter(
        (h) => (h.reason || "").startsWith("negotiation") || h.reason === "winner_declared"
      );
    },
  });

  const reasonLabel = (reason: string | null | undefined) => {
    switch (reason) {
      case "winner_declared": return "🏆 Preços congelados (vencedor declarado)";
      case "negotiation_opened": return "🤝 Negociação aberta";
      case "negotiation_auto_applied": return "⚙️ Ajuste automático aplicado";
      case "negotiation_submitted": return "📩 Proposta ajustada enviada";
      case "negotiation_approved": return "✅ Negociação aprovada";
      default: return reason || "—";
    }
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["budget_suppliers", campaignId] });
    qc.invalidateQueries({ queryKey: ["budget_prices", campaignId] });
    qc.invalidateQueries({ queryKey: ["budget_extra_costs", campaignId] });
    qc.invalidateQueries({ queryKey: ["budget_settings", campaignId] });
    qc.invalidateQueries({ queryKey: ["budget_price_history", supplier.id, "negotiation"] });
  };

  const saveTarget = async () => {
    await supabase.from("budget_settings").upsert(
      {
        campaign_id: campaignId,
        negotiation_target: targetNum,
        negotiation_mode: mode,
      } as never,
      { onConflict: "campaign_id" }
    );
  };

  // ─── Action: open negotiation (manual mode) ───
  const handleOpenManual = async () => {
    if (targetNum <= 0) { toast.error("Defina um teto máximo válido."); return; }
    setBusy(true);
    try {
      await snapshotSupplierBudget({
        supplierId: supplier.id, campaignId, reason: "negotiation_opened" as any,
      });
      await saveTarget();
      await snapshotNegotiationRateio(supplier.id, campaignId);
      await supabase.from("budget_suppliers")
        .update({ negotiation_status: "pending" } as never)
        .eq("id", supplier.id);

      // Open mailto
      if (supplier.email) {
        const subject = encodeURIComponent(`${campaignName} — Solicitação de Ajuste de Proposta`);
        const portal = publicPortalUrl || "";
        const body = encodeURIComponent(
          `Olá,\n\nGostaríamos de solicitar um ajuste na sua proposta para a campanha ${campaignName}.\n\n` +
          `Total atual: ${fmtCurrency(currentTotal)}\n` +
          `Teto máximo desejado: ${fmtCurrency(targetNum)}\n\n` +
          `Por favor, acesse o portal para revisar os preços:\n${portal}\n\n` +
          `Você só conseguirá enviar a proposta ajustada se o total estiver dentro do teto definido.\n\nObrigado!`
        );
        window.open(`mailto:${supplier.email}?subject=${subject}&body=${body}`, "_blank");
      }
      refresh();
      toast.success("Negociação aberta. Fornecedor notificado.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao abrir negociação.");
    } finally { setBusy(false); }
  };

  // ─── Action: auto apply ───
  const handleAutoApply = async () => {
    if (targetNum <= 0) { toast.error("Defina um teto máximo válido."); return; }
    if (piecesOnlyInvalid) {
      toast.error("O teto é menor que frete + instalação somados.");
      return;
    }
    setBusy(true);
    try {
      await saveTarget();
      await snapshotNegotiationRateio(supplier.id, campaignId);
      // Update each price
      for (const row of autoPreview) {
        await supabase.from("budget_prices").upsert(
          {
            supplier_id: supplier.id,
            campaign_id: campaignId,
            piece_id: row.pieceId,
            unit_price: supplierPrices.find((p) => p.piece_id === row.pieceId)?.unit_price ?? row.original,
            adjusted_unit_price: row.adjusted,
          } as never,
          { onConflict: "supplier_id,piece_id" }
        );
      }
      // Update extras (only when adjusting all)
      if (supplierEC && adjustScope === "all") {
        await supabase.from("budget_extra_costs")
          .update({
            adjusted_installation_value: adjustedInstallation,
            adjusted_freight_value: adjustedFreight,
          } as never)
          .eq("supplier_id", supplier.id);
      }
      await supabase.from("budget_suppliers")
        .update({
          negotiation_status: "submitted",
          negotiation_submitted_at: new Date().toISOString(),
        } as never)
        .eq("id", supplier.id);
      await snapshotSupplierBudget({
        supplierId: supplier.id, campaignId, reason: "negotiation_auto_applied" as any,
      });
      refresh();
      toast.success("Ajuste automático aplicado.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao aplicar ajuste.");
    } finally { setBusy(false); }
  };

  // ─── Action: approve (after supplier submitted) ───
  const handleApprove = async () => {
    setBusy(true);
    try {
      await snapshotSupplierBudget({
        supplierId: supplier.id, campaignId, reason: "negotiation_approved" as any,
      });
      await supabase.from("budget_suppliers")
        .update({ negotiation_status: "approved" } as never)
        .eq("id", supplier.id);
      refresh();
      toast.success("Proposta ajustada aprovada.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao aprovar.");
    } finally { setBusy(false); }
  };

  // ─── Action: revert ───
  const handleRevert = async () => {
    setBusy(true);
    try {
      await supabase.from("budget_prices")
        .update({ adjusted_unit_price: null } as never)
        .eq("supplier_id", supplier.id);
      await supabase.from("budget_extra_costs")
        .update({
          adjusted_installation_value: null,
          adjusted_freight_value: null,
        } as never)
        .eq("supplier_id", supplier.id);
      await supabase.from("budget_suppliers")
        .update({ negotiation_status: null, negotiation_submitted_at: null } as never)
        .eq("id", supplier.id);
      refresh();
      toast.success("Ajuste revertido — preços originais restaurados.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao reverter.");
    } finally { setBusy(false); }
  };

  const hasAdjusted = supplierPrices.some((p) => p.adjusted_unit_price != null) ||
    supplierEC?.adjusted_installation_value != null ||
    supplierEC?.adjusted_freight_value != null;
  const status = supplier.negotiation_status;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-primary" />
            Negociação — {supplier.company_name}
          </DialogTitle>
          <DialogDescription>
            Defina um teto máximo e envie ao fornecedor para ajuste, ou aplique uma redução proporcional automaticamente.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="define">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="define">Definir teto</TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-3.5 h-3.5 mr-1.5" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="define" className="space-y-4 mt-4">
            <div className="rounded-lg border bg-muted/40 p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total atual da proposta:</span>
              <span className="text-lg font-bold text-foreground">{fmtCurrency(currentTotal)}</span>
            </div>

            <div className="space-y-2">
              <Label>Teto máximo (total geral)</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">{currencyCode}</span>
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={target}
                  onChange={(e) => setTarget(e.target.value.replace(/[^0-9.,]/g, ""))}
                />
              </div>
              <div className="rounded-md border bg-muted/30 p-2 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Frete + Instalação:</span><span className="font-mono">{fmtCurrency(fixedCosts)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total das peças:</span><span className="font-mono">{fmtCurrency(currentPiecesTotal)}</span></div>
                <div className="flex justify-between font-semibold"><span>Total geral atual:</span><span className="font-mono">{fmtCurrency(currentTotal)}</span></div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Modo de ajuste</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("auto")}
                  className={`rounded-md border p-3 text-left text-sm transition-colors ${mode === "auto" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                >
                  <div className="font-semibold">Automático</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Sistema redistribui proporcionalmente</div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("manual")}
                  className={`rounded-md border p-3 text-left text-sm transition-colors ${mode === "manual" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                >
                  <div className="font-semibold">Manual</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Fornecedor ajusta no portal</div>
                </button>
              </div>
            </div>

            {mode === "auto" && (
              <div className="space-y-2">
                <Label>O que ajustar proporcionalmente?</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustScope("pieces_only")}
                    className={`rounded-md border p-3 text-left text-sm transition-colors ${adjustScope === "pieces_only" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                  >
                    <div className="font-semibold">Somente peças</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Frete e instalação ficam fixos</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustScope("all")}
                    className={`rounded-md border p-3 text-left text-sm transition-colors ${adjustScope === "all" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                  >
                    <div className="font-semibold">Tudo</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Peças + frete + instalação</div>
                  </button>
                </div>
                {piecesOnlyInvalid && (
                  <div className="text-xs text-red-700 dark:text-red-400 font-medium">
                    O teto é menor que frete + instalação somados ({fmtCurrency(fixedCosts)}).
                  </div>
                )}
              </div>
            )}

            {mode === "auto" && targetNum > 0 && currentTotal > 0 && (
              <div className="space-y-3">
                <div className="rounded-lg border bg-amber-50 dark:bg-amber-900/10 p-3 space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Variação:</span>
                    <span className={`font-semibold ${reductionPct >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                      {reductionPct >= 0 ? `-${reductionPct}%` : `+${Math.abs(reductionPct)}%`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Novo total estimado:</span>
                    <span className="font-bold text-foreground">{fmtCurrency(newTotal)}</span>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Peça</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Original</TableHead>
                        <TableHead className="text-right">Ajustado</TableHead>
                        <TableHead className="text-right">Δ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {autoPreview.map((row) => {
                        const qty = effectivePieceTotals[row.pieceId] || 0;
                        return (
                        <TableRow key={row.pieceId}>
                          <TableCell className="truncate max-w-[200px]" title={row.name}>{row.code} — {row.name}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{qty}</TableCell>
                          <TableCell className="text-right font-mono">{fmtCurrency(row.original)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold text-primary">{fmtCurrency(row.adjusted)}</TableCell>
                          <TableCell className={`text-right font-mono ${row.diff < 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                            {fmtCurrency(row.diff)}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                      {supplierEC && (
                        <>
                          <TableRow>
                            <TableCell>Instalação</TableCell>
                            <TableCell className="text-right text-muted-foreground">—</TableCell>
                            <TableCell className="text-right font-mono">{fmtCurrency(toNum(supplierEC.installation_value))}</TableCell>
                            <TableCell className="text-right font-mono font-semibold text-primary">{fmtCurrency(adjustedInstallation || 0)}</TableCell>
                            <TableCell className="text-right font-mono">
                              {adjustScope === "pieces_only" ? <Badge variant="outline" className="text-[10px]">🔒 Fixo</Badge> : "—"}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Frete</TableCell>
                            <TableCell className="text-right text-muted-foreground">—</TableCell>
                            <TableCell className="text-right font-mono">{fmtCurrency(toNum(supplierEC.freight_value))}</TableCell>
                            <TableCell className="text-right font-mono font-semibold text-primary">{fmtCurrency(adjustedFreight || 0)}</TableCell>
                            <TableCell className="text-right font-mono">
                              {adjustScope === "pieces_only" ? <Badge variant="outline" className="text-[10px]">🔒 Fixo</Badge> : "—"}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {adjustScope === "pieces_only" && (
                  <div className="text-xs text-muted-foreground italic">
                    Frete + Instalação: {fmtCurrency(fixedCosts)} (fixo) — Ajuste aplicado apenas nas peças.
                  </div>
                )}
              </div>
            )}

            {mode === "manual" && (
              <div className="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/10 p-3 text-xs text-blue-900 dark:text-blue-200">
                O fornecedor receberá o teto e deverá ajustar os preços no portal. Ele só conseguirá enviar se o total estiver dentro do teto.
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-2 mt-4">
            {history.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                Nenhum evento de negociação registrado.
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((h: any) => (
                  <div key={h.id} className="border rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">v{h.version}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(h.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{reasonLabel(h.reason)}</div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {onNavigateToRateio && (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onNavigateToRateio();
              }}
              className="gap-1.5"
            >
              <LayoutGrid className="w-4 h-4" />
              Editar Rateio da Negociação
            </Button>
          )}
          {hasAdjusted && (
            <Button variant="outline" onClick={handleRevert} disabled={busy} className="gap-1">
              <RotateCcw className="w-4 h-4" />
              Reverter ajuste
            </Button>
          )}
          {status === "submitted" && (
            <Button onClick={handleApprove} disabled={busy} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
              <Check className="w-4 h-4" />
              Aprovar proposta ajustada
            </Button>
          )}
          {mode === "manual" && status !== "submitted" && (
            <Button onClick={handleOpenManual} disabled={busy || targetNum <= 0} className="gap-1">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Salvar teto e notificar fornecedor
            </Button>
          )}
          {mode === "auto" && status !== "submitted" && (
            <Button onClick={handleAutoApply} disabled={busy || targetNum <= 0 || piecesOnlyInvalid} className="gap-1">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Aplicar e fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
