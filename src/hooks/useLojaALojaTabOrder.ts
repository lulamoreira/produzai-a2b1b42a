import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const DEFAULT_LOJA_A_LOJA_TABS = [
  "dashboard",
  "portal-dashboard",
  "por-loja",
  "tipos",
  "lojas",
  "portais",
  "config",
] as const;

export type LojaALojaTabId = (typeof DEFAULT_LOJA_A_LOJA_TABS)[number];

const VALID = new Set<string>(DEFAULT_LOJA_A_LOJA_TABS);

function normalize(order: string[] | null | undefined): string[] {
  const filtered = (order ?? []).filter((t) => VALID.has(t));
  const missing = DEFAULT_LOJA_A_LOJA_TABS.filter((t) => !filtered.includes(t));
  return [...filtered, ...missing];
}

export function useLojaALojaTabOrder() {
  const { user } = useAuth();
  const [order, setOrder] = useState<string[]>([...DEFAULT_LOJA_A_LOJA_TABS]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setOrder([...DEFAULT_LOJA_A_LOJA_TABS]);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("loja_a_loja_tab_order")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const stored = (data as any)?.loja_a_loja_tab_order as string[] | null;
      setOrder(normalize(stored));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const saveOrder = useCallback(
    async (next: string[]) => {
      const normalized = normalize(next);
      setOrder(normalized);
      if (!user?.id) return;
      await supabase
        .from("profiles")
        .update({ loja_a_loja_tab_order: normalized } as any)
        .eq("user_id", user.id);
    },
    [user?.id]
  );

  return { order, saveOrder, loaded };
}
