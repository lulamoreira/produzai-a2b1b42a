import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { GroupStats } from "@/lib/storeClusterCost";

export interface StoreClusterResultsProps {
  groups: GroupStats[];
  all: GroupStats;
  fmt: (v: number) => string;
  campaignNames: Record<string, string>;
}

/** Tabela por grupo, barras da média e lojas de cada grupo. */
export function StoreClusterResults({ groups, all, fmt, campaignNames }: StoreClusterResultsProps) {
  const [open, setOpen] = useState<string | null>(null);
  const maxAvg = Math.max(1, ...groups.map((g) => g.avg));
  const multi = Object.keys(all.avgByCampaign).length > 1;
  const cell = "px-2 py-1.5 text-right whitespace-nowrap";
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left">Grupo</th>
              <th className={cell}>Lojas</th><th className={cell}>Total</th><th className={cell}>Média/loja</th>
              <th className={cell}>Mediana</th><th className={cell}>Menor</th><th className={cell}>Maior</th>
              <th className={cell}>Méd. produção</th><th className={cell}>Méd. frete+inst.</th><th className={cell}>Méd. desconto</th>
            </tr>
          </thead>
          <tbody>
            {[...groups, all].map((g) => {
              const isAll = g === all;
              const isOpen = open === g.name && !isAll;
              return (
                <Fragment key={g.name + (isAll ? "_all" : "")}>
                  <tr
                    className={`border-t border-border ${isAll ? "font-semibold bg-muted/50" : "cursor-pointer hover:bg-muted/40"}`}
                    onClick={() => !isAll && setOpen(isOpen ? null : g.name)}
                  >
                    <td className="px-2 py-1.5 text-left">
                      <span className="inline-flex items-center gap-1">
                        {!isAll && (isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
                        {g.name}
                      </span>
                      {multi && (
                        <div className="text-[10px] text-muted-foreground font-normal">
                          {Object.entries(g.avgByCampaign).map(([c, v]) => `${campaignNames[c] ?? c}: ${fmt(v)}`).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td className={cell}>{g.count}</td><td className={cell}>{fmt(g.total)}</td>
                    <td className={`${cell} font-semibold`}>{fmt(g.avg)}</td><td className={cell}>{fmt(g.median)}</td>
                    <td className={cell}>{fmt(g.min)}</td><td className={cell}>{fmt(g.max)}</td>
                    <td className={cell}>{fmt(g.avgProduction)}</td><td className={cell}>{fmt(g.avgLogistics)}</td>
                    <td className={cell}>{fmt(g.avgDiscount)}</td>
                  </tr>
                  {isOpen && g.stores.map((s) => (
                    <tr key={`${s.campaignId}-${s.store.id}`} className="border-t border-border/50 bg-background">
                      <td className="pl-7 pr-2 py-1 text-left">
                        {s.store.name}
                        <span className="text-muted-foreground"> {[s.store.city, s.store.state].filter(Boolean).join("/")}</span>
                        {multi && <span className="text-[10px] text-muted-foreground"> · {campaignNames[s.campaignId]}</span>}
                      </td>
                      <td /><td className={cell}>{fmt(s.total)}</td><td colSpan={4} />
                      <td className={cell}>{fmt(s.production)}</td><td className={cell}>{fmt(s.freight + s.installation)}</td>
                      <td className={cell}>{fmt(s.discount)}</td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="space-y-1.5" aria-label="Média por loja em cada grupo">
        {groups.map((g) => (
          <div key={g.name} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 truncate" title={g.name}>{g.name}</span>
            <div className="flex-1 h-4 bg-muted rounded">
              <div className="h-4 bg-primary rounded" style={{ width: `${(g.avg / maxAvg) * 100}%` }} />
            </div>
            <span className="w-28 shrink-0 text-right">{fmt(g.avg)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
