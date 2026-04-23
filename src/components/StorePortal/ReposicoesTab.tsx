import { useState, useEffect, useCallback } from "react";
import { getThumbnailUrl } from "@/lib/imageUrl";
import { supabase } from "@/integrations/supabase/client";
import { criarNotificacao } from "@/lib/criarNotificacao";
import { toast } from "sonner";
import type { PortalData } from "@/pages/StorePortal";
import StorePortalPieceGrid from "./StorePortalPieceGrid";
import StorePortalPhotoUpload from "./StorePortalPhotoUpload";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Image as ImageIcon, RefreshCw } from "lucide-react";

interface Props {
  data: PortalData;
  agencyId: string;
}

export default function ReposicoesTab({ data, agencyId }: Props) {
  const [selectedPeca, setSelectedPeca] = useState<PortalData["pecas"][number] | null>(null);
  const [reason, setReason] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);

  const loadRequests = useCallback(async () => {
    const { data: rows } = await supabase
      .from("store_replacement_requests")
      .select("*")
      .eq("campaign_id", data.campaign.id)
      .eq("store_id", data.store.id)
      .order("requested_at", { ascending: false })
      .limit(50);
    setRequests(rows || []);
  }, [data.campaign.id, data.store.id]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  // Build status map per piece (latest request status)
  const statusMap: Record<string, string> = {};
  requests.forEach(r => {
    if (r.loja_a_loja_peca_id && !statusMap[r.loja_a_loja_peca_id]) {
      statusMap[r.loja_a_loja_peca_id] = r.status;
    }
  });

  const handleSubmit = async () => {
    if (!selectedPeca || !reason.trim()) { toast.error("Preencha o motivo."); return; }
    setSubmitting(true);

    const peca = selectedPeca;
    const { error } = await supabase.from("store_replacement_requests").insert({
      token_id: data.token_id,
      campaign_id: data.campaign.id,
      store_id: data.store.id,
      loja_a_loja_peca_id: peca.id,
      tipo_id: peca.tipo_id,
      subdivisao_id: peca.subdivisao_id,
      reason: reason.trim(),
      quantity_requested: quantity,
      photo_urls: photos.length > 0 ? photos : null,
      status: "pendente",
    });

    if (error) {
      toast.error("Erro ao solicitar reposição.");
      console.error(error);
    } else {
      toast.success("Solicitação de reposição enviada!");
      try {
        await criarNotificacao({
          agency_id: agencyId,
          campaign_id: data.campaign.id,
          store_id: data.store.id,
          type: "store_replacement_request",
          title: "Nova solicitação de reposição",
          body: `${data.store.name} solicitou reposição de ${quantity}x "${peca.nome}".`,
        });
      } catch {}
      setSelectedPeca(null);
      setReason("");
      setQuantity(1);
      setPhotos([]);
      loadRequests();
    }
    setSubmitting(false);
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "pendente": return { label: "Pendente", cls: "bg-yellow-500 text-white" };
      case "aprovado": return { label: "Aprovado", cls: "bg-blue-500 text-white" };
      case "enviado": return { label: "Enviado", cls: "bg-green-500 text-white" };
      case "recusado": return { label: "Recusado", cls: "bg-red-500 text-white" };
      default: return { label: s, cls: "bg-muted text-muted-foreground" };
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">Toque em uma peça para solicitar reposição de material.</p>

      <StorePortalPieceGrid data={data} onPieceClick={setSelectedPeca} statusMap={statusMap} />

      {requests.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Solicitações ({requests.length})</h3>
          <div className="space-y-2">
            {requests.map(r => {
              const peca = data.pecas.find(p => p.id === r.loja_a_loja_peca_id);
              const st = statusLabel(r.status);
              return (
                <div key={r.id} className="rounded-lg border border-border p-3 bg-card text-sm">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-medium">{peca?.nome || "Peça"} <span className="text-muted-foreground">x{r.quantity_requested}</span></p>
                      <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{r.reason}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!selectedPeca} onOpenChange={open => { if (!open) setSelectedPeca(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Solicitar Reposição</DialogTitle>
          </DialogHeader>
          {selectedPeca && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-md bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                  {selectedPeca.image_url ? (
                    <img src={getThumbnailUrl(selectedPeca.image_url, 200)} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                  )}
                </div>
                <p className="font-medium text-sm">{selectedPeca.nome}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Motivo *</label>
                <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Descreva o motivo da reposição..." className="min-h-[80px]" />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Quantidade</label>
                <Input type="number" min={1} value={quantity} onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="w-24" />
              </div>

              <StorePortalPhotoUpload photos={photos} onPhotosChange={setPhotos} uploading={uploading} onUploadingChange={setUploading} bucketPath={`store-portal/${data.token_id}`} />

              <Button onClick={handleSubmit} disabled={submitting || uploading || !reason.trim()} className="w-full bg-[#8C6F4E] hover:bg-[#7a6043]">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enviando...</> : "Enviar Solicitação"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
