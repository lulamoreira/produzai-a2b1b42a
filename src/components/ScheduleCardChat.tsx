import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMarkAsRead } from "@/hooks/useChatReadStatus";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Send, Trash2, Pencil, Check, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ScheduleCardChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  storeId: string;
  storeName: string;
}

interface ScheduleChatMessage {
  id: string;
  campaign_id: string;
  store_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

const ScheduleCardChat = ({ open, onOpenChange, campaignId, storeId, storeName }: ScheduleCardChatProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messageInput, setMessageInput] = useState("");
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryKey = ["schedule-chat", campaignId, storeId];

  // Realtime subscription
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel(`schedule-chat-${campaignId}-${storeId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "schedule_chat_messages",
        filter: `campaign_id=eq.${campaignId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, campaignId, storeId, queryClient]);

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey,
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_chat_messages")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("store_id", storeId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ScheduleChatMessage[];
    },
  });

  // Fetch sender profiles
  const senderIds = [...new Set(messages.map(m => m.sender_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["schedule-chat-profiles", ...senderIds],
    enabled: senderIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", senderIds);
      return data || [];
    },
  });

  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p.display_name || "Usuário"]));

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("schedule_chat_messages").insert({
        campaign_id: campaignId,
        store_id: storeId,
        sender_id: user.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_chat_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setDeleteMessageId(null); },
  });

  // Edit
  const editMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase.from("schedule_chat_messages").update({ content }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setEditingMessage(null); },
  });

  const handleSend = () => {
    const text = messageInput.trim();
    if (!text) return;
    sendMutation.mutate(text);
    setMessageInput("");
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
            <SheetTitle className="text-sm truncate">Chat — {storeName}</SheetTitle>
          </SheetHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading && <p className="text-xs text-muted-foreground text-center">Carregando...</p>}
            {!isLoading && messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">Nenhuma mensagem ainda.</p>
            )}
            {messages.map((msg) => {
              const isOwn = msg.sender_id === user?.id;
              const senderName = profileMap[msg.sender_id] || "Usuário";
              const isEditing = editingMessage?.id === msg.id;

              return (
                <div key={msg.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-muted-foreground mb-0.5 px-1">{senderName}</span>
                  <div className={`group relative max-w-[85%] rounded-lg px-3 py-2 text-sm ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingMessage.content}
                          onChange={(e) => setEditingMessage({ ...editingMessage, content: e.target.value })}
                          className="h-6 text-xs bg-background text-foreground"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") editMutation.mutate({ id: editingMessage.id, content: editingMessage.content });
                            if (e.key === "Escape") setEditingMessage(null);
                          }}
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => editMutation.mutate({ id: editingMessage.id, content: editingMessage.content })}>
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditingMessage(null)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                        {isOwn && (
                          <div className="hidden group-hover:flex absolute -top-2 right-0 gap-0.5">
                            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditingMessage({ id: msg.id, content: msg.content })}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setDeleteMessageId(msg.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                    {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 flex gap-2 shrink-0">
            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Digite uma mensagem..."
              className="text-sm"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <Button size="icon" onClick={handleSend} disabled={!messageInput.trim() || sendMutation.isPending}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteMessageId} onOpenChange={() => setDeleteMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMessageId && deleteMutation.mutate(deleteMessageId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ScheduleCardChat;
