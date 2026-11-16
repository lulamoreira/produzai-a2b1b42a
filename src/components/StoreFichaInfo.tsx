/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { storeCampaignItems, storeCustomFields } from "@/lib/storeFicha";
import type { RateioFinding } from "@/lib/reviewRateio";
import { StoreFichaFindings } from "@/components/StoreFichaFindings";
import type { StoreLookup } from "@/components/StoreNameLink";

const filled = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";

function Field({ label, value, mono }: { label: string; value: unknown; mono?: boolean }) {
  if (!filled(value)) return null;
  return (
    <div className="space-y-0.5 min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block break-words">{label}</span>
      <p className={mono ? "text-xs font-medium font-mono break-words" : "text-xs font-medium break-words leading-tight"}>{String(value)}</p>
    </div>
  );
}

export interface StoreFichaInfoProps {
  store: any;
  pieces: any[];
  kits: any[];
  kitPieces: any[];
  qtyMap: Record<string, number>;
  customFieldLabels?: { index: number; label: string }[];
  activeFindings?: RateioFinding[];
  justifiedFindings?: RateioFinding[];
  storeLookup?: StoreLookup;
  onOpenStore?: (store: any) => void;
  /** Presente só para quem pode editar o rateio. */
  onEdit?: () => void;
}

/** Corpo somente leitura da ficha (dados, campos, apontamentos e itens desta campanha). */
export function StoreFichaInfo({ store, pieces, kits, kitPieces, qtyMap, customFieldLabels, activeFindings, justifiedFindings, storeLookup, onOpenStore, onEdit }: StoreFichaInfoProps) {
  const customFields = useMemo(() => storeCustomFields(store, customFieldLabels), [store, customFieldLabels]);
  const items = useMemo(() => storeCampaignItems(store.id, pieces, kits, kitPieces, qtyMap), [store, pieces, kits, kitPieces, qtyMap]);
  const cityUf = [store.city, store.state].filter(filled).join(" / ");
  return (
    <div className="px-4 py-3 space-y-3 overflow-y-auto" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label="Código" value={store.store_code || "—"} />
        <Field label="Cidade/UF" value={cityUf || "—"} />
        <Field label="CNPJ" value={store.cnpj} mono />
        <Field label="Modelo" value={store.store_model} />
        <Field label="Era" value={store.era} />
        <Field label="Vitrines" value={store.showcase_count} />
      </div>

      {customFields.length > 0 && (
        <div className="pt-2 border-t border-border/60 grid grid-cols-2 gap-x-4 gap-y-3">
          {customFields.map((f) => <Field key={f.label} label={f.label} value={f.value} />)}
        </div>
      )}

      {activeFindings ? (
        <StoreFichaFindings
          active={activeFindings}
          justified={justifiedFindings ?? []}
          currentStoreId={store.id}
          lookup={storeLookup}
          onOpenStore={onOpenStore}
        />
      ) : null}

      <div className="pt-2 border-t border-border/60 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nesta campanha</span>
          <div className="flex items-center gap-2">
            {onEdit ? (
              <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onEdit}>
                <Pencil className="h-3 w-3" /> Editar rateio
              </Button>
            ) : null}
            <Badge variant="outline" className="text-[10px]">{items.length} item(ns)</Badge>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">A loja não recebe nenhum item nesta campanha.</p>
        ) : (
          <ul className="max-h-56 overflow-y-auto rounded border border-border/60 divide-y divide-border/50">
            {items.map((it) => (
              <li key={`${it.kind}-${it.id}`} className="flex items-center justify-between gap-2 px-2 py-1 text-xs">
                <span className="min-w-0 truncate">
                  {it.code !== null && it.code !== "" ? <span className="text-muted-foreground mr-1">#{it.code}</span> : null}
                  {it.name}
                  {it.kind === "kit" ? <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 py-0">Kit</Badge> : null}
                </span>
                <span className="font-semibold shrink-0">{it.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
