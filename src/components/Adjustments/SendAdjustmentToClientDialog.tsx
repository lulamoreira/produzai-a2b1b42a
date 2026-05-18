import React, { useEffect, useRef, useState } from "react";
import { Send, Loader2, MessageCircle, Mail, Eye, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { mergeRecipients } from "@/lib/emailRecipients";
import { uploadAndSign, type UploadStatus } from "@/lib/budgetEmailUpload";
import { UploadProgressPanel } from "@/components/Budget/UploadProgressPanel";
import BudgetWinnerPreviewDialog from "@/components/Budget/BudgetWinnerPreviewDialog";
import {
  buildAdjustmentClientPackage,
  type AdjustmentClientPackage,
} from "@/lib/buildAdjustmentClientPackage";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
  adjustmentId: string;
  adjustmentName: string;
  supplierId: string;
  campaignName: string;
  agencyName: string;
  clientName: string;
  defaultClientEmail?: string | null;
  defaultCcEmail?: string | null;
}

type Attachments = {
  workbookLink: { name: string; url: string };
  pdfLink: { name: string; url: string };
};

export default function SendAdjustmentToClientDialog({
  open,
  onOpenChange,
  campaignId,
  adjustmentId,
  adjustmentName,
  supplierId,
  campaignName,
  agencyName,
  clientName,
  defaultClientEmail,
  defaultCcEmail,
}: Props) {
  const [email, setEmail] = useState("");
  const [cc, setCc] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const attachmentsRef = useRef<Attachments | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewTemplateData, setPreviewTemplateData] = useState<any>(null);

  useEffect(() => {
    if (!open) return;
    setEmail(defaultClientEmail || "");
    setCc(defaultCcEmail || "");
    setPhone("");
    setUploadStatus(null);
    attachmentsRef.current = null;
    setPreviewOpen(false);
    setPreviewHtml("");
  }, [open, defaultClientEmail, defaultCcEmail]);

  async function ensureAttachments(): Promise<Attachments> {
    if (attachmentsRef.current) return attachmentsRef.current;
    setGenerating(true);
    try {
      const pkg: AdjustmentClientPackage = await buildAdjustmentClientPackage({
        campaignId, adjustmentId, supplierId, campaignName, clientName, agencyName,
      });
      const workbookLink = await uploadAndSign(
        pkg.workbookBlob,
        pkg.workbookFileName,
        `adjustment_final_${supplierId}`,
        campaignId,
        setUploadStatus,
      );
      const pdfLink = await uploadAndSign(
        pkg.pdfBlob,
        pkg.pdfFileName,
        `adjustment_rateio_pdf_${adjustmentId}`,
        campaignId,
        setUploadStatus,
      );
      attachmentsRef.current = { workbookLink, pdfLink };
      return attachmentsRef.current;
    } finally {
      setGenerating(false);
      setUploadStatus(null);
    }
  }

  const buildTemplateData = (att: Attachments) => ({
    clientName: clientName || "Cliente",
    agencyName,
    campaignName,
    adjustmentName,
    downloadUrls: [att.workbookLink, att.pdfLink],
  });

  const handleOpenPreview = async () => {
    const merged = mergeRecipients(email, cc);
    if (merged.invalid.length) {
      toast.error(`E-mail(s) inválido(s): ${merged.invalid.join(", ")}`);
      return;
    }
    if (merged.valid.length === 0) {
      toast.error("Informe pelo menos um e-mail válido.");
      return;
    }
    const tId = toast.loading("Gerando arquivos e pré-visualização...");
    try {
      const att = await ensureAttachments();
      const templateData = buildTemplateData(att);
      const { data, error } = await supabase.functions.invoke("render-transactional-email", {
        body: { templateName: "adjustment-final-to-client", templateData },
      });
      if (error) throw new Error(error.message || "Erro ao gerar pré-visualização");
      if (!data?.html) throw new Error("Pré-visualização vazia");
      setPreviewHtml(data.html);
      setPreviewSubject(data.subject || "");
      setPreviewTemplateData(templateData);
      setPreviewOpen(true);
      toast.dismiss(tId);
    } catch (e: any) {
      toast.dismiss(tId);
      toast.error(e?.message || "Erro ao gerar pré-visualização.");
    }
  };

  const handleConfirmSend = async () => {
    const merged = mergeRecipients(email, cc);
    if (merged.valid.length === 0 || !previewTemplateData) return;
    setSending(true);
    const tId = toast.loading(`Enviando para ${merged.valid.length} destinatário(s)...`);
    const failures: string[] = [];
    let sent = 0;
    for (const recipient of merged.valid) {
      try {
        const { error } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "adjustment-final-to-client",
            recipientEmail: recipient,
            idempotencyKey: `adjustment-client-${adjustmentId}-${recipient}-${Date.now()}`,
            templateData: previewTemplateData,
          },
        });
        if (error) throw new Error(error.message || "Erro");
        sent++;
      } catch (e: any) {
        failures.push(`${recipient}: ${e?.message || "erro"}`);
      }
    }
    setSending(false);
    toast.dismiss(tId);
    if (sent > 0 && failures.length === 0) {
      toast.success(`E-mail enviado para ${sent} destinatário(s).`);
      setPreviewOpen(false);
      onOpenChange(false);
    } else if (sent > 0) {
      toast.warning(`Enviado para ${sent}; falhas: ${failures.join("; ")}`);
    } else {
      toast.error(`Falha ao enviar: ${failures.join("; ")}`);
    }
  };

  const handleSendWhatsApp = async () => {
    const digits = phone.replace(/\D/g, "");
    if (!digits) {
      toast.error("Informe um número de WhatsApp do cliente.");
      return;
    }
    const tId = toast.loading("Gerando arquivos...");
    try {
      const att = await ensureAttachments();
      const shorten = async (url: string) => {
        try {
          const r = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
          if (r.ok) {
            const t = (await r.text()).trim();
            if (/^https?:\/\//i.test(t)) return t;
          }
        } catch { /* ignore */ }
        return url;
      };
      const [shortXlsx, shortPdf] = await Promise.all([
        shorten(att.workbookLink.url),
        shorten(att.pdfLink.url),
      ]);
      const text =
        `📦 *${campaignName}* — ${agencyName}\n\n` +
        `Olá, *${clientName || "cliente"}*! 👋\n\n` +
        `Estamos enviando a *planilha final* e o *guia visual de lojas* referentes ao ajuste *${adjustmentName}*.\n\n` +
        `📊 Planilha final:\n${shortXlsx}\n\n` +
        `🗺️ Guia visual de lojas:\n${shortPdf}\n\n` +
        `Qualquer dúvida, estamos à disposição. 🙌\n— Equipe ${agencyName}`;
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank");
      toast.success("Mensagem pronta no WhatsApp.", { id: tId });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar arquivos.", { id: tId });
    }
  };

  const busy = sending || generating;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" /> Enviar para o Cliente
            </DialogTitle>
            <DialogDescription>
              Planilha final + Guia Visual de Lojas — <strong>{campaignName}</strong>
              {adjustmentName ? <> · <em>{adjustmentName}</em></> : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cli-email">E-mail(s) do destinatário</Label>
              <Textarea id="cli-email" rows={2} value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} placeholder="cliente@empresa.com" />
              <p className="text-[11px] text-muted-foreground">Separe múltiplos e-mails por vírgula ou ponto e vírgula.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cli-cc">CC (opcional)</Label>
              <Textarea id="cli-cc" rows={2} value={cc} onChange={(e) => setCc(e.target.value)} disabled={busy} placeholder="copia@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cli-phone">WhatsApp (opcional, para o botão WhatsApp)</Label>
              <Input id="cli-phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy} placeholder="ex: 5511999998888" />
            </div>

            {generating && <UploadProgressPanel status={uploadStatus} />}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button variant="outline" onClick={handleSendWhatsApp} disabled={busy || !phone}>
              <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
            </Button>
            <Button onClick={handleOpenPreview} disabled={busy}>
              {generating ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Gerando...</> : <><Eye className="w-4 h-4 mr-1" /> Visualizar e enviar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BudgetWinnerPreviewDialog
        open={previewOpen}
        onOpenChange={(o) => !sending && setPreviewOpen(o)}
        to={email.trim()}
        cc={cc.trim()}
        subject={previewSubject}
        html={previewHtml}
        sending={sending}
        onConfirm={handleConfirmSend}
        onEditRecipients={() => setPreviewOpen(false)}
      />
    </>
  );
}
