import React, { useEffect, useMemo, useState } from "react";
import { Send, Loader2, MessageCircle, Mail } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { uploadAndSign, type UploadStatus } from "@/lib/budgetEmailUpload";
import { UploadProgressPanel } from "@/components/Budget/UploadProgressPanel";
import { SendSummaryPanel, type SendSummaryItem } from "@/components/Budget/SendSummaryPanel";
import {
  buildAdjustmentProposalWorkbook,
  summarizeAdjustmentChanges,
} from "@/lib/buildAdjustmentProposalWorkbook";
import {
  useAdjustmentPieces, useAdjustmentKits, useAdjustmentKitPieces, useAdjustmentStorePieces,
} from "@/hooks/useAdjustments";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  adjustment: { id: string; name: string; campaign_id: string };
  campaignId: string;
  campaignName: string;
  agencyName: string;
  clientName: string;
  currencyCode: string;
}

export default function AdjustmentBudgetRequestDialog({
  open, onOpenChange, adjustment, campaignId, campaignName, agencyName, clientName, currencyCode,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [summaryItems, setSummaryItems] = useState<SendSummaryItem[]>([]);
  const [email, setEmail] = useState("");
  const [cc, setCc] = useState("");
  const [customMessage, setCustomMessage] = useState("");

  const [winner, setWinner] = useState<any | null>(null);
  const [origSp, setOrigSp] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [extras, setExtras] = useState<{ installation_value: number; freight_value: number }>({
    installation_value: 0, freight_value: 0,
  });
  const [stores, setStores] = useState<any[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);

  const { data: pieces = [] } = useAdjustmentPieces(adjustment.id);
  const { data: kits = [] } = useAdjustmentKits(adjustment.id);
  const { data: kitPieces = [] } = useAdjustmentKitPieces(adjustment.id);
  const { data: adjSp = [] } = useAdjustmentStorePieces(adjustment.id);

  const summary = useMemo(() => summarizeAdjustmentChanges(pieces), [pieces]);
  const changesDescription =
    `${summary.modified} peça(s) modificada(s), ${summary.added} nova(s), ${summary.removed} removida(s)`;

  useEffect(() => {
    if (!open) return;
    setSummaryItems([]);
    setLoading(true);
    (async () => {
      try {
        const { data: campaignRow } = await supabase
          .from("campaigns").select("client_id").eq("id", campaignId).maybeSingle();
        const _clientId = (campaignRow as any)?.client_id || null;
        setClientId(_clientId);

        const { data: w } = await supabase
          .from("budget_suppliers")
          .select("id, company_name, contact_name, email, phone")
          .eq("campaign_id", campaignId)
          .eq("is_winner", true)
          .maybeSingle();
        setWinner(w);
        if (w) setEmail((w as any).email || "");

        if (!w) {
          setLoading(false);
          return;
        }

        const [pricesRes, extrasRes, storesRes, origSpRows] = await Promise.all([
          supabase.from("budget_prices" as any)
            .select("piece_id, unit_price, adjusted_unit_price")
            .eq("supplier_id", (w as any).id),
          supabase.from("budget_extra_costs" as any)
            .select("installation_value, freight_value")
            .eq("supplier_id", (w as any).id).maybeSingle(),
          _clientId
            ? supabase.from("client_stores" as any)
                .select("id, name, nickname, city, state").eq("client_id", _clientId)
            : Promise.resolve({ data: [], error: null } as any),
          supabasePaginate<any>((from, to) =>
            supabase.from("campaign_store_pieces" as any)
              .select("store_id, piece_id, quantity")
              .eq("campaign_id", campaignId)
              .range(from, to) as any
          ),
        ]);
        setPrices(((pricesRes.data as any[]) || []).filter((p) => p.piece_id));
        setExtras({
          installation_value: Number((extrasRes.data as any)?.installation_value || 0),
          freight_value: Number((extrasRes.data as any)?.freight_value || 0),
        });
        setStores(((storesRes.data as any[]) || []));
        setOrigSp((origSpRows || []).map((r: any) => ({
          store_id: r.store_id, piece_id: r.piece_id, quantity: Number(r.quantity || 0),
        })));
      } catch (e: any) {
        toast.error(e?.message || "Falha ao carregar dados.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, campaignId, adjustment.id]);

  const buildAndUpload = async () => {
    if (!winner) throw new Error("Nenhum fornecedor vencedor encontrado para esta campanha.");
    const adjSpFlat = (adjSp as any[]).map((r) => ({
      store_id: r.store_id, piece_id: r.piece_id, quantity: Number(r.quantity || 0),
    }));
    const { blob, fileName } = await buildAdjustmentProposalWorkbook({
      adjustment: { id: adjustment.id, name: adjustment.name },
      campaignName, agencyName, clientName, currencyCode,
      supplier: { id: winner.id, company_name: winner.company_name, contact_name: winner.contact_name },
      pieces, kits, kitPieces, stores,
      originalStorePieces: origSp,
      adjustmentStorePieces: adjSpFlat,
      currentPrices: prices,
      extraCosts: extras,
    });
    const link = await uploadAndSign(blob, fileName, `adjustment_${adjustment.id}`, campaignId, setUploadStatus);
    return { link, fileName };
  };

  const persistRequest = async () => {
    if (!winner) return;
    await supabase.from("campaign_adjustment_budget_request" as any).upsert({
      adjustment_id: adjustment.id,
      supplier_id: winner.id,
      status: "submitted",
      request_sent_at: new Date().toISOString(),
    } as any, { onConflict: "adjustment_id,supplier_id" } as any);
  };

  const handleSendEmail = async () => {
    if (!EMAIL_REGEX.test(email.trim())) { toast.error("E-mail inválido."); return; }
    if (cc.trim() && !EMAIL_REGEX.test(cc.trim())) { toast.error("CC inválido."); return; }
    setSending(true);
    setUploadStatus(null);
    setSummaryItems([]);
    const items: SendSummaryItem[] = [];
    const push = (it: SendSummaryItem) => { items.push(it); setSummaryItems([...items]); };
    const tId = toast.loading("Gerando planilha e enviando...");
    try {
      let link: { name: string; url: string };
      try {
        const res = await buildAndUpload();
        link = res.link;
        push({ kind: "file", label: res.fileName, stage: "signed" });
      } catch (err: any) {
        push({ kind: "file", label: "Planilha de reorçamento", stage: "failed", error: err?.message || "Erro" });
        throw err;
      }
      try {
        const { error } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "adjustment-quote-request-to-supplier",
            recipientEmail: email.trim(),
            idempotencyKey: `adj-quote-${adjustment.id}-${winner!.id}-${Date.now()}`,
            templateData: {
              supplierName: winner!.company_name,
              contactName: winner!.contact_name,
              agencyName, campaignName,
              adjustmentName: adjustment.name,
              changesDescription,
              customMessage: customMessage.trim() || undefined,
              downloadUrls: [link],
            },
          },
        });
        if (error) throw new Error(error.message || "Erro ao enviar");
        push({ kind: "email", label: `E-mail → ${email.trim()}`, stage: "sent" });
      } catch (err: any) {
        push({ kind: "email", label: `E-mail → ${email.trim()}`, stage: "failed", error: err?.message || "Erro" });
        throw err;
      }
      await persistRequest();
      toast.success("Reorçamento enviado por e-mail.", { id: tId });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar.", { id: tId });
    } finally { setSending(false); setUploadStatus(null); }
  };

  const handleSendWhatsApp = async () => {
    const phone = (winner?.phone || "").replace(/\D/g, "");
    if (!phone) { toast.error("Fornecedor sem telefone."); return; }
    setSending(true);
    setUploadStatus(null);
    setSummaryItems([]);
    const items: SendSummaryItem[] = [];
    const push = (it: SendSummaryItem) => { items.push(it); setSummaryItems([...items]); };
    const tId = toast.loading("Gerando planilha...");
    try {
      let link: { name: string; url: string };
      try {
        const res = await buildAndUpload();
        link = res.link;
        push({ kind: "file", label: res.fileName, stage: "signed" });
      } catch (err: any) {
        push({ kind: "file", label: "Planilha de reorçamento", stage: "failed", error: err?.message || "Erro" });
        throw err;
      }
      let shortUrl = link.url;
      try {
        const r = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(link.url)}`);
        if (r.ok) { const t = (await r.text()).trim(); if (/^https?:\/\//i.test(t)) shortUrl = t; }
      } catch { /* ignore */ }
      const greeting = winner!.contact_name || winner!.company_name;
      const text =
        `📐 *Reorçamento Pós-Mockup*\n\n` +
        `Olá, *${greeting}*! 👋\n\n` +
        `Após o mockup da campanha *${campaignName}*, identificamos ajustes no escopo.\n\n` +
        `📊 *Alterações:* ${changesDescription}\n` +
        `🏷 Ajuste: *${adjustment.name}*\n\n` +
        (customMessage.trim() ? `💬 ${customMessage.trim()}\n\n` : "") +
        `📎 Planilha de reorçamento:\n${shortUrl}\n\n` +
        `Por favor, preencha os campos em amarelo e retorne com os novos valores. 🙌\n\n` +
        `— Equipe ${agencyName}`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
      push({ kind: "whatsapp", label: `WhatsApp → ${phone}`, stage: "sent" });
      await persistRequest();
      toast.success("Mensagem pronta no WhatsApp.", { id: tId });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar planilha.", { id: tId });
    } finally { setSending(false); setUploadStatus(null); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" /> Solicitar Reorçamento — {adjustment.name}
          </DialogTitle>
          <DialogDescription>
            Envie a planilha de reorçamento ao fornecedor vencedor com os novos quantitativos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : !winner ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200">
              Nenhum fornecedor vencedor declarado para esta campanha.
            </div>
          ) : (
            <>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
                <div><strong>{winner.company_name}</strong></div>
                <div className="text-xs text-muted-foreground">
                  {winner.contact_name} · {winner.email || "sem e-mail"} · {winner.phone || "sem telefone"}
                </div>
              </div>

              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                Alterações: {changesDescription}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adj-email">E-mail do destinatário</Label>
                <Input id="adj-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={sending} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adj-cc">CC (opcional)</Label>
                <Input id="adj-cc" type="email" value={cc} onChange={(e) => setCc(e.target.value)} disabled={sending} placeholder="copia@empresa.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adj-msg">Mensagem (opcional)</Label>
                <Textarea id="adj-msg" rows={3} value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} disabled={sending} placeholder="Mensagem personalizada que será incluída no e-mail/WhatsApp." />
              </div>
            </>
          )}
          {sending && <UploadProgressPanel status={uploadStatus} />}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
          <Button variant="outline" onClick={handleSendWhatsApp}
            disabled={sending || loading || !winner || !winner?.phone}>
            <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
          </Button>
          <Button onClick={handleSendEmail} disabled={sending || loading || !winner}>
            {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />}
            Enviar por E-mail
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
