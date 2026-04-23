import { useState, useRef } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compressImage";
import { toast } from "sonner";

interface Props {
  maxPhotos?: number;
  photos: string[];
  onPhotosChange: (urls: string[]) => void;
  uploading: boolean;
  onUploadingChange: (v: boolean) => void;
  bucketPath: string;
}

export default function StorePortalPhotoUpload({ maxPhotos = 3, photos, onPhotosChange, uploading, onUploadingChange, bucketPath }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) { toast.error(`Máximo de ${maxPhotos} fotos.`); return; }

    const toProcess = Array.from(files).slice(0, remaining).filter(f => f.type.startsWith("image/"));
    if (toProcess.length === 0) return;

    onUploadingChange(true);
    const newUrls: string[] = [];

    for (const file of toProcess) {
      try {
        const compressed = await compressImage(file, 800, 0.8);
        const fileName = `${bucketPath}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: upErr } = await supabase.storage.from("occurrence-images").upload(fileName, compressed, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("occurrence-images").getPublicUrl(fileName);
        newUrls.push(urlData.publicUrl);
      } catch (err) {
        console.error("Upload error:", err);
        toast.error("Erro ao enviar foto.");
      }
    }

    onPhotosChange([...photos, ...newUrls]);
    onUploadingChange(false);
  };

  const removePhoto = (idx: number) => {
    onPhotosChange(photos.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Fotos ({photos.length}/{maxPhotos})</p>
      <div className="flex flex-wrap gap-2">
        {photos.map((url, i) => (
          <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border border-border">
            <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            <button
              onClick={() => removePhoto(i)}
              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
              type="button"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {photos.length < maxPhotos && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            type="button"
            className="w-20 h-20 rounded-md border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-[#8C6F4E] transition-colors"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  );
}
