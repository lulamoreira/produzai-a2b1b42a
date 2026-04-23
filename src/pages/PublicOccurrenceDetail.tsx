import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Store, Puzzle, Calendar, MessageSquare, Camera, Tag, CircleDot, Link2, X, Wrench, Clock, Mail, Plus, Check } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

const PublicOccurrenceDetail = () => {
  const { occurrenceId } = useParams<{ occurrenceId: string }>();
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [selectedCcEmails, setSelectedCcEmails] = useState<string[]>([]);
  const [customEmail, setCustomEmail] = useState("");

  const sendTrackingEmail = useMutation({
    mutationFn: async (ccEmails: string[]) => {
      if (!occurrence?.reporter_email || !campaign) throw new Error("Dados insuficientes");
      const publicUrl = `${window.location.origin}/ocorrencia/${occurrenceId}`;
      const storeName = store?.nickname || store?.name || "";
      const campaignName = campaign.name || "";
      const allRecipients = [occurrence.reporter_email, ...ccEmails];
      const uniqueRecipients = [...new Set(allRecipients)];

      for (const email of uniqueRecipients) {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "occurrence-tracking",
            recipientEmail: email,
            idempotencyKey: `occ-tracking-${occurrenceId}-${email}-${Date.now()}`,
            templateData: { campaignName, publicUrl, storeName },
          },
        });
      }
    },
    onSuccess: () => {
      setEmailSent(true);
      setShowEmailDialog(false);
      toast.success("Email(s) de acompanhamento enviado(s)!");
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

  // Fetch notification emails for the campaign (for CC options)
  const { data: notificationEmails = [] } = useQuery({
    queryKey: ["public_occ_notif_emails", occurrence?.campaign_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_notification_emails")
        .select("email")
        .eq("campaign_id", occurrence!.campaign_id);
      return (data || []).map((e: any) => e.email).filter((e: string) => e !== occurrence?.reporter_email);
    },
    enabled: !!occurrence?.campaign_id,
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
    <div className="min-h-screen" style={{ background: "var(--bg-page, #F5F2ED)" }}>
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="max-w-2xl mx-auto px-4 py-5 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "#7A3B2E", width: 64, height: 64, borderRadius: 16 }}
          >
            <AlertTriangle className="w-7 h-7 text-white" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>Detalhes da Ocorrência</h1>
          {clientName && campaign && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{clientName} · {campaign.name}</p>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Status Banner */}
        <div
          className="flex items-center gap-2.5 rounded-[10px] p-3"
          style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-card)", borderLeft: `4px solid ${statusColor}` }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${statusColor}18` }}
          >
            <CircleDot className="w-4 h-4" style={{ color: statusColor }} />
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "var(--text-muted)", textTransform: "uppercase" }}>Status atual</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: statusColor }}>{statusLabel}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Store */}
          <div className="flex items-start gap-2.5 rounded-[10px] p-3" style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--brand-100)" }}>
              <Store className="w-[15px] h-[15px]" style={{ color: "var(--brand-700)" }} />
            </div>
            <div className="min-w-0">
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 3 }}>Reportado por</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }} className="truncate">
                {(occurrence as any).reporter_type === "agency"
                  ? ((campaign as any)?.clients?.agencies?.name || "Agência")
                  : (occurrence as any).reporter_type === "fornecedor"
                    ? "Fornecedor"
                    : (occurrence as any).reporter_type === "cliente"
                      ? ((campaign as any)?.clients?.name || "Cliente")
                      : (store?.nickname || store?.name || "—")}
              </p>
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginTop: 8, marginBottom: 3 }}>Loja</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }} className="truncate">
                {store?.nickname || store?.name || "—"}
              </p>
            </div>
          </div>

          {/* Piece */}
          <div className="flex items-start gap-2.5 rounded-[10px] p-3" style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "var(--brand-100)" }}>
              {isGeral ? (
                <Store className="w-[15px] h-[15px]" style={{ color: "var(--brand-700)" }} />
              ) : piece?.image_url ? (
                <img src={getThumbnailUrl(piece.image_url, 80)} alt={piece.name} loading="lazy" decoding="async" className="w-8 h-8 object-cover" />
              ) : (
                <Puzzle className="w-[15px] h-[15px]" style={{ color: "var(--brand-700)" }} />
              )}
            </div>
            <div className="min-w-0">
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 3 }}>Peça</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }} className="truncate">
                {isGeral ? "GERAL - NA LOJA TODA" : (piece?.name || "—")}
              </p>
              {!isGeral && piece?.code && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Código: {piece.code}</p>}
            </div>
          </div>

          {/* Motive */}
          <div className="flex items-start gap-2.5 rounded-[10px] p-3" style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--brand-100)" }}>
              <Tag className="w-[15px] h-[15px]" style={{ color: "var(--brand-700)" }} />
            </div>
            <div className="min-w-0">
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 3 }}>Motivo</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{motive?.description || "—"}</p>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-start gap-2.5 rounded-[10px] p-3" style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--brand-100)" }}>
              <Calendar className="w-[15px] h-[15px]" style={{ color: "var(--brand-700)" }} />
            </div>
            <div className="min-w-0">
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 3 }}>Data</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                {occurrence.created_at ? format(new Date(occurrence.created_at), "dd/MM/yyyy 'às' HH:mm") : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        {occurrence.description && (
          <div className="rounded-[10px] p-3" style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--brand-100)" }}>
                <MessageSquare className="w-[15px] h-[15px]" style={{ color: "var(--brand-700)" }} />
              </div>
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>Descrição</p>
            </div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>{occurrence.description}</p>
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
          <div className="rounded-[10px] p-3" style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 mb-3">
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>
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
                  <img src={getThumbnailUrl(url, 200)} alt={`Foto ${i + 1}`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            {selectedPhoto !== null && photos[selectedPhoto] && (
              <div className="mt-3 rounded-xl overflow-hidden border border-border">
                <img src={photos[selectedPhoto]} alt="Foto ampliada" loading="lazy" decoding="async" className="w-full object-contain max-h-[60vh]" />
              </div>
            )}
          </div>
        )}

        <div
          className="flex items-center justify-center gap-2 pt-4 pb-2 flex-wrap"
          style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 16 }}
        >
          {occurrence.reporter_email && (
            <button
              className="inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium transition-all"
              style={{
                padding: "8px 14px", border: "1px solid var(--border-default)",
                background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "pointer",
              }}
              disabled={sendTrackingEmail.isPending || emailSent}
              onClick={() => {
                setSelectedCcEmails([]);
                setCustomEmail("");
                setShowEmailDialog(true);
              }}
            >
              <Mail className="w-4 h-4" />
              {emailSent ? "Email Enviado ✓" : "Enviar por Email"}
            </button>
          )}
          <button
            className="inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium transition-all"
            style={{
              padding: "8px 14px", border: "1px solid var(--border-default)",
              background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "pointer",
            }}
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Link copiado!");
            }}
          >
            <Link2 className="w-4 h-4" />
            Copiar Link
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Acompanhe a ocorrência: ${window.location.href}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium no-underline transition-all"
            style={{
              padding: "8px 14px", border: "1px solid rgba(22, 163, 74, 0.3)",
              background: "var(--bg-surface)", color: "#16A34A", cursor: "pointer",
            }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.359 0-4.542-.816-6.26-2.18l-.438-.36-3.172 1.063 1.063-3.172-.36-.438A9.953 9.953 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
            WhatsApp
          </a>
        </div>

        {/* Email Dialog */}
        <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Enviar Email de Acompanhamento
              </DialogTitle>
              <DialogDescription>
                O email será enviado para <strong>{occurrence.reporter_email}</strong>.
                Deseja enviar cópia para mais alguém?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Registered emails */}
              {notificationEmails.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Emails cadastrados:</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {notificationEmails.map((email: string) => (
                      <label key={email} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <Checkbox
                          checked={selectedCcEmails.includes(email)}
                          onCheckedChange={(checked) => {
                            setSelectedCcEmails(prev =>
                              checked ? [...prev, email] : prev.filter(e => e !== email)
                            );
                          }}
                        />
                        <span className="text-sm text-foreground truncate">{email}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom email */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Outro email:</p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!customEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customEmail) || selectedCcEmails.includes(customEmail)}
                    onClick={() => {
                      if (customEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customEmail)) {
                        setSelectedCcEmails(prev => [...prev, customEmail]);
                        setCustomEmail("");
                      }
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {/* Show added custom emails */}
                {selectedCcEmails.filter(e => !notificationEmails.includes(e)).map(email => (
                  <div key={email} className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-1.5">
                    <Check className="w-3 h-3 text-primary" />
                    <span className="flex-1 truncate">{email}</span>
                    <button onClick={() => setSelectedCcEmails(prev => prev.filter(e => e !== email))} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setShowEmailDialog(false)}>Cancelar</Button>
              <Button
                disabled={sendTrackingEmail.isPending}
                onClick={() => sendTrackingEmail.mutate(selectedCcEmails)}
              >
                <Mail className="w-4 h-4 mr-2" />
                {sendTrackingEmail.isPending ? "Enviando..." : `Enviar${selectedCcEmails.length > 0 ? ` (${1 + selectedCcEmails.length})` : ""}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
