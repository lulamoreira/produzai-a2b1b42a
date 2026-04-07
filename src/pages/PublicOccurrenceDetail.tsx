import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Store, Puzzle, Calendar, MessageSquare, Camera, Tag, CircleDot, Link2, X, Wrench, Clock, Mail } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

const PublicOccurrenceDetail = () => {
  const { occurrenceId } = useParams<{ occurrenceId: string }>();
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const sendTrackingEmail = useMutation({
    mutationFn: async () => {
      if (!occurrence?.reporter_email || !campaign) throw new Error("Dados insuficientes");
      const publicUrl = `${window.location.origin}/ocorrencia/${occurrenceId}`;
      const storeName = store?.nickname || store?.name || "";
      const campaignName = campaign.name || "";
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "occurrence-tracking",
          recipientEmail: occurrence.reporter_email,
          idempotencyKey: `occ-tracking-${occurrenceId}-${Date.now()}`,
          templateData: { campaignName, publicUrl, storeName },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setEmailSent(true);
      toast.success("Email de acompanhamento enviado!");
    },
    onError: () => toast.error("Erro ao enviar email"),
  });

  const { data: occurrence, isLoading } = useQuery({
    queryKey: ["public_occurrence_detail", occurrenceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrences")
        .select("*")
        .eq("id", occurrenceId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!occurrenceId,
  });

  const { data: campaign } = useQuery({
    queryKey: ["public_occ_campaign", occurrence?.campaign_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, client_id, clients(name, agency_id, agencies(name))")
        .eq("id", occurrence!.campaign_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!occurrence?.campaign_id,
  });

  const { data: store } = useQuery({
    queryKey: ["public_occ_store", occurrence?.store_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_stores")
        .select("id, name, nickname")
        .eq("id", occurrence!.store_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!occurrence?.store_id,
  });

  const isGeral = occurrence?.location_in_store === "GERAL - NA LOJA TODA";

  const { data: piece } = useQuery({
    queryKey: ["public_occ_piece", occurrence?.piece_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_pieces")
        .select("id, name, code, image_url")
        .eq("id", occurrence!.piece_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!occurrence?.piece_id && !isGeral,
  });

  const { data: motive } = useQuery({
    queryKey: ["public_occ_motive", occurrence?.motive_id],
    queryFn: async () => {
      if (!occurrence?.motive_id) return null;
      const { data, error } = await supabase
        .from("occurrence_motives")
        .select("id, description")
        .eq("id", occurrence.motive_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!occurrence?.motive_id,
  });

  const { data: statusObj } = useQuery({
    queryKey: ["public_occ_status", occurrence?.status],
    queryFn: async () => {
      if (!occurrence?.status) return null;
      const { data, error } = await supabase
        .from("occurrence_statuses")
        .select("*")
        .eq("value", occurrence.status)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!occurrence?.status,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["public_occ_photos", occurrenceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrence_photos")
        .select("id, photo_url")
        .eq("occurrence_id", occurrenceId!);
      if (error) throw error;
      const urls = (data || []).map((p) => p.photo_url);
      // include legacy photo_url
      if (occurrence?.photo_url && !urls.includes(occurrence.photo_url)) {
        urls.unshift(occurrence.photo_url);
      }
      return urls;
    },
    enabled: !!occurrenceId && !!occurrence,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!occurrence) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-destructive/5 via-background to-warning/5 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-lg font-bold text-foreground mb-1">Ocorrência não encontrada</h1>
          <p className="text-sm text-muted-foreground">O link pode estar incorreto ou a ocorrência foi removida.</p>
        </div>
      </div>
    );
  }

  const clientName = (campaign as any)?.clients?.name || "";
  const statusColor = statusObj?.color || "#6366f1";
  const statusLabel = statusObj?.label || occurrence.status || "Pendente";

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-5 text-center">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-3 shadow-glow-primary">
            <AlertTriangle className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Detalhes da Ocorrência</h1>
          {clientName && campaign && (
            <p className="text-xs text-muted-foreground mt-1">{clientName} · {campaign.name}</p>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Status Banner */}
        <div
          className="rounded-2xl p-4 flex items-center gap-3 border"
          style={{ backgroundColor: `${statusColor}12`, borderColor: `${statusColor}30` }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{ backgroundColor: statusColor }}
          >
            <CircleDot className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status atual</p>
            <p className="text-lg font-bold" style={{ color: statusColor }}>{statusLabel}</p>
          </div>
        </div>

        {/* Info cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Store */}
          <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Store className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Reportado por</p>
              <p className="text-sm font-semibold text-foreground truncate">
                {(occurrence as any).reporter_type === "agency"
                  ? ((campaign as any)?.clients?.agencies?.name || "Agência")
                  : (occurrence as any).reporter_type === "fornecedor"
                    ? "Fornecedor"
                    : (occurrence as any).reporter_type === "cliente"
                      ? ((campaign as any)?.clients?.name || "Cliente")
                      : (store?.nickname || store?.name || "—")}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Loja</p>
              <p className="text-sm font-semibold text-foreground truncate">
                {store?.nickname || store?.name || "—"}
              </p>
            </div>
          </div>

          {/* Piece */}
          <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/30 flex items-center justify-center flex-shrink-0">
              {isGeral ? (
                <Store className="w-5 h-5 text-accent-foreground" />
              ) : piece?.image_url ? (
                <img src={piece.image_url} alt={piece.name} className="w-10 h-10 rounded-xl object-cover" />
              ) : (
                <Puzzle className="w-5 h-5 text-accent-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Peça</p>
              <p className="text-sm font-semibold text-foreground truncate">
                {isGeral ? "GERAL - NA LOJA TODA" : (piece?.name || "—")}
              </p>
              {!isGeral && piece?.code && <p className="text-[11px] text-muted-foreground">Código: {piece.code}</p>}
            </div>
          </div>

          {/* Motive */}
          <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center flex-shrink-0">
              <Tag className="w-5 h-5 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Motivo</p>
              <p className="text-sm font-semibold text-foreground">{motive?.description || "—"}</p>
            </div>
          </div>

          {/* Date */}
          <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-info/15 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-info" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Data</p>
              <p className="text-sm font-semibold text-foreground">
                {occurrence.created_at ? format(new Date(occurrence.created_at), "dd/MM/yyyy 'às' HH:mm") : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        {occurrence.description && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Descrição</p>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{occurrence.description}</p>
          </div>
        )}

        {/* Actions taken */}
        {occurrence.actions_taken && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-4 h-4 text-primary" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Ações Tomadas</p>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{occurrence.actions_taken}</p>
          </div>
        )}

        {/* Expected resolution date */}
        {occurrence.expected_resolution_date && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-primary" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Previsão de Resolução</p>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {format(new Date(occurrence.expected_resolution_date), "dd/MM/yyyy")}
            </p>
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Camera className="w-4 h-4 text-primary" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
                Fotos ({photos.length})
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  className="aspect-square rounded-xl border border-border overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all"
                  onClick={() => setSelectedPhoto(selectedPhoto === i ? null : i)}
                >
                  <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            {selectedPhoto !== null && photos[selectedPhoto] && (
              <div className="mt-3 rounded-xl overflow-hidden border border-border">
                <img src={photos[selectedPhoto]} alt="Foto ampliada" className="w-full object-contain max-h-[60vh]" />
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 pt-4 pb-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Link copiado!");
            }}
          >
            <Link2 className="w-4 h-4" />
            Copiar Link
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            asChild
          >
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Acompanhe a ocorrência: ${window.location.href}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.359 0-4.542-.816-6.26-2.18l-.438-.36-3.172 1.063 1.063-3.172-.36-.438A9.953 9.953 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
              WhatsApp
            </a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={() => window.close()}
          >
            <X className="w-4 h-4" />
            Fechar
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center pb-8">
          <p className="text-[11px] text-muted-foreground">
            Ocorrência #{occurrenceId?.slice(0, 8)}
          </p>
        </div>
      </main>
    </div>
  );
};

export default PublicOccurrenceDetail;
