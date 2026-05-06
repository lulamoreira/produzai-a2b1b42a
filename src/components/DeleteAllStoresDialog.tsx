import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  storeCount: number;
  onConfirm: () => Promise<void> | void;
  isDeleting?: boolean;
  progress?: { current: number; total: number };
}

const REQUIRED_PHRASE = "EXCLUIR TODAS AS LOJAS";

export default function DeleteAllStoresDialog({
  open, onOpenChange, clientName, storeCount, onConfirm, isDeleting, progress,
}: Props) {
  const [step, setStep] = useState(1);
  const [confirmName, setConfirmName] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [ack1, setAck1] = useState(false);
  const [ack2, setAck2] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(1); setConfirmName(""); setConfirmPhrase(""); setAck1(false); setAck2(false);
    }
  }, [open]);

  const canStep2 = ack1 && ack2;
  const canDelete = confirmName.trim() === clientName.trim()
    && confirmPhrase.trim().toUpperCase() === REQUIRED_PHRASE
    && !isDeleting;

  const pct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !isDeleting && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-5 h-5" />
            Excluir TODAS as lojas de "{clientName}"
          </DialogTitle>
          <DialogDescription>
            Esta é uma ação <strong>destrutiva e permanente</strong>. {storeCount} loja(s) e
            todos os dados vinculados (rateio, ocorrências, agendamentos, fotos, contatos…)
            serão removidos definitivamente.
          </DialogDescription>
        </DialogHeader>

        {isDeleting ? (
          <div className="py-6 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Excluindo lojas… ({progress?.current ?? 0}/{progress?.total ?? storeCount})
            </div>
            <Progress value={pct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Não feche esta janela até a conclusão.
            </p>
          </div>
        ) : step === 1 ? (
          <div className="space-y-3 py-2">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-start gap-2 text-xs">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <span>Esta ação <strong>não pode ser desfeita</strong>.</span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <span>Todos os dados de campanhas vinculados às lojas serão apagados em cascata.</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-xs cursor-pointer">
                <Checkbox checked={ack1} onCheckedChange={(v) => setAck1(!!v)} />
                <span>Entendo que <strong>{storeCount}</strong> loja(s) serão excluídas permanentemente.</span>
              </label>
              <label className="flex items-start gap-2 text-xs cursor-pointer">
                <Checkbox checked={ack2} onCheckedChange={(v) => setAck2(!!v)} />
                <span>Entendo que esta ação <strong>não pode ser revertida</strong> e que dados de campanhas serão perdidos.</span>
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="confirm-client" className="text-xs">
                Digite o nome do cliente: <strong>{clientName}</strong>
              </Label>
              <Input
                id="confirm-client"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={clientName}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-phrase" className="text-xs">
                Digite exatamente: <strong>{REQUIRED_PHRASE}</strong>
              </Label>
              <Input
                id="confirm-phrase"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder={REQUIRED_PHRASE}
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {!isDeleting && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            {step === 1 ? (
              <Button variant="destructive" disabled={!canStep2} onClick={() => setStep(2)}>
                Continuar
              </Button>
            ) : (
              <Button variant="destructive" disabled={!canDelete} onClick={() => onConfirm()}>
                Excluir definitivamente
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
