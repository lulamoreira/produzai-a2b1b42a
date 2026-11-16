import { Badge } from "@/components/ui/badge";
import { showcaseGroups, showcaseLabel } from "@/lib/rateioReviewView";
import type { RateioFinding } from "@/lib/reviewRateio";

const lojas = (n: number) => `${n} ${n === 1 ? "loja" : "lojas"}`;

/** Mini-quadro "Falta em lojas do mesmo modelo" agrupado pelo nº de vitrines (somente exibição). */
export function RateioShowcaseGroups({ f }: { f: RateioFinding }) {
  const groups = showcaseGroups(f);
  if (groups.length === 0) return null;
  return (
    <div className="rounded border border-border/60 bg-muted/30 text-[11px]">
      <p className="px-2 pt-1.5 pb-1 font-semibold text-muted-foreground">Por nº de vitrines</p>
      <ul className="divide-y divide-border/50">
        {groups.map((g) => (
          <li key={g.showcase} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2 py-1">
            <span className="font-medium">{showcaseLabel(g.showcase)}:</span>
            <span className="text-muted-foreground">
              {g.have > 0 ? `${lojas(g.have)} têm (qtd mais comum ${g.mode})` : "nenhuma tem"} · {g.notHave} não {g.notHave === 1 ? "tem" : "têm"}
            </span>
            {g.flag === "provavel_erro" ? (
              <Badge className="border-0 text-[9px] px-1.5 py-0 bg-destructive text-destructive-foreground">provável erro</Badge>
            ) : g.flag === "sem_referencia" ? (
              <Badge className="border-0 text-[9px] px-1.5 py-0 bg-muted text-muted-foreground">sem referência</Badge>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
