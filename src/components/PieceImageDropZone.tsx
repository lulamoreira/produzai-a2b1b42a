import { useState } from "react";
import { toast } from "sonner";
import PieceThumbnail from "@/components/PieceThumbnail";
import { useUpdateCampaignPieceImage } from "@/hooks/useMultiClientData";
import { uploadPieceImageVariants } from "@/lib/uploadPieceImage";
import type { CampaignPiece } from "@/hooks/useMultiClientData";

interface Props {
  piece: CampaignPiece;
  canEdit?: boolean;
}

const PieceImageDropZone = ({ piece, canEdit = false }: Props) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const updateImage = useUpdateCampaignPieceImage();

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
    const toastId = `drop-piece-${piece.id}`;
    toast.loading(piece.image_url ? "Substituindo imagem..." : "Enviando imagem...", { id: toastId });
    try {
      const uploaded = await uploadPieceImageVariants(file);
      await updateImage.mutateAsync({
        pieceId: piece.id,
        imageUrl: uploaded.image_url,
        variants: {
          image_thumb_url: uploaded.image_thumb_url,
          image_report_url: uploaded.image_report_url,
          image_full_url: uploaded.image_full_url,
          image_hash: uploaded.image_hash,
        },
      });
      toast.success("Imagem atualizada!", { id: toastId });
    } catch (err: any) {
      toast.error("Erro ao enviar imagem: " + err.message, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  if (!canEdit) {
    return <PieceThumbnail imageUrl={piece.image_url} name={piece.name} />;
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
      onDrop={handleDrop}
      className={`relative rounded transition-all ${dragActive ? "ring-2 ring-primary ring-offset-1" : ""}`}
      title={piece.image_url ? "Arraste uma imagem para substituir" : "Arraste uma imagem para adicionar"}
    >
      <PieceThumbnail imageUrl={piece.image_url} name={piece.name} />
      {(dragActive || uploading) && (
        <div className="absolute inset-0 rounded bg-primary/20 border-2 border-dashed border-primary flex items-center justify-center pointer-events-none">
          <span className="text-[8px] font-bold text-primary">{uploading ? "..." : "+"}</span>
        </div>
      )}
    </div>
  );
};

export default PieceImageDropZone;
