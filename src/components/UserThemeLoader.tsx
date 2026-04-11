import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { applyUserTheme } from "@/lib/applyUserTheme";

/**
 * Loads the user's theme_hue from profile on mount and applies it.
 * Renders nothing — purely a side-effect component.
 */
export default function UserThemeLoader() {
  const { user } = useAuth();

  const { data: hue } = useQuery({
    queryKey: ["profile_theme_hue", user?.id],
    queryFn: async () => {
      if (!user) return 231;
      const { data } = await supabase
        .from("profiles")
        .select("theme_hue")
        .eq("user_id", user.id)
        .maybeSingle();
      return (data as any)?.theme_hue ?? 231;
    },
    enabled: !!user,
    staleTime: 120_000,
  });

  useEffect(() => {
    if (hue != null) {
      applyUserTheme(hue);
    }
  }, [hue]);

  return null;
}
