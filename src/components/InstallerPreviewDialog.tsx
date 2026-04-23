import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Building2, Store, MapPin, User, Phone, Calendar, Clock,
  CheckCircle, Camera, Upload,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { InstallationPhoto } from "@/hooks/useInstallationPhotos";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignName: string;
  store: any;
  schedule: any;
  team: any;
  contacts: any[];
  photos: InstallationPhoto[];
}

export default function InstallerPreviewDialog({
  open, onOpenChange, campaignName, store, schedule, team, contacts, photos,
}: Props) {
  if (!store || !schedule) return null;

  const address = [store.street, store.number, store.complement, store.neighborhood, store.city, store.state]
    .filter(Boolean).join(", ") || "Endereço não informado";
  const primaryContact = contacts?.[0];
  const effectiveDate = schedule.reschedule_enabled ? schedule.reschedule_date : schedule.scheduled_date;
  const effectiveTime = schedule.reschedule_enabled ? schedule.reschedule_time : schedule.scheduled_time;
  const effectivePref = schedule.reschedule_enabled ? schedule.reschedule_preference : schedule.installation_preference;
  const prefLabel = effectivePref === "morning" ? "Manhã" : effectivePref === "afternoon" ? "Tarde" : effectivePref === "night" ? "Noite" : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden [&>button]:hidden">
        {/* Header */}
        <div
          className="flex items-center gap-2 px-5 py-3"
          style={{ background: "var(--brand-800)", color: "#F5EFE6", fontSize: 13, fontWeight: 600 }}
        >
          <Building2 className="w-4 h-4" />
          {campaignName}
        </div>

        {/* Body */}
        <div
          className="flex flex-col gap-3 p-4 overflow-y-auto"
          style={{ maxHeight: "70vh", background: "var(--bg-page)" }}
        >
          {/* Store info */}
          <div className="card-base p-3.5">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--brand-100)" }}
              >
                <Store className="w-[18px] h-[18px]" style={{ color: "var(--brand-700)" }} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                  {store.name} {store.nickname ? `— ${store.nickname}` : ""}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {store.store_code || ""} {store.state ? `· ${store.state}` : ""}
                </p>
              </div>
            </div>
            <div className="space-y-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> <span>{address}</span>
              </div>
              {primaryContact && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {primaryContact.name}</span>
                  {primaryContact.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {primaryContact.phone}</span>}
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                {effectiveDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(effectiveDate + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                )}
                {effectiveTime && (
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {effectiveTime}</span>
                )}
                {prefLabel && <span>({prefLabel})</span>}
              </div>
              {team && <div>Equipe: <strong style={{ color: "var(--text-primary)" }}>{team.name}</strong></div>}
            </div>
          </div>

          {/* Check-in */}
          <div className="card-base p-3.5">
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase" }}>
              CHECK-IN
            </p>
            <button
              disabled
              className="w-full flex items-center justify-center gap-2"
              style={{
                height: 44, borderRadius: 8, background: "var(--brand-200)", color: "var(--brand-700)",
                border: "none", fontSize: 14, fontWeight: 500, cursor: "default",
              }}
            >
              <CheckCircle className="w-4 h-4" /> Fazer Check-in
            </button>
            <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 6 }}>
              Registra a chegada na loja
            </p>
          </div>

          {/* Photos */}
          <div className="card-base p-3.5">
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase" }}>
              FOTOS DA INSTALAÇÃO
            </p>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <select
                disabled
                className="h-8 text-xs rounded-md border px-2"
                style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
              >
                <option>Antes</option>
                <option>Depois</option>
              </select>
              <button disabled className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border" style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "default" }}>
                <Camera className="w-3 h-3" /> Tirar foto
              </button>
              <button disabled className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border" style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "default" }}>
                <Upload className="w-3 h-3" /> Upload
              </button>
            </div>
            {photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-1.5">
                {photos.slice(0, 6).map((f) => (
                  <img key={f.id} src={getThumbnailUrl(f.photo_url, 200)} alt="" loading="lazy" decoding="async" className="w-full aspect-square rounded-md object-cover border" style={{ borderColor: "var(--border-subtle)" }} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>Nenhuma foto enviada ainda</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}
        >
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            👁 Esta é uma pré-visualização. As ações estão desabilitadas.
          </p>
          <button
            onClick={() => onOpenChange(false)}
            style={{
              fontSize: 13, fontWeight: 500, padding: "6px 14px", borderRadius: 8,
              border: "1px solid var(--border-default)", background: "var(--bg-surface)",
              color: "var(--text-secondary)", cursor: "pointer",
            }}
          >
            Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
