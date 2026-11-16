import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { itemCodeLabel } from "@/lib/reviewRateio";
import type { StoreEditChange, StoreEditItem, StoreEditPieceWrite } from "@/lib/rateioStoreEdit";
import { editKey } from "@/lib/rateioStoreEdit";

export interface StoreRateioEditReviewProps {
  changes: StoreEditChange[];
  writes: StoreEditPieceWrite[];
  items: StoreEditItem[];
  /** Código/nome de qualquer peça (inclui as exclusivas de kit). */
  pieceLabel: (pieceId: string) => string;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: () => void;
}

const label = (code: StoreEditItem["code"], name: string) => [itemCodeLabel(code), name].filter(Boolean).join(" ");

/** Prévia antes de gravar: cada alteração e, nos kits, as peças componentes que mudam. */
export function StoreRateioEditReview({ changes, writes, items, pieceLabel, saving, error, onBack, onConfirm }: StoreRateioEditReviewProps) {
  const byKey = new Map(items.map((it) => [editKey(it.kind, it.id), it]));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-4 py-2">
        <p className="text-sm font-semibold">Confirmar alterações</p>
        <p className="text-[11px] text-muted-foreground">
          Serão gravadas {writes.length} célula(s) desta loja no rateio. Você pode desfazer no histórico.
        </p>
      </div>
      <ul
        className="min-h-0 flex-1 overflow-y-auto divide-y divide-border/50"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {changes.map((c) => {
          const it = byKey.get(editKey(c.kind, c.id));
          const comps = c.kind === "kit" ? writes.filter((w) => w.viaKits.includes(c.id)) : [];
          return (
            <li key={editKey(c.kind, c.id)} className="px-4 py-2 text-xs space-y-1">
              <p className="break-words">
                <span className="font-medium">{label(it?.code ?? null, it?.name ?? "")}</span>
                {": "}
                <span className="tabular-nums">{c.from} → <span className="font-semibold">{c.to}</span></span>
              </p>
              {comps.length ? (
                <ul className="ml-3 space-y-0.5 text-[11px] text-muted-foreground">
                  {comps.map((w) => (
                    <li key={w.pieceId} className="break-words">
                      {pieceLabel(w.pieceId)}: <span className="tabular-nums">{w.from} → {w.to}</span>
                      {w.sharedSum ? " (peça em mais de um kit: soma dos kits)" : ""}
                    </li>
                  ))}
                </ul>
              ) : c.kind === "kit" ? (
                <p className="ml-3 text-[11px] text-muted-foreground">Nenhuma peça do kit muda.</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {error ? <p className="border-t px-4 py-2 text-[11px] text-destructive">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-background px-4 py-2">
        <Button type="button" size="sm" variant="outline" onClick={onBack} disabled={saving}>Voltar</Button>
        <Button type="button" size="sm" onClick={onConfirm} disabled={saving || writes.length === 0}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
        </Button>
      </div>
    </div>
  );
}
