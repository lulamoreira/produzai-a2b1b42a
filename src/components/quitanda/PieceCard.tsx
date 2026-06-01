import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Calculator, Loader2, Rocket } from "lucide-react";
import { Q3DPiece } from "@/types/quitanda";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface PieceCardProps {
  piece: Q3DPiece;
}

export const PieceCard = ({ piece }: PieceCardProps) => {
  const queryClient = useQueryClient();
  const [isSelling, setIsSelling] = useState(piece.active);
  const [availableAs, setAvailableAs] = useState(piece.available_as);
  const [priceFigura, setPriceFigura] = useState(piece.price_figura?.toString() || "");
  const [priceChaveiro, setPriceChaveiro] = useState(piece.price_chaveiro?.toString() || "");

  const mutation = useMutation({
    mutationFn: async (updates: Partial<Q3DPiece>) => {
      const { error } = await supabase
        .from("q3d_pieces")
        .update(updates)
        .eq("id", piece.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["q3d_pieces"] });
      queryClient.invalidateQueries({ queryKey: ["q3d_drops"] });
    }
  });

  const handleToggleActive = (checked: boolean) => {
    setIsSelling(checked);
    mutation.mutate({ active: checked });
  };

  const statusColors = {
    pendente: "bg-gray-100 text-gray-600 border-gray-200",
    publicado: "bg-green-100 text-green-700 border-green-200",
    pausado: "bg-yellow-100 text-yellow-700 border-yellow-200",
  };

  const isPublishDisabled = 
    (availableAs === 'figura' && !priceFigura) || 
    (availableAs === 'chaveiro' && !priceChaveiro) || 
    (availableAs === 'ambos' && (!priceFigura || !priceChaveiro));

  return (
    <Card className="border-[#E5E7EB] rounded-[12px] shadow-sm overflow-hidden bg-white">
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-[8px] overflow-hidden bg-muted flex-shrink-0">
            {piece.image_url ? (
              <img src={piece.image_url} alt={piece.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground uppercase font-bold text-center p-1">
                Sem Imagem
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h4 className="font-semibold text-foreground truncate">{piece.name}</h4>
              <Badge variant="outline" className={cn("font-medium", statusColors[piece.status])}>
                {piece.status.charAt(0).toUpperCase() + piece.status.slice(1)}
              </Badge>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <Switch 
                  id={`sell-${piece.id}`} 
                  checked={isSelling} 
                  onCheckedChange={handleToggleActive}
                  className="data-[state=checked]:bg-primary"
                />
                <Label htmlFor={`sell-${piece.id}`} className="text-xs font-medium cursor-pointer">
                  Vender esta peça
                </Label>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isSelling && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Disponível como</Label>
                    <Select 
                      value={availableAs} 
                      onValueChange={(val: any) => {
                        setAvailableAs(val);
                        mutation.mutate({ available_as: val });
                      }}
                    >
                      <SelectTrigger className="w-full h-9 bg-muted/30">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="figura">Figura</SelectItem>
                        <SelectItem value="chaveiro">Chaveiro</SelectItem>
                        <SelectItem value="ambos">Figura e Chaveiro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {(availableAs === 'figura' || availableAs === 'ambos') && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Preço Figura</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px] font-bold">R$</span>
                          <Input 
                            className="pl-8 h-9 text-sm" 
                            type="number" 
                            placeholder="0,00"
                            value={priceFigura}
                            onChange={(e) => setPriceFigura(e.target.value)}
                            onBlur={() => mutation.mutate({ price_figura: Number(priceFigura) })}
                          />
                        </div>
                      </div>
                    )}
                    {(availableAs === 'chaveiro' || availableAs === 'ambos') && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Preço Chaveiro</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px] font-bold">R$</span>
                          <Input 
                            className="pl-8 h-9 text-sm" 
                            type="number" 
                            placeholder="0,00"
                            value={priceChaveiro}
                            onChange={(e) => setPriceChaveiro(e.target.value)}
                            onBlur={() => mutation.mutate({ price_chaveiro: Number(priceChaveiro) })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold flex-1 text-muted-foreground hover:text-primary">
                    <Calculator className="w-3 h-3 mr-1.5" />
                    Calcular preço
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="h-8 text-[11px] font-bold flex-1 bg-primary hover:bg-primary/90"
                    disabled={isPublishDisabled || mutation.isPending}
                  >
                    {mutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Rocket className="w-3 h-3 mr-1.5" />
                    )}
                    Publicar
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
};

// Mock Card component since I used it inside PieceCard
import { Card } from "@/components/ui/card";
