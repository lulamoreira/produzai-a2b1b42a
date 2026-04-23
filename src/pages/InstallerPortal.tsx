import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Camera, Upload, CalendarIcon, Clock, MapPin, Phone, User,
  CheckCircle, KeyRound, Store, FileText, Building2, AlertTriangle,
  ArrowDown, ChevronDown, ChevronUp,
  WifiOff, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { compressImage } from "@/lib/compressImage";
import { enqueue, blobToBase64, queueCount } from "@/lib/offlineQueue";
import { useOfflineSync } from "@/hooks/useOfflineSync";

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
const CACHE_KEY = "installer_portal_cache";
const CACHE_TS_KEY = "installer_portal_cache_ts";

function saveCache(code: string, data: PortalData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ code, data }));
    localStorage.setItem(CACHE_TS_KEY, new Date().toISOString());
  } catch { /* quota exceeded — ignore */ }
}

function loadCache(): { code: string; data: PortalData; ts: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const ts = localStorage.getItem(CACHE_TS_KEY);
    if (!raw || !ts) return null;
    const parsed = JSON.parse(raw);
    return { code: parsed.code, data: parsed.data, ts };
  } catch {
    return null;
  }
}

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
  const [offlineLoaded, setOfflineLoaded] = useState(false);
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null);
  const [pendingPhotoCount, setPendingPhotoCount] = useState(0);

  // Offline sync hook
  const { isOnline, isSyncing, pendingCount, refreshCount } = useOfflineSync(() => {
    // After sync completes, refresh data from server if online
    if (code.length === 5) handleSubmit();
  });

  // Refresh pending photo count whenever pendingCount changes
  useEffect(() => {
    queueCount("photo").then(setPendingPhotoCount).catch(() => {});
  }, [pendingCount]);

  // Try loading from cache if offline on mount
  useEffect(() => {
    if (!navigator.onLine && !data) {
      const cached = loadCache();
      if (cached) {
        setCode(cached.code);
        setData(cached.data);
        setLocalPhotos(cached.data.photos || []);
        setCheckinDone(!!cached.data.schedule?.checkin_timestamp);
        setIsCompleted(!!cached.data.schedule?.completed_at);
        setOfflineLoaded(true);
        setCacheTimestamp(cached.ts);
      }
    }
  }, []);

  // Auto-submit when 5 chars
  useEffect(() => {
    if (code.length === 5 && !loading && !data) {
      handleSubmit();
    }
  }, [code]);

  // Realtime sync — listen for installation_photos changes for this campaign+store
  // and reconcile local optimistic state with server-confirmed records.
  useEffect(() => {
    const campaignId = data?.campaign?.id || data?.schedule?.campaign_id;
    const storeId = data?.store?.id;
    if (!campaignId || !storeId) return;

    const channel = supabase
      .channel(`installer-photos-${campaignId}-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "installation_photos",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          const newPhoto: any = payload.new;
          if (!newPhoto || newPhoto.store_id !== storeId) return;

          setLocalPhotos((prev) => {
            // Skip if we already have this real id (avoid duplicates)
            if (prev.some((p) => p.id === newPhoto.id)) return prev;

            // Try to match an optimistic placeholder (queued or uploading) of same category
            const matchIdx = prev.findIndex(
              (p) =>
                typeof p.id === "string" &&
                p.id.startsWith("temp-") &&
                (p._uploading || p._queued) &&
                p.category === newPhoto.category
            );

            if (matchIdx >= 0) {
              const next = [...prev];
              try { URL.revokeObjectURL(next[matchIdx].photo_url); } catch { /* ignore */ }
              next[matchIdx] = newPhoto;
              return next;
            }
            // No placeholder to replace — append (e.g. uploaded from another device)
            return [...prev, newPhoto];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "installation_photos",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          const oldPhoto: any = payload.old;
          if (!oldPhoto?.id) return;
          setLocalPhotos((prev) => prev.filter((p) => p.id !== oldPhoto.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [data?.campaign?.id, data?.schedule?.campaign_id, data?.store?.id]);


  const handleSubmit = async () => {
    if (code.length !== 5) return;

    // If offline, try cache
    if (!navigator.onLine) {
      const cached = loadCache();
      if (cached && cached.code === code.toLowerCase()) {
        setData(cached.data);
        setLocalPhotos(cached.data.photos || []);
        setCheckinDone(!!cached.data.schedule?.checkin_timestamp);
        setIsCompleted(!!cached.data.schedule?.completed_at);
        setOfflineLoaded(true);
        setCacheTimestamp(cached.ts);
        return;
      }
      setError("Sem conexão. Não há dados em cache para este código.");
      return;
    }

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
        setOfflineLoaded(false);
        // Cache for offline use
        saveCache(code.toLowerCase(), result);
        setCacheTimestamp(new Date().toISOString());
      }
    } catch {
      // Network error — try cache
      const cached = loadCache();
      if (cached && cached.code === code.toLowerCase()) {
        setData(cached.data);
        setLocalPhotos(cached.data.photos || []);
        setCheckinDone(!!cached.data.schedule?.checkin_timestamp);
        setIsCompleted(!!cached.data.schedule?.completed_at);
        setOfflineLoaded(true);
        setCacheTimestamp(cached.ts);
        toast.info("Carregado do cache offline.");
      } else {
        setError("Erro de conexão. Tente novamente.");
      }
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

    const checkinPayload = {
      installCode: code.toLowerCase(),
      lat,
      lng,
      accuracy,
      timestamp: new Date().toISOString(),
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      },
      campaignId: data.campaign?.id || data.schedule?.campaign_id,
      storeId: data.store?.id,
      storeName: data.store?.name,
    };

    if (!isOnline) {
      await enqueue({ type: "checkin", createdAt: new Date().toISOString(), payload: checkinPayload });
      toast.success("Check-in salvo localmente. Será enviado quando a conexão voltar.");
      setCheckinDone(true);
      await refreshCount();
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from("campaign_schedules")
        .update({
          checkin_lat: lat,
          checkin_lng: lng,
          checkin_accuracy: accuracy,
          checkin_timestamp: checkinPayload.timestamp,
          checkin_device_info: checkinPayload.deviceInfo,
        } as any)
        .eq("install_code", code.toLowerCase());

      if (updateError) throw updateError;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/validate-install-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code.toLowerCase(), action: "checkin" }),
        }
      );

      if (data) {
        try {
          await supabase.from("campaign_activity_log" as any).insert({
            campaign_id: data.campaign?.id || data.schedule?.campaign_id,
            store_id: data.store?.id,
            actor_name: "Instalador",
            actor_type: "installer",
            action: "checkin_realizado",
            description: `Check-in realizado em ${data.store?.name || "loja"}`,
            metadata: { tem_gps: !!(lat && lng) },
          });
        } catch { /* silent */ }
      }
      toast.success("Check-in registrado! Bom trabalho. 👍");
      setCheckinDone(true);
    } catch {
      // Fallback to offline queue
      await enqueue({ type: "checkin", createdAt: new Date().toISOString(), payload: checkinPayload });
      toast.success("Check-in salvo localmente. Será enviado quando a conexão voltar.");
      setCheckinDone(true);
      await refreshCount();
    }
  };

  const handleUpload = async (files: FileList | null, method: "upload" | "camera" = "upload") => {
    if (!files || !data) return;

    const fileArray = Array.from(files);
    const total = fileArray.length;
    let sent = 0;
    let queued = 0;
    let failed = 0;

    // Haptic feedback — instant confirmation that the tap was registered
    try { (navigator as any).vibrate?.(15); } catch { /* ignore */ }

    // 1) Create optimistic placeholders IMMEDIATELY so user sees the photos before upload finishes
    const optimisticEntries = fileArray.map((file) => {
      const localUrl = URL.createObjectURL(file);
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        tempId,
        photo: {
          id: tempId,
          photo_url: localUrl,
          category: uploadCategory,
          _uploading: true,
          _failed: false,
        },
      };
    });

    setLocalPhotos((prev) => [...prev, ...optimisticEntries.map((e) => e.photo)]);

    // 2) Process each file and replace its placeholder with the real record (or mark failed)
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const { tempId } = optimisticEntries[i];

      let compressed: Blob;
      try {
        compressed = await compressImage(file, 1200, 0.7);
      } catch (err) {
        console.error("Compression failed:", err);
        compressed = file;
      }

      // Offline path
      if (!isOnline) {
        try {
          const base64 = await blobToBase64(compressed);
          await enqueue({
            type: "photo",
            createdAt: new Date().toISOString(),
            payload: {
              base64,
              installCode: code.toLowerCase(),
              storeId: data.store.id,
              category: uploadCategory,
              uploadMethod: method,
            },
          });
          queued++;
          // Mark as queued (still visible, but with pending indicator)
          setLocalPhotos((prev) =>
            prev.map((p) => (p.id === tempId ? { ...p, _uploading: false, _queued: true } : p))
          );
        } catch (e) {
          console.error("Offline queue failed:", e);
          failed++;
          setLocalPhotos((prev) =>
            prev.map((p) => (p.id === tempId ? { ...p, _uploading: false, _failed: true } : p))
          );
        }
        continue;
      }

      // Online path
      try {
        const formData = new FormData();
        formData.append("install_code", code.toLowerCase());
        formData.append("store_id", data.store.id);
        formData.append("category", uploadCategory);
        formData.append("upload_method", method);
        formData.append(
          "photo",
          new File([compressed], "photo.jpg", { type: "image/jpeg" })
        );

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/upload-installation-photo`,
          { method: "POST", body: formData }
        );

        let result: any = null;
        try { result = await res.json(); } catch { /* ignore */ }

        if (!res.ok) {
          throw new Error(result?.error || `HTTP ${res.status}`);
        }

        // Success — replace placeholder with real record
        if (result?.photo) {
          setLocalPhotos((prev) =>
            prev.map((p) => {
              if (p.id !== tempId) return p;
              // Free the temporary blob URL
              try { URL.revokeObjectURL(p.photo_url); } catch { /* ignore */ }
              return result.photo;
            })
          );
        } else {
          // No photo returned but request OK — at least mark as not uploading
          setLocalPhotos((prev) =>
            prev.map((p) => (p.id === tempId ? { ...p, _uploading: false } : p))
          );
        }
        sent++;

        // Subtle haptic on each successful photo
        try { (navigator as any).vibrate?.(10); } catch { /* ignore */ }
      } catch (err: any) {
        console.error("Upload failed, queuing offline:", err);
        // Network or server error — queue for retry, keep showing photo
        try {
          const base64 = await blobToBase64(compressed);
          await enqueue({
            type: "photo",
            createdAt: new Date().toISOString(),
            payload: {
              base64,
              installCode: code.toLowerCase(),
              storeId: data.store.id,
              category: uploadCategory,
              uploadMethod: method,
            },
          });
          queued++;
          setLocalPhotos((prev) =>
            prev.map((p) => (p.id === tempId ? { ...p, _uploading: false, _queued: true } : p))
          );
        } catch (e) {
          console.error("Final offline queue failed:", e);
          failed++;
          setLocalPhotos((prev) =>
            prev.map((p) => (p.id === tempId ? { ...p, _uploading: false, _failed: true } : p))
          );
        }
      }
    }

    await refreshCount();

    if (sent > 0) toast.success(`${sent}/${total} foto(s) enviada(s)!`);
    if (queued > 0) toast.info(`${queued} foto(s) na fila — enviarão quando a conexão estabilizar.`);
    if (failed > 0) toast.error(`${failed} foto(s) falharam. Tente novamente.`);

    setValidacaoError(null);
  };

  const handleComplete = async () => {
    if (!data) return;

    const totalMidias = localPhotos.length + pendingPhotoCount;

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

    if (!isOnline) {
      await enqueue({
        type: "completion",
        createdAt: new Date().toISOString(),
        payload: { scheduleId: data.schedule.id },
      });
      setIsCompleted(true);
      toast.success("Conclusão salva localmente. Será enviada quando a conexão voltar.");
      setTentandoConcluir(false);
      await refreshCount();
      return;
    }

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
          {/* Offline banner on login */}
          {!isOnline && (
            <div className="mb-4 flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-lg px-3 py-2 text-xs font-medium">
              <WifiOff className="w-4 h-4 flex-shrink-0" />
              Sem conexão — modo offline
            </div>
          )}
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
  const totalMidias = localPhotos.length + pendingPhotoCount;
  const atingiuMinimo = totalMidias >= MINIMO_FOTOS;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page, #F5F2ED)" }}>
      {/* Offline banner */}
      {!isOnline && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 text-white px-4 py-2 text-xs font-semibold">
          <WifiOff className="w-4 h-4" />
          Sem conexão — modo offline
          {cacheTimestamp && (
            <span className="font-normal ml-1 opacity-80">
              (dados de {new Date(cacheTimestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})
            </span>
          )}
        </div>
      )}

      {/* Syncing indicator */}
      {isSyncing && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-2 text-xs font-semibold">
          <Loader2 className="w-4 h-4 animate-spin" />
          Sincronizando {pendingCount} ação(ões)...
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 border-b px-4 py-3.5" style={{ background: "var(--brand-800, #3D2E1E)", borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: "#F5EFE6" }} />
            <p className="text-sm font-semibold truncate" style={{ color: "#F5EFE6" }}>
              {campaign?.name || "Campanha"}
            </p>
          </div>
          {!isOnline && (
            <WifiOff className="w-4 h-4 flex-shrink-0" style={{ color: "#FBBF24" }} />
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Pending sync info */}
        {pendingCount > 0 && isOnline && !isSyncing && (
          <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 rounded-lg px-3 py-2 text-xs font-medium">
            <Loader2 className="w-3.5 h-3.5" />
            {pendingCount} ação(ões) pendente(s) de sincronização
          </div>
        )}

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
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Fotos da instalação</p>
            {pendingPhotoCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full px-2 py-0.5">
                <Upload className="w-3 h-3" />
                {pendingPhotoCount} pendente{pendingPhotoCount > 1 ? "s" : ""}
              </span>
            )}
          </div>

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
                <div key={photo.id} className="relative w-16 h-16 rounded-md overflow-hidden border border-border">
                  <img
                    src={photo.photo_url}
                    alt=""
                    className={`w-full h-full object-cover transition-opacity ${photo._uploading ? "opacity-50" : ""}`}
                  />
                  {photo._uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                  {photo._queued && !photo._uploading && (
                    <div className="absolute bottom-0 inset-x-0 bg-amber-500 text-white text-[9px] font-semibold text-center py-0.5 leading-tight">
                      Na fila
                    </div>
                  )}
                  {photo._failed && (
                    <div className="absolute inset-0 flex items-center justify-center bg-destructive/80">
                      <AlertTriangle className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
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
            }`}
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
