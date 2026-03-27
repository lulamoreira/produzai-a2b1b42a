import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

export interface ChatConversation {
  id: string;
  user_1: string;
  user_2: string;
  subject: string;
  created_by: string | null;
  created_at: string;
  other_user?: { display_name: string | null; nickname: string | null; user_id: string };
  last_message?: { content: string; created_at: string };
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

export function useConversations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["chat-conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const otherUserIds = (data || []).map((c: any) =>
        c.user_1 === user!.id ? c.user_2 : c.user_1
      );

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, nickname")
        .in("user_id", otherUserIds);

      const convIds = (data || []).map((c: any) => c.id);
      const lastMessages: Record<string, { content: string; created_at: string }> = {};

      if (convIds.length > 0) {
        for (const convId of convIds) {
          const { data: msgs } = await supabase
            .from("chat_messages")
            .select("content, created_at")
            .eq("conversation_id", convId)
            .order("created_at", { ascending: false })
            .limit(1);
          if (msgs && msgs.length > 0) {
            lastMessages[convId] = msgs[0];
          }
        }
      }

      return (data || []).map((c: any) => {
        const otherUserId = c.user_1 === user!.id ? c.user_2 : c.user_1;
        const profile = (profiles || []).find((p: any) => p.user_id === otherUserId);
        return {
          ...c,
          other_user: profile || { display_name: null, nickname: null, user_id: otherUserId },
          last_message: lastMessages[c.id],
        } as ChatConversation;
      });
    },
  });
}

export function useMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
          queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return useQuery({
    queryKey: ["chat-messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Fetch sender profiles
      const senderIds = [...new Set((data || []).map((m: any) => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, nickname")
        .in("user_id", senderIds);

      const profileMap: Record<string, { display_name: string | null; nickname: string | null }> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });

      return (data || []).map((m: any) => {
        const profile = profileMap[m.sender_id];
        const senderName = profile?.nickname || profile?.display_name || "Usuário";
        return { ...m, sender_name: senderName } as ChatMessage;
      });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", vars.conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation-unread"] });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from("chat_messages")
        .delete()
        .eq("id", messageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}

export function useEditMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const { error } = await supabase
        .from("chat_messages")
        .update({ content })
        .eq("id", messageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}

export function useStartConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ otherUserId, subject }: { otherUserId: string; subject?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if conversation already exists with same users
      const { data: existing } = await supabase
        .from("chat_conversations")
        .select("*")
        .or(
          `and(user_1.eq.${user.id},user_2.eq.${otherUserId}),and(user_1.eq.${otherUserId},user_2.eq.${user.id})`
        );

      // Only reuse if no subject specified and existing has default subject
      if (existing && existing.length > 0 && !subject) {
        return existing[0].id as string;
      }

      const { data, error } = await supabase
        .from("chat_conversations")
        .insert({
          user_1: user.id,
          user_2: otherUserId,
          subject: subject || "Geral",
          created_by: user.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      // Delete messages first
      await supabase
        .from("chat_messages")
        .delete()
        .eq("conversation_id", conversationId);
      // Then delete conversation
      const { error } = await supabase
        .from("chat_conversations")
        .delete()
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    },
  });
}
