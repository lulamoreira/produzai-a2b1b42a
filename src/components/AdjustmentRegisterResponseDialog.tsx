import { useEffect, useMemo, useState } from "react";
import { Loader2, CheckCircle2, FileInput } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrencyByCode } from "@/lib/countryConfig";
import { useAdjustmentPieces, useAdjustmentStorePieces } from "@/hooks/useAdjustments";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  adjustment: { id: string; name: string; campaign_id: string };
  campaignId: string;
  campaignName: string;
  currencyCode: string;
}

export default function AdjustmentRegisterResponseDialog({
  open, onOpenChange, adjustment, campaignId, currencyCode,
}: Props) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [winner, setWinner] = useState<any | null>(null);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
  const [newPrices, setNewPrices] = useState<Record<string, number>>({});
  const [currentExtras, setCurrentExtras] = useState({ installation_value: 0, freight_value: 0 });
  const [newInstallation, setNewInstallation] = useState<number>(0);
  const [newFreight, setNewFreight] = useState<number>(0);

  const { data: pieces = [] } = useAdjustmentPieces(adjustment.id);
  const { data: adjSp = [] } = useAdjustmentStorePieces(adjustment.id);

  const fmt = (v: number) => formatCurrencyByCode(v, currencyCode);

  const editablePieces = useMemo(
    () => (pieces as any[]).filter((p) => !p.is_deleted && !p.kit_only),
    [pieces]
  );

  // qty per adjustment piece across stores
  const qtyByPiece = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of adjSp as any[]) {
      m[r.piece_id] = (m[r.piece_id] || 0) + Number(r.quantity || 0);
    }
    return m;
  }, [adjSp]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const { data: w } = await supabase
          .from("budget_suppliers")
          .select("id, company_name")
          .eq("campaign_id", campaignId)
          .eq("is_winner", true)
          .maybeSingle();
        setWinner(w);
        if (!w) { setLoading(false); return; }

        const [pricesRes, extrasRes, reqRes] = await Promise.all([
          supabase.from("budget_prices" as any)
            .select("piece_id, unit_price").eq("supplier_id", (w as any).id),
          supabase.from("budget_extra_costs" as any)
            .select("installation_value, freight_value")
            .eq("supplier_id", (w as any).id).maybeSingle(),
          supabase.from("campaign_adjustment_budget_request" as any)
            .select("adjusted_prices_jsonb")
            .eq("adjustment_id", adjustment.id).maybeSingle(),
        ]);

        // Map current prices keyed by SOURCE piece_id (campaign piece). Adjustment pieces store source_piece_id.
        const priceMap: Record<string, number> = {};
        for (const row of (pricesRes.data as any[]) || []) {
          if (row.piece_id) priceMap[row.piece_id] = Number(row.unit_price || 0);
        }
        setCurrentPrices(priceMap);

        const inst = Number((extrasRes.data as any)?.installation_value || 0);
        const fr = Number((extrasRes.data as any)?.freight_value || 0);
        setCurrentExtras({ installation_value: inst, freight_value: fr });

        // Pre-fill newPrices: from saved jsonb if present, otherwise current price for source
        const saved = (reqRes.data as any)?.adjusted_prices_jsonb || null;
        const savedPriceMap: Record<string, number> = {};
        if (saved?.prices) {
          for (const row of saved.prices) savedPriceMap[row.piece_id] = Number(row.new_price || 0);
        }
        setNewInstallation(saved?.installation != null ? Number(saved.installation) : inst);
        setNewFreight(saved?.freight != null ? Number(saved.freight) : fr);

        // Note: pieces list will be available — we set initial later via effect on pieces
        setNewPrices((prev) => {
          const next: Record<string, number> = { ...prev };
          for (const p of editablePieces) {
            if (savedPriceMap[p.id] != null) next[p.id] = savedPriceMap[p.id];
            else if (p.source_piece_id && priceMap[p.source_piece_id] != null) {
              next[p.id] = priceMap[p.source_piece_id];
            } else if (next[p.id] == null) {
              next[p.id] = 0;
            }
          }
          return next;
        });
      } catch (e: any) {
        toast.error(e?.message || "Falha ao carregar dados.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaignId, adjustment.id]);

  // When pieces arrive after initial load, ensure each has an initial price
  useEffect(() => {
    if (!open || editablePieces.length === 0) return;
    setNewPrices((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const p of editablePieces) {
        if (next[p.id] == null) {
          next[p.id] = p.source_piece_id ? Number(currentPrices[p.source_piece_id] || 0) : 0;
        }
      }
      return next;
    });
  }, [editablePieces, currentPrices, open]);

  const currentTotal = useMemo(() => {
    let total = 0;
    for (const p of editablePieces) {
      const q = qtyByPiece[p.id] || 0;
      const cur = p.source_piece_id ? Number(currentPrices[p.source_piece_id] || 0) : 0;
      total += q * cur;
    }
    return total + currentExtras.installation_value + currentExtras.freight_value;
  }, [editablePieces, qtyByPiece, currentPrices, currentExtras]);

  const newTotal = useMemo(() => {
    let total = 0;
    for (const p of editablePieces) {
      const q = qtyByPiece[p.id] || 0;
      total += q * Number(newPrices[p.id] || 0);
    }
    return total + Number(newInstallation || 0) + Number(newFreight || 0);
  }, [editablePieces, qtyByPiece, newPrices, newInstallation, newFreight]);

  const handleApprove = async () => {
    if (!winner) { toast.error("Fornecedor vencedor não encontrado."); return; }
    setSaving(true);
    try {
      const payload = {
        prices: editablePieces.map((p) => ({
          piece_id: p.id,
          new_price: Number(newPrices[p.id] || 0),
        })),
        installation: Number(newInstallation || 0),
        freight: Number(newFreight || 0),
      };
      const { error } = await supabase
        .from("campaign_adjustment_budget_request" as any)
        .upsert({
          adjustment_id: adjustment.id,
          supplier_id: winner.id,
          status: "approved",
          response_received_at: new Date().toISOString(),
          adjusted_prices_jsonb: payload as any,
        } as any, { onConflict: "adjustment_id,supplier_id" } as any);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["adjustment_budget_requests", campaignId] });
      toast.success("Reorçamento aprovado e registrado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao registrar resposta");
    } finally {
      setSaving(false);
    }
  };

  const totalColor =
    newTotal < currentTotal ? "text-emerald-700" : newTotal > currentTotal ? "text-red-700" : "text-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileInput className="w-5 h-5" />
            Registrar Resposta — {adjustment.name}
          </DialogTitle>
          <DialogDescription>
            Informe os novos preços propostos pelo fornecedor para o reorçamento.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : !winner ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Nenhum fornecedor vencedor encontrado para esta campanha.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4">
            <div className="text-xs text-muted-foreground">
              Fornecedor: <strong>{winner.company_name}</strong>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Novos preços propostos pelo fornecedor</h3>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Código</TableHead>
                      <TableHead>Peça</TableHead>
                      <TableHead className="text-right w-28">Qtd ajuste</TableHead>
                      <TableHead className="text-right w-32">Preço atual</TableHead>
                      <TableHead className="text-right w-36">Novo preço</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editablePieces.map((p) => {
                      const q = qtyByPiece[p.id] || 0;
                      const cur = p.source_piece_id ? Number(currentPrices[p.source_piece_id] || 0) : 0;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs">{p.code}</TableCell>
                          <TableCell className="text-xs">
                            {p.name}
                            {p.is_new && <span className="ml-1 text-emerald-600">(nova)</span>}
                          </TableCell>
                          <TableCell className="text-xs text-right">{q}</TableCell>
                          <TableCell className="text-xs text-right">{fmt(cur)}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={newPrices[p.id] ?? 0}
                              onChange={(e) =>
                                setNewPrices((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))
                              }
                              className="h-8 text-right text-xs"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {editablePieces.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
                          Nenhuma peça editável neste ajuste.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Novos custos extras</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Instalação atual: {fmt(currentExtras.installation_value)}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newInstallation}
                    onChange={(e) => setNewInstallation(Number(e.target.value))}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Frete atual: {fmt(currentExtras.freight_value)}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newFreight}
                    onChange={(e) => setNewFreight(Number(e.target.value))}
                    className="h-8"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Total atual: <strong>{fmt(currentTotal)}</strong>
              </div>
              <div className={`text-base font-semibold ${totalColor}`}>
                Novo total: {fmt(newTotal)}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleApprove}
            disabled={saving || loading || !winner}
            className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Aprovar reorçamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
