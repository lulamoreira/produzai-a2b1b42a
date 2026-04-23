import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Camera, Upload, CalendarIcon, Clock, MapPin, Phone, User,
  CheckCircle, KeyRound, Store, FileText, Building2, AlertTriangle,
  ArrowDown, ChevronDown, ChevronUp,
  Loader2, X, Leaf, RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { compressImage } from "@/lib/compressImage";
import { getCompressionProfile } from "@/lib/deviceProfile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PhasePickerDialog, { type PhotoPhase } from "@/components/PhasePickerDialog";

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
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<any | null>(null);
  const [phasePickerOpen, setPhasePickerOpen] = useState(false);
  const pendingMethodRef = useRef<"upload" | "camera">("upload");
  const pendingPhaseRef = useRef<PhotoPhase>("before");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Profile used both for compression and to avoid decoding original full-res photos on Android
  const compressionProfile = getCompressionProfile();
  const isMemorySaver = compressionProfile.tier !== "high";

  // Track tempIds the user cancelled mid-upload, so the upload loop can skip them
  const cancelledTempIdsRef = useRef<Set<string>>(new Set());

  // Cache of compressed blobs per tempId so the user can retry a failed upload
  // without re-selecting the photo (memory-light: we only keep what's still on screen).
  const compressedBlobsRef = useRef<Map<string, Blob>>(new Map());

  // Track photo IDs deleted in this session so a stale revalidation never resurrects them.
  const deletedPhotoIdsRef = useRef<Set<string>>(new Set());

  // Concurrency-limited upload queue to prevent OOM on mobile.
  // High-tier (desktop/iOS) → 2 parallel uploads; mid/low-tier (Android) → 1 to keep RAM flat.
  const uploadQueueRef = useRef<Array<() => Promise<void>>>([]);
  const activeUploadsRef = useRef(0);
  const UPLOAD_CONCURRENCY = compressionProfile.tier === "high" ? 2 : 1;

  const runQueue = useCallback(() => {
    while (
      activeUploadsRef.current < UPLOAD_CONCURRENCY &&
      uploadQueueRef.current.length > 0
    ) {
      const task = uploadQueueRef.current.shift();
      if (!task) break;
      activeUploadsRef.current++;
      task().finally(() => {
        activeUploadsRef.current--;
        runQueue();
      });
    }
  }, []);

  const enqueueUpload = useCallback(
    (task: () => Promise<void>) => {
      uploadQueueRef.current.push(task);
      runQueue();
    },
    [runQueue]
  );

  // Silent revalidation — fetches the latest server state to refresh check-in/photos/completion
  const revalidateFromServer = useCallback(async (codeArg: string) => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/validate-install-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: codeArg.toLowerCase(), action: "view" }),
        }
      );
      if (!res.ok) return;
      const result = await res.json();
      // Never let a fresh server response erase a check-in that the user already made.
      // If for any reason the server didn't echo back the check-in (e.g. partial response,
      // replication lag, or out-of-order writes), keep the locally confirmed values.
      setData((prev) => {
        const prevCheckin = prev?.schedule?.checkin_timestamp;
        const nextCheckin = result?.schedule?.checkin_timestamp;
        if (prevCheckin && !nextCheckin && result?.schedule) {
          return {
            ...result,
            schedule: {
              ...result.schedule,
              checkin_timestamp: prev?.schedule?.checkin_timestamp,
              checkin_lat: prev?.schedule?.checkin_lat,
              checkin_lng: prev?.schedule?.checkin_lng,
              checkin_accuracy: prev?.schedule?.checkin_accuracy,
              checkin_device_info: prev?.schedule?.checkin_device_info,
            },
          };
        }
        return result;
      });
      // Merge server photos with any local optimistic placeholders still uploading/failed.
      // Filter out any photos the user already deleted in this session, even if the server
      // still returns them (race between delete + revalidate).
      setLocalPhotos((prev) => {
        const optimistic = prev.filter(
          (p: any) => typeof p.id === "string" && p.id.startsWith("temp-") && (p._uploading || p._failed)
        );
        const serverPhotos = (result.photos || []).filter(
          (p: any) => !deletedPhotoIdsRef.current.has(p.id)
        );
        return [...serverPhotos, ...optimistic];
      });
      // Sticky check-in: once true locally, never flip back to false based on a server view.
      setCheckinDone((prev) => prev || !!result.schedule?.checkin_timestamp);
      setIsCompleted((prev) => prev || !!result.schedule?.completed_at);

      // Cache: preserve any locally confirmed check-in fields if the server view omitted them.
      const cacheData = (() => {
        if (!result?.schedule) return result;
        const cached = loadCache();
        const cachedSchedule = cached?.data?.schedule;
        if (cachedSchedule?.checkin_timestamp && !result.schedule.checkin_timestamp) {
          return {
            ...result,
            schedule: {
              ...result.schedule,
              checkin_timestamp: cachedSchedule.checkin_timestamp,
              checkin_lat: cachedSchedule.checkin_lat,
              checkin_lng: cachedSchedule.checkin_lng,
              checkin_accuracy: cachedSchedule.checkin_accuracy,
              checkin_device_info: cachedSchedule.checkin_device_info,
            },
          };
        }
        return result;
      })();
      saveCache(codeArg.toLowerCase(), cacheData);
      setCacheTimestamp(new Date().toISOString());
    } catch {
      /* silent — keep cached view */
    }
  }, []);

  // Extra safety: poll the backend a couple of times right after a check-in to make
  // sure it was actually persisted. If we ever see the server losing it, we re-send
  // the check-in payload silently. The UI never "unchecks" itself thanks to the
  // sticky checkinDone state.
  const confirmCheckinPersisted = useCallback(
    async (codeArg: string, expectedTimestamp: string) => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/validate-install-code`;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: codeArg, action: "view" }),
          });
          if (!res.ok) continue;
          const result = await res.json();
          if (result?.schedule?.checkin_timestamp) {
            // Backend confirmed → reconcile the cache so the next refresh shows it instantly
            saveCache(codeArg, result);
            return;
          }

          // Server view doesn't show the check-in yet → resend it silently
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: codeArg,
              action: "checkin",
              timestamp: expectedTimestamp,
            }),
          });
        } catch {
          /* network blip — try again */
        }
      }
    },
    []
  );

  // Auto-restore session on mount — keep installer logged in across refreshes.
  // Shows cached view immediately, then ALWAYS revalidates from the server so things
  // like check-in status and newly uploaded photos appear without re-typing the code.
  useEffect(() => {
    if (data) return;
    const cached = loadCache();
    if (!cached) return;

    setCode(cached.code);
    setCacheTimestamp(cached.ts);
    setData(cached.data);
    setLocalPhotos(cached.data.photos || []);
    setCheckinDone(!!cached.data.schedule?.checkin_timestamp);
    setIsCompleted(!!cached.data.schedule?.completed_at);

    revalidateFromServer(cached.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-submit when 5 chars and no data restored from cache yet
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
        // Cache only metadata for fast restore on refresh (no offline operation)
        saveCache(code.toLowerCase(), result);
        setCacheTimestamp(new Date().toISOString());
      }
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
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

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/validate-install-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: code.toLowerCase(),
            action: "checkin",
            lat,
            lng,
            accuracy,
            timestamp: checkinPayload.timestamp,
            deviceInfo: checkinPayload.deviceInfo,
          }),
        }
      );

      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(result?.error || "Não foi possível registrar o check-in.");
      }

      toast.success("Check-in registrado! Bom trabalho. 👍");
      setCheckinDone(true);
      // Persist check-in into local data + cache so a refresh doesn't lose it
      setData((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          schedule: {
            ...prev.schedule,
            checkin_lat: lat,
            checkin_lng: lng,
            checkin_accuracy: accuracy,
            checkin_timestamp: checkinPayload.timestamp,
            checkin_device_info: checkinPayload.deviceInfo,
          },
        };
        try { saveCache(code.toLowerCase(), updated); } catch { /* ignore */ }
        return updated;
      });

      // Extra safety: re-read from the backend right after to confirm the check-in
      // was actually persisted. If the server doesn't echo it back yet (replication
      // lag), keep the local value — the sticky logic in revalidateFromServer also
      // guarantees the UI never "uncheks" itself on refresh.
      void confirmCheckinPersisted(code.toLowerCase(), checkinPayload.timestamp);
    } catch {
      toast.error("Não foi possível registrar o check-in. Verifique sua conexão e tente novamente.");
    }
  };

  const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB hard cap before we even attempt compression
  const MEMORY_SAVER_MAX_FILES = 3; // max files per selection in memory-saver mode

  /**
   * Upload a single file through the concurrency-limited queue.
   * Used by both initial upload and the manual retry button on failed photos.
   */
  const uploadSingleFile = useCallback(
    (
      file: Blob,
      tempId: string,
      category: string,
      method: "upload" | "camera",
      counters: { sent: () => void; failed: () => void }
    ) => {
      enqueueUpload(async () => {
        if (!data) return;
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const code_lc = code.toLowerCase();

        const uploadOnce = async (): Promise<{ res: Response; result: any }> => {
          const formData = new FormData();
          formData.append("install_code", code_lc);
          formData.append("store_id", data.store.id);
          formData.append("category", category);
          formData.append("upload_method", method);
          formData.append("photo", new File([file], "photo.jpg", { type: "image/jpeg" }));

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);
          try {
            const res = await fetch(
              `https://${projectId}.supabase.co/functions/v1/upload-installation-photo`,
              { method: "POST", body: formData, signal: controller.signal }
            );
            let result: any = null;
            try { result = await res.json(); } catch { /* ignore */ }
            return { res, result };
          } finally {
            clearTimeout(timeoutId);
          }
        };

        // Exponential backoff: try once, then retry up to 3 times waiting 2s, 4s, 8s.
        const BACKOFFS_MS = [2000, 4000, 8000];
        let res: Response | undefined;
        let result: any;
        let lastErr: unknown = null;

        for (let attempt = 0; attempt <= BACKOFFS_MS.length; attempt++) {
          try {
            ({ res, result } = await uploadOnce());
            if (!res.ok) throw new Error(result?.error || `HTTP ${res.status}`);
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            if (attempt < BACKOFFS_MS.length) {
              const wait = BACKOFFS_MS[attempt];
              toast.info(`Tentativa ${attempt + 2} de ${BACKOFFS_MS.length + 1} — aguardando rede…`);
              await new Promise((r) => setTimeout(r, wait));
            }
          }
        }

        if (lastErr || !res || !res.ok) {
          if (cancelledTempIdsRef.current.has(tempId)) {
            cancelledTempIdsRef.current.delete(tempId);
          } else {
            counters.failed();
            setLocalPhotos((prev) =>
              prev.map((p) => (p.id === tempId ? { ...p, _uploading: false, _failed: true } : p))
            );
          }
          return;
        }

        // If user cancelled mid-flight — delete server record and skip UI update
        if (cancelledTempIdsRef.current.has(tempId)) {
          cancelledTempIdsRef.current.delete(tempId);
          compressedBlobsRef.current.delete(tempId);
          if (result?.photo?.id) {
            try {
              const photoUrl = result.photo.photo_url as string;
              const url = new URL(photoUrl);
              const m = url.pathname.match(/\/storage\/v1\/object\/public\/installation-photos\/(.+)/);
              if (m) await supabase.storage.from("installation-photos").remove([m[1]]);
              await supabase.from("installation_photos").delete().eq("id", result.photo.id);
            } catch { /* ignore */ }
          }
          return;
        }

        if (result?.photo) {
          setLocalPhotos((prev) =>
            prev.map((p) => {
              if (p.id !== tempId) return p;
              try { URL.revokeObjectURL(p.photo_url); } catch { /* ignore */ }
              return result.photo;
            })
          );
        } else {
          setLocalPhotos((prev) =>
            prev.map((p) => (p.id === tempId ? { ...p, _uploading: false } : p))
          );
        }
        counters.sent();
        // Released: drop the cached blob now that it's safely on the server
        compressedBlobsRef.current.delete(tempId);
        try { (navigator as any).vibrate?.(10); } catch { /* ignore */ }
      });
    },
    [code, data, enqueueUpload]
  );

  const handleUpload = async (files: FileList | null, method: "upload" | "camera" = "upload") => {
    if (!files || !data) return;

    let fileArray = Array.from(files);

    // Fix 6 — memory-saver: cap how many files can be processed per selection.
    if (isMemorySaver && fileArray.length > MEMORY_SAVER_MAX_FILES) {
      toast.error(
        `Selecione no máximo ${MEMORY_SAVER_MAX_FILES} fotos por vez para economizar memória`
      );
      fileArray = fileArray.slice(0, MEMORY_SAVER_MAX_FILES);
    }

    // Fix 1 — drop oversized files BEFORE compression to avoid OOM crashes.
    const validFiles: File[] = [];
    for (const file of fileArray) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(
          "Foto muito grande (máximo 15MB). Tente tirar uma nova foto com menor resolução."
        );
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length === 0) return;

    const total = validFiles.length;
    let sent = 0;
    let failed = 0;
    const counters = {
      sent: () => { sent++; },
      failed: () => { failed++; },
    };

    try { (navigator as any).vibrate?.(15); } catch { /* ignore */ }

    // 1) Optimistic placeholders. In memory-saver we DO NOT decode the original
    // (no object URL from `file`) — the preview is built from the compressed blob.
    const optimisticEntries = validFiles.map((file) => {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        tempId,
        file,
        photo: {
          id: tempId,
          photo_url: isMemorySaver ? "" : URL.createObjectURL(file),
          category: uploadCategory,
          _uploading: true,
          _failed: false,
          _previewPending: isMemorySaver,
        },
      };
    });

    setLocalPhotos((prev) => [...prev, ...optimisticEntries.map((e) => e.photo)]);

    // 2) Compress + enqueue each file STRICTLY sequentially with backpressure.
    // Compression is awaited (CPU/memory heavy: decoding two photos at once on a
    // low-end Android causes OOM). After enqueueing, we also wait for a free queue
    // slot before starting the next file's compression — this guarantees that at
    // most (UPLOAD_CONCURRENCY + 1) compressed blobs exist in memory at any time,
    // regardless of how many files the user selected.
    for (const entry of optimisticEntries) {
      const { tempId, file } = entry;

      // Backpressure: wait until the queue has room before compressing the next file.
      while (
        uploadQueueRef.current.length + activeUploadsRef.current >= UPLOAD_CONCURRENCY
      ) {
        await new Promise<void>((r) => setTimeout(r, 100));
      }

      let compressed: Blob;
      try {
        compressed = await compressImage(file);
      } catch (err) {
        console.error("Compression failed:", err);
        compressed = file;
      }

      // In memory-saver mode, attach the compressed preview and immediately revoke
      // any object URL we created from the (large) original file.
      if (isMemorySaver) {
        const compressedPreviewUrl = URL.createObjectURL(compressed);
        setLocalPhotos((prev) =>
          prev.map((p) => {
            if (p.id !== tempId) return p;
            // Revoke the previous blob URL (from the original file) before swapping it
            // out, otherwise the original-file Blob stays alive in memory.
            if (p.photo_url?.startsWith("blob:")) {
              try { URL.revokeObjectURL(p.photo_url); } catch { /* ignore */ }
            }
            return { ...p, photo_url: compressedPreviewUrl, _previewPending: false };
          })
        );
      }

      // Cache compressed blob so the user can retry without re-picking the photo
      compressedBlobsRef.current.set(tempId, compressed);

      uploadSingleFile(compressed, tempId, uploadCategory, method, counters);
    }

    // Wait for the queue to drain so we can show a meaningful aggregate toast.
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (
          activeUploadsRef.current === 0 &&
          uploadQueueRef.current.length === 0
        ) {
          resolve();
        } else {
          setTimeout(tick, 250);
        }
      };
      tick();
    });

    if (sent > 0) toast.success(`${sent}/${total} foto(s) enviada(s)!`);
    if (failed > 0) toast.error(`${failed} foto(s) falharam. Toque na foto para tentar novamente.`);

    setValidacaoError(null);
  };

  /**
   * Fix 4 — manual retry for a previously-failed photo. Reuses the cached compressed
   * blob if it's still in memory; otherwise asks the user to re-select the photo.
   */
  const handleRetryUpload = (photo: any) => {
    const tempId = photo.id as string;
    const compressed = compressedBlobsRef.current.get(tempId);
    if (!compressed) {
      toast.info("Foto não está mais em memória — selecione novamente.");
      // Drop the failed placeholder so the user can re-add the file cleanly.
      setLocalPhotos((prev) => {
        const stale = prev.find((p) => p.id === tempId);
        if (stale?.photo_url?.startsWith("blob:")) {
          try { URL.revokeObjectURL(stale.photo_url); } catch { /* ignore */ }
        }
        return prev.filter((p) => p.id !== tempId);
      });
      return;
    }
    // Reset the preview lifecycle: revoke the stale blob URL held by the failed card
    // and mint a fresh one from the cached compressed blob so memory is reclaimed.
    const freshUrl = URL.createObjectURL(compressed);
    setLocalPhotos((prev) =>
      prev.map((p) => {
        if (p.id !== tempId) return p;
        if (p.photo_url?.startsWith("blob:")) {
          try { URL.revokeObjectURL(p.photo_url); } catch { /* ignore */ }
        }
        return { ...p, photo_url: freshUrl, _uploading: true, _failed: false };
      })
    );
    let sent = 0;
    let failed = 0;
    const counters = {
      sent: () => { sent++; toast.success("Foto reenviada com sucesso!"); },
      failed: () => { failed++; toast.error("Falha ao reenviar. Tente novamente em instantes."); },
    };
    uploadSingleFile(
      compressed,
      tempId,
      photo.category || uploadCategory,
      "upload",
      counters
    );
  };


  /**
   * Remove a photo from the grid. Handles two cases:
   * 1) Optimistic placeholder still uploading → mark as cancelled (upload loop will skip on completion)
   * 2) Already saved on server → delete storage object + DB row
   * In all cases, the UI is updated immediately.
   */
  const handleRemovePhoto = async (photo: any) => {
    const isTemp = typeof photo.id === "string" && photo.id.startsWith("temp-");

    // 1) Remove from UI immediately
    setLocalPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    try { if (photo.photo_url?.startsWith("blob:")) URL.revokeObjectURL(photo.photo_url); } catch { /* ignore */ }
    compressedBlobsRef.current.delete(photo.id);

    try {
      if (isTemp) {
        // Mark as cancelled so the in-flight upload loop will skip server-side side effects
        cancelledTempIdsRef.current.add(photo.id);
        return;
      }

      // Already-saved server photo → delete via edge function (uses service role, bypasses RLS).
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/delete-installation-photo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photo_id: photo.id,
            photo_url: photo.photo_url,
            install_code: code.toLowerCase(),
            store_id: data?.store?.id,
          }),
        }
      );
      if (!res.ok) throw new Error(await res.text());

      // Remember this id so a stale revalidation doesn't bring it back
      deletedPhotoIdsRef.current.add(photo.id);
    } catch (err: any) {
      console.error("Failed to remove photo:", err);
      toast.error("Não foi possível remover a foto. Tente novamente.");
      // Restore on failure
      setLocalPhotos((prev) => (prev.some((p) => p.id === photo.id) ? prev : [...prev, photo]));
    }
  };

  const handleComplete = async () => {
    if (!data) return;

    const totalMidias = localPhotos.length;

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
          {/* Offline mode removed — uploads go straight to the server */}

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
  // Counters derived from localPhotos for instant reactivity
  const sentCount = localPhotos.filter((p: any) => !p._uploading && !p._failed).length;
  const uploadingCount = localPhotos.filter((p: any) => p._uploading).length;
  const failedCount = localPhotos.filter((p: any) => p._failed).length;
  // Pending = anything not yet confirmed by server. Failed are not counted toward minimum.
  const totalMidias = sentCount + uploadingCount;
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

        {/* Memory-saver persistent info banner (Fix 6) */}
        {isMemorySaver && (
          <div
            className="rounded-xl px-3 py-2 flex items-start gap-2 text-xs border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/15 text-emerald-800 dark:text-emerald-200"
            role="status"
          >
            <Leaf className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Modo economia de memória ativo — envie as fotos em grupos menores
              (até 3 por vez) para melhor desempenho.
            </span>
          </div>
        )}

        {/* Photos */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3" id="secao-fotos">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Fotos da instalação</p>
              {isMemorySaver && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-full px-2 py-0.5 border border-emerald-200 dark:border-emerald-900/40"
                  title={`Compressão otimizada para seu dispositivo (${compressionProfile.maxDimension}px · q${compressionProfile.quality})`}
                >
                  <Leaf className="w-3 h-3" />
                  Modo economia
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <span
                key={`sent-${sentCount}`}
                className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full px-2 py-0.5 transition-all animate-in fade-in zoom-in-95"
              >
                <CheckCircle className="w-3 h-3" />
                {sentCount} enviada{sentCount === 1 ? "" : "s"}
              </span>
              {uploadingCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full px-2 py-0.5 animate-in fade-in zoom-in-95">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {uploadingCount} enviando
                </span>
              )}
              {/* Offline queue removed */}

              {failedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-destructive/15 text-destructive rounded-full px-2 py-0.5 animate-in fade-in zoom-in-95">
                  <AlertTriangle className="w-3 h-3" />
                  {failedCount} falhou
                </span>
              )}
            </div>
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
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1"
              onClick={() => {
                pendingMethodRef.current = "camera";
                setPhasePickerOpen(true);
              }}
            >
              <Camera className="w-3 h-3" /> Tirar foto
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1"
              onClick={() => {
                pendingMethodRef.current = "upload";
                setPhasePickerOpen(true);
              }}
            >
              <Upload className="w-3 h-3" /> Upload
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { handleUpload(e.target.files, "camera"); e.target.value = ""; }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { handleUpload(e.target.files, "upload"); e.target.value = ""; }}
            />
          </div>
          <PhasePickerDialog
            open={phasePickerOpen}
            onOpenChange={setPhasePickerOpen}
            onSelect={(phase) => {
              pendingPhaseRef.current = phase;
              setUploadCategory(phase);
              setPhasePickerOpen(false);
              setTimeout(() => {
                if (pendingMethodRef.current === "camera") cameraInputRef.current?.click();
                else fileInputRef.current?.click();
              }, 50);
            }}
          />

          {localPhotos.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {localPhotos.map((photo: any) => (
                <div key={photo.id} className="relative w-16 h-16 rounded-md overflow-hidden border border-border group bg-muted/40">
                  {photo.photo_url ? (
                    <img
                      src={photo.photo_url}
                      alt=""
                      className={`w-full h-full object-cover transition-opacity ${photo._uploading ? "opacity-50" : ""}`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                  {photo._uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                  {/* Offline queue removed */}

                  {photo._failed && (
                    <button
                      type="button"
                      onClick={() => handleRetryUpload(photo)}
                      aria-label="Falhou — toque para tentar novamente"
                      title="Falhou — toque para tentar novamente"
                      className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-destructive/85 hover:bg-destructive text-white transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span className="text-[8px] font-semibold leading-none px-1 text-center">
                        Tentar novamente
                      </span>
                    </button>
                  )}
                  {/* Remove button — always visible on touch devices */}
                  <button
                    type="button"
                    onClick={() => setPhotoToDelete(photo)}
                    aria-label="Remover foto"
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 hover:bg-destructive text-white flex items-center justify-center shadow-sm transition-colors z-10"
                  >
                    <X className="w-3 h-3" strokeWidth={3} />
                  </button>
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

      <AlertDialog open={!!photoToDelete} onOpenChange={(open) => !open && setPhotoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta foto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A foto será removida permanentemente do registro de instalação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {photoToDelete?.photo_url && (
            <div className="flex justify-center py-2">
              <img
                src={photoToDelete.photo_url}
                alt=""
                className="max-h-40 rounded-md object-contain border border-border"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const photo = photoToDelete;
                setPhotoToDelete(null);
                if (photo) handleRemovePhoto(photo);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
