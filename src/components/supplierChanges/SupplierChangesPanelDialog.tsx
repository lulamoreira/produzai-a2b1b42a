import { useMemo } from "react";
import { Flag, Pencil, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupplierChangeMarkerMutations } from "@/hooks/useSupplierChangeMarkers";
import {
  describeSupplierChange,
  formatSupplierChangeCounts,
  summarizeSupplierChanges,
  type ResolvedSupplierChange,
  type SupplierChangeKind,
} from "@/lib/supplierChangeMarkers";
import { RemovedItemsSection } from "./RemovedItemsSection";

export interface SupplierChangesPanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  previousCampaignId: string;
  previousCampaignName: string;
  markers: ResolvedSupplierChange[];
  loading: boolean;
  current: { kind: SupplierChangeKind; code: number | null }[];
  onEdit: (marker: ResolvedSupplierChange) => void;
}

/** Overview of everything flagged to suppliers in this renegotiation. */
export function SupplierChangesPanelDialog({
  open, onOpenChange, campaignId, previousCampaignId, previousCampaignName, markers, loading, current, onEdit,
}: SupplierChangesPanelDialogProps) {
  const { remove } = useSupplierChangeMarkerMutations(campaignId);
  const summary = useMemo(() => summarizeSupplierChanges(markers), [markers]);
  const itemMarkers = useMemo(
    () => markers.filter((m) => m.change_type !== "removed").sort((a, b) => (a.code ?? 0) - (b.code ?? 0)),
    [markers],
  );
  const removedMarkers = useMemo(() => markers.filter((m) => m.change_type === "removed"), [markers]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-warning" aria-hidden /> Alterações para o fornecedor
          </DialogTitle>
          <DialogDescription>
            {summary.total > 0
              ? `O fornecedor verá: ${formatSupplierChangeCounts(summary)}.`
              : "Nada sinalizado ainda. Use o menu ⋮ de cada peça ou kit → “Sinalizar ao fornecedor”."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-2" aria-labelledby="flagged-items-title">
            <h4 id="flagged-items-title" className="text-sm font-semibold">Peças e kits sinalizados</h4>
            {loading && <Skeleton className="h-16 w-full" />}
            {!loading && itemMarkers.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Nenhuma peça ou kit sinalizado.</p>
            )}
            {itemMarkers.map((m) => (
              <div key={m.id} className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-2 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium break-words">{m.kind === "kit" ? "Kit" : "Peça"} #{m.code} — {m.name}</p>
                  <p className="text-xs text-muted-foreground">{describeSupplierChange(m)}</p>
                  {m.note && <p className="text-xs italic text-muted-foreground break-words">“{m.note}”</p>}
                </div>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onEdit(m)} aria-label={`Editar sinalização de #${m.code}`}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={remove.isPending} onClick={() => remove.mutate(m.id)} aria-label={`Retirar sinalização de #${m.code}`}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </section>

          <RemovedItemsSection
            campaignId={campaignId}
            previousCampaignId={previousCampaignId}
            previousCampaignName={previousCampaignName}
            current={current}
            removedMarkers={removedMarkers}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
