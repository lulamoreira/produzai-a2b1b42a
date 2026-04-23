import { useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Camera, Upload, CalendarIcon, Clock, FileText, MapPin,
  Phone, User, LogOut, CheckCircle, Image, Wrench, Store,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { compressImage } from "@/lib/compressImage";
import PhasePickerDialog, { PhotoPhase } from "@/components/PhasePickerDialog";

interface InstallerData {
  team: { id: string; name: string };
  campaign: any;
  schedules: any[];
  pieces: any[];
  storePieces: any[];
  photos: any[];
  members: any[];
}

export default function InstallerDashboard() {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InstallerData | null>(null);
  const [error, setError] = useState("");
  const [uploadCategory, setUploadCategory] = useState<Record<string, string>>({});
  const [localPhotos, setLocalPhotos] = useState<any[]>([]);
  const [completedStores, setCompletedStores] = useState<Map<string, string>>(new Map());

  const [pickerOpen, setPickerOpen] = useState(false);
  const pendingStoreRef = useRef<string | null>(null);
  const pendingMethodRef = useRef<"upload" | "camera">("upload");
  const pendingPhaseRef = useRef<PhotoPhase>("before");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const openPhasePicker = (storeId: string, method: "upload" | "camera") => {
    pendingStoreRef.current = storeId;
    pendingMethodRef.current = method;
    setPickerOpen(true);
  };

  const handlePhaseSelected = (phase: PhotoPhase) => {
    pendingPhaseRef.current = phase;
    setPickerOpen(false);
    setTimeout(() => {
      if (pendingMethodRef.current === "camera") cameraInputRef.current?.click();
      else fileInputRef.current?.click();
    }, 50);
  };

  const handleLogin = async () => {
    if (code.length !== 10) {
      setError(t("installer.codeMustBe10"));
      return;
    }
    setLoading(true);
    setError("");

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/validate-team-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code.toUpperCase() }),
        }
      );

      const result = await res.json();
      if (!res.ok) {
        setError(result.error || t("common.invalidCode"));
      } else {
        setData(result);
        setLocalPhotos(result.photos || []);
        const initialCompleted = new Map<string, string>();
        (result.schedules || []).forEach((s: any) => {
          if (s.completed_at && s.client_stores?.id) {
            initialCompleted.set(s.client_stores.id, s.completed_at);
          }
        });
        setCompletedStores(initialCompleted);
      }
    } catch {
      setError(t("common.connectionError"));
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (storeId: string, files: FileList | null, method: "upload" | "camera" = "upload") => {
    if (!files || !data) return;
    const category = pendingPhaseRef.current || "before";
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImage(file, 1200, 0.7);
        const formData = new FormData();
        formData.append("team_code", code);
        formData.append("store_id", storeId);
        formData.append("category", category);
        formData.append("upload_method", method);
        formData.append("photo", new File([compressed], `photo.jpg`, { type: "image/jpeg" }));

        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/upload-installation-photo`,
          { method: "POST", body: formData }
        );

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || t("installer.uploadError"));
        if (result.photo) setLocalPhotos((prev) => [...prev, result.photo]);
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || t("installer.uploadError"));
      }
    }
    toast.success(t("installer.photosSent", { count: files.length }));
  };

  const toggleComplete = async (storeId: string, scheduleId: string) => {
    const isCurrentlyCompleted = completedStores.has(storeId);
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/complete-installation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schedule_id: scheduleId, completed: !isCurrentlyCompleted }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      setCompletedStores((prev) => {
        const next = new Map(prev);
        if (isCurrentlyCompleted) {
          next.delete(storeId);
        } else {
          next.set(storeId, result.completed_at);
        }
        return next;
      });
      toast.success(isCurrentlyCompleted ? t("common.markRemoved") : t("common.installationCompleted"));
    } catch (err: any) {
      toast.error(err.message || t("installer.uploadError"));
    }
  };

  const photosByStore = useMemo(() => {
    const map: Record<string, any[]> = {};
    localPhotos.forEach((p) => { (map[p.store_id] = map[p.store_id] || []).push(p); });
    return map;
  }, [localPhotos]);

  // Login screen
  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Wrench className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">{t("installer.teamAccess")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("installer.enterCode")}
            </p>
          </div>

          <div className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-6 shadow-xl space-y-4">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
              placeholder="XXXXXXXXXX"
              className="text-center text-lg font-mono tracking-[0.3em] h-12"
              maxLength={10}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              data-form-type="other"
              data-lpignore="true"
            />
            <p className="text-xs text-muted-foreground text-center">{t("installer.codeLength", { count: code.length })}</p>

            {error && (
              <p className="text-xs text-destructive text-center bg-destructive/10 rounded-lg p-2">{error}</p>
            )}

            <Button
              className="w-full"
              onClick={handleLogin}
              disabled={loading || code.length !== 10}
            >
              {loading ? t("installer.validating") : t("auth.login")}
            </Button>

            <div className="text-center">
              <a href="/auth" className="text-xs text-muted-foreground hover:text-foreground">
                ← {t("installer.backToMainLogin")}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard
  const clientName = data.campaign?.clients?.name || "";
  const agencyName = data.campaign?.clients?.agencies?.name || "";
  const campaignName = data.campaign?.name || "";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-sidebar text-sidebar-foreground border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate">{data.team.name}</p>
            <p className="text-[10px] text-sidebar-foreground/60 truncate">
              {agencyName} · {clientName} · {campaignName}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground text-xs gap-1"
            onClick={() => { setData(null); setCode(""); setLocalPhotos([]); setCompletedStores(new Map()); }}
          >
            <LogOut className="w-3.5 h-3.5" /> {t("auth.logout")}
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {t("installer.todayInstallations")} — {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
          </span>
          <span className="text-xs text-muted-foreground ml-auto">
            {t("installer.storeCount", { count: data.schedules.length })}
          </span>
        </div>

        {data.schedules.map((schedule: any) => {
          const store = schedule.client_stores;
          if (!store) return null;
          const storePhotos = photosByStore[store.id] || [];
          const isCompleted = completedStores.has(store.id);
          const catForStore = uploadCategory[store.id] || "before";
          const address = [store.street, store.number, store.complement, store.neighborhood, store.city, store.state]
            .filter(Boolean).join(", ") || t("common.addressNotInformed");

          const selectedDate = schedule.scheduled_date
            ? new Date(schedule.scheduled_date + "T12:00:00")
            : undefined;

          const storePiecesList = (data.storePieces || []).filter((sp: any) => sp.store_id === store.id);
          const piecesForStore = storePiecesList.map((sp: any) => {
            const piece = data.pieces.find((p: any) => p.id === sp.piece_id);
            return piece ? { ...piece, quantity: sp.quantity } : null;
          }).filter(Boolean);

          return (
            <div
              key={schedule.id}
              className={`aqua-card overflow-hidden transition-all ${isCompleted ? "ring-2 ring-green-500/50 opacity-80" : ""}`}
            >
              <div className="bg-primary/10 px-4 py-3 flex items-center gap-3">
                <Store className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-foreground truncate">
                    {store.store_code ? `${store.store_code} — ` : ""}{store.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{store.nickname || ""}</p>
                </div>
                {isCompleted && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />}
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{address}</span>
                </div>

                {(store.manager_name || store.phone) && (
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {store.manager_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {store.manager_name}
                      </span>
                    )}
                    {store.phone && (
                      <a href={`tel:${store.phone}`} className="flex items-center gap-1 text-primary">
                        <Phone className="w-3 h-3" /> {store.phone}
                      </a>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-3 text-xs">
                  {selectedDate && (
                    <span className="flex items-center gap-1 text-foreground">
                      <CalendarIcon className="w-3 h-3 text-muted-foreground" />
                      {format(selectedDate, "dd/MM/yyyy")}
                    </span>
                  )}
                  {schedule.scheduled_time && (
                    <span className="flex items-center gap-1 text-foreground">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      {schedule.scheduled_time}
                    </span>
                  )}
                  {schedule.installation_os && (
                    <span className="flex items-center gap-1 text-foreground">
                      <FileText className="w-3 h-3 text-muted-foreground" />
                      OS: {schedule.installation_os}
                    </span>
                  )}
                </div>

                {piecesForStore.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">{t("common.pieces")}:</p>
                    <div className="grid grid-cols-1 gap-1">
                      {piecesForStore.map((p: any) => (
                        <div key={p.id} className="text-xs bg-muted/50 rounded-md px-2 py-1 flex justify-between">
                          <span className="truncate">{p.name}</span>
                          <span className="font-mono text-muted-foreground ml-2">x{p.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <hr className="border-border" />

                {storePhotos.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {storePhotos.map((photo: any) => (
                      <img
                        key={photo.id}
                        src={photo.photo_url}
                        alt=""
                        className="w-14 h-14 rounded-md object-cover border border-border"
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5 flex-wrap">
                  <select
                    value={catForStore}
                    onChange={(e) => setUploadCategory((prev) => ({ ...prev, [store.id]: e.target.value }))}
                    className="h-8 text-xs rounded-md border border-border bg-card text-foreground px-2"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                    ))}
                  </select>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => { handleUpload(store.id, e.target.files, "camera"); e.target.value = ""; }}
                    />
                    <Button variant="outline" size="sm" className="text-xs gap-1 pointer-events-none" asChild>
                      <span><Upload className="w-3 h-3" /> {t("common.upload")}</span>
                    </Button>
                  </label>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => { handleUpload(store.id, e.target.files, "upload"); e.target.value = ""; }}
                    />
                    <Button variant="outline" size="sm" className="text-xs gap-1 pointer-events-none" asChild>
                      <span><Camera className="w-3 h-3" /> {t("common.photo")}</span>
                    </Button>
                  </label>
                </div>
              </div>

              <div className="border-t border-border bg-muted/30 px-4 py-3">
                <Button
                  variant={isCompleted ? "default" : "outline"}
                  size="sm"
                  className={`w-full text-xs gap-2 ${isCompleted ? "bg-green-600 hover:bg-green-700" : ""}`}
                  onClick={() => toggleComplete(store.id, schedule.id)}
                >
                  <CheckCircle className="w-4 h-4" />
                  {isCompleted ? t("installer.installationCompletedCheck") : t("installations.markComplete")}
                  {storePhotos.length > 0 && (
                    <span className="ml-auto bg-primary/15 text-primary font-bold px-2 py-0.5 rounded-full text-[10px]">
                      {storePhotos.length} {t("common.photo").toLowerCase()}(s)
                    </span>
                  )}
                </Button>
              </div>
            </div>
          );
        })}

        {data.schedules.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">{t("installer.noInstallations")}</p>
          </div>
        )}
      </main>
    </div>
  );
}
