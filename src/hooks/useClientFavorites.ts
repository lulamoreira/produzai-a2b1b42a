import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type ClientFavoriteWithDetails = {
  id: string;
  user_id: string;
  client_id: string;
  created_at: string;
  client_name: string;
  agency_id: string;
  agency_name: string;
};

/** IDs dos clientes favoritados pelo usuário atual. */
export function useClientFavoriteIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["client_favorite_ids", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("user_client_favorites")
        .select("client_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((d) => d.client_id));
    },
  });
}

/** Favoritos de cliente com nome do cliente e da agência. */
export function useClientFavorites() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["client_favorites", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ClientFavoriteWithDetails[]> => {
      const { data: favs, error } = await supabase
        .from("user_client_favorites")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!favs || favs.length === 0) return [];

      const { data: clients, error: cErr } = await supabase
        .from("clients")
        .select("id, name, agency_id, agencies(id, name)")
        .in("id", favs.map((f) => f.client_id));
      if (cErr) throw cErr;

      const map = new Map((clients ?? []).map((c) => [c.id, c]));

      return favs
        .map((fav) => {
          const client = map.get(fav.client_id);
          if (!client) return null;
          const agency = client.agencies as { id: string; name: string } | null;
          if (!agency) return null;
          return {
            ...fav,
            client_name: client.name,
            agency_id: agency.id,
            agency_name: agency.name,
          } as ClientFavoriteWithDetails;
        })
        .filter(Boolean) as ClientFavoriteWithDetails[];
    },
  });
}

export function useToggleClientFavorite() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId }: { clientId: string }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: existing, error: selErr } = await supabase
        .from("user_client_favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("client_id", clientId)
        .limit(1);
      if (selErr) throw selErr;

      if ((existing?.length ?? 0) > 0) {
        const { error } = await supabase
          .from("user_client_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("client_id", clientId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_client_favorites")
          .insert({ user_id: user.id, client_id: clientId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_favorites"] });
      qc.invalidateQueries({ queryKey: ["client_favorite_ids"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
