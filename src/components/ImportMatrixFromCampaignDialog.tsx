import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Copy, Package, ArrowRight, Store, Loader2, X, Boxes } from "lucide-react";
import PieceThumbnail from "@/components/PieceThumbnail";
import { toast } from "sonner";
import type { CampaignPiece, ClientStore, CampaignKit } from "@/hooks/useMultiClientData";

interface ImportMatrixFromCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  currentCampaignId: string;
  currentPieces: CampaignPiece[];
  currentKits: CampaignKit[];
  currentStores: ClientStore[];
  onImport: (changes: { storeId: string; pieceId: string; quantity: number }[]) => Promise<void>;
}

type RemoteCampaign = { id: string; name: string };

/** Unified remote item (piece or kit) */
type RemoteItem = {
  id: string;
  name: string;
  code: number;
  size: string;
  image_url: string | null;
  type: "piece" | "kit";
  kitPieceCount?: number;
};

/** Maps remoteItemId -> { targetId, targetType } */
type ItemMapping = Record<string, { targetId: string; targetType: "piece" | "kit" }>;

const ImportMatrixFromCampaignDialog = ({
  open,
  onOpenChange,
  clientId,
  currentCampaignId,
  currentPieces,
  currentKits,
  currentStores,
  onImport,
}: ImportMatrixFromCampaignDialogProps) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [mapping, setMapping] = useState<ItemMapping>({});
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

  const { data: remoteKits = [] } = useQuery({
    queryKey: ["import-matrix-kits", selectedCampaignId],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_kits")
        .select("*")
        .eq("campaign_id", selectedCampaignId)
        .order("display_order");
      return (data || []) as CampaignKit[];
    },
    enabled: !!selectedCampaignId,
  });

  const { data: remoteKitPieceLinks = [] } = useQuery({
    queryKey: ["import-matrix-kit-piece-links", selectedCampaignId],
    queryFn: async () => {
      const kitIds = remoteKits.map((k) => k.id);
      if (kitIds.length === 0) return [];
      const { data } = await supabase
        .from("campaign_kit_pieces")
        .select("kit_id, piece_id, quantity")
        .in("kit_id", kitIds);
      return (data || []) as { kit_id: string; piece_id: string; quantity: number }[];
    },
    enabled: remoteKits.length > 0,
  });

  const { data: remoteStorePieces = [] } = useQuery({
    queryKey: ["import-matrix-store-pieces", selectedCampaignId],
    queryFn: async () => {
      return supabasePaginate<{ store_id: string; piece_id: string; quantity: number }>(
        (from, to) =>
          supabase
            .from("campaign_store_pieces")
            .select("store_id, piece_id, quantity")
            .eq("campaign_id", selectedCampaignId)
            .range(from, to) as any
      );
    },
    enabled: !!selectedCampaignId,
  });

  // Build unified list of remote items (standalone pieces + kit pieces + kits)
  const remoteItemsWithStats = useMemo(() => {
    const currentStoreIds = new Set(currentStores.map((s) => s.id));
    const kitPieceIds = new Set(remoteKitPieceLinks.map((kp) => kp.piece_id));

    const items: Array<{
      item: RemoteItem;
      storeQtys: { storeId: string; quantity: number }[];
      totalQty: number;
      storeCount: number;
    }> = [];

    // Standalone pieces (not linked to any kit via campaign_kit_pieces)
    remotePieces
      .filter((p) => !kitPieceIds.has(p.id))
      .forEach((p) => {
        const storeQtys = remoteStorePieces
          .filter((sp) => sp.piece_id === p.id && sp.quantity > 0 && currentStoreIds.has(sp.store_id))
          .map((sp) => ({ storeId: sp.store_id, quantity: sp.quantity }));
        items.push({
          item: { id: p.id, name: p.name, code: p.code, size: p.size, image_url: p.image_url, type: "piece" },
          storeQtys,
          totalQty: storeQtys.reduce((s, q) => s + q.quantity, 0),
          storeCount: storeQtys.length,
        });
      });

    // Kits (quantities derived from their member pieces)
    remoteKits.forEach((kit) => {
      const memberLinks = remoteKitPieceLinks.filter((kp) => kp.kit_id === kit.id);
      // Kit quantity per store = min(floor(piece_qty / kit_qty)) across all member pieces
      // But for import purposes, we show combined piece quantities
      const kitPieceStoreQtys = new Map<string, number>();
      memberLinks.forEach((link) => {
        remoteStorePieces
          .filter((sp) => sp.piece_id === link.piece_id && sp.quantity > 0 && currentStoreIds.has(sp.store_id))
          .forEach((sp) => {
            kitPieceStoreQtys.set(sp.store_id, (kitPieceStoreQtys.get(sp.store_id) || 0) + sp.quantity);
          });
      });
      const storeQtys = Array.from(kitPieceStoreQtys.entries()).map(([storeId, quantity]) => ({ storeId, quantity }));
      items.push({
        item: {
          id: `kit-${kit.id}`, name: `KIT ${kit.name}`, code: kit.code, size: "", image_url: kit.image_url,
          type: "kit", kitPieceCount: memberLinks.length,
        },
        storeQtys,
        totalQty: storeQtys.reduce((s, q) => s + q.quantity, 0),
        storeCount: storeQtys.length,
      });
    });

    // Kit pieces (shown indented under kits)
    remoteKits.forEach((kit) => {
      const memberLinks = remoteKitPieceLinks.filter((kp) => kp.kit_id === kit.id);
      memberLinks.forEach((link) => {
        const piece = remotePieces.find((p) => p.id === link.piece_id);
        if (!piece) return;
        const storeQtys = remoteStorePieces
          .filter((sp) => sp.piece_id === piece.id && sp.quantity > 0 && currentStoreIds.has(sp.store_id))
          .map((sp) => ({ storeId: sp.store_id, quantity: sp.quantity }));
        items.push({
          item: { id: `kitpiece-${kit.id}-${piece.id}`, name: piece.name, code: piece.code, size: piece.size, image_url: piece.image_url, type: "piece" },
          storeQtys,
          totalQty: storeQtys.reduce((s, q) => s + q.quantity, 0),
          storeCount: storeQtys.length,
        });
      });
    });

    return items;
  }, [remotePieces, remoteKits, remoteKitPieceLinks, remoteStorePieces, currentStores]);

  // Build current target options (pieces + kits)
  const currentTargetOptions = useMemo(() => {
    const options: { id: string; label: string; code: number; type: "piece" | "kit" }[] = [];
    currentPieces.forEach((p) => options.push({ id: p.id, label: p.name, code: p.code, type: "piece" }));
    currentKits.forEach((k) => options.push({ id: k.id, label: `KIT ${k.name}`, code: k.code, type: "kit" }));
    return options.sort((a, b) => a.code - b.code);
  }, [currentPieces, currentKits]);

  const usedTargetIds = useMemo(() => new Set(Object.values(mapping).map((m) => m.targetId)), [mapping]);
  const mappedCount = Object.keys(mapping).length;

  const setMappingForItem = (remoteItemId: string, targetValue: string | null) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (targetValue) {
        const target = currentTargetOptions.find((o) => o.id === targetValue);
        if (target) next[remoteItemId] = { targetId: target.id, targetType: target.type };
      } else {
        delete next[remoteItemId];
      }
      return next;
    });
  };

  // Resolve actual piece ID from remote item ID
  const getRemotePieceId = (itemId: string): string | null => {
    if (itemId.startsWith("kitpiece-")) {
      // kitpiece-{kitId}-{pieceId}
      const parts = itemId.split("-");
      return parts[parts.length - 1] || null;
    }
    if (itemId.startsWith("kit-")) return null; // kit itself, not a piece
    return itemId; // standalone piece
  };

  const handleImport = async () => {
    const currentStoreIds = new Set(currentStores.map((s) => s.id));
    const changes: { storeId: string; pieceId: string; quantity: number }[] = [];

    for (const [remoteItemId, target] of Object.entries(mapping)) {
      // For kits mapped to kits: we don't import quantities directly (kit qtys are derived)
      // For pieces mapped to pieces: import store quantities
      const remotePieceId = getRemotePieceId(remoteItemId);
      if (!remotePieceId || target.targetType === "kit") continue;

      const storeQtys = remoteStorePieces.filter(
        (sp) => sp.piece_id === remotePieceId && sp.quantity > 0 && currentStoreIds.has(sp.store_id)
      );
      for (const sq of storeQtys) {
        changes.push({ storeId: sq.store_id, pieceId: target.targetId, quantity: sq.quantity });
      }
    }

    if (changes.length === 0) {
      toast.info("Nenhuma quantidade encontrada para importar.");
      return;
    }

    setImporting(true);
    try {
      await onImport(changes);
      toast.success(`${changes.length} quantidade(s) importada(s) de ${mappedCount} item(ns)!`);
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
            Selecione a campanha de origem e associe cada peça/kit à correspondente na campanha atual.
          </DialogDescription>
        </DialogHeader>

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

        {selectedCampaignId && (
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {remoteItemsWithStats.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma peça encontrada na campanha selecionada.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground py-1">
                  {remoteItemsWithStats.length} item(ns) na campanha de origem · {mappedCount} associado(s)
                </p>

                {remoteItemsWithStats.map(({ item, totalQty, storeCount }) => {
                  const currentMappedTarget = mapping[item.id];
                  const isKit = item.type === "kit";
                  const isKitPiece = item.id.startsWith("kitpiece-");

                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        currentMappedTarget
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      } ${isKit ? "bg-[#1e3a5f]/5 border-[#1e3a5f]/30" : ""} ${isKitPiece ? "ml-6 border-l-2 border-l-[#1e3a5f]/30" : ""}`}
                    >
                      <PieceThumbnail imageUrl={item.image_url} name={item.name} size="sm" />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div>
                          <p className="text-sm font-medium truncate flex items-center gap-1.5">
                            {isKit && <Boxes className="w-3.5 h-3.5 text-[#1e3a5f] shrink-0" />}
                            {item.name}
                            {isKit && (
                              <span className="text-[9px] font-bold bg-[#1e3a5f] text-white px-1.5 py-0.5 rounded uppercase">Kit</span>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Código: {item.code}{item.size ? ` · ${item.size}` : ""}
                            {isKit && item.kitPieceCount ? ` · ${item.kitPieceCount} peça(s)` : ""}
                          </p>
                          {storeCount > 0 && (
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Store className="w-3 h-3" /> {storeCount} loja(s)
                              </span>
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                                {totalQty} un.
                              </span>
                            </div>
                          )}
                          {storeCount === 0 && (
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">Sem quantidades nas lojas atuais</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <Select
                            value={currentMappedTarget?.targetId || ""}
                            onValueChange={(v) => setMappingForItem(item.id, v || null)}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue placeholder={isKit ? "Associar ao kit atual..." : "Associar à peça atual..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {currentTargetOptions.map((opt) => (
                                <SelectItem
                                  key={opt.id}
                                  value={opt.id}
                                  disabled={usedTargetIds.has(opt.id) && currentMappedTarget?.targetId !== opt.id}
                                >
                                  <span className="flex items-center gap-1.5">
                                    {opt.type === "kit" && <Boxes className="w-3 h-3 text-[#1e3a5f]" />}
                                    <span className="text-muted-foreground text-[10px]">{opt.code}</span>
                                    <span>{opt.label}</span>
                                    {opt.type === "kit" && (
                                      <span className="text-[8px] font-bold bg-[#1e3a5f] text-white px-1 py-0.5 rounded">KIT</span>
                                    )}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {currentMappedTarget && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setMappingForItem(item.id, null)}>
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

        {selectedCampaignId && remoteItemsWithStats.length > 0 && (
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => handleClose(false)} disabled={importing}>Cancelar</Button>
            <Button size="sm" onClick={handleImport} disabled={importing || mappedCount === 0} className="gap-1.5">
              {importing ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importando...</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> Importar {mappedCount} item(ns)</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportMatrixFromCampaignDialog;
