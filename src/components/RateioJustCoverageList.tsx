import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RateioFinding } from "@/lib/reviewRateio";
import { coverageRow, fpEspecifico } from "@/lib/rateioReviewJust";

/** Acima disso a lista começa recolhida. */
const AUTO_OPEN_MAX = 8;

export interface RateioJustCoverageListProps {
  /** Apontamentos cobertos pela regra (já ordenados). */
  findings: RateioFinding[];
  /** Rótulo do botão que expande (ex.: "Vale para 6 loja(s) agora — ver quais"). */
  label: string;
  /** Apontamento atual, marcado com o selo "este". */
  current?: RateioFinding;
  /** Total de apontamentos do contexto, para o rodapé "N de M apontamentos ativos". */
  footerTotal?: number;
  footerNoun?: string;
  /** Abre de início? Padrão: aberta se houver até 8 linhas. */
  defaultOpen?: boolean;
}

/** Prévia somente leitura das lojas/apontamentos cobertos por uma regra "Todas as lojas". */
export function RateioJustCoverageList({ findings, label, current, footerTotal, footerNoun = "apontamentos ativos", defaultOpen }: RateioJustCoverageListProps) {
  const [open, setOpen] = useState(defaultOpen ?? findings.length <= AUTO_OPEN_MAX);
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 text-left text-xs font-medium text-foreground hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <ChevronDown className={cn("w-3.5 h-3.5 shrink-0 transition-transform", !open && "-rotate-90")} />
        <span aria-live="polite">{label}</span>
      </button>
      {open ? (
        <div className="rounded-md border bg-muted/30">
          <ul className="max-h-[180px] overflow-y-auto divide-y">
            {findings.map((f, i) => {
              const row = coverageRow(f);
              return (
                <li key={`${fpEspecifico(f)}-${f.title}-${i}`} className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs text-foreground truncate">{row.title}</span>
                    {current && f === current ? (
                      <span className="shrink-0 rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary">este</span>
                    ) : null}
                  </div>
                  {row.sub ? <p className="text-[10px] leading-snug text-muted-foreground break-words">{row.sub}</p> : null}
                </li>
              );
            })}
          </ul>
          {footerTotal !== undefined ? (
            <p className="border-t px-2 py-1 text-[10px] text-muted-foreground tabular-nums">
              {findings.length} de {footerTotal} {footerNoun}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
