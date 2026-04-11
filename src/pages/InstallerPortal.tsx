import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Camera, Upload, CalendarIcon, Clock, MapPin, Phone, User,
  CheckCircle, KeyRound, Store, FileText, Building2, AlertTriangle,
  ArrowDown,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { compressImage } from "@/lib/compressImage";

interface PortalData {
  schedule: any;
  store: any;
  team: any;
  campaign: any;
  contacts: any[];
  storePieces: any[];
  photos: any[];
  members: any[];
}

const CATEGORY_OPTIONS = [
  { value: "before", label: "Antes", icon: "🔵" },
  { value: "during", label: "Durante", icon: "🟡" },
  { value: "after", label: "Depois", icon: "🟢" },
];

const MINIMO_FOTOS = 10;

export default function InstallerPortal() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState("");
  const [uploadCategory, setUploadCategory] = useState("before");
  const [localPhotos, setLocalPhotos] = useState<any[]>([]);
  const [checkinDone, setCheckinDone] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [validacaoError, setValidacaoError] = useState<{
    ativa: boolean;
    totalEnviado: number;
    faltam: number;
  } | null>(null);
  const [tentandoConcluir, setTentandoConcluir] = useState(false);

  // Auto-submit when 5 chars
  useEffect(() => {
    if (code.length === 5 && !loading && !data) {
      handleSubmit();
    }
  }, [code]);

  const handleSubmit = async () => {
    if (code.length !== 5) return;
    setLoading(true);
    setError("");

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/validate-install-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code.toLowerCase(), action: "view" }),
        }
      );

      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Código não encontrado.");
        setCode("");
      } else {
        setData(result);
        setLocalPhotos(result.photos || []);
        setCheckinDone(!!result.schedule?.checkin_timestamp);
        setIsCompleted(!!result.schedule?.completed_at);
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (!data) return;
    let lat: number | null = null;
    let lng: number | null = null;
    let accuracy: number | null = null;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });
      lat = position.coords.latitude;
      lng = position.coords.longitude;
      accuracy = position.coords.accuracy;
    } catch {
      // Continue without GPS
    }

    try {
      const { error: updateError } = await supabase
        .from("campaign_schedules")
        .update({
          checkin_lat: lat,
          checkin_lng: lng,
          checkin_accuracy: accuracy,
          checkin_timestamp: new Date().toISOString(),
          checkin_device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
          },
        } as any)
        .eq("install_code", code.toLowerCase());

      if (updateError) throw updateError;

      // Log the checkin
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/validate-install-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code.toLowerCase(), action: "checkin" }),
        }
      );

      toast.success("Check-in registrado! Bom trabalho. 👍");
      setCheckinDone(true);
    } catch {
      toast.error("Erro ao registrar check-in.");
    }
  };

  const handleUpload = async (files: FileList | null, method: "upload" | "camera" = "upload") => {
    if (!files || !data) return;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImage(file, 1200, 0.7);
        const formData = new FormData();
        formData.append("install_code", code.toLowerCase());
        formData.append("store_id", data.store.id);
        formData.append("category", uploadCategory);
        formData.append("upload_method", method);
        formData.append("photo", new File([compressed], "photo.jpg", { type: "image/jpeg" }));

        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/upload-installation-photo`,
          { method: "POST", body: formData }
        );

        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        if (result.photo) setLocalPhotos((prev) => [...prev, result.photo]);
      } catch (err: any) {
        toast.error(err.message || "Erro ao enviar foto.");
      }
    }
    toast.success(`${files.length} foto(s) enviada(s)!`);
    // Clear validation error if now above minimum
    setValidacaoError(null);
  };

  const handleComplete = async () => {
    if (!data) return;

    const totalMidias = localPhotos.length;

    // Validation: minimum 10 photos/videos for installer portal
    if (totalMidias < MINIMO_FOTOS) {
      setValidacaoError({
        ativa: true,
        totalEnviado: totalMidias,
        faltam: MINIMO_FOTOS - totalMidias,
      });
      return;
    }

    setValidacaoError(null);
    setTentandoConcluir(true);

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/complete-installation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schedule_id: data.schedule.id, completed: true }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setIsCompleted(true);
      toast.success("Instalação concluída! 🎉");
    } catch (err: any) {
      toast.error(err.message || "Erro ao concluir.");
    } finally {
      setTentandoConcluir(false);
    }
  };

  // Login screen
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-page, #F5F2ED)" }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: "#8C6F4E", width: 64, height: 64, borderRadius: 16 }}
            >
              <KeyRound className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Acesso de Instalador</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Digite o código da sua instalação
            </p>
          </div>

          <div
            style={{
              background: "var(--bg-surface, #fff)", borderRadius: 16,
              boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.06)",
              padding: 32, width: "100%", maxWidth: 380,
            }}
            className="space-y-4"
          >
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5))}
              placeholder="_ _ _ _ _"
              className="text-center text-2xl font-mono tracking-[0.5em] h-14"
              maxLength={5}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-center">
              5 caracteres · letras e números
            </p>

            {error && (
              <p className="text-xs text-destructive text-center bg-destructive/10 rounded-lg p-2">{error}</p>
            )}

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={loading || code.length !== 5}
              style={loading || code.length !== 5
                ? { background: "var(--brand-200)", color: "var(--brand-600)", opacity: 1, cursor: "not-allowed" }
                : { background: "var(--brand-500)", color: "#FFFFFF" }
              }
            >
              {loading ? "Validando..." : "Acessar instalação"}
            </Button>

            <p className="text-[11px] text-center text-muted-foreground">
              Dúvidas? Fale com o responsável da campanha.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Installation detail
  const store = data.store;
  const schedule = data.schedule;
  const campaign = data.campaign;
  const contacts = data.contacts || [];
  const primaryContact = contacts[0];
  const address = [store?.street, store?.number, store?.complement, store?.neighborhood, store?.city, store?.state]
    .filter(Boolean).join(", ") || "Endereço não informado";
  const teamName = data.team?.name || "";
  const selectedDate = schedule?.scheduled_date ? new Date(schedule.scheduled_date + "T12:00:00") : undefined;
  const preference = schedule?.installation_preference;
  const prefLabel = preference === "morning" ? "Manhã" : preference === "afternoon" ? "Tarde" : preference === "night" ? "Noite" : "";
  const totalMidias = localPhotos.length;
  const atingiuMinimo = totalMidias >= MINIMO_FOTOS;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page, #F5F2ED)" }}>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b px-4 py-3.5" style={{ background: "var(--brand-800, #3D2E1E)", borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: "#F5EFE6" }} />
            <p className="text-sm font-semibold truncate" style={{ color: "#F5EFE6" }}>
              {campaign?.name || "Campanha"}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Store info card */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border" style={{ background: "rgba(140,111,78,0.06)" }}>
            <div className="flex items-center gap-3">
              <Store className="w-5 h-5 flex-shrink-0" style={{ color: "var(--brand-500, #8C6F4E)" }} />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-foreground truncate">
                  {store?.name} {store?.nickname ? `— ${store.nickname}` : ""}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {store?.store_code || ""} {store?.state ? `· ${store.state}` : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{address}</span>
            </div>

            {primaryContact && (
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {primaryContact.name}
                </span>
                {primaryContact.phone && (
                  <a href={`tel:${primaryContact.phone}`} className="flex items-center gap-1 text-primary">
                    <Phone className="w-3 h-3" /> {primaryContact.phone}
                  </a>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3 text-xs">
              {selectedDate && (
                <span className="flex items-center gap-1 text-foreground">
                  <CalendarIcon className="w-3 h-3 text-muted-foreground" />
                  {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              )}
              {schedule?.scheduled_time && (
                <span className="flex items-center gap-1 text-foreground">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  {schedule.scheduled_time}
                </span>
              )}
              {prefLabel && (
                <span className="text-muted-foreground">({prefLabel})</span>
              )}
            </div>

            {teamName && (
              <div className="text-xs text-muted-foreground">
                Equipe: <span className="font-medium text-foreground">{teamName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Check-in */}
        {!checkinDone && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Check-in</p>
            <Button className="w-full h-12 text-sm gap-2" onClick={handleCheckin}>
              <CheckCircle className="w-5 h-5" />
              Fazer Check-in
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Registra sua chegada na loja.
            </p>
          </div>
        )}

        {checkinDone && (
          <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: "var(--s-success-bg)", color: "var(--s-success)" }}>
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium">✔ Check-in registrado</span>
          </div>
        )}

        {/* Photos */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3" id="secao-fotos">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Fotos da instalação</p>

          {/* Progress bar */}
          <div className="flex flex-col gap-1.5">
            <div className="w-full h-[5px] rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
              <div
                className="h-full rounded-full transition-all duration-400"
                style={{
                  width: `${Math.min((totalMidias / MINIMO_FOTOS) * 100, 100)}%`,
                  background: atingiuMinimo ? "#16A34A" : "var(--brand-500, #8C6F4E)",
                }}
              />
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              {atingiuMinimo
                ? `✓ ${totalMidias} mídias — pode concluir`
                : `${totalMidias}/${MINIMO_FOTOS} mídias — envie mais ${MINIMO_FOTOS - totalMidias} para concluir`
              }
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="h-9 text-xs rounded-md border border-border bg-card text-foreground px-2"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
              ))}
            </select>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { handleUpload(e.target.files, "camera"); e.target.value = ""; }}
              />
              <Button variant="outline" size="sm" className="text-xs gap-1 pointer-events-none" asChild>
                <span><Camera className="w-3 h-3" /> Tirar foto</span>
              </Button>
            </label>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { handleUpload(e.target.files, "upload"); e.target.value = ""; }}
              />
              <Button variant="outline" size="sm" className="text-xs gap-1 pointer-events-none" asChild>
                <span><Upload className="w-3 h-3" /> Upload</span>
              </Button>
            </label>
          </div>

          {localPhotos.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {localPhotos.map((photo: any) => (
                <img
                  key={photo.id}
                  src={photo.photo_url}
                  alt=""
                  className="w-16 h-16 rounded-md object-cover border border-border"
                />
              ))}
            </div>
          )}
        </div>

        {/* Validation error */}
        {validacaoError?.ativa && !isCompleted && (
          <div
            className="rounded-[14px] p-6 flex flex-col items-center gap-3 text-center animate-in fade-in slide-in-from-bottom-2 duration-300"
            style={{
              background: "#FEF2F2",
              border: "2px solid #DC2626",
            }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "#DC2626" }}
            >
              <AlertTriangle className="w-7 h-7 text-white" />
            </div>

            <p className="text-[17px] font-bold leading-tight" style={{ color: "#7F1D1D" }}>
              Você ainda não pode sair desta loja
            </p>

            <p className="text-sm leading-relaxed max-w-[340px]" style={{ color: "#991B1B" }}>
              Nossa equipe precisa verificar cada detalhe da instalação antes
              de liberar o pagamento da sua equipe. Para isso, precisamos de no mínimo{" "}
              <strong style={{ color: "#7F1D1D" }}>10 fotos ou vídeos</strong> do serviço realizado.
            </p>

            <p className="text-[15px] font-medium" style={{ color: "#991B1B" }}>
              Você enviou apenas {validacaoError.totalEnviado} {validacaoError.totalEnviado === 1 ? "mídia" : "mídias"}.
              Faltam {validacaoError.faltam} {validacaoError.faltam === 1 ? "foto ou vídeo" : "fotos ou vídeos"} para liberar a conclusão.
            </p>

            <p
              className="text-[13px] rounded-lg px-3.5 py-2.5 w-full"
              style={{ color: "#B91C1C", background: "rgba(220,38,38,0.08)" }}
            >
              ⚠ Instalações sem documentação suficiente ficam pendentes de verificação
              e podem atrasar o pagamento de toda a equipe.
            </p>

            {/* Progress */}
            <div className="w-full flex flex-col gap-1.5">
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(220,38,38,0.15)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(validacaoError.totalEnviado / MINIMO_FOTOS) * 100}%`,
                    background: "#DC2626",
                  }}
                />
              </div>
              <p className="text-[13px] font-semibold" style={{ color: "#991B1B" }}>
                {validacaoError.totalEnviado} / {MINIMO_FOTOS} mídias enviadas
              </p>
            </div>

            <button
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[10px] text-sm font-semibold text-white transition-colors min-h-[48px]"
              style={{ background: "#DC2626" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#B91C1C")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#DC2626")}
              onClick={() => {
                setValidacaoError(null);
                document.getElementById("secao-fotos")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <ArrowDown className="w-4 h-4" />
              Voltar e adicionar mais fotos
            </button>
          </div>
        )}

        {/* Complete button */}
        {!isCompleted && (
          <Button
            className={`w-full h-12 text-sm gap-2 ${
              validacaoError?.ativa ? "opacity-40 cursor-not-allowed pointer-events-none" : ""
            } ${!atingiuMinimo && !validacaoError?.ativa ? "" : ""}`}
            variant="default"
            onClick={handleComplete}
            disabled={tentandoConcluir || validacaoError?.ativa === true}
            style={!atingiuMinimo && !validacaoError?.ativa
              ? { background: "var(--brand-300)", color: "var(--brand-800)" }
              : undefined
            }
          >
            <CheckCircle className="w-5 h-5" />
            {tentandoConcluir
              ? "Verificando..."
              : atingiuMinimo
                ? "Instalação Concluída"
                : `Instalação Concluída (${totalMidias}/${MINIMO_FOTOS} fotos)`
            }
          </Button>
        )}

        {isCompleted && (
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-center">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">Instalação concluída!</p>
            <p className="text-xs text-muted-foreground mt-1">Obrigado pelo bom trabalho. 💪</p>
          </div>
        )}
      </main>
    </div>
  );
}