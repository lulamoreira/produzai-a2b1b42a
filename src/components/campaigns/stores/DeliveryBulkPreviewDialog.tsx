import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DELIVERY_LABELS, type DeliveryChangeRow, type DeliveryType } from "@/lib/deliveryType";
import { DeliveryTypeBadge } from "./DeliveryTypeBadge";

export interface DeliveryBulkPreviewDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** null = voltar ao padrão. */
  target: DeliveryType | null;
  rows: DeliveryChangeRow[];
  /** Lojas selecionadas que não mudam (já estão assim). */
  unchangedCount: number;
  saving: boolean;
  onConfirm: () => void;
}

/** Prévia nominal "de → para" antes de gravar o ajuste em lote nesta campanha. */
export function DeliveryBulkPreviewDialog({ open, onOpenChange, target, rows, unchangedCount, saving, onConfirm }: DeliveryBulkPreviewDialogProps) {
  const targetLabel = target ? DELIVERY_LABELS[target].label : "Padrão de cada loja";
  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Logística nesta campanha</DialogTitle>
          <DialogDescription>
            Para: <strong>{targetLabel}</strong>. Vale só nesta campanha — o cadastro das lojas e as outras campanhas não mudam.
          </DialogDescription>
        </DialogHeader>
        {unchangedCount > 0 && (
          <p className="text-xs text-muted-foreground">{unchangedCount} loja(s) selecionada(s) já estão assim e ficam de fora.</p>
        )}
        <ul
          className="max-h-[50vh] overflow-y-auto divide-y divide-border rounded-md border"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          aria-label="Lojas afetadas"
        >
          {rows.map((r) => (
            <li key={r.storeId} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span translate="no" className="text-sm font-medium break-words">{r.name}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                <DeliveryTypeBadge type={r.from} storeDefault={r.from} isOverride={r.fromOverride !== null} />
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-label="para" />
                <DeliveryTypeBadge type={r.to} storeDefault={r.to} isOverride={r.toOverride !== null} />
              </span>
            </li>
          ))}
          {rows.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">Nenhuma loja muda.</li>}
        </ul>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Voltar</Button>
          <Button onClick={onConfirm} disabled={saving || rows.length === 0}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Aplicar para {rows.length} {rows.length === 1 ? "loja" : "lojas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
