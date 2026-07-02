import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchVigenteRateio,
  useCreateAdjustment,
} from "@/hooks/useAdjustments";

interface StartAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  pieces: any[];
  kits: any[];
  kitPieces: any[];
  winnerSupplierId?: string | null;
  /** Called after the adjustment is successfully created + activated. */
  onCreated?: (adjustment: any) => void;
}

/**
 * Unified "start adjustment" flow — freezes the current live rateio (original
 * or negotiation) and activates the new adjustment immediately. Reused from
 * RateioTabV2 and BudgetTab so both entry points behave identically.
 */
export default function StartAdjustmentDialog({
  open,
  onOpenChange,
  campaignId,
  pieces,
  kits,
  kitPieces,
  winnerSupplierId,
  onCreated,
}: StartAdjustmentDialogProps) {
  const queryClient = useQueryClient();
  const createAdjustment = useCreateAdjustment();

  const todayLabel = useMemo(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }, []);

  const [name, setName] = useState(`Ajuste - ${todayLabel}`);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(`Ajuste - ${todayLabel}`);
      setNotes("");
    }
  }, [open, todayLabel]);

  const handleConfirm = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Informe um nome para o ajuste.");
      return;
    }
    setBusy(true);
    const tId = "start-adjustment";
    toast.loading("Congelando rateio vigente e criando ajuste...", { id: tId });
    try {
      const vigente = await fetchVigenteRateio(campaignId, winnerSupplierId ?? null);
      const created = await createAdjustment.mutateAsync({
        campaignId,
        name: trimmed,
        notes: notes.trim() || undefined,
        pieces,
        kits,
        kitPieces,
        storePieces: [],
        frozenStorePieces: vigente.rows,
        syncedWith: vigente.source,
        activateImmediately: true,
      });
      const sourceLabel =
        vigente.source === "negotiation" ? "rateio da negociação" : "rateio original";
      toast.success(
        `Ajuste "${trimmed}" criado e ativado — congelado a partir do ${sourceLabel}.`,
        { id: tId },
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["active_adjustment", campaignId] }),
        queryClient.invalidateQueries({ queryKey: ["campaign_adjustments", campaignId] }),
      ]);
      onOpenChange(false);
      onCreated?.(created);
    } catch (e: any) {
      toast.error("Falha ao criar ajuste: " + (e?.message || "erro desconhecido"), {
        id: tId,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar Ajuste</DialogTitle>
          <DialogDescription>
            O rateio atual (lojas, peças, kits e quantidades) será congelado como
            está, e o ajuste passará a ser a versão vigente do rateio.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="start-adj-name" className="text-xs">
              Nome do ajuste
            </Label>
            <Input
              id="start-adj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start-adj-notes" className="text-xs">
              Observações (opcional)
            </Label>
            <Textarea
              id="start-adj-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={busy}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={busy}>
            {busy ? "Criando..." : "Criar ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
