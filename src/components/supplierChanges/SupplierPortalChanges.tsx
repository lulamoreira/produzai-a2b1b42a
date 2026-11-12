import { Flag, MinusCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  changeTypeLabel,
  describeSupplierChange,
  formatSupplierChangeCounts,
  summarizeSupplierChanges,
  type ResolvedSupplierChange,
  type SupplierChangeLang,
} from "@/lib/supplierChangeMarkers";

export interface SupplierPortalChangesBannerProps {
  changes: ResolvedSupplierChange[];
  lang: SupplierChangeLang;
  onlyChanges: boolean;
  onOnlyChangesChange: (value: boolean) => void;
}

/** Notice at the top of the supplier matrix: counts, removed items and the "only changes" filter. */
export function SupplierPortalChangesBanner({ changes, lang, onlyChanges, onOnlyChangesChange }: SupplierPortalChangesBannerProps) {
  if (changes.length === 0) return null;
  const summary = summarizeSupplierChanges(changes);
  const removed = changes.filter((c) => c.change_type === "removed");
  const es = lang === "es";
  return (
    <div className="p-4 border-b border-warning/40 bg-warning/10 space-y-3" role="status">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Flag className="w-4 h-4 mt-0.5 text-warning shrink-0" aria-hidden />
          <p className="text-sm text-foreground">
            <strong>{es ? "Esta versión tiene cambios" : "Esta versão tem alterações"}</strong>{" "}
            {es ? "respecto a la planilla que usted cotizó:" : "em relação à planilha que você orçou:"}{" "}
            {formatSupplierChangeCounts(summary, lang)}.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch id="only-changes" checked={onlyChanges} onCheckedChange={onOnlyChangesChange} />
          <Label htmlFor="only-changes" className="text-sm cursor-pointer">{es ? "Solo cambios" : "Só alterações"}</Label>
        </div>
      </div>
      {removed.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">{es ? "Ítems eliminados (no cotizar):" : "Itens removidos (não precisa cotar):"}</p>
          <ul className="space-y-1">
            {removed.map((r) => (
              <li key={r.id} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <MinusCircle className="w-3.5 h-3.5 mt-0.5 text-destructive shrink-0" aria-hidden />
                <span className="break-words">
                  {r.kind === "kit" ? "Kit" : es ? "Pieza" : "Peça"} #{r.code} — {r.name}
                  {r.note ? ` · ${r.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Inline badge + "what changed" + note shown under a piece or kit name. */
export function SupplierPortalChangeInline({ change, lang }: { change?: ResolvedSupplierChange; lang: SupplierChangeLang }) {
  if (!change) return null;
  const isNew = change.change_type === "new";
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase border ${isNew ? "bg-info/10 text-info border-info/30" : "bg-warning/15 text-foreground border-warning/40"}`}>
        <Flag className="w-3 h-3" aria-hidden /> {changeTypeLabel(change.change_type, lang)}
      </span>
      {!isNew && (
        <span className="text-[11px] text-muted-foreground">{describeSupplierChange(change, lang).replace(/^[^:]+:\s*/, "")}</span>
      )}
      {change.note && <span className="text-[11px] italic text-muted-foreground break-words">“{change.note}”</span>}
    </div>
  );
}
