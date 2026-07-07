import { useState, RefObject } from "react";
import { MessageSquarePlus, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBriefingVideoComments } from "@/hooks/useBriefing";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  mediaId: string;
  videoRef: RefObject<HTMLVideoElement>;
  canDelete: (authorId: string) => boolean;
  currentUserId: string | null;
}

const fmt = (s: number) => {
  const total = Math.max(0, Math.floor(s));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};

const BriefingVideoComments = ({ mediaId, videoRef, canDelete }: Props) => {
  const { comments, addComment, deleteComment } = useBriefingVideoComments(mediaId);
  const [body, setBody] = useState("");
  const [ts, setTs] = useState(0);
  const [composing, setComposing] = useState(false);

  const captureTime = () => {
    const v = videoRef.current;
    const t = v?.currentTime ?? 0;
    setTs(t);
    setComposing(true);
  };

  const jumpTo = (t: number) => {
    const v = videoRef.current;
    if (v) { v.currentTime = t; v.play().catch(() => {}); }
  };

  const submit = async () => {
    if (!body.trim()) return;
    await addComment.mutateAsync({ timestampSec: ts, body: body.trim() });
    setBody("");
    setComposing(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-foreground">Comentários ({comments.length})</h4>
        <Button size="sm" variant="secondary" onClick={captureTime}>
          <MessageSquarePlus className="w-4 h-4 mr-1" /> Comentar aqui
        </Button>
      </div>

      {composing && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 mb-3 space-y-2">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Play className="w-3 h-3" /> em <span className="font-mono font-semibold text-foreground">{fmt(ts)}</span>
          </div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escreva seu comentário..."
            className="min-h-[72px] resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setComposing(false); setBody(""); }}>Cancelar</Button>
            <Button size="sm" onClick={submit} disabled={!body.trim() || addComment.isPending}>Publicar</Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Nenhum comentário. Clique em "Comentar aqui" enquanto o vídeo toca.
          </p>
        ) : comments.map((c) => (
          <div key={c.id} className="group rounded-lg border border-border bg-background p-3">
            <div className="flex items-center justify-between mb-1">
              <button
                type="button"
                onClick={() => jumpTo(c.timestamp_sec)}
                className="text-xs font-mono font-semibold text-primary hover:underline"
              >
                {fmt(c.timestamp_sec)}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.created_at), { locale: ptBR, addSuffix: true })}
                </span>
                {canDelete(c.author_id) && (
                  <button
                    type="button"
                    onClick={() => deleteComment.mutate(c.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BriefingVideoComments;
