import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowLeft, Copy, Loader2, Megaphone, Send, X, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EmailRecipientsInput from "@/components/Email/EmailRecipientsInput";
import { parseRecipients } from "@/lib/emailRecipients";
import { supabase } from "@/integrations/supabase/client";

interface OccurrenceInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  clientId: string;
  clientName?: string;
  agencyName?: string;
  campaignName?: string;
}

const escapeHtml = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const nl2br = (s: string) => escapeHtml(s).replace(/\r?\n/g, "<br />");

const PORTAL_BASE = "https://produzai.lovable.app/ocorrencias-portal";

const DEFAULT_OPENING =
  "Olá! Estamos abrindo o portal de ocorrências da sua loja para esta campanha. Por favor, registre qualquer divergência encontrada antes do prazo abaixo. É rápido e pode ser feito direto pelo celular.";

export default function OccurrenceInviteDialog({
  open,
  onOpenChange,
  campaignId,
  clientId,
  clientName: clientNameProp,
  agencyName: agencyNameProp,
  campaignName: campaignNameProp,
}: OccurrenceInviteDialogProps) {
  const [step, setStep] = useState<"form" | "preview">("form");
  const [bcc, setBcc] = useState("");
  const [opening, setOpening] = useState(DEFAULT_OPENING);
  const [important, setImportant] = useState("");

  // Fetch campaign + client + agency + deadline + store emails
  const { data, isLoading } = useQuery({
    queryKey: ["occ-invite-data", campaignId, clientId],
    enabled: open && !!campaignId && !!clientId,
    queryFn: async () => {
      const [campaignRes, clientRes, cfgRes, lojasRes] = await Promise.all([
        supabase.from("campaigns").select("name").eq("id", campaignId).maybeSingle(),
        supabase
          .from("clients")
          .select("name, agency_id, agencies:agency_id(name)")
          .eq("id", clientId)
          .maybeSingle(),
        supabase
          .from("store_portal_config")
          .select("deadline_ocorrencias")
          .eq("campaign_id", campaignId)
          .maybeSingle(),
        supabase
          .from("loja_a_loja_lojas")
          .select("store_id, ativo, client_stores(email)")
          .eq("campaign_id", campaignId)
          .eq("ativo", true),
      ]);

      const emails = Array.from(
        new Set(
          (lojasRes.data || [])
            .map((r: any) => (r.client_stores?.email || "").trim().toLowerCase())
            .filter((e: string) => e && /.+@.+\..+/.test(e)),
        ),
      );

      return {
        campaignName: campaignRes.data?.name ?? "",
        clientName: clientRes.data?.name ?? "",
        agencyName: (clientRes.data as any)?.agencies?.name ?? "",
        deadline: cfgRes.data?.deadline_ocorrencias ?? null,
        emails,
      };
    },
  });

  const campaignName = campaignNameProp || data?.campaignName || "";
  const clientName = clientNameProp || data?.clientName || "";
  const agencyName = agencyNameProp || data?.agencyName || "";
  const deadline = data?.deadline ?? null;

  useEffect(() => {
    if (open) {
      setStep("form");
      setOpening(DEFAULT_OPENING);
      setImportant("");
    }
  }, [open]);

  useEffect(() => {
    if (open && data?.emails) setBcc(data.emails.join(", "));
  }, [open, data?.emails]);

  const deadlineLabel = useMemo(() => {
    if (!deadline) return "";
    try {
      return format(new Date(deadline), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return "";
    }
  }, [deadline]);

  const subject = `Portal de Ocorrências — ${campaignName}${clientName ? ` (${clientName})` : ""}`;

  const buildHtml = () => {
    const DARK = "#1C1916";
    const BRAND = "#8C6F4E";
    const BG = "#F5F2ED";

    const importantBlock = important.trim()
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;margin:0 0 16px;">
          <tr><td style="background:#FBF3E4;border:1px solid #E8C97A;border-left:5px solid #C28A1E;border-radius:6px;padding:14px 16px;font-family:'Segoe UI',Arial,sans-serif;">
            <div style="display:flex;align-items:center;gap:8px;margin:0 0 6px;">
              <span style="font-size:16px;line-height:1;">⚠️</span>
              <strong style="color:#9A6B00;font-size:13px;letter-spacing:0.4px;text-transform:uppercase;">Informações importantes</strong>
            </div>
            <div style="color:#5A4416;font-size:14px;line-height:1.55;">${nl2br(important.trim())}</div>
          </td></tr>
        </table>`
      : "";

    const deadlineBlock = deadlineLabel
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;margin:0 0 18px;">
          <tr><td style="background:#FEF6E7;border:1px solid #E8C97A;border-radius:6px;padding:14px 16px;font-family:'Segoe UI',Arial,sans-serif;color:#5A4416;font-size:14px;">
            <strong style="color:#9A6B00;">⏰ Prazo para registrar:</strong> até ${escapeHtml(deadlineLabel)}
          </td></tr>
        </table>`
      : "";

    const stepCircle = (n: number, text: string) => `
      <tr>
        <td valign="top" width="36" style="padding:6px 12px 6px 0;">
          <div style="width:28px;height:28px;border-radius:50%;background:${BRAND};color:#ffffff;font:bold 13px 'Segoe UI',Arial,sans-serif;line-height:28px;text-align:center;">${n}</div>
        </td>
        <td valign="middle" style="padding:6px 0;font:14px 'Segoe UI',Arial,sans-serif;color:${DARK};line-height:1.5;">${escapeHtml(text)}</td>
      </tr>`;

    const portalUrl = `${PORTAL_BASE}/${campaignId}`;

    return `
<div style="background:${BG};padding:24px 0;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e8e2d6;">
    <tr><td style="background:${DARK};padding:18px 24px;color:#ffffff;font:bold 15px 'Segoe UI',Arial,sans-serif;letter-spacing:0.3px;">
      ${escapeHtml(agencyName || "ProduzAI")}
    </td></tr>
    <tr><td style="background:${BRAND};padding:10px 24px;color:#ffffff;font:13px 'Segoe UI',Arial,sans-serif;">
      ${escapeHtml(campaignName)}${clientName ? ` · ${escapeHtml(clientName)}` : ""}
    </td></tr>
    <tr><td style="padding:28px 28px 8px;">
      <h1 style="margin:0 0 14px;font:bold 22px 'Segoe UI',Arial,sans-serif;color:${DARK};line-height:1.3;">
        O portal de ocorrências da sua loja está aberto
      </h1>
      <p style="margin:0 0 18px;font:14px 'Segoe UI',Arial,sans-serif;color:#3f3a32;line-height:1.6;">
        ${nl2br(opening.trim())}
      </p>
      ${importantBlock}
      ${deadlineBlock}
      <h3 style="margin:8px 0 8px;font:bold 15px 'Segoe UI',Arial,sans-serif;color:${DARK};">Como registrar, em 3 passos</h3>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 22px;">
        ${stepCircle(1, "Abra o portal e toque na sua loja.")}
        ${stepCircle(2, "Veja as peças que vão na sua loja.")}
        ${stepCircle(3, "Achou um problema? Toque na peça e envie com foto.")}
      </table>
      <div style="text-align:center;margin:8px 0 24px;">
        <a href="${escapeHtml(portalUrl)}" style="background:${BRAND};color:#ffffff;text-decoration:none;font:bold 14px 'Segoe UI',Arial,sans-serif;padding:14px 26px;border-radius:6px;display:inline-block;">
          Acessar o portal da minha loja
        </a>
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;margin:0 0 18px;">
        <tr><td style="background:#F5F2ED;border:1px solid #e8e2d6;border-radius:6px;padding:12px 14px;font:13px 'Segoe UI',Arial,sans-serif;color:#4a443b;line-height:1.5;">
          No portal, ao selecionar sua loja, você também consulta e baixa a lista das peças da sua loja nesta campanha.
        </td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e8e2d6;margin:18px 0 14px;" />
      <p style="margin:0 0 6px;font:13px 'Segoe UI',Arial,sans-serif;color:#6b6358;">Dúvidas? É só responder este e-mail.</p>
      <p style="margin:0 0 4px;font:bold 14px 'Segoe UI',Arial,sans-serif;color:${BRAND};">${escapeHtml(agencyName || "ProduzAI")}</p>
    </td></tr>
  </table>
</div>`;
  };

  const buildPlain = () => {
    const lines: string[] = [];
    lines.push(`O portal de ocorrências da sua loja está aberto`, "");
    lines.push(opening.trim(), "");
    if (important.trim()) {
      lines.push("INFORMAÇÕES IMPORTANTES:", important.trim(), "");
    }
    if (deadlineLabel) lines.push(`Prazo para registrar: até ${deadlineLabel}`, "");
    lines.push("Como registrar, em 3 passos:");
    lines.push("1) Abra o portal e toque na sua loja.");
    lines.push("2) Veja as peças que vão na sua loja.");
    lines.push("3) Achou um problema? Toque na peça e envie com foto.", "");
    lines.push(`Acessar o portal: ${PORTAL_BASE}/${campaignId}`, "");
    lines.push("Dúvidas? É só responder este e-mail.", "", agencyName || "");
    return lines.join("\n");
  };

  const bccList = useMemo(() => parseRecipients(bcc), [bcc]);

  const buildMailto = () => {
    const params = new URLSearchParams();
    if (bccList.length) params.set("bcc", bccList.join(","));
    params.set("subject", subject);
    const query = params.toString().replace(/\+/g, "%20");
    return `mailto:?${query}`;
  };

  const copyRich = async () => {
    const html = buildHtml();
    const plain = buildPlain();
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
    } else {
      await navigator.clipboard.writeText(plain);
    }
  };

  const handleCopy = async () => {
    try {
      await copyRich();
      toast.success("Conteúdo formatado copiado. Cole no e-mail com Cmd+V.");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };

  const handleOpenMail = async () => {
    try {
      await copyRich();
    } catch (e) {
      console.warn("rich copy failed", e);
    }
    const url = buildMailto();
    if (url.length > 1800) {
      toast.warning(
        "Muitos destinatários: o link do e-mail ficou grande. Envie em lotes ou use 'Copiar Conteúdo Formatado'.",
        { duration: 7000 },
      );
    }
    try {
      window.open(url, "_self");
    } catch {
      window.location.href = url;
    }
    toast.success(
      "Rascunho aberto! Cole o conteúdo com Cmd+V (use Copiar Conteúdo Formatado).",
      { duration: 6000, closeButton: true },
    );
    setTimeout(() => onOpenChange(false), 1500);
  };

  const noDeadline = !isLoading && !deadline;
  const canSend = !noDeadline && bccList.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" /> Convocar lojistas
          </DialogTitle>
          <DialogDescription>
            Envie um aviso por e-mail para que as lojas acessem o portal de ocorrências.
          </DialogDescription>
        </DialogHeader>

        {noDeadline && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Defina o prazo em <strong>Loja a Loja → Configurações</strong> antes de convocar.
            </span>
          </div>
        )}

        {step === "form" && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-bcc">Destinatários (CCO) *</Label>
              <EmailRecipientsInput
                id="invite-bcc"
                placeholder="lojista1@empresa.com, lojista2@empresa.com"
                value={bcc}
                onChange={setBcc}
                suggestions={[]}
              />
              <p className="text-[11px] text-muted-foreground">
                {isLoading
                  ? "Carregando e-mails das lojas..."
                  : `${bccList.length} destinatário(s) — os lojistas serão enviados em CCO.`}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-opening">Mensagem de abertura</Label>
              <Textarea
                id="invite-opening"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                className="min-h-[90px] text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-important">Informações importantes (opcional)</Label>
              <Textarea
                id="invite-important"
                value={important}
                onChange={(e) => setImportant(e.target.value)}
                placeholder="Ex: lembrem-se de tirar fotos da fachada antes da abertura."
                className="min-h-[70px] text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Se preenchido, aparece em destaque no e-mail.
              </p>
            </div>

            {deadlineLabel && (
              <p className="text-xs text-muted-foreground">
                Prazo configurado: <strong>{deadlineLabel}</strong>
              </p>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">CCO</Label>
              <Input value={bccList.join(", ")} readOnly className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Assunto</Label>
              <Input value={subject} readOnly className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
              <div
                className="border rounded-md bg-white overflow-auto"
                style={{ maxHeight: 420 }}
                dangerouslySetInnerHTML={{ __html: buildHtml() }}
              />
            </div>
            {buildMailto().length > 1800 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Você tem <strong>{bccList.length}</strong> destinatários. O "Abrir no Meu E-mail"
                  pode não carregar todos — copie os destinatários e o conteúdo e cole no seu e-mail.
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step === "form" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
              <Button
                onClick={() => setStep("preview")}
                disabled={!canSend || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Carregando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1" /> Visualizar
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("form")}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button variant="secondary" onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-1" /> Copiar Conteúdo Formatado
              </Button>
              <Button onClick={handleOpenMail} disabled={!canSend}>
                <Send className="w-4 h-4 mr-1" /> Abrir no Meu E-mail
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
