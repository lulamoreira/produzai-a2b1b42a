import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export function useProcessInvite() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(() => {
    return !!localStorage.getItem("invite_token");
  });

  useEffect(() => {
    const token = localStorage.getItem("invite_token");
    if (!token || !user) {
      if (!token) setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    supabase.functions
      .invoke("process-invite", { body: { token } })
      .then(({ error }) => {
        localStorage.removeItem("invite_token");
        if (!error) {
          // Clear cached queries so approval status is re-fetched
          queryClient.removeQueries({ queryKey: ["approval_status"] });
          queryClient.invalidateQueries({ queryKey: ["user_role"] });
          queryClient.invalidateQueries({ queryKey: ["user_permission_categories"] });
        }
      })
      .finally(() => setIsProcessing(false));
  }, [user, queryClient]);

  return { isProcessing };
}
