import React, { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Package, Loader2, Link as LinkIcon, Image as ImageIcon } from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface PieceInput {
  name: string;
  image_url: string;
  piece_url: string;
  available_as: 'figura' | 'chaveiro' | 'ambos';
}

export const NewDropDialog = () => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const [dropName, setDropName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [dropLink, setDropLink] = useState("");
  
  const [pieces, setPieces] = useState<PieceInput[]>([
    { name: "", image_url: "", piece_url: "", available_as: "ambos" }
  ]);

  const addPiece = () => {
    setPieces([...pieces, { name: "", image_url: "", piece_url: "", available_as: "ambos" }]);
  };

  const removePiece = (index: number) => {
    if (pieces.length > 1) {
      setPieces(pieces.filter((_, i) => i !== index));
    }
  };

  const updatePiece = (index: number, field: keyof PieceInput, value: string) => {
    const newPieces = [...pieces];
    newPieces[index] = { ...newPieces[index], [field]: value };
    setPieces(newPieces);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      // 1. Insert drop
      const { data: drop, error: dropError } = await supabase
        .from("q3d_drops")
        .insert({
          drop_name: dropName,
          description,
          drop_image_url: imageUrl,
          drop_link: dropLink
        })
        .select()
        .single();
      
      if (dropError) throw dropError;

      // 2. Insert pieces
      const piecesToInsert = pieces
        .filter(p => p.name.trim() !== "")
        .map(p => ({
          ...p,
          drop_id: drop.id,
          status: 'pendente'
        }));

      if (piecesToInsert.length > 0) {
        const { error: piecesError } = await supabase
          .from("q3d_pieces")
          .insert(piecesToInsert);
        
        if (piecesError) throw piecesError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["q3d_drops"] });
      toast.success("Drop criado com sucesso!");
      setOpen(false);
      resetForm();
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao criar drop.");
    }
  });

  const resetForm = () => {
    setDropName("");
    setDescription("");
    setImageUrl("");
    setDropLink("");
    setPieces([{ name: "", image_url: "", piece_url: "", available_as: "ambos" }]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 rounded-[12px] font-bold h-11 px-6 shadow-sm">
          <Plus className="w-5 h-5 mr-2" />
          Novo Drop
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90dvh] flex flex-col p-0 rounded-[20px] overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 bg-white border-b sticky top-0 z-10">
          <DialogTitle className="text-2xl font-display font-bold text-foreground">Novo Drop</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6 bg-[#FAFAFA]">
          <div className="space-y-6">
            {/* Drop Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Nome do drop</Label>
                  <Input 
                    id="name" 
                    placeholder="Ex: Coleção Verão 2026" 
                    className="bg-white h-11 rounded-[12px]" 
                    value={dropName}
                    onChange={(e) => setDropName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imageUrl" className="text-sm font-bold text-muted-foreground uppercase tracking-wider">URL da imagem</Label>
                  <div className="relative">
                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      id="imageUrl" 
                      placeholder="https://..." 
                      className="bg-white h-11 pl-9 rounded-[12px]"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dropLink" className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Link na STLFLIX</Label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="dropLink" 
                    placeholder="https://stlflix.com/..." 
                    className="bg-white h-11 pl-9 rounded-[12px]"
                    value={dropLink}
                    onChange={(e) => setDropLink(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Descrição</Label>
                <Textarea 
                  id="description" 
                  placeholder="Detalhes sobre este drop..." 
                  className="bg-white min-h-[100px] rounded-[12px] resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <Separator className="my-8" />

            {/* Pieces Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-display font-bold text-foreground">Peças deste drop</h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addPiece}
                  className="rounded-full border-dashed border-primary text-primary hover:bg-primary/5 font-bold"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Adicionar peça
                </Button>
              </div>

              <div className="space-y-4">
                {pieces.map((piece, index) => (
                  <div 
                    key={index} 
                    className="p-5 bg-white border border-[#E5E7EB] rounded-[16px] shadow-sm relative group animate-in slide-in-from-bottom-2 duration-300"
                  >
                    {pieces.length > 1 && (
                      <button 
                        onClick={() => removePiece(index)}
                        className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white border border-[#E5E7EB] text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-all shadow-sm z-10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome da peça</Label>
                        <Input 
                          placeholder="Nome..." 
                          className="h-10 text-sm rounded-[10px]"
                          value={piece.name}
                          onChange={(e) => updatePiece(index, "name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">URL da Imagem</Label>
                        <Input 
                          placeholder="https://..." 
                          className="h-10 text-sm rounded-[10px]"
                          value={piece.image_url}
                          onChange={(e) => updatePiece(index, "image_url", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">URL na STLFLIX</Label>
                        <Input 
                          placeholder="https://..." 
                          className="h-10 text-sm rounded-[10px]"
                          value={piece.piece_url}
                          onChange={(e) => updatePiece(index, "piece_url", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Disponível como</Label>
                        <Select 
                          value={piece.available_as} 
                          onValueChange={(val: any) => updatePiece(index, "available_as", val)}
                        >
                          <SelectTrigger className="h-10 text-sm rounded-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="figura">Figura</SelectItem>
                            <SelectItem value="chaveiro">Chaveiro</SelectItem>
                            <SelectItem value="ambos">Figura e Chaveiro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 bg-white border-t sticky bottom-0 z-10">
          <DialogClose asChild>
            <Button variant="ghost" className="rounded-[12px] font-bold">Cancelar</Button>
          </DialogClose>
          <Button 
            className="bg-primary hover:bg-primary/90 px-8 rounded-[12px] font-bold"
            disabled={!dropName.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Package className="w-5 h-5 mr-2" />
            )}
            Salvar Drop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
