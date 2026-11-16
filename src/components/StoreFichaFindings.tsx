import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { itemCodeLabel, type RateioFinding } from "@/lib/reviewRateio";
import { SEV_LABEL, SEV_STYLE } from "@/components/rateioReviewStyles";

function FindingRow({ f }: { f: RateioFinding }) {
  const code = itemCodeLabel(f.itemCode);
  return (
    <li className="px-2 py-1.5 text-xs space-y-0.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className={cn("border-0 text-[9px] px-1.5 py-0", SEV_STYLE[f.severity])}>{SEV_LABEL[f.severity]}</Badge>
        <span className="font-medium">{f.title}</span>
      </div>
      {f.itemName || code ? (
        <p className="text-muted-foreground break-words">
          {code ? <span className="font-mono mr-1">{code}</span> : null}
          {f.itemName}
        </p>
      ) : null}
    </li>
  );
}

/** "Apontamentos desta loja" na ficha (somente leitura). */
export function StoreFichaFindings({ active, justified }: { active: RateioFinding[]; justified: RateioFinding[] }) {
  const [showJust, setShowJust] = useState(false);
  return (
    <div className="pt-2 border-t border-border/60 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Apontamentos desta loja</span>
        <Badge variant="outline" className="text-[10px]">{active.length}</Badge>
      </div>
      {active.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum apontamento ativo para esta loja.</p>
      ) : (
        <ul className="max-h-56 overflow-y-auto rounded border border-border/60 divide-y divide-border/50">
          {active.map((f, i) => <FindingRow key={`a-${i}-${f.detail}`} f={f} />)}
        </ul>
      )}
      {justified.length > 0 && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setShowJust((v) => !v)}
            aria-expanded={showJust}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", !showJust && "-rotate-90")} />
            Justificados ({justified.length})
          </button>
          {showJust && (
            <ul className="max-h-48 overflow-y-auto rounded border border-border/60 divide-y divide-border/50 opacity-80">
              {justified.map((f, i) => <FindingRow key={`j-${i}-${f.detail}`} f={f} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
