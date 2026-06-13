import { useEffect, useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DEFAULT_PALETTE,
  AUTO_LIGHT_PALETTE,
  AUTO_DARK_PALETTE,
  getPaletteById,
  isValidPalette,
  isValidPreference,
  type ColorPaletteId,
  type ColorThemePreference,
} from "@/lib/colorPalettes";

const STORAGE_KEY = "preferred-color-theme";
const LAST_MANUAL_KEY = "preferred-color-theme-last-manual";
const NEXT_THEME_STORAGE_KEY = "produzai-theme";

function getLastManualLight(): ColorPaletteId {
  if (typeof window === "undefined") return AUTO_LIGHT_PALETTE;
  const stored = window.localStorage.getItem(LAST_MANUAL_KEY);
  if (isValidPalette(stored)) {
    const p = getPaletteById(stored);
    if (!p.isDark) return stored;
  }
  return AUTO_LIGHT_PALETTE;
}

type SystemThemeHint = "light" | "dark" | null | undefined;

function isEmbeddedPreview() {
  try { return typeof window !== "undefined" && window.self !== window.top; }
  catch { return false; }
}

function resolveAuto(hint?: SystemThemeHint): ColorPaletteId {
  if (typeof window === "undefined") return AUTO_LIGHT_PALETTE;

  // Fonte de verdade = SO. Ignoramos `produzai-theme` e a classe `.dark`
  // porque esses refletem a paleta atual aplicada, não a preferência do SO.
  if (hint === "dark") return AUTO_DARK_PALETTE;
  if (hint === "light") return getLastManualLight();

  const darkMql = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (darkMql?.matches) return AUTO_DARK_PALETTE;

  const lightMql = window.matchMedia?.("(prefers-color-scheme: light)");
  if (lightMql?.matches) return getLastManualLight();

  return getLastManualLight();
}

function applyPalette(id: ColorPaletteId) {
  const root = document.documentElement;
  const isDark = getPaletteById(id).isDark;
  root.setAttribute("data-v2-theme", id);
  root.setAttribute("data-v2-mode", isDark ? "dark" : "light");
  if (isDark) root.classList.add("dark");
  else root.classList.remove("dark");
}

// Apply early from localStorage so first paint isn't a flash.
export function bootstrapColorTheme() {
  if (typeof window === "undefined") return;
  const cached = window.localStorage.getItem(STORAGE_KEY);
  let palette: ColorPaletteId;
  if (cached === "auto") {
    palette = resolveAuto();
  } else if (isValidPalette(cached)) {
    palette = cached;
  } else {
    palette = DEFAULT_PALETTE;
  }
  applyPalette(palette);
}

export function useColorTheme() {
  const { user } = useAuth();
  const { theme, resolvedTheme, systemTheme } = useTheme();
  const queryClient = useQueryClient();
  const [systemPalette, setSystemPalette] = useState<ColorPaletteId>(() => resolveAuto());

  const { data: profilePreference } = useQuery({
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

  const preference: ColorThemePreference = isValidPreference(profilePreference)
    ? profilePreference
    : isValidPreference(cached)
      ? cached
      : DEFAULT_PALETTE;

  const effective: ColorPaletteId =
    preference === "auto" ? systemPalette : preference;

  // Listen to OS color-scheme changes when in auto mode
  useEffect(() => {
    if (typeof window === "undefined" || preference !== "auto") return;
    // Apenas systemTheme reflete o SO. `theme`/`resolvedTheme` refletem o app.
    const themeHint: SystemThemeHint =
      systemTheme === "dark" ? "dark" : systemTheme === "light" ? "light" : null;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setSystemPalette(resolveAuto(themeHint));
    handler();
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [preference, systemTheme]);

  useEffect(() => {
    applyPalette(effective);
    try { window.localStorage.setItem(STORAGE_KEY, preference); } catch {}
  }, [effective, preference]);

  const { mutate } = useMutation({
    mutationFn: async (id: ColorThemePreference) => {
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ preferred_theme: id } as any)
        .eq("user_id", user.id);
    },
    onMutate: async (id) => {
      queryClient.setQueryData(["user_preferred_theme", user?.id], id);
      try {
        window.localStorage.setItem(STORAGE_KEY, id);
        if (id !== "auto" && isValidPalette(id) && !getPaletteById(id).isDark) {
          window.localStorage.setItem(LAST_MANUAL_KEY, id);
        }
      } catch {}
      const palette = id === "auto" ? resolveAuto() : id;
      applyPalette(palette);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_preferred_theme", user?.id] });
    },
  });

  const setColorTheme = useCallback(
    (id: ColorThemePreference) => mutate(id),
    [mutate]
  );

  return {
    currentPalette: effective,
    currentPreference: preference,
    isAuto: preference === "auto",
    setColorTheme,
  };
}
