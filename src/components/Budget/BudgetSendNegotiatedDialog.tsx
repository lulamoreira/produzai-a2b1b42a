import React, { useEffect, useMemo, useState } from "react";
import { Send, Loader2, MessageCircle, Mail } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrencyByCode } from "@/lib/countryConfig";
import { uploadAndSign, type UploadStatus } from "@/lib/budgetEmailUpload";
import { UploadProgressPanel } from "@/components/Budget/UploadProgressPanel";
import { SendSummaryPanel, type SendSummaryItem } from "@/components/Budget/SendSummaryPanel";
import {
  buildNegotiatedProposalWorkbook,
  computeNegotiatedTotals,
  type NegotiatedProposalParams,
} from "@/lib/buildNegotiatedProposalWorkbook";
import type { CampaignPiece, CampaignKit, CampaignKitPiece, ClientStore, CampaignPieceLocation, CampaignPieceSubLocation } from "@/hooks/useMultiClientData";
import { useCampaignPieceLocations, useCampaignPieceSubLocations } from "@/hooks/useMultiClientData";
import { validateNegotiationRateio, type RateioValidationResult } from "@/lib/validateNegotiationRateio";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { mergeRecipients, parseRecipients } from "@/lib/emailRecipients";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
  campaignName: string;
  agencyName: string;
  clientName: string;
  currencyCode: string;
  supplier: { id: string; company_name: string; contact_name: string; email: string | null; phone: string | null };
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: CampaignKitPiece[];
  stores: ClientStore[];
  defaultCcEmail?: string | null;
}

