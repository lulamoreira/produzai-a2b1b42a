import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, AlertTriangle, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  type AdjustmentBudgetRequest,
  useApproveRequote,
  useRejectRequote,
} from "@/hooks/useAdjustmentBudgetRequest";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requote: AdjustmentBudgetRequest;
  pieces: any[];
  kits: any[];
  baselinePrices: any[];
  campaignId: string;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function ReviewRequoteDialog({ open, onOpenChange, requote, pieces, kits, baselinePrices }: Props) {
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const approveRequote = useApproveRequote();
  const rejectRequote = useRejectRequote();

  const submittedPrices: any[] = requote.adjusted_prices_jsonb?.prices ?? [];
  const submittedKitPrices: any[] = requote.adjusted_prices_jsonb?.kits ?? [];
  const submittedInstallation =
    requote.adjusted_extras_jsonb?.installation ??
    requote.adjusted_prices_jsonb?.installation ??
    null;
  const submittedFreight =
    requote.adjusted_extras_jsonb?.freight ??
    requote.adjusted_prices_jsonb?.freight ??
    null;

  const getPreviousPrice = (pieceId?: string, kitId?: string) => {
    const row = baselinePrices?.find(
      (p) => (pieceId && p.piece_id === pieceId) || (kitId && p.kit_id === kitId)
    );
    return row?.adjusted_unit_price ?? row?.unit_price ?? 0;
  };

  const getNewPrice = (pieceId?: string, kitId?: string): number | null => {
    const row = [...submittedPrices, ...submittedKitPrices].find(
      (p) => (pieceId && p.piece_id === pieceId) || (kitId && p.kit_id === kitId)
    );
    const v = row?.new_price;
    return v === undefined || v === null ? null : Number(v);
  };

  const handleApprove = async () => {
    await approveRequote.mutateAsync(requote.id);
    onOpenChange(false);
  };

  const handleReject = async () => {
    if (!rejectionNotes.trim()) {
      toast.error("Informe o motivo da recusa");
      return;
    }
    await rejectRequote.mutateAsync({
      requestId: requote.id,
      rejectionNotes: rejectionNotes.trim(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2">
            Revisar recotação
            {requote.is_late_submission && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Fora do prazo
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Confira os preços enviados pelo fornecedor antes de aprovar.
            {requote.submitted_at && (
              <span className="block mt-0.5 text-xs">
                Enviado em {format(new Date(requote.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-4">
          {requote.notes && (
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
                <MessageSquare className="w-3.5 h-3.5" />
                Observação do fornecedor
              </div>
              <p className="text-sm whitespace-pre-wrap">{requote.notes}</p>
            </div>
          )}

          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-xs">Peça / Kit</th>
                  <th className="text-right px-3 py-2 font-medium text-xs">Anterior</th>
                  <th className="text-right px-3 py-2 font-medium text-xs">Novo preço</th>
                  <th className="text-right px-3 py-2 font-medium text-xs">Variação</th>
                </tr>
              </thead>
              <tbody>
                {pieces.map((piece) => {
                  const prev = Number(getPreviousPrice(piece.id) || 0);
                  const next = getNewPrice(piece.id);
                  const diff = next !== null ? next - prev : null;
                  const pct = prev > 0 && diff !== null ? (diff / prev) * 100 : null;
                  return (
                    <tr key={piece.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="font-medium">{piece.name}</div>
                        <div className="text-xs text-muted-foreground">{piece.code}</div>
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrency(prev)}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {next !== null ? formatCurrency(next) : "—"}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${
                          diff === null
                            ? "text-muted-foreground"
                            : diff > 0
                            ? "text-red-600"
                            : diff < 0
                            ? "text-green-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {pct !== null ? `${diff! > 0 ? "+" : ""}${pct.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
                {kits.map((kit) => {
                  const prev = Number(getPreviousPrice(undefined, kit.id) || 0);
                  const next = getNewPrice(undefined, kit.id);
                  const diff = next !== null ? next - prev : null;
                  const pct = prev > 0 && diff !== null ? (diff / prev) * 100 : null;
                  return (
                    <tr key={kit.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="font-medium">{kit.name}</div>
                        <div className="text-xs text-muted-foreground">{kit.code} · Kit</div>
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrency(prev)}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {next !== null ? formatCurrency(next) : "—"}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${
                          diff === null
                            ? "text-muted-foreground"
                            : diff > 0
                            ? "text-red-600"
                            : diff < 0
                            ? "text-green-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {pct !== null ? `${diff! > 0 ? "+" : ""}${pct.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(submittedInstallation !== null || submittedFreight !== null) && (
            <div className="rounded-md border border-border p-3 space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Instalação e Frete
              </div>
              {submittedInstallation !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span>Instalação</span>
                  <span className="font-semibold">{formatCurrency(Number(submittedInstallation))}</span>
                </div>
              )}
              {submittedFreight !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span>Frete</span>
                  <span className="font-semibold">{formatCurrency(Number(submittedFreight))}</span>
                </div>
              )}
            </div>
          )}

          {showRejectForm && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-2">
              <div className="text-xs font-semibold text-red-700">Motivo da recusa</div>
              <Textarea
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Explique por que está recusando os preços..."
                rows={3}
                className="bg-white"
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => {
              if (showRejectForm) setShowRejectForm(false);
              else onOpenChange(false);
            }}
          >
            {showRejectForm ? "Voltar" : "Fechar"}
          </Button>
          <div className="flex gap-2">
            {!showRejectForm && (
              <Button
                variant="outline"
                onClick={() => setShowRejectForm(true)}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                Recusar
              </Button>
            )}
            {showRejectForm ? (
              <Button
                onClick={handleReject}
                disabled={rejectRequote.isPending || !rejectionNotes.trim()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {rejectRequote.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Confirmar recusa
              </Button>
            ) : (
              <Button
                onClick={handleApprove}
                disabled={approveRequote.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {approveRequote.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Aprovar recotação
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
