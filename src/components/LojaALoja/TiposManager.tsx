import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compressImage";
import {
  useLojaALojaTipos,
  useLojaALojaPecas,
  useAddTipo,
  useUpdateTipo,
  useDeleteTipo,
  useAddSubdivisao,
  useUpdateSubdivisao,
  useDeleteSubdivisao,
  useAddPeca,
  useDeletePeca,
  type LojaALojaTipo,
  type LojaALojaSubdivisao,
} from "@/hooks/useLojaALoja";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, Image, ChevronRight, X, Upload, Check } from "lucide-react";
import { toast } from "sonner";

interface TiposManagerProps {
  campaignId: string;
  isAdmin: boolean;
}

/** Crop an image blob to a 1:1 square center crop at given size */
function cropSquare(file: File, size = 400, quality = 0.7): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Crop failed")),
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

const TiposManager = ({ campaignId, isAdmin }: TiposManagerProps) => {
  const { data: tipos, isLoading: loadingTipos } = useLojaALojaTipos(campaignId);

  // Selection state
  const [selectedTipoId, setSelectedTipoId] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [expandedTipos, setExpandedTipos] = useState<Set<string>>(new Set());

  // Inline edit state
  const [editingTipoId, setEditingTipoId] = useState<string | null>(null);
  const [editingTipoNome, setEditingTipoNome] = useState("");
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubNome, setEditingSubNome] = useState("");

  // Add tipo form
  const [showAddTipo, setShowAddTipo] = useState(false);
  const [newTipoLetra, setNewTipoLetra] = useState("");
  const [newTipoNome, setNewTipoNome] = useState("");

  // Add subdivisao form
  const [addingSubForTipoId, setAddingSubForTipoId] = useState<string | null>(null);
  const [newSubNome, setNewSubNome] = useState("");

  // Add peca dialog
  const [showAddPeca, setShowAddPeca] = useState(false);
  const [newPecaNome, setNewPecaNome] = useState("");
  const [newPecaPreview, setNewPecaPreview] = useState<string | null>(null);
  const [newPecaBlob, setNewPecaBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);

  // Mutations
  const addTipo = useAddTipo();
  const updateTipo = useUpdateTipo();
  const deleteTipo = useDeleteTipo();
  const addSubdivisao = useAddSubdivisao();
  const updateSubdivisao = useUpdateSubdivisao();
  const deleteSubdivisao = useDeleteSubdivisao();
  const addPeca = useAddPeca();
  const deletePeca = useDeletePeca();

  // Pieces query
  const { data: pecas, isLoading: loadingPecas } = useLojaALojaPecas(
    selectedSubId ? null : selectedTipoId,
    selectedSubId,
  );

  const selectedTipo = tipos?.find((t) => t.id === selectedTipoId);

  // ── Handlers ──

  const handleSelectTipo = (tipo: LojaALojaTipo) => {
    setSelectedTipoId(tipo.id);
    setSelectedSubId(null);
    if (tipo.tem_subdivisao) {
      setExpandedTipos((prev) => {
        const next = new Set(prev);
        if (next.has(tipo.id)) next.delete(tipo.id); else next.add(tipo.id);
        return next;
      });
    }
  };

  const handleSelectSub = (sub: LojaALojaSubdivisao) => {
    setSelectedTipoId(null);
    setSelectedSubId(sub.id);
  };

  const handleAddTipo = async () => {
    if (!newTipoLetra.trim() || !newTipoNome.trim()) return;
    const maxOrder = tipos ? Math.max(0, ...tipos.map((t) => t.display_order)) : 0;
    await addTipo.mutateAsync({
      campaign_id: campaignId,
      letra: newTipoLetra.trim().toUpperCase(),
      nome: newTipoNome.trim(),
      display_order: maxOrder + 1,
    });
    setNewTipoLetra("");
    setNewTipoNome("");
    setShowAddTipo(false);
  };

  const handleSaveEditTipo = async () => {
    if (!editingTipoId || !editingTipoNome.trim()) return;
    await updateTipo.mutateAsync({ id: editingTipoId, campaign_id: campaignId, nome: editingTipoNome.trim() });
    setEditingTipoId(null);
  };

  const handleAddSub = async (tipoId: string) => {
    if (!newSubNome.trim()) return;
    const tipo = tipos?.find((t) => t.id === tipoId);
    const maxOrder = tipo?.subdivisoes ? Math.max(0, ...tipo.subdivisoes.map((s) => s.display_order)) : 0;
    await addSubdivisao.mutateAsync({
      tipo_id: tipoId,
      nome: newSubNome.trim(),
      campaign_id: campaignId,
      display_order: maxOrder + 1,
    });
    setNewSubNome("");
    setAddingSubForTipoId(null);
  };

  const handleSaveEditSub = async () => {
    if (!editingSubId || !editingSubNome.trim()) return;
    await updateSubdivisao.mutateAsync({ id: editingSubId, campaign_id: campaignId, nome: editingSubNome.trim() });
    setEditingSubId(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const cropped = await cropSquare(file, 400, 0.7);
      setNewPecaBlob(cropped);
      setNewPecaPreview(URL.createObjectURL(cropped));
    } catch (err: any) {
      toast.error("Erro ao processar imagem: " + err.message);
    }
  };

  const handleAddPeca = async () => {
    if (!newPecaNome.trim()) return;
    setUploading(true);
    try {
      let imageUrl: string | undefined;
      if (newPecaBlob) {
        const path = `loja-a-loja-${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("piece-images")
          .upload(path, newPecaBlob, { upsert: true, contentType: "image/jpeg" });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("piece-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
      await addPeca.mutateAsync({
        campaign_id: campaignId,
        tipo_id: selectedSubId ? undefined : (selectedTipoId ?? undefined),
        subdivisao_id: selectedSubId ?? undefined,
        nome: newPecaNome.trim(),
        image_url: imageUrl,
      });
      setNewPecaNome("");
      setNewPecaPreview(null);
      setNewPecaBlob(null);
      setShowAddPeca(false);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Render ──

  return (
    <div className="flex flex-col md:flex-row gap-4 min-h-[400px]">
      {/* ── Left column: Tipos list ── */}
      <div className="w-full md:w-72 shrink-0 border border-border rounded-lg bg-card p-3 space-y-1 overflow-y-auto max-h-[70vh]">
        <h3 className="text-sm font-semibold text-foreground mb-2">Tipos de Vitrine</h3>

        {loadingTipos ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))
        ) : (
          <>
            {tipos?.map((tipo) => (
              <div key={tipo.id}>
                {/* Tipo row */}
                <div
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors group",
                    selectedTipoId === tipo.id && !selectedSubId
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/60 text-foreground",
                  )}
                  onClick={() => handleSelectTipo(tipo)}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0"
                    style={{ backgroundColor: "#5B7B5E" }}
                  >
                    {tipo.letra}
                  </span>

                  {editingTipoId === tipo.id ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={editingTipoNome}
                        onChange={(e) => setEditingTipoNome(e.target.value)}
                        className="h-7 text-xs flex-1"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleSaveEditTipo()}
                      />
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveEditTipo}>
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingTipoId(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-medium truncate flex-1">{tipo.nome}</span>
                      {tipo.tem_subdivisao && (
                        <ChevronRight className={cn("w-3 h-3 transition-transform text-muted-foreground", expandedTipos.has(tipo.id) && "rotate-90")} />
                      )}
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTipoId(tipo.id);
                            setEditingTipoNome(tipo.nome);
                          }}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      )}
                    </>
                  )}
                </div>

                {/* Subdivisoes */}
                {tipo.tem_subdivisao && expandedTipos.has(tipo.id) && (
                  <div className="ml-6 mt-0.5 space-y-0.5">
                    {tipo.subdivisoes?.map((sub) => (
                      <div
                        key={sub.id}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-colors group text-xs",
                          selectedSubId === sub.id
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted/60 text-muted-foreground",
                        )}
                        onClick={() => handleSelectSub(sub)}
                      >
                        {editingSubId === sub.id ? (
                          <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                            <Input
                              value={editingSubNome}
                              onChange={(e) => setEditingSubNome(e.target.value)}
                              className="h-6 text-xs flex-1"
                              autoFocus
                              onKeyDown={(e) => e.key === "Enter" && handleSaveEditSub()}
                            />
                            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={handleSaveEditSub}>
                              <Check className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditingSubId(null)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="truncate flex-1">{sub.nome}</span>
                            {isAdmin && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5 opacity-0 group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSubId(sub.id);
                                  setEditingSubNome(sub.nome);
                                }}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    ))}

                    {/* Add subdivisao */}
                    {isAdmin && (
                      addingSubForTipoId === tipo.id ? (
                        <div className="flex items-center gap-1 px-2">
                          <Input
                            value={newSubNome}
                            onChange={(e) => setNewSubNome(e.target.value)}
                            placeholder="Nome da subdivisão"
                            className="h-6 text-xs flex-1"
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && handleAddSub(tipo.id)}
                          />
                          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleAddSub(tipo.id)}>
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setAddingSubForTipoId(null)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="text-[10px] text-muted-foreground hover:text-primary px-2 py-0.5 flex items-center gap-1"
                          onClick={() => setAddingSubForTipoId(tipo.id)}
                        >
                          <Plus className="w-3 h-3" /> Subdivisão
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Add tipo */}
            {isAdmin && (
              showAddTipo ? (
                <div className="space-y-1 pt-2 border-t border-border mt-2">
                  <div className="flex gap-1">
                    <Input
                      value={newTipoLetra}
                      onChange={(e) => setNewTipoLetra(e.target.value)}
                      placeholder="Letra"
                      className="h-7 text-xs w-14"
                      maxLength={2}
                      autoFocus
                    />
                    <Input
                      value={newTipoNome}
                      onChange={(e) => setNewTipoNome(e.target.value)}
                      placeholder="Nome do tipo"
                      className="h-7 text-xs flex-1"
                      onKeyDown={(e) => e.key === "Enter" && handleAddTipo()}
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" className="h-7 text-xs flex-1" onClick={handleAddTipo} disabled={addTipo.isPending}>
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddTipo(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 px-2 pt-2 border-t border-border mt-2 w-full"
                  onClick={() => setShowAddTipo(true)}
                >
                  <Plus className="w-3 h-3" /> Novo Tipo
                </button>
              )
            )}
          </>
        )}
      </div>

      {/* ── Right column: Pieces grid ── */}
      <div className="flex-1 border border-border rounded-lg bg-card p-4 overflow-y-auto max-h-[70vh]">
        {!selectedTipoId && !selectedSubId ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-12">
            <Image className="w-8 h-8" />
            <span className="text-sm">Selecione um tipo de vitrine</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">
                Peças {selectedTipo ? `— ${selectedTipo.letra} ${selectedTipo.nome}` : ""}
              </h3>
              {isAdmin && (
                <Button size="sm" className="h-7 text-xs" onClick={() => setShowAddPeca(true)}>
                  <Plus className="w-3 h-3 mr-1" /> Peça
                </Button>
              )}
            </div>

            {loadingPecas ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="aspect-square w-full rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </div>
            ) : pecas && pecas.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {pecas.map((peca) => (
                  <div key={peca.id} className="group relative">
                    <div className="aspect-square rounded-lg border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
                      {peca.image_url ? (
                        <img src={peca.image_url} alt={peca.nome} className="w-full h-full object-cover" />
                      ) : (
                        <Image className="w-8 h-8 text-muted-foreground/40" />
                      )}
                    </div>
                    <p className="text-xs text-foreground mt-1 truncate">{peca.nome}</p>
                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deletePeca.mutate({ id: peca.id })}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground gap-2 py-12">
                <Image className="w-8 h-8" />
                <span className="text-sm">Nenhuma peça cadastrada</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Add Peça Dialog ── */}
      <Dialog open={showAddPeca} onOpenChange={setShowAddPeca}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Adicionar Peça</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input
                value={newPecaNome}
                onChange={(e) => setNewPecaNome(e.target.value)}
                placeholder="Nome da peça"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Imagem (1:1)</label>
              {newPecaPreview ? (
                <div className="relative w-full max-w-[200px]">
                  <img src={newPecaPreview} alt="Preview" className="w-full aspect-square object-cover rounded-lg border border-border" />
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="absolute top-1 right-1 h-6 px-2"
                    onClick={() => { setNewPecaPreview(null); setNewPecaBlob(null); }}
                  >
                    <X className="w-3 h-3 mr-1" /> Remover
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/20">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Clique ou arraste (400×400px)</span>
                  </div>
                </div>
              )}
            </div>

            <Button className="w-full" onClick={handleAddPeca} disabled={!newPecaNome.trim() || uploading || addPeca.isPending}>
              {uploading ? "Enviando..." : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TiposManager;
