import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { GripVertical, Edit3, Trash2, CheckSquare, Package } from "lucide-react";
import PieceThumbnail from "@/components/PieceThumbnail";
import CampaignPieceImageUpload from "@/components/CampaignPieceImageUpload";
import type { CampaignPiece, ClientStore } from "@/hooks/useMultiClientData";

interface SortablePieceRowProps {
  piece: CampaignPiece;
  pieceTotal: number;
  canEditPieces: boolean;
  canDeletePieces: boolean;
  isDragging?: boolean;
  onEdit: (piece: CampaignPiece) => void;
  onDelete: (id: string) => void;
  onDistribute: (piece: CampaignPiece) => void;
  onMarkKitOnly: (piece: CampaignPiece) => void;
  isDistributed: boolean;
  qtyMap: Record<string, number>;
  stores: ClientStore[];
}

function SortablePieceRow({
  piece, pieceTotal, canEditPieces, canDeletePieces,
  onEdit, onDelete, onDistribute, onMarkKitOnly, isDistributed,
}: SortablePieceRowProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: piece.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      {canEditPieces && (
        <TableCell className="w-8 p-1">
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground">
            <GripVertical className="w-4 h-4" />
          </button>
        </TableCell>
      )}
      <TableCell>
        <div className="flex items-center gap-2">
          <PieceThumbnail imageUrl={piece.image_url} name={piece.name} />
          <span className="font-bold text-primary">{piece.code}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{piece.category}</TableCell>
      <TableCell>
        <button
          className="font-medium text-left hover:text-primary hover:underline transition-colors"
          onClick={() => onEdit(piece)}
        >
          {piece.name}
        </button>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{piece.size || "—"}</TableCell>
      <TableCell>
        {piece.store_category ? (
          <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded">{piece.store_category}</span>
        ) : "—"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{piece.specification}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{piece.installation_instructions}</TableCell>
      <TableCell className="text-center font-semibold">{pieceTotal}</TableCell>
      {(canEditPieces || canDeletePieces) && (
        <TableCell>
          <div className="flex items-center gap-1">
            {canEditPieces && (
              <CampaignPieceImageUpload piece={piece} canEdit={canEditPieces} />
            )}
            {canEditPieces && (
              <Button variant="ghost" size="icon" className="h-7 w-7"
                title={isDistributed ? "Remover de todas as lojas" : "Distribuir para lojas compatíveis"}
                onClick={() => onDistribute(piece)}
              >
                <CheckSquare className={`w-3.5 h-3.5 ${isDistributed ? "text-primary" : "text-muted-foreground"}`} />
              </Button>
            )}
            {canEditPieces && (
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Marcar como peça para kit"
                onClick={() => onMarkKitOnly(piece)}
              >
                <Package className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            )}
            {canEditPieces && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(piece)}>
                <Edit3 className="w-3.5 h-3.5" />
              </Button>
            )}
            {canDeletePieces && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir peça?</AlertDialogTitle>
                    <AlertDialogDescription>A peça será removida de todas as lojas desta campanha.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(piece.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

interface SortablePiecesTableProps {
  pieces: CampaignPiece[];
  stores: ClientStore[];
  qtyMap: Record<string, number>;
  canEditPieces: boolean;
  canDeletePieces: boolean;
  onEdit: (piece: CampaignPiece) => void;
  onDelete: (id: string) => void;
  onDistribute: (piece: CampaignPiece) => void;
  onMarkKitOnly: (piece: CampaignPiece) => void;
  onReorder: (pieces: CampaignPiece[]) => void;
}

export default function SortablePiecesTable({
  pieces, stores, qtyMap, canEditPieces, canDeletePieces,
  onEdit, onDelete, onDistribute, onMarkKitOnly, onReorder,
}: SortablePiecesTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const pieceIds = useMemo(() => pieces.map(p => p.id), [pieces]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pieces.findIndex(p => p.id === active.id);
    const newIndex = pieces.findIndex(p => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...pieces];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    onReorder(reordered);
  };

  const getIsDistributed = (piece: CampaignPiece) => {
    const autoStores = stores.filter(s => s.auto_distribute);
    const targetStores = piece.store_category === "Todas" || !piece.store_category
      ? autoStores
      : autoStores.filter(s => s.store_model === piece.store_category);
    return targetStores.some(s => qtyMap[`${s.id}-${piece.id}`]);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <Table>
          <TableHeader>
            <TableRow>
              {canEditPieces && <TableHead className="w-8" />}
              <TableHead className="w-[80px]">Código</TableHead>
              <TableHead>Localização na Loja</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Medidas</TableHead>
              <TableHead>Modelo de Loja</TableHead>
              <TableHead>Especificação</TableHead>
              <TableHead>Instruções de Instalação</TableHead>
              <TableHead className="text-center">Total distribuído</TableHead>
              {(canEditPieces || canDeletePieces) && <TableHead className="w-[80px]">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <SortableContext items={pieceIds} strategy={verticalListSortingStrategy}>
            <TableBody>
              {pieces.map((p) => {
                const pieceTotal = stores.reduce((s, st) => s + (qtyMap[`${st.id}-${p.id}`] || 0), 0);
                return (
                  <SortablePieceRow
                    key={p.id}
                    piece={p}
                    pieceTotal={pieceTotal}
                    canEditPieces={canEditPieces}
                    canDeletePieces={canDeletePieces}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onDistribute={onDistribute}
                    onMarkKitOnly={onMarkKitOnly}
                    isDistributed={getIsDistributed(p)}
                    qtyMap={qtyMap}
                    stores={stores}
                  />
                );
              })}
            </TableBody>
          </SortableContext>
        </Table>
      </DndContext>
    </div>
  );
}
