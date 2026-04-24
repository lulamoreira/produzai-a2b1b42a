/**
 * AppHeader (legacy)
 *
 * The default <AppHeader> component was removed (Wave 3) — it was no longer
 * imported anywhere. AppSidebar now owns the global chrome.
 *
 * Only the named exports below remain, since AppSidebar still depends on them:
 *  - useDisplayName: profile name + avatar for the sidebar user chip.
 *  - getGreeting:    time-of-day greeting helper.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { capitalizeName } from "@/lib/utils";

export const getGreeting = (t?: (key: string) => string) => {
  const h = new Date().getHours();
  if (t) {
    if (h < 12) return t("greeting.morning");
    if (h < 18) return t("greeting.afternoon");
    return t("greeting.evening");
  }
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

export function useDisplayName() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile_display", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, nickname, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const raw = (profile as any)?.nickname || profile?.display_name || user?.email?.split("@")[0] || "";
  const displayName = capitalizeName(raw);
  const avatarUrl: string | null = (profile as any)?.avatar_url || null;
  return { displayName, avatarUrl };
}

