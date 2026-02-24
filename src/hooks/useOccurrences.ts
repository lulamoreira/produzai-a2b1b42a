import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────
export type OccurrenceMotive = {
  id: string;
  description: string;
  active: boolean;
  created_at: string;
};

export type Occurrence = {
  id: string;
  campaign_id: string;
  store_id: string;
  piece_id: string;
  motive_id: string | null;
  description: string | null;
  photo_url: string | null;
  status: string | null;
  created_at: string | null;
};

export type CampaignEmail = {
  id: string;
  campaign_id: string;
  email: string;
  created_at: string | null;
};

// ─── Motives ─────────────────────────────────────────────
export function useOccurrenceMotives() {
  return useQuery({
    queryKey: ["occurrence_motives"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrence_motives")
        .select("*")
        .order("description");
      if (error) throw error;
      return data as OccurrenceMotive[];
    },
  });
}

export function useAddOccurrenceMotive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (description: string) => {
      const { error } = await supabase.from("occurrence_motives").insert({ description });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occurrence_motives"] }),
  });
}

export function useUpdateOccurrenceMotive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, description, active }: { id: string; description?: string; active?: boolean }) => {
      const update: Record<string, unknown> = {};
      if (description !== undefined) update.description = description;
      if (active !== undefined) update.active = active;
      const { error } = await supabase.from("occurrence_motives").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occurrence_motives"] }),
  });
}

export function useDeleteOccurrenceMotive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("occurrence_motives").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occurrence_motives"] }),
  });
}

// ─── Occurrences ─────────────────────────────────────────
export function useOccurrences(campaignId?: string) {
  return useQuery({
    queryKey: ["occurrences", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrences")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Occurrence[];
    },
    enabled: !!campaignId,
  });
}

export function useAddOccurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      campaign_id: string;
      store_id: string;
      piece_id: string;
      motive_id: string;
      description?: string;
      photo_url?: string;
    }) => {
      const { data: inserted, error } = await supabase.from("occurrences").insert(data).select().single();
      if (error) throw error;
      // Fire-and-forget notification
      supabase.functions.invoke("notify-occurrence", { body: { record: inserted } }).catch(console.error);
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["occurrences", vars.campaign_id] }),
  });
}

export function useUpdateOccurrenceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, campaignId }: { id: string; status: string; campaignId: string }) => {
      const { error } = await supabase.from("occurrences").update({ status }).eq("id", id);
      if (error) throw error;
      return campaignId;
    },
    onSuccess: (campaignId) => qc.invalidateQueries({ queryKey: ["occurrences", campaignId] }),
  });
}

export function useDeleteOccurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campaignId }: { id: string; campaignId: string }) => {
      const { error } = await supabase.from("occurrences").delete().eq("id", id);
      if (error) throw error;
      return campaignId;
    },
    onSuccess: (campaignId) => qc.invalidateQueries({ queryKey: ["occurrences", campaignId] }),
  });
}

// ─── Campaign Notification Emails ────────────────────────
export function useCampaignEmails(campaignId?: string) {
  return useQuery({
    queryKey: ["campaign_emails", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_notification_emails")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("created_at");
      if (error) throw error;
      return data as CampaignEmail[];
    },
    enabled: !!campaignId,
  });
}

export function useAddCampaignEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, email }: { campaignId: string; email: string }) => {
      const { data: existing } = await supabase
        .from("campaign_notification_emails")
        .select("id")
        .eq("campaign_id", campaignId);
      if (existing && existing.length >= 5) throw new Error("Máximo de 5 emails por campanha.");
      const { error } = await supabase.from("campaign_notification_emails").insert({ campaign_id: campaignId, email });
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["campaign_emails", vars.campaignId] }),
  });
}

export function useDeleteCampaignEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campaignId }: { id: string; campaignId: string }) => {
      const { error } = await supabase.from("campaign_notification_emails").delete().eq("id", id);
      if (error) throw error;
      return campaignId;
    },
    onSuccess: (campaignId) => qc.invalidateQueries({ queryKey: ["campaign_emails", campaignId] }),
  });
}
