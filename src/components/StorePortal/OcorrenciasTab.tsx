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
import { Loader2, Image as ImageIcon, ArrowLeft, ChevronDown, ChevronUp, MessageCircle, Share2, ClipboardList } from "lucide-react";
import { useEffectiveTratativaStatuses, type TratativaStatus } from "@/hooks/useLalTratativaStatuses";

interface Props {
  data: PortalData;
  agencyId: string;
}

function getTratativaDisplay(status: string, statuses: TratativaStatus[]) {
  const found = statuses.find((s) => s.value === status);
  if (found) {
    return {
      label: found.label,
      className: "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white",
      style: { backgroundColor: found.color },
    };
  }
  const fallbackLabel = status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
  return {
    label: fallbackLabel,
    className: "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-white",
    style: {} as React.CSSProperties,
  };
}

function formatDateBR(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function buildWhatsAppMessage(r: any, data: PortalData, statuses: TratativaStatus[]) {
  const peca = data.pecas.find(p => p.id === r.loja_a_loja_peca_id);
  const tipo = data.tipos.find(t => t.id === r.tipo_id);
  const subdivisao = data.subdivisoes.find(s => s.id === r.subdivisao_id);
  const motivo = data.motivos?.find(m => m.id === r.motive_id);
  const statusInfo = getTratativaDisplay(r.tratativa_status ?? r.status ?? "aberta", statuses);
  const local = [tipo?.nome, subdivisao?.nome].filter(Boolean).join(" / ") || "—";
  const storeName = data.store.nickname || data.store.name;
  const storeCity = [data.store.city, data.store.state].filter(Boolean).join("/");

  return [
    `*Ocorrência — ${data.campaign.name}*`,
    `🏪 Loja: ${storeName}${storeCity ? ` — ${storeCity}` : ""}${data.store.store_code ? ` (${data.store.store_code})` : ""}`,
    `📍 Local: ${local}`,
    `📦 Peça: ${peca?.nome || "—"}`,
    `🔴 Motivo: ${motivo?.descricao || "—"}`,
    `📊 Status: ${statusInfo.label}`,
    `📅 Abertura: ${formatDateBR(r.created_at)}`,
    r.description ? `📝 Descrição: ${r.description}` : null,
    r.expected_resolution_date ? `⏰ Previsão: ${formatDateBR(r.expected_resolution_date)}` : null,
    r.tratativa_notes ? `📋 Tratativa: ${r.tratativa_notes}` : null,
  ].filter(Boolean).join("\n");
}

function OcorrenciaCard({ r, data, statuses }: { r: any; data: PortalData; statuses: TratativaStatus[] }) {
  const [expanded, setExpanded] = useState(false);

  const peca = data.pecas.find(p => p.id === r.loja_a_loja_peca_id);
  const tipo = data.tipos.find(t => t.id === r.tipo_id);
  const subdivisao = data.subdivisoes.find(s => s.id === r.subdivisao_id);
  const motivo = data.motivos?.find(m => m.id === r.motive_id);
  const statusInfo = getTratativaDisplay(r.tratativa_status ?? r.status ?? "aberta", statuses);
  const local = [tipo?.nome, subdivisao?.nome].filter(Boolean).join(" / ") || "—";
  const whatsappContact = (data.portal_config as any)?.whatsapp_contact;

  const handleShare = () => {
    const msg = encodeURIComponent(buildWhatsAppMessage(r, data, statuses));
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const handleContact = () => {
    if (!whatsappContact) return;
    const phone = whatsappContact.replace(/\D/g, "");
    const msg = encodeURIComponent(buildWhatsAppMessage(r, data, statuses));
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  return (
    <div
      className="border rounded-lg p-3 bg-card cursor-pointer hover:shadow-sm transition-shadow"
      onClick={() => setExpanded(v => !v)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={statusInfo.className} style={statusInfo.style}>
              {statusInfo.label}
            </span>
            <span className="text-sm font-medium truncate">{peca?.nome || "Peça"}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {local} · {formatDateBR(r.created_at)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          <span className="text-[10px] text-muted-foreground text-right max-w-[140px] leading-tight">
            clique na seta para ver mais informações e se for o caso, pedir mais explicações, por WhatsApp
          </span>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <Row label="Local" value={local} />
          <Row label="Peça" value={peca?.nome || "—"} />
          <Row label="Motivo" value={motivo?.descricao || "—"} />
          <Row label="Prioridade" value={r.priority || "—"} />
          <Row label="Status" value={statusInfo.label} />
          {r.description && <Row label="Descrição" value={r.description} multiline />}
          {r.expected_resolution_date && <Row label="Previsão" value={formatDateBR(r.expected_resolution_date)} />}
          {r.tratativa_notes && <Row label="Tratativa" value={r.tratativa_notes} multiline />}

          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleShare(); }} className="flex-1 gap-1.5">
              <Share2 className="w-3.5 h-3.5" /> Compartilhar
            </Button>
            {whatsappContact && (
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleContact(); }} className="flex-1 gap-1.5 text-green-700 border-green-300 hover:bg-green-50">
                <MessageCircle className="w-3.5 h-3.5" /> Contato WhatsApp
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs font-medium text-muted-foreground shrink-0 w-24">{label}</span>
      <span className={`text-sm ${multiline ? "whitespace-pre-line" : ""}`}>{value}</span>
    </div>
  );
}

export default function OcorrenciasTab({ data, agencyId }: Props) {
  const [selectedPeca, setSelectedPeca] = useState<any>(null);
  const [blockedPeca, setBlockedPeca] = useState<any>(null);
  const [reporterType, setReporterType] = useState("lojista");
  const [motiveId, setMotiveId] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("media");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [showSituacao, setShowSituacao] = useState(false);
  const [allReports, setAllReports] = useState<any[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const { statuses } = useEffectiveTratativaStatuses(data.campaign.client_id);

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
    const customList: string[] = ((data.portal_config as any)?.reporter_custom ?? []) as string[];
    customList.forEach((name) => {
      if (name && name.trim()) {
        opts.push({ value: `custom:${name.trim()}`, label: name.trim() });
      }
    });
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

  const loadAllReports = useCallback(async () => {
    setLoadingAll(true);
    const { data: rows } = await supabase
      .from("store_occurrence_reports")
      .select("*")
      .eq("campaign_id", data.campaign.id)
      .eq("store_id", data.store.id)
      .order("created_at", { ascending: false });
    setAllReports(rows || []);
    setLoadingAll(false);
  }, [data.campaign.id, data.store.id]);

  useEffect(() => { loadReports(); }, [loadReports]);

  useEffect(() => {
    const channel = supabase
      .channel(`store-occ-${data.campaign.id}-${data.store.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "store_occurrence_reports",
        filter: `store_id=eq.${data.store.id}`,
      }, (payload) => {
        const row: any = (payload.new ?? payload.old) || {};
        if (row.campaign_id === data.campaign.id) {
          loadReports();
          if (showSituacao) loadAllReports();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [data.campaign.id, data.store.id, loadReports, loadAllReports, showSituacao]);

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
    const { data: inserted, error } = await supabase.from("store_occurrence_reports").insert({
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
    } as any).select("id").single();

    if (error) {
      toast.error("Erro ao salvar ocorrência.");
      console.error(error);
    } else {
      toast.success("Ocorrência registrada com sucesso!");
      try {
        const occId = (inserted as any)?.id;
        await criarNotificacao({
          agency_id: agencyId,
          campaign_id: data.campaign.id,
          store_id: data.store.id,
          client_id: data.campaign.client_id,
          type: "store_occurrence_report",
          title: "Nova ocorrência da loja",
          body: `${data.store.name} reportou uma ocorrência na peça "${peca.nome}".`,
          action_url: occId
            ? `/agency/${agencyId}/clients/${data.campaign.client_id}/campaigns/${data.campaign.id}?section=occurrences&tab=portal-dashboard&occ=${occId}`
            : `/agency/${agencyId}/clients/${data.campaign.client_id}/campaigns/${data.campaign.id}?section=occurrences&tab=portal-dashboard`,
        });
      } catch {}
      resetForm();
      loadReports();
    }
    setSubmitting(false);
  };

  const handleOpenSituacao = () => {
    setShowSituacao(true);
    loadAllReports();
  };

  if (showSituacao) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSituacao(false)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-base font-semibold">Situação das Ocorrências</h2>
        </div>

        {loadingAll ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : allReports.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma ocorrência registrada.
          </p>
        ) : (
          <div className="space-y-3">
            {allReports.map(r => (
              <OcorrenciaCard key={r.id} r={r} data={data} statuses={statuses} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Toque em uma peça para reportar uma ocorrência.
        </p>
        {reports.length > 0 && (
          <Button size="sm" variant="outline" onClick={handleOpenSituacao}>
            <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
            SITUAÇÃO DAS OCORRÊNCIAS
          </Button>
        )}
      </div>

      <StorePortalPieceGrid
        data={data}
        onPieceClick={handlePieceClick}
        badgeCounts={badgeCounts}
      />

      {reports.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Ocorrências abertas ({reports.length})
          </h3>
          <div className="space-y-3">
            {reports.map(r => {
              const peca = data.pecas.find(p => p.id === r.loja_a_loja_peca_id);
              return (
                <div key={r.id} className="border rounded-lg p-3 bg-card">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{peca?.nome || "Peça"}</p>
                      <p className="text-xs text-muted-foreground">{r.description}</p>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                      {r.priority}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!selectedPeca} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                    <SelectValue placeholder="Selecione..." />
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
                  onChange={(e) => setDescription(e.target.value)}
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
              <Button onClick={() => setBlockedPeca(null)} variant="outline" className="w-full">Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
