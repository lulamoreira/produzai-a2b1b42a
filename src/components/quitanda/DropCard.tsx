import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Q3DDrop } from "@/types/quitanda";

interface DropCardProps {
  drop: any; // Using any because of the joined pieces for status calculation
  isSelected: boolean;
  onClick: () => void;
}

export const DropCard = ({ drop, isSelected, onClick }: DropCardProps) => {
  const piecesCount = drop.pieces?.length || 0;
  const publishedCount = drop.pieces?.filter((p: any) => p.status === 'publicado').length || 0;
  
  let status: 'Novo' | 'Parcial' | 'Completo' = 'Novo';
  let badgeVariant: 'secondary' | 'warning' | 'success' = 'secondary';

  if (publishedCount === 0) {
    status = 'Novo';
    badgeVariant = 'secondary';
  } else if (publishedCount < piecesCount) {
    status = 'Parcial';
    badgeVariant = 'warning';
  } else if (publishedCount === piecesCount && piecesCount > 0) {
    status = 'Completo';
    badgeVariant = 'success';
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left bg-white rounded-[16px] border transition-all duration-200 overflow-hidden group hover:shadow-md",
        isSelected ? "border-primary ring-1 ring-primary" : "border-[#E5E7EB]"
      )}
    >
      <div className="aspect-video relative overflow-hidden">
        {drop.drop_image_url ? (
          <img 
            src={drop.drop_image_url} 
            alt={drop.drop_name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span className="text-muted-foreground/30 font-bold text-xl uppercase tracking-widest">Quitanda</span>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <Badge variant={badgeVariant === 'secondary' ? 'outline' : 'default'} className={cn(
            "font-semibold",
            badgeVariant === 'warning' && "bg-orange-500 hover:bg-orange-600 text-white border-none",
            badgeVariant === 'success' && "bg-green-500 hover:bg-green-600 text-white border-none"
          )}>
            {status}
          </Badge>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-display font-semibold text-lg text-foreground mb-1 group-hover:text-primary transition-colors">
          {drop.drop_name}
        </h3>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{format(new Date(drop.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
          <span className="font-medium text-foreground">{piecesCount} peças</span>
        </div>
      </div>
    </button>
  );
};
