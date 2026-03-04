import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Copy, ImageIcon } from "lucide-react";
import PieceThumbnail from "@/components/PieceThumbnail";
import { toast } from "sonner";
import type { CampaignPiece } from "@/hooks/useMultiClientData";

interface ImportPiecesFromCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  currentCampaignId: string;
  existingPieces: CampaignPiece[];
  onImport: (pieces: Array<{
    campaign_id: string;
    code: number;
    category: string;
    name: string;
    size: string;
    store_category?: string;
    specification: string;
    installation_instructions: string;
    kit_only: boolean;
    image_url?: string | null;
  }>) => void;
}

type RemotePiece = {
  id: string;
  code: number;
  category: string;
  name: string;
  size: string;
  store_category: string | null;
  specification: string;
  installation_instructions: string;
  kit_only: boolean;
  image_url: string | null;
  campaign_id: string;
};

type RemoteCampaign = {
  id: string;
  name: string;
};

const ImportPiecesFromCampaignDialog = ({
  open,
  onOpenChange,
  clientId,
  currentCampaignId,
  existingPieces,
  onImport,
}: ImportPiecesFromCampaignDialogProps) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPieceIds, setSelectedPieceIds] = useState<Set<string>>(new Set());
  const [keepPhotoMap, setKeepPhotoMap] = useState<Record<string, boolean>>({});

  // Fetch campaigns from same client (excluding current)
  const { data: campaigns = [] } = useQuery({
    queryKey: ["client_campaigns_for_import", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("client_id", clientId)
        .neq("id", currentCampaignId)
        .order("name");
      if (error) throw error;
      return data as RemoteCampaign[];
    },
    enabled: open && !!clientId,
  });

  // Fetch pieces from selected campaign
  const { data: remotePieces = [], isLoading: loadingPieces } = useQuery({
    queryKey: ["campaign_pieces_for_import", selectedCampaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_pieces")
        .select("*")
        .eq("campaign_id", selectedCampaignId)
        .order("code");
      if (error) throw error;
      return data as RemotePiece[];
    },
    enabled: !!selectedCampaignId,
  });

  const filteredPieces = useMemo(() => {
    if (!searchTerm) return remotePieces;
    const term = searchTerm.toLowerCase();
    return remotePieces.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        String(p.code).includes(term)
    );
  }, [remotePieces, searchTerm]);

  const togglePiece = (pieceId: string) => {
    setSelectedPieceIds((prev) => {
      const next = new Set(prev);
      if (next.has(pieceId)) {
        next.delete(pieceId);
      } else {
        next.add(pieceId);
        // Default keep photo to true
        if (!(pieceId in keepPhotoMap)) {
          setKeepPhotoMap((m) => ({ ...m, [pieceId]: true }));
        }
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedPieceIds.size === filteredPieces.length) {
      setSelectedPieceIds(new Set());
    } else {
      const all = new Set(filteredPieces.map((p) => p.id));
      setSelectedPieceIds(all);
      const newMap: Record<string, boolean> = { ...keepPhotoMap };
      filteredPieces.forEach((p) => {
        if (!(p.id in newMap)) newMap[p.id] = true;
      });
      setKeepPhotoMap(newMap);
    }
  };

  const toggleKeepPhoto = (pieceId: string) => {
    setKeepPhotoMap((prev) => ({ ...prev, [pieceId]: !prev[pieceId] }));
  };

  const handleImport = () => {
    if (selectedPieceIds.size === 0) return;

    // Calculate next available codes
    const usedCodes = new Set(existingPieces.map((p) => p.code));
    let nextCode = 1;
    const getNextCode = () => {
      while (usedCodes.has(nextCode)) nextCode++;
      usedCodes.add(nextCode);
      return nextCode;
    };

    const piecesToImport = remotePieces
      .filter((p) => selectedPieceIds.has(p.id))
      .map((p) => ({
        campaign_id: currentCampaignId,
        code: getNextCode(),
        category: p.category,
        name: p.name,
        size: p.size,
        store_category: p.store_category || undefined,
        specification: p.specification,
        installation_instructions: p.installation_instructions,
        kit_only: p.kit_only,
        image_url: keepPhotoMap[p.id] !== false ? p.image_url : null,
      }));

    onImport(piecesToImport);
    // Reset state
    setSelectedCampaignId("");
    setSearchTerm("");
    setSelectedPieceIds(new Set());
    setKeepPhotoMap({});
    onOpenChange(false);
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setSelectedCampaignId("");
      setSearchTerm("");
      setSelectedPieceIds(new Set());
      setKeepPhotoMap({});
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5" /> Importar Peças de Outra Campanha
          </DialogTitle>
          <DialogDescription>
            Selecione uma campanha do mesmo cliente e escolha as peças para importar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Campaign selector */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Campanha</label>
            <select
              value={selectedCampaignId}
              onChange={(e) => {
                setSelectedCampaignId(e.target.value);
                setSelectedPieceIds(new Set());
                setSearchTerm("");
              }}
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-card text-foreground"
            >
              <option value="">Selecione uma campanha...</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {selectedCampaignId && (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar peça..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Select all */}
              {filteredPieces.length > 0 && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={toggleAll}
                    className="text-xs text-primary hover:underline"
                  >
                    {selectedPieceIds.size === filteredPieces.length ? "Desmarcar todas" : "Selecionar todas"}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {selectedPieceIds.size} selecionada(s)
                  </span>
                </div>
              )}

              {/* Pieces list */}
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {loadingPieces ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : filteredPieces.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    {remotePieces.length === 0 ? "Nenhuma peça nesta campanha." : "Nenhuma peça encontrada."}
                  </p>
                ) : (
                  filteredPieces.map((piece) => {
                    const isSelected = selectedPieceIds.has(piece.id);
                    const keepPhoto = keepPhotoMap[piece.id] !== false;
                    return (
                      <div
                        key={piece.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"
                        }`}
                        onClick={() => togglePiece(piece.id)}
                      >
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        <PieceThumbnail imageUrl={piece.image_url} name={piece.name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{piece.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Cód. {piece.code} · {piece.category} · {piece.size}
                            {piece.kit_only && " · Kit"}
                          </p>
                        </div>
                        {isSelected && piece.image_url && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleKeepPhoto(piece.id);
                            }}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                              keepPhoto
                                ? "border-primary text-primary bg-primary/10"
                                : "border-border text-muted-foreground"
                            }`}
                            title={keepPhoto ? "Foto será mantida" : "Foto não será copiada"}
                          >
                            <ImageIcon className="w-3 h-3" />
                            {keepPhoto ? "Com foto" : "Sem foto"}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button
            disabled={selectedPieceIds.size === 0}
            onClick={handleImport}
            className="gap-1"
          >
            <Copy className="w-4 h-4" />
            Importar {selectedPieceIds.size > 0 ? `(${selectedPieceIds.size})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportPiecesFromCampaignDialog;
