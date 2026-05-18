import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layers, Plus, Trash2, CheckCircle2, Eye, Copy, AlertTriangle, Loader2, Send, FileInput, RotateCcw, XCircle, ArrowLeft, FileSpreadsheet, Mail, Truck } from "lucide-react";
import { useExportRequoteFinal } from "@/hooks/useExportRequoteFinal";
import { formatCurrencyByCode } from "@/lib/countryConfig";
import AdjustmentRegisterResponseDialog from "./AdjustmentRegisterResponseDialog";
import SendAdjustmentToClientDialog from "./Adjustments/SendAdjustmentToClientDialog";
import SendAdjustmentToSupplierDialog from "./Adjustments/SendAdjustmentToSupplierDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  useCampaignAdjustments,
  useActiveAdjustment,
  useCreateAdjustment,
  useUpdateAdjustmentStatus,
  useDeleteAdjustment,
  type CampaignAdjustment,
  type AdjustmentStatus,
} from "@/hooks/useAdjustments";
import AdjustmentDetailSheet from "./AdjustmentDetailSheet";
import AdjustmentBudgetRequestDialog from "./AdjustmentBudgetRequestDialog";
import {
  REQUOTE_STATUS_META,
  useActiveAdjustmentRequest,
  useRequoteRealtime,
} from "@/hooks/useAdjustmentBudgetRequest";
import { DeadlineCountdown } from "./Budget/DeadlineCountdown";
import { ReviewRequoteDialog } from "./Budget/ReviewRequoteDialog";
import { formatDistanceToNow } from "date-fns";

interface AdjustmentsTabProps {
  campaignId: string;
  campaignName: string;
  pieces: any[];
  kits: any[];
  kitPieces: any[];
  storePieces: any[];
  stores: any[];
  agencyName: string;
  clientName: string;
  currencyCode: string;
  winnerSupplierId?: string | null;
  hasNegotiationRateio?: boolean;
  negotiationRateioLoading?: boolean;
  onBackToBudgets?: () => void;
  clientEmail?: string | null;
}

function StatusBadge({ status }: { status: AdjustmentStatus }) {
  if (status === "active") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Ativo</Badge>
    );
  }
  if (status === "superseded") {
    return <Badge variant="secondary">Substituído</Badge>;
  }
  return <Badge variant="outline">Rascunho</Badge>;
}

