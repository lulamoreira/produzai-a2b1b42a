import React, { useState } from "react";
import { Loader2, Send, X, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { parseRecipients } from "@/lib/emailRecipients";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  to: string;
  cc: string;
  subject: string;
  html: string;
  sending: boolean;
  /** Send to the real recipients and persist the request as submitted. */
  onConfirm: () => void;
  /** Send a test copy to a single address. MUST NOT persist anything. */
  onSendTest: (testEmail: string) => Promise<void>;
}

export default function AdjustmentQuotePreviewDialog({
  open, onOpenChange, to, cc, subject, html, sending, onConfirm, onSendTest,
}: Props) {
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    const [addr] = parseRecipients(testEmail);
    if (!addr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      toast.error("Informe um e-mail válido para o teste.");
      return;
    }
    setTesting(true);
    try {
      await onSendTest(addr);
    } finally {
      setTesting(false);
    }
  };

  const busy = sending || testing;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pré-visualização do reorçamento</DialogTitle>
          <DialogDescription>
            Confira exatamente como o e-mail chegará ao fornecedor antes de enviar.
            Você pode disparar uma cópia de teste para um e-mail seu — testes não
            marcam o reorçamento como solicitado.
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
            title="Pré-visualização do reorçamento"
            srcDoc={html}
            sandbox=""
            className="w-full h-[440px] border-0"
          />
        </div>

        <div className="border rounded-md p-3 space-y-2 bg-amber-50/50 dark:bg-amber-950/10">
          <Label htmlFor="adj-test-email" className="text-xs font-medium">
            Enviar uma cópia de teste para
          </Label>
          <div className="flex gap-2">
            <Input
              id="adj-test-email"
              type="email"
              placeholder="seu-email@empresa.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              disabled={busy}
            />
            <Button variant="secondary" onClick={handleTest} disabled={busy || !testEmail.trim()}>
              {testing ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando teste...</>
              ) : (
                <><FlaskConical className="w-4 h-4 mr-1" /> Enviar teste</>
              )}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            O teste não notifica o fornecedor e não marca o reorçamento como solicitado.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            <X className="w-4 h-4 mr-1" /> Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {sending ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando...</>
            ) : (
              <><Send className="w-4 h-4 mr-1" /> Confirmar e enviar ao fornecedor</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
