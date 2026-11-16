import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { RateioFinding } from "@/lib/reviewRateio";
import { summarizeQuantities, type FillItemKind } from "@/lib/rateioFillMissing";

export interface FillMissingRequest {
  itemKind: FillItemKind;
  itemId: string;
  storeIds: string[];
  quantity: number;
}

export interface RateioFillMissingDialogProps {
  finding: RateioFinding | null;
  onOpenChange: (open: boolean) => void;
  /** Grava pelo caminho do Rateio. Devolve true quando gravou; erros já são avisados por quem grava. */
  onConfirm: (req: FillMissingRequest) => Promise<boolean>;
}

/** Prévia de "Colocar nas que não têm": nada é gravado até CONFIRMAR. */
export function RateioFillMissingDialog({ finding, onOpenChange, onConfirm }: RateioFillMissingDialogProps) {
  const without = useMemo(() => finding?.storesWithoutIds ?? [], [finding]);
  const suggested = useMemo(
    () => summarizeQuantities((finding?.storesWithQty ?? []).map((s) => s.qty)).mode,
    [finding],
  );
  const [qtyText, setQtyText] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Reinicia a prévia a cada apontamento aberto.
  useEffect(() => {
    if (!finding) return;
    setQtyText(suggested > 0 ? String(suggested) : "");
    setChecked(new Set(without.map((s) => s.id)));
  }, [finding, suggested, without]);

  const quantity = Math.floor(Number(qtyText));
  const validQty = Number.isFinite(quantity) && quantity > 0;
  const isKit = finding?.itemKind === "kit";
  const unit = isKit ? "kit(s)" : "un.";
  const canConfirm = validQty && checked.size > 0 && !saving && !!finding?.itemId && !!finding?.itemKind;

  const toggle = (id: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });

  const confirm = async () => {
    if (!canConfirm || !finding?.itemId || !finding.itemKind) return;
    setSaving(true);
    try {
      const ok = await onConfirm({
        itemKind: finding.itemKind,
        itemId: finding.itemId,
        storeIds: without.filter((s) => checked.has(s.id)).map((s) => s.id),
        quantity,
      });
      if (ok) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!finding} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug break-words">Colocar nas que não têm</DialogTitle>
          <DialogDescription className="break-words">
            {finding?.itemName} · modelo {finding?.storeModel}. Nada é gravado até você confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label htmlFor="fill-qty" className="text-xs">
            Quantidade por loja {isKit ? "(número de kits)" : ""}
          </Label>
          <Input
            id="fill-qty"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value)}
            className="w-32"
          />
          <p className="text-[11px] text-muted-foreground">
            Sugerida: {suggested} {unit} (a mais comum entre as lojas que têm).
            {isKit ? " Cada peça do kit recebe essa quantidade × as peças por kit." : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
          <span className="font-semibold">Lojas que não têm ({checked.size}/{without.length})</span>
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setChecked(new Set(without.map((s) => s.id)))}>
              Marcar todas
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setChecked(new Set())}>
              Desmarcar todas
            </Button>
          </div>
        </div>

        <ul className="flex-1 min-h-0 overflow-y-auto rounded border divide-y">
          {without.map((s) => {
            const on = checked.has(s.id);
            return (
              <li key={s.id} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                <Checkbox id={`fill-${s.id}`} checked={on} onCheckedChange={(v) => toggle(s.id, v === true)} />
                <Label htmlFor={`fill-${s.id}`} className="flex-1 min-w-0 break-words text-xs font-normal cursor-pointer">
                  {s.name}
                </Label>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {on && validQty ? `${quantity} ${unit}` : "—"}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="text-[11px] text-muted-foreground">
          Confira se a ausência não é intencional (ex.: outlet, modelo de vitrine). Se for, use Justificar.
        </p>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirm} disabled={!canConfirm}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar e corrigir o Rateio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
