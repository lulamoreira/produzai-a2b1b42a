import { useEffect, useState } from "react";
import { X, ExternalLink, FileIcon, Image as ImageIcon, Video, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBriefingSignedUrl, type BriefingMedia } from "@/hooks/useBriefing";

interface Props {
  items: BriefingMedia[];
  onDelete: (m: BriefingMedia) => void;
  canDelete: (m: BriefingMedia) => boolean;
  onOpen?: (m: BriefingMedia) => void;
  variant?: "grid" | "list";
}

function useSignedUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) { setUrl(null); return; }
    getBriefingSignedUrl(path).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [path]);
  return url;
}

const MediaThumb = ({ m, onOpen }: { m: BriefingMedia; onOpen?: () => void }) => {
  const signed = useSignedUrl(m.storage_path);
  const src = m.thumbnail_url || (m.kind === "image" ? signed : null);

  if (src) {
    return (
      <button type="button" onClick={onOpen} className="block w-full h-full">
        <img src={src} alt={m.title ?? ""} className="w-full h-full object-cover" loading="lazy" />
      </button>
    );
  }
  const Icon = m.kind === "video" ? Video : m.kind === "image" ? ImageIcon : FileIcon;
  return (
    <button type="button" onClick={onOpen} className="flex items-center justify-center w-full h-full bg-muted">
      <Icon className="w-10 h-10 text-muted-foreground" />
    </button>
  );
};

const MediaRow = ({ m, onOpen, onDelete, canDelete }: { m: BriefingMedia; onOpen?: () => void; onDelete: () => void; canDelete: boolean }) => {
  const signed = useSignedUrl(m.storage_path);
  const href = m.external_url ?? signed ?? "#";
  const Icon = m.kind === "video" ? Video : m.kind === "image" ? ImageIcon : FileIcon;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
      <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{m.title ?? "Sem título"}</p>
        <p className="text-xs text-muted-foreground truncate">{m.mime_type ?? m.kind}</p>
      </div>
      {onOpen && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpen}>
          <ExternalLink className="w-4 h-4" />
        </Button>
      )}
      {m.storage_path && (
        <a href={href} download target="_blank" rel="noreferrer">
          <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="w-4 h-4" /></Button>
        </a>
      )}
      {canDelete && (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};

const BriefingMediaGrid = ({ items, onDelete, canDelete, onOpen, variant = "grid" }: Props) => {
  if (items.length === 0) return null;

  if (variant === "list") {
    return (
      <div className="space-y-2">
        {items.map((m) => (
          <MediaRow
            key={m.id}
            m={m}
            onOpen={onOpen ? () => onOpen(m) : undefined}
            onDelete={() => onDelete(m)}
            canDelete={canDelete(m)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {items.map((m) => (
        <div key={m.id} className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted">
          <MediaThumb m={m} onOpen={onOpen ? () => onOpen(m) : undefined} />
          {canDelete(m) && (
            <button
              type="button"
              onClick={() => onDelete(m)}
              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-destructive"
              aria-label="Remover"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {m.title && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
              <p className="text-[11px] text-white truncate">{m.title}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default BriefingMediaGrid;
