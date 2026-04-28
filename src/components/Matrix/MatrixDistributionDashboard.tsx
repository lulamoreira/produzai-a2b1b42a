import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, Package, Store as StoreIcon, AlertTriangle, BarChart3, Boxes } from "lucide-react";
import type { ClientStore, CampaignPiece, CampaignKit, CampaignKitPiece } from "@/hooks/useMultiClientData";

interface Props {
  stores: ClientStore[];
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: CampaignKitPiece[];
  qtyMap: Record<string, number>;
}

type StoreRow = {
  store: ClientStore;
  pieces: { piece: CampaignPiece; quantity: number }[];
  kits: { kit: CampaignKit; quantity: number }[];
  totalPieces: number;
  uniquePieces: number;
};

/**
 * Read-only dashboard view of the campaign rateio.
 * - Lists each store and which pieces (and inferred kits) it receives, with quantities.
 * - KPIs: total distributed pieces, unique pieces & stores, top 5 pieces, stores without any piece.
 *
 * Source of truth is `qtyMap` (campaign_store_pieces) — the same data used by the matrix.
 * Kits are presented informatively based on component proportions; they do NOT add quantities.
 */
export default function MatrixDistributionDashboard({
  stores, pieces, kits, kitPieces, qtyMap,
}: Props) {
  const [search, setSearch] = useState("");

  const piecesById = useMemo(() => {
    const m = new Map<string, CampaignPiece>();
    pieces.forEach(p => m.set(p.id, p));
    return m;
  }, [pieces]);

  const rows: StoreRow[] = useMemo(() => {
    return stores.map(store => {
      const pieceRows: { piece: CampaignPiece; quantity: number }[] = [];
      let total = 0;
      for (const p of pieces) {
        const q = qtyMap[`${store.id}-${p.id}`] || 0;
        if (q > 0) {
          pieceRows.push({ piece: p, quantity: q });
          total += q;
        }
      }

      const kitRows: { kit: CampaignKit; quantity: number }[] = [];
      for (const kit of kits) {
        const components = kitPieces.filter(kp => kp.kit_id === kit.id);
        if (components.length === 0) continue;
        let inferred: number | null = null;
        for (const comp of components) {
          const perKit = comp.quantity || 0;
          if (perKit <= 0) { inferred = 0; break; }
          const storeQty = qtyMap[`${store.id}-${comp.piece_id}`] || 0;
          const fits = Math.floor(storeQty / perKit);
          inferred = inferred === null ? fits : Math.min(inferred, fits);
          if (inferred === 0) break;
        }
        if (inferred && inferred > 0) {
          kitRows.push({ kit, quantity: inferred });
        }
      }

      pieceRows.sort((a, b) => b.quantity - a.quantity || String(a.piece.code).localeCompare(String(b.piece.code)));
      kitRows.sort((a, b) => b.quantity - a.quantity || String(a.kit.code).localeCompare(String(b.kit.code)));

      return {
        store,
        pieces: pieceRows,
        kits: kitRows,
        totalPieces: total,
        uniquePieces: pieceRows.length,
      };
    });
  }, [stores, pieces, kits, kitPieces, qtyMap]);

  const kpis = useMemo(() => {
    const totalDistributed = rows.reduce((s, r) => s + r.totalPieces, 0);
    const storesWithPieces = rows.filter(r => r.totalPieces > 0).length;
    const uniquePieceIds = new Set<string>();
    rows.forEach(r => r.pieces.forEach(pr => uniquePieceIds.add(pr.piece.id)));

    const pieceTotals = new Map<string, number>();
    rows.forEach(r => r.pieces.forEach(pr => {
      pieceTotals.set(pr.piece.id, (pieceTotals.get(pr.piece.id) || 0) + pr.quantity);
    }));
    const topPieces = Array.from(pieceTotals.entries())
      .map(([id, qty]) => ({ piece: piecesById.get(id)!, quantity: qty }))
      .filter(t => t.piece)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const storesWithoutPieces = rows.filter(r => r.totalPieces === 0).map(r => r.store);

    return {
      totalDistributed,
      uniquePieces: uniquePieceIds.size,
      totalStores: rows.length,
      storesWithPieces,
      topPieces,
      storesWithoutPieces,
    };
  }, [rows, piecesById]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const storeMatch =
        r.store.name?.toLowerCase().includes(q) ||
        r.store.nickname?.toLowerCase().includes(q) ||
        r.store.store_code?.toLowerCase().includes(q);
      if (storeMatch) return true;
      return r.pieces.some(pr =>
        pr.piece.name.toLowerCase().includes(q) ||
        String(pr.piece.code).toLowerCase().includes(q),
      );
    });
  }, [rows, search]);

  return (
    <div className="flex flex-col gap-4 p-3 sm:p-4 overflow-y-auto">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <KpiCard
          icon={<BarChart3 className="w-4 h-4" />}
          label="Total de peças distribuídas"
          value={kpis.totalDistributed.toLocaleString("pt-BR")}
        />
        <KpiCard
          icon={<Package className="w-4 h-4" />}
          label="Peças únicas"
          value={`${kpis.uniquePieces}`}
          hint={`de ${pieces.length} cadastradas`}
        />
        <KpiCard
          icon={<StoreIcon className="w-4 h-4" />}
          label="Lojas com peças"
          value={`${kpis.storesWithPieces}`}
          hint={`de ${kpis.totalStores} lojas`}
        />
        <KpiCard
          icon={<AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
          label="Lojas sem peças"
          value={`${kpis.storesWithoutPieces.length}`}
          tone={kpis.storesWithoutPieces.length > 0 ? "warning" : "default"}
        />
      </div>

      {/* Top 5 */}
      {kpis.topPieces.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Top 5 peças mais distribuídas</h3>
          </div>
          <ol className="space-y-1.5">
            {kpis.topPieces.map((tp, i) => {
              const max = kpis.topPieces[0].quantity || 1;
              const pct = Math.max(4, Math.round((tp.quantity / max) * 100));
              return (
                <li key={tp.piece.id} className="flex items-center gap-2">
                  <span className="text-[11px] w-5 text-muted-foreground font-mono">{i + 1}.</span>
                  <Badge variant="outline" className="text-[10px] font-mono shrink-0">{tp.piece.code}</Badge>
                  <span className="text-xs flex-1 min-w-0 truncate">{tp.piece.name}</span>
                  <div className="hidden sm:block flex-1 max-w-[180px] h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums w-16 text-right">
                    {tp.quantity.toLocaleString("pt-BR")}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Stores without pieces */}
      {kpis.storesWithoutPieces.length > 0 && (
        <div className="rounded-xl border border-amber-300/60 dark:border-amber-700/60 bg-amber-50/60 dark:bg-amber-950/20 p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Lojas sem peças atribuídas ({kpis.storesWithoutPieces.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-1">
            {kpis.storesWithoutPieces.slice(0, 30).map(s => (
              <Badge
                key={s.id}
                variant="outline"
                className="text-[10px] border-amber-400/50 dark:border-amber-700/50"
              >
                {s.name}
              </Badge>
            ))}
            {kpis.storesWithoutPieces.length > 30 && (
              <span className="text-[11px] text-amber-700 dark:text-amber-300 self-center">
                +{kpis.storesWithoutPieces.length - 30} outras
              </span>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por loja, código de peça ou nome…"
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* Stores accordion */}
      <div className="rounded-xl border border-border bg-card">
        {filteredRows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma loja encontrada para este filtro.</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {filteredRows.map(row => (
              <AccordionItem key={row.store.id} value={row.store.id} className="px-3 sm:px-4">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex flex-1 items-center justify-between gap-2 min-w-0 pr-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <StoreIcon className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0 text-left">
                        <p className="text-sm font-medium truncate">{row.store.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {[row.store.store_code, row.store.city, row.store.state].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {row.totalPieces === 0 ? (
                        <Badge variant="outline" className="text-[10px] border-amber-400/60 text-amber-700 dark:text-amber-300">
                          sem peças
                        </Badge>
                      ) : (
                        <>
                          <Badge variant="secondary" className="text-[10px]">
                            {row.uniquePieces} pç únicas
                          </Badge>
                          <Badge className="text-[10px] tabular-nums">
                            {row.totalPieces.toLocaleString("pt-BR")} total
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {row.totalPieces === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      Esta loja ainda não recebeu nenhuma peça nesta campanha.
                    </p>
                  ) : (
                    <div className="space-y-3 pb-2">
                      {row.kits.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Boxes className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                              Kits inferidos
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {row.kits.map(kr => (
                              <Badge key={kr.kit.id} variant="outline" className="text-[10px]">
                                Kit {kr.kit.code} · {kr.kit.name} <span className="ml-1 font-semibold">×{kr.quantity}</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Package className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                            Peças
                          </span>
                        </div>
                        <div className="rounded-lg border border-border overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left font-medium px-2 py-1.5 w-16">Código</th>
                                <th className="text-left font-medium px-2 py-1.5">Peça</th>
                                <th className="text-right font-medium px-2 py-1.5 w-20">Qtd.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.pieces.map((pr, i) => (
                                <tr key={pr.piece.id} className={i % 2 ? "bg-muted/20" : ""}>
                                  <td className="px-2 py-1.5 font-mono">{pr.piece.code}</td>
                                  <td className="px-2 py-1.5 truncate">{pr.piece.name}</td>
                                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                                    {pr.quantity.toLocaleString("pt-BR")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon, label, value, hint, tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={`rounded-xl border p-3 sm:p-4 bg-card ${
        tone === "warning"
          ? "border-amber-300/60 dark:border-amber-700/60"
          : "border-border"
      }`}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
