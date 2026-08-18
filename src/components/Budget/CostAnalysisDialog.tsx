import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingDown, PieChart, AlertTriangle, Lightbulb, Info } from "lucide-react";
import { formatCurrencyByCode } from "@/lib/countryConfig";
import type { CampaignPiece, CampaignKit } from "@/hooks/useMultiClientData";
import { cn } from "@/lib/utils";

interface CostAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieceTotals: Record<string, { kitId: string; pieceId: string; qty: number }[]>;
  qtyMap: Record<string, number>;
  currencyCode: string;
}

export default function CostAnalysisDialog({
  open, onOpenChange, campaignId, pieces, kits, kitPieceTotals, qtyMap, currencyCode
}: CostAnalysisDialogProps) {
  const { data: budgetData } = useQuery({
    queryKey: ["cost_analysis_data", campaignId],
    queryFn: async () => {
      const [suppliers, prices] = await Promise.all([
        supabase.from("budget_suppliers").select("*").eq("campaign_id", campaignId),
        supabase.from("budget_prices").select("*").eq("campaign_id", campaignId),
      ]);
      return {
        suppliers: (suppliers.data as any[]) ?? [],
        prices: (prices.data as any[]) ?? [],
      };
    },
    enabled: open,
  });

  const { data: storePieces = [] } = useQuery({
    queryKey: ["store_pieces_analysis", campaignId],
    queryFn: async () => {
      return supabasePaginate((from, to) => 
        supabase.from("campaign_store_pieces").select("*", { count: "exact" }).eq("campaign_id", campaignId).order("id").range(from, to)
      );
    },
    enabled: open,
  });

  const analysis = useMemo(() => {
    if (!budgetData) return null;
    const { suppliers, prices } = budgetData;

    const winner = suppliers.find(s => s.is_winner);
    const basePrices = new Map<string, number>();
    const submitted = suppliers.filter(s => s.status === 'enviado');
    
    pieces.forEach(p => {
      let price: number | null = null;
      if (winner) {
        price = Number(prices.find(pr => pr.supplier_id === winner.id && pr.piece_id === p.id)?.unit_price ?? 0);
      } else if (submitted.length > 0) {
        const pPrices = prices.filter(pr => pr.piece_id === p.id && submitted.some(s => s.id === pr.supplier_id)).map(pr => Number(pr.unit_price));
        price = pPrices.length > 0 ? Math.min(...pPrices) : 0;
      }
      basePrices.set(p.id, price ?? 0);
    });

    const itemCosts = [...pieces.map(p => ({
      name: p.name,
      id: p.id,
      qty: qtyMap[p.id] || 0,
      price: basePrices.get(p.id) || 0,
      total: (qtyMap[p.id] || 0) * (basePrices.get(p.id) || 0),
      isKit: false
    })), ...kits.map(k => {
      const components = kitPieceTotals[k.id] || [];
      const totalPrice = components.reduce((acc, c) => acc + (c.qty * (basePrices.get(c.pieceId) || 0)), 0);
      const totalQty = qtyMap[k.id] || 0; 
      return { name: k.name, id: k.id, qty: totalQty, price: 0, total: totalPrice, isKit: true };
    })].sort((a, b) => b.total - a.total);

    const totalCampaign = itemCosts.reduce((acc, curr) => acc + curr.total, 0);

    // Section 2: Gap analysis
    const gaps = pieces.map(p => {
      const relevantPrices = prices.filter(pr => pr.piece_id === p.id && submitted.some(s => s.id === pr.supplier_id)).map(pr => Number(pr.unit_price));
      if (relevantPrices.length < 2) return null;
      const min = Math.min(...relevantPrices);
      const max = Math.max(...relevantPrices);
      const gapPct = min === 0 ? 0 : ((max - min) / min) * 100;
      return { id: p.id, name: p.name, min, max, gapPct };
    }).filter(Boolean).sort((a, b) => (b?.gapPct || 0) - (a?.gapPct || 0));

    // Section 3: Distribution
    const storeStats = pieces.map(p => {
      const pStores = storePieces.filter(sp => sp.piece_id === p.id);
      if (pStores.length === 0) return null;
      const qtys = pStores.map(s => Number(s.quantity));
      const n = qtys.length;
      const mean = qtys.reduce((a, b) => a + b, 0) / n;
      const max = Math.max(...qtys);
      const variance = qtys.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);
      const outliers = pStores.filter(s => Number(s.quantity) > (mean + stdDev));

      return { id: p.id, name: p.name, count: n, mean, max, stdDev, outliers, total: qtys.reduce((a,b)=>a+b,0) };
    }).filter(Boolean);

    // Suggestions
    const suggestions: string[] = [];
    const top3Heavy = itemCosts.slice(0, 3).filter(i => i.total > 0);
    if (top3Heavy.length > 0) {
      suggestions.push(`Foco de negociação: as peças "${top3Heavy.map(i => i.name).join(", ")}" representam ${((top3Heavy.reduce((a,b)=>a+b.total,0)/totalCampaign)*100).toFixed(1)}% do custo total.`);
    }

    const expensiveFew = storeStats.filter(s => s.count < 10 && (basePrices.get(s.id) || 0) > 100).sort((a,b) => (basePrices.get(b.id)||0) - (basePrices.get(a.id)||0)).slice(0, 2);
    if (expensiveFew.length > 0) {
      suggestions.push(`Revisão sugerida: "${expensiveFew.map(s => s.name).join(", ")}" possuem preço unitário alto (${expensiveFew.map(s => formatCurrencyByCode(basePrices.get(s.id)||0, currencyCode)).join(", ")}) e estão em poucas lojas.`);
    }

    const simOutlier = storeStats.find(s => s.outliers.length > 0 && s.total > 0);
    if (simOutlier) {
      const currentTotal = simOutlier.total;
      const simulatedTotal = simOutlier.count * simOutlier.mean; // This is actually the same, bad logic. 
      // Better: if we capped outliers to mean
      const cappedTotal = storePieces.filter(sp => sp.piece_id === simOutlier.id).reduce((acc, sp) => {
          const q = Number(sp.quantity);
          return acc + (q > simOutlier.mean ? simOutlier.mean : q);
      }, 0);
      const diff = currentTotal - cappedTotal;
      const savings = diff * (basePrices.get(simOutlier.id) || 0);
      if (savings > 10) {
        suggestions.push(`Simulação: reduzir "${simOutlier.name}" para a média nas lojas com excesso pouparia aproximadamente ${formatCurrencyByCode(savings, currencyCode)}.`);
      }
    }

    return { 
      itemCosts, 
      totalCampaign, 
      gaps, 
      storeStats, 
      suggestions,
      baseLabel: winner ? `Fornecedor vencedor: ${winner.company_name}` : "Menor preço por peça (entre enviados)"
    };
  }, [budgetData, pieces, kits, kitPieceTotals, qtyMap, storePieces, currencyCode]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col bg-background">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between pr-8">
            <div>
              <DialogTitle className="text-xl font-serif text-brand-900">Análise de Custos</DialogTitle>
              <DialogDescription className="text-brand-600">Visão analítica de cotações e distribuição física.</DialogDescription>
            </div>
            {analysis && (
              <Badge variant="secondary" className="bg-brand-100 text-brand-700 border-brand-200">
                <Info className="w-3 h-3 mr-1" />
                Base: {analysis.baseLabel}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mr-4 pr-4">
          <div className="space-y-10 py-6">
            {!analysis ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                Carregando dados de análise...
              </div>
            ) : (
              <>
                {/* Section 1: Ranking */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <PieChart className="w-5 h-5 text-brand-500" />
                    <h3 className="text-lg font-medium text-brand-900">Ranking de Custos</h3>
                  </div>
                  <div className="rounded-lg border border-brand-100 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-brand-50">
                        <TableRow>
                          <TableHead className="text-brand-700">Item</TableHead>
                          <TableHead className="text-right text-brand-700">Qtd Total</TableHead>
                          <TableHead className="text-right text-brand-700">Preço Unit.</TableHead>
                          <TableHead className="text-right text-brand-700">Custo Total</TableHead>
                          <TableHead className="text-right text-brand-700">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysis.itemCosts.map((item: any, i) => (
                          <TableRow key={item.id} className={cn(i < 5 ? "bg-amber-50/30" : "", "hover:bg-brand-50/50 transition-colors")}>
                            <TableCell className="font-medium">
                              {item.name}
                              {i < 5 && <Badge variant="outline" className="ml-2 py-0 h-4 text-[10px] bg-amber-100 text-amber-700 border-amber-200 uppercase tracking-tighter">Top 5</Badge>}
                              {item.isKit && <Badge variant="outline" className="ml-2 py-0 h-4 text-[10px] bg-blue-50 text-blue-600 border-blue-100 uppercase tracking-tighter">Kit</Badge>}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{item.qty}</TableCell>
                            <TableCell className="text-right tabular-nums">{item.price > 0 ? formatCurrencyByCode(item.price, currencyCode) : "—"}</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">{formatCurrencyByCode(item.total, currencyCode)}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground text-xs">
                              {((item.total / (analysis.totalCampaign || 1)) * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <tfoot className="bg-brand-50/80 font-bold border-t border-brand-100">
                        <TableRow>
                          <TableCell colSpan={3} className="text-right text-brand-900 uppercase text-xs tracking-wider">Total Acumulado</TableCell>
                          <TableCell className="text-right tabular-nums text-brand-900 text-base">{formatCurrencyByCode(analysis.totalCampaign, currencyCode)}</TableCell>
                          <TableCell className="text-right">100%</TableCell>
                        </TableRow>
                      </tfoot>
                    </Table>
                  </div>
                </section>

                {/* Section 2: Gaps */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingDown className="w-5 h-5 text-brand-500" />
                    <h3 className="text-lg font-medium text-brand-900">Gap entre Fornecedores</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analysis.gaps.map((gap: any) => (
                      <div key={gap.id} className="p-4 rounded-lg border border-brand-100 bg-card shadow-sm space-y-3">
                        <h4 className="font-medium text-sm line-clamp-1 text-brand-800">{gap.name}</h4>
                        <div className="flex justify-between items-end">
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Menor vs Maior</p>
                            <p className="text-xs font-medium tabular-nums text-emerald-600">{formatCurrencyByCode(gap.min, currencyCode)}</p>
                            <p className="text-xs font-medium tabular-nums text-rose-600">{formatCurrencyByCode(gap.max, currencyCode)}</p>
                          </div>
                          <div className="text-right space-y-1">
                            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Disparidade</p>
                            <p className={cn("text-lg font-bold tabular-nums", gap.gapPct > 30 ? "text-rose-600" : "text-amber-600")}>
                              {gap.gapPct.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {analysis.gaps.length === 0 && (
                      <div className="col-span-full py-8 text-center text-muted-foreground bg-brand-50/30 rounded-lg border border-dashed">
                        Dados insuficientes para comparação (necessário ao menos 2 fornecedores respondidos).
                      </div>
                    )}
                  </div>
                </section>

                {/* Section 3: Distribution & Insights */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-brand-500" />
                    <h3 className="text-lg font-medium text-brand-900">Distribuição por Loja & Insights</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                       <h4 className="text-sm font-semibold text-brand-700 flex items-center gap-2">
                         <Lightbulb className="w-4 h-4 text-amber-500" />
                         Sugestões de Otimização
                       </h4>
                       <div className="space-y-3">
                         {analysis.suggestions.map((s, idx) => (
                           <div key={idx} className="p-4 rounded-lg bg-amber-50 border border-amber-100 text-amber-900 text-sm leading-relaxed shadow-sm">
                             {s}
                           </div>
                         ))}
                         {analysis.suggestions.length === 0 && (
                           <p className="text-sm text-muted-foreground italic">Nenhuma anomalia estatística detectada.</p>
                         )}
                       </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-brand-700">Sinalização de Excesso ( {">"} Média + 1 DP )</h4>
                      <ScrollArea className="h-[300px] border border-brand-100 rounded-lg p-4 bg-brand-50/20">
                         <div className="space-y-4">
                           {analysis.storeStats.filter(s => s.outliers.length > 0).map(s => (
                             <div key={s.id} className="space-y-2">
                               <div className="flex items-center justify-between">
                                 <p className="text-xs font-bold text-brand-800">{s.name}</p>
                                 <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-600 border-rose-100">
                                   {s.outliers.length} lojas acima do padrão
                                 </Badge>
                               </div>
                               <div className="flex gap-4 text-[10px] text-muted-foreground">
                                 <span>Média: {s.mean.toFixed(1)}</span>
                                 <span>Desvio: {s.stdDev.toFixed(1)}</span>
                                 <span>Máx: {s.max}</span>
                               </div>
                             </div>
                           ))}
                           {analysis.storeStats.filter(s => s.outliers.length > 0).length === 0 && (
                             <p className="text-center py-10 text-muted-foreground text-sm">Nenhum excesso detectado nas quantidades por loja.</p>
                           )}
                         </div>
                      </ScrollArea>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
