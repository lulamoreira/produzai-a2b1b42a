import { useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CampaignMessage {
  id: string;
  campaign_id: string;
  sender_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  sender_name?: string;
}

export interface MentionableUser {
  user_id: string;
  display_name: string;
}

/* ───── messages ───── */

export function useCampaignMessages(campaignId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const latestTimestampRef = useRef<string | null>(null);

  const { data: readEntry } = useQuery({
    queryKey: ["campaign_message_read", user?.id, campaignId],
    queryFn: async () => {
      if (!user || !campaignId) return null;
      const { data } = await supabase
        .from("campaign_message_reads")
        .select("last_read_at")
        .eq("user_id", user.id)
        .eq("campaign_id", campaignId)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!campaignId,
  });

  const isFirstVisit = readEntry === null;

  const messagesQuery = useQuery({
    queryKey: ["campaign_messages", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];

      // Fetch messages
      let query = supabase
        .from("campaign_messages")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });

      const { data: messages, error } = await query;
      if (error) throw error;

      let result = messages || [];

      // First visit: only show last 5 messages
      if (isFirstVisit && result.length > 5) {
        result = result.slice(-5);
      }

      // Enrich with sender names
      const senderIds = [...new Set(result.map((m) => m.sender_id))];
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, nickname")
          .in("user_id", senderIds);

        const nameMap = new Map<string, string>();
        profiles?.forEach((p) => {
          nameMap.set(p.user_id, p.nickname || p.display_name || "Usuário");
        });

        return result.map((m) => ({
          ...m,
          sender_name: nameMap.get(m.sender_id) || "Usuário",
        })) as CampaignMessage[];
      }

      return result.map((m) => ({ ...m, sender_name: "Usuário" })) as CampaignMessage[];
    },
    enabled: !!campaignId,
  });

  // Track latest timestamp for unread calculation
  useEffect(() => {
    const msgs = messagesQuery.data;
    if (msgs && msgs.length > 0) {
      latestTimestampRef.current = msgs[msgs.length - 1].created_at;
    }
  }, [messagesQuery.data]);

  // Realtime subscription
  useEffect(() => {
    if (!campaignId) return;

    const channel = supabase
      .channel(`campaign-chat-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "campaign_messages",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["campaign_messages", campaignId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "campaign_messages",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["campaign_messages", campaignId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, queryClient]);

  return messagesQuery;
}

/* ───── send message ───── */

export function useSendCampaignMessage(campaignId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, imageUrl }: { content: string; imageUrl?: string }) => {
      if (!user || !campaignId) throw new Error("Missing user or campaign");
      const { error } = await supabase.from("campaign_messages").insert({
        campaign_id: campaignId,
        sender_id: user.id,
        content,
        image_url: imageUrl || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign_messages", campaignId] });
    },
  });
}

/* ───── delete message ───── */

export function useDeleteCampaignMessage(campaignId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase.from("campaign_messages").delete().eq("id", messageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign_messages", campaignId] });
    },
  });
}

/* ───── mark as read ───── */

export function useMarkCampaignRead(campaignId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    if (!user || !campaignId) return;
    const now = new Date().toISOString();
    await supabase.from("campaign_message_reads").upsert(
      { user_id: user.id, campaign_id: campaignId, last_read_at: now },
      { onConflict: "user_id,campaign_id" }
    );
    queryClient.invalidateQueries({ queryKey: ["campaign_message_read", user.id, campaignId] });
    queryClient.invalidateQueries({ queryKey: ["campaign_unread", user.id] });
  }, [user, campaignId, queryClient]);
}

/* ───── unread count for a single campaign ───── */

export function useCampaignUnreadCount(campaignId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["campaign_unread", user?.id, campaignId],
    queryFn: async () => {
      if (!user || !campaignId) return 0;

      // Get last read timestamp
      const { data: readEntry } = await supabase
        .from("campaign_message_reads")
        .select("last_read_at")
        .eq("user_id", user.id)
        .eq("campaign_id", campaignId)
        .maybeSingle();

      let query = supabase
        .from("campaign_messages")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .neq("sender_id", user.id);

      if (readEntry?.last_read_at) {
        query = query.gt("created_at", readEntry.last_read_at);
      }

      const { count } = await query;
      return count || 0;
    },
    enabled: !!user && !!campaignId,
    refetchInterval: 30000,
  });
}

/* ───── mentionable users ───── */

export function useMentionableUsers(campaignId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["campaign_mentionable", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];

      // Get client_id for the campaign
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("client_id, clients(agency_id)")
        .eq("id", campaignId)
        .single();

      if (!campaign) return [];

      const userIds = new Set<string>();

      // Campaign-level access
      const { data: campaignAccess } = await supabase
        .from("user_campaign_access")
        .select("user_id")
        .eq("campaign_id", campaignId)
        .eq("suspended", false);
      campaignAccess?.forEach((a) => userIds.add(a.user_id));

      // Client-level access
      const { data: clientAccess } = await supabase
        .from("user_client_access")
        .select("user_id")
        .eq("client_id", campaign.client_id)
        .eq("suspended", false);
      clientAccess?.forEach((a) => userIds.add(a.user_id));

      // Agency-level access
      const agencyId = (campaign.clients as any)?.agency_id;
      if (agencyId) {
        const { data: agencyAccess } = await supabase
          .from("user_agency_access")
          .select("user_id")
          .eq("agency_id", agencyId)
          .eq("suspended", false);
        agencyAccess?.forEach((a) => userIds.add(a.user_id));
      }

      // Admin/master users
      const { data: adminUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "master"]);
      adminUsers?.forEach((a) => userIds.add(a.user_id));

      if (userIds.size === 0) return [];

      const ids = [...userIds];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, nickname")
        .in("user_id", ids);

      return (profiles || [])
        .filter((p) => p.user_id !== user?.id)
        .map((p) => ({
          user_id: p.user_id,
          display_name: p.nickname || p.display_name || "Usuário",
        })) as MentionableUser[];
    },
    enabled: !!campaignId,
    staleTime: 60000,
  });
}
