/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Download, Loader2, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { reviewRateio, FINDING_TYPE_LABELS, type RateioFinding, type RateioFindingType } from "@/lib/reviewRateio";
import { exportRateioReviewPDF } from "@/lib/exportRateioReviewPDF";

export interface RateioReviewDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pieces: any[];
  kits: any[];
  kitPieces: any[];
  stores: any[];
  qtyMap: Record<string, number>;
  campaignName: string;
  clientName?: string;
}

const SEV_STYLE: Record<RateioFinding["severity"], string> = {
  alta: "bg-destructive text-destructive-foreground",
  media: "bg-amber-500/90 text-white",
  baixa: "bg-muted text-muted-foreground",
};
const SEV_LABEL = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;

export default function RateioReviewDialog(props: RateioReviewDialogProps) {
  const { open, onOpenChange, pieces, kits, kitPieces, stores, qtyMap, campaignName, clientName } = props;
  const [exporting, setExporting] = useState(false);

  const findings = useMemo(
    () => (open ? reviewRateio(pieces, kits, kitPieces, stores, qtyMap) : []),
    [open, pieces, kits, kitPieces, stores, qtyMap],
  );
  const types = Object.keys(FINDING_TYPE_LABELS) as RateioFindingType[];

  const handlePdf = async () => {
    setExporting(true);
    const id = toast.loading("Gerando PDF...");
    try {
      await exportRateioReviewPDF(findings, {
        campaignName,
        clientName,
        onProgress: (c, t) => toast.loading(`Baixando imagens ${c}/${t}...`, { id }),
      });
      toast.success("PDF gerado.", { id });
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível gerar o PDF.", { id });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" /> Revisar Rateio
          </DialogTitle>
          <DialogDescription>Análise automática da matriz atual. Nada é alterado.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Total: {findings.length}</Badge>
          {(["alta", "media", "baixa"] as const).map((s) => (
            <Badge key={s} className={cn("border-0", SEV_STYLE[s])}>
              {SEV_LABEL[s]}: {findings.filter((f) => f.severity === s).length}
            </Badge>
          ))}
          <Button size="sm" className="ml-auto gap-2" onClick={handlePdf} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Baixar PDF completo
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {findings.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">Nenhuma inconsistência encontrada 🎉</p>
          ) : (
            types.map((t) => {
              const list = findings.filter((f) => f.type === t);
              if (!list.length) return null;
              return (
                <section key={t} className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {FINDING_TYPE_LABELS[t]} ({list.length})
                  </h3>
                  {list.map((f, i) => (
                    <div key={`${t}-${i}-${f.detail}`} className="flex gap-3 rounded-lg border bg-card p-3">
                      <div className="w-14 h-14 shrink-0 rounded border bg-muted flex items-center justify-center overflow-hidden">
                        {f.itemImage ? (
                          <img src={f.itemImage} alt={f.itemName ?? ""} loading="lazy" className="w-full h-full object-contain" />
                        ) : (
                          <ImageOff className="w-5 h-5 text-muted-foreground" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge className={cn("border-0 text-[10px]", SEV_STYLE[f.severity])}>{SEV_LABEL[f.severity]}</Badge>
                          <span className="text-sm font-medium">{f.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{f.detail}</p>
                        {(f.storesWith?.length || f.storesWithout?.length) ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                            {f.storesWith?.length ? (
                              <div><span className="font-semibold">Tem:</span> {f.storesWith.join(", ")}</div>
                            ) : null}
                            {f.storesWithout?.length ? (
                              <div><span className="font-semibold">Não tem:</span> {f.storesWithout.join(", ")}</div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </section>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
