/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, CopyPlus, ImageOff } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { itemCodeLabel, type RateioFinding } from "@/lib/reviewRateio";
import { itemQtyForStore, relatedStores, storeCorrected, type FixStoreRef } from "@/lib/rateioFixFinding";
import { resolveStore } from "@/lib/storeNotes";
import type { MatrixKitLink } from "@/lib/matrixImportPrefill";
import type { StoreLookup } from "@/components/StoreNameLink";
import { RateioFixStoreRow } from "@/components/RateioFixStoreRow";

export interface RateioFixFindingDialogProps {
  /** Apontamento como estava ao clicar em "TÁ ERRADO" (define as lojas listadas). */
  finding: RateioFinding | null;
  /** Versão atual após reanálise; null = resolvido. */
  current: RateioFinding | null;
  onOpenChange: (open: boolean) => void;
  lookup: StoreLookup;
  qtyMap: Record<string, number>;
  kitPieces: MatrixKitLink[];
  onOpenStore: (store: any) => void;
  /** Abre a ficha da loja em edição (destaca o item do apontamento quando houver). */
  onEditStore: (store: any, f: RateioFinding) => void;
  /** Presente quando "Colocar nas que não têm" vale para a versão atual. */
  onFill?: () => void;
}

/** Janela "Corrigir": lista as lojas do apontamento; nada é gravado aqui (só na ficha ou na prévia). */
export function RateioFixFindingDialog({ finding, current, onOpenChange, lookup, qtyMap, kitPieces, onOpenStore, onEditStore, onFill }: RateioFixFindingDialogProps) {
  const [showWith, setShowWith] = useState(false);
  const groups = useMemo(() => (finding ? relatedStores(finding) : null), [finding]);
  const resolved = !!finding && !current;
  const f = current ?? finding;
  const unit = finding?.itemKind === "kit" ? "kit(s)" : "un.";

  const renderList = (refs: FixStoreRef[]) => (
    <ul
      className="max-h-[40vh] overflow-y-auto rounded border divide-y"
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {refs.map((r) => {
        const store = resolveStore(lookup, r);
        return (
          <RateioFixStoreRow
            key={`${r.id ?? ""}-${r.name}`}
            name={r.name}
            storeId={r.id}
            store={store}
            qty={store ? itemQtyForStore(finding?.itemKind, finding?.itemId, store.id, qtyMap, kitPieces) : null}
            unit={unit}
            corrected={!!store && !!finding && storeCorrected(finding, current, store)}
            lookup={lookup}
            onOpenStore={onOpenStore}
            onEditStore={(s) => f && onEditStore(s, f)}
          />
        );
      })}
    </ul>
  );

  return (
    <Dialog open={!!finding} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-1.5rem)] max-h-[90vh] flex flex-col">
        {finding && f && groups ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-base leading-snug break-words pr-6">Corrigir: {finding.title}</DialogTitle>
              <DialogDescription className="break-words">
                Abra o rateio de cada loja para corrigir. Nada é gravado sem confirmar na ficha.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-2">
              <div className="w-12 h-12 shrink-0 rounded border bg-muted flex items-center justify-center overflow-hidden">
                {finding.itemImage ? (
                  <img src={finding.itemImage} alt={finding.itemName ?? ""} loading="lazy" className="w-full h-full object-contain" />
                ) : (
                  <ImageOff className="w-5 h-5 text-muted-foreground" aria-hidden />
                )}
              </div>
              <div className="min-w-0 text-sm">
                {itemCodeLabel(finding.itemCode) ? <span className="font-mono text-[11px] text-muted-foreground mr-1.5">{itemCodeLabel(finding.itemCode)}</span> : null}
                <span className="font-medium break-words">{finding.itemName ?? (finding.storeName ? `Loja ${finding.storeName}` : finding.title)}</span>
              </div>
            </div>

            {resolved ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center" role="status">
                <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
                <p className="text-sm font-semibold">Apontamento resolvido</p>
                <p className="text-xs text-muted-foreground">A revisão foi refeita e este apontamento não aparece mais.</p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
                <div className="space-y-1">
                  <p className="text-xs font-semibold">
                    {groups.split ? `Não têm (prováveis erradas) (${groups.primary.length})` : `Lojas (${groups.primary.length})`}
                  </p>
                  {renderList(groups.primary)}
                </div>
                {groups.split && groups.secondary.length > 0 ? (
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setShowWith((v) => !v)}
                      aria-expanded={showWith}
                      className="flex items-center gap-1 text-xs font-semibold rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !showWith && "-rotate-90")} aria-hidden />
                      Têm ({groups.secondary.length})
                    </button>
                    {showWith ? renderList(groups.secondary) : null}
                  </div>
                ) : null}
              </div>
            )}

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              {!resolved && onFill ? (
                <Button type="button" variant="outline" className="gap-1" onClick={onFill}>
                  <CopyPlus className="w-4 h-4" /> Colocar nas que não têm
                </Button>
              ) : null}
              <Button type="button" variant={resolved ? "default" : "outline"} onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
