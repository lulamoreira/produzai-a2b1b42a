import { useMemo } from "react";
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
import { GripVertical, Edit3, Trash2, CheckSquare, Package, Palette } from "lucide-react";
import PieceThumbnail from "@/components/PieceThumbnail";
import CampaignPieceImageUpload from "@/components/CampaignPieceImageUpload";
import type { CampaignPiece, ClientStore, CampaignKit, CampaignKitPiece } from "@/hooks/useMultiClientData";

// Unified row type
export type UnifiedRow = 
  | { type: "piece"; data: CampaignPiece }
  | { type: "kit"; data: CampaignKit; kitPieces: CampaignKitPiece[]; allPieces: CampaignPiece[] };

interface SortableRowProps {
  row: UnifiedRow;
  pieceTotal: number;
  canEditPieces: boolean;
  canDeletePieces: boolean;
  onEdit: (piece: CampaignPiece) => void;
  onDelete: (id: string) => void;
  onDistribute: (piece: CampaignPiece) => void;
  onMarkKitOnly: (piece: CampaignPiece) => void;
  onToggleMockup: (piece: CampaignPiece) => void;
  onKitClick: (kit: CampaignKit) => void;
  onDeleteKit: (id: string) => void;
  isDistributed: boolean;
  qtyMap: Record<string, number>;
  stores: ClientStore[];
  kitCategory: string;
}

