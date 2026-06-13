import { useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_PALETTE, isValidPalette, type ColorPaletteId } from "@/lib/colorPalettes";

const STORAGE_KEY = "preferred-color-theme";

function applyPalette(id: ColorPaletteId) {
  document.documentElement.setAttribute("data-v2-theme", id);
}

// Apply early from localStorage so first paint isn't a flash.
export function bootstrapColorTheme() {
  if (typeof window === "undefined") return;
  const cached = window.localStorage.getItem(STORAGE_KEY);
  applyPalette(isValidPalette(cached) ? cached : DEFAULT_PALETTE);
}

export function useColorTheme() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profileTheme } = useQuery({
    queryKey: ["user_preferred_theme", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("preferred_theme")
        .eq("user_id", user.id)
        .maybeSingle();
      return ((data as any)?.preferred_theme as string | null) ?? null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const cached =
    typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;

  const effective: ColorPaletteId = isValidPalette(profileTheme)
    ? profileTheme
    : isValidPalette(cached)
      ? cached
      : DEFAULT_PALETTE;

  useEffect(() => {
    applyPalette(effective);
    try { window.localStorage.setItem(STORAGE_KEY, effective); } catch {}
  }, [effective]);

  const { mutate } = useMutation({
    mutationFn: async (id: ColorPaletteId) => {
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ preferred_theme: id } as any)
        .eq("user_id", user.id);
    },
    onMutate: async (id) => {
      queryClient.setQueryData(["user_preferred_theme", user?.id], id);
      try { window.localStorage.setItem(STORAGE_KEY, id); } catch {}
      applyPalette(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_preferred_theme", user?.id] });
    },
  });

  const setColorTheme = useCallback((id: ColorPaletteId) => mutate(id), [mutate]);

  return { currentPalette: effective, setColorTheme };
}
