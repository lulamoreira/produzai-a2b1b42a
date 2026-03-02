import { useState } from "react";
import PhotoLightbox from "@/components/PhotoLightbox";
import { Image } from "lucide-react";

interface Props {
  imageUrl: string | null | undefined;
  name: string;
  size?: "sm" | "md";
}

const PieceThumbnail = ({ imageUrl, name, size = "sm" }: Props) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const sizeClasses = size === "sm" ? "w-8 h-8" : "w-10 h-10";

  if (!imageUrl) {
    return (
      <div className={`${sizeClasses} rounded border border-border bg-muted/30 flex items-center justify-center shrink-0`}>
        <Image className="w-3 h-3 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setLightboxOpen(true)}
        className={`${sizeClasses} rounded border border-border overflow-hidden shrink-0 hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer`}
      >
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" loading="lazy" />
      </button>
      <PhotoLightbox
        photos={[imageUrl]}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  );
};

export default PieceThumbnail;
