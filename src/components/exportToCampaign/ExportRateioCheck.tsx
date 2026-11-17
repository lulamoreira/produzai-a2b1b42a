import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { RateioCheck } from "@/lib/exportToCampaign";

export interface ExportRateioCheckProps {
  check: RateioCheck;
  /** Código de origem de cada peça (id da origem → código). */
  sourceCodeById: Map<string, number>;
  storeNameById: Map<string, string>;
}

const stopScroll = { onWheel: (e: React.WheelEvent) => e.stopPropagation(), onTouchMove: (e: React.TouchEvent) => e.stopPropagation() };
const fmt = (v: number | null) => (v === null ? "sem linha" : `${v} un.`);

/** Resultado da conferência do rateio relido do destino contra a origem. */
export function ExportRateioCheck({ check, sourceCodeById, storeNameById }: ExportRateioCheckProps) {
  if (check.identical) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-success/40 bg-success/10 p-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success mt-0.5" aria-hidden />
        <p className="text-xs text-foreground">
          Rateio conferido: idêntico à origem ({check.quantities} quantidades, {check.units} un.)
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 space-y-2">
      <p className="flex items-start gap-2 text-xs font-semibold text-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
        O rateio do destino ficou diferente da origem em {check.diffs.length} peça(s):
      </p>
      <ul {...stopScroll} className="max-h-48 overflow-y-auto overscroll-contain space-y-2 text-xs">
        {check.diffs.map((d) => (
          <li key={d.sourcePieceId} className="text-foreground">
            <p className="font-semibold">
              Cód. {sourceCodeById.get(d.sourcePieceId) ?? "?"} (origem): {d.sourceStores} lojas / {d.sourceUnits} un. na origem,{" "}
              {d.destStores} lojas / {d.destUnits} un. no destino
            </p>
            <ul className="ml-3 list-disc pl-3">
              {d.stores.map((st) => (
                <li key={st.storeId}>
                  {storeNameById.get(st.storeId) ?? "Loja"}: origem {fmt(st.expected)}, destino {fmt(st.actual)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
