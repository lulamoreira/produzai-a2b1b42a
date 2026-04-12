import { useState, useEffect, useCallback, useRef } from "react";
import {
  getAllQueued,
  dequeue,
  base64ToBlob,
  queueCount,
  type QueueItem,
} from "@/lib/offlineQueue";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Hook that tracks online/offline state and auto-syncs the
 * offline queue when connectivity is restored.
 */
export function useOfflineSync(onSyncComplete?: () => void) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const syncingRef = useRef(false);

  // Refresh pending count
  const refreshCount = useCallback(async () => {
    try {
      const count = await queueCount();
      setPendingCount(count);
    } catch {
      /* ignore */
    }
  }, []);

  // Process a single checkin item
  const processCheckin = async (item: QueueItem) => {
    const p = item.payload;
    const { error } = await supabase
      .from("campaign_schedules")
      .update({
        checkin_lat: p.lat,
        checkin_lng: p.lng,
        checkin_accuracy: p.accuracy,
        checkin_timestamp: p.timestamp,
        checkin_device_info: p.deviceInfo,
      } as any)
      .eq("install_code", p.installCode);
    if (error) throw error;

    // Also call the edge function for logging
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    await fetch(
      `https://${projectId}.supabase.co/functions/v1/validate-install-code`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: p.installCode, action: "checkin" }),
      }
    );

    // Log activity
    if (p.campaignId && p.storeId) {
      try {
        await supabase.from("campaign_activity_log" as any).insert({
          campaign_id: p.campaignId,
          store_id: p.storeId,
          actor_name: "Instalador",
          actor_type: "installer",
          action: "checkin_realizado",
          description: `Check-in realizado (offline sync) em ${p.storeName || "loja"}`,
          metadata: { tem_gps: !!(p.lat && p.lng), offline: true },
        });
      } catch {
        /* silent */
      }
    }
  };

  // Process a single photo item
  const processPhoto = async (item: QueueItem) => {
    const p = item.payload;
    const blob = base64ToBlob(p.base64);
    const formData = new FormData();
    formData.append("install_code", p.installCode);
    formData.append("store_id", p.storeId);
    formData.append("category", p.category);
    formData.append("upload_method", p.uploadMethod || "upload");
    formData.append("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/upload-installation-photo`,
      { method: "POST", body: formData }
    );
    if (!res.ok) {
      const r = await res.json().catch(() => ({}));
      throw new Error(r.error || "Upload failed");
    }
    return (await res.json()).photo;
  };

  // Process a single completion item
  const processCompletion = async (item: QueueItem) => {
    const p = item.payload;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/complete-installation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule_id: p.scheduleId, completed: true }),
      }
    );
    if (!res.ok) {
      const r = await res.json().catch(() => ({}));
      throw new Error(r.error || "Completion failed");
    }
  };

  // Drain the entire queue in order
  const drainQueue = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const items = await getAllQueued();
      if (items.length === 0) return;

      // Sort: checkin first, then photos, then completion
      const order: Record<string, number> = { checkin: 0, photo: 1, completion: 2 };
      items.sort((a, b) => (order[a.type] ?? 1) - (order[b.type] ?? 1));

      let synced = 0;
      for (const item of items) {
        try {
          if (item.type === "checkin") await processCheckin(item);
          else if (item.type === "photo") await processPhoto(item);
          else if (item.type === "completion") await processCompletion(item);

          await dequeue(item.id!);
          synced++;
        } catch (err) {
          console.error(`Offline sync failed for item ${item.id}:`, err);
          // Stop on first failure to preserve order
          break;
        }
      }

      if (synced > 0) {
        toast.success(`${synced} ação(ões) sincronizada(s) com sucesso!`);
        onSyncComplete?.();
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      await refreshCount();
    }
  }, [onSyncComplete, refreshCount]);

  // Listen to online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      drainQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial count
    refreshCount();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [drainQueue, refreshCount]);

  return { isOnline, isSyncing, pendingCount, refreshCount, drainQueue };
}
