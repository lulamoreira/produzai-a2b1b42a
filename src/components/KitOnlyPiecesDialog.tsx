import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Package, Search, Eye, Undo2, AlertTriangle } from "lucide-react";
import PieceThumbnail from "@/components/PieceThumbnail";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pieces: any[];
  kits: any[];
  kitPieces: any[];
  canEdit: boolean;
  canDelete: boolean;
  onEditPiece: (piece: any) => void;
  updatePiece: any;
  deletePiece: any;
  deleteKitPiece: any;
}

export default function KitOnlyPiecesDialog({
  open, onOpenChange, pieces, kits, kitPieces,
  canEdit, canDelete, onEditPiece, updatePiece, deletePiece, deleteKitPiece,
}: Props) {
  const [search, setSearch] = useState("");
  const [pieceToDelete, setPieceToDelete] = useState<any | null>(null);
  const [pieceToUnflag, setPieceToUnflag] = useState<any | null>(null);

  const kitOnlyPieces = useMemo(
    () => pieces.filter((p) => p.kit_only),
    [pieces]
  );

  const kitsByPieceId = useMemo(() => {
    const map = new Map<string, any[]>();
    kitPieces.forEach((kp) => {
      const kit = kits.find((k) => k.id === kp.kit_id && !k.is_deleted);
      if (!kit) return;
      const arr = map.get(kp.piece_id) ?? [];
      arr.push({ ...kit, kitPieceId: kp.id });
      map.set(kp.piece_id, arr);
    });
    return map;
  }, [kits, kitPieces]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return kitOnlyPieces;
    return kitOnlyPieces.filter((p) => {
      const usedIn = kitsByPieceId.get(p.id) ?? [];
      const hay = [
        p.name ?? "",
        p.code ?? "",
        p.size ?? "",
        ...usedIn.map((k: any) => k.name ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [kitOnlyPieces, search, kitsByPieceId]);

  const orphan = useMemo(
    () => kitOnlyPieces.filter((p) => !(kitsByPieceId.get(p.id) ?? []).length).length,
    [kitOnlyPieces, kitsByPieceId]
  );

  const handleDelete = async () => {
    if (!pieceToDelete) return;
    const used = kitsByPieceId.get(pieceToDelete.id) ?? [];
    try {
      // Remove vínculos com kits primeiro (cascade-safe)
      for (const k of used) {
        await deleteKitPiece?.mutateAsync?.(k.kitPieceId);
      }
      await deletePiece?.mutateAsync?.(pieceToDelete.id);
      toast.success("Peça excluída.");
    } catch (e: any) {
      toast.error("Erro ao excluir: " + (e?.message ?? e));
    } finally {
      setPieceToDelete(null);
    }
  };

  const handleUnflag = async () => {
    if (!pieceToUnflag) return;
    try {
      await updatePiece?.mutateAsync?.({ id: pieceToUnflag.id, kit_only: false });
      toast.success("Peça liberada — agora aparece na lista principal.");
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? e));
    } finally {
      setPieceToUnflag(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Peças de Kits
            </DialogTitle>
            <DialogDescription>
              Visualize, edite ou exclua peças marcadas como "kit only" — elas ficam ocultas na
              listagem principal e aparecem apenas dentro de kits.{" "}
              {kitOnlyPieces.length > 0 && (
                <>
                  Total: <strong>{kitOnlyPieces.length}</strong>
                  {orphan > 0 && (
                    <>
                      {" "}· <span className="text-amber-600 dark:text-amber-400">{orphan} órfã{orphan === 1 ? "" : "s"}</span> (não vinculada a nenhum kit)
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, código, medida ou kit..."
              className="pl-9"
            />
          </div>

          <div className="overflow-y-auto max-h-[60vh] -mx-6 px-6">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">
                  {kitOnlyPieces.length === 0
                    ? "Nenhuma peça marcada como peça de kit."
                    : "Nenhuma peça encontrada com esse filtro."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((p) => {
                  const usedIn = kitsByPieceId.get(p.id) ?? [];
                  const isOrphan = usedIn.length === 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-start gap-3 py-3"
                    >
                      <PieceThumbnail imageUrl={p.image_url} name={p.name} size="md" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {p.code != null && (
                            <span className="text-xs font-mono text-muted-foreground">
                              #{p.code}
                            </span>
                          )}
                          <span className="text-sm font-medium truncate">{p.name}</span>
                          {p.size && (
                            <span className="text-xs text-muted-foreground">
                              · {p.size}
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {isOrphan ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              Não está em nenhum kit
                            </Badge>
                          ) : (
                            usedIn.map((k: any) => (
                              <Badge
                                key={k.kitPieceId}
                                variant="secondary"
                                className="text-[10px] gap-1"
                              >
                                <Package className="w-3 h-3" />
                                {k.name}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title="Editar peça"
                            onClick={() => onEditPiece(p)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title='Remover marcação "kit only" (volta para lista principal)'
                            onClick={() => setPieceToUnflag(p)}
                          >
                            <Undo2 className="w-4 h-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            title="Excluir peça permanentemente"
                            onClick={() => setPieceToDelete(p)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!pieceToDelete} onOpenChange={(o) => !o && setPieceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Excluir peça permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  A peça <strong>{pieceToDelete?.name}</strong> será excluída desta campanha.
                </p>
                {(() => {
                  const used = pieceToDelete ? (kitsByPieceId.get(pieceToDelete.id) ?? []) : [];
                  if (used.length === 0) return null;
                  return (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-300 text-sm">
                      <div className="flex items-center gap-1.5 font-medium mb-1">
                        <AlertTriangle className="w-4 h-4" />
                        Atenção — esta peça está em {used.length} kit{used.length === 1 ? "" : "s"}:
                      </div>
                      <ul className="list-disc list-inside">
                        {used.map((k: any) => (
                          <li key={k.kitPieceId}>{k.name}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs opacity-80">
                        Ela será removida também desses kits. Esta ação não pode ser desfeita.
                      </p>
                    </div>
                  );
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de "remover kit only" */}
      <AlertDialog open={!!pieceToUnflag} onOpenChange={(o) => !o && setPieceToUnflag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar peça para lista principal?</AlertDialogTitle>
            <AlertDialogDescription>
              A peça <strong>{pieceToUnflag?.name}</strong> deixará de ser "kit only" e voltará a
              aparecer na listagem principal de peças. Os vínculos com kits existentes serão
              mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnflag}>Liberar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
