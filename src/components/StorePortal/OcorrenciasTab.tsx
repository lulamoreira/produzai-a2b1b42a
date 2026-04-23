import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Loader2, Image as ImageIcon } from "lucide-react";

interface Props {
  data: PortalData;
  agencyId: string;
}

export default function OcorrenciasTab({ data, agencyId }: Props) {
  const [selectedPeca, setSelectedPeca] = useState<PortalData["pecas"][number] | null>(null);
  const [blockedPeca, setBlockedPeca] = useState<PortalData["pecas"][number] | null>(null);
  const [reporterType, setReporterType] = useState("lojista");
  const [motiveId, setMotiveId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("media");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reports, setReports] = useState<any[]>([]);

  const handlePieceClick = (peca: PortalData["pecas"][number]) => {
    if (peca.nome.includes("*")) {
      setBlockedPeca(peca);
    } else {
      setSelectedPeca(peca);
    }
  };

  const blockedMessage = data.portal_config?.blocked_piece_message
    || "Esta peça está bloqueada para reporte de ocorrências no momento.";

  const motivos = data.motivos ?? [];
  const sortedMotivos = useMemo(
    () => [...motivos].sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR")),
    [motivos]
  );

  const reporterOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [
      { value: "lojista", label: "Lojista" },
      { value: "fornecedor", label: "Fornecedor" },
    ];
    const agencyName = data.campaign?.clients?.agencies?.name;
    const clientName = data.campaign?.clients?.name;
    if (agencyName) opts.push({ value: `agencia:${agencyName}`, label: agencyName });
    if (clientName) opts.push({ value: `cliente:${clientName}`, label: clientName });
    return opts;
  }, [data]);

  const loadReports = useCallback(async () => {
    const { data: rows } = await supabase
      .from("store_occurrence_reports")
      .select("*")
      .eq("campaign_id", data.campaign.id)
      .eq("store_id", data.store.id)
      .neq("status", "resolvido");
    setReports(rows || []);
  }, [data.campaign.id, data.store.id]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const badgeCounts: Record<string, number> = {};
  reports.forEach(r => {
    if (r.loja_a_loja_peca_id) {
      badgeCounts[r.loja_a_loja_peca_id] = (badgeCounts[r.loja_a_loja_peca_id] || 0) + 1;
    }
  });

  const resetForm = () => {
    setSelectedPeca(null);
    setReporterType("lojista");
    setMotiveId("");
    setDescription("");
    setPriority("media");
    setPhotos([]);
  };

  const handleSubmit = async () => {
    if (!selectedPeca) return;
    if (!motiveId) { toast.error("Selecione o motivo."); return; }
    setSubmitting(true);

    const peca = selectedPeca;
    const { error } = await supabase.from("store_occurrence_reports").insert({
      token_id: data.token_id,
      campaign_id: data.campaign.id,
      store_id: data.store.id,
      loja_a_loja_peca_id: peca.id,
      tipo_id: peca.tipo_id,
      subdivisao_id: peca.subdivisao_id,
      description: description.trim() || null,
      priority,
      photo_urls: photos.length > 0 ? photos : null,
      reporter_type: reporterType,
      motive_id: motiveId,
    } as any);

    if (error) {
      toast.error("Erro ao salvar ocorrência.");
      console.error(error);
    } else {
      toast.success("Ocorrência registrada com sucesso!");
      try {
        await criarNotificacao({
          agency_id: agencyId,
          campaign_id: data.campaign.id,
          store_id: data.store.id,
          client_id: data.campaign.client_id,
          type: "store_occurrence_report",
          title: "Nova ocorrência da loja",
          body: `${data.store.name} reportou uma ocorrência na peça "${peca.nome}".`,
        });
      } catch {}
      resetForm();
      loadReports();
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">Toque em uma peça para reportar uma ocorrência.</p>

      <StorePortalPieceGrid data={data} onPieceClick={handlePieceClick} badgeCounts={badgeCounts} />

      {/* Existing reports */}
      {reports.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-2">Ocorrências abertas ({reports.length})</h3>
          <div className="space-y-2">
            {reports.map(r => {
              const peca = data.pecas.find(p => p.id === r.loja_a_loja_peca_id);
              return (
                <div key={r.id} className="rounded-lg border border-border p-3 bg-card text-sm">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-medium">{peca?.nome || "Peça"}</p>
                      <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{r.description}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      r.priority === "critica" ? "bg-red-600 text-white" :
                      r.priority === "alta" ? "bg-orange-500 text-white" :
                      r.priority === "media" ? "bg-yellow-500 text-white" :
                      "bg-blue-400 text-white"
                    }`}>{r.priority}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={!!selectedPeca} onOpenChange={open => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Reportar Ocorrência</DialogTitle>
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
                <label className="text-xs font-medium text-foreground mb-1 block">Reportado por *</label>
                <Select value={reporterType} onValueChange={setReporterType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {reporterOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Motivo *</label>
                <Select value={motiveId} onValueChange={setMotiveId}>
                  <SelectTrigger>
                    <SelectValue placeholder={sortedMotivos.length === 0 ? "Nenhum motivo cadastrado" : "Selecione o motivo"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedMotivos.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.descricao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Descrição (não obrigatório)</label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Descreva o problema encontrado..."
                  className="min-h-[80px]"
                />
              </div>

              {data.portal_config?.show_priority !== false && (
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
              )}

              <StorePortalPhotoUpload
                photos={photos}
                onPhotosChange={setPhotos}
                uploading={uploading}
                onUploadingChange={setUploading}
                bucketPath={`store-portal/${data.token_id}`}
              />

              <Button onClick={handleSubmit} disabled={submitting || uploading || !motiveId} className="w-full bg-[#8C6F4E] hover:bg-[#7a6043]">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enviando...</> : "Enviar Ocorrência"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Blocked piece dialog */}
      <Dialog open={!!blockedPeca} onOpenChange={(open) => { if (!open) setBlockedPeca(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Peça bloqueada</DialogTitle>
          </DialogHeader>
          {blockedPeca && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-md bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                  {blockedPeca.image_url ? (
                    <img src={getThumbnailUrl(blockedPeca.image_url, 200)} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover grayscale" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                  )}
                </div>
                <p className="font-medium text-sm">{blockedPeca.nome}</p>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{blockedMessage}</p>
              <Button onClick={() => setBlockedPeca(null)} variant="outline" className="w-full">
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
