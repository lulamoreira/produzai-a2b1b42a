import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook that auto-deletes orphan installation_photos records
 * when the storage file no longer exists (image/video fails to load).
 */
export function useOrphanPhotoCleanup() {
  const qc = useQueryClient();
  const deletingRef = useRef<Set<string>>(new Set());

  const handleMediaError = useCallback(
    async (photoId: string, campaignId: string) => {
      // Prevent duplicate deletions
      if (deletingRef.current.has(photoId)) return;
      deletingRef.current.add(photoId);

      try {
        await supabase.from("installation_photos").delete().eq("id", photoId);
        qc.invalidateQueries({ queryKey: ["installation_photos", campaignId] });
      } catch {
        // Silently fail — next load will retry
      }
    },
    [qc]
  );

  return { handleMediaError };
}
