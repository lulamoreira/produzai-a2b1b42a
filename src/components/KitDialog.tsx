import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, X, Trash2, Package } from "lucide-react";
import PieceThumbnail from "@/components/PieceThumbnail";
import type { CampaignPiece, CampaignKit, CampaignKitPiece } from "@/hooks/useMultiClientData";

interface CreateKitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  kitOnlyPieces: CampaignPiece[];
  existingKits: CampaignKit[];
  onCreateKit: (kit: { campaign_id: string; name: string; code: number }) => Promise<CampaignKit>;
  onAddKitPiece: (kitPiece: { kit_id: string; piece_id: string }) => Promise<void>;
}

export function CreateKitDialog({
  open, onOpenChange, campaignId, kitOnlyPieces, existingKits, onCreateKit, onAddKitPiece,
}: CreateKitDialogProps) {
  const [step, setStep] = useState<"name" | "pieces">("name");
  const [kitName, setKitName] = useState("");
  const [createdKitId, setCreatedKitId] = useState<string | null>(null);
  const [selectedPieceIds, setSelectedPieceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const nextCode = useMemo(() => {
    const maxCode = existingKits.reduce((max, k) => Math.max(max, k.code), 0);
    return maxCode + 1;
  }, [existingKits]);

  const handleCreateKit = async () => {
    if (!kitName.trim()) return;
    setSaving(true);
    try {
      const kit = await onCreateKit({ campaign_id: campaignId, name: kitName.trim(), code: nextCode });
      setCreatedKitId(kit.id);
      setStep("pieces");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPiece = async (pieceId: string) => {
    if (!createdKitId) return;
    await onAddKitPiece({ kit_id: createdKitId, piece_id: pieceId });
    setSelectedPieceIds(prev => [...prev, pieceId]);
  };

  const handleClose = () => {
    setStep("name");
    setKitName("");
    setCreatedKitId(null);
    setSelectedPieceIds([]);
    onOpenChange(false);
  };

  const availablePieces = kitOnlyPieces.filter(p => !selectedPieceIds.includes(p.id));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{step === "name" ? "Novo Kit" : `Kit: ${kitName}`}</DialogTitle>
          <DialogDescription>
            {step === "name"
              ? "Dê um nome ao kit de peças."
              : "Selecione as peças que compõem este kit."}
          </DialogDescription>
        </DialogHeader>

        {step === "name" ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome do Kit *</label>
              <Input
                value={kitName}
                onChange={(e) => setKitName(e.target.value)}
                placeholder="Ex: Kit Vitrine"
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateKit(); }}
                autoFocus
              />
            </div>
            <Button onClick={handleCreateKit} disabled={!kitName.trim() || saving} className="w-full">
              {saving ? "Criando..." : "Avançar"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedPieceIds.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Peças incluídas</label>
                {selectedPieceIds.map(pid => {
                  const piece = kitOnlyPieces.find(p => p.id === pid);
                  if (!piece) return null;
                  return (
                    <div key={pid} className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/20">
                      <PieceThumbnail imageUrl={piece.image_url} name={piece.name} size="sm" />
                      <span className="text-xs font-bold text-primary">#{piece.code}</span>
                      <span className="text-sm flex-1 truncate">{piece.name}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {availablePieces.length > 0 ? (
              <div className="space-y-1 max-h-[250px] overflow-y-auto">
                <label className="text-xs font-medium text-muted-foreground">Peças disponíveis para kit</label>
                {availablePieces.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-md border border-border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <PieceThumbnail imageUrl={p.image_url} name={p.name} size="sm" />
                      <span className="text-xs font-bold text-primary">#{p.code}</span>
                      <span className="text-sm truncate">{p.name}</span>
                    </div>
                    <Button size="sm" variant="outline" className="text-xs gap-1 ml-2" onClick={() => handleAddPiece(p.id)}>
                      <Plus className="w-3 h-3" /> Incluir
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {kitOnlyPieces.length === 0
                  ? "Nenhuma peça marcada como 'para kit'. Crie peças com essa opção ativada primeiro."
                  : "Todas as peças para kit já foram incluídas."}
              </p>
            )}

            <Button onClick={handleClose} className="w-full">
              Salvar e Sair
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface KitDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kit: CampaignKit | null;
  kitPieces: CampaignKitPiece[];
  allPieces: CampaignPiece[];
  canEdit?: boolean;
  onDeleteKitPiece?: (id: string) => void;
  onDeleteKit?: (id: string) => void;
}

export function KitDetailDialog({
  open, onOpenChange, kit, kitPieces, allPieces, canEdit, onDeleteKitPiece, onDeleteKit,
}: KitDetailDialogProps) {
  if (!kit) return null;

  const piecesInKit = kitPieces
    .filter(kp => kp.kit_id === kit.id)
    .map(kp => ({ ...kp, piece: allPieces.find(p => p.id === kp.piece_id) }))
    .filter(kp => kp.piece);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Kit: {kit.name}
          </DialogTitle>
          <DialogDescription>{piecesInKit.length} peça(s) neste kit</DialogDescription>
        </DialogHeader>

        {piecesInKit.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma peça neste kit.</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {piecesInKit.map(kp => {
              const p = kp.piece!;
              return (
                <div key={kp.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-muted/30">
                  <PieceThumbnail imageUrl={p.image_url} name={p.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary">#{p.code}</span>
                      <span className="font-medium text-sm truncate">{p.name}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{p.category} · {p.size || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{p.specification}</p>
                  </div>
                  {canEdit && onDeleteKitPiece && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => onDeleteKitPiece(kp.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {canEdit && onDeleteKit && (
          <div className="pt-2 border-t border-border">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full text-xs gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Excluir Kit
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir kit "{kit.name}"?</AlertDialogTitle>
                  <AlertDialogDescription>O kit será removido. As peças que o compõem continuarão existindo.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { onDeleteKit(kit.id); onOpenChange(false); }}>
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
