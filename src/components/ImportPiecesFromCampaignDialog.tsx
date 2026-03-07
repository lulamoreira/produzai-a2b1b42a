import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Copy, ImageIcon, Package } from "lucide-react";
import PieceThumbnail from "@/components/PieceThumbnail";
import { toast } from "sonner";
import type { CampaignPiece } from "@/hooks/useMultiClientData";

interface ImportPiecesFromCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  currentCampaignId: string;
  existingPieces: CampaignPiece[];
  existingKitCodes?: number[];
  onImport: (data: {
    pieces: Array<{
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
      _originalId?: string;
    }>;
    kits: Array<{
      name: string;
      code: number;
      image_url?: string | null;
      pieces: Array<{
        originalPieceId: string;
        quantity: number;
      }>;
    }>;
    storeQuantities?: Array<{
      originalPieceId: string;
      storeId: string;
      quantity: number;
    }>;
  }) => void;
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

type RemoteCampaign = { id: string; name: string };
type RemoteKit = { id: string; campaign_id: string; name: string; code: number; image_url: string | null };
type RemoteKitPiece = { id: string; kit_id: string; piece_id: string; quantity: number };

const ImportPiecesFromCampaignDialog = ({
  open,
  onOpenChange,
  clientId,
  currentCampaignId,
  existingPieces,
  existingKitCodes = [],
  onImport,
}: ImportPiecesFromCampaignDialogProps) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPieceIds, setSelectedPieceIds] = useState<Set<string>>(new Set());
  const [selectedKitIds, setSelectedKitIds] = useState<Set<string>>(new Set());
  const [keepPhotoMap, setKeepPhotoMap] = useState<Record<string, boolean>>({});
  const [keepKitPhotoMap, setKeepKitPhotoMap] = useState<Record<string, boolean>>({});

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

  // Fetch kits from selected campaign
  const { data: remoteKits = [] } = useQuery({
    queryKey: ["campaign_kits_for_import", selectedCampaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_kits")
        .select("*")
        .eq("campaign_id", selectedCampaignId)
        .order("code");
      if (error) throw error;
      return data as RemoteKit[];
    },
    enabled: !!selectedCampaignId,
  });

  // Fetch kit pieces for selected campaign kits
  const { data: remoteKitPieces = [] } = useQuery({
    queryKey: ["campaign_kit_pieces_for_import", selectedCampaignId, remoteKits.map(k => k.id).join(",")],
    queryFn: async () => {
      if (remoteKits.length === 0) return [];
      const kitIds = remoteKits.map(k => k.id);
      const { data, error } = await supabase
        .from("campaign_kit_pieces")
        .select("*")
        .in("kit_id", kitIds);
      if (error) throw error;
      return data as RemoteKitPiece[];
    },
    enabled: remoteKits.length > 0,
  });

  // Non-kit pieces for individual selection
  const nonKitPieces = useMemo(() => remotePieces.filter(p => !p.kit_only), [remotePieces]);

  const filteredPieces = useMemo(() => {
    if (!searchTerm) return nonKitPieces;
    const term = searchTerm.toLowerCase();
    return nonKitPieces.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        String(p.code).includes(term)
    );
  }, [nonKitPieces, searchTerm]);

  const filteredKits = useMemo(() => {
    if (!searchTerm) return remoteKits;
    const term = searchTerm.toLowerCase();
    return remoteKits.filter(k => k.name.toLowerCase().includes(term) || String(k.code).includes(term));
  }, [remoteKits, searchTerm]);

  const togglePiece = (pieceId: string) => {
    setSelectedPieceIds((prev) => {
      const next = new Set(prev);
      if (next.has(pieceId)) {
        next.delete(pieceId);
      } else {
        next.add(pieceId);
        if (!(pieceId in keepPhotoMap)) {
          setKeepPhotoMap((m) => ({ ...m, [pieceId]: true }));
        }
      }
      return next;
    });
  };

  const toggleKit = (kitId: string) => {
    setSelectedKitIds((prev) => {
      const next = new Set(prev);
      if (next.has(kitId)) {
        next.delete(kitId);
      } else {
        next.add(kitId);
        if (!(kitId in keepKitPhotoMap)) {
          setKeepKitPhotoMap((m) => ({ ...m, [kitId]: true }));
        }
        // Also default keep photo for kit's pieces
        const kitPieceIds = remoteKitPieces.filter(kp => kp.kit_id === kitId).map(kp => kp.piece_id);
        const kitPieces = remotePieces.filter(p => kitPieceIds.includes(p.id));
        kitPieces.forEach(p => {
          if (!(p.id in keepPhotoMap)) {
            setKeepPhotoMap(m => ({ ...m, [p.id]: true }));
          }
        });
      }
      return next;
    });
  };

  const toggleAllPieces = () => {
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

  const toggleAllKits = () => {
    if (selectedKitIds.size === filteredKits.length) {
      setSelectedKitIds(new Set());
    } else {
      const all = new Set(filteredKits.map(k => k.id));
      setSelectedKitIds(all);
      const newPhotoMap = { ...keepKitPhotoMap };
      const newPiecePhotoMap = { ...keepPhotoMap };
      filteredKits.forEach(k => {
        if (!(k.id in newPhotoMap)) newPhotoMap[k.id] = true;
        const kitPieceIds = remoteKitPieces.filter(kp => kp.kit_id === k.id).map(kp => kp.piece_id);
        remotePieces.filter(p => kitPieceIds.includes(p.id)).forEach(p => {
          if (!(p.id in newPiecePhotoMap)) newPiecePhotoMap[p.id] = true;
        });
      });
      setKeepKitPhotoMap(newPhotoMap);
      setKeepPhotoMap(newPiecePhotoMap);
    }
  };

  const toggleKeepPhoto = (pieceId: string) => {
    setKeepPhotoMap((prev) => ({ ...prev, [pieceId]: !prev[pieceId] }));
  };

  const toggleKeepKitPhoto = (kitId: string) => {
    setKeepKitPhotoMap((prev) => ({ ...prev, [kitId]: !prev[kitId] }));
  };

  const totalSelected = selectedPieceIds.size + selectedKitIds.size;

  const handleImport = () => {
    if (totalSelected === 0) return;

    // Calculate next available codes for pieces
    const usedCodes = new Set(existingPieces.map((p) => p.code));
    let nextCode = 1;
    const getNextCode = () => {
      while (usedCodes.has(nextCode)) nextCode++;
      usedCodes.add(nextCode);
      return nextCode;
    };

    // Pieces to import (non-kit)
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
        kit_only: false,
        image_url: keepPhotoMap[p.id] !== false ? p.image_url : null,
      }));

    // Kit pieces to import (kit_only pieces that belong to selected kits)
    const selectedKitPieceIds = new Set<string>();
    selectedKitIds.forEach(kitId => {
      remoteKitPieces.filter(kp => kp.kit_id === kitId).forEach(kp => {
        selectedKitPieceIds.add(kp.piece_id);
      });
    });

    const kitPiecesToImport = remotePieces
      .filter(p => selectedKitPieceIds.has(p.id))
      .map(p => ({
        campaign_id: currentCampaignId,
        code: getNextCode(),
        category: p.category,
        name: p.name,
        size: p.size,
        store_category: p.store_category || undefined,
        specification: p.specification,
        installation_instructions: p.installation_instructions,
        kit_only: true,
        image_url: keepPhotoMap[p.id] !== false ? p.image_url : null,
        _originalId: p.id,
      }));

    // Calculate next available kit codes
    const usedKitCodes = new Set(existingKitCodes);
    let nextKitCode = 1;
    const getNextKitCode = () => {
      while (usedKitCodes.has(nextKitCode)) nextKitCode++;
      usedKitCodes.add(nextKitCode);
      return nextKitCode;
    };

    // Kits to import
    const kitsToImport = remoteKits
      .filter(k => selectedKitIds.has(k.id))
      .map(k => ({
        name: k.name,
        code: getNextKitCode(),
        image_url: keepKitPhotoMap[k.id] !== false ? k.image_url : null,
        pieces: remoteKitPieces
          .filter(kp => kp.kit_id === k.id)
          .map(kp => ({
            originalPieceId: kp.piece_id,
            quantity: kp.quantity,
          })),
      }));

    // Combine non-kit pieces + kit pieces (keep _originalId for mapping)
    const allPieces = [...piecesToImport, ...kitPiecesToImport];

    onImport({
      pieces: allPieces,
      kits: kitsToImport,
    });

    // Reset state
    resetState();
    onOpenChange(false);
  };

  const resetState = () => {
    setSelectedCampaignId("");
    setSearchTerm("");
    setSelectedPieceIds(new Set());
    setSelectedKitIds(new Set());
    setKeepPhotoMap({});
    setKeepKitPhotoMap({});
  };

  const handleClose = (val: boolean) => {
    if (!val) resetState();
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5" /> Importar Peças e Kits de Outra Campanha
          </DialogTitle>
          <DialogDescription>
            Selecione uma campanha do mesmo cliente e escolha as peças e kits para importar.
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
                setSelectedKitIds(new Set());
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
                  placeholder="Buscar peça ou kit..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Items list */}
              <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
                {loadingPieces ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <>
                    {/* Kits section */}
                    {filteredKits.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <Package className="w-3 h-3" /> Kits ({filteredKits.length})
                          </span>
                          <div className="flex items-center gap-3">
                            <button onClick={toggleAllKits} className="text-xs text-primary hover:underline">
                              {selectedKitIds.size === filteredKits.length ? "Desmarcar todos" : "Selecionar todos"}
                            </button>
                            <span className="text-xs text-muted-foreground">{selectedKitIds.size} selecionado(s)</span>
                          </div>
                        </div>
                        {filteredKits.map((kit) => {
                          const isSelected = selectedKitIds.has(kit.id);
                          const keepPhoto = keepKitPhotoMap[kit.id] !== false;
                          const kitPieceCount = remoteKitPieces.filter(kp => kp.kit_id === kit.id).length;
                          return (
                            <div
                              key={kit.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"
                              }`}
                              onClick={() => toggleKit(kit.id)}
                            >
                              <Checkbox checked={isSelected} className="pointer-events-none" />
                              <PieceThumbnail imageUrl={kit.image_url} name={kit.name} size="sm" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate flex items-center gap-1">
                                  <Package className="w-3.5 h-3.5 text-primary" />
                                  {kit.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Cód. {kit.code} · {kitPieceCount} peça(s)
                                </p>
                              </div>
                              {isSelected && kit.image_url && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleKeepKitPhoto(kit.id); }}
                                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                                    keepPhoto ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"
                                  }`}
                                  title={keepPhoto ? "Foto será mantida" : "Foto não será copiada"}
                                >
                                  <ImageIcon className="w-3 h-3" />
                                  {keepPhoto ? "Com foto" : "Sem foto"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Pieces section */}
                    {filteredPieces.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Peças ({filteredPieces.length})
                          </span>
                          <div className="flex items-center gap-3">
                            <button onClick={toggleAllPieces} className="text-xs text-primary hover:underline">
                              {selectedPieceIds.size === filteredPieces.length ? "Desmarcar todas" : "Selecionar todas"}
                            </button>
                            <span className="text-xs text-muted-foreground">{selectedPieceIds.size} selecionada(s)</span>
                          </div>
                        </div>
                        {filteredPieces.map((piece) => {
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
                                </p>
                              </div>
                              {isSelected && piece.image_url && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleKeepPhoto(piece.id); }}
                                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                                    keepPhoto ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"
                                  }`}
                                  title={keepPhoto ? "Foto será mantida" : "Foto não será copiada"}
                                >
                                  <ImageIcon className="w-3 h-3" />
                                  {keepPhoto ? "Com foto" : "Sem foto"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {filteredPieces.length === 0 && filteredKits.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-8">
                        {remotePieces.length === 0 && remoteKits.length === 0
                          ? "Nenhuma peça ou kit nesta campanha."
                          : "Nenhum resultado encontrado."}
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button
            disabled={totalSelected === 0}
            onClick={handleImport}
            className="gap-1"
          >
            <Copy className="w-4 h-4" />
            Importar {totalSelected > 0 ? `(${totalSelected})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportPiecesFromCampaignDialog;
