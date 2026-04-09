import { useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { SupportedLanguage } from "@/i18n";

/**
 * Central hook for language management.
 * - Loads user's preferred_language from profile
 * - Optionally accepts a client language to use as default
 * - Persists language changes to profile
 * - Syncs i18next language
 */
export function useLanguage(clientLanguage?: string | null) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's preferred language from profile
  const { data: userLang } = useQuery({
    queryKey: ["user_preferred_language", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("preferred_language")
        .eq("user_id", user.id)
        .maybeSingle();
      return (data as any)?.preferred_language as string | null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Determine effective language: user preference > client config > pt-BR
  const effectiveLang = userLang || clientLanguage || "pt-BR";

  // Sync i18next whenever effective language changes
  useEffect(() => {
    if (effectiveLang && i18n.language !== effectiveLang) {
      i18n.changeLanguage(effectiveLang);
    }
  }, [effectiveLang, i18n]);

  // Mutation to persist language choice
  const { mutate: setLanguage } = useMutation({
    mutationFn: async (lang: SupportedLanguage) => {
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ preferred_language: lang } as any)
        .eq("user_id", user.id);
    },
    onMutate: async (lang) => {
      // Optimistic update
      queryClient.setQueryData(["user_preferred_language", user?.id], lang);
      i18n.changeLanguage(lang);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_preferred_language", user?.id] });
    },
  });

  const changeLanguage = useCallback(
    (lang: SupportedLanguage) => {
      setLanguage(lang);
    },
    [setLanguage]
  );

  return {
    currentLanguage: i18n.language as SupportedLanguage,
    changeLanguage,
    effectiveLang,
  };
}
