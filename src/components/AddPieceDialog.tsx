import { useState } from "react";
import { useAddPiece, type Piece } from "@/hooks/useStoreData";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compressImage";
import { Plus, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface AddPieceDialogProps {
  existingPieces: Piece[];
}

const AddPieceDialog = ({ existingPieces }: AddPieceDialogProps) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", category: "", name: "", size: "", image_url: "", specification: "Vide Book/Manual", installation_instructions: "Sem informações específicas" });
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const addPiece = useAddPiece();

  const maxCode = existingPieces.reduce((max, p) => Math.max(max, p.code), 0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const compressed = await compressImage(file, 800, 0.6);
      const path = `piece-new-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("piece-images")
        .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("piece-images").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: urlData.publicUrl }));
      setPreviewUrl(urlData.publicUrl);
      toast.success("Imagem enviada com sucesso");
    } catch (err: any) {
      toast.error("Erro ao enviar imagem: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setForm((f) => ({ ...f, image_url: "" }));
    setPreviewUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = form.code ? Number(form.code) : maxCode + 1;
    await addPiece.mutateAsync({
      code,
      category: form.category.toUpperCase(),
      name: form.name,
      size: form.size,
      image_url: form.image_url || undefined,
      specification: form.specification,
      installation_instructions: form.installation_instructions,
    });
    setForm({ code: "", category: "", name: "", size: "", image_url: "", specification: "Vide Book/Manual", installation_instructions: "Sem informações específicas" });
    setPreviewUrl(null);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">
          <Plus className="w-4 h-4 mr-1" /> Novo Item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Adicionar Item à Campanha</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Código</label>
              <Input
                type="number"
                placeholder={String(maxCode + 1)}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Categoria</label>
              <Input
                required
                placeholder="Ex: CUBOS"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome</label>
            <Input
              required
              placeholder="Nome da peça"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Medida</label>
            <Input
              required
              placeholder="Ex: 90x60cm"
              value={form.size}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Especificação</label>
            <Input
              value={form.specification}
              onChange={(e) => setForm({ ...form, specification: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Instruções de Instalação</label>
            <Input
              value={form.installation_instructions}
              onChange={(e) => setForm({ ...form, installation_instructions: e.target.value })}
            />
          </div>

          {/* Image upload section */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Foto da peça</label>
            {previewUrl ? (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-36 object-contain rounded-lg border border-border bg-muted/30"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2 h-7 px-2"
                  onClick={handleRemoveImage}
                >
                  <X className="w-3 h-3 mr-1" /> Remover
                </Button>
              </div>
            ) : (
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
                    {uploading ? "Comprimindo e enviando..." : "Clique ou arraste (será comprimida)"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={addPiece.isPending || uploading}>
            {addPiece.isPending ? "Adicionando..." : "Confirmar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddPieceDialog;
