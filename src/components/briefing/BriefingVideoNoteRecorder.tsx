import { useEffect, useRef, useState } from "react";
import { Video, Monitor, Square, RotateCcw, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useVideoNoteRecorder, type RecorderSource } from "@/hooks/useVideoNoteRecorder";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpload: (blob: Blob, fileName: string, durationSec: number) => Promise<void>;
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};

const BriefingVideoNoteRecorder = ({ open, onOpenChange, onUpload }: Props) => {
  const { status, durationSec, previewUrl, blob, error, stream, start, stop, reset, maxDurationSec } = useVideoNoteRecorder();
  const liveRef = useRef<HTMLVideoElement>(null);
  const [uploading, setUploading] = useState(false);
  const [source, setSource] = useState<RecorderSource>("camera");

  useEffect(() => {
    if (liveRef.current && stream && status === "recording") {
      liveRef.current.srcObject = stream;
      liveRef.current.play().catch(() => {});
    }
  }, [stream, status]);

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSend = async () => {
    if (!blob) return;
    setUploading(true);
    try {
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const name = `video-nota-${Date.now()}.${ext}`;
      await onUpload(blob, name, durationSec);
      toast.success("Vídeo-nota enviada");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gravar vídeo-nota</DialogTitle>
        </DialogHeader>

        {status === "idle" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Grave uma nota curta explicando o briefing (até {fmt(maxDurationSec)}).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setSource("camera"); start("camera"); }}
                className="rounded-lg border border-border p-6 hover:bg-muted transition text-center"
              >
                <Video className="w-8 h-8 mx-auto text-primary mb-2" />
                <p className="font-medium text-sm">Câmera + microfone</p>
              </button>
              <button
                onClick={() => { setSource("screen"); start("screen"); }}
                className="rounded-lg border border-border p-6 hover:bg-muted transition text-center"
              >
                <Monitor className="w-8 h-8 mx-auto text-primary mb-2" />
                <p className="font-medium text-sm">Compartilhar tela</p>
              </button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {status === "recording" && (
          <div className="space-y-3">
            <video ref={liveRef} muted className="w-full rounded-lg bg-black aspect-video" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                <span className="font-mono text-sm">
                  {fmt(durationSec)} / {fmt(maxDurationSec)}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({source === "camera" ? "câmera" : "tela"})
                </span>
              </div>
              <Button variant="destructive" onClick={stop}>
                <Square className="w-4 h-4 mr-1" /> Parar
              </Button>
            </div>
          </div>
        )}

        {status === "stopped" && previewUrl && (
          <div className="space-y-3">
            <video src={previewUrl} controls className="w-full rounded-lg bg-black aspect-video" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Duração: {fmt(durationSec)}</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset}>
                  <RotateCcw className="w-4 h-4 mr-1" /> Regravar
                </Button>
                <Button onClick={handleSend} disabled={uploading}>
                  {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={reset} variant="outline">Tentar de novo</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BriefingVideoNoteRecorder;
