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
import { TrendingDown, PieChart, AlertTriangle } from "lucide-react";
import { formatCurrencyByCode } from "@/lib/countryConfig";
import type { CampaignPiece, CampaignKit } from "@/hooks/useMultiClientData";

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
        suppliers: suppliers.data ?? [],
        prices: prices.data ?? [],
      };
    },
    enabled: open,
  });

  const { data: storePieces = [] } = useQuery({
    queryKey: ["store_pieces_analysis", campaignId],
    queryFn: async () => {
      const { data, count, error } = await supabasePaginate(
        supabase.from("campaign_store_pieces").select("*", { count: "exact" }).eq("campaign_id", campaignId).order("id"),
        { page: 0, pageSize: 1000 }
      );
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const analysis = useMemo(() => {
    if (!budgetData) return null;
    const { suppliers, prices } = budgetData;

    const winner = suppliers.find(s => s.is_winner);
    const basePrices = new Map<string, number>();
    
    pieces.forEach(p => {
      const submitted = suppliers.filter(s => s.status === 'enviado');
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
      total: (qtyMap[p.id] || 0) * (basePrices.get(p.id) || 0)
    })), ...kits.map(k => {
      const components = kitPieceTotals[k.id] || [];
      const totalQty = components.reduce((acc, c) => acc + c.qty, 0);
      const totalPrice = components.reduce((acc, c) => acc + (c.qty * (basePrices.get(c.pieceId) || 0)), 0);
      return { name: k.name, id: k.id, qty: totalQty, price: totalPrice / (totalQty || 1), total: totalPrice };
    })].sort((a, b) => b.total - a.total);

    return { itemCosts };
  }, [budgetData, pieces, kits, kitPieceTotals, qtyMap]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Análise de Custos</DialogTitle>
          <DialogDescription>Dados lidos da campanha. Nenhuma alteração será feita.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 -mr-4 pr-4">
          <div className="space-y-8 p-1">
            {analysis && (
              <section>
                <h3 className="font-semibold text-sm mb-4">Ranking de Custo</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qtd Total</TableHead>
                      <TableHead className="text-right">Preço Unit.</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.itemCosts.map((item, i) => (
                      <TableRow key={item.id} className={i < 5 ? "bg-amber-50/50" : ""}>
                        <TableCell>{item.name} {i < 5 && <Badge variant="outline" className="ml-2 bg-amber-100">Top 5</Badge>}</TableCell>
                        <TableCell className="text-right">{item.qty}</TableCell>
                        <TableCell className="text-right">{formatCurrencyByCode(item.price, currencyCode)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrencyByCode(item.total, currencyCode)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
