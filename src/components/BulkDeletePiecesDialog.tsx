import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Trash2, X } from "lucide-react";
import PieceThumbnail from "@/components/PieceThumbnail";
import type { CampaignPiece } from "@/hooks/useMultiClientData";

interface BulkDeletePiecesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pieces: CampaignPiece[];
  onDeletePieces: (ids: string[]) => Promise<void>;
}

export default function BulkDeletePiecesDialog({
  open, onOpenChange, pieces, onDeletePieces,
}: BulkDeletePiecesDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return pieces;
    const q = search.toLowerCase();
    return pieces.filter(p =>
      p.name.toLowerCase().includes(q) ||
      String(p.code).includes(q) ||
      (p.category || "").toLowerCase().includes(q)
    );
  }, [pieces, search]);

  const toggleAll = () => {
    if (filtered.every(p => selected.has(p.id))) {
      const next = new Set(selected);
      filtered.forEach(p => next.delete(p.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach(p => next.add(p.id));
      setSelected(next);
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDeletePieces(Array.from(selected));
      setSelected(new Set());
      setSearch("");
      setConfirmOpen(false);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    setSelected(new Set());
    setSearch("");
    onOpenChange(false);
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Excluir peças em lote
            </DialogTitle>
            <DialogDescription>
              Selecione as peças que deseja excluir desta campanha. As peças originais em outras campanhas não serão afetadas.
            </DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar peça por nome, código ou localização..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Selection info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{selected.size} peça(s) selecionada(s) de {pieces.length}</span>
            {selected.size > 0 && (
              <button onClick={() => setSelected(new Set())} className="text-primary hover:underline">
                Limpar seleção
              </button>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto border border-border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-16">Cód.</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Modelo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {search ? "Nenhuma peça encontrada." : "Nenhuma peça na campanha."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(p => (
                    <TableRow
                      key={p.id}
                      className={selected.has(p.id) ? "bg-destructive/5" : ""}
                      onClick={() => toggle(p.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selected.has(p.id)}
                          onCheckedChange={() => toggle(p.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <PieceThumbnail imageUrl={p.image_url} name={p.name} size="sm" />
                      </TableCell>
                      <TableCell className="text-xs font-bold text-primary">#{p.code}</TableCell>
                      <TableCell className="text-sm">{p.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.category || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.store_category || "Todas"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={handleClose}>Cancelar</Button>
            <Button
              variant="destructive"
              className="flex-1 gap-1"
              disabled={selected.size === 0}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
              Excluir {selected.size} peça(s)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selected.size} peça(s)</strong> desta campanha?
              Esta ação não pode ser desfeita. As peças originais em outras campanhas não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? "Excluindo..." : "SIM, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
