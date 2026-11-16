import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { RateioFinding } from "@/lib/reviewRateio";
import { suggestQuantityFor, type FillItemKind, type FillTarget } from "@/lib/rateioFillMissing";

export interface FillMissingRequest {
  itemKind: FillItemKind;
  itemId: string;
  /** Uma entrada por loja marcada, com a quantidade dela. */
  targets: FillTarget[];
}

export interface RateioFillMissingDialogProps {
  finding: RateioFinding | null;
  onOpenChange: (open: boolean) => void;
  /** Grava pelo caminho do Rateio. Devolve true quando gravou; erros já são avisados por quem grava. */
  onConfirm: (req: FillMissingRequest) => Promise<boolean>;
}

interface Row {
  id: string;
  name: string;
  suggested: number;
  reason: string;
}

const vitrines = (n: number) => `${n} ${n === 1 ? "vitrine" : "vitrines"}`;

/** Prévia de "Colocar nas que não têm": quantidade sugerida POR LOJA; nada é gravado até CONFIRMAR. */
export function RateioFillMissingDialog({ finding, onOpenChange, onConfirm }: RateioFillMissingDialogProps) {
  const isKit = finding?.itemKind === "kit";
  const unit = isKit ? "kit(s)" : "un.";

  const rows = useMemo<Row[]>(() => {
    const withs = finding?.storesWithQty ?? [];
    return (finding?.storesWithoutIds ?? []).map((s) => {
      const sug = suggestQuantityFor(s.showcase, withs);
      const reason = sug.sameShowcase
        ? `lojas com ${vitrines(s.showcase)} recebem ${sug.quantity}`
        : `nenhuma loja com ${vitrines(s.showcase)} tem; usada a menor quantidade (${sug.quantity})`;
      return { id: s.id, name: s.name, suggested: sug.quantity, reason };
    });
  }, [finding]);

  const [qtyText, setQtyText] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Reinicia a prévia a cada apontamento aberto.
  useEffect(() => {
    setQtyText(Object.fromEntries(rows.map((r) => [r.id, r.suggested > 0 ? String(r.suggested) : ""])));
    setChecked(new Set(rows.map((r) => r.id)));
  }, [rows]);

  const qtyOf = (id: string) => Math.floor(Number(qtyText[id]));
  const isValid = (id: string) => Number.isFinite(qtyOf(id)) && qtyOf(id) >= 1;
  const marked = rows.filter((r) => checked.has(r.id));
  const allMarkedValid = marked.every((r) => isValid(r.id));
  const canConfirm = marked.length > 0 && allMarkedValid && !saving && !!finding?.itemId && !!finding?.itemKind;

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
        targets: marked.map((r) => ({ storeId: r.id, quantity: qtyOf(r.id) })),
      });
      if (ok) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!finding} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="max-w-lg w-[calc(100vw-1.5rem)] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug break-words">Colocar nas que não têm</DialogTitle>
          <DialogDescription className="break-words">
            {finding?.itemName} · modelo {finding?.storeModel}. Nada é gravado até você confirmar.
            {isKit ? " A quantidade é em kits; cada peça do kit recebe kits × peças por kit." : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
          <span className="font-semibold">Lojas que não têm ({checked.size}/{rows.length})</span>
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setChecked(new Set(rows.map((r) => r.id)))}>
              Marcar todas
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setChecked(new Set())}>
              Desmarcar todas
            </Button>
          </div>
        </div>

        <ul className="flex-1 min-h-0 overflow-y-auto rounded border divide-y">
          {rows.map((r) => {
            const on = checked.has(r.id);
            const invalid = on && !isValid(r.id);
            return (
              <li key={r.id} className="flex items-start gap-2 px-2 py-2 text-xs">
                <Checkbox id={`fill-${r.id}`} className="mt-1.5" checked={on} onCheckedChange={(v) => toggle(r.id, v === true)} />
                <div className="flex-1 min-w-0">
                  <Label htmlFor={`fill-${r.id}`} className="block break-words text-xs font-medium cursor-pointer">
                    {r.name}
                  </Label>
                  <span className="block text-[11px] text-muted-foreground break-words">{r.reason}</span>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    aria-label={`Quantidade para ${r.name}`}
                    aria-invalid={invalid}
                    disabled={!on}
                    value={qtyText[r.id] ?? ""}
                    onChange={(e) => setQtyText((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    className="h-8 w-16 px-2 text-xs tabular-nums"
                  />
                  <span className="text-[11px] text-muted-foreground w-9">{unit}</span>
                </div>
              </li>
            );
          })}
        </ul>

        {!allMarkedValid ? (
          <p className="text-[11px] text-destructive">Informe uma quantidade de pelo menos 1 em cada loja marcada.</p>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          Loja sem a peça costuma estar errada (a vitrine primária deve receber), mas confira. Se a ausência for intencional, use Justificar.
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
