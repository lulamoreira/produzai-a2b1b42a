import React, { useEffect, useMemo, useState } from "react";
import { Send, Loader2, MessageCircle, Eye, Copy } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { Button } from "@/components/ui/button";
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
  computeAdjustmentStoreChanges,
  summarizeAdjustmentChanges,
} from "@/lib/buildAdjustmentProposalWorkbook";
import {
  useAdjustmentPieces, useAdjustmentKits, useAdjustmentKitPieces, useAdjustmentStorePieces,
} from "@/hooks/useAdjustments";
import { mergeRecipients, parseRecipients } from "@/lib/emailRecipients";
import AdjustmentQuotePreviewDialog from "@/components/AdjustmentQuotePreviewDialog";
import DeadlinePickerDialog from "@/components/Budget/DeadlinePickerDialog";
import { useGeneratePortalLink } from "@/hooks/useAdjustmentBudgetRequest";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  adjustment: { id: string; name: string; campaign_id: string };
  campaignId: string;
  campaignName: string;
  agencyName: string;
  clientName: string;
  currencyCode: string;
  winnerSupplierId?: string | null;
  hasNegotiationRateio?: boolean;
}

export default function AdjustmentBudgetRequestDialog({
  open, onOpenChange, adjustment, campaignId, campaignName, agencyName, clientName, currencyCode,
  winnerSupplierId, hasNegotiationRateio,
}: Props) {
  const useNegotiationBaseline = !!(hasNegotiationRateio && winnerSupplierId);
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [preparingPreview, setPreparingPreview] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [summaryItems, setSummaryItems] = useState<SendSummaryItem[]>([]);
  const [email, setEmail] = useState("");
  const [cc, setCc] = useState("");
  const [customMessage, setCustomMessage] = useState("");

  // Preview state — populated after the workbook is uploaded and the email
  // template is rendered server-side. Reused for both real send and test send
  // so the recipient sees byte-for-byte the same email the tester previewed.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [preparedLink, setPreparedLink] = useState<{ name: string; url: string } | null>(null);
  const [preparedTemplateData, setPreparedTemplateData] = useState<Record<string, any> | null>(null);

  // Deadline picker + portal link state
  const [deadlinePickerOpen, setDeadlinePickerOpen] = useState(false);
  const [pendingFlow, setPendingFlow] = useState<"email" | "whatsapp" | null>(null);
  const [existingRequest, setExistingRequest] = useState<any | null>(null);
  const generatePortalLink = useGeneratePortalLink();

  const [winner, setWinner] = useState<any | null>(null);
  const [origSp, setOrigSp] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [extras, setExtras] = useState<{ installation_value: number; freight_value: number }>({
    installation_value: 0, freight_value: 0,
  });
  const [stores, setStores] = useState<any[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [sourceKits, setSourceKits] = useState<{ id: string; code: number; name: string }[]>([]);
  const [sourcePieces, setSourcePieces] = useState<{ id: string; code: number; name: string }[]>([]);
  const [originalKitPieces, setOriginalKitPieces] = useState<{ kit_id: string; piece_id: string; quantity: number }[]>([]);
  const [adjustmentStoresSnapshot, setAdjustmentStoresSnapshot] = useState<any[]>([]);

  const { data: pieces = [] } = useAdjustmentPieces(adjustment.id);
  const { data: kits = [] } = useAdjustmentKits(adjustment.id);
  const { data: kitPieces = [] } = useAdjustmentKitPieces(adjustment.id);
  const { data: adjSp = [] } = useAdjustmentStorePieces(adjustment.id);

  const summary = useMemo(() => summarizeAdjustmentChanges(pieces), [pieces]);
  const storeChanges = useMemo(
    () => computeAdjustmentStoreChanges(stores as any[], adjustmentStoresSnapshot as any[], origSp as any[]),
    [stores, adjustmentStoresSnapshot, origSp],
  );
  const changesDescription =
    `${summary.modified} peça(s) modificada(s), ${summary.added} nova(s), ${summary.removed} removida(s); ` +
    `${storeChanges.added.length} loja(s) adicionada(s), ${storeChanges.removed.length} removida(s)`;

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

        const [pricesRes, extrasRes, storesRes, baselineSpRows, srcKitsRes, srcPiecesRes, origKpRows, snapStoreRows] = await Promise.all([
          supabase.from("budget_prices" as any)
            .select("piece_id, unit_price, adjusted_unit_price")
            .eq("supplier_id", (w as any).id),
          supabase.from("budget_extra_costs" as any)
            .select("installation_value, freight_value")
            .eq("supplier_id", (w as any).id).maybeSingle(),
          _clientId
            ? supabase.from("client_stores" as any)
                .select("id, name, nickname, city, state, store_code, showcase_count").eq("client_id", _clientId)
            : Promise.resolve({ data: [], error: null } as any),
          // Use negotiation rateio as the baseline whenever it exists; otherwise fall back to original.
          useNegotiationBaseline
            ? supabasePaginate<any>((from, to) =>
                (supabase.from("budget_negotiation_store_pieces" as any) as any)
                  .select("store_id, piece_id, quantity")
                  .eq("supplier_id", winnerSupplierId as string)
                  .range(from, to)
              )
            : supabasePaginate<any>((from, to) =>
                supabase.from("campaign_store_pieces" as any)
                  .select("store_id, piece_id, quantity")
                  .eq("campaign_id", campaignId)
                  .range(from, to) as any
              ),
          supabase.from("campaign_kits").select("id, code, name, image_url").eq("campaign_id", campaignId).eq("is_deleted", false),
          supabase.from("campaign_pieces").select("id, code, name, image_url, image_thumb_url, image_report_url, image_full_url").eq("campaign_id", campaignId).eq("is_deleted", false),
          supabasePaginate<any>((from, to) =>
            supabase.from("campaign_kit_pieces" as any)
              .select("kit_id, piece_id, quantity")
              .range(from, to) as any
          ),
          supabasePaginate<any>((from, to) =>
            supabase.from("campaign_adjustment_stores" as any)
              .select("source_store_id, name, nickname, city, state, store_code, showcase_count")
              .eq("adjustment_id", adjustment.id)
              .range(from, to) as any
          ),
        ]);
        setPrices(((pricesRes.data as any[]) || []).filter((p) => p.piece_id));
        setExtras({
          installation_value: Number((extrasRes.data as any)?.installation_value || 0),
          freight_value: Number((extrasRes.data as any)?.freight_value || 0),
        });
        setStores(((storesRes.data as any[]) || []));
        setOrigSp((baselineSpRows || []).map((r: any) => ({
          store_id: r.store_id, piece_id: r.piece_id, quantity: Number(r.quantity || 0),
        })));
        setSourceKits(((srcKitsRes.data as any[]) || []) as any);
        setSourcePieces(((srcPiecesRes.data as any[]) || []) as any);
        const validKitIds = new Set(((srcKitsRes.data as any[]) || []).map((k: any) => k.id));
        setOriginalKitPieces(
          ((origKpRows as any[]) || []).filter((r) => validKitIds.has(r.kit_id))
            .map((r: any) => ({ kit_id: r.kit_id, piece_id: r.piece_id, quantity: Number(r.quantity || 0) }))
        );
        setAdjustmentStoresSnapshot(((snapStoreRows as any[]) || []));

        // Load existing requote row (for token / deadline reuse)
        if (w) {
          const { data: reqRow } = await supabase
            .from("campaign_adjustment_budget_request" as any)
            .select("id, access_token, token_expires_at, deadline_days, status")
            .eq("adjustment_id", adjustment.id)
            .eq("supplier_id", (w as any).id)
            .maybeSingle();
          setExistingRequest(reqRow || null);
        }
      } catch (e: any) {
        toast.error(e?.message || "Falha ao carregar dados.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, campaignId, adjustment.id, useNegotiationBaseline, winnerSupplierId]);

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
      sourceKits, sourcePieces, originalKitPieces,
      adjustmentStoresSnapshot,
      originalStorePieces: origSp,
      adjustmentStorePieces: adjSpFlat,
      currentPrices: prices,
      extraCosts: extras,
      baselineIsNegotiation: useNegotiationBaseline,
    });
    const link = await uploadAndSign(blob, fileName, `adjustment_${adjustment.id}`, campaignId, setUploadStatus);
    return { link, fileName };
  };

  const persistRequest = async () => {
    if (!winner) return;
    // Only insert a stub row if none exists. Token + deadline are set by
    // ensureRequestAndToken via the generate_requote_token RPC, which also
    // sets status to 'sent'. Avoid clobbering that.
    await supabase.from("campaign_adjustment_budget_request" as any).upsert({
      adjustment_id: adjustment.id,
      supplier_id: winner.id,
      status: "sent",
      request_sent_at: new Date().toISOString(),
    } as any, { onConflict: "adjustment_id,supplier_id", ignoreDuplicates: true } as any);
    await qc.invalidateQueries({ queryKey: ['adjustment_budget_requests', campaignId] });
  };

  /**
   * Ensure a campaign_adjustment_budget_request row exists for this
   * (adjustment, supplier) pair, then mint a fresh portal token + deadline.
   * Returns the full portal URL.
   */
  const ensureRequestAndToken = async (deadlineDays: number): Promise<{
    portalUrl: string;
    tokenExpiresAt: string | null;
  }> => {
    if (!winner) throw new Error("Sem fornecedor vencedor.");
    let requestId: string | undefined = existingRequest?.id;
    if (!requestId) {
      const { data: newReq, error: upErr } = await supabase
        .from("campaign_adjustment_budget_request" as any)
        .upsert(
          {
            adjustment_id: adjustment.id,
            supplier_id: winner.id,
            status: "pending",
          } as any,
          { onConflict: "adjustment_id,supplier_id" } as any
        )
        .select("id")
        .single();
      if (upErr) throw upErr;
      requestId = (newReq as any)?.id;
    }
    if (!requestId) throw new Error("Não foi possível criar a recotação.");
    const token = await generatePortalLink.mutateAsync({ requestId, deadlineDays });
    // Refetch to get token_expires_at
    const { data: refreshed } = await supabase
      .from("campaign_adjustment_budget_request" as any)
      .select("id, access_token, token_expires_at, deadline_days, status")
      .eq("id", requestId)
      .maybeSingle();
    setExistingRequest(refreshed || null);
    return {
      portalUrl: `${window.location.origin}/recotacao/${token}`,
      tokenExpiresAt: (refreshed as any)?.token_expires_at || null,
    };
  };

  const buildTemplateData = (
    link: { name: string; url: string },
    portalCtx?: { portalUrl?: string; tokenExpiresAt?: string | null }
  ): Record<string, any> => ({
    supplierName: winner!.company_name,
    contactName: winner!.contact_name,
    agencyName, campaignName,
    adjustmentName: adjustment.name,
    changesDescription,
    customMessage: customMessage.trim() || undefined,
    downloadUrls: [link],
    portalUrl: portalCtx?.portalUrl,
    deadlineDate: portalCtx?.tokenExpiresAt
      ? format(new Date(portalCtx.tokenExpiresAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
      : undefined,
  });

  /**
   * Step 1: validate recipients, generate the workbook, upload it, and render
   * the email HTML server-side. Then open the preview dialog. Nothing is
   * persisted and no email goes out yet.
   */
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
    setPreparingPreview(true);
    setUploadStatus(null);
    setSummaryItems([]);
    const tId = toast.loading("Gerando planilha e pré-visualização...");
    try {
      const { link } = await buildAndUpload();
      const templateData = buildTemplateData(link);
      const { data, error } = await supabase.functions.invoke("render-transactional-email", {
        body: {
          templateName: "adjustment-quote-request-to-supplier",
          templateData,
        },
      });
      if (error) throw new Error(error.message || "Falha ao gerar a pré-visualização.");
      if (!data?.html) throw new Error("Pré-visualização vazia.");
      setPreviewHtml(data.html);
      setPreviewSubject(data.subject || "");
      setPreparedLink(link);
      setPreparedTemplateData(templateData);
      setPreviewOpen(true);
      toast.dismiss(tId);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao preparar pré-visualização.", { id: tId });
    } finally {
      setPreparingPreview(false);
      setUploadStatus(null);
    }
  };

  /**
   * Step 2a: confirm send to the real recipients. Persists the request as
   * "submitted" so the campaign accounts the reorçamento.
   */
  const handleConfirmSend = async () => {
    if (!winner || !preparedTemplateData) return;
    const merged = mergeRecipients(email, cc);
    const confirmMsg =
      `Confirma o envio da recotação ao fornecedor?\n\n` +
      `Destinatário(s): ${merged.valid.join(", ")}\n\n` +
      `Esta ação marcará a recotação como SOLICITADA no sistema.`;
    if (!window.confirm(confirmMsg)) return;
    setSending(true);
    setSummaryItems([]);
    const items: SendSummaryItem[] = [];
    const push = (it: SendSummaryItem) => { items.push(it); setSummaryItems([...items]); };
    const tId = toast.loading("Enviando recotação...");
    try {
      let anySent = false;
      const toEmails = parseRecipients(email);
      for (const recipient of merged.valid) {
        const isCc = !toEmails.includes(recipient);
        const label = `${isCc ? "E-mail (CC)" : "E-mail"} → ${recipient}`;
        try {
          const { error } = await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "adjustment-quote-request-to-supplier",
              recipientEmail: recipient,
              idempotencyKey: `adj-quote-${adjustment.id}-${winner.id}-${recipient}-${Date.now()}`,
              templateData: preparedTemplateData,
            },
          });
          if (error) throw new Error(error.message || "Erro ao enviar");
          push({ kind: "email", label, stage: "sent" });
          anySent = true;
        } catch (err: any) {
          push({ kind: "email", label, stage: "failed", error: err?.message || "Erro" });
        }
      }
      if (!anySent) throw new Error("Nenhum e-mail foi enviado.");
      await persistRequest();
      setPreviewOpen(false);
      toast.success(`Recotação enviada para ${merged.valid.length} destinatário(s).`, { id: tId });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar.", { id: tId });
    } finally {
      setSending(false);
    }
  };

  /**
   * Step 2b: send a one-off test copy to a single address. CRITICAL:
   * does NOT call persistRequest, so this never marks the reorçamento as
   * solicited. Subject gets a "[TESTE]" prefix so testers can spot it.
   */
  const handleSendTest = async (testEmail: string) => {
    if (!winner || !preparedTemplateData) return;
    const tId = toast.loading(`Enviando teste para ${testEmail}...`);
    try {
      const testTemplateData = {
        ...preparedTemplateData,
        // Tag the body so the recipient knows this is a test; we cannot mutate
        // the subject through templateData (subject() only sees fields it knows),
        // so we prepend a banner-like marker to the custom message.
        customMessage:
          `[CÓPIA DE TESTE — não notifica o fornecedor]\n` +
          (preparedTemplateData.customMessage || ""),
      };
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "adjustment-quote-request-to-supplier",
          recipientEmail: testEmail,
          // Unique idempotency key so multiple tests are not deduped.
          idempotencyKey: `adj-quote-TEST-${adjustment.id}-${testEmail}-${Date.now()}`,
          templateData: testTemplateData,
        },
      });
      if (error) throw new Error(error.message || "Erro ao enviar teste");
      toast.success(`Teste enviado para ${testEmail}.`, { id: tId });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar teste.", { id: tId });
    }
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
        push({ kind: "file", label: "Planilha de recotação", stage: "failed", error: err?.message || "Erro" });
        throw err;
      }
      let shortUrl = link.url;
      try {
        const r = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(link.url)}`);
        if (r.ok) { const t = (await r.text()).trim(); if (/^https?:\/\//i.test(t)) shortUrl = t; }
      } catch { /* ignore */ }
      const greeting = winner!.contact_name || winner!.company_name;
      const text =
        `📐 *Recotação Pós-Mockup*\n\n` +
        `Olá, *${greeting}*! 👋\n\n` +
        `Após o mockup da campanha *${campaignName}*, identificamos ajustes no escopo.\n\n` +
        `📊 *Alterações:* ${changesDescription}\n` +
        `🏷 Ajuste: *${adjustment.name}*\n\n` +
        (customMessage.trim() ? `💬 ${customMessage.trim()}\n\n` : "") +
        `📎 Planilha de recotação:\n${shortUrl}\n\n` +
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
      <DialogContent className="max-w-xl">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Send className="w-4 h-4 text-primary" /> Solicitar Recotação
          </DialogTitle>
          <DialogDescription className="text-xs">
            {adjustment.name} · {useNegotiationBaseline ? "comparando com a Negociação vigente" : "comparando com o Original"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : !winner ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200">
              Nenhum fornecedor vencedor declarado para esta campanha.
            </div>
          ) : (
            <>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Fornecedor vencedor</div>
                <div className="text-sm font-semibold">{winner.company_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {winner.contact_name || "—"} · {winner.email || "sem e-mail"} · {winner.phone || "sem telefone"}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border bg-amber-50/60 dark:bg-amber-950/20 p-2 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-amber-900/70 dark:text-amber-200/70">Modificadas</div>
                  <div className="text-base font-semibold text-amber-900 dark:text-amber-200">{summary.modified}</div>
                </div>
                <div className="rounded-md border bg-emerald-50/60 dark:bg-emerald-950/20 p-2 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-900/70 dark:text-emerald-200/70">Novas</div>
                  <div className="text-base font-semibold text-emerald-900 dark:text-emerald-200">{summary.added}</div>
                </div>
                <div className="rounded-md border bg-rose-50/60 dark:bg-rose-950/20 p-2 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-rose-900/70 dark:text-rose-200/70">Removidas</div>
                  <div className="text-base font-semibold text-rose-900 dark:text-rose-200">{summary.removed}</div>
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-2.5 text-xs space-y-1">
                <div className="font-medium text-foreground">Será enviado em anexo:</div>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li>Planilha completa de recotação — todas as peças e kits em ordem crescente de código, com destaque visual nas linhas alteradas.</li>
                  <li>Aba <strong>Modificações</strong> — detalhamento de peças alteradas/removidas/novas e kits modificados (incluindo peças adicionadas/removidas dentro dos kits).</li>
                  <li>Aba <strong>Matriz Lojas × Peças</strong> — rateio do ajuste por loja.</li>
                  <li>Base de comparação: {useNegotiationBaseline ? "Negociação vigente" : "Rateio Original"}.</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adj-email" className="text-xs">E-mail(s) do destinatário</Label>
                <Textarea id="adj-email" rows={2} value={email} onChange={(e) => setEmail(e.target.value)} disabled={sending} placeholder="email1@empresa.com, email2@empresa.com" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adj-cc" className="text-xs">CC (opcional)</Label>
                <Textarea id="adj-cc" rows={1} value={cc} onChange={(e) => setCc(e.target.value)} disabled={sending} placeholder="copia@empresa.com" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adj-msg" className="text-xs">Mensagem (opcional)</Label>
                <Textarea id="adj-msg" rows={2} value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} disabled={sending} placeholder="Mensagem personalizada incluída no e-mail/WhatsApp." className="text-sm" />
              </div>
            </>
          )}
          {(sending || preparingPreview) && <UploadProgressPanel status={uploadStatus} />}
          {!sending && !preparingPreview && summaryItems.length > 0 && <SendSummaryPanel items={summaryItems} />}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!sending && summaryItems.length > 0 ? (
            <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending || preparingPreview}>Cancelar</Button>
              <Button variant="outline" onClick={handleSendWhatsApp}
                disabled={sending || preparingPreview || loading || !winner || !winner?.phone}>
                <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
              </Button>
              <Button onClick={handleOpenPreview} disabled={sending || preparingPreview || loading || !winner}>
                {preparingPreview ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />}
                Visualizar e enviar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      <AdjustmentQuotePreviewDialog
        open={previewOpen}
        onOpenChange={(o) => { if (!sending) setPreviewOpen(o); }}
        to={email.trim()}
        cc={cc.trim()}
        subject={previewSubject}
        html={previewHtml}
        attachments={preparedLink ? [preparedLink] : []}
        sending={sending}
        onConfirm={handleConfirmSend}
        onSendTest={handleSendTest}
      />
    </Dialog>
  );
}
