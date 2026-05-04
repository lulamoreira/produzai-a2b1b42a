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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Image as ImageIcon, Wrench } from "lucide-react";

interface Props {
  data: PortalData;
  agencyId: string;
}

export default function ManutencaoTab({ data, agencyId }: Props) {
  const [selectedPeca, setSelectedPeca] = useState<PortalData["pecas"][number] | null>(null);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("media");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);

  const loadRequests = useCallback(async () => {
    const { data: rows } = await supabase
      .from("store_maintenance_requests")
      .select("*")
      .eq("campaign_id", data.campaign.id)
      .eq("store_id", data.store.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setRequests(rows || []);
  }, [data.campaign.id, data.store.id]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const badgeCounts: Record<string, number> = {};
  requests.filter(r => r.status !== "concluido").forEach(r => {
    if (r.loja_a_loja_peca_id) {
      badgeCounts[r.loja_a_loja_peca_id] = (badgeCounts[r.loja_a_loja_peca_id] || 0) + 1;
    }
  });

  const handleSubmit = async () => {
    if (!selectedPeca || !description.trim()) { toast.error("Preencha a descrição."); return; }
    setSubmitting(true);

    const peca = selectedPeca;
    const { data: inserted, error } = await supabase.from("store_maintenance_requests").insert({
      campaign_id: data.campaign.id,
      store_id: data.store.id,
      loja_a_loja_peca_id: peca.id,
      tipo_id: peca.tipo_id,
      subdivisao_id: peca.subdivisao_id,
      description: description.trim(),
      priority,
      photo_urls: photos.length > 0 ? photos : null,
      opened_by: "loja",
    }).select("id").single();

    if (error) {
      toast.error("Erro ao solicitar manutenção.");
      console.error(error);
    } else {
      toast.success("Solicitação de manutenção enviada!");
      try {
        const manId = (inserted as any)?.id;
        await criarNotificacao({
          agency_id: agencyId,
          campaign_id: data.campaign.id,
          store_id: data.store.id,
          client_id: data.campaign.client_id,
          type: "store_maintenance_request",
          title: "Nova solicitação de manutenção",
          body: `${data.store.name} solicitou manutenção na peça "${peca.nome}".`,
          action_url: manId
            ? `/agency/${agencyId}/clients/${data.campaign.client_id}/campaigns/${data.campaign.id}?section=occurrences&tab=portal-dashboard&man=${manId}`
            : `/agency/${agencyId}/clients/${data.campaign.client_id}/campaigns/${data.campaign.id}?section=occurrences&tab=portal-dashboard`,
        });
      } catch {}
      setSelectedPeca(null);
      setDescription("");
      setPriority("media");
      setPhotos([]);
      loadRequests();
    }
    setSubmitting(false);
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "aberto": return { label: "Aberto", cls: "bg-yellow-500 text-white" };
      case "em_andamento": return { label: "Em andamento", cls: "bg-blue-500 text-white" };
      case "concluido": return { label: "Concluído", cls: "bg-green-500 text-white" };
      default: return { label: s, cls: "bg-muted text-muted-foreground" };
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">Toque em uma peça para solicitar manutenção.</p>

      <StorePortalPieceGrid data={data} onPieceClick={setSelectedPeca} badgeCounts={badgeCounts} badgeColor="bg-blue-500" />

      {requests.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Wrench className="w-4 h-4" /> Solicitações ({requests.length})</h3>
          <div className="space-y-2">
            {requests.map(r => {
              const peca = data.pecas.find(p => p.id === r.loja_a_loja_peca_id);
              const st = statusLabel(r.status);
              return (
                <div key={r.id} className="rounded-lg border border-border p-3 bg-card text-sm">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-medium">{peca?.nome || "Peça"}</p>
                      <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{r.description}</p>
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
            <DialogTitle className="text-base">Solicitar Manutenção</DialogTitle>
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
                <label className="text-xs font-medium text-foreground mb-1 block">Descrição *</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o que precisa de manutenção..." className="min-h-[80px]" />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Prioridade</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critica">Crítica</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <StorePortalPhotoUpload photos={photos} onPhotosChange={setPhotos} uploading={uploading} onUploadingChange={setUploading} bucketPath={`store-portal/${data.token_id}`} />

              <Button onClick={handleSubmit} disabled={submitting || uploading || !description.trim()} className="w-full bg-[#8C6F4E] hover:bg-[#7a6043]">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enviando...</> : "Enviar Solicitação"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
