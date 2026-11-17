import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import type { ExportRunResult } from "@/lib/exportToCampaignRun";

export interface ExportResultViewProps {
  result: ExportRunResult;
}

const stopScroll = { onWheel: (e: React.WheelEvent) => e.stopPropagation(), onTouchMove: (e: React.TouchEvent) => e.stopPropagation() };

/** Resultado: "Cód. origem → Cód. destino" de cada item e aviso de imagens compartilhadas. */
export function ExportResultView({ result }: ExportResultViewProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-success/40 bg-success/10 p-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
        <p className="text-sm text-foreground">
          {result.itemCount} item(ns) exportados para <strong>{result.campaignName}</strong>
          {result.createdCampaign ? " (campanha nova)" : ""}.
        </p>
      </div>
      {result.sharedImages > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" aria-hidden />
          <p className="text-xs text-foreground">{result.sharedImages} imagem(ns) ficaram compartilhadas com a origem.</p>
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1">Códigos (origem → destino)</p>
        <ul {...stopScroll} className="max-h-56 overflow-y-auto overscroll-contain rounded-md border border-border divide-y divide-border">
          {result.codeRows.map((r) => (
            <li key={`${r.kind}-${r.destCode}`} className="flex items-center gap-2 px-2 py-1.5 text-xs">
              <span className="shrink-0 font-semibold text-muted-foreground w-14">{r.kind === "kit" ? "Kit" : r.kitOnly ? "Peça kit" : "Peça"}</span>
              <span className="shrink-0 font-bold text-foreground">Cód. {r.sourceCode}</span>
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              <span className="shrink-0 font-bold text-primary">Cód. {r.destCode}</span>
              <span className="truncate text-foreground min-w-0">{r.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
