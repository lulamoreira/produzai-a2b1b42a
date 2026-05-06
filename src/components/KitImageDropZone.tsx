import { useState } from "react";
import { toast } from "sonner";
import { Package } from "lucide-react";
import { getThumbnailUrl } from "@/lib/imageUrl";
import { useUpdateCampaignKit } from "@/hooks/useMultiClientData";
import { compressImage } from "@/lib/compressImage";
import { supabase } from "@/integrations/supabase/client";
import type { CampaignKit } from "@/hooks/useMultiClientData";

interface Props {
  kit: CampaignKit;
  canEdit?: boolean;
}

const KitImageDropZone = ({ kit, canEdit = false }: Props) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const updateKit = useUpdateCampaignKit();

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!canEdit) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Arquivo inválido. Envie uma imagem.");
      return;
    }
    setUploading(true);
    const toastId = `drop-kit-${kit.id}`;
    toast.loading(kit.image_url ? "Substituindo imagem do kit..." : "Enviando imagem do kit...", { id: toastId });
    try {
      const compressed = await compressImage(file, 800, 0.6);
      const path = `campaign-kit-${kit.id}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("piece-images").upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("piece-images").getPublicUrl(path);
      await updateKit.mutateAsync({ id: kit.id, image_url: urlData.publicUrl });
      toast.success("Imagem do kit atualizada!", { id: toastId });
    } catch (err: any) {
      toast.error("Erro: " + err.message, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const Inner = kit.image_url ? (
    <img src={getThumbnailUrl(kit.image_url, 80)} alt={kit.name} loading="lazy" decoding="async" className="w-8 h-8 rounded-lg object-cover border border-primary/20" />
  ) : (
    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
      <Package className="w-4 h-4 text-primary" />
    </div>
  );

  if (!canEdit) return Inner;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
      onDrop={handleDrop}
      className={`relative rounded-lg transition-all ${dragActive ? "ring-2 ring-primary ring-offset-1" : ""}`}
      title={kit.image_url ? "Arraste uma imagem para substituir" : "Arraste uma imagem para adicionar"}
    >
      {Inner}
      {(dragActive || uploading) && (
        <div className="absolute inset-0 rounded-lg bg-primary/20 border-2 border-dashed border-primary flex items-center justify-center pointer-events-none">
          <span className="text-[8px] font-bold text-primary">{uploading ? "..." : "+"}</span>
        </div>
      )}
    </div>
  );
};

export default KitImageDropZone;
