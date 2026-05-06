import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Layers, Plus, Trash2, CheckCircle2, Eye, Copy, AlertTriangle, Loader2 } from "lucide-react";
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

interface AdjustmentsTabProps {
  campaignId: string;
  campaignName: string;
  pieces: any[];
  kits: any[];
  kitPieces: any[];
  storePieces: any[];
  stores: any[];
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
}: AdjustmentsTabProps) {
  const { data: adjustments = [], isLoading } = useCampaignAdjustments(campaignId);
  const { data: activeAdjustment } = useActiveAdjustment(campaignId);
  const createMut = useCreateAdjustment();
  const statusMut = useUpdateAdjustmentStatus();
  const deleteMut = useDeleteAdjustment();

  const [createOpen, setCreateOpen] = useState(false);
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
            O orçamento vigente é o do ajuste — veja abaixo.
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
            alterações nas peças sem perder o orçamento original.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {adjustments.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-border bg-card p-3 flex items-start justify-between gap-3 flex-wrap"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                  <StatusBadge status={a.status} />
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
                      onClick={() => toast.info("Edição detalhada chega na próxima fase.")}
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
                      onClick={() => toast.info("Visualização detalhada chega na próxima fase.")}
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver detalhes
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => toast.info("Visualização detalhada chega na próxima fase.")}
                  >
                    <Eye className="w-3.5 h-3.5" /> Ver detalhes
                  </Button>
                )}
              </div>
            </div>
          ))}
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
    </div>
  );
}
