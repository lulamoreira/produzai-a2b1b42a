import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type AgencyFavoriteWithDetails = {
  id: string;
  user_id: string;
  agency_id: string;
  created_at: string;
  agency_name: string;
};

/** IDs das agências favoritadas pelo usuário atual. */
export function useAgencyFavoriteIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["agency_favorite_ids", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("user_agency_favorites")
        .select("agency_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((d) => d.agency_id));
    },
  });
}

/** Favoritos de agência com o nome da agência. */
export function useAgencyFavorites() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["agency_favorites", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AgencyFavoriteWithDetails[]> => {
      const { data: favs, error } = await supabase
        .from("user_agency_favorites")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!favs || favs.length === 0) return [];

      const { data: agencies, error: aErr } = await supabase
        .from("agencies")
        .select("id, name")
        .in("id", favs.map((f) => f.agency_id));
      if (aErr) throw aErr;

      const map = new Map((agencies ?? []).map((a) => [a.id, a]));

      return favs
        .map((fav) => {
          const agency = map.get(fav.agency_id);
          if (!agency) return null;
          return { ...fav, agency_name: agency.name } as AgencyFavoriteWithDetails;
        })
        .filter(Boolean) as AgencyFavoriteWithDetails[];
    },
  });
}

export function useToggleAgencyFavorite() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ agencyId }: { agencyId: string }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: existing, error: selErr } = await supabase
        .from("user_agency_favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("agency_id", agencyId)
        .limit(1);
      if (selErr) throw selErr;

      if ((existing?.length ?? 0) > 0) {
        const { error } = await supabase
          .from("user_agency_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("agency_id", agencyId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_agency_favorites")
          .insert({ user_id: user.id, agency_id: agencyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agency_favorites"] });
      qc.invalidateQueries({ queryKey: ["agency_favorite_ids"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
