/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { AlertCircle, ChevronDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StoreNoteRow } from "@/lib/storeNotes";
import { StoreNameLink, type StoreLookup } from "@/components/StoreNameLink";

export interface RateioStoreNotesSectionProps {
  /** Todas as lojas da campanha com nota (para o total e para decidir se a seção aparece). */
  total: number;
  /** Linhas já filtradas pela busca da revisão. */
  rows: StoreNoteRow<any>[];
  /** Apontamentos ativos por loja (chave: id da loja). */
  counts: Map<string, number>;
  lookup: StoreLookup;
  onOpenStore: (store: any) => void;
  /** Preenche a busca da revisão com o nome da loja. */
  onSearchStore: (label: string) => void;
  /** Só para quem pode editar o rateio: abre a ficha em edição. */
  onEditStore?: (store: any) => void;
}

const apont = (n: number) => `${n} ${n === 1 ? "apontamento" : "apontamentos"}`;

/** "Notas das lojas (pontos de atenção)": observações das lojas, somente leitura. */
export function RateioStoreNotesSection({ total, rows, counts, lookup, onOpenStore, onSearchStore, onEditStore }: RateioStoreNotesSectionProps) {
  const [open, setOpen] = useState(true);
  if (total === 0) return null;
  const countLabel = rows.length === total ? String(total) : `${rows.length} de ${total}`;
  return (
    <section className="rounded-lg border border-warning/40 bg-warning/5" aria-label="Notas das lojas">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-foreground rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", !open && "-rotate-90")} aria-hidden />
        <AlertCircle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
        <span className="min-w-0 break-words">Notas das lojas (pontos de atenção) ({countLabel})</span>
      </button>
      {open ? (
        rows.length === 0 ? (
          <p className="px-3 pb-3 text-xs text-muted-foreground">Nenhuma nota com essa busca.</p>
        ) : (
          <ul
            className="max-h-64 overflow-y-auto divide-y divide-warning/20 border-t border-warning/30"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {rows.map((r) => {
              const n = counts.get(r.store.id) ?? 0;
              return (
                <li key={r.store.id} className="space-y-1 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <StoreNameLink name={r.label} storeId={r.store.id} lookup={lookup} onOpen={onOpenStore} className="text-sm font-medium" />
                    {r.meta ? <span className="text-[11px] text-muted-foreground">{r.meta}</span> : null}
                    <div className="ml-auto flex flex-wrap items-center gap-1.5">
                      {n > 0 ? (
                        <button
                          type="button"
                          onClick={() => onSearchStore(r.label)}
                          title="Mostrar só os apontamentos desta loja"
                          className="rounded-full border border-warning/50 bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-warning/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {apont(n)}
                        </button>
                      ) : null}
                      {onEditStore ? (
                        <Button type="button" size="sm" variant="outline" className="h-6 gap-1 px-2 text-[11px]" onClick={() => onEditStore(r.store)}>
                          <Pencil className="h-3 w-3" aria-hidden /> Abrir rateio
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-xs text-foreground">{r.note}</p>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </section>
  );
}
