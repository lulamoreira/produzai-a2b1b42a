import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Copy, Package, ArrowRight, Store, Loader2 } from "lucide-react";
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
  const [selectedPieceIds, setSelectedPieceIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  // Fetch other campaigns for this client
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

  // Fetch pieces from the selected campaign
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

  // Fetch store pieces from the selected campaign
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

  // Match remote pieces to current pieces by name (case-insensitive)
  const matchedPieces = useMemo(() => {
    if (!selectedCampaignId || remotePieces.length === 0) return [];

    const currentStoreIds = new Set(currentStores.map((s) => s.id));

    return remotePieces
      .map((rp) => {
        // Find matching current piece by name
        const matchedCurrent = currentPieces.find(
          (cp) => cp.name.trim().toLowerCase() === rp.name.trim().toLowerCase()
        );
        if (!matchedCurrent) return null;

        // Get store quantities for this remote piece, filtered to current stores
        const storeQtys = remoteStorePieces
          .filter((sp) => sp.piece_id === rp.id && sp.quantity > 0 && currentStoreIds.has(sp.store_id))
          .map((sp) => ({ storeId: sp.store_id, quantity: sp.quantity }));

        if (storeQtys.length === 0) return null;

        return {
          remotePiece: rp,
          currentPiece: matchedCurrent,
          storeQtys,
          totalQty: storeQtys.reduce((s, q) => s + q.quantity, 0),
          storeCount: storeQtys.length,
        };
      })
      .filter(Boolean) as {
      remotePiece: CampaignPiece;
      currentPiece: CampaignPiece;
      storeQtys: { storeId: string; quantity: number }[];
      totalQty: number;
      storeCount: number;
    }[];
  }, [remotePieces, remoteStorePieces, currentPieces, currentStores, selectedCampaignId]);

  const togglePiece = (pieceId: string) => {
    setSelectedPieceIds((prev) => {
      const next = new Set(prev);
      if (next.has(pieceId)) next.delete(pieceId);
      else next.add(pieceId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedPieceIds.size === matchedPieces.length) {
      setSelectedPieceIds(new Set());
    } else {
      setSelectedPieceIds(new Set(matchedPieces.map((m) => m.remotePiece.id)));
    }
  };

  const handleImport = async () => {
    const changes: { storeId: string; pieceId: string; quantity: number }[] = [];

    matchedPieces.forEach((match) => {
      if (!selectedPieceIds.has(match.remotePiece.id)) return;
      match.storeQtys.forEach((sq) => {
        changes.push({
          storeId: sq.storeId,
          pieceId: match.currentPiece.id,
          quantity: sq.quantity,
        });
      });
    });

    if (changes.length === 0) {
      toast.info("Nenhuma alteração para importar.");
      return;
    }

    setImporting(true);
    try {
      await onImport(changes);
      toast.success(`${changes.length} quantidade(s) importada(s) de ${selectedPieceIds.size} peça(s)!`);
      onOpenChange(false);
      setSelectedCampaignId("");
      setSelectedPieceIds(new Set());
    } catch {
      toast.error("Erro ao importar quantidades.");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setSelectedCampaignId("");
      setSelectedPieceIds(new Set());
    }
    onOpenChange(v);
  };

  const selectedCampaignName = campaigns.find((c) => c.id === selectedCampaignId)?.name;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-primary" />
            Importar Quantidades de Outra Campanha
          </DialogTitle>
          <DialogDescription>
            Importe as quantidades por loja de peças com o mesmo nome em campanhas anteriores.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select campaign */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Campanha de origem</label>
          <Select value={selectedCampaignId} onValueChange={(v) => { setSelectedCampaignId(v); setSelectedPieceIds(new Set()); }}>
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

        {/* Step 2: Show matched pieces */}
        {selectedCampaignId && (
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {matchedPieces.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma peça com nome correspondente encontrada na campanha "{selectedCampaignName}".
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between py-1">
                  <p className="text-xs text-muted-foreground">
                    {matchedPieces.length} peça(s) correspondente(s) encontrada(s)
                  </p>
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={toggleAll}>
                    {selectedPieceIds.size === matchedPieces.length ? "Desmarcar todas" : "Selecionar todas"}
                  </Button>
                </div>

                {matchedPieces.map((match) => (
                  <label
                    key={match.remotePiece.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedPieceIds.has(match.remotePiece.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={selectedPieceIds.has(match.remotePiece.id)}
                      onCheckedChange={() => togglePiece(match.remotePiece.id)}
                      className="mt-1"
                    />
                    <PieceThumbnail
                      imageUrl={match.remotePiece.image_url}
                      name={match.remotePiece.name}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{match.remotePiece.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Código: {match.remotePiece.code} · {match.remotePiece.size}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Store className="w-3 h-3" /> {match.storeCount} loja(s)
                        </span>
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                          {match.totalQty} peça(s)
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-primary truncate max-w-[100px]">
                        {match.currentPiece.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Cód. {match.currentPiece.code}</p>
                    </div>
                  </label>
                ))}
              </>
            )}
          </div>
        )}

        {/* Actions */}
        {selectedCampaignId && matchedPieces.length > 0 && (
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => handleClose(false)} disabled={importing}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={importing || selectedPieceIds.size === 0}
              className="gap-1.5"
            >
              {importing ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importando...</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> Importar {selectedPieceIds.size} peça(s)</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportMatrixFromCampaignDialog;
