import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook that deletes installation_photos records ONLY when the underlying
 * storage object truly no longer exists (HTTP 404 on a HEAD request to the
 * original, untransformed URL).
 *
 * Why this is strict: an <img>/<video> onError can fire for many reasons that
 * are NOT "file is missing":
 *   - Supabase image transformation rate-limit / 5xx
 *   - HEIC / unsupported format on the transformation endpoint
 *   - CDN cold cache, momentary network blip, mobile flaky connection
 *   - Browser cancelling load on scroll/unmount
 *
 * Previously this hook deleted the DB row on the FIRST onError, which silently
 * destroyed valid uploads. Now we verify the storage object is actually gone
 * before touching the database.
 */
export function useOrphanPhotoCleanup() {
  const qc = useQueryClient();
  const inFlightRef = useRef<Set<string>>(new Set());
  const checkedRef = useRef<Map<string, number>>(new Map()); // photoId -> timestamp

  const handleMediaError = useCallback(
    async (photoId: string, campaignId: string, photoUrl?: string) => {
      // Debounce: don't re-check the same photo within 5 minutes
      const lastChecked = checkedRef.current.get(photoId);
      if (lastChecked && Date.now() - lastChecked < 5 * 60 * 1000) return;
      if (inFlightRef.current.has(photoId)) return;
      inFlightRef.current.add(photoId);

      try {
        // If we don't have a URL we can't verify — bail out safely.
        if (!photoUrl) return;

        // Strip any query string (transformations) — verify the ORIGINAL object.
        const originalUrl = photoUrl.split("?")[0];

        let isMissing = false;
        try {
          const res = await fetch(originalUrl, { method: "HEAD", cache: "no-store" });
          // Only treat a clear 404 as "missing". Anything else (200, 403, 5xx,
          // network error) is NOT proof the file is gone.
          isMissing = res.status === 404;
        } catch {
          // Network error: do nothing. The next load will retry.
          return;
        }

        checkedRef.current.set(photoId, Date.now());

        if (!isMissing) return;

        await supabase.from("installation_photos").delete().eq("id", photoId);
        qc.invalidateQueries({ queryKey: ["installation_photos", campaignId] });
      } finally {
        inFlightRef.current.delete(photoId);
      }
    },
    [qc]
  );

  return { handleMediaError };
}
