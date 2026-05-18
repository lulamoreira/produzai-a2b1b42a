import React, { useEffect, useRef, useState } from "react";
import { Send, Loader2, MessageCircle, Mail, Eye, X, AtSign } from "lucide-react";
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

  const handleSendMailto = async () => {
    const merged = mergeRecipients(email, cc);
    if (merged.invalid.length) {
      toast.error(`E-mail(s) inválido(s): ${merged.invalid.join(", ")}`);
      return;
    }
    if (merged.valid.length === 0) {
      toast.error("Informe pelo menos um e-mail válido.");
      return;
    }
    const tId = toast.loading("Gerando arquivos...");
    try {
      const att = await ensureAttachments();
      const subject = `${campaignName} — Planilha final + Guia Visual de Lojas${adjustmentName ? ` (${adjustmentName})` : ""}`;
      const body =
        `Olá, ${clientName || "cliente"}!\n\n` +
        `Segue a planilha final e o guia visual de lojas referentes ao ajuste ${adjustmentName}.\n\n` +
        `Planilha final:\n${att.workbookLink.url}\n\n` +
        `Guia visual de lojas:\n${att.pdfLink.url}\n\n` +
        `Qualquer dúvida, estamos à disposição.\n— Equipe ${agencyName}`;
      const toList = encodeURIComponent(email.replace(/[;,\s]+/g, ","));
      const ccList = cc.trim() ? `&cc=${encodeURIComponent(cc.replace(/[;,\s]+/g, ","))}` : "";
      const url = `mailto:${toList}?subject=${encodeURIComponent(subject)}${ccList}&body=${encodeURIComponent(body)}`;
      window.location.href = url;
      toast.success("Abrindo seu app de e-mail...", { id: tId });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar arquivos.", { id: tId });
    }
  };

  const busy = sending || generating;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
        <DialogContent className="max-w-xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Send className="w-4 h-4" /> Enviar para o Cliente
            </DialogTitle>
            <DialogDescription className="text-xs">
              Planilha final + Guia Visual de Lojas — <strong>{campaignName}</strong>
              {adjustmentName ? <> · <em>{adjustmentName}</em></> : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cli-email" className="text-xs">E-mail(s) do destinatário</Label>
                <Input id="cli-email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} placeholder="cliente@empresa.com" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cli-cc" className="text-xs">CC (opcional)</Label>
                <Input id="cli-cc" value={cc} onChange={(e) => setCc(e.target.value)} disabled={busy} placeholder="copia@empresa.com" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">Separe múltiplos e-mails por vírgula ou ponto e vírgula.</p>
            <div className="space-y-1">
              <Label htmlFor="cli-phone" className="text-xs">WhatsApp (opcional)</Label>
              <Input id="cli-phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy} placeholder="ex: 5511999998888" />
            </div>

            {generating && <UploadProgressPanel status={uploadStatus} />}
          </div>

          <DialogFooter className="grid grid-cols-2 sm:grid-cols-4 pt-2">
            <Button className="w-full" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button className="w-full" variant="outline" size="sm" onClick={handleSendWhatsApp} disabled={busy || !phone}>
              <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
            </Button>
            <Button className="w-full" variant="outline" size="sm" onClick={handleSendMailto} disabled={busy}>
              {generating ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Gerando...</> : <><AtSign className="w-4 h-4 mr-1" /> Meu e-mail</>}
            </Button>
            <Button className="w-full" size="sm" onClick={handleOpenPreview} disabled={busy}>
              {generating ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Gerando...</> : <><Eye className="w-4 h-4 mr-1" /> Visualizar</>}
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
