/* eslint-disable @typescript-eslint/no-explicit-any */
import { CheckCircle2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoreNameLink, type StoreLookup } from "@/components/StoreNameLink";

export interface RateioFixStoreRowProps {
  name: string;
  storeId?: string;
  store: any | null;
  qty: number | null;
  unit: string;
  corrected: boolean;
  lookup: StoreLookup;
  onOpenStore: (store: any) => void;
  onEditStore: (store: any) => void;
}

/** Linha da janela "Corrigir": loja (link), quantidade atual, vitrines e "Abrir rateio". */
export function RateioFixStoreRow({ name, storeId, store, qty, unit, corrected, lookup, onOpenStore, onEditStore }: RateioFixStoreRowProps) {
  const showcase = store?.showcase_count;
  const hasShowcase = showcase !== null && showcase !== undefined && String(showcase).trim() !== "";
  const info = [
    qty !== null ? `${qty} ${unit}` : null,
    hasShowcase ? `${showcase} ${Number(showcase) === 1 ? "vitrine" : "vitrines"}` : null,
  ].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-2 text-xs">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5 break-words">
          <StoreNameLink name={name} storeId={storeId} lookup={lookup} onOpen={onOpenStore} showNote className="text-xs font-medium" />
          {corrected ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
              <CheckCircle2 className="h-3 w-3" aria-hidden /> corrigida
            </span>
          ) : null}
        </div>
        {info ? <p className="text-[11px] text-muted-foreground tabular-nums">{info}</p> : null}
      </div>
      {store ? (
        <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 gap-1 px-2 text-[11px]" onClick={() => onEditStore(store)}>
          <Pencil className="h-3 w-3" aria-hidden /> Abrir rateio
        </Button>
      ) : null}
    </li>
  );
}
