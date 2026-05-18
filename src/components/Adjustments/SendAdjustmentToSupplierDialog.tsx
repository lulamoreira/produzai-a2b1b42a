import React, { useEffect, useRef, useState } from "react";
import { Send, Loader2, MessageCircle, X, Mail } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { mergeRecipients, parseRecipients } from "@/lib/emailRecipients";
import { uploadAndSign, type UploadStatus } from "@/lib/budgetEmailUpload";
import { UploadProgressPanel } from "@/components/Budget/UploadProgressPanel";
import {
  buildAdjustmentClientPackage,
  type AdjustmentClientPackage,
} from "@/lib/buildAdjustmentClientPackage";
import AdjustmentEmailPreviewDialog from "./AdjustmentEmailPreviewDialog";
import ReplyToField, { isReplyToValid } from "@/components/Email/ReplyToField";

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
  defaultCcEmail?: string | null;
}

type Attachments = {
  workbookLink: { name: string; url: string };
  pdfLink: { name: string; url: string };
};

interface SupplierInfo {
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
}

export default function SendAdjustmentToSupplierDialog({
  open,
  onOpenChange,
  campaignId,
  adjustmentId,
  adjustmentName,
  supplierId,
  campaignName,
  agencyName,
  clientName,
  defaultCcEmail,
}: Props) {
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);
  const [loadingSupplier, setLoadingSupplier] = useState(false);

  const [email, setEmail] = useState("");
  const [cc, setCc] = useState("");
  const [phone, setPhone] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [generating, setGenerating] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const attachmentsRef = useRef<Attachments | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUploadStatus(null);
    setPreviewOpen(false);
    try {
      setReplyTo(localStorage.getItem("adjustment:lastReplyTo") || "");
    } catch {
      setReplyTo("");
    }
    attachmentsRef.current = null;
    setLoadingSupplier(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("budget_suppliers")
          .select("company_name, contact_name, email, phone")
          .eq("id", supplierId)
          .maybeSingle();
        if (error) throw error;
        const s = (data as any) || { company_name: "Fornecedor", contact_name: null, email: null, phone: null };
        setSupplier(s);
        setEmail(s.email || "");
        setCc(defaultCcEmail || "");
        setPhone(s.phone || "");
      } catch (e: any) {
        toast.error(e?.message || "Falha ao carregar fornecedor.");
      } finally {
        setLoadingSupplier(false);
      }
    })();
  }, [open, supplierId, defaultCcEmail]);

  async function ensureAttachments(): Promise<Attachments> {
    if (attachmentsRef.current) return attachmentsRef.current;
    setGenerating(true);
    try {
      const pkg: AdjustmentClientPackage = await buildAdjustmentClientPackage({
        campaignId, adjustmentId, supplierId, campaignName, clientName, agencyName,
      });
      const workbookLink = await uploadAndSign(
        pkg.workbookBlob, pkg.workbookFileName,
        `adjustment_final_${supplierId}`, campaignId, setUploadStatus,
      );
      const pdfLink = await uploadAndSign(
        pkg.pdfBlob, pkg.pdfFileName,
        `adjustment_rateio_pdf_${adjustmentId}`, campaignId, setUploadStatus,
      );
      attachmentsRef.current = { workbookLink, pdfLink };
      return attachmentsRef.current;
    } finally {
      setGenerating(false);
      setUploadStatus(null);
    }
  }

  const handleSendWhatsApp = async () => {
    const digits = phone.replace(/\D/g, "");
    if (!digits) {
      toast.error("Fornecedor sem telefone informado.");
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
      const greeting = supplier?.contact_name || supplier?.company_name || "fornecedor";
      const text =
        `🚀 *${campaignName}* — ${agencyName}\n\n` +
        `Olá, *${greeting}*! 👋\n\n` +
        `A *planilha final* e o *Guia Visual de Rateio* estão liberados para produção (ajuste *${adjustmentName}*).\n\n` +
        `📊 Planilha final:\n${shortXlsx}\n\n` +
        `🗺️ Guia Visual de Rateio:\n${shortPdf}\n\n` +
        `Qualquer dúvida, estamos à disposição. Obrigado pela parceria! 🙌\n— Equipe ${agencyName}`;
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank");
      toast.success("Mensagem pronta no WhatsApp.", { id: tId });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar arquivos.", { id: tId });
    }
  };

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
    if (!isReplyToValid(replyTo)) {
      toast.error("E-mail de 'Responder para' inválido.");
      return;
    }
    const tId = toast.loading("Gerando arquivos...");
    try {
      await ensureAttachments();
      toast.dismiss(tId);
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar arquivos.", { id: tId });
    }
  };

  const handleSendViaSystem = async () => {
    const merged = mergeRecipients(email, cc);
    if (merged.valid.length === 0) {
      toast.error("Informe pelo menos um e-mail válido.");
      return;
    }
    if (!isReplyToValid(replyTo)) {
      toast.error("E-mail de 'Responder para' inválido.");
      return;
    }
    const att = attachmentsRef.current;
    if (!att) {
      toast.error("Arquivos ainda não foram gerados.");
      return;
    }
    const toEmails = parseRecipients(email);
    const templateData = {
      supplierName: supplier?.company_name || "Fornecedor",
      contactName: supplier?.contact_name || undefined,
      agencyName,
      clientName,
      campaignName,
      adjustmentName,
      downloadUrls: [att.workbookLink, att.pdfLink],
    };
    const tId = toast.loading(`Enviando para ${merged.valid.length} destinatário(s)...`);
    let sent = 0;
    const failures: string[] = [];
    for (const recipient of merged.valid) {
      const isCc = !toEmails.includes(recipient);
      try {
        const { error } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "adjustment-final-to-supplier",
            recipientEmail: recipient,
            idempotencyKey: `adj-supplier-${adjustmentId}-${supplierId}-${recipient}-${Date.now()}`,
            templateData,
            fromName: agencyName,
            ...(replyTo.trim() ? { replyTo: replyTo.trim() } : {}),
          },
        });
        if (error) throw new Error(error.message || "Erro ao enviar");
        sent++;
      } catch (e: any) {
        failures.push(`${isCc ? "CC " : ""}${recipient}: ${e?.message || "erro"}`);
      }
    }
    toast.dismiss(tId);
    if (sent > 0 && failures.length === 0) {
      toast.success(`E-mail enviado para ${sent} destinatário(s).`);
      setPreviewOpen(false);
      onOpenChange(false);
    } else if (sent > 0) {
      toast.warning(`Enviado para ${sent}. Falhas: ${failures.join("; ")}`);
    } else {
      toast.error(`Falha ao enviar: ${failures.join("; ")}`);
    }
  };

  const busy = generating || loadingSupplier;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
        <DialogContent className="max-w-xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Send className="w-4 h-4" /> Avisar Fornecedor
            </DialogTitle>
            <DialogDescription className="text-xs">
              Liberação para produção — <strong>{supplier?.company_name || "Fornecedor"}</strong>
              {adjustmentName ? <> · <em>{adjustmentName}</em></> : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {loadingSupplier ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando fornecedor...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="sup-email" className="text-xs">E-mail(s) do fornecedor</Label>
                    <Input id="sup-email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} placeholder="fornecedor@empresa.com" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sup-cc" className="text-xs">CC (opcional)</Label>
                    <Input id="sup-cc" value={cc} onChange={(e) => setCc(e.target.value)} disabled={busy} placeholder="copia@empresa.com" />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground -mt-1">Separe múltiplos e-mails por vírgula ou ponto e vírgula.</p>
                <div className="space-y-1">
                  <Label htmlFor="sup-phone" className="text-xs">WhatsApp do fornecedor</Label>
                  <Input id="sup-phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy} placeholder="ex: 5511999998888" />
                </div>
              </>
            )}
            <ReplyToField value={replyTo} onChange={setReplyTo} disabled={busy} />
            {generating && <UploadProgressPanel status={uploadStatus} />}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 sm:justify-end">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button variant="outline" size="sm" onClick={handleSendWhatsApp} disabled={busy || !phone}>
              <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
            </Button>
            <Button size="sm" onClick={handleOpenPreview} disabled={busy}>
              {generating ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Gerando...</> : <><Mail className="w-4 h-4 mr-1" /> Pré-visualizar e-mail</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdjustmentEmailPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        variant="supplier"
        recipientName={supplier?.contact_name || supplier?.company_name || "fornecedor"}
        agencyName={agencyName}
        campaignName={campaignName}
        adjustmentName={adjustmentName}
        downloads={attachmentsRef.current ? [attachmentsRef.current.workbookLink, attachmentsRef.current.pdfLink] : []}
        to={email}
        cc={cc}
        subject={`${campaignName} — Liberação para produção${adjustmentName ? ` (${adjustmentName})` : ""}`}
        onSendViaSystem={handleSendViaSystem}
        replyTo={replyTo}
      />
    </>
  );
}
