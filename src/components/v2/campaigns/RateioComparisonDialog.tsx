import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Copy,
  Download,
  Loader2,
  Search,
  X,
  ArrowRight,
  Package,
  Layers,
  Plus,
  Minus,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import {
  computeRateioDiff,
  type ItemDiff,
  type StoreDiff,
  type RateioPieceLike,
  type RateioKitLike,
  type RateioKitPieceLike,
  type RateioStoreLike,
} from "@/lib/rateioComparison";
import {
  buildRateioComparisonText,
  exportRateioComparisonXLSX,
} from "@/lib/exportRateioComparison";

type RateioSource = "original" | "negotiation" | "adjustment";

interface RateioComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  clientName: string;
  agencyName: string;
  pieces: RateioPieceLike[];
  kits: RateioKitLike[];
  kitPieces: RateioKitPieceLike[];
  stores: RateioStoreLike[];
  /** Current visible qtyMap (already merged with optimistic overrides). */
  currentQtyMap: Record<string, number>;
  currentSource: RateioSource;
  currentLabel: string;
  /** Determines which version is used as "previous". */
  hasNegotiationRateio: boolean;
  hasCampaignNegRateio?: boolean;
  negotiationSupplierId?: string | null;
}

const formatSign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export default function RateioComparisonDialog({
  open,
  onOpenChange,
  campaignId,
  campaignName,
  clientName,
  agencyName,
  pieces,
  kits,
  kitPieces,
  stores,
  currentQtyMap,
  currentSource,
  currentLabel,
  hasNegotiationRateio,
  hasCampaignNegRateio,
  negotiationSupplierId,
}: RateioComparisonDialogProps) {
  // Decide which "previous" version to load.
  // Rules:
  //   current === negotiation  → previous = original (campaign_store_pieces)
  //   current === adjustment   → previous = negotiation (if any) else original
  //   current === original     → previous = original (no diff; button hidden in parent)
  const previousSource: RateioSource = useMemo(() => {
    if (currentSource === "negotiation") return "original";
    if (currentSource === "adjustment") {
      if (hasNegotiationRateio || hasCampaignNegRateio) return "negotiation";
      return "original";
    }
    return "original";
  }, [currentSource, hasNegotiationRateio, hasCampaignNegRateio]);

  const previousLabel = useMemo(() => {
    if (previousSource === "original") return "Rateio Original";
    if (previousSource === "negotiation") return "Rateio de Negociação";
    return "Rateio";
  }, [previousSource]);

  // Fetch the "previous" qtyMap on demand.
  const previousQuery = useQuery({
    queryKey: ["rateio-comparison-previous", campaignId, previousSource, negotiationSupplierId ?? "_"],
    enabled: open,
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, number>> => {
      if (previousSource === "original") {
        const rows = await supabasePaginate<{ store_id: string; piece_id: string; quantity: number }>(
          (from, to) =>
            supabase
              .from("campaign_store_pieces")
              .select("store_id, piece_id, quantity", { count: "exact" })
              .eq("campaign_id", campaignId)
              .order("id").range(from, to) as any
        );
        const map: Record<string, number> = {};
        for (const r of rows) {
          const q = Number(r.quantity) || 0;
          if (q > 0) map[`${r.store_id}-${r.piece_id}`] = q;
        }
        return map;
      }
      // negotiation
      const query = supabase
        .from("budget_negotiation_store_pieces" as never)
        .select("store_id, piece_id, quantity, supplier_id", { count: "exact" })
        .eq("campaign_id", campaignId);
      const rows = await supabasePaginate<{
        store_id: string;
        piece_id: string;
        quantity: number;
        supplier_id: string | null;
      }>(
        (from, to) =>
          (negotiationSupplierId
            ? query.eq("supplier_id", negotiationSupplierId).order("id").range(from, to)
            : query.is("supplier_id", null).range(from, to)) as any
      );
      const map: Record<string, number> = {};
      for (const r of rows) {
        const q = Number(r.quantity) || 0;
        if (q > 0) {
          // multiple rows per (store, piece) may exist for different suppliers — sum them
          const key = `${r.store_id}-${r.piece_id}`;
          map[key] = (map[key] || 0) + q;
        }
      }
      return map;
    },
  });

  const diff = useMemo(() => {
    if (!previousQuery.data) return null;
    return computeRateioDiff(
      pieces,
      kits,
      kitPieces, // previous kit composition — same source: campaign-level
      kitPieces, // current kit composition — same source: campaign-level (adjustments don't version kits in this view)
      stores,
      previousQuery.data,
      currentQtyMap
    );
  }, [previousQuery.data, pieces, kits, kitPieces, stores, currentQtyMap]);

  // Search filter
  const [search, setSearch] = useState("");
  const filteredItems = useMemo(() => {
    if (!diff) return [];
    const q = search.trim().toLowerCase();
    if (!q) return diff.items;
    return diff.items.filter((it) => {
      if (it.name.toLowerCase().includes(q)) return true;
      if (String(it.code ?? "").includes(q)) return true;
      if (it.children?.some((c) => c.name.toLowerCase().includes(q) || String(c.code ?? "").includes(q)))
        return true;
      return false;
    });
  }, [diff, search]);

  const meta = {
    campaignName,
    clientName,
    agencyName,
    currentLabel,
    previousLabel,
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!diff) return;
    setIsExporting(true);
    try {
      await exportRateioComparisonXLSX(diff, meta);
      toast.success("Comparativo exportado com sucesso");
    } catch (err: any) {
      toast.error("Erro ao exportar: " + (err?.message || "tente novamente"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyText = async () => {
    if (!diff) return;
    try {
      const text = buildRateioComparisonText(diff, meta);
      await navigator.clipboard.writeText(text);
      toast.success("Comparativo copiado para a área de transferência");
    } catch (err: any) {
      toast.error("Não foi possível copiar: " + (err?.message || ""));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] w-[95vw] h-[92vh] p-0 flex flex-col gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-stone-200 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl font-bold text-stone-900">
                Comparativo de Rateios
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-2 text-sm text-stone-600 flex-wrap">
                <Badge variant="outline" className="bg-stone-50 text-stone-700 border-stone-300">
                  {previousLabel}
                </Badge>
                <ArrowRight className="w-4 h-4 text-stone-400" />
                <Badge className="bg-[#C2714F] text-white hover:bg-[#C2714F]">{currentLabel}</Badge>
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyText}
                disabled={!diff || previousQuery.isLoading}
                className="gap-2"
              >
                <Copy className="w-4 h-4" />
                Copiar texto
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleExport}
                disabled={!diff || isExporting || previousQuery.isLoading}
                className="gap-2 bg-[#8C6F4E] hover:bg-[#7a5f42]"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Exportar XLSX
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-9 w-9 rounded-full hover:bg-stone-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Summary line */}
          {diff && (
            <div className="mt-3 flex items-center gap-4 flex-wrap text-xs">
              <span className="text-stone-600">
                <strong className="text-stone-900">{diff.summary.piecesChanged}</strong> peça(s) alterada(s)
              </span>
              <span className="text-stone-300">·</span>
              <span className="text-stone-600">
                <strong className="text-stone-900">{diff.summary.kitsChanged}</strong> kit(s) alterado(s)
              </span>
              <span className="text-stone-300">·</span>
              <span className="text-stone-600">
                Total: <strong className="text-stone-900">{diff.summary.totalQuantityPrevious}</strong>
                <ArrowRight className="inline w-3 h-3 mx-1 text-stone-400" />
                <strong className="text-stone-900">{diff.summary.totalQuantityCurrent}</strong>{" "}
                <span
                  className={cn(
                    "font-semibold",
                    diff.summary.totalQuantityDiff > 0 && "text-emerald-600",
                    diff.summary.totalQuantityDiff < 0 && "text-destructive"
                  )}
                >
                  ({formatSign(diff.summary.totalQuantityDiff)})
                </span>
              </span>
              <span className="text-stone-300">·</span>
              <span className="text-stone-600">
                Lojas: <span className="text-emerald-600 font-semibold">+{diff.summary.storesAdded}</span> /{" "}
                <span className="text-amber-600 font-semibold">±{diff.summary.storesModified}</span> /{" "}
                <span className="text-destructive font-semibold">-{diff.summary.storesRemoved}</span>
              </span>
            </div>
          )}
        </DialogHeader>

        {/* Search bar */}
        <div className="px-6 py-2 border-b border-stone-200 bg-stone-50/60 shrink-0">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por código ou nome..."
              className="pl-9 h-8 text-xs bg-white"
            />
          </div>
        </div>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-3">
            {previousQuery.isLoading && (
              <div className="flex items-center justify-center py-20 text-stone-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Carregando rateio anterior...
              </div>
            )}
            {previousQuery.isError && (
              <div className="text-center py-20 text-destructive">
                Erro ao carregar rateio anterior.
              </div>
            )}
            {diff && filteredItems.length === 0 && (
              <div className="text-center py-20 text-stone-500">
                {diff.items.length === 0
                  ? "Nenhuma diferença entre os dois rateios."
                  : "Nenhum item corresponde ao filtro."}
              </div>
            )}
            {filteredItems.map((it) => (
              <ItemCard key={`${it.kind}-${it.id}`} item={it} />
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Item card                                                           */
/* ------------------------------------------------------------------ */

function ItemCard({ item, nested = false }: { item: ItemDiff; nested?: boolean }) {
  const isKit = item.kind === "kit";
  const diffColor =
    item.totalDiff > 0
      ? "text-emerald-600"
      : item.totalDiff < 0
      ? "text-destructive"
      : "text-stone-500";

  return (
    <div
      className={cn(
        "border rounded-lg bg-white overflow-hidden",
        nested ? "border-stone-200 bg-stone-50/50" : "border-stone-300 shadow-sm"
      )}
    >
      <div className="px-4 py-3 border-b border-stone-200 bg-stone-50/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {nested ? (
            <span className="text-stone-400 text-sm">↳</span>
          ) : isKit ? (
            <Layers className="w-4 h-4 text-[#C2714F] shrink-0" />
          ) : (
            <Package className="w-4 h-4 text-stone-500 shrink-0" />
          )}
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] font-bold uppercase",
              isKit
                ? "bg-[#C2714F]/10 text-[#C2714F] border border-[#C2714F]/30"
                : "bg-stone-100 text-stone-700 border border-stone-200"
            )}
          >
            {isKit ? "Kit" : "Peça"}
          </Badge>
          <span className="font-bold text-stone-900 text-sm">#{item.code ?? "—"}</span>
          <span className="text-stone-700 text-sm truncate">{item.name}</span>
        </div>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <span className="text-stone-500">
            Total: <span className="font-semibold text-stone-700">{item.totalPrevious}</span>
            <ArrowRight className="inline w-3 h-3 mx-1 text-stone-400" />
            <span className="font-bold text-stone-900">{item.totalCurrent}</span>
          </span>
          <span className={cn("font-bold tabular-nums", diffColor)}>{formatSign(item.totalDiff)}</span>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        <StoreList label="Lojas adicionadas" icon={<Plus className="w-3.5 h-3.5" />} list={item.added} tone="add" />
        <StoreList
          label="Lojas com quantidade alterada"
          icon={<Pencil className="w-3.5 h-3.5" />}
          list={item.modified}
          tone="mod"
        />
        <StoreList label="Lojas removidas" icon={<Minus className="w-3.5 h-3.5" />} list={item.removed} tone="rem" />
        {item.added.length + item.modified.length + item.removed.length === 0 && (
          <div className="text-xs text-stone-400 italic">
            Sem alterações por loja (kit alterado por variação nos componentes).
          </div>
        )}
      </div>

      {isKit && item.children && item.children.length > 0 && (
        <div className="px-4 pb-4 pt-1 space-y-2 bg-stone-50/40 border-t border-stone-200">
          <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500 mt-2">
            Componentes alterados
          </div>
          {item.children.map((c) => (
            <ItemCard key={`child-${c.id}`} item={c} nested />
          ))}
        </div>
      )}
    </div>
  );
}

