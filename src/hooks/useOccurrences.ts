import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────
export type OccurrenceMotive = {
  id: string;
  description: string;
  active: boolean;
  display_order: number;
  created_at: string;
};

export type OccurrenceStatus = {
  id: string;
  label: string;
  value: string;
  color: string;
  is_default: boolean;
  order: number;
  active: boolean;
  created_at: string;
};

export type Occurrence = {
  id: string;
  campaign_id: string;
  store_id: string | null;
  piece_id: string;
  motive_id: string | null;
  description: string | null;
  photo_url: string | null;
  status: string | null;
  created_at: string | null;
  location_in_store: string | null;
  actions_taken: string | null;
  needs_reinstallation: boolean | null;
  reinstallation_os: string | null;
  reinstallation_datetime: string | null;
  agency_observation: string | null;
  expected_resolution_date: string | null;
  resolved_date: string | null;
  reporter_name: string | null;
  reporter_phone_ddd: string | null;
  reporter_phone_number: string | null;
  reporter_email: string | null;
  reporter_type: string;
};

export type OccurrenceComment = {
  id: string;
  occurrence_id: string;
  user_id: string | null;
  user_display_name: string;
  content: string;
  created_at: string;
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
        .order("display_order");
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

export function useReorderOccurrenceMotives() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; display_order: number }[]) => {
      for (const item of items) {
        const { error } = await supabase.from("occurrence_motives").update({ display_order: item.display_order }).eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occurrence_motives"] }),
  });
}

// ─── Occurrence Statuses ─────────────────────────────────
export function useOccurrenceStatuses() {
  return useQuery({
    queryKey: ["occurrence_statuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrence_statuses")
        .select("*")
        .order("order");
      if (error) throw error;
      return data as OccurrenceStatus[];
    },
  });
}

export function useAddOccurrenceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { label: string; value: string; color: string }) => {
      const { error } = await supabase.from("occurrence_statuses").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occurrence_statuses"] }),
  });
}

export function useUpdateOccurrenceStatus2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...update }: { id: string; label?: string; value?: string; color?: string; active?: boolean; order?: number }) => {
      const { error } = await supabase.from("occurrence_statuses").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occurrence_statuses"] }),
  });
}

export function useDeleteOccurrenceStatusItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("occurrence_statuses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occurrence_statuses"] }),
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
      store_id?: string;
      piece_id: string;
      motive_id: string;
      description?: string;
      photo_url?: string;
      reporter_name?: string;
      reporter_phone_ddd?: string;
      reporter_phone_number?: string;
      reporter_email?: string;
      reporter_type?: string;
    }): Promise<string | null> => {
      const { data: inserted, error } = await supabase.from("occurrences").insert(data).select("id").maybeSingle();
      if (error) {
        const { error: err2 } = await supabase.from("occurrences").insert(data);
        if (err2) throw err2;
      supabase.functions.invoke("notify-occurrence", { body: { record: data, event_type: "created" } }).catch(console.error);
      return null;
    }
    supabase.functions.invoke("notify-occurrence", { body: { record: { ...data, id: inserted?.id }, event_type: "created" } }).catch(console.error);
      return inserted?.id ?? null;
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
      // Fetch full record to send notification (fire and forget)
      supabase.from("occurrences").select("*").eq("id", id).maybeSingle().then(({ data: record }) => {
        if (record) {
          supabase.functions.invoke("notify-occurrence", { body: { record, event_type: "status_changed" } }).catch(console.error);
        }
      });
      return campaignId;
    },
    onMutate: async ({ id, status, campaignId }) => {
      await qc.cancelQueries({ queryKey: ["occurrences", campaignId] });
      const prev = qc.getQueryData<Occurrence[]>(["occurrences", campaignId]);
      qc.setQueryData<Occurrence[]>(["occurrences", campaignId], (old) =>
        old ? old.map((o) => o.id === id ? { ...o, status } : o) : old
      );
      return { prev, campaignId };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx) qc.setQueryData(["occurrences", ctx.campaignId], ctx.prev);
    },
    onSettled: (campaignId) => qc.invalidateQueries({ queryKey: ["occurrences", campaignId] }),
  });
}

export function useUpdateOccurrenceFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campaignId, ...fields }: { id: string; campaignId: string; [key: string]: unknown }) => {
      const { error } = await supabase.from("occurrences").update(fields).eq("id", id);
      if (error) throw error;
      // Fetch full record to send notification
      const { data: record } = await supabase.from("occurrences").select("*").eq("id", id).maybeSingle();
      if (record) {
        supabase.functions.invoke("notify-occurrence", { body: { record, event_type: "updated" } }).catch(console.error);
      }
      return campaignId;
    },
    onSuccess: (campaignId) => qc.invalidateQueries({ queryKey: ["occurrences", campaignId as string] }),
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

// ─── Occurrence Comments ─────────────────────────────────
export function useOccurrenceComments(occurrenceId?: string) {
  return useQuery({
    queryKey: ["occurrence_comments", occurrenceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrence_comments")
        .select("*")
        .eq("occurrence_id", occurrenceId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as OccurrenceComment[];
    },
    enabled: !!occurrenceId,
  });
}

export function useAddOccurrenceComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ occurrenceId, userId, displayName, content }: {
      occurrenceId: string;
      userId: string;
      displayName: string;
      content: string;
    }) => {
      const { error } = await supabase.from("occurrence_comments").insert({
        occurrence_id: occurrenceId,
        user_id: userId,
        user_display_name: displayName,
        content,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["occurrence_comments", vars.occurrenceId] }),
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
