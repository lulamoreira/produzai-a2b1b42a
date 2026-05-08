import React, { useEffect, useRef, useState } from "react";
import { Trophy, Loader2, X, Eye } from "lucide-react";
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
import BudgetWinnerPreviewDialog from "./BudgetWinnerPreviewDialog";
import { Textarea } from "@/components/ui/textarea";
import { mergeRecipients, parseRecipients } from "@/lib/emailRecipients";

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
  defaultMockupUrl?: string;
  defaultBookUrl?: string;
  defaultCcEmail?: string;
}

export default function BudgetWinnerDialog({
  open, onOpenChange, campaignId, campaignName, agencyName, supplier,
  defaultMockupUrl = "", defaultBookUrl = "", defaultCcEmail = "",
}: BudgetWinnerDialogProps) {
  const { data: timelineEntries = [] } = useBudgetTimeline(campaignId);
  const [email, setEmail] = useState("");
  const [cc, setCc] = useState("");
  const [mockupUrl, setMockupUrl] = useState("");
  const [bookUrl, setBookUrl] = useState("");
  const [sending, setSending] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewTemplateData, setPreviewTemplateData] = useState<any>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && supplier) {
      setEmail(supplier.email || "");
      setCc(defaultCcEmail || "");
      setMockupUrl(defaultMockupUrl || "");
      setBookUrl(defaultBookUrl || "");
    }
  }, [open, supplier, defaultMockupUrl, defaultBookUrl, defaultCcEmail]);

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

  const handleOpenPreview = async () => {
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

    setPreviewLoading(true);
    const toastId = toast.loading("Gerando pré-visualização...");
    try {
      const { data, error } = await supabase.functions.invoke("render-transactional-email", {
        body: {
          templateName: "supplier-winner-notification",
          templateData,
        },
      });
      if (error) throw new Error(error.message || "Erro ao gerar pré-visualização");
      if (!data?.html) throw new Error("Pré-visualização vazia");

      setPreviewHtml(data.html);
      setPreviewSubject(data.subject || "");
      setPreviewTemplateData(templateData);
      setPreviewOpen(true);
      toast.dismiss(toastId);
    } catch (e: any) {
      console.error("Preview error:", e);
      toast.dismiss(toastId);
      toast.error(e?.message || "Erro ao gerar pré-visualização.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const executeSend = async () => {
    if (!supplier || !previewTemplateData) return;
    const ccEmail = cc.trim();

    setSending(true);
    const toastId = toast.loading("Enviando comunicado ao fornecedor vencedor...");

    try {
      await sendOnce(email.trim(), previewTemplateData);
      if (ccEmail) {
        await sendOnce(ccEmail, previewTemplateData);
      }

      toast.dismiss(toastId);
      toast.success("Comunicado enviado com sucesso!");
      setPreviewOpen(false);
      onOpenChange(false);
    } catch (e: any) {
      console.error("Send winner notification error:", e);
      toast.dismiss(toastId);
      toast.error(e?.message || "Erro ao enviar comunicado.");
    } finally {
      setSending(false);
    }
  };

  const handleEditRecipients = () => {
    setPreviewOpen(false);
    setTimeout(() => emailInputRef.current?.focus(), 100);
  };

  const handlePreviewOpenChange = (o: boolean) => {
    if (sending) return;
    setPreviewOpen(o);
    if (!o && !sending) {
      // Cancel: also close the main dialog
      onOpenChange(false);
    }
  };

  const busy = sending || previewLoading;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
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
                ref={emailInputRef}
                type="email"
                placeholder="fornecedor@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
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
                disabled={busy}
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
                disabled={busy}
              />
              <p className="text-[11px] text-muted-foreground">
                Cole aqui o link externo (Google Drive, WeTransfer, Dropbox, etc.) para o fornecedor baixar as peças.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="winner-book">Link do book de mockup (opcional)</Label>
              <Input
                id="winner-book"
                type="url"
                placeholder="https://drive.google.com/..."
                value={bookUrl}
                onChange={(e) => setBookUrl(e.target.value)}
                disabled={busy}
              />
              <p className="text-[11px] text-muted-foreground">
                Link externo do book de mockup (apresentação visual das peças).
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
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={handleOpenPreview} disabled={busy || !supplier}>
              {previewLoading ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Gerando...</>
              ) : (
                <><Eye className="w-4 h-4 mr-1" /> Visualizar e enviar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BudgetWinnerPreviewDialog
        open={previewOpen}
        onOpenChange={handlePreviewOpenChange}
        to={email.trim()}
        cc={cc.trim()}
        subject={previewSubject}
        html={previewHtml}
        sending={sending}
        onConfirm={executeSend}
        onEditRecipients={handleEditRecipients}
      />
    </>
  );
}
