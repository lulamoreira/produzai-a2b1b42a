import { useState } from "react";
import {
  type Store,
  type Piece,
  useStorePieces,
  useUpdateQuantity,
  useAddPieceToStore,
  useRemovePieceFromStore,
  useDeletePiece,
} from "@/hooks/useStoreData";
import PieceImageUpload from "@/components/PieceImageUpload";
import ChangeLogPanel from "@/components/ChangeLogPanel";
import { exportSingleStore } from "@/lib/exportExcel";
import {
  Package,
  MapPin,
  Layers,
  Tag,
  Edit3,
  Check,
  X,
  Plus,
  Minus,
  Trash2,
  Clock,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StoreDetailProps {
  store: Store;
  pieces: Piece[];
  allStorePieces?: { store_id: number; piece_id: number; quantity: number; id: number }[];
  isAdmin?: boolean;
}

const StoreDetail = ({ store, pieces, allStorePieces, isAdmin = false }: StoreDetailProps) => {
  const { data: storePieces = [], isLoading } = useStorePieces(store.id);
  const updateQuantity = useUpdateQuantity();
  const addPieceToStore = useAddPieceToStore();
  const removePieceFromStore = useRemovePieceFromStore();

  const [editingPiece, setEditingPiece] = useState<number | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [showLog, setShowLog] = useState(false);
  const [addPieceOpen, setAddPieceOpen] = useState(false);
  const [addPieceId, setAddPieceId] = useState<string>("");
  const [addPieceQty, setAddPieceQty] = useState<number>(1);

  // Group pieces by category
  const piecesWithQty = storePieces
    .map((sp) => ({
      piece: pieces.find((p) => p.id === sp.piece_id)!,
      qty: sp.quantity,
    }))
    .filter((item) => item.piece);

  const totalPieces = piecesWithQty.reduce((sum, { qty }) => sum + qty, 0);

  const grouped = piecesWithQty.reduce<
    Record<string, { piece: Piece; qty: number }[]>
  >((acc, item) => {
    const cat = item.piece.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // Pieces not yet in this store
  const availablePieces = pieces.filter(
    (p) => !storePieces.some((sp) => sp.piece_id === p.id)
  );

  const handleStartEdit = (pieceId: number, currentQty: number) => {
    setEditingPiece(pieceId);
    setEditQty(currentQty);
  };

  const handleConfirmEdit = async (pieceId: number, oldQty: number) => {
    if (editQty === oldQty) {
      setEditingPiece(null);
      return;
    }
    await updateQuantity.mutateAsync({
      storeId: store.id,
      pieceId,
      oldQty,
      newQty: editQty,
      description: `Quantidade alterada de ${oldQty} para ${editQty}`,
    });
    setEditingPiece(null);
  };

  const handleAddPiece = async () => {
    if (!addPieceId || addPieceQty < 1) return;
    await addPieceToStore.mutateAsync({
      storeId: store.id,
      pieceId: Number(addPieceId),
      quantity: addPieceQty,
    });
    setAddPieceId("");
    setAddPieceQty(1);
    setAddPieceOpen(false);
  };

  const handleRemovePiece = async (pieceId: number, oldQty: number) => {
    await removePieceFromStore.mutateAsync({
      storeId: store.id,
      pieceId,
      oldQty,
    });
  };

  const handleExport = () => {
    const sps = allStorePieces || storePieces;
    exportSingleStore(store, pieces, sps);
  };

  const categoryColors: Record<string, string> = {
    CUBOS: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
    SHELFTALKS: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
    DISPLAY: "from-sky-500/20 to-sky-500/5 border-sky-500/30",
    EXPOSITOR: "from-violet-500/20 to-violet-500/5 border-violet-500/30",
    "STANDARD P": "from-rose-500/20 to-rose-500/5 border-rose-500/30",
    "STANDARD G": "from-orange-500/20 to-orange-500/5 border-orange-500/30",
    "STANDARD GG": "from-red-500/20 to-red-500/5 border-red-500/30",
    PAREDES: "from-teal-500/20 to-teal-500/5 border-teal-500/30",
    PROMOTABLE: "from-pink-500/20 to-pink-500/5 border-pink-500/30",
    EXTRAS: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/30",
    WALLBAY: "from-indigo-500/20 to-indigo-500/5 border-indigo-500/30",
    "PICK&MIX": "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30",
    GONDOLA: "from-lime-500/20 to-lime-500/5 border-lime-500/30",
    QUIOSQUE: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/30",
  };

  const categoryBadge: Record<string, string> = {
    CUBOS: "bg-amber-500/15 text-amber-700",
    SHELFTALKS: "bg-emerald-500/15 text-emerald-700",
    DISPLAY: "bg-sky-500/15 text-sky-700",
    EXPOSITOR: "bg-violet-500/15 text-violet-700",
    "STANDARD P": "bg-rose-500/15 text-rose-700",
    "STANDARD G": "bg-orange-500/15 text-orange-700",
    "STANDARD GG": "bg-red-500/15 text-red-700",
    PAREDES: "bg-teal-500/15 text-teal-700",
    PROMOTABLE: "bg-pink-500/15 text-pink-700",
    EXTRAS: "bg-yellow-500/15 text-yellow-700",
    WALLBAY: "bg-indigo-500/15 text-indigo-700",
    "PICK&MIX": "bg-cyan-500/15 text-cyan-700",
    GONDOLA: "bg-lime-500/15 text-lime-700",
    QUIOSQUE: "bg-fuchsia-500/15 text-fuchsia-700",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <MapPin className="w-4 h-4" />
            <span>{store.uf}</span>
            <span>·</span>
            <span>Loja Nº {store.number}</span>
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground">
            {store.name}
          </h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" /> Excel
          </Button>
          <Button
            size="sm"
            variant={showLog ? "default" : "outline"}
            onClick={() => setShowLog(!showLog)}
          >
            <Clock className="w-4 h-4 mr-1" /> Log
            {showLog ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoCard icon={<Layers className="w-4 h-4" />} label="Tipo" value={store.type} />
        <InfoCard icon={<Tag className="w-4 h-4" />} label="Modelo" value={store.model} />
        <InfoCard icon={<Package className="w-4 h-4" />} label="Total Peças" value={String(totalPieces)} highlight />
        <InfoCard icon={<Layers className="w-4 h-4" />} label="Categorias" value={String(Object.keys(grouped).length)} />
      </div>

      {/* Mod info */}
      <div className="flex gap-3 flex-wrap">
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20">
          Primário: {store.primary_mod}
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
          Secundário: {store.secondary_mod}
        </span>
      </div>

      {/* Change Log Panel */}
      {showLog && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Histórico de Alterações
          </h3>
          <ChangeLogPanel storeId={store.id} pieces={pieces} />
        </div>
      )}

      {/* Add piece button - admin only */}
      {isAdmin && (
        <div className="flex justify-end">
          <Dialog open={addPieceOpen} onOpenChange={setAddPieceOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                <Plus className="w-4 h-4 mr-1" /> Adicionar Peça
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Adicionar Peça à Loja</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Peça</label>
                  <Select value={addPieceId} onValueChange={setAddPieceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar peça..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePieces.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} ({p.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Quantidade</label>
                  <Input
                    type="number"
                    min={1}
                    value={addPieceQty}
                    onChange={(e) => setAddPieceQty(Number(e.target.value))}
                  />
                </div>
                <Button
                  onClick={handleAddPiece}
                  disabled={!addPieceId || addPieceQty < 1 || addPieceToStore.isPending}
                  className="w-full"
                >
                  <Check className="w-4 h-4 mr-1" /> Confirmar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Pieces by category */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([category, items]) => (
          <div
            key={category}
            className={`rounded-xl border overflow-hidden bg-gradient-to-b ${categoryColors[category] || "from-muted/30 to-muted/5 border-border"}`}
          >
            <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${categoryBadge[category] || "bg-muted text-muted-foreground"}`}>
                  {category}
                </span>
              </h3>
              <span className="text-xs text-muted-foreground font-medium">
                {items.reduce((s, i) => s + i.qty, 0)} peça(s)
              </span>
            </div>
            <div className="divide-y divide-border/30">
              {items.map(({ piece, qty }) => (
                <div
                  key={piece.id}
                  className="px-4 py-3 flex items-center gap-3 hover:bg-card/50 transition-colors"
                >
                  <PieceImageUpload piece={piece} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {piece.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{piece.size}</p>
                    <p className="text-xs text-muted-foreground truncate" title={piece.specification}>
                      📋 {piece.specification}
                    </p>
                    <p className="text-xs text-muted-foreground truncate" title={piece.installation_instructions}>
                      🔧 {piece.installation_instructions}
                    </p>
                  </div>

                  {editingPiece === piece.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditQty(Math.max(0, editQty - 1))}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <Input
                        type="number"
                        min={0}
                        value={editQty}
                        onChange={(e) => setEditQty(Number(e.target.value))}
                        className="w-16 h-7 text-center text-sm"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditQty(editQty + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="default"
                        className="h-7 w-7 bg-secondary hover:bg-secondary/90"
                        onClick={() => handleConfirmEdit(piece.id, qty)}
                        disabled={updateQuantity.isPending}
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditingPiece(null)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${categoryBadge[category] || "bg-muted text-foreground"}`}>
                        {qty}
                      </span>
                      {isAdmin && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:opacity-100"
                            onClick={() => handleStartEdit(piece.id, qty)}
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 hover:opacity-100"
                            onClick={() => handleRemovePiece(piece.id, qty)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {piecesWithQty.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma peça atribuída a esta loja</p>
          </div>
        )}
      </div>
    </div>
  );
};

const InfoCard = ({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) => (
  <div
    className={`rounded-xl border p-3 ${
      highlight
        ? "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20"
        : "bg-card border-border"
    }`}
  >
    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
      {icon}
      <span className="text-xs">{label}</span>
    </div>
    <p className={`font-bold text-lg ${highlight ? "text-primary" : "text-foreground"}`}>
      {value}
    </p>
  </div>
);

export default StoreDetail;
