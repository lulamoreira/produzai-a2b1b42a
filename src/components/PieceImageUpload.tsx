import { useState } from "react";
import { getThumbnailUrl } from "@/lib/imageUrl";
import { supabase } from "@/integrations/supabase/client";
import { useUpdatePieceImage, type Piece } from "@/hooks/useStoreData";
import { compressImage } from "@/lib/compressImage";
import { Image, Upload, Link, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface PieceImageUploadProps {
  piece: Piece;
}

const PieceImageUpload = ({ piece }: PieceImageUploadProps) => {
  const [open, setOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const updateImage = useUpdatePieceImage();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset the input so the same file can be re-selected
    e.target.value = "";

    setUploading(true);
    try {
      const compressed = await compressImage(file, 800, 0.6);
      const path = `piece-${piece.id}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("piece-images")
        .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("piece-images").getPublicUrl(path);
      await updateImage.mutateAsync({ pieceId: piece.id, imageUrl: urlData.publicUrl });
      setOpen(false);
    } catch (err: any) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    await updateImage.mutateAsync({ pieceId: piece.id, imageUrl: urlInput.trim() });
    setUrlInput("");
    setOpen(false);
  };

  const handleRemove = async () => {
    await updateImage.mutateAsync({ pieceId: piece.id, imageUrl: null });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="relative group w-10 h-10 rounded-lg border border-border bg-muted/50 flex items-center justify-center overflow-hidden hover:border-primary/50 transition-colors shrink-0">
          {piece.image_url ? (
            <img src={getThumbnailUrl(piece.image_url, 80)} alt={piece.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ) : (
            <Image className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Imagem - {piece.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {piece.image_url && (
            <div className="relative">
              <img
                src={piece.image_url}
                alt={piece.name}
                className="w-full h-48 object-contain rounded-lg border border-border bg-muted/30"
              />
              <Button
                size="sm"
                variant="destructive"
                className="absolute top-2 right-2"
                onClick={handleRemove}
              >
                <X className="w-3 h-3 mr-1" /> Remover
              </Button>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Upload de arquivo</label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/20">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? "Enviando..." : "Clique ou arraste um arquivo"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex-1 h-px bg-border" />
              <span>ou</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">URL da imagem</label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://exemplo.com/imagem.jpg"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleUrlSubmit} disabled={!urlInput.trim()} size="sm">
                  <Link className="w-3 h-3 mr-1" /> Salvar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PieceImageUpload;
