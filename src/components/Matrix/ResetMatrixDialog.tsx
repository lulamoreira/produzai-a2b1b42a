import { useState } from "react";
import { AlertTriangle } from "lucide-react";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignName: string;
  totalEntries: number;
  onConfirm: () => Promise<void> | void;
}

export function ResetMatrixDialog({
  open,
  onOpenChange,
  campaignName,
  totalEntries,
  onConfirm,
}: Props) {
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const matches =
    confirmText.trim().localeCompare(campaignName.trim(), undefined, {
      sensitivity: "base",
    }) === 0;

  const handleClose = (next: boolean) => {
    if (submitting) return;
    if (!next) setConfirmText("");
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    if (!matches || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
      setConfirmText("");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Zerar planilha do Rateio
          </DialogTitle>
          <DialogDescription className="space-y-2 pt-2">
            <span className="block">
              Esta ação <strong>apaga todas as quantidades</strong> atribuídas
              em todas as lojas da campanha. As peças e kits cadastrados são
              mantidos — apenas os valores do rateio serão removidos.
            </span>
            <span className="block">
              <strong>Esta ação não pode ser desfeita.</strong>{" "}
              {totalEntries > 0 && (
                <>
                  Serão removidos <strong>{totalEntries}</strong> registro(s)
                  de quantidade.
                </>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="reset-matrix-confirm" className="text-xs">
            Para confirmar, digite o nome da campanha:{" "}
            <span className="font-semibold text-foreground">
              {campaignName}
            </span>
          </Label>
          <Input
            id="reset-matrix-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={campaignName}
            autoComplete="off"
            disabled={submitting}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!matches || submitting}
          >
            {submitting ? "Zerando..." : "Zerar planilha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
