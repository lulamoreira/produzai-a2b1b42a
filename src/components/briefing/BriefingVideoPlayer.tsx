import { forwardRef, useEffect, useState } from "react";
import { getBriefingSignedUrl, type BriefingMedia } from "@/hooks/useBriefing";

interface Props {
  media: BriefingMedia;
  onTimeUpdate?: (t: number) => void;
}

const BriefingVideoPlayer = forwardRef<HTMLVideoElement, Props>(({ media, onTimeUpdate }, ref) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (media.storage_path) {
      getBriefingSignedUrl(media.storage_path).then((u) => { if (alive) setSrc(u); });
    } else {
      setSrc(media.external_url);
    }
    return () => { alive = false; };
  }, [media.storage_path, media.external_url]);

  if (media.kind === "embed" && media.external_url) {
    return (
      <div className="aspect-video rounded-lg overflow-hidden bg-black">
        <iframe
          src={media.external_url}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={media.title ?? "Vídeo"}
        />
      </div>
    );
  }

  if (!src) {
    return <div className="aspect-video rounded-lg bg-muted animate-pulse" />;
  }

  return (
    <video
      ref={ref}
      src={src}
      controls
      className="w-full rounded-lg bg-black aspect-video"
      onTimeUpdate={(e) => onTimeUpdate?.((e.target as HTMLVideoElement).currentTime)}
    />
  );
});
BriefingVideoPlayer.displayName = "BriefingVideoPlayer";

export default BriefingVideoPlayer;
