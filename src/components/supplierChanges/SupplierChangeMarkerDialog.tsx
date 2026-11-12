import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Flag, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useSupplierChangeMarkerMutations } from "@/hooks/useSupplierChangeMarkers";
import {
  SUPPLIER_CHANGE_ASPECTS,
  aspectLabel,
  type ResolvedSupplierChange,
  type SupplierChangeAspect,
  type SupplierChangeKind,
} from "@/lib/supplierChangeMarkers";

export interface SupplierChangeTarget {
  kind: SupplierChangeKind;
  id: string;
  code: number;
  name: string;
}

export interface SupplierChangeMarkerDialogProps {
  campaignId: string;
  target: SupplierChangeTarget | null;
  existing: ResolvedSupplierChange | null;
  onOpenChange: (open: boolean) => void;
}

/** Marks one piece/kit as new or changed for the supplier, with what changed and an optional note. */
export function SupplierChangeMarkerDialog({ campaignId, target, existing, onOpenChange }: SupplierChangeMarkerDialogProps) {
  const { saveItem, remove } = useSupplierChangeMarkerMutations(campaignId);
  const [changeType, setChangeType] = useState<"new" | "changed">("changed");
  const [aspects, setAspects] = useState<SupplierChangeAspect[]>([]);
  const [note, setNote] = useState("");

  // Reset the form whenever a different item is opened.
  useEffect(() => {
    if (!target) return;
    setChangeType(existing?.change_type === "new" ? "new" : "changed");
    setAspects(existing?.aspects ?? []);
    setNote(existing?.note ?? "");
  }, [target, existing]);

  if (!target) return null;
  const available = SUPPLIER_CHANGE_ASPECTS.filter((a) => a !== "components" || target.kind === "kit");
  const busy = saveItem.isPending || remove.isPending;
  const canSave = changeType === "new" || aspects.length > 0;

  const toggleAspect = (a: SupplierChangeAspect, on: boolean) =>
    setAspects((prev) => (on ? [...prev, a] : prev.filter((x) => x !== a)));

  const handleSave = async () => {
    try {
      await saveItem.mutateAsync({
        campaignId, target: { kind: target.kind, id: target.id }, changeType, aspects, note,
        existingId: existing?.id ?? null,
      });
      toast.success("Sinalização salva. O fornecedor verá no portal.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  };

  const handleRemove = async () => {
    if (!existing) return;
    try {
      await remove.mutateAsync(existing.id);
      toast.success("Sinalização retirada.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível retirar.");
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-warning" aria-hidden /> Sinalizar ao fornecedor
          </DialogTitle>
          <DialogDescription>
            {target.kind === "kit" ? "Kit" : "Peça"} #{target.code} — {target.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Em relação à planilha que ele orçou, este item é:</Label>
            <RadioGroup value={changeType} onValueChange={(v) => setChangeType(v as "new" | "changed")} className="grid grid-cols-2 gap-2">
              <Label htmlFor="scm-changed" className="flex items-center gap-2 rounded-md border border-border p-3 cursor-pointer">
                <RadioGroupItem value="changed" id="scm-changed" /> Alterado
              </Label>
              <Label htmlFor="scm-new" className="flex items-center gap-2 rounded-md border border-border p-3 cursor-pointer">
                <RadioGroupItem value="new" id="scm-new" /> Novo
              </Label>
            </RadioGroup>
          </div>

          {changeType === "changed" && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">O que mudou?</legend>
              {available.map((a) => (
                <Label key={a} className="flex items-center gap-2 font-normal cursor-pointer">
                  <Checkbox checked={aspects.includes(a)} onCheckedChange={(v) => toggleAspect(a, v === true)} />
                  <span className="first-letter:uppercase">{aspectLabel(a)}</span>
                </Label>
              ))}
            </fieldset>
          )}

          <div className="space-y-2">
            <Label htmlFor="scm-note">Observação para o fornecedor (opcional)</Label>
            <Textarea
              id="scm-note"
              value={note}
              maxLength={500}
              rows={3}
              placeholder="Ex.: altura passou de 1,20 m para 1,50 m"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          {existing && (
            <Button variant="ghost" className="sm:mr-auto text-destructive" onClick={handleRemove} disabled={busy}>
              Retirar sinalização
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={handleSave} disabled={busy || !canSave}>
            {saveItem.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
