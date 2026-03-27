import { useState, useRef, useEffect } from "react";
import { capitalizeName } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  useConversations,
  useMessages,
  useSendMessage,
  useDeleteMessage,
  useEditMessage,
  useStartConversation,
  type ChatConversation,
} from "@/hooks/useChat";
import { useMarkAsRead, useConversationUnreadCounts } from "@/hooks/useChatReadStatus";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/AppLayout";
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
import {
  ArrowLeft,
  MessageSquare,
  Send,
  Trash2,
  Pencil,
  Check,
  X,
  Plus,
  UserCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: loadingConvs } = useConversations();
  const { data: messages = [] } = useMessages(selectedConversation);
  const { data: chatUnread } = useConversationUnreadCounts();
  const markAsRead = useMarkAsRead();
  const sendMessage = useSendMessage();
  const deleteMessage = useDeleteMessage();
  const editMessage = useEditMessage();
  const startConversation = useStartConversation();

  // Mark conversation as read after 1 second
  useEffect(() => {
    if (!selectedConversation) return;
    const timer = setTimeout(() => {
      markAsRead.mutate({ contextType: "conversation", contextId: selectedConversation });
    }, 1000);
    return () => clearTimeout(timer);
  }, [selectedConversation, messages.length]);

  // Get all users for new conversation
  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-profiles"],
    enabled: showNewChat,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .neq("user_id", user?.id || "");
      return data || [];
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!messageInput.trim() || !selectedConversation) return;
    sendMessage.mutate(
      { conversationId: selectedConversation, content: messageInput.trim() },
      { onSuccess: () => setMessageInput("") }
    );
  };

  const handleDeleteConfirm = () => {
    if (!deleteMessageId) return;
    deleteMessage.mutate(deleteMessageId, {
      onSuccess: () => setDeleteMessageId(null),
    });
  };

  const handleStartChat = async (otherUserId: string) => {
    const convId = await startConversation.mutateAsync(otherUserId);
    setSelectedConversation(convId);
    setShowNewChat(false);
  };

  const selectedConv = conversations.find((c) => c.id === selectedConversation);

  return (
    <AppLayout breadcrumbs={[{ label: "Chat" }]}>
      <div className="max-w-4xl mx-auto w-full flex" style={{ height: "calc(100vh - 7rem)" }}>
        {/* Conversation List */}
        <aside
          className={`w-full md:w-80 border-r border-border flex flex-col ${
            selectedConversation ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Conversas</span>
            <Button size="sm" variant="ghost" onClick={() => setShowNewChat(true)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {showNewChat && (
            <div className="p-3 border-b border-border bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-2">Nova conversa com:</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {allUsers.map((u: any) => (
                  <button
                    key={u.user_id}
                    onClick={() => handleStartChat(u.user_id)}
                    className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <UserCircle className="w-4 h-4 text-muted-foreground" />
                    {capitalizeName(u.display_name) || "Usuário"}
                  </button>
                ))}
                {allUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground px-3">Nenhum usuário encontrado</p>
                )}
              </div>
              <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setShowNewChat(false)}>
                Cancelar
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="p-4 text-center">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Nenhuma conversa ainda
              </div>
            ) : (
              conversations.map((conv) => {
                const unreadCount = chatUnread?.unreadPerConv?.[conv.id] || 0;
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv.id)}
                    className={`w-full text-left px-4 py-3 border-b border-border hover:bg-accent/50 transition-colors ${
                      selectedConversation === conv.id ? "bg-accent" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium text-foreground truncate ${unreadCount > 0 ? "font-bold" : ""}`}>
                        {capitalizeName(conv.other_user?.display_name) || "Usuário"}
                      </p>
                      {unreadCount > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    {conv.last_message && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conv.last_message.content}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Messages Panel */}
        <main
          className={`flex-1 flex flex-col ${
            !selectedConversation ? "hidden md:flex" : "flex"
          }`}
        >
          {selectedConversation ? (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <UserCircle className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium text-sm">
                  {capitalizeName(selectedConv?.other_user?.display_name) || "Usuário"}
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`group relative max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                          isMine
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {editingMessage?.id === msg.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              className="bg-transparent border-b border-primary-foreground/40 outline-none text-sm w-full min-w-[120px]"
                              value={editingMessage.content}
                              onChange={(e) =>
                                setEditingMessage({ ...editingMessage, content: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  editMessage.mutate(
                                    { messageId: msg.id, content: editingMessage.content.trim() },
                                    { onSuccess: () => setEditingMessage(null) }
                                  );
                                }
                                if (e.key === "Escape") setEditingMessage(null);
                              }}
                            />
                            <button
                              onClick={() => {
                                editMessage.mutate(
                                  { messageId: msg.id, content: editingMessage.content.trim() },
                                  { onSuccess: () => setEditingMessage(null) }
                                );
                              }}
                              className="p-0.5 rounded hover:bg-primary-foreground/20"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingMessage(null)}
                              className="p-0.5 rounded hover:bg-primary-foreground/20"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <p>{msg.content}</p>
                        )}
                        <p
                          className={`text-[10px] mt-1 ${
                            isMine ? "text-primary-foreground/60" : "text-muted-foreground"
                          }`}
                        >
                          {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                        </p>
                        {isMine && editingMessage?.id !== msg.id && (
                          <div className="absolute -left-16 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                            <button
                              onClick={() => setEditingMessage({ id: msg.id, content: msg.content })}
                              className="p-1 rounded-md hover:bg-accent/50"
                              title="Editar mensagem"
                            >
                              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => setDeleteMessageId(msg.id)}
                              className="p-1 rounded-md hover:bg-destructive/10"
                              title="Apagar mensagem"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Digite uma mensagem..."
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                />
                <Button size="icon" onClick={handleSend} disabled={!messageInput.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  Selecione uma conversa ou inicie uma nova
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteMessageId} onOpenChange={(open) => !open && setDeleteMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A mensagem será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Chat;