function SortableRow({
  row, pieceTotal, canEditPieces, canDeletePieces,
  onEdit, onDelete, onDistribute, onMarkKitOnly, onToggleMockup, onKitClick, onDeleteKit,
  isDistributed, kitCategory,
}: SortableRowProps) {
  const id = row.type === "piece" ? row.data.id : `kit-${row.data.id}`;
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (row.type === "kit") {
    const kit = row.data;
    const kitPieceDetails = row.kitPieces.map(kp => row.allPieces.find(p => p.id === kp.piece_id)).filter(Boolean);
    return (
      <TableRow ref={setNodeRef} style={style} className="bg-primary/5 hover:bg-primary/10">
        {canEditPieces && (
          <TableCell className="w-8 p-1">
            <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground">
              <GripVertical className="w-4 h-4" />
            </button>
          </TableCell>
        )}
        <TableCell>
          <div className="flex items-center gap-2">
            {kit.image_url ? (
              <img src={kit.image_url} alt={kit.name} className="w-8 h-8 rounded-lg object-cover border border-primary/20" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Package className="w-4 h-4 text-primary" />
              </div>
            )}
            <span className="font-bold text-primary">{kit.code}</span>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">{kitCategory || "—"}</TableCell>
        <TableCell>
          <button
            className="font-medium text-left hover:text-primary hover:underline transition-colors"
            onClick={() => onKitClick(kit)}
          >
            <span className="flex items-center gap-1.5">
              {kit.name}
              <span className="text-[10px] bg-primary/20 text-primary font-bold px-1.5 py-0.5 rounded">KIT</span>
              {kit.is_mockup && <span className="text-[10px] bg-amber-500/20 text-amber-700 font-bold px-1.5 py-0.5 rounded">MOCKUP</span>}
            </span>
            <span className="text-[11px] text-muted-foreground block">
              {kitPieceDetails.length} peça(s): {kitPieceDetails.map(p => p!.name).join(", ") || "Nenhuma"}
            </span>
          </button>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">—</TableCell>
        <TableCell>—</TableCell>
        <TableCell className="text-sm text-muted-foreground">—</TableCell>
        <TableCell className="text-sm text-muted-foreground">—</TableCell>
        <TableCell className="text-center font-semibold">{pieceTotal}</TableCell>
        {(canEditPieces || canDeletePieces) && (
          <TableCell>
            <div className="flex items-center gap-1">
              {canEditPieces && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onKitClick(kit)}>
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
                      <AlertDialogTitle>Excluir kit?</AlertDialogTitle>
                      <AlertDialogDescription>O kit será removido. As peças componentes poderão ser mantidas ou excluídas.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDeleteKit(kit.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
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

  // Regular piece row
  const piece = row.data;
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
          <span className="flex items-center gap-1.5">
            {piece.name}
            {piece.is_mockup && <span className="text-[10px] bg-amber-500/20 text-amber-700 font-bold px-1.5 py-0.5 rounded">MOCKUP</span>}
          </span>
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
              <Button variant="ghost" size="icon" className="h-7 w-7"
                title={piece.is_mockup ? "Remover marcação de mockup" : "Marcar como mockup"}
                onClick={() => onToggleMockup(piece)}
              >
                <Palette className={`w-3.5 h-3.5 ${piece.is_mockup ? "text-amber-600" : "text-muted-foreground"}`} />
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
  kits: CampaignKit[];
  kitPieces: CampaignKitPiece[];
  allPieces: CampaignPiece[]; // includes kit_only pieces for kit detail display
  stores: ClientStore[];
  qtyMap: Record<string, number>;
  canEditPieces: boolean;
  canDeletePieces: boolean;
  onEdit: (piece: CampaignPiece) => void;
  onDelete: (id: string) => void;
  onDistribute: (piece: CampaignPiece) => void;
  onMarkKitOnly: (piece: CampaignPiece) => void;
  onToggleMockup: (piece: CampaignPiece) => void;
  onKitClick: (kit: CampaignKit) => void;
  onDeleteKit: (id: string) => void;
  onReorder: (rows: UnifiedRow[]) => void;
}

export default function SortablePiecesTable({
  pieces, kits, kitPieces: kitPiecesList, allPieces, stores, qtyMap,
  canEditPieces, canDeletePieces,
  onEdit, onDelete, onDistribute, onMarkKitOnly, onToggleMockup, onKitClick, onDeleteKit, onReorder,
}: SortablePiecesTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Build unified sorted list
  const unifiedRows = useMemo<UnifiedRow[]>(() => {
    const rows: (UnifiedRow & { display_order: number })[] = [
      ...pieces.map(p => ({ type: "piece" as const, data: p, display_order: p.display_order })),
      ...kits.map(k => ({
        type: "kit" as const,
        data: k,
        kitPieces: kitPiecesList.filter(kp => kp.kit_id === k.id),
        allPieces,
        display_order: k.display_order,
      })),
    ];
    rows.sort((a, b) => a.display_order - b.display_order);
    return rows;
  }, [pieces, kits, kitPiecesList, allPieces]);

  const rowIds = useMemo(() => unifiedRows.map(r => r.type === "piece" ? r.data.id : `kit-${r.data.id}`), [unifiedRows]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rowIds.indexOf(String(active.id));
    const newIndex = rowIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...unifiedRows];
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

  const getKitTotal = (kit: CampaignKit) => {
    const kpForKit = kitPiecesList.filter(kp => kp.kit_id === kit.id);
    if (kpForKit.length === 0) return 0;
    return stores.reduce((total, store) => {
      const minQty = Math.min(...kpForKit.map(kp => {
        const storeQty = qtyMap[`${store.id}-${kp.piece_id}`] || 0;
        return Math.floor(storeQty / (kp.quantity || 1));
      }));
      return total + (minQty === Infinity ? 0 : minQty);
    }, 0);
  };

  const getKitCategory = (kit: CampaignKit) => {
    const kpForKit = kitPiecesList.filter(kp => kp.kit_id === kit.id);
    if (kpForKit.length === 0) return "";
    const firstPiece = allPieces.find(p => p.id === kpForKit[0].piece_id);
    return firstPiece?.category || "";
  };

  return (
    <div className="border border-border rounded-lg overflow-x-auto">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <Table className="min-w-[900px]">
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
          <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
            <TableBody>
              {unifiedRows.map((row) => {
                const id = row.type === "piece" ? row.data.id : `kit-${row.data.id}`;
                const pieceTotal = row.type === "piece"
                  ? stores.reduce((s, st) => s + (qtyMap[`${st.id}-${row.data.id}`] || 0), 0)
                  : getKitTotal(row.data);
                return (
                  <SortableRow
                    key={id}
                    row={row}
                    pieceTotal={pieceTotal}
                    canEditPieces={canEditPieces}
                    canDeletePieces={canDeletePieces}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onDistribute={onDistribute}
                    onMarkKitOnly={onMarkKitOnly}
                    onToggleMockup={onToggleMockup}
                    onKitClick={onKitClick}
                    onDeleteKit={onDeleteKit}
                    isDistributed={row.type === "piece" ? getIsDistributed(row.data) : false}
                    qtyMap={qtyMap}
                    stores={stores}
                    kitCategory={row.type === "kit" ? getKitCategory(row.data) : ""}
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
