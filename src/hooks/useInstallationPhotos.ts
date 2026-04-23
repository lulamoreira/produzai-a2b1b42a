import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type InstallationPhoto = {
  id: string;
  campaign_id: string;
  store_id: string;
  photo_url: string;
  category: string;
  caption: string | null;
  created_at: string;
  uploaded_by: string | null;
  upload_method: string;
  media_type: string;
};

export function isVideo(photo: InstallationPhoto) {
  return photo.media_type === "video";
}

export function useInstallationPhotos(campaignId: string | undefined) {
  const qc = useQueryClient();

  // Realtime: invalidate cache on any change to installation_photos for this campaign
  useEffect(() => {
    if (!campaignId) return;
    const channel = supabase
      .channel(`installation_photos:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "installation_photos",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["installation_photos", campaignId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, qc]);

  return useQuery({
    queryKey: ["installation_photos", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from("installation_photos")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as InstallationPhoto[];
    },
    enabled: !!campaignId,
  });
}

export function useAddInstallationPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photo: {
      campaign_id: string;
      store_id: string;
      photo_url: string;
      category: string;
      caption?: string;
      uploaded_by?: string;
      upload_method?: string;
      media_type?: string;
    }) => {
      const { data, error } = await supabase
        .from("installation_photos")
        .insert(photo)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["installation_photos", vars.campaign_id] });
    },
  });
}

export function useUpdateInstallationPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, caption, category }: { id: string; caption?: string; category?: string }) => {
      const updates: Record<string, any> = {};
      if (caption !== undefined) updates.caption = caption;
      if (category !== undefined) updates.category = category;
      const { error } = await supabase.from("installation_photos").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installation_photos"] });
    },
  });
}

export function useDeleteInstallationPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, photo_url }: { id: string; photo_url: string }) => {
      // Delete from storage
      const url = new URL(photo_url);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/installation-photos\/(.+)/);
      if (pathMatch) {
        await supabase.storage.from("installation-photos").remove([pathMatch[1]]);
      }
      // Delete from DB
      const { error } = await supabase.from("installation_photos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installation_photos"] });
    },
  });
}