function StoreList({
  label,
  icon,
  list,
  tone,
}: {
  label: string;
  icon: React.ReactNode;
  list: StoreDiff[];
  tone: "add" | "rem" | "mod";
}) {
  if (list.length === 0) return null;
  const toneCls =
    tone === "add"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : tone === "rem"
      ? "text-destructive bg-destructive/5 border-destructive/30"
      : "text-amber-700 bg-amber-50 border-amber-200";

  return (
    <div className="space-y-1.5">
      <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border", toneCls)}>
        {icon}
        {label} ({list.length})
      </div>
      <div className="border border-stone-200 rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-stone-50 text-stone-500 text-[10px] uppercase">
            <tr>
              <th className="text-left px-2 py-1 font-semibold w-28">Código</th>
              <th className="text-left px-2 py-1 font-semibold">Loja</th>
              <th className="text-left px-2 py-1 font-semibold w-32">Cidade</th>
              <th className="text-center px-2 py-1 font-semibold w-10">UF</th>
              <th className="text-right px-2 py-1 font-semibold w-16">Antes</th>
              <th className="text-right px-2 py-1 font-semibold w-16">Depois</th>
              <th className="text-right px-2 py-1 font-semibold w-14">Δ</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.store.id} className="border-t border-stone-100 hover:bg-stone-50/50">
                <td className="px-2 py-1 font-mono text-stone-600">{s.store.store_code || "—"}</td>
                <td className="px-2 py-1 text-stone-800 truncate max-w-[200px]">{s.store.name}</td>
                <td className="px-2 py-1 text-stone-500 truncate max-w-[120px]">{s.store.city || "—"}</td>
                <td className="px-2 py-1 text-center text-stone-500">{s.store.state || "—"}</td>
                <td className="px-2 py-1 text-right tabular-nums text-stone-500">{s.previous}</td>
                <td className="px-2 py-1 text-right tabular-nums font-semibold text-stone-900">{s.current}</td>
                <td
                  className={cn(
                    "px-2 py-1 text-right tabular-nums font-bold",
                    s.diff > 0 ? "text-emerald-600" : s.diff < 0 ? "text-destructive" : "text-stone-500"
                  )}
                >
                  {formatSign(s.diff)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
