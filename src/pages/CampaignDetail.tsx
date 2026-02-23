import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useCampaign, useClient, useClientStores, useCampaignPieces, useCampaignStorePieces,
  useAddCampaignPiece, useDeleteCampaignPiece, useUpdateCampaignPiece, useUpdateCampaignStorePiece,
  type CampaignPiece, type ClientStore,
} from "@/hooks/useMultiClientData";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, Search, Package, Edit3 } from "lucide-react";
import { toast } from "sonner";

const CampaignDetail = () => {
  const { clientId, campaignId } = useParams<{ clientId: string; campaignId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { data: client } = useClient(clientId);
  const { data: campaign, isLoading: loadingCampaign } = useCampaign(campaignId);
  const { data: stores = [] } = useClientStores(clientId);
  const { data: pieces = [], isLoading: loadingPieces } = useCampaignPieces(campaignId);
  const { data: storePieces = [] } = useCampaignStorePieces(campaignId);
  const addPiece = useAddCampaignPiece();
  const deletePiece = useDeleteCampaignPiece();
  const updatePiece = useUpdateCampaignPiece();
  const updateStorePiece = useUpdateCampaignStorePiece();

  const [pieceDialogOpen, setPieceDialogOpen] = useState(false);
  const [pieceForm, setPieceForm] = useState({
    code: "", category: "", name: "",
    width: "", length: "", height: "",
    store_category: typeof window !== "undefined" ? localStorage.getItem("last_store_category") || "" : "",
  });
  const [storeSearch, setStoreSearch] = useState("");
  const [editingCell, setEditingCell] = useState<{ storeId: string; pieceId: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Edit piece
  const [editPieceDialogOpen, setEditPieceDialogOpen] = useState(false);
  const [editPieceForm, setEditPieceForm] = useState({
    id: "", code: "", category: "", name: "",
    width: "", length: "", height: "",
    store_category: "",
  });

  const handleOpenEditPiece = (piece: CampaignPiece) => {
    const sizeParts = piece.size?.split(" x ") || [];
    setEditPieceForm({
      id: piece.id,
      code: String(piece.code),
      category: piece.category,
      name: piece.name,
      width: sizeParts[0] || "",
      length: sizeParts[1] || "",
      height: sizeParts[2] || "",
      store_category: piece.store_category || "",
    });
    setEditPieceDialogOpen(true);
  };

  const handleEditPiece = async (e: React.FormEvent) => {
    e.preventDefault();
    const size = [editPieceForm.width, editPieceForm.length, editPieceForm.height].filter(Boolean).join(" x ");
    await updatePiece.mutateAsync({
      id: editPieceForm.id,
      code: parseInt(editPieceForm.code),
      category: editPieceForm.category,
      name: editPieceForm.name,
      size,
      store_category: editPieceForm.store_category || null,
    });
    setEditPieceDialogOpen(false);
  };

  // Build quantity map: { `${storeId}-${pieceId}`: quantity }
  const qtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    storePieces.forEach((sp) => {
      map[`${sp.store_id}-${sp.piece_id}`] = sp.quantity;
    });
    return map;
  }, [storePieces]);

  const filteredStores = stores.filter((s) =>
    s.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
    s.nickname?.toLowerCase().includes(storeSearch.toLowerCase())
  );

  const handleAddPiece = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId) return;
    const size = [pieceForm.width, pieceForm.length, pieceForm.height].filter(Boolean).join(" x ");
    if (pieceForm.store_category) {
      localStorage.setItem("last_store_category", pieceForm.store_category);
    }
    await addPiece.mutateAsync({
      campaign_id: campaignId,
      code: parseInt(pieceForm.code),
      category: pieceForm.category,
      name: pieceForm.name,
      size,
      store_category: pieceForm.store_category || undefined,
    });
    setPieceForm({
      code: "", category: "", name: "",
      width: "", length: "", height: "",
      store_category: pieceForm.store_category,
    });
    setPieceDialogOpen(false);
  };

  const handleCellClick = (storeId: string, pieceId: string) => {
    if (!isAdmin) return;
    const qty = qtyMap[`${storeId}-${pieceId}`] || 0;
    setEditingCell({ storeId, pieceId });
    setEditValue(String(qty));
  };

  const handleCellSave = () => {
    if (!editingCell || !campaignId) return;
    const qty = parseInt(editValue) || 0;
    updateStorePiece.mutate({
      campaignId,
      storeId: editingCell.storeId,
      pieceId: editingCell.pieceId,
      quantity: Math.max(0, qty),
    });
    setEditingCell(null);
  };

  const totalPieces = useMemo(() => storePieces.reduce((s, sp) => s + sp.quantity, 0), [storePieces]);

  if (loadingCampaign) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Campanha não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-[95vw] mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/clients/${clientId}`)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> {client?.name || "Voltar"}
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-display font-bold text-foreground">{campaign.name}</h1>
            <p className="text-xs text-muted-foreground">
              {pieces.length} peça(s) · {stores.length} loja(s) · {totalPieces} unidade(s) total
            </p>
          </div>
          {isAdmin && (
            <Dialog open={pieceDialogOpen} onOpenChange={setPieceDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Peça</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Peça</DialogTitle></DialogHeader>
                <form onSubmit={handleAddPiece} className="space-y-3">
                  <Input placeholder="Código *" type="number" value={pieceForm.code} onChange={(e) => setPieceForm((f) => ({ ...f, code: e.target.value }))} required />
                  <Input placeholder="Categoria *" value={pieceForm.category} onChange={(e) => setPieceForm((f) => ({ ...f, category: e.target.value }))} required />
                  <Input placeholder="Nome *" value={pieceForm.name} onChange={(e) => setPieceForm((f) => ({ ...f, name: e.target.value }))} required />
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Medidas</label>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Largura" value={pieceForm.width} onChange={(e) => setPieceForm((f) => ({ ...f, width: e.target.value }))} />
                      <Input placeholder="Comprimento" value={pieceForm.length} onChange={(e) => setPieceForm((f) => ({ ...f, length: e.target.value }))} />
                      <Input placeholder="Altura" value={pieceForm.height} onChange={(e) => setPieceForm((f) => ({ ...f, height: e.target.value }))} />
                    </div>
                  </div>
                  <Input placeholder="Categoria de Loja" value={pieceForm.store_category} onChange={(e) => setPieceForm((f) => ({ ...f, store_category: e.target.value }))} />
                  <Button type="submit" className="w-full" disabled={addPiece.isPending}>Adicionar</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <main className="max-w-[95vw] mx-auto px-4 py-6">
        {pieces.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-display font-bold text-foreground mb-2">Nenhuma peça cadastrada</h2>
            <p className="text-muted-foreground text-sm">Adicione peças para começar a distribuir pelas lojas.</p>
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-display font-bold text-foreground mb-2">Nenhuma loja cadastrada</h2>
            <p className="text-muted-foreground text-sm">Cadastre lojas no cliente para distribuir peças.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar loja..." value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} className="pl-10" />
              </div>
              <span className="text-sm text-muted-foreground">{filteredStores.length} loja(s)</span>
            </div>

            <div className="border border-border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-[5] min-w-[180px]">Loja</TableHead>
                    {pieces.map((p) => (
                      <TableHead key={p.id} className="text-center min-w-[100px]">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-xs font-bold">{p.code}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[90px]">{p.name}</span>
                          {isAdmin && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <button onClick={() => handleOpenEditPiece(p)} className="text-muted-foreground/50 hover:text-primary">
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button className="text-destructive/50 hover:text-destructive">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir peça?</AlertDialogTitle>
                                    <AlertDialogDescription>A peça será removida de todas as lojas desta campanha.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deletePiece.mutate(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStores.map((store) => {
                    const storeTotal = pieces.reduce((s, p) => s + (qtyMap[`${store.id}-${p.id}`] || 0), 0);
                    return (
                      <TableRow key={store.id}>
                        <TableCell className="sticky left-0 bg-card z-[5] font-medium">
                          <div>
                            <span className="text-sm">{store.name}</span>
                            {store.nickname && <span className="text-[10px] text-muted-foreground ml-1">({store.nickname})</span>}
                          </div>
                        </TableCell>
                        {pieces.map((p) => {
                          const key = `${store.id}-${p.id}`;
                          const qty = qtyMap[key] || 0;
                          const isEditing = editingCell?.storeId === store.id && editingCell?.pieceId === p.id;

                          return (
                            <TableCell key={p.id} className="text-center p-1">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  min={0}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={handleCellSave}
                                  onKeyDown={(e) => { if (e.key === "Enter") handleCellSave(); if (e.key === "Escape") setEditingCell(null); }}
                                  className="w-16 h-8 text-center mx-auto text-sm"
                                  autoFocus
                                />
                              ) : (
                                <button
                                  onClick={() => handleCellClick(store.id, p.id)}
                                  className={`w-full h-8 text-sm rounded transition-colors ${
                                    qty > 0
                                      ? "bg-primary/10 text-primary font-semibold hover:bg-primary/20"
                                      : isAdmin
                                      ? "text-muted-foreground/40 hover:bg-muted"
                                      : "text-muted-foreground/40"
                                  }`}
                                  disabled={!isAdmin}
                                >
                                  {qty || "—"}
                                </button>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold text-sm">{storeTotal}</TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell className="sticky left-0 bg-muted/50 z-[5]">Total</TableCell>
                    {pieces.map((p) => {
                      const pieceTotal = filteredStores.reduce((s, st) => s + (qtyMap[`${st.id}-${p.id}`] || 0), 0);
                      return <TableCell key={p.id} className="text-center text-sm">{pieceTotal}</TableCell>;
                    })}
                    <TableCell className="text-center text-sm text-primary">{totalPieces}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </main>

      {/* Edit Piece Dialog */}
      <Dialog open={editPieceDialogOpen} onOpenChange={setEditPieceDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Peça</DialogTitle></DialogHeader>
          <form onSubmit={handleEditPiece} className="space-y-3">
            <Input placeholder="Código *" type="number" value={editPieceForm.code} onChange={(e) => setEditPieceForm((f) => ({ ...f, code: e.target.value }))} required />
            <Input placeholder="Categoria *" value={editPieceForm.category} onChange={(e) => setEditPieceForm((f) => ({ ...f, category: e.target.value }))} required />
            <Input placeholder="Nome *" value={editPieceForm.name} onChange={(e) => setEditPieceForm((f) => ({ ...f, name: e.target.value }))} required />
            <div>
              <label className="text-xs font-medium text-muted-foreground">Medidas</label>
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Largura" value={editPieceForm.width} onChange={(e) => setEditPieceForm((f) => ({ ...f, width: e.target.value }))} />
                <Input placeholder="Comprimento" value={editPieceForm.length} onChange={(e) => setEditPieceForm((f) => ({ ...f, length: e.target.value }))} />
                <Input placeholder="Altura" value={editPieceForm.height} onChange={(e) => setEditPieceForm((f) => ({ ...f, height: e.target.value }))} />
              </div>
            </div>
            <Input placeholder="Categoria de Loja" value={editPieceForm.store_category} onChange={(e) => setEditPieceForm((f) => ({ ...f, store_category: e.target.value }))} />
            <Button type="submit" className="w-full" disabled={updatePiece.isPending}>Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CampaignDetail;
