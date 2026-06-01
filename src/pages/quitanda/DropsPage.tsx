import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuitandaLayout } from "@/layouts/QuitandaLayout";
import { NewDropDialog } from "@/components/quitanda/NewDropDialog";
import { DropCard } from "@/components/quitanda/DropCard";
import { PieceCard } from "@/components/quitanda/PieceCard";
import { Package, Loader2, Search } from "lucide-react";
import { Q3DDrop, Q3DPiece } from "@/types/quitanda";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const DropsPage = () => {
  const [selectedDropId, setSelectedDropId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: drops = [], isLoading: isLoadingDrops } = useQuery({
    queryKey: ["q3d_drops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("q3d_drops")
        .select(`
          *,
          pieces:q3d_pieces(id, status)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: pieces = [], isLoading: isLoadingPieces } = useQuery({
    queryKey: ["q3d_pieces", selectedDropId],
    enabled: !!selectedDropId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("q3d_pieces")
        .select("*")
        .eq("drop_id", selectedDropId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Q3DPiece[];
    },
  });

  const filteredDrops = drops.filter(drop => 
    drop.drop_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedDrop = drops.find(d => d.id === selectedDropId);

  return (
    <div className="h-full flex flex-col">
      {/* Mobile Header with Tabs */}
      <div className="md:hidden p-4 border-b bg-white sticky top-0 z-30">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-display font-bold">Drops</h1>
          <NewDropDialog />
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Drops List Section */}
        <section className={cn(
          "w-full md:w-1/2 flex flex-col border-r bg-white",
          "md:h-[calc(100vh)]" // Adjust based on sidebar
        )}>
          <div className="p-4 md:p-6 space-y-4 border-b bg-[#FAFAFA]/50">
            <div className="hidden md:flex items-center justify-between">
              <h1 className="text-2xl font-display font-bold">Drops</h1>
              <NewDropDialog />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar drops..." 
                className="pl-9 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {isLoadingDrops ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-[180px] w-full rounded-[16px]" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))
            ) : filteredDrops.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Package className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                <p className="text-muted-foreground font-medium">Nenhum drop encontrado.</p>
              </div>
            ) : (
              filteredDrops.map((drop) => (
                <DropCard 
                  key={drop.id} 
                  drop={drop} 
                  isSelected={selectedDropId === drop.id}
                  onClick={() => setSelectedDropId(drop.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* Pieces Section */}
        <section className={cn(
          "w-full md:w-1/2 flex flex-col bg-[#FAFAFA]",
          "md:h-[calc(100vh)]"
        )}>
          {selectedDrop ? (
            <>
              <div className="p-4 md:p-6 border-b bg-white">
                <h2 className="text-xl font-display font-bold">{selectedDrop.drop_name}</h2>
                <p className="text-sm text-muted-foreground">{pieces.length} peças neste drop</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {isLoadingPieces ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-[12px]" />
                  ))
                ) : (
                  pieces.map((piece) => (
                    <PieceCard key={piece.id} piece={piece} />
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
                <Package className="w-10 h-10 text-muted-foreground opacity-30" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Selecione um drop</h3>
              <p className="text-muted-foreground max-w-[280px]">
                Escolha um drop na lista ao lado para gerenciar suas peças.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default DropsPage;
