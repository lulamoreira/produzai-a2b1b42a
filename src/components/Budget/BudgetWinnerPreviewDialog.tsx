import React from "react";
import { Loader2, Send, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface BudgetWinnerPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  to: string;
  cc: string;
  subject: string;
  html: string;
  sending: boolean;
  onConfirm: () => void;
  onEditRecipients: () => void;
}

export default function BudgetWinnerPreviewDialog({
  open, onOpenChange, to, cc, subject, html, sending, onConfirm, onEditRecipients,
}: BudgetWinnerPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pré-visualização do e-mail</DialogTitle>
          <DialogDescription>
            Confira o conteúdo e os destinatários antes de enviar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm border rounded-md p-3 bg-muted/30">
          <div className="grid grid-cols-[70px_1fr] gap-1">
            <span className="font-medium text-muted-foreground">Para:</span>
            <span className="break-all">{to || <em className="text-muted-foreground">não informado</em>}</span>
          </div>
          <div className="grid grid-cols-[70px_1fr] gap-1">
            <span className="font-medium text-muted-foreground">CC:</span>
            <span className="break-all">{cc || <em className="text-muted-foreground">Nenhum</em>}</span>
          </div>
          <div className="grid grid-cols-[70px_1fr] gap-1">
            <span className="font-medium text-muted-foreground">Assunto:</span>
            <span className="break-all">{subject}</span>
          </div>
        </div>

        <div className="flex-1 min-h-0 border rounded-md overflow-hidden bg-white">
          <iframe
            title="Pré-visualização do e-mail"
            srcDoc={html}
            sandbox=""
            className="w-full h-[500px] border-0"
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            <X className="w-4 h-4 mr-1" /> Cancelar
          </Button>
          <Button variant="secondary" onClick={onEditRecipients} disabled={sending}>
            <Pencil className="w-4 h-4 mr-1" /> Modificar destinatários
          </Button>
          <Button onClick={onConfirm} disabled={sending}>
            {sending ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando...</>
            ) : (
              <><Send className="w-4 h-4 mr-1" /> Confirmar e enviar</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
