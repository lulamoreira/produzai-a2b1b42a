import { useState, useMemo } from "react";
import { getThumbnailUrl } from "@/lib/imageUrl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Package, Edit3, Upload, Link, X, Image, Minus, Copy, GripVertical } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import PieceThumbnail from "@/components/PieceThumbnail";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compressImage";
import { toast } from "sonner";
import type { CampaignPiece, CampaignKit, CampaignKitPiece } from "@/hooks/useMultiClientData";
import { findDuplicateName, duplicateNameMessage } from "@/lib/duplicateName";

// ─── Kit Image Upload (inline) ───────────────────────────

function KitImageSection({
  imageUrl,
  kitId,
  kitName,
  canEdit,
  onImageUpdated,
}: {
  imageUrl: string | null;
  kitId: string;
  kitName: string;
  canEdit: boolean;
  onImageUpdated: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file, 800, 0.6);
      const path = `kit-${kitId}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("piece-images")
        .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("piece-images").getPublicUrl(path);
      onImageUpdated(urlData.publicUrl);
    } catch (err: any) {
      toast.error("Erro ao enviar imagem: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return;
    onImageUpdated(urlInput.trim());
    setUrlInput("");
    setShowUrlInput(false);
  };

  return (
    <div className="space-y-2">
      {imageUrl ? (
        <div className="relative">
          <img src={imageUrl} alt={kitName} loading="lazy" decoding="async" className="w-full h-32 object-contain rounded-lg border border-border bg-muted/30" />
          {canEdit && (
            <Button size="sm" variant="destructive" className="absolute top-1 right-1 h-6 text-[10px] px-2" onClick={() => onImageUpdated(null)}>
              <X className="w-3 h-3 mr-1" /> Remover
            </Button>
          )}
        </div>
      ) : canEdit ? (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={uploading} />
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/20 text-xs text-muted-foreground">
              <Upload className="w-3.5 h-3.5" />
              {uploading ? "Enviando..." : "Foto do kit"}
            </div>
          </div>
          {!showUrlInput ? (
            <Button size="sm" variant="outline" className="text-xs h-auto" onClick={() => setShowUrlInput(true)}>
              <Link className="w-3 h-3" />
            </Button>
          ) : (
            <div className="flex gap-1 flex-1">
              <Input placeholder="URL" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="h-8 text-xs" />
              <Button size="sm" className="h-8 text-xs" onClick={handleUrlSubmit} disabled={!urlInput.trim()}>OK</Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ─── Create Kit Dialog ───────────────────────────────────

interface CreateKitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  kitOnlyPieces: CampaignPiece[];
  existingKits: CampaignKit[];
  existingPieces?: CampaignPiece[];
  onCreateKit: (kit: { campaign_id: string; name: string; code: number; is_new?: boolean }) => Promise<CampaignKit>;
  onAddKitPiece: (kitPiece: { kit_id: string; piece_id: string }) => Promise<void>;
  onUpdateKit: (kit: { id: string; image_url?: string | null; is_new?: boolean }) => Promise<CampaignKit>;
}

export function CreateKitDialog({
  open, onOpenChange, campaignId, kitOnlyPieces, existingKits, existingPieces = [], onCreateKit, onAddKitPiece, onUpdateKit,
}: CreateKitDialogProps) {
  const [step, setStep] = useState<"name" | "pieces">("name");
  const [kitName, setKitName] = useState("");
  const [kitIsNew, setKitIsNew] = useState(false);
  const [createdKit, setCreatedKit] = useState<CampaignKit | null>(null);
  const [selectedPieceIds, setSelectedPieceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [createSearch, setCreateSearch] = useState("");

  const nextCode = useMemo(() => {
    const maxCode = existingKits.reduce((max, k) => Math.max(max, k.code), 0);
    return maxCode + 1;
  }, [existingKits]);

  const availablePieces = kitOnlyPieces.filter(p => !selectedPieceIds.includes(p.id));

  const filteredAvailablePieces = useMemo(() => {
    if (!createSearch.trim()) return availablePieces;
    const q = createSearch.toLowerCase();
    return availablePieces.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      String(p.code).includes(q)
    );
  }, [availablePieces, createSearch]);

  const ensureKitPrefix = (name: string) => {
    const trimmed = name.trim();
    return trimmed.startsWith("KIT ") ? trimmed : `KIT ${trimmed}`;
  };

  const handleCreateKit = async () => {
    if (!kitName.trim()) return;
    const finalName = ensureKitPrefix(kitName);
    // Validate duplicate name (against pieces + kits in this campaign)
    const dup = findDuplicateName(finalName, existingPieces, existingKits);
    if (dup) {
      toast.error(duplicateNameMessage(dup));
      return;
    }
    setSaving(true);
    try {
      const kit = await onCreateKit({ campaign_id: campaignId, name: finalName, code: nextCode, is_new: kitIsNew });
      setCreatedKit(kit);
      setStep("pieces");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPiece = async (pieceId: string) => {
    if (!createdKit) return;
    await onAddKitPiece({ kit_id: createdKit.id, piece_id: pieceId });
    setSelectedPieceIds(prev => [...prev, pieceId]);
  };

  const handleClose = () => {
    setStep("name");
    setKitName("");
    setKitIsNew(false);
    setCreatedKit(null);
    setSelectedPieceIds([]);
    setCreateSearch("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle>{step === "name" ? "Novo Kit" : `Kit: ${kitName}`}</DialogTitle>
          <DialogDescription>
            {step === "name"
              ? "Dê um nome ao kit de peças."
              : "Selecione as peças e adicione uma foto ao kit."}
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
            <div className="flex items-center justify-between p-3 rounded-lg border border-green-500/20 bg-green-500/5">
              <div>
                <label className="text-xs font-medium text-foreground">Kit Novo</label>
                <p className="text-[10px] text-muted-foreground">Marcar como kit novo na campanha</p>
              </div>
              <Switch checked={kitIsNew} onCheckedChange={setKitIsNew} />
            </div>
            <Button onClick={handleCreateKit} disabled={!kitName.trim() || saving} className="w-full">
              {saving ? "Criando..." : "Avançar"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 overflow-hidden">
            {/* Kit image */}
            {createdKit && (
              <KitImageSection
                imageUrl={createdKit.image_url}
                kitId={createdKit.id}
                kitName={kitName}
                canEdit
                onImageUpdated={async (url) => {
                  const updated = await onUpdateKit({ id: createdKit.id, image_url: url });
                  setCreatedKit(updated);
                }}
              />
            )}

            {/* Search bar */}
            <div>
              <Input
                placeholder="Buscar peça por nome, código ou categoria..."
                value={createSearch}
                onChange={(e) => setCreateSearch(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {selectedPieceIds.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Peças incluídas ({selectedPieceIds.length})</label>
                {selectedPieceIds.map(pid => {
                  const piece = kitOnlyPieces.find(p => p.id === pid);
                  if (!piece) return null;
                  return (
                    <div key={pid} className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/20 min-w-0">
                      <PieceThumbnail imageUrl={piece.image_url} name={piece.name} size="md" />
                      <span className="text-xs font-bold text-primary shrink-0">#{piece.code}</span>
                      <span className="text-sm flex-1 break-words min-w-0">{piece.name}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredAvailablePieces.length > 0 ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Peças disponíveis para kit</label>
                <div className="max-h-[250px] overflow-y-auto space-y-1.5 pr-1">
                  {filteredAvailablePieces.map(p => (
                    <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-muted/50 transition-colors">
                      <PieceThumbnail imageUrl={p.image_url} name={p.name} size="md" />
                      <span className="text-xs font-bold text-primary shrink-0">#{p.code}</span>
                      <span className="text-sm flex-1 break-words min-w-0">{p.name}</span>
                      <Button size="sm" variant="outline" className="text-xs gap-1 shrink-0 ml-2" onClick={() => handleAddPiece(p.id)}>
                        <Plus className="w-3 h-3" /> Incluir
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {kitOnlyPieces.length === 0
                  ? "Nenhuma peça marcada como 'para kit'. Crie peças com essa opção ativada primeiro."
                  : createSearch.trim()
                    ? "Nenhuma peça encontrada para essa busca."
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

// ─── Kit Detail Dialog (full editing) ────────────────────

interface KitDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kit: CampaignKit | null;
  kitPieces: CampaignKitPiece[];
  allPieces: CampaignPiece[];
  existingKits?: CampaignKit[];
  canEdit?: boolean;
  pieceLocations?: { id: string; name: string }[];
  pieceSubLocations?: { id: string; location_id: string; name: string }[];
  onDeleteKitPiece?: (id: string) => void;
  onDeleteKit?: (id: string) => void;
  onAddKitPiece?: (kitPiece: { kit_id: string; piece_id: string; quantity?: number }) => Promise<void>;
  onUpdateKit?: (kit: { id: string; name?: string; image_url?: string | null; is_mockup?: boolean; is_new?: boolean; category?: string | null; sub_location?: string | null }) => Promise<CampaignKit>;
  onUpdatePiece?: (piece: Partial<CampaignPiece> & { id: string }) => Promise<void>;
  onDeletePiece?: (id: string) => void;
  onUpdateKitPiece?: (update: { id: string; quantity: number }) => Promise<void>;
  onReorderKitPieces?: (updates: { id: string; display_order: number }[]) => Promise<void>;
  onDuplicatePiece?: (piece: CampaignPiece) => Promise<void>;
}

export function KitDetailDialog({
  open, onOpenChange, kit, kitPieces, allPieces, existingKits = [], canEdit,
  pieceLocations = [], pieceSubLocations = [],
  onDeleteKitPiece, onDeleteKit, onAddKitPiece, onUpdateKit, onUpdatePiece, onDeletePiece, onUpdateKitPiece, onDuplicatePiece,
}: KitDetailDialogProps) {
  const [editingPieceId, setEditingPieceId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [showAddPieces, setShowAddPieces] = useState(false);
  const [editingKitName, setEditingKitName] = useState(false);
  const [kitNameInput, setKitNameInput] = useState("");
  const [addPieceSearch, setAddPieceSearch] = useState("");
  const [localImageUrl, setLocalImageUrl] = useState<string | null | undefined>(undefined);
  const [localKitName, setLocalKitName] = useState<string | undefined>(undefined);
  const [localCategory, setLocalCategory] = useState<string | null | undefined>(undefined);
  const [localSubLocation, setLocalSubLocation] = useState<string | null | undefined>(undefined);

  // Reset local overrides when kit changes
  const displayKitName = localKitName !== undefined ? localKitName : kit?.name ?? "";
  const effectiveImageUrl = localImageUrl !== undefined ? localImageUrl : kit?.image_url ?? null;
  const effectiveCategory = localCategory !== undefined ? localCategory : kit?.category ?? null;
  const effectiveSub = localSubLocation !== undefined ? localSubLocation : kit?.sub_location ?? null;

  const piecesInKit = kit ? kitPieces
    .filter(kp => kp.kit_id === kit.id)
    .map(kp => ({ ...kp, piece: allPieces.find(p => p.id === kp.piece_id) }))
    .filter(kp => kp.piece) : [];

  const kitOnlyPiecesNotInKit = kit ? allPieces.filter(
    p => p.kit_only && p.campaign_id === kit.campaign_id && !piecesInKit.some(kp => kp.piece_id === p.id)
  ) : [];

  const filteredAddPieces = useMemo(() => {
    if (!addPieceSearch.trim()) return kitOnlyPiecesNotInKit;
    const q = addPieceSearch.toLowerCase();
    return kitOnlyPiecesNotInKit.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      String(p.code).includes(q)
    );
  }, [kitOnlyPiecesNotInKit, addPieceSearch]);

  if (!kit) return null;

  const startEditPiece = (p: CampaignPiece) => {
    setEditingPieceId(p.id);
    const [w, h, l] = (p.size || "").split(" x ");
    setEditForm({
      name: p.name,
      category: p.category,
      width: w || "",
      height: h || "",
      length: l || "",
      store_category: p.store_category || "",
      specification: p.specification || "",
      installation_instructions: p.installation_instructions || "",
    });
  };

  const saveEditPiece = async () => {
    if (!editingPieceId || !onUpdatePiece) return;
    const size = [editForm.width, editForm.height, editForm.length].filter(Boolean).join(" x ");
    await onUpdatePiece({
      id: editingPieceId,
      name: editForm.name,
      category: editForm.category,
      size,
      store_category: editForm.store_category || null,
      specification: editForm.specification,
      installation_instructions: editForm.installation_instructions,
    });
    setEditingPieceId(null);
    toast.success("Peça atualizada!");
  };

  const handlePieceImageUpload = async (pieceId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdatePiece) return;
    try {
      const compressed = await compressImage(file, 800, 0.6);
      const path = `campaign-piece-${pieceId}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("piece-images").upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("piece-images").getPublicUrl(path);
      await onUpdatePiece({ id: pieceId, image_url: urlData.publicUrl });
      toast.success("Imagem atualizada!");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  const handleRemovePieceImage = async (pieceId: string) => {
    if (!onUpdatePiece) return;
    await onUpdatePiece({ id: pieceId, image_url: null });
    toast.success("Imagem removida!");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditingPieceId(null); setShowAddPieces(false); setEditingKitName(false); setLocalImageUrl(undefined); setLocalKitName(undefined); setLocalCategory(undefined); setLocalSubLocation(undefined); } onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {editingKitName && canEdit && onUpdateKit ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={kitNameInput}
                  onChange={(e) => setKitNameInput(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && kitNameInput.trim() && kit) {
                      const safeName = kitNameInput.trim().startsWith("KIT ") ? kitNameInput.trim() : `KIT ${kitNameInput.trim()}`;
                      const dup = findDuplicateName(safeName, allPieces, existingKits, { ignoreKitId: kit.id });
                      if (dup) {
                        toast.error(duplicateNameMessage(dup));
                        return;
                      }
                      setLocalKitName(safeName);
                      setEditingKitName(false);
                      toast.success("Nome atualizado!");
                      await onUpdateKit({ id: kit.id, name: safeName });
                    }
                  }}
                />
                <Button size="sm" className="h-8 text-xs" onClick={async () => {
                  if (kitNameInput.trim() && kit) {
                    const safeName = kitNameInput.trim().startsWith("KIT ") ? kitNameInput.trim() : `KIT ${kitNameInput.trim()}`;
                    const dup = findDuplicateName(safeName, allPieces, existingKits, { ignoreKitId: kit.id });
                    if (dup) {
                      toast.error(duplicateNameMessage(dup));
                      return;
                    }
                    setLocalKitName(safeName);
                    setEditingKitName(false);
                    toast.success("Nome atualizado!");
                    await onUpdateKit({ id: kit.id, name: safeName });
                  }
                }}>Salvar</Button>
              </div>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{kit.code}</span>
                {displayKitName}
                {canEdit && onUpdateKit && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setKitNameInput(kit.name); setEditingKitName(true); }}>
                    <Edit3 className="w-3 h-3" />
                  </Button>
                )}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>{piecesInKit.length} peça(s) neste kit</DialogDescription>
        </DialogHeader>

        {/* Kit image */}
        {canEdit && onUpdateKit && (
          <KitImageSection
            imageUrl={effectiveImageUrl}
            kitId={kit.id}
            kitName={kit.name}
            canEdit={canEdit}
            onImageUpdated={async (url) => {
              setLocalImageUrl(url);
              await onUpdateKit({ id: kit.id, image_url: url });
            }}
          />
        )}
        {!canEdit && kit.image_url && (
          <img src={kit.image_url} alt={kit.name} loading="lazy" decoding="async" className="w-full h-32 object-contain rounded-lg border border-border bg-muted/30" />
        )}

        {/* Mockup toggle */}
        {canEdit && onUpdateKit && (
          <div className="flex items-center justify-between p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
            <div>
              <label className="text-xs font-medium text-foreground">Mockup</label>
              <p className="text-[10px] text-muted-foreground">Marcar kit e suas peças como mockup</p>
            </div>
            <Switch
              checked={kit.is_mockup || false}
              onCheckedChange={async (checked) => {
                await onUpdateKit({ id: kit.id, is_mockup: checked });
                // Propagate to all pieces in the kit
                if (onUpdatePiece) {
                  for (const kp of piecesInKit) {
                    if (kp.piece) {
                      await onUpdatePiece({ id: kp.piece.id, is_mockup: checked });
                    }
                  }
                }
                toast.success(checked ? "Kit marcado como mockup!" : "Mockup removido do kit!");
              }}
            />
          </div>
        )}

        {/* Kit Novo toggle */}
        {canEdit && onUpdateKit && (
          <div className="flex items-center justify-between p-3 rounded-lg border border-green-500/20 bg-green-500/5">
            <div>
              <label className="text-xs font-medium text-foreground">Kit Novo</label>
              <p className="text-[10px] text-muted-foreground">Marcar como kit novo na campanha</p>
            </div>
            <Switch
              checked={(kit as any).is_new || false}
              onCheckedChange={async (checked) => {
                await onUpdateKit({ id: kit.id, is_new: checked });
                toast.success(checked ? "Kit marcado como novo!" : "Marcação de novo removida!");
              }}
            />
          </div>
        )}

        {/* Kit location */}
        {canEdit && onUpdateKit && pieceLocations.length > 0 && (
          <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/20">
            <label className="text-xs font-medium text-foreground">Localização do Kit</label>
            <p className="text-[10px] text-muted-foreground">Alterar a localização do kit atualiza todas as peças automaticamente.</p>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={effectiveCategory || "__none__"}
                onValueChange={async (val) => {
                  const newCategory = val === "__none__" ? null : val;
                  setLocalCategory(newCategory);
                  setLocalSubLocation(null);
                  await onUpdateKit({ id: kit.id, category: newCategory, sub_location: null });
                  // Propagate to all pieces in the kit
                  if (onUpdatePiece) {
                    for (const kp of piecesInKit) {
                      if (kp.piece) {
                        await onUpdatePiece({ id: kp.piece.id, category: newCategory || kp.piece.category, sub_location: null });
                      }
                    }
                  }
                  toast.success("Localização do kit atualizada!");
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione a localização" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma</SelectItem>
                  {pieceLocations.map(loc => (
                    <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {effectiveCategory && pieceSubLocations.filter(s => {
                const parentLoc = pieceLocations.find(l => l.name === effectiveCategory);
                return parentLoc && s.location_id === parentLoc.id;
              }).length > 0 && (
                <Select
                  value={effectiveSub || "__none__"}
                  onValueChange={async (val) => {
                    const newSub = val === "__none__" ? null : val;
                    setLocalSubLocation(newSub);
                    await onUpdateKit({ id: kit.id, sub_location: newSub });
                    // Propagate to all pieces
                    if (onUpdatePiece) {
                      for (const kp of piecesInKit) {
                        if (kp.piece) {
                          await onUpdatePiece({ id: kp.piece.id, sub_location: newSub });
                        }
                      }
                    }
                    toast.success("Sub-localização do kit atualizada!");
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sub-localização" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma</SelectItem>
                    {pieceSubLocations.filter(s => {
                      const parentLoc = pieceLocations.find(l => l.name === effectiveCategory);
                      return parentLoc && s.location_id === parentLoc.id;
                    }).map(sub => (
                      <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}
        {!canEdit && effectiveCategory && (
          <div className="text-xs text-muted-foreground px-1">
            📍 Localização: {effectiveCategory}{effectiveSub ? ` / ${effectiveSub}` : ""}
          </div>
        )}

        {piecesInKit.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma peça neste kit.</p>
        ) : (
          <div className="space-y-2 max-h-[350px] overflow-y-auto">
            {piecesInKit.map((kp, idx) => {
              const p = kp.piece!;
              const isEditing = editingPieceId === p.id;

              if (isEditing && canEdit && onUpdatePiece) {
                return (
                  <div key={kp.id} className="p-3 rounded-lg border-2 border-primary/30 bg-primary/5 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Nome</label>
                        <Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} className="h-7 text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Localização na Loja</label>
                        <Input value={editForm.category} onChange={(e) => setEditForm(f => ({ ...f, category: e.target.value }))} className="h-7 text-xs" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Largura</label>
                        <Input value={editForm.width} onChange={(e) => setEditForm(f => ({ ...f, width: e.target.value }))} className="h-7 text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Altura</label>
                        <Input value={editForm.height} onChange={(e) => setEditForm(f => ({ ...f, height: e.target.value }))} className="h-7 text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Comprimento</label>
                        <Input value={editForm.length} onChange={(e) => setEditForm(f => ({ ...f, length: e.target.value }))} className="h-7 text-xs" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Modelo de Loja</label>
                      <Input value={editForm.store_category} onChange={(e) => setEditForm(f => ({ ...f, store_category: e.target.value }))} className="h-7 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Especificação</label>
                      <Input value={editForm.specification} onChange={(e) => setEditForm(f => ({ ...f, specification: e.target.value }))} className="h-7 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Instruções de Instalação</label>
                      <Input value={editForm.installation_instructions} onChange={(e) => setEditForm(f => ({ ...f, installation_instructions: e.target.value }))} className="h-7 text-xs" />
                    </div>
                    {/* Piece image in edit mode */}
                    <div className="flex items-center gap-2">
                      {p.image_url && (
                        <div className="relative">
                          <img src={getThumbnailUrl(p.image_url, 150)} alt={p.name} loading="lazy" decoding="async" className="w-16 h-16 object-contain rounded border border-border" />
                          <button onClick={() => handleRemovePieceImage(p.id)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                      <div className="relative">
                        <input type="file" accept="image/*" onChange={(e) => handlePieceImageUpload(p.id, e)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <div className="flex items-center gap-1 px-2 py-1 rounded border border-dashed border-border text-[10px] text-muted-foreground hover:border-primary/50">
                          <Image className="w-3 h-3" /> {p.image_url ? "Trocar" : "Foto"}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="text-xs flex-1" onClick={saveEditPiece}>Salvar</Button>
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditingPieceId(null)}>Cancelar</Button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={kp.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-lg border ${idx % 2 === 0 ? 'bg-muted/20 border-border' : 'bg-primary/10 border-primary/20'}`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <PieceThumbnail imageUrl={p.image_url} name={p.name} size="lg" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary">#{p.code}</span>
                        <span className="font-medium text-sm break-words">{p.name}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{p.category} · {p.size || "—"}</p>
                      <p className="text-[10px] text-muted-foreground break-words">{p.specification}</p>
                    </div>
                  </div>
                  {/* Quantity control */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {canEdit && onUpdateKitPiece ? (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            if (kp.quantity > 1) onUpdateKitPiece({ id: kp.id, quantity: kp.quantity - 1 });
                          }}
                          disabled={kp.quantity <= 1}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          value={kp.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            onUpdateKitPiece({ id: kp.id, quantity: Math.max(1, val) });
                          }}
                          className="w-12 h-7 text-center text-xs p-0"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onUpdateKitPiece({ id: kp.id, quantity: kp.quantity + 1 })}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <span className="text-[10px] text-muted-foreground">un.</span>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-foreground bg-muted px-2 py-1 rounded">{kp.quantity} un.</span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      {onDuplicatePiece && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDuplicatePiece(p)} title="Duplicar peça">
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {onUpdatePiece && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditPiece(p)} title="Editar peça">
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {onDeleteKitPiece && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" title="Remover do kit">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover "{p.name}" do kit?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O que deseja fazer com esta peça?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  onDeleteKitPiece(kp.id);
                                }}
                                className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
                              >
                                Manter peça (disponível para kits)
                              </AlertDialogAction>
                              {onDeletePiece && (
                                <AlertDialogAction
                                  onClick={() => {
                                    onDeleteKitPiece(kp.id);
                                    onDeletePiece(p.id);
                                  }}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir peça permanentemente
                                </AlertDialogAction>
                              )}
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add more pieces */}
        {canEdit && onAddKitPiece && (
          <div>
            {!showAddPieces ? (
              <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={() => setShowAddPieces(true)}>
                <Plus className="w-3 h-3" /> Incluir mais peças
              </Button>
            ) : (
              <div className="space-y-1 max-h-[250px] overflow-y-auto border border-border rounded-lg p-2">
                <label className="text-xs font-medium text-muted-foreground">Peças disponíveis desta campanha</label>
                <Input
                  placeholder="Buscar peça por nome, código ou localização..."
                  value={addPieceSearch}
                  onChange={(e) => setAddPieceSearch(e.target.value)}
                  className="h-7 text-xs mb-1"
                  autoFocus
                />
                {kitOnlyPiecesNotInKit.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhuma peça disponível.</p>
                ) : filteredAddPieces.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhuma peça encontrada.</p>
                ) : (
                  filteredAddPieces.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-2 py-1.5 rounded border border-border hover:bg-muted/50">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <PieceThumbnail imageUrl={p.image_url} name={p.name} size="sm" />
                        <span className="text-xs font-bold text-primary">#{p.code}</span>
                        <span className="text-xs truncate">{p.name}</span>
                      </div>
                      <Button size="sm" variant="outline" className="text-[10px] h-6 gap-1" onClick={async () => { await onAddKitPiece({ kit_id: kit.id, piece_id: p.id }); }}>
                        <Plus className="w-2.5 h-2.5" /> Incluir
                      </Button>
                    </div>
                  ))
                )}
                <Button variant="ghost" size="sm" className="w-full text-xs mt-1" onClick={() => { setShowAddPieces(false); setAddPieceSearch(""); }}>Fechar</Button>
              </div>
            )}
          </div>
        )}

        {/* Delete kit */}
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
