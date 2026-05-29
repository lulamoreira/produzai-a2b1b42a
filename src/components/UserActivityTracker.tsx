import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function UserActivityTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const updateActivity = async () => {
      // Don't update if we are impersonating or previewing
      if (sessionStorage.getItem("preview_user_id")) return;

      await supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("user_id", user.id);
    };

    // Initial update
    updateActivity();

    // Update every 2 minutes
    const interval = setInterval(updateActivity, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  return null;
}
