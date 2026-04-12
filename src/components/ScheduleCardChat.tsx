import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMarkAsRead } from "@/hooks/useChatReadStatus";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Send, Trash2, Pencil, Check, X, Camera, HardHat } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { compressImage } from "@/lib/compressImage";
import { toast } from "sonner";

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
  image_url: string | null;
  is_installer: boolean;
  installer_name: string | null;
  created_at: string;
}

// Render message content with @mentions highlighted in blue
function renderContent(text: string) {
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-blue-500 font-medium">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

const ScheduleCardChat = ({ open, onOpenChange, campaignId, storeId, storeName }: ScheduleCardChatProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messageInput, setMessageInput] = useState("");
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryKey = ["schedule-chat", campaignId, storeId];
  const markChatAsRead = useMarkAsRead();

  // Mark as read when opening
  useEffect(() => {
    if (open) {
      markChatAsRead.mutate({ contextType: "schedule_chat", contextId: `${campaignId}:${storeId}` });
    }
  }, [open, campaignId, storeId]);

  // Realtime subscription
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel(`schedule-chat-${campaignId}-${storeId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "schedule_chat_messages",
        filter: `campaign_id=eq.${campaignId}`,
      }, () => { queryClient.invalidateQueries({ queryKey }); })
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
  const senderIds = [...new Set(messages.filter(m => !m.is_installer).map(m => m.sender_id))];
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

  // Fetch mentionable users (team members + campaign users)
  const { data: mentionables = [] } = useQuery({
    queryKey: ["schedule-chat-mentionables", campaignId],
    enabled: open,
    queryFn: async () => {
      const names: { id: string; name: string }[] = [];
      // Installation team members for this campaign
      const { data: teams } = await supabase.from("installation_teams").select("id").eq("campaign_id", campaignId);
      if (teams && teams.length > 0) {
        const teamIds = teams.map(t => t.id);
        const { data: members } = await supabase.from("installation_team_members").select("id, name").in("team_id", teamIds);
        if (members) members.forEach(m => names.push({ id: m.id, name: m.name }));
      }
      // Profiles of users who have sent messages in this chat
      if (profiles.length > 0) {
        profiles.forEach(p => {
          if (!names.some(n => n.name === p.display_name)) {
            names.push({ id: p.user_id, name: p.display_name || "Usuário" });
          }
        });
      }
      return names;
    },
  });

  const filteredMentions = useMemo(() => {
    if (!mentionFilter) return mentionables;
    const lower = mentionFilter.toLowerCase();
    return mentionables.filter(m => m.name.toLowerCase().includes(lower));
  }, [mentionables, mentionFilter]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle input change with @mention detection
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMessageInput(val);
    // Detect @mention trigger
    const lastAt = val.lastIndexOf("@");
    if (lastAt >= 0) {
      const afterAt = val.slice(lastAt + 1);
      // Only trigger if @ is at start or preceded by space, and no space after query yet
      if ((lastAt === 0 || val[lastAt - 1] === " ") && !afterAt.includes(" ")) {
        setMentionFilter(afterAt);
        setMentionOpen(true);
        return;
      }
    }
    setMentionOpen(false);
  }, []);

  const insertMention = useCallback((name: string) => {
    const lastAt = messageInput.lastIndexOf("@");
    const before = messageInput.slice(0, lastAt);
    setMessageInput(`${before}@${name} `);
    setMentionOpen(false);
    inputRef.current?.focus();
  }, [messageInput]);

  // Send
  const sendMutation = useMutation({
    mutationFn: async ({ content, image_url }: { content: string; image_url?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("schedule_chat_messages").insert({
        campaign_id: campaignId,
        store_id: storeId,
        sender_id: user.id,
        content,
        ...(image_url ? { image_url } : {}),
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
    sendMutation.mutate({ content: text });
    setMessageInput("");
    setMentionOpen(false);
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    setUploadingImage(true);
    try {
      const file = files[0];
      const compressed = await compressImage(file, 800, 0.8);
      const path = `${campaignId}/${storeId}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("schedule-chat-images")
        .upload(path, compressed, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("schedule-chat-images").getPublicUrl(path);
      sendMutation.mutate({ content: "", image_url: urlData.publicUrl });
      toast.success("Imagem enviada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar imagem.");
    } finally {
      setUploadingImage(false);
    }
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
              const isOwn = !msg.is_installer && msg.sender_id === user?.id;
              const isInstaller = msg.is_installer;
              const senderName = isInstaller
                ? (msg.installer_name || "Instalador")
                : (profileMap[msg.sender_id] || "Usuário");
              const isEditing = editingMessage?.id === msg.id;

              return (
                <div key={msg.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-muted-foreground mb-0.5 px-1 flex items-center gap-1">
                    {isInstaller && <HardHat className="w-3 h-3 inline" />}
                    {senderName}
                  </span>
                  <div className={`group relative max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    isInstaller
                      ? "bg-amber-100 dark:bg-amber-900/30 text-foreground border border-amber-200 dark:border-amber-800"
                      : isOwn
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                  }`}>
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
                        {msg.image_url && (
                          <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
                            <img src={msg.image_url} alt="Anexo" className="max-w-full rounded-md mb-1 max-h-48 object-cover" />
                          </a>
                        )}
                        {msg.content && (
                          <span className="whitespace-pre-wrap break-words">{renderContent(msg.content)}</span>
                        )}
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
          <div className="border-t border-border p-3 flex gap-2 shrink-0 relative">
            {/* Mention popover */}
            {mentionOpen && filteredMentions.length > 0 && (
              <div className="absolute bottom-full left-3 right-3 mb-1 bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto z-50">
                {filteredMentions.map((m) => (
                  <button
                    key={m.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                    onMouseDown={(e) => { e.preventDefault(); insertMention(m.name); }}
                  >
                    @{m.name}
                  </button>
                ))}
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => { handleImageUpload(e.target.files); e.target.value = ""; }}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="shrink-0"
              title="Enviar imagem"
            >
              <Camera className="w-4 h-4" />
            </Button>
            <Input
              ref={inputRef}
              value={messageInput}
              onChange={handleInputChange}
              placeholder="Digite uma mensagem... (@para mencionar)"
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !mentionOpen) { e.preventDefault(); handleSend(); }
                if (e.key === "Escape") setMentionOpen(false);
              }}
            />
            <Button size="icon" onClick={handleSend} disabled={(!messageInput.trim() && !uploadingImage) || sendMutation.isPending}>
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
