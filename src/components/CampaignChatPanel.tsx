import { useState, useRef, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Camera, X, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  useCampaignMessages,
  useSendCampaignMessage,
  useDeleteCampaignMessage,
  useMarkCampaignRead,
  useMentionableUsers,
  type CampaignMessage,
  type MentionableUser,
} from "@/hooks/useCampaignChat";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compressImage";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CampaignChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName?: string;
}

/* ── audio beep helper ── */
function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // silently fail if audio not supported
  }
}

export default function CampaignChatPanel({ open, onOpenChange, campaignId, campaignName }: CampaignChatPanelProps) {
  const { user } = useAuth();
  const { isAdmin, isMaster } = useUserRole();
  const { data: messages = [], isLoading } = useCampaignMessages(campaignId);
  const sendMessage = useSendCampaignMessage(campaignId);
  const deleteMessage = useDeleteCampaignMessage(campaignId);
  const markAsRead = useMarkCampaignRead(campaignId);
  const { data: mentionableUsers = [] } = useMentionableUsers(campaignId);

  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevCountRef = useRef(0);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // Audio beep on new message
  useEffect(() => {
    if (messages.length > prevCountRef.current && prevCountRef.current > 0) {
      const latest = messages[messages.length - 1];
      if (latest && latest.sender_id !== user?.id) {
        playBeep();
      }
    }
    prevCountRef.current = messages.length;
  }, [messages.length, user?.id]);

  // Mark as read when panel opens
  useEffect(() => {
    if (open && messages.length > 0) {
      markAsRead();
    }
  }, [open, messages.length, markAsRead]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sendMessage.isPending) return;
    setText("");
    setShowMentions(false);
    await sendMessage.mutateAsync({ content: trimmed });
  }, [text, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    // Check for @ mentions
    const lastAt = val.lastIndexOf("@");
    if (lastAt >= 0) {
      const afterAt = val.slice(lastAt + 1);
      if (!afterAt.includes(" ")) {
        setShowMentions(true);
        setMentionFilter(afterAt.toLowerCase());
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (u: MentionableUser) => {
    const lastAt = text.lastIndexOf("@");
    const before = text.slice(0, lastAt);
    setText(`${before}@${u.display_name} `);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = "";

    setUploading(true);
    try {
      const compressed = await compressImage(file, 800, 0.8);
      const ext = "jpg";
      const path = `${campaignId}/${Date.now()}_${user.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("schedule-chat-images")
        .upload(path, compressed, { contentType: "image/jpeg" });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("schedule-chat-images")
        .getPublicUrl(path);

      await sendMessage.mutateAsync({
        content: text.trim() || "📷 Foto",
        imageUrl: urlData.publicUrl,
      });
      setText("");
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (msgId: string) => {
    await deleteMessage.mutateAsync(msgId);
  };

  const filteredMentions = mentionableUsers.filter((u) =>
    u.display_name.toLowerCase().includes(mentionFilter)
  );

  const renderContent = (content: string) => {
    // Highlight @mentions in blue
    const parts = content.split(/(@\S+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span key={i} className="text-primary font-semibold">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-sm font-semibold truncate">
              💬 Chat — {campaignName || "Campanha"}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea ref={scrollRef} className="flex-1 px-4 py-2">
            {isLoading ? (
              <div className="text-center text-muted-foreground text-sm py-8">Carregando...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                Nenhuma mensagem ainda. Comece a conversa!
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  const canDelete = isMine || isAdmin || isMaster;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                        isMine
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}>
                        {!isMine && (
                          <p className="text-[10px] font-semibold opacity-70 mb-0.5">
                            {msg.sender_name}
                          </p>
                        )}
                        {msg.image_url && (
                          <button
                            type="button"
                            onClick={() => setLightboxUrl(msg.image_url)}
                            className="block mb-1"
                          >
                            <img
                              src={msg.image_url}
                              alt="Anexo"
                              className="rounded-lg max-h-48 max-w-full object-cover cursor-pointer"
                              loading="lazy"
                            />
                          </button>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {renderContent(msg.content)}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`text-[10px] ${isMine ? "opacity-70" : "text-muted-foreground"}`}>
                            {formatDistanceToNow(new Date(msg.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(msg.id)}
                              className={`ml-1 opacity-0 group-hover:opacity-100 hover:opacity-100 ${
                                isMine ? "text-primary-foreground/60 hover:text-primary-foreground" : "text-muted-foreground hover:text-destructive"
                              }`}
                              title="Excluir"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Mention popover */}
          {showMentions && filteredMentions.length > 0 && (
            <div className="mx-4 mb-1 border rounded-lg bg-popover shadow-lg max-h-40 overflow-y-auto">
              {filteredMentions.slice(0, 8).map((u) => (
                <button
                  key={u.user_id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                  onClick={() => insertMention(u)}
                >
                  @{u.display_name}
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div className="border-t px-3 py-2 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="flex-shrink-0 h-8 w-8"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="w-4 h-4" />
            </Button>
            <Input
              ref={inputRef}
              value={text}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              className="flex-1 h-9 text-sm"
              disabled={sendMessage.isPending || uploading}
            />
            <Button
              type="button"
              size="icon"
              className="flex-shrink-0 h-8 w-8"
              disabled={!text.trim() || sendMessage.isPending}
              onClick={handleSend}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Image lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Imagem ampliada"
            className="max-w-full max-h-full rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
}
