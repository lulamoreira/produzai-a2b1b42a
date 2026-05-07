import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const DEFAULT_CARD_ORDER = ["portal_ocorrencias", "globais", "por_loja", "motivos", "tratativa_statuses"] as const;
export const DEFAULT_COLLAPSED = ["por_loja"];

export type CardKey = (typeof DEFAULT_CARD_ORDER)[number];

export interface PortalConfigLayout {
  card_order: string[];
  collapsed_cards: string[];
  updated_at: string;
}

export function usePortalConfigLayout() {
  return useQuery({
    queryKey: ["portal-config-layout"],
    queryFn: async (): Promise<PortalConfigLayout> => {
      const { data, error } = await supabase
        .from("portal_config_layout")
        .select("card_order, collapsed_cards, updated_at")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return {
          card_order: [...DEFAULT_CARD_ORDER],
          collapsed_cards: [...DEFAULT_COLLAPSED],
          updated_at: new Date().toISOString(),
        };
      }
      // Ensure all default keys exist (for forward-compatibility)
      const order = [...data.card_order];
      DEFAULT_CARD_ORDER.forEach((k) => {
        if (!order.includes(k)) order.push(k);
      });
      return { ...data, card_order: order };
    },
    staleTime: 30_000,
  });
}

export function useUpdatePortalConfigLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<PortalConfigLayout, "card_order" | "collapsed_cards">>) => {
      const { error } = await supabase
        .from("portal_config_layout")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-config-layout"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao salvar layout");
    },
  });
}
