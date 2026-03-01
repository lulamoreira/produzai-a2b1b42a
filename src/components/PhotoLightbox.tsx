import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface Props {
  photos: string[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PhotoLightbox = ({ photos, initialIndex = 0, open, onOpenChange }: Props) => {
  const [index, setIndex] = useState(initialIndex);

  const current = photos[index] || "";
  const hasMultiple = photos.length > 1;

  const prev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIndex((i) => (i + 1) % photos.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none overflow-hidden flex items-center justify-center">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 z-20 text-white hover:bg-white/20 h-8 w-8"
          onClick={() => onOpenChange(false)}
        >
          <X className="w-5 h-5" />
        </Button>

        {hasMultiple && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 text-white hover:bg-white/20 h-10 w-10"
              onClick={prev}
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 text-white hover:bg-white/20 h-10 w-10"
              onClick={next}
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          </>
        )}

        <img
          src={current}
          alt={`Foto ${index + 1}`}
          className="max-w-full max-h-[90vh] object-contain rounded-lg"
        />

        {hasMultiple && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === index ? "bg-white scale-125" : "bg-white/40"}`}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PhotoLightbox;
