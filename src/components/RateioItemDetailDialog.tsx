import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ImageOff } from "lucide-react";
import type { ItemDetail } from "@/lib/rateioItemDetail";

export interface RateioItemDetailDialogProps {
  detail: ItemDetail | null;
  onOpenChange: (open: boolean) => void;
}

const fmt = (n: number) => n.toLocaleString("pt-BR");

/** Detalhe somente leitura de uma peça/kit, aberto pela miniatura por cima da "Revisar Rateio". */
export function RateioItemDetailDialog({ detail, onOpenChange }: RateioItemDetailDialogProps) {
  return (
    <Dialog open={!!detail} onOpenChange={onOpenChange}>
      <DialogContent className="z-[60] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[85dvh]">
        {detail && (
          <>
            <DialogHeader className="bg-muted/40 px-4 py-3 border-b border-border text-left space-y-0.5">
              <div className="flex flex-wrap items-center gap-2 pr-6">
                {detail.code ? <span className="font-mono text-[11px] text-muted-foreground">Cód. {detail.code}</span> : null}
                {detail.kind === "kit" ? <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Kit</Badge> : null}
              </div>
              <DialogTitle className="text-sm font-semibold break-words pr-6">{detail.name || "Item sem nome"}</DialogTitle>
              <DialogDescription className="text-[11px] italic">Detalhe do item (somente leitura)</DialogDescription>
            </DialogHeader>

            <div className="px-4 py-3 space-y-3 overflow-y-auto">
              <div className="w-full aspect-[4/3] rounded border bg-muted flex items-center justify-center overflow-hidden">
                {detail.image ? (
                  <img src={detail.image} alt={detail.name} className="w-full h-full object-contain" />
                ) : (
                  <ImageOff className="w-8 h-8 text-muted-foreground" aria-label="Sem imagem" />
                )}
              </div>

              {detail.fields.length > 0 && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {detail.fields.map((f) => (
                    <div key={f.label} className="space-y-0.5 min-w-0">
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{f.label}</dt>
                      <dd className="text-xs font-medium break-words leading-tight">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <div className="pt-2 border-t border-border/60 grid grid-cols-2 gap-x-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                    {detail.kind === "piece" ? "Total na campanha" : "Kits na campanha"}
                  </span>
                  <p className="text-sm font-semibold tabular-nums">
                    {fmt(detail.totalQuantity)} {detail.kind === "piece" ? "un." : detail.totalQuantity === 1 ? "kit" : "kits"}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">Lojas que recebem</span>
                  <p className="text-sm font-semibold tabular-nums">{fmt(detail.storesReceiving)}</p>
                </div>
              </div>

              {detail.links.length > 0 && (
                <div className="pt-2 border-t border-border/60 space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                    {detail.kind === "piece" ? `Entra nos kits (${detail.links.length})` : `Peças do kit (${detail.links.length})`}
                  </span>
                  <ul className="max-h-48 overflow-y-auto rounded border border-border/60 divide-y divide-border/50">
                    {detail.links.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-2 px-2 py-1 text-xs">
                        <span className="min-w-0 break-words">
                          {l.code ? <span className="text-muted-foreground mr-1 font-mono">#{l.code}</span> : null}
                          {l.name}
                        </span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">{l.perKit} por kit</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