export default function AdjustmentsTab({
  campaignId,
  campaignName,
  pieces,
  kits,
  kitPieces,
  storePieces,
  agencyName,
  clientName,
  currencyCode,
  winnerSupplierId,
  hasNegotiationRateio,
  negotiationRateioLoading,
  onBackToBudgets,
  clientEmail,
}: AdjustmentsTabProps) {
  const { data: adjustments = [], isLoading } = useCampaignAdjustments(campaignId);
  const { data: activeAdjustment } = useActiveAdjustment(campaignId);
  const createMut = useCreateAdjustment();
  const statusMut = useUpdateAdjustmentStatus();
  const deleteMut = useDeleteAdjustment();
  const qc = useQueryClient();

  const handleRevertApproval = async (adjustmentId: string) => {
    if (!window.confirm("Reverter a aprovação desta recotação? Os preços salvos serão mantidos e o status voltará para 'aguardando resposta' para que você possa editar os valores manualmente novamente.")) return;
    const tId = toast.loading("Revertendo aprovação...");
    try {
      const { error } = await supabase
        .from('campaign_adjustment_budget_request' as any)
        .update({ status: 'sent', response_received_at: null })
        .eq('adjustment_id', adjustmentId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['adjustment_budget_requests', campaignId] });
      await qc.invalidateQueries({ queryKey: ['active_adjustment_request', campaignId] });
      toast.success("Aprovação revertida. Clique em 'Registrar resposta manual' para editar os valores.", { id: tId });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao reverter aprovação.", { id: tId });
    }
  };

  const handleCancelResend = async (adjustmentId: string) => {
    if (!window.confirm("Anular este reenvio? A recotação deixará de constar como solicitada e o fornecedor não será notificado dessa ação. (O e-mail já enviado não pode ser recolhido.)")) return;
    const tId = toast.loading("Anulando reenvio...");
    try {
      const { error } = await supabase
        .from('campaign_adjustment_budget_request' as any)
        .delete()
        .eq('adjustment_id', adjustmentId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['adjustment_budget_requests', campaignId] });
      toast.success("Reenvio anulado com sucesso.", { id: tId });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao anular reenvio.", { id: tId });
    }
  };

  const { data: budgetRequests = [] } = useQuery({
    queryKey: ['adjustment_budget_requests', campaignId],
    enabled: !!campaignId && adjustments.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_adjustment_budget_request' as any)
        .select('adjustment_id, status, request_sent_at, response_received_at, adjusted_prices_jsonb')
        .in('adjustment_id', adjustments.map((a) => a.id));
      if (error) throw error;
      return (data || []) as unknown as {
        adjustment_id: string;
        status: string;
        request_sent_at: string;
        response_received_at: string | null;
        adjusted_prices_jsonb: any;
      }[];
    },
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<CampaignAdjustment | null>(null);
  const [requestDialogAdjustment, setRequestDialogAdjustment] = useState<CampaignAdjustment | null>(null);
  const [registerResponseAdjustment, setRegisterResponseAdjustment] = useState<CampaignAdjustment | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [sendClientOpen, setSendClientOpen] = useState(false);
  const [sendSupplierOpen, setSendSupplierOpen] = useState(false);

  const { data: requote } = useActiveAdjustmentRequest(campaignId);
  useRequoteRealtime(campaignId);
  const { exportFinal, isExporting } = useExportRequoteFinal(
    campaignId,
    requote?.adjustment_id,
    requote?.supplier_id,
  );

  const { data: adjPieces } = useQuery({
    queryKey: ["adj_pieces_for_review", activeAdjustment?.id],
    enabled: !!activeAdjustment?.id && reviewOpen,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_adjustment_pieces")
        .select("id, name, code, change_type")
        .eq("adjustment_id", activeAdjustment!.id)
        .eq("is_deleted", false)
        .order("code");
      return data ?? [];
    },
  });

  const { data: adjKits } = useQuery({
    queryKey: ["adj_kits_for_review", activeAdjustment?.id],
    enabled: !!activeAdjustment?.id && reviewOpen,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_adjustment_kits")
        .select("id, name, code")
        .eq("adjustment_id", activeAdjustment!.id)
        .eq("is_deleted", false)
        .order("code");
      return data ?? [];
    },
  });

  // Baseline prices + quantities para o card "Recotação aprovada"
  const approvedEnabled =
    !!requote?.supplier_id && !!requote?.adjustment_id && requote?.status === "approved";

  const { data: approvedBaselinePrices } = useQuery({
    queryKey: ["approved_baseline_prices", requote?.supplier_id],
    enabled: approvedEnabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("budget_prices")
        .select("piece_id, adjusted_unit_price, unit_price")
        .eq("supplier_id", requote!.supplier_id);
      return data ?? [];
    },
  });

  const { data: approvedAdjPieces } = useQuery({
    queryKey: ["approved_adj_pieces", requote?.adjustment_id],
    enabled: approvedEnabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_adjustment_pieces")
        .select("id, source_piece_id, is_deleted")
        .eq("adjustment_id", requote!.adjustment_id)
        .eq("is_deleted", false);
      return data ?? [];
    },
  });

  const { data: approvedStoreQty } = useQuery({
    queryKey: ["approved_store_qty_all_rows_v2", requote?.adjustment_id, requote?.response_received_at],
    enabled: approvedEnabled,
    queryFn: async () => {
      // Paginar — Supabase tem limite default de 1000 linhas por query.
      const pageSize = 1000;
      let from = 0;
      const all: { store_id: string; piece_id: string; quantity: number }[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("campaign_adjustment_store_pieces" as any)
          .select("store_id, piece_id, quantity")
          .eq("adjustment_id", requote!.adjustment_id)
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data ?? []) as unknown as {
          store_id: string;
          piece_id: string;
          quantity: number;
        }[];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const { data: baselinePrices } = useQuery({
    queryKey: ["baseline_prices_review", requote?.supplier_id],
    enabled: !!requote?.supplier_id && reviewOpen,
    queryFn: async () => {
      const { data } = await supabase
        .from("budget_prices")
        .select("piece_id, kit_id, adjusted_unit_price, unit_price")
        .eq("supplier_id", requote!.supplier_id);
      return data ?? [];
    },
  });
  const defaultName = useMemo(
    () => `Ajuste - ${format(new Date(), "dd/MM/yyyy")}`,
    [createOpen]
  );
  const [name, setName] = useState(defaultName);
  const [notes, setNotes] = useState("");

  const hasDraft = adjustments.some((a) => a.status === "draft");

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Informe um nome para o ajuste");
      return;
    }
    if (negotiationRateioLoading) {
      toast.error("Aguarde o rateio da negociação carregar antes de criar o ajuste.");
      return;
    }
    const tId = toast.loading("Criando ajuste e clonando dados da campanha...");
    try {
      await createMut.mutateAsync({
        campaignId,
        name: name.trim(),
        notes: notes.trim() || undefined,
        pieces,
        kits,
        kitPieces,
        storePieces,
        syncedWith: hasNegotiationRateio && winnerSupplierId ? "negotiation" : "original",
      });
      toast.dismiss(tId);
      setCreateOpen(false);
      setName(defaultName);
      setNotes("");
    } catch {
      toast.dismiss(tId);
    }
  };

  const handleActivate = async (a: CampaignAdjustment) => {
    if (activeAdjustment && activeAdjustment.id !== a.id) {
      toast.error("Já existe um ajuste ativo. Marque-o como Substituído antes.");
      return;
    }
    if (!confirm(`Ativar o ajuste "${a.name}"? Ele passará a ser o vigente.`)) return;
    await statusMut.mutateAsync({
      adjustmentId: a.id,
      campaignId,
      status: "active",
    });
  };

  const handleReactivate = async (a: CampaignAdjustment) => {
    const msg = activeAdjustment
      ? `Reativar "${a.name}"?\n\nO ajuste ativo atual ("${activeAdjustment.name}") será automaticamente marcado como Substituído, e o rateio voltará a refletir este ajuste.`
      : `Reativar "${a.name}"? Ele voltará a ser o ajuste vigente da campanha.`;
    if (!confirm(msg)) return;
    try {
      if (activeAdjustment && activeAdjustment.id !== a.id) {
        await statusMut.mutateAsync({
          adjustmentId: activeAdjustment.id,
          campaignId,
          status: "superseded",
        });
      }
      await statusMut.mutateAsync({
        adjustmentId: a.id,
        campaignId,
        status: "active",
      });
    } catch {
      // toast já tratado no hook
    }
  };

  const handleSupersede = async (a: CampaignAdjustment) => {
    if (!confirm(`Marcar "${a.name}" como Substituído?`)) return;
    await statusMut.mutateAsync({
      adjustmentId: a.id,
      campaignId,
      status: "superseded",
    });
  };

  const handleDelete = async (a: CampaignAdjustment) => {
    if (!confirm(`Excluir o ajuste "${a.name}"? Essa ação não pode ser desfeita.`)) return;
    await deleteMut.mutateAsync({ adjustmentId: a.id, campaignId });
  };

  return (
    <div className="space-y-4">
      {onBackToBudgets && (
        <button
          type="button"
          onClick={onBackToBudgets}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Ver em Cotações
        </button>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Ajustes de Mockup</h2>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setName(defaultName);
            setNotes("");
            setCreateOpen(true);
          }}
          disabled={hasDraft}
          title={hasDraft ? "Já existe um rascunho. Edite ou exclua antes de criar outro." : ""}
        >
          <Plus className="w-4 h-4" /> Criar novo ajuste
        </Button>
      </div>

      {activeAdjustment && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-900 dark:text-amber-200">
            Existe um ajuste ativo (<strong>{activeAdjustment.name}</strong>) para esta campanha.
            A cotação vigente é a do ajuste — veja abaixo.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando ajustes...
        </div>
      ) : adjustments.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Layers className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Nenhum ajuste criado. Crie um ajuste após a etapa de mockup para registrar
            alterações nas peças sem perder a cotação original.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {adjustments.map((a) => {
            const req = budgetRequests.find((r) => r.adjustment_id === a.id);
            return (
            <div
              key={a.id}
              className="rounded-lg border border-border bg-card p-3 flex items-start justify-between gap-3 flex-wrap"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                  <StatusBadge status={a.status} />
                  {(() => {
                    const effectiveSync = (hasNegotiationRateio && winnerSupplierId) ? "negotiation" : "original";
                    return (
                      <Badge
                        variant="outline"
                        className={
                          effectiveSync === "negotiation"
                            ? "border-blue-300 text-blue-700 dark:text-blue-300"
                            : "border-slate-300 text-slate-700 dark:text-slate-300"
                        }
                        title="Origem usada como base do rateio do ajuste"
                      >
                        Sincronizado com: {effectiveSync === "negotiation" ? "Negociação" : "Original"}
                      </Badge>
                    );
                  })()}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Criado em{" "}
                  {format(new Date(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {a.approved_at && a.status === "active" && (
                    <>
                      {" · "}Ativado em{" "}
                      {format(new Date(a.approved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </>
                  )}
                </p>
                {a.notes && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{a.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {a.status === "draft" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => setEditingAdjustment(a)}
                    >
                      <Eye className="w-3.5 h-3.5" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleActivate(a)}
                      disabled={statusMut.isPending}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ativar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                      onClick={() => handleDelete(a)}
                      disabled={deleteMut.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </Button>
                  </>
                )}
                {a.status === "active" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => setEditingAdjustment(a)}
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver detalhes
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs gap-1"
                      onClick={() => setRequestDialogAdjustment(a)}
                    >
                      <Send className="w-3.5 h-3.5" /> Solicitar Recotação
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleSupersede(a)}
                      disabled={statusMut.isPending}
                    >
                      <Copy className="w-3.5 h-3.5" /> Substituir
                    </Button>
                  </>
                )}
                {a.status === "superseded" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => setEditingAdjustment(a)}
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver detalhes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      onClick={() => handleReactivate(a)}
                      disabled={statusMut.isPending}
                      title="Volta a ser o ajuste vigente. O ativo atual (se houver) é movido para Substituído."
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reativar
                    </Button>
                  </>
                )}
              </div>
              {/* Full-width row: requote status + cards */}
              <div className="basis-full w-full order-last">
                {a.status === "active" && requote && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          REQUOTE_STATUS_META[requote.status]?.badgeClass ?? ""
                        }`}
                      >
                        {REQUOTE_STATUS_META[requote.status]?.label ?? requote.status}
                      </span>
                      {requote.is_late_submission && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                          Fora do prazo
                        </span>
                      )}
                      {["sent", "filling"].includes(requote.status) && requote.token_expires_at && (
                        <DeadlineCountdown expiresAt={requote.token_expires_at} />
                      )}
                      {requote.status === "submitted" && requote.submitted_at && (
                        <span className="text-xs text-muted-foreground">
                          Recebido{" "}
                          {formatDistanceToNow(new Date(requote.submitted_at), {
                            locale: ptBR,
                            addSuffix: true,
                          })}
                        </span>
                      )}
                    </div>

                    {requote.status === "submitted" && (
                      <div className="rounded-md border border-purple-300 bg-purple-50 dark:bg-purple-950/30 p-3 flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                            Recotação recebida — aguardando sua revisão
                          </div>
                          <div className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                            {requote.is_late_submission && "⚠️ Enviado fora do prazo · "}
                            {requote.submitted_at && (
                              <>
                                Recebido{" "}
                                {format(new Date(requote.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => setReviewOpen(true)}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            Revisar resposta
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRegisterResponseAdjustment(a)}
                            className="gap-1.5"
                            title="Registrar resposta manualmente"
                          >
                            <FileInput className="w-3.5 h-3.5" /> Manual
                          </Button>
                        </div>
                      </div>
                    )}

                    {["sent", "filling"].includes(requote.status) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRegisterResponseAdjustment(a)}
                          className="h-7 text-xs gap-1.5"
                        >
                          <FileInput className="w-3.5 h-3.5" /> Registrar resposta manual
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancelResend(a.id)}
                          className="h-7 text-xs gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                          title="Anula a marcação de recotação solicitada no sistema (não recolhe o e-mail já enviado)"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Anular Reenvio
                        </Button>
                      </div>
                    )}

                    {requote.status === "approved" && (() => {
                      const j = (requote.adjusted_prices_jsonb || {}) as {
                        prices?: { piece_id: string; new_price: number }[];
                        installation?: number;
                        freight?: number;
                      };
                      const extras = (requote.adjusted_extras_jsonb || {}) as {
                        installation?: number;
                        freight?: number;
                      };
                      const inst = Number(extras.installation ?? j.installation ?? 0);
                      const frt = Number(extras.freight ?? j.freight ?? 0);

                      // Map: adj_piece_id -> source_piece_id (para casar com budget_prices)
                      const sourceByAdj = new Map<string, string | null>();
                      for (const p of approvedAdjPieces || []) {
                        sourceByAdj.set(String(p.id), p.source_piece_id ? String(p.source_piece_id) : null);
                      }
                      // Map: source_piece_id -> preço anterior
                      const prevBySource = new Map<string, number>();
                      for (const r of approvedBaselinePrices || []) {
                        if (!r.piece_id) continue;
                        prevBySource.set(
                          String(r.piece_id),
                          Number(r.adjusted_unit_price ?? r.unit_price ?? 0),
                        );
                      }
                      // Map: adj_piece_id -> qty total por peça em todas as lojas.
                      // Esta tabela já contém a quantidade final de cada peça, incluindo
                      // peças standalone e peças que compõem kits.
                      const qtyByAdj = new Map<string, number>();
                      for (const sp of approvedStoreQty || []) {
                        const pid = String(sp.piece_id);
                        const q = Number(sp.quantity || 0);
                        qtyByAdj.set(pid, (qtyByAdj.get(pid) || 0) + q);
                      }

                      let changedCount = 0;
                      const newPriceByAdj = new Map<string, number>();
                      for (const row of j.prices || []) {
                        const adjId = String(row.piece_id);
                        const newPrice = Number(row.new_price) || 0;
                        newPriceByAdj.set(adjId, newPrice);
                        const srcId = sourceByAdj.get(adjId);
                        const prevPrice = srcId ? (prevBySource.get(srcId) || 0) : 0;
                        if (Math.abs(newPrice - prevPrice) > 0.005) changedCount++;
                      }

                      let productionTotal = 0;
                      let baselineProductionTotal = 0;
                      let totalQty = 0;
                      let pieceCount = 0;
                      let maxIncreasePct = 0;
                      let maxIncreaseLabel = "";
                      for (const p of approvedAdjPieces || []) {
                        const adjId = String(p.id);
                        const srcId = sourceByAdj.get(adjId);
                        const prevPrice = srcId ? (prevBySource.get(srcId) || 0) : 0;
                        const price = newPriceByAdj.has(adjId)
                          ? newPriceByAdj.get(adjId) || 0
                          : prevPrice;
                        const qty = qtyByAdj.get(adjId) || 0;
                        productionTotal += price * qty;
                        baselineProductionTotal += prevPrice * qty;
                        totalQty += qty;
                        if (qty > 0) pieceCount++;
                        if (prevPrice > 0 && qty > 0) {
                          const pct = ((price - prevPrice) / prevPrice) * 100;
                          if (pct > maxIncreasePct) {
                            maxIncreasePct = pct;
                            maxIncreaseLabel = (p as any).name || (p as any).code?.toString() || "";
                          }
                        }
                      }
                      const grandTotal = productionTotal + inst + frt;
                      const deltaAbs = productionTotal - baselineProductionTotal;
                      const deltaPct =
                        baselineProductionTotal > 0
                          ? (deltaAbs / baselineProductionTotal) * 100
                          : 0;
                      const storeCount = new Set(
                        (approvedStoreQty || [])
                          .filter((sp: any) => Number(sp.quantity || 0) > 0)
                          .map((sp: any) => String(sp.store_id)),
                      ).size;
                      const ready =
                        !!approvedAdjPieces &&
                        !!approvedBaselinePrices &&
                        !!approvedStoreQty;

                      const deltaColor =
                        deltaAbs > 0
                          ? "text-red-700"
                          : deltaAbs < 0
                            ? "text-emerald-700"
                            : "text-slate-700";
                      const deltaSign = deltaAbs > 0 ? "+" : "";

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Card 1: Resumo + KPIs da recotação aprovada */}
                          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm flex flex-col gap-2">
                            <div>
                              <div className="font-medium text-green-800">✅ Recotação aprovada</div>
                              <div className="text-green-700 text-[11px] mt-0.5">
                                {ready ? changedCount : "…"} item(ns) com novo preço
                                {requote.response_received_at && (
                                  <>
                                    {" "}· Registrado em{" "}
                                    {format(new Date(requote.response_received_at), "dd/MM/yyyy", {
                                      locale: ptBR,
                                    })}
                                  </>
                                )}
                              </div>
                            </div>

                            {ready && (
                              <>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div className="rounded bg-white/70 border border-green-200 px-2 py-1.5">
                                    <div className="text-[10px] uppercase tracking-wide text-green-700/80">Produção</div>
                                    <div className="text-sm font-semibold text-green-900 leading-tight">
                                      {formatCurrencyByCode(productionTotal, currencyCode)}
                                    </div>
                                  </div>
                                  <div className="rounded bg-white/70 border border-green-200 px-2 py-1.5">
                                    <div className="text-[10px] uppercase tracking-wide text-green-700/80">
                                      Variação vs. base
                                    </div>
                                    <div className={`text-sm font-semibold leading-tight ${deltaColor}`}>
                                      {deltaSign}
                                      {formatCurrencyByCode(deltaAbs, currencyCode)}
                                      <span className="text-[11px] font-normal ml-1">
                                        ({deltaSign}
                                        {deltaPct.toFixed(1)}%)
                                      </span>
                                    </div>
                                  </div>
                                  <div className="rounded bg-white/70 border border-green-200 px-2 py-1.5">
                                    <div className="text-[10px] uppercase tracking-wide text-green-700/80">
                                      Instalação
                                    </div>
                                    <div className="text-sm font-semibold text-green-900 leading-tight">
                                      {formatCurrencyByCode(inst, currencyCode)}
                                    </div>
                                  </div>
                                  <div className="rounded bg-white/70 border border-green-200 px-2 py-1.5">
                                    <div className="text-[10px] uppercase tracking-wide text-green-700/80">Frete</div>
                                    <div className="text-sm font-semibold text-green-900 leading-tight">
                                      {formatCurrencyByCode(frt, currencyCode)}
                                    </div>
                                  </div>
                                  <div className="rounded bg-white/70 border border-green-200 px-2 py-1.5">
                                    <div className="text-[10px] uppercase tracking-wide text-green-700/80">
                                      Peças × Lojas
                                    </div>
                                    <div className="text-sm font-semibold text-green-900 leading-tight">
                                      {pieceCount} × {storeCount}
                                    </div>
                                    <div className="text-[10px] text-green-700/80">
                                      {totalQty.toLocaleString("pt-BR")} unidades
                                    </div>
                                  </div>
                                  <div className="rounded bg-white/70 border border-green-200 px-2 py-1.5">
                                    <div className="text-[10px] uppercase tracking-wide text-green-700/80">
                                      Maior aumento
                                    </div>
                                    <div className="text-sm font-semibold text-red-700 leading-tight">
                                      {maxIncreasePct > 0 ? `+${maxIncreasePct.toFixed(1)}%` : "—"}
                                    </div>
                                    {maxIncreaseLabel && (
                                      <div
                                        className="text-[10px] text-green-700/80 truncate"
                                        title={maxIncreaseLabel}
                                      >
                                        {maxIncreaseLabel}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-auto pt-1.5 border-t border-green-200 text-xs text-green-900">
                                  Valor total (com frete e instalação):{" "}
                                  <strong>{formatCurrencyByCode(grandTotal, currencyCode)}</strong>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Card 2: Planilha final + reverter */}
                          {requote.status === "approved" && (
                            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm flex flex-col">
                              <p className="text-sm font-medium text-emerald-900">
                                Planilha final disponível
                              </p>
                              <p className="text-xs text-emerald-700 mt-0.5">
                                Gere a planilha final com novos preços, rateio e comparativo.
                              </p>
                              <div className="mt-auto pt-3 flex flex-col gap-2">
                                <Button
                                  size="sm"
                                  onClick={exportFinal}
                                  disabled={isExporting}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 w-full"
                                >
                                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                                  {isExporting ? "Gerando..." : "Baixar planilha final"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRevertApproval(a.id)}
                                  className="gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-50 w-full"
                                  title="Reverter aprovação para editar os valores novamente"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Reverter aprovação
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Card 3: Envios */}
                          {requote.status === "approved" && (
                            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm flex flex-col">
                              <p className="text-sm font-medium text-blue-900">
                                Compartilhar pacote
                              </p>
                              <p className="text-xs text-blue-700 mt-0.5">
                                Envie a planilha final e o Guia Visual ao cliente ou libere para o fornecedor.
                              </p>
                              <div className="mt-auto pt-3 flex flex-col gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSendClientOpen(true)}
                                  className="gap-1.5 border-emerald-500 text-emerald-700 hover:bg-emerald-100 bg-white w-full"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                  Enviar ao cliente
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSendSupplierOpen(true)}
                                  className="gap-1.5 border-blue-500 text-blue-700 hover:bg-blue-100 bg-white w-full"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                  Avisar fornecedor
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {requote.status === "rejected" && requote.rejection_notes && (
                      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                        <div className="font-medium mb-0.5">Motivo da recusa</div>
                        <p className="whitespace-pre-wrap">{requote.rejection_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar novo ajuste</DialogTitle>
            <DialogDescription>
              Será criado um snapshot completo das peças, kits e do rateio atual da campanha
              <strong> {campaignName}</strong>. Pode levar alguns segundos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="adj-name" className="text-xs">Nome do ajuste *</Label>
              <Input
                id="adj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ajuste - dd/mm/aaaa"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adj-notes" className="text-xs">Notas (opcional)</Label>
              <Textarea
                id="adj-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Descreva brevemente o que foi alterado neste ajuste..."
                rows={3}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {pieces.length} peças · {kits.length} kits · {storePieces.filter((s) => Number(s.quantity || 0) > 0).length} células de rateio serão clonadas.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMut.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Criar ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingAdjustment && (
        <AdjustmentDetailSheet
          open={!!editingAdjustment}
          onOpenChange={(v) => !v && setEditingAdjustment(null)}
          adjustment={editingAdjustment}
          campaignId={campaignId}
          campaignName={campaignName}
          winnerSupplierId={winnerSupplierId}
          hasNegotiationRateio={hasNegotiationRateio}
        />
      )}

      {requestDialogAdjustment && (
        <AdjustmentBudgetRequestDialog
          open={!!requestDialogAdjustment}
          onOpenChange={(v) => !v && setRequestDialogAdjustment(null)}
          adjustment={requestDialogAdjustment}
          campaignId={campaignId}
          campaignName={campaignName}
          agencyName={agencyName}
          clientName={clientName}
          currencyCode={currencyCode}
          winnerSupplierId={winnerSupplierId}
          hasNegotiationRateio={!!hasNegotiationRateio}
        />
      )}

      {registerResponseAdjustment && (
        <AdjustmentRegisterResponseDialog
          open={!!registerResponseAdjustment}
          onOpenChange={(v) => !v && setRegisterResponseAdjustment(null)}
          adjustment={registerResponseAdjustment}
          campaignId={campaignId}
          campaignName={campaignName}
          currencyCode={currencyCode}
        />
      )}

      {requote && (
        <ReviewRequoteDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          requote={requote}
          pieces={adjPieces ?? []}
          kits={adjKits ?? []}
          baselinePrices={baselinePrices ?? []}
          campaignId={campaignId}
        />
      )}

      {requote?.adjustment_id && requote?.supplier_id && (
        <>
          <SendAdjustmentToClientDialog
            open={sendClientOpen}
            onOpenChange={setSendClientOpen}
            campaignId={campaignId}
            adjustmentId={requote.adjustment_id}
            adjustmentName={activeAdjustment?.name ?? ""}
            supplierId={requote.supplier_id}
            campaignName={campaignName}
            agencyName={agencyName}
            clientName={clientName}
            defaultClientEmail={clientEmail ?? null}
          />
          <SendAdjustmentToSupplierDialog
            open={sendSupplierOpen}
            onOpenChange={setSendSupplierOpen}
            campaignId={campaignId}
            adjustmentId={requote.adjustment_id}
            adjustmentName={activeAdjustment?.name ?? ""}
            supplierId={requote.supplier_id}
            campaignName={campaignName}
            agencyName={agencyName}
            clientName={clientName}
          />
        </>
      )}
    </div>
  );
}
