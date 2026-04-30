import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History } from "lucide-react";
import { formatCurrencyByCode } from "@/lib/countryConfig";

interface PriceRow { piece_id: string | null; kit_id: string | null; unit_price: number | null; }
interface ExtraRow { installation_value: number | null; freight_value: number | null; notes?: string | null; }
interface Snapshot { prices: PriceRow[]; extra_costs: ExtraRow | null; }
interface HistoryEntry {
  id: string;
  version: number;
  reason: "submitted" | "reopened" | string;
  created_at: string;
  snapshot: Snapshot;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  supplierId: string | null;
  supplierName?: string;
  currencyCode?: string;
  pieces: { id: string; code?: string | number | null; name?: string | null }[];
  kits: { id: string; name?: string | null }[];
}

export default function BudgetSupplierHistorySheet({
  open, onOpenChange, supplierId, supplierName, currencyCode = "BRL", pieces, kits,
}: Props) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["budget_price_history", supplierId],
    enabled: open && !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_price_history" as never)
        .select("id, version, reason, created_at, snapshot")
        .eq("supplier_id", supplierId!)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as HistoryEntry[];
    },
  });

  const fmt = (v: number | null | undefined) => (v == null ? "—" : formatCurrencyByCode(Number(v), currencyCode));
  const pieceLabel = (id: string) => {
    const p = pieces.find((x) => x.id === id);
    return p ? `${p.code ?? ""} ${p.name ?? ""}`.trim() || "Peça" : "Peça removida";
  };
  const kitLabel = (id: string) => kits.find((k) => k.id === id)?.name || "Kit";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <History className="w-4 h-4" /> Histórico de valores — {supplierName}
          </SheetTitle>
          <SheetDescription>
            Cada versão é registrada quando o fornecedor envia ou quando você libera a planilha para revisão.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}
          {!isLoading && entries.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhuma versão registrada ainda.</p>
          )}
          {entries.map((e) => {
            const reasonLabel =
              e.reason === "submitted" ? "Enviado pelo fornecedor"
              : e.reason === "reopened" ? "Liberado para revisão"
              : e.reason;
            const reasonColor =
              e.reason === "submitted"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
            const totalPieces = (e.snapshot.prices || []).reduce((acc, r) => acc + (Number(r.unit_price) || 0), 0);
            return (
              <div key={e.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">v{e.version}</Badge>
                    <Badge className={`text-[10px] ${reasonColor}`}>{reasonLabel}</Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {format(new Date(e.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <div className="rounded-md border border-border/60 overflow-hidden">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Item</TableHead>
                        <TableHead className="text-xs text-right w-32">Preço unit.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(e.snapshot.prices || []).filter((r) => Number(r.unit_price) > 0).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">
                            {r.piece_id ? pieceLabel(r.piece_id) : r.kit_id ? `KIT — ${kitLabel(r.kit_id)}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{fmt(r.unit_price)}</TableCell>
                        </TableRow>
                      ))}
                      {(e.snapshot.extra_costs?.installation_value || 0) > 0 && (
                        <TableRow>
                          <TableCell className="text-xs italic text-muted-foreground">Instalação</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{fmt(e.snapshot.extra_costs?.installation_value)}</TableCell>
                        </TableRow>
                      )}
                      {(e.snapshot.extra_costs?.freight_value || 0) > 0 && (
                        <TableRow>
                          <TableCell className="text-xs italic text-muted-foreground">Frete</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{fmt(e.snapshot.extra_costs?.freight_value)}</TableCell>
                        </TableRow>
                      )}
                      {(e.snapshot.prices || []).filter((r) => Number(r.unit_price) > 0).length === 0 &&
                       !e.snapshot.extra_costs?.installation_value && !e.snapshot.extra_costs?.freight_value && (
                        <TableRow><TableCell colSpan={2} className="text-xs text-center text-muted-foreground py-3">Sem valores registrados.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-muted-foreground">Σ peças (sem multiplicar por qtd)</span>
                  <span className="font-semibold tabular-nums">{fmt(totalPieces)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
