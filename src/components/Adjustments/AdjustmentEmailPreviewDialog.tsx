import React, { useMemo, useRef, useState } from "react";
import { Copy, Link as LinkIcon, AtSign, X, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

const BRAND = "#8C6F4E";
const DARK = "#1C1916";

export type EmailVariant = "client" | "supplier";

interface DownloadLink { name: string; url: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  variant: EmailVariant;
  recipientName: string;
  agencyName: string;
  campaignName: string;
  adjustmentName: string;
  downloads: DownloadLink[];
  to: string;
  cc?: string;
  subject: string;
  onSendViaSystem?: () => Promise<void> | void;
  replyTo?: string;
}

function buildHtml(p: Props): string {
  const { variant, recipientName, agencyName, campaignName, adjustmentName, downloads } = p;
  const intro =
    variant === "client"
      ? `Estamos enviando a <strong>planilha final</strong> e o <strong>guia visual de lojas</strong> referentes à campanha <strong>${escape(campaignName)}</strong>${adjustmentName ? ` (ajuste <strong>${escape(adjustmentName)}</strong>)` : ""}.`
      : `A <strong>planilha final</strong> e o <strong>Guia Visual de Rateio</strong> estão liberados para produção referentes à campanha <strong>${escape(campaignName)}</strong>${adjustmentName ? ` (ajuste <strong>${escape(adjustmentName)}</strong>)` : ""}.`;
  const detail =
    variant === "client"
      ? `A planilha consolida os preços aprovados, o rateio por loja e o comparativo de valores. O guia visual apresenta loja a loja as peças e kits a serem produzidos, com fotos e quantidades.`
      : `Seguem em anexo os arquivos necessários para iniciar a produção. Qualquer dúvida, estamos à disposição.`;
  const title =
    variant === "client" ? "Planilha final e Guia Visual de Lojas" : "Liberação para produção";

  const buttons = downloads
    .map(
      (d) => `
      <tr><td align="center" style="padding:0 0 10px;">
        <a href="${d.url}" style="background-color:${BRAND};color:#ffffff;padding:12px 24px;font-size:14px;font-weight:bold;text-decoration:none;border-radius:6px;display:inline-block;font-family:'Segoe UI',Arial,sans-serif;">📥 ${escape(d.name)}</a>
      </td></tr>`,
    )
    .join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Segoe UI',Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
      <tr><td style="background-color:${DARK};padding:14px 24px;text-align:center;color:#ffffff;font-size:14px;font-weight:bold;letter-spacing:0.5px;">${escape(agencyName || "ProduzAI")}</td></tr>
      <tr><td style="background-color:${BRAND};padding:14px 24px;text-align:center;color:#ffffff;font-size:16px;font-weight:bold;letter-spacing:1px;">${escape((campaignName || "").toUpperCase())}</td></tr>
      <tr><td style="padding:28px 24px 20px;">
        <h1 style="font-size:22px;font-weight:bold;color:#1a1a1a;margin:0 0 20px;">${escape(title)}</h1>
        <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 16px;">Prezado(a) <strong>${escape(recipientName)}</strong>,</p>
        <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 16px;">${intro}</p>
        <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 16px;">${detail}</p>
        ${
          downloads.length
            ? `<h2 style="font-size:16px;font-weight:bold;color:#1a1a1a;margin:24px 0 12px;">Arquivos para download</h2>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${buttons}</table>
        <p style="font-size:12px;color:#777;text-align:center;margin:4px 0 16px;">Os links de download ficam ativos por 30 dias.</p>`
            : ""
        }
        <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0 16px;"/>
        <p style="font-size:12px;color:#999;line-height:1.5;margin:0;">Enviado pela plataforma ProduzAI em nome da <strong>${escape(agencyName)}</strong>.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function escape(s: string): string {
  return (s || "").replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function buildPlainLinks(downloads: DownloadLink[]): string {
  return downloads.map((d) => `${d.name}:\n${d.url}`).join("\n\n");
}

export default function AdjustmentEmailPreviewDialog(props: Props) {
  const { open, onOpenChange, downloads, to, cc, subject } = props;
  const html = useMemo(() => buildHtml(props), [props]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const copyHtml = async () => {
    try {
      // Rich copy: HTML + plain text fallback so Mail/Outlook/Gmail preserve layout
      const plain = buildPlainLinks(downloads);
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const item = new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(html);
      }
      toast.success("E-mail copiado. Cole no corpo do seu Mail (Cmd/Ctrl+V).");
    } catch (e: any) {
      toast.error("Não foi possível copiar. Selecione manualmente no preview.");
    }
  };

  const copyLinks = async () => {
    try {
      await navigator.clipboard.writeText(buildPlainLinks(downloads));
      toast.success("Links copiados.");
    } catch {
      toast.error("Não foi possível copiar os links.");
    }
  };

  const openMail = () => {
    const toList = encodeURIComponent((to || "").replace(/[;,\s]+/g, ","));
    const ccList = cc?.trim() ? `&cc=${encodeURIComponent(cc.replace(/[;,\s]+/g, ","))}` : "";
    const body = `${buildPlainLinks(downloads)}\n\n(Dica: para enviar com o layout completo, volte e use "Copiar e-mail", depois cole aqui.)`;
    const url = `mailto:${toList}?subject=${encodeURIComponent(subject)}${ccList}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base">Pré-visualização do e-mail</DialogTitle>
          <DialogDescription className="text-xs">
            Copie o conteúdo formatado e cole no corpo do seu app de e-mail (Apple Mail, Outlook e Gmail preservam o layout).
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded-md overflow-hidden bg-white">
          <iframe
            ref={iframeRef}
            title="email-preview"
            srcDoc={html}
            sandbox=""
            className="w-full"
            style={{ height: "55vh", border: "0" }}
          />
        </div>

        <DialogFooter className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-1" /> Fechar
          </Button>
          <Button variant="outline" size="sm" onClick={copyLinks}>
            <LinkIcon className="w-4 h-4 mr-1" /> Copiar links
          </Button>
          <Button variant="outline" size="sm" onClick={openMail}>
            <AtSign className="w-4 h-4 mr-1" /> Abrir e-mail
          </Button>
          <Button size="sm" onClick={copyHtml}>
            <Copy className="w-4 h-4 mr-1" /> Copiar e-mail
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
