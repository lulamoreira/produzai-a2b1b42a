import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Copy, Package, ArrowRight, Store, Loader2, X } from "lucide-react";
import PieceThumbnail from "@/components/PieceThumbnail";
import { toast } from "sonner";
import type { CampaignPiece, ClientStore } from "@/hooks/useMultiClientData";

interface ImportMatrixFromCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  currentCampaignId: string;
  currentPieces: CampaignPiece[];
  currentStores: ClientStore[];
  onImport: (changes: { storeId: string; pieceId: string; quantity: number }[]) => Promise<void>;
}

type RemoteCampaign = { id: string; name: string };

/** Maps remotePieceId -> currentPieceId */
type PieceMapping = Record<string, string>;

const ImportMatrixFromCampaignDialog = ({
  open,
  onOpenChange,
  clientId,
  currentCampaignId,
  currentPieces,
  currentStores,
  onImport,
}: ImportMatrixFromCampaignDialogProps) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [mapping, setMapping] = useState<PieceMapping>({});
  const [importing, setImporting] = useState(false);

  const { data: campaigns = [] } = useQuery<RemoteCampaign[]>({
    queryKey: ["import-matrix-campaigns", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("client_id", clientId)
        .neq("id", currentCampaignId)
        .order("created_at", { ascending: false });
      return (data || []) as RemoteCampaign[];
    },
    enabled: open && !!clientId,
  });

  const { data: remotePieces = [] } = useQuery<CampaignPiece[]>({
    queryKey: ["import-matrix-pieces", selectedCampaignId],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_pieces")
        .select("*")
        .eq("campaign_id", selectedCampaignId)
        .order("display_order");
      return (data || []) as CampaignPiece[];
    },
    enabled: !!selectedCampaignId,
  });

  const { data: remoteStorePieces = [] } = useQuery({
    queryKey: ["import-matrix-store-pieces", selectedCampaignId],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_store_pieces")
        .select("store_id, piece_id, quantity")
        .eq("campaign_id", selectedCampaignId);
      return (data || []) as { store_id: string; piece_id: string; quantity: number }[];
    },
    enabled: !!selectedCampaignId,
  });

  // For each remote piece, compute store quantities (filtered to current stores)
  const remotePiecesWithStats = useMemo(() => {
    const currentStoreIds = new Set(currentStores.map((s) => s.id));
    return remotePieces.map((rp) => {
      const storeQtys = remoteStorePieces
        .filter((sp) => sp.piece_id === rp.id && sp.quantity > 0 && currentStoreIds.has(sp.store_id))
        .map((sp) => ({ storeId: sp.store_id, quantity: sp.quantity }));
      return {
        piece: rp,
        storeQtys,
        totalQty: storeQtys.reduce((s, q) => s + q.quantity, 0),
        storeCount: storeQtys.length,
      };
    });
  }, [remotePieces, remoteStorePieces, currentStores]);

  // Track which current pieces are already mapped (to prevent duplicates)
  const usedCurrentPieceIds = useMemo(() => new Set(Object.values(mapping)), [mapping]);

  const mappedCount = Object.keys(mapping).length;

  const setMappingForPiece = (remotePieceId: string, currentPieceId: string | null) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (currentPieceId) {
        next[remotePieceId] = currentPieceId;
      } else {
        delete next[remotePieceId];
      }
      return next;
    });
  };

  const handleImport = async () => {
    const currentStoreIds = new Set(currentStores.map((s) => s.id));
    const changes: { storeId: string; pieceId: string; quantity: number }[] = [];

    for (const [remotePieceId, currentPieceId] of Object.entries(mapping)) {
      const storeQtys = remoteStorePieces.filter(
        (sp) => sp.piece_id === remotePieceId && sp.quantity > 0 && currentStoreIds.has(sp.store_id)
      );
      for (const sq of storeQtys) {
        changes.push({ storeId: sq.store_id, pieceId: currentPieceId, quantity: sq.quantity });
      }
    }

    if (changes.length === 0) {
      toast.info("Nenhuma quantidade encontrada para importar.");
      return;
    }

    setImporting(true);
    try {
      await onImport(changes);
      toast.success(`${changes.length} quantidade(s) importada(s) de ${mappedCount} peça(s)!`);
      onOpenChange(false);
      setSelectedCampaignId("");
      setMapping({});
    } catch {
      toast.error("Erro ao importar quantidades.");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setSelectedCampaignId("");
      setMapping({});
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-primary" />
            Importar Quantidades de Outra Campanha
          </DialogTitle>
          <DialogDescription>
            Selecione a campanha de origem e associe cada peça à peça correspondente na campanha atual.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select campaign */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Campanha de origem</label>
          <Select value={selectedCampaignId} onValueChange={(v) => { setSelectedCampaignId(v); setMapping({}); }}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma campanha..." />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Step 2: Show remote pieces with mapping selectors */}
        {selectedCampaignId && (
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {remotePiecesWithStats.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma peça encontrada na campanha selecionada.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground py-1">
                  {remotePiecesWithStats.length} peça(s) na campanha de origem · {mappedCount} associada(s)
                </p>

                {remotePiecesWithStats.map(({ piece, storeQtys, totalQty, storeCount }) => {
                  const currentMappedId = mapping[piece.id];
                  const hasData = storeCount > 0;

                  return (
                    <div
                      key={piece.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        currentMappedId
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      }`}
                    >
                      <PieceThumbnail imageUrl={piece.image_url} name={piece.name} size="sm" />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div>
                          <p className="text-sm font-medium truncate">{piece.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Código: {piece.code} · {piece.size}
                          </p>
                          {hasData && (
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Store className="w-3 h-3" /> {storeCount} loja(s)
                              </span>
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                                {totalQty} peça(s)
                              </span>
                            </div>
                          )}
                          {!hasData && (
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                              Sem quantidades nas lojas atuais
                            </p>
                          )}
                        </div>

                        {/* Mapping selector */}
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <Select
                            value={currentMappedId || ""}
                            onValueChange={(v) => setMappingForPiece(piece.id, v || null)}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue placeholder="Associar a peça atual..." />
                            </SelectTrigger>
                            <SelectContent>
                              {currentPieces.map((cp) => (
                                <SelectItem
                                  key={cp.id}
                                  value={cp.id}
                                  disabled={usedCurrentPieceIds.has(cp.id) && mapping[piece.id] !== cp.id}
                                >
                                  <span className="flex items-center gap-1.5">
                                    <span className="text-muted-foreground text-[10px]">{cp.code}</span>
                                    <span>{cp.name}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {currentMappedId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => setMappingForPiece(piece.id, null)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Actions */}
        {selectedCampaignId && remotePiecesWithStats.length > 0 && (
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => handleClose(false)} disabled={importing}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={importing || mappedCount === 0}
              className="gap-1.5"
            >
              {importing ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importando...</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> Importar {mappedCount} peça(s)</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportMatrixFromCampaignDialog;
