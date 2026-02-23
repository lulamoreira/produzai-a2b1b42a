import { useState } from "react";
import { useAddPiece, type Piece } from "@/hooks/useStoreData";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AddPieceDialogProps {
  existingPieces: Piece[];
}

const AddPieceDialog = ({ existingPieces }: AddPieceDialogProps) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", category: "", name: "", size: "", image_url: "" });
  const addPiece = useAddPiece();

  const maxCode = existingPieces.reduce((max, p) => Math.max(max, p.code), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = form.code ? Number(form.code) : maxCode + 1;
    await addPiece.mutateAsync({
      code,
      category: form.category.toUpperCase(),
      name: form.name,
      size: form.size,
      image_url: form.image_url || undefined,
    });
    setForm({ code: "", category: "", name: "", size: "", image_url: "" });
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
            <label className="text-xs font-medium text-muted-foreground">URL da Imagem (opcional)</label>
            <Input
              placeholder="https://..."
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            />
          </div>
          <Button type="submit" className="w-full" disabled={addPiece.isPending}>
            {addPiece.isPending ? "Adicionando..." : "Confirmar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddPieceDialog;
