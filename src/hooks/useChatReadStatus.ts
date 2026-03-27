import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ReadStatus {
  context_type: string;
  context_id: string;
  last_read_at: string;
}

export function useChatReadStatuses(contextType: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["chat-read-status", contextType, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_read_status")
        .select("context_id, last_read_at")
        .eq("user_id", user!.id)
        .eq("context_type", contextType);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.context_id] = r.last_read_at; });
      return map;
    },
  });
}

export function useMarkAsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contextType, contextId }: { contextType: string; contextId: string }) => {
      if (!user) return;
      const { error } = await supabase
        .from("chat_read_status")
        .upsert(
          { user_id: user.id, context_type: contextType, context_id: contextId, last_read_at: new Date().toISOString() },
          { onConflict: "user_id,context_type,context_id" }
        );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["chat-read-status", vars.contextType] });
    },
  });
}

export function useScheduleChatUnreadCounts(campaignId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["schedule-chat-unread", campaignId, user?.id],
    enabled: !!user && !!campaignId,
    refetchInterval: 30000,
    queryFn: async () => {
      // Get all messages for this campaign
      const { data: messages, error: msgErr } = await supabase
        .from("schedule_chat_messages")
        .select("store_id, created_at")
        .eq("campaign_id", campaignId);
      if (msgErr) throw msgErr;

      // Get read statuses for schedule_chat
      const { data: readData, error: readErr } = await supabase
        .from("chat_read_status")
        .select("context_id, last_read_at")
        .eq("user_id", user!.id)
        .eq("context_type", "schedule_chat");
      if (readErr) throw readErr;

      const readMap: Record<string, string> = {};
      (readData || []).forEach((r: any) => { readMap[r.context_id] = r.last_read_at; });

      // Count unread per store
      const counts: Record<string, number> = {};
      let total = 0;
      (messages || []).forEach((msg: any) => {
        const contextId = `${campaignId}:${msg.store_id}`;
        const lastRead = readMap[contextId];
        if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
          counts[msg.store_id] = (counts[msg.store_id] || 0) + 1;
          total++;
        }
      });

      // Also count total messages per store
      const totalPerStore: Record<string, number> = {};
      (messages || []).forEach((msg: any) => {
        totalPerStore[msg.store_id] = (totalPerStore[msg.store_id] || 0) + 1;
      });

      return { unreadPerStore: counts, totalPerStore, totalUnread: total };
    },
  });
}

export function useConversationUnreadCounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["conversation-unread", user?.id],
    enabled: !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      // Get all conversations for this user
      const { data: convs, error: convErr } = await supabase
        .from("chat_conversations")
        .select("id")
        .or(`user_1.eq.${user!.id},user_2.eq.${user!.id}`);
      if (convErr) throw convErr;

      if (!convs || convs.length === 0) return { unreadPerConv: {}, totalUnread: 0 };

      const convIds = convs.map((c: any) => c.id);

      // Get all messages in these conversations
      const { data: messages, error: msgErr } = await supabase
        .from("chat_messages")
        .select("conversation_id, created_at, sender_id")
        .in("conversation_id", convIds);
      if (msgErr) throw msgErr;

      // Get read statuses
      const { data: readData, error: readErr } = await supabase
        .from("chat_read_status")
        .select("context_id, last_read_at")
        .eq("user_id", user!.id)
        .eq("context_type", "conversation");
      if (readErr) throw readErr;

      const readMap: Record<string, string> = {};
      (readData || []).forEach((r: any) => { readMap[r.context_id] = r.last_read_at; });

      const counts: Record<string, number> = {};
      let total = 0;
      (messages || []).forEach((msg: any) => {
        if (msg.sender_id === user!.id) return; // own messages don't count
        const lastRead = readMap[msg.conversation_id];
        if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
          counts[msg.conversation_id] = (counts[msg.conversation_id] || 0) + 1;
          total++;
        }
      });

      return { unreadPerConv: counts, totalUnread: total };
    },
  });
}
