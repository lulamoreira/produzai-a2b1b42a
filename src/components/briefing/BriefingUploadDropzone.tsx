import { useRef, useState } from "react";
import { Upload, Link as LinkIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { parseVideoEmbed } from "@/lib/videoEmbedParser";
import type { BriefingMediaKind, BriefingSectionKey } from "@/hooks/useBriefing";

interface Props {
  sectionKey: BriefingSectionKey;
  accept: string;
  label: string;
  allowEmbed?: boolean;
  multiple?: boolean;
  detectKind: (file: File) => BriefingMediaKind;
  onUpload: (file: File, kind: BriefingMediaKind) => Promise<void>;
  onEmbed?: (url: string, thumbnail: string | undefined, title: string | undefined, kind: BriefingMediaKind) => Promise<void>;
}

const BriefingUploadDropzone = ({
  sectionKey: _s,
  accept, label, allowEmbed, multiple = true, detectKind, onUpload, onEmbed,
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [embedUrl, setEmbedUrl] = useState("");

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        await onUpload(file, detectKind(file));
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleAddEmbed = async () => {
    if (!onEmbed || !embedUrl.trim()) return;
    const info = parseVideoEmbed(embedUrl);
    if (info) {
      setBusy(true);
      try {
        await onEmbed(info.embedUrl, info.thumbnailUrl, info.originalUrl, "embed");
        setEmbedUrl("");
      } finally { setBusy(false); }
    } else {
      // Fallback: treat as arbitrary link
      setBusy(true);
      try {
        await onEmbed(embedUrl.trim(), undefined, embedUrl.trim(), "embed");
        setEmbedUrl("");
      } catch (e: any) {
        toast.error(e?.message ?? "Link inválido");
      } finally { setBusy(false); }
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={`rounded-lg border-2 border-dashed transition-colors p-6 text-center cursor-pointer ${
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"
        }`}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        {busy ? (
          <Loader2 className="w-6 h-6 mx-auto text-primary animate-spin" />
        ) : (
          <>
            <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground mt-1">Arraste ou clique para selecionar</p>
          </>
        )}
      </div>

      {allowEmbed && onEmbed && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={embedUrl}
              onChange={(e) => setEmbedUrl(e.target.value)}
              placeholder="Cole link do YouTube, Vimeo ou Google Drive"
              className="pl-9"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddEmbed(); } }}
            />
          </div>
          <Button onClick={handleAddEmbed} disabled={busy || !embedUrl.trim()} variant="secondary">
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
};

export default BriefingUploadDropzone;
