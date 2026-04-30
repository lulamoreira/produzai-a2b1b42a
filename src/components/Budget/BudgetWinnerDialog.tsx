import React, { useEffect, useState } from "react";
import { Trophy, Loader2, X, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useBudgetTimeline } from "@/hooks/useBudgetTimeline";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/.+/i;

interface BudgetWinnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  agencyName: string;
  supplier: {
    id: string;
    company_name: string;
    contact_name: string | null;
    email: string;
  } | null;
}

export default function BudgetWinnerDialog({
  open, onOpenChange, campaignId, campaignName, agencyName, supplier,
}: BudgetWinnerDialogProps) {
  const { data: timelineEntries = [] } = useBudgetTimeline(campaignId);
  const [email, setEmail] = useState("");
  const [cc, setCc] = useState("");
  const [mockupUrl, setMockupUrl] = useState("");
  const [bookUrl, setBookUrl] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open && supplier) {
      setEmail(supplier.email || "");
      setCc("");
      setMockupUrl("");
      setBookUrl("");
    }
  }, [open, supplier]);

  const sendOnce = async (recipient: string, templateData: any) => {
    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "supplier-winner-notification",
        recipientEmail: recipient,
        idempotencyKey: `supplier-winner-${campaignId}-${supplier?.id}-${recipient}-${Date.now()}`,
        templateData,
      },
    });
    if (error) throw new Error(error.message || "Erro ao enviar e-mail");
  };

  const handleSend = async () => {
    if (!supplier) return;
    if (!EMAIL_REGEX.test(email.trim())) {
      toast.error("Informe um e-mail válido para o fornecedor.");
      return;
    }
    const ccEmail = cc.trim();
    if (ccEmail && !EMAIL_REGEX.test(ccEmail)) {
      toast.error("E-mail do CC é inválido.");
      return;
    }
    const mockup = mockupUrl.trim();
    if (!URL_REGEX.test(mockup)) {
      toast.error("Informe um link válido (começando com http:// ou https://).");
      return;
    }
    const book = bookUrl.trim();
    if (book && !URL_REGEX.test(book)) {
      toast.error("Link do book de mockup inválido (deve começar com http:// ou https://).");
      return;
    }

    setSending(true);
    const toastId = toast.loading("Enviando comunicado ao fornecedor vencedor...");

    try {
      const timeline = [...timelineEntries]
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((e) => ({
          date: format(new Date(e.entry_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR }),
          description: e.description,
        }));

      const templateData = {
        supplierName: supplier.company_name,
        contactName: supplier.contact_name || undefined,
        agencyName,
        campaignName,
        mockupUrl: mockup,
        bookUrl: book || undefined,
        timeline,
      };

      await sendOnce(email.trim(), templateData);
      if (ccEmail) {
        await sendOnce(ccEmail, templateData);
      }

      toast.dismiss(toastId);
      toast.success("Comunicado enviado com sucesso!");
      onOpenChange(false);
    } catch (e: any) {
      console.error("Send winner notification error:", e);
      toast.dismiss(toastId);
      toast.error(e?.message || "Erro ao enviar comunicado.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Declarar vencedor do certame
          </DialogTitle>
          <DialogDescription>
            {supplier
              ? <>Comunicar a <strong>{supplier.company_name}</strong> que venceu o certame, reenviando o cronograma da campanha e o link das peças fechadas do mockup.</>
              : "Selecione um fornecedor."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="winner-email">E-mail do fornecedor *</Label>
            <Input
              id="winner-email"
              type="email"
              placeholder="fornecedor@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="winner-cc">CC (opcional)</Label>
            <Input
              id="winner-cc"
              type="email"
              placeholder="copia@empresa.com"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="winner-mockup">Link das peças fechadas do mockup *</Label>
            <Input
              id="winner-mockup"
              type="url"
              placeholder="https://drive.google.com/..."
              value={mockupUrl}
              onChange={(e) => setMockupUrl(e.target.value)}
              disabled={sending}
            />
            <p className="text-[11px] text-muted-foreground">
              Cole aqui o link externo (Google Drive, WeTransfer, Dropbox, etc.) para o fornecedor baixar as peças.
            </p>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/40 p-3">
            <p className="text-xs font-medium text-foreground mb-1">
              Cronograma incluído no e-mail ({timelineEntries.length} {timelineEntries.length === 1 ? "etapa" : "etapas"})
            </p>
            {timelineEntries.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">
                Nenhum cronograma cadastrado nesta campanha.
              </p>
            ) : (
              <ul className="text-[11px] text-muted-foreground space-y-0.5">
                {[...timelineEntries]
                  .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
                  .slice(0, 5)
                  .map((e) => (
                    <li key={e.id}>
                      <span className="font-medium text-foreground">
                        {format(new Date(e.entry_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                      </span>{" "}
                      — {e.description}
                    </li>
                  ))}
                {timelineEntries.length > 5 && (
                  <li className="italic">+ {timelineEntries.length - 5} outras etapas...</li>
                )}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            <X className="w-4 h-4 mr-1" /> Cancelar
          </Button>
          <Button onClick={handleSend} disabled={sending || !supplier}>
            {sending ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando...</>
            ) : (
              <><Send className="w-4 h-4 mr-1" /> Enviar comunicado</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