export default function BudgetSendNegotiatedDialog({
  open,
  onOpenChange,
  campaignId,
  campaignName,
  agencyName,
  clientName,
  currencyCode,
  supplier,
  pieces,
  kits,
  kitPieces,
  stores,
  defaultCcEmail,
}: Props) {
  const [email, setEmail] = useState("");
  const [cc, setCc] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [summaryItems, setSummaryItems] = useState<SendSummaryItem[]>([]);

  const [prices, setPrices] = useState<NegotiatedProposalParams["prices"]>([]);
  const [extraCosts, setExtraCosts] = useState<NegotiatedProposalParams["extraCosts"] | null>(null);
  const [originalSp, setOriginalSp] = useState<NegotiatedProposalParams["originalStorePieces"]>([]);
  const [negotiationSp, setNegotiationSp] = useState<NegotiatedProposalParams["negotiationStorePieces"]>([]);

  const { data: locations = [] } = useCampaignPieceLocations(campaignId);
  const { data: subLocations = [] } = useCampaignPieceSubLocations(campaignId);

  const fmt = (v: number) => formatCurrencyByCode(v, currencyCode);

  useEffect(() => {
    if (!open) return;
    setEmail(supplier.email || "");
    setCc(defaultCcEmail || "");
    setSummaryItems([]);
    setLoading(true);
    (async () => {
      try {
        const [pricesRes, extrasRes, origSpRes, negSpRes] = await Promise.all([
          supabase
            .from("budget_prices" as any)
            .select("piece_id, unit_price, adjusted_unit_price")
            .eq("supplier_id", supplier.id),
          supabase
            .from("budget_extra_costs" as any)
            .select("installation_value, freight_value, adjusted_installation_value, adjusted_freight_value")
            .eq("supplier_id", supplier.id)
            .maybeSingle(),
          (async () => {
            try {
              const rows = await supabasePaginate<any>((from, to) =>
                supabase
                  .from("campaign_store_pieces" as any)
                  .select("store_id, piece_id, quantity")
                  .eq("campaign_id", campaignId)
                  .range(from, to) as any
              );
              return { data: rows, error: null } as any;
            } catch (error) {
              return { data: null, error } as any;
            }
          })(),
          (async () => {
            try {
              const rows = await supabasePaginate<any>((from, to) =>
                supabase
                  .from("budget_negotiation_store_pieces" as any)
                  .select("store_id, piece_id, quantity")
                  .eq("supplier_id", supplier.id)
                  .range(from, to) as any
              );
              return { data: rows, error: null } as any;
            } catch (error) {
              return { data: null, error } as any;
            }
          })(),
        ]);
        if (pricesRes.error) throw pricesRes.error;
        if (extrasRes.error) throw extrasRes.error;
        if (origSpRes.error) throw origSpRes.error;
        if (negSpRes.error) throw negSpRes.error;

        setPrices(((pricesRes.data as any[]) || []).filter((p) => p.piece_id));
        setExtraCosts(
          (extrasRes.data as any) || {
            installation_value: 0,
            freight_value: 0,
            adjusted_installation_value: null,
            adjusted_freight_value: null,
          },
        );
        setOriginalSp(((origSpRes.data as any[]) || []).map((r) => ({
          store_id: r.store_id, piece_id: r.piece_id, quantity: Number(r.quantity || 0),
        })));
        setNegotiationSp(((negSpRes.data as any[]) || []).map((r) => ({
          store_id: r.store_id, piece_id: r.piece_id, quantity: Number(r.quantity || 0),
        })));
      } catch (e: any) {
        toast.error(e?.message || "Falha ao carregar dados da negociação.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, supplier.id, supplier.email, defaultCcEmail, campaignId]);

  const totals = useMemo(() => {
    if (!extraCosts) return null;
    return computeNegotiatedTotals({
      supplier,
      pieces,
      kits,
      kitPieces,
      stores,
      originalStorePieces: originalSp,
      negotiationStorePieces: negotiationSp,
      prices,
      extraCosts,
      campaignName,
      agencyName,
      clientName,
      currencyCode,
    });
  }, [extraCosts, prices, originalSp, negotiationSp, pieces, kits, kitPieces, stores, supplier, campaignName, agencyName, clientName, currencyCode]);

  const validation: RateioValidationResult | null = useMemo(() => {
    if (loading || !extraCosts) return null;
    return validateNegotiationRateio(originalSp, negotiationSp, stores);
  }, [loading, extraCosts, originalSp, negotiationSp, stores]);

  const buildAndUpload = async () => {
    if (!extraCosts) throw new Error("Custos não carregados.");
    const v = validateNegotiationRateio(originalSp, negotiationSp, stores);
    if (!v.valid) {
      const issues: string[] = [];
      if (v.negotiationRows === 0) {
        issues.push('O rateio de negociação está vazio. Abra a negociação e clique em "Editar Rateio da Negociação" antes de gerar a planilha.');
      } else {
        if (v.missingStores.length > 0) {
          issues.push(`${v.missingStores.length} lojas ausentes no rateio de negociação: ${v.missingStores.slice(0, 5).join(', ')}${v.missingStores.length > 5 ? '...' : ''}`);
        }
        if (v.originalPieces !== v.negotiationPieces) {
          issues.push(`Peças divergentes: original tem ${v.originalPieces}, negociação tem ${v.negotiationPieces}.`);
        }
      }
      throw new Error('Rateio de negociação incompleto:\n' + issues.join('\n'));
    }
    const { blob, fileName, totals: t } = await buildNegotiatedProposalWorkbook({
      supplier,
      pieces,
      kits,
      kitPieces,
      stores,
      originalStorePieces: originalSp,
      negotiationStorePieces: negotiationSp,
      prices,
      extraCosts,
      campaignName,
      agencyName,
      clientName,
      currencyCode,
      locations: locations as CampaignPieceLocation[],
      subLocations: subLocations as CampaignPieceSubLocation[],
    });
    const link = await uploadAndSign(blob, fileName, `negociacao_${supplier.id}`, campaignId, setUploadStatus);
    return { link, fileName, totals: t };
  };

  const handleSendEmail = async () => {
    const merged = mergeRecipients(email, cc);
    if (merged.invalid.length) {
      toast.error(`E-mail(s) inválido(s): ${merged.invalid.join(", ")}`);
      return;
    }
    if (merged.valid.length === 0) {
      toast.error("Informe pelo menos um e-mail válido.");
      return;
    }
    setSending(true);
    setUploadStatus(null);
    setSummaryItems([]);
    const items: SendSummaryItem[] = [];
    const push = (it: SendSummaryItem) => { items.push(it); setSummaryItems([...items]); };
    const tId = toast.loading("Gerando planilha e enviando...");
    try {
      let link: { name: string; url: string };
      let t: { totalOriginal: number; totalNegotiated: number; savings: number };
      try {
        const res = await buildAndUpload();
        link = res.link;
        t = res.totals;
        push({ kind: "file", label: res.fileName, stage: "signed" });
      } catch (err: any) {
        push({ kind: "file", label: "Proposta negociada", stage: "failed", error: err?.message || "Erro" });
        throw err;
      }
      const diff = t.totalNegotiated - t.totalOriginal;
      const diffDirection: "up" | "down" | "none" = diff > 0 ? "up" : diff < 0 ? "down" : "none";
      const toEmails = parseRecipients(email);
      let anySent = false;
      for (const recipient of merged.valid) {
        const isCc = !toEmails.includes(recipient);
        const label = `${isCc ? "E-mail (CC)" : "E-mail"} → ${recipient}`;
        try {
          const { error } = await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "negotiation-proposal-to-supplier",
              recipientEmail: recipient,
              idempotencyKey: `negotiation-${campaignId}-${supplier.id}-${recipient}-${Date.now()}`,
              templateData: {
                supplierName: supplier.company_name,
                contactName: supplier.contact_name,
                agencyName,
                clientName,
                campaignName,
                totalOriginalFormatted: fmt(t.totalOriginal),
                totalNegotiatedFormatted: fmt(t.totalNegotiated),
                differenceFormatted: fmt(Math.abs(diff)),
                differenceDirection: diffDirection,
                downloadUrls: [link],
              },
            },
          });
          if (error) throw new Error(error.message || "Erro ao enviar e-mail");
          push({ kind: "email", label, stage: "sent" });
          anySent = true;
        } catch (err: any) {
          push({ kind: "email", label, stage: "failed", error: err?.message || "Erro" });
        }
      }
      if (!anySent) throw new Error("Nenhum e-mail foi enviado.");
      toast.success(`E-mail enviado para ${merged.valid.length} destinatário(s).`, { id: tId });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar.", { id: tId });
    } finally {
      setSending(false);
      setUploadStatus(null);
    }
  };

  const handleSendWhatsApp = async () => {
    const phone = (supplier.phone || "").replace(/\D/g, "");
    if (!phone) {
      toast.error("Fornecedor sem telefone cadastrado.");
      return;
    }
    setSending(true);
    setUploadStatus(null);
    setSummaryItems([]);
    const items: SendSummaryItem[] = [];
    const push = (it: SendSummaryItem) => { items.push(it); setSummaryItems([...items]); };
    const tId = toast.loading("Gerando planilha...");
    try {
      let link: { name: string; url: string };
      let t: { totalOriginal: number; totalNegotiated: number; savings: number };
      try {
        const res = await buildAndUpload();
        link = res.link;
        t = res.totals;
        push({ kind: "file", label: res.fileName, stage: "signed" });
      } catch (err: any) {
        push({ kind: "file", label: "Proposta negociada", stage: "failed", error: err?.message || "Erro" });
        throw err;
      }
      // Encurta a URL via TinyURL (fallback para URL original em caso de falha)
      let shortUrl = link.url;
      try {
        const resp = await fetch(
          `https://tinyurl.com/api-create.php?url=${encodeURIComponent(link.url)}`
        );
        if (resp.ok) {
          const txt = (await resp.text()).trim();
          if (/^https?:\/\//i.test(txt)) shortUrl = txt;
        }
      } catch {
        /* mantém URL original */
      }
      const diff = t.totalNegotiated - t.totalOriginal;
      const diffLine =
        diff > 0
          ? `📈 Diferença (para maior): *+${fmt(diff)}*`
          : diff < 0
          ? `📉 Diferença (para menor): *-${fmt(Math.abs(diff))}*`
          : `➖ Sem diferença em relação ao valor original.`;

      const greeting = supplier.contact_name || supplier.company_name;
      const waText =
        `🤝 *Proposta Negociada* 🤝\n\n` +
        `Olá, *${greeting}*! 👋\n\n` +
        `Segue a proposta negociada referente à:\n` +
        `🏢 Cliente: *${clientName}*\n` +
        `📣 Campanha: *${campaignName}*\n` +
        `🏛 Agência: ${agencyName}\n\n` +
        `💰 *Resumo financeiro*\n` +
        `• Valor original: ${fmt(t.totalOriginal)}\n` +
        `• ✅ Valor negociado: *${fmt(t.totalNegotiated)}*\n` +
        `• ${diffLine.replace(/^[^\s]+\s/, (m) => m)}\n\n` +
        `📎 *Planilha completa da proposta:*\n` +
        `${shortUrl}\n\n` +
        `📄 Arquivo: ${link.name}\n\n` +
        `Por favor, confirme o recebimento e nos avise em caso de qualquer dúvida. 🙌\n` +
        `Agradecemos pela parceria! 🚀\n\n` +
        `— Equipe ${agencyName}`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waText)}`, "_blank");
      push({ kind: "whatsapp", label: `WhatsApp → ${phone}`, stage: "sent" });
      toast.success("Mensagem pronta no WhatsApp.", { id: tId });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar planilha.", { id: tId });
    } finally {
      setSending(false);
      setUploadStatus(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Enviar Proposta Negociada
          </DialogTitle>
          <DialogDescription>
            Fornecedor: <strong>{supplier.company_name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando dados...
            </div>
          ) : (
            <>
              {totals && (
                <div className="rounded-md border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Valor Original:</span><strong>{fmt(totals.totalOriginal)}</strong></div>
                  <div className="flex justify-between"><span>Valor Negociado:</span><strong>{fmt(totals.totalNegotiated)}</strong></div>
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400 pt-1 border-t border-amber-200">
                    <span>💰 Economia:</span><strong>{fmt(totals.savings)}</strong>
                  </div>
                </div>
              )}

              {validation && (
                validation.valid ? (
                  <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      Rateio de negociação válido — {validation.negotiationRows} linhas, {validation.negotiationStores} lojas, {validation.totalQtyNegotiation} unidades
                    </span>
                  </div>
                ) : (
                  <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/20 p-2.5 text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <div className="font-medium">Rateio de negociação incompleto</div>
                      {validation.negotiationRows === 0 ? (
                        <div>O rateio de negociação está vazio. Abra a negociação e clique em "Editar Rateio da Negociação" antes de gerar a planilha.</div>
                      ) : (
                        <ul className="list-disc list-inside space-y-0.5">
                          {validation.missingStores.length > 0 && (
                            <li>
                              {validation.missingStores.length} lojas ausentes: {validation.missingStores.slice(0, 5).join(', ')}{validation.missingStores.length > 5 ? '...' : ''}
                            </li>
                          )}
                          {validation.originalPieces !== validation.negotiationPieces && (
                            <li>Peças divergentes: original {validation.originalPieces}, negociação {validation.negotiationPieces}.</li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                )
              )}

              <div className="space-y-1.5">
                <Label htmlFor="neg-email">E-mail(s) do destinatário</Label>
                <Textarea id="neg-email" rows={2} value={email} onChange={(e) => setEmail(e.target.value)} disabled={sending} placeholder="email1@empresa.com, email2@empresa.com" />
                <p className="text-[11px] text-muted-foreground">Separe múltiplos e-mails por vírgula ou ponto e vírgula.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="neg-cc">CC (opcional)</Label>
                <Textarea id="neg-cc" rows={2} value={cc} onChange={(e) => setCc(e.target.value)} disabled={sending} placeholder="copia1@empresa.com, copia2@empresa.com" />
              </div>
            </>
          )}
          {sending && <UploadProgressPanel status={uploadStatus} />}
          {!sending && summaryItems.length > 0 && <SendSummaryPanel items={summaryItems} />}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!sending && summaryItems.length > 0 ? (
            <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                Cancelar
              </Button>
              <Button
                variant="outline"
                onClick={handleSendWhatsApp}
                disabled={sending || loading || !supplier.phone || (validation ? !validation.valid : false)}
                title={!supplier.phone ? "Fornecedor sem telefone" : "Gerar planilha e abrir WhatsApp"}
              >
                <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
              </Button>
              <Button onClick={handleSendEmail} disabled={sending || loading || (validation ? !validation.valid : false)}>
                {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />}
                Enviar por E-mail
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
