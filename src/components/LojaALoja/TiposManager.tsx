import { useState, useRef, useCallback, useEffect } from "react";
import { useHistory } from "@/lib/undo/useHistory";
import { historyStore } from "@/lib/undo/historyStore";
import { UndoRedoToolbar } from "@/components/UndoRedoToolbar";
import { getThumbnailUrl } from "@/lib/imageUrl";
import { supabase } from "@/integrations/supabase/client";
import {
  useLojaALojaTipos,
  useLojaALojaPecas,
  useAllLojaALojaPecas,
  useAddTipo,
  useUpdateTipo,
  useDeleteTipo,
  useAddSubdivisao,
  useUpdateSubdivisao,
  useDeleteSubdivisao,
  useAddPeca,
  useDeletePeca,
  useUpdatePecaImage,
  useUpdatePecaNome,
  useReorderTipos,
  useReorderSubdivisoes,
  useReorderPecas,
  type LojaALojaTipo,
  type LojaALojaSubdivisao,
  type LojaALojaPeca,
} from "@/hooks/useLojaALoja";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, Image, ImagePlus, ChevronRight, X, Upload, Check, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SubAreaPermission {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface TiposManagerProps {
  campaignId: string;
  permissions: SubAreaPermission;
}

/** Resize image proportionally (contain) into a square canvas with white background */
function cropSquare(file: File, size = 400, quality = 0.7): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, size, size);
      const scale = Math.min(size / img.width, size / img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const x = Math.round((size - w) / 2);
      const y = Math.round((size - h) / 2);
      ctx.drawImage(img, 0, 0, img.width, img.height, x, y, w, h);
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

/* ── Sortable Tipo Row ── */
function SortableTipoRow({
  tipo,
  isSelected,
  isExpanded,
  isEditing,
  editingNome,
  pecaCount,
  canEdit,
  canDelete,
  onSelect,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onChangeEditNome,
  onDelete,
  children,
}: {
  tipo: LojaALojaTipo;
  isSelected: boolean;
  isExpanded: boolean;
  isEditing: boolean;
  editingNome: string;
  pecaCount: number;
  canEdit: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onChangeEditNome: (v: string) => void;
  onDelete: () => void;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tipo.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          "flex items-center gap-1 px-1 py-1.5 rounded-md cursor-pointer transition-colors group",
          isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/60 text-foreground",
        )}
        onClick={onSelect}
      >
        <button
          type="button"
          className="shrink-0 cursor-grab active:cursor-grabbing touch-none text-muted-foreground/50 hover:text-muted-foreground"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0"
          style={{ backgroundColor: "hsl(var(--primary))" }}
        >
          {tipo.letra}
        </span>

        {isEditing ? (
          <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <Input
              value={editingNome}
              onChange={(e) => onChangeEditNome(e.target.value)}
              className="h-7 text-xs flex-1"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && onSaveEdit()}
            />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onSaveEdit}><Check className="w-3 h-3" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onCancelEdit}><X className="w-3 h-3" /></Button>
          </div>
        ) : (
          <>
            <span className="text-xs font-medium truncate flex-1">{tipo.nome}</span>
            {pecaCount > 0 && <span className="text-[10px] text-muted-foreground font-normal">{pecaCount}</span>}
            {tipo.tem_subdivisao && (
              <ChevronRight className={cn("w-3 h-3 transition-transform text-muted-foreground", isExpanded && "rotate-90")} />
            )}
            {(canEdit || canDelete) && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                {canEdit && (
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onStartEdit(); }}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                )}
                {canDelete && (
                  <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {children}
    </div>
  );
}

/* ── Sortable Subdivisao Row ── */
function SortableSubRow({
  sub,
  isSelected,
  isEditing,
  editingNome,
  pecaCount,
  canEdit,
  canDelete,
  onSelect,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onChangeEditNome,
  onDelete,
}: {
  sub: LojaALojaSubdivisao;
  isSelected: boolean;
  isEditing: boolean;
  editingNome: string;
  pecaCount: number;
  canEdit: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onChangeEditNome: (v: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sub.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1 px-1 py-1 rounded-md cursor-pointer transition-colors group/sub text-xs",
        isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/60 text-muted-foreground",
      )}
      onClick={onSelect}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab active:cursor-grabbing touch-none text-muted-foreground/50 hover:text-muted-foreground"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3 h-3" />
      </button>

      {isEditing ? (
        <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          <Input value={editingNome} onChange={(e) => onChangeEditNome(e.target.value)} className="h-6 text-xs flex-1" autoFocus onKeyDown={(e) => e.key === "Enter" && onSaveEdit()} />
          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={onSaveEdit}><Check className="w-3 h-3" /></Button>
          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={onCancelEdit}><X className="w-3 h-3" /></Button>
        </div>
      ) : (
        <>
          <span className="truncate flex-1">{sub.nome}</span>
          {pecaCount > 0 && <span className="text-[10px] text-muted-foreground font-normal">{pecaCount}</span>}
          {(canEdit || canDelete) && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover/sub:opacity-100">
              {canEdit && (
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onStartEdit(); }}>
                  <Pencil className="w-3 h-3" />
                </Button>
              )}
              {canDelete && (
                <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Sortable Piece Card ── */
function SortablePieceCard({
  peca,
  canEdit,
  canDelete,
  isDragOverImage,
  isUploading,
  isEditingName,
  editingNome,
  onDragOverImage,
  onDragLeaveImage,
  onDropImage,
  onClickImage,
  fileInputRef,
  onFileChange,
  onStartEditName,
  onChangeEditName,
  onBlurEditName,
  onKeyDownEditName,
  onDelete,
}: {
  peca: LojaALojaPeca;
  canEdit: boolean;
  canDelete: boolean;
  isDragOverImage: boolean;
  isUploading: boolean;
  isEditingName: boolean;
  editingNome: string;
  onDragOverImage: () => void;
  onDragLeaveImage: () => void;
  onDropImage: (file: File) => void;
  onClickImage: () => void;
  fileInputRef: (el: HTMLInputElement | null) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartEditName: () => void;
  onChangeEditName: (v: string) => void;
  onBlurEditName: () => void;
  onKeyDownEditName: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: peca.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative"
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOverImage(); }}
      onDragEnter={(e) => { e.preventDefault(); onDragOverImage(); }}
      onDragLeave={(e) => { e.preventDefault(); onDragLeaveImage(); }}
      onDrop={(e) => { e.preventDefault(); onDragLeaveImage(); const file = e.dataTransfer.files?.[0]; if (file) onDropImage(file); }}
    >
      {/* Drag handle */}
      {canEdit && (
        <div className="absolute top-1 left-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            className="h-6 w-6 rounded bg-foreground/70 hover:bg-[#8C6F4E] flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-3 h-3 text-white" />
          </button>
        </div>
      )}

      <div
        className={cn(
          "aspect-square rounded-lg border overflow-hidden flex items-center justify-center relative cursor-pointer transition-all",
          isDragOverImage
            ? "border-2 border-dashed border-[#8C6F4E] bg-[#8C6F4E]/10"
            : peca.image_url
              ? "border-border bg-muted/30"
              : "border-dashed border-border bg-muted/20 hover:border-primary/40",
        )}
        onClick={() => { if (!isUploading && canEdit) onClickImage(); }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />

        {peca.image_url ? (
          <img src={getThumbnailUrl(peca.image_url, 200)} alt={peca.nome} loading="lazy" decoding="async" className="w-full h-full object-contain bg-white" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground/40">
            <Image className="w-6 h-6" />
            {canEdit && <span className="text-[9px]">Arraste ou clique</span>}
          </div>
        )}

        {isDragOverImage && (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center rounded-lg">
            <span className="text-xs font-medium text-primary">Solte a imagem aqui</span>
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded-lg">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {(canEdit || canDelete) && !isUploading && !isDragOverImage && (
          <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {canEdit && (
              <>
                <button type="button" className="h-6 w-6 rounded bg-foreground/70 hover:bg-[#8C6F4E] flex items-center justify-center transition-colors" title="Editar nome"
                  onClick={(e) => { e.stopPropagation(); onStartEditName(); }}>
                  <Pencil className="w-3 h-3 text-white" />
                </button>
                <button type="button" className="h-6 w-6 rounded bg-foreground/70 hover:bg-[#8C6F4E] flex items-center justify-center transition-colors" title="Trocar foto"
                  onClick={(e) => { e.stopPropagation(); onClickImage(); }}>
                  <ImagePlus className="w-3 h-3 text-white" />
                </button>
              </>
            )}
            {canDelete && (
              <button type="button" className="h-6 w-6 rounded bg-foreground/70 hover:bg-destructive flex items-center justify-center transition-colors" title="Apagar"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                <Trash2 className="w-3 h-3 text-white" />
              </button>
            )}
          </div>
        )}
      </div>

      {isEditingName ? (
        <Input
          autoFocus
          className="h-6 text-xs mt-1 px-1"
          value={editingNome}
          onChange={(e) => onChangeEditName(e.target.value)}
          onKeyDown={onKeyDownEditName}
          onBlur={onBlurEditName}
        />
      ) : (
        <p className="text-xs text-foreground mt-1 truncate">{peca.nome}</p>
      )}
    </div>
  );
}

const TiposManager = ({ campaignId, permissions }: TiposManagerProps) => {
  const canEdit = permissions.canEdit;
  const canDelete = permissions.canDelete;
  const { data: tipos, isLoading: loadingTipos } = useLojaALojaTipos(campaignId);
  const { data: allPecas } = useAllLojaALojaPecas(campaignId);

  // Count pieces per tipo and subdivisao
  const pecaCountByTipo = useMemo(() => {
    const map: Record<string, number> = {};
    (allPecas ?? []).forEach((p) => {
      if (p.subdivisao_id) {
        map[`sub:${p.subdivisao_id}`] = (map[`sub:${p.subdivisao_id}`] || 0) + 1;
      } else if (p.tipo_id) {
        map[`tipo:${p.tipo_id}`] = (map[`tipo:${p.tipo_id}`] || 0) + 1;
      }
    });
    return map;
  }, [allPecas]);

  // Selection state
  const [selectedTipoId, setSelectedTipoId] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [expandedTipos, setExpandedTipos] = useState<Set<string>>(new Set());

  // Inline edit state
  const [editingTipoId, setEditingTipoId] = useState<string | null>(null);
  const [editingTipoNome, setEditingTipoNome] = useState("");
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubNome, setEditingSubNome] = useState("");

  // Add tipo form — track which section
  const [showAddTipoSection, setShowAddTipoSection] = useState<"vitrines" | "internos" | null>(null);
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

  // Delete confirmation
  const [deletingTipo, setDeletingTipo] = useState<{ id: string; nome: string } | null>(null);
  const [deletingSub, setDeletingSub] = useState<{ id: string; nome: string } | null>(null);
  const [deletingPeca, setDeletingPeca] = useState<{ id: string; nome: string } | null>(null);

  // Inline edit peca name
  const [editingPecaId, setEditingPecaId] = useState<string | null>(null);
  const [editingPecaNome, setEditingPecaNome] = useState("");

  // Mutations
  const addTipo = useAddTipo();
  const updateTipo = useUpdateTipo();
  const deleteTipo = useDeleteTipo();
  const addSubdivisao = useAddSubdivisao();
  const updateSubdivisao = useUpdateSubdivisao();
  const deleteSubdivisao = useDeleteSubdivisao();
  const addPeca = useAddPeca();
  const deletePeca = useDeletePeca();
  const updatePecaImage = useUpdatePecaImage();
  const updatePecaNome = useUpdatePecaNome();
  const reorderTipos = useReorderTipos();
  const reorderSubdivisoes = useReorderSubdivisoes();
  const reorderPecas = useReorderPecas();

  // Drag & drop / upload state
  const [uploadingPecaId, setUploadingPecaId] = useState<string | null>(null);
  const [dragOverPecaId, setDragOverPecaId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

  /** Shared upload helper — reuses cropSquare, same bucket/path pattern */
  const uploadPecaImage = useCallback(async (file: File, pecaId: string) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Formato não suportado. Use PNG, JPEG ou WebP.");
      return;
    }
    setUploadingPecaId(pecaId);
    try {
      const cropped = await cropSquare(file, 400, 0.7);
      const path = `loja-a-loja-${pecaId}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("piece-images")
        .upload(path, cropped, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("piece-images").getPublicUrl(path);
      await updatePecaImage.mutateAsync({ id: pecaId, image_url: urlData.publicUrl });
    } catch (err: any) {
      toast.error("Erro ao enviar imagem: " + err.message);
    } finally {
      setUploadingPecaId(null);
    }
  }, [updatePecaImage]);

  // Pieces query
  const { data: pecas, isLoading: loadingPecas } = useLojaALojaPecas(
    selectedSubId ? null : selectedTipoId,
    selectedSubId,
  );

  const selectedTipo = tipos?.find((t) => t.id === selectedTipoId);

  // Split into Vitrines / Internos
  const vitrines = useMemo(() => tipos?.filter((t) => !t.tem_subdivisao) ?? [], [tipos]);
  const internos = useMemo(() => tipos?.filter((t) => t.tem_subdivisao) ?? [], [tipos]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  const handleAddTipo = async (temSubdivisao: boolean) => {
    if (!newTipoLetra.trim() || !newTipoNome.trim()) return;
    const maxOrder = tipos ? Math.max(0, ...tipos.map((t) => t.display_order)) : 0;
    await addTipo.mutateAsync({
      campaign_id: campaignId,
      letra: newTipoLetra.trim().toUpperCase(),
      nome: newTipoNome.trim(),
      display_order: maxOrder + 1,
      tem_subdivisao: temSubdivisao,
    });
    setNewTipoLetra("");
    setNewTipoNome("");
    setShowAddTipoSection(null);
  };

  const handleSaveEditTipo = async () => {
    if (!editingTipoId || !editingTipoNome.trim()) return;
    await updateTipo.mutateAsync({ id: editingTipoId, campaign_id: campaignId, nome: editingTipoNome.trim() });
    setEditingTipoId(null);
  };

  const handleConfirmDeleteTipo = async () => {
    if (!deletingTipo) return;
    await deleteTipo.mutateAsync({ id: deletingTipo.id, campaign_id: campaignId });
    if (selectedTipoId === deletingTipo.id) {
      setSelectedTipoId(null);
      setSelectedSubId(null);
    }
    setDeletingTipo(null);
  };

  const handleConfirmDeleteSub = async () => {
    if (!deletingSub) return;
    await deleteSubdivisao.mutateAsync({ id: deletingSub.id, campaign_id: campaignId });
    if (selectedSubId === deletingSub.id) {
      setSelectedSubId(null);
    }
    setDeletingSub(null);
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

  // ── Drag end handlers ──

  const handleDragEndVitrines = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = vitrines.findIndex((t) => t.id === active.id);
    const newIndex = vitrines.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(vitrines, oldIndex, newIndex);
    const items = reordered.map((t, i) => ({ id: t.id, display_order: i + 1 }));
    // Keep internos order offset after vitrines
    const internosItems = internos.map((t, i) => ({ id: t.id, display_order: reordered.length + i + 1 }));
    reorderTipos.mutate({ campaign_id: campaignId, items: [...items, ...internosItems] });
  };

  const handleDragEndInternos = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = internos.findIndex((t) => t.id === active.id);
    const newIndex = internos.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(internos, oldIndex, newIndex);
    // Keep vitrines order, offset internos after
    const vitrinesItems = vitrines.map((t, i) => ({ id: t.id, display_order: i + 1 }));
    const items = reordered.map((t, i) => ({ id: t.id, display_order: vitrines.length + i + 1 }));
    reorderTipos.mutate({ campaign_id: campaignId, items: [...vitrinesItems, ...items] });
  };

  const handleDragEndSubs = (tipoId: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const tipo = tipos?.find((t) => t.id === tipoId);
    const subs = tipo?.subdivisoes ?? [];
    const oldIndex = subs.findIndex((s) => s.id === active.id);
    const newIndex = subs.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(subs, oldIndex, newIndex);
    const items = reordered.map((s, i) => ({ id: s.id, display_order: i + 1 }));
    reorderSubdivisoes.mutate({ campaign_id: campaignId, items });
  };

  const handleDragEndPecas = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !pecas) return;
    const oldIndex = pecas.findIndex((p) => p.id === active.id);
    const newIndex = pecas.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(pecas, oldIndex, newIndex);
    const items = reordered.map((p, i) => ({ id: p.id, display_order: i + 1 }));
    reorderPecas.mutate({ items });
  };

  // ── Render add tipo form ──
  const renderAddTipoForm = (section: "vitrines" | "internos") => {
    if (showAddTipoSection !== section) {
      return (
        <button
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 px-2 pt-2 w-full"
          onClick={() => setShowAddTipoSection(section)}
        >
          <Plus className="w-3 h-3" /> Novo Tipo
        </button>
      );
    }
    return (
      <div className="space-y-1 pt-2">
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
            onKeyDown={(e) => e.key === "Enter" && handleAddTipo(section === "internos")}
          />
        </div>
        <div className="flex gap-1">
          <Button size="sm" className="h-7 text-xs flex-1" onClick={() => handleAddTipo(section === "internos")} disabled={addTipo.isPending}>
            Salvar
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddTipoSection(null)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  };

  // Helper to get peca count for a tipo
  const getTipoCount = (tipo: LojaALojaTipo) =>
    tipo.tem_subdivisao
      ? (tipo.subdivisoes ?? []).reduce((sum, s) => sum + (pecaCountByTipo[`sub:${s.id}`] || 0), 0)
      : (pecaCountByTipo[`tipo:${tipo.id}`] || 0);

  // ── Render ──

  return (
    <div className="flex flex-col md:flex-row gap-4 min-h-[400px]">
      {/* ── Left column: Tipos list ── */}
      <div className="w-full md:w-72 shrink-0 border border-border rounded-lg bg-card p-3 space-y-1 overflow-y-auto max-h-[70vh]">
        {loadingTipos ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))
        ) : (
          <>
            {/* Vitrines section */}
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-1">Vitrines</h4>
              {vitrines.length === 0 && (
                <p className="text-xs text-muted-foreground/60 px-2">Nenhum tipo cadastrado</p>
              )}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndVitrines}>
                <SortableContext items={vitrines.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {vitrines.map((tipo) => (
                    <SortableTipoRow
                      key={tipo.id}
                      tipo={tipo}
                      isSelected={selectedTipoId === tipo.id && !selectedSubId}
                      isExpanded={expandedTipos.has(tipo.id)}
                      isEditing={editingTipoId === tipo.id}
                      editingNome={editingTipoNome}
                      pecaCount={getTipoCount(tipo)}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      onSelect={() => handleSelectTipo(tipo)}
                      onStartEdit={() => { setEditingTipoId(tipo.id); setEditingTipoNome(tipo.nome); }}
                      onSaveEdit={handleSaveEditTipo}
                      onCancelEdit={() => setEditingTipoId(null)}
                      onChangeEditNome={setEditingTipoNome}
                      onDelete={() => setDeletingTipo({ id: tipo.id, nome: tipo.nome })}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {canEdit && renderAddTipoForm("vitrines")}
            </div>

            {/* Internos section */}
            <div className="space-y-1 pt-3 mt-3 border-t border-border">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-1">Internos</h4>
              {internos.length === 0 && (
                <p className="text-xs text-muted-foreground/60 px-2">Nenhum tipo cadastrado</p>
              )}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndInternos}>
                <SortableContext items={internos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {internos.map((tipo) => (
                    <SortableTipoRow
                      key={tipo.id}
                      tipo={tipo}
                      isSelected={selectedTipoId === tipo.id && !selectedSubId}
                      isExpanded={expandedTipos.has(tipo.id)}
                      isEditing={editingTipoId === tipo.id}
                      editingNome={editingTipoNome}
                      pecaCount={getTipoCount(tipo)}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      onSelect={() => handleSelectTipo(tipo)}
                      onStartEdit={() => { setEditingTipoId(tipo.id); setEditingTipoNome(tipo.nome); }}
                      onSaveEdit={handleSaveEditTipo}
                      onCancelEdit={() => setEditingTipoId(null)}
                      onChangeEditNome={setEditingTipoNome}
                      onDelete={() => setDeletingTipo({ id: tipo.id, nome: tipo.nome })}
                    >
                      {/* Subdivisoes */}
                      {tipo.tem_subdivisao && expandedTipos.has(tipo.id) && (
                        <div className="ml-6 mt-0.5 space-y-0.5">
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndSubs(tipo.id)}>
                            <SortableContext items={(tipo.subdivisoes ?? []).map((s) => s.id)} strategy={verticalListSortingStrategy}>
                              {tipo.subdivisoes?.map((sub) => (
                                <SortableSubRow
                                  key={sub.id}
                                  sub={sub}
                                  isSelected={selectedSubId === sub.id}
                                  isEditing={editingSubId === sub.id}
                                  editingNome={editingSubNome}
                                  pecaCount={pecaCountByTipo[`sub:${sub.id}`] || 0}
                                  canEdit={canEdit}
                                  canDelete={canDelete}
                                  onSelect={() => handleSelectSub(sub)}
                                  onStartEdit={() => { setEditingSubId(sub.id); setEditingSubNome(sub.nome); }}
                                  onSaveEdit={handleSaveEditSub}
                                  onCancelEdit={() => setEditingSubId(null)}
                                  onChangeEditNome={setEditingSubNome}
                                  onDelete={() => setDeletingSub({ id: sub.id, nome: sub.nome })}
                                />
                              ))}
                            </SortableContext>
                          </DndContext>

                          {canEdit && (
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
                    </SortableTipoRow>
                  ))}
                </SortableContext>
              </DndContext>
              {canEdit && renderAddTipoForm("internos")}
            </div>
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
              {canEdit && (
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
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndPecas}>
                <SortableContext items={pecas.map((p) => p.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {pecas.map((peca) => {
                      const isDragOver = dragOverPecaId === peca.id;
                      const isUploading = uploadingPecaId === peca.id;
                      const isEditingName = editingPecaId === peca.id;
                      return (
                        <SortablePieceCard
                          key={peca.id}
                          peca={peca}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          isDragOverImage={isDragOver}
                          isUploading={isUploading}
                          isEditingName={isEditingName}
                          editingNome={editingPecaNome}
                          onDragOverImage={() => setDragOverPecaId(peca.id)}
                          onDragLeaveImage={() => { if (dragOverPecaId === peca.id) setDragOverPecaId(null); }}
                          onDropImage={(file) => uploadPecaImage(file, peca.id)}
                          onClickImage={() => { if (canEdit) fileInputRefs.current[peca.id]?.click(); }}
                          fileInputRef={(el) => { fileInputRefs.current[peca.id] = el; }}
                          onFileChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) uploadPecaImage(file, peca.id); }}
                          onStartEditName={() => { setEditingPecaId(peca.id); setEditingPecaNome(peca.nome); }}
                          onChangeEditName={setEditingPecaNome}
                          onBlurEditName={() => {
                            const trimmed = editingPecaNome.trim();
                            if (trimmed && trimmed !== peca.nome) {
                              updatePecaNome.mutate({ id: peca.id, nome: trimmed });
                            }
                            setEditingPecaId(null);
                          }}
                          onKeyDownEditName={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            else if (e.key === "Escape") setEditingPecaId(null);
                          }}
                          onDelete={() => setDeletingPeca({ id: peca.id, nome: peca.nome })}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
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
                  <img src={newPecaPreview} alt="Preview" loading="lazy" decoding="async" className="w-full aspect-square object-cover rounded-lg border border-border" />
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

      {/* ── Delete Tipo AlertDialog ── */}
      <AlertDialog open={!!deletingTipo} onOpenChange={(open) => !open && setDeletingTipo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar tipo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar "{deletingTipo?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteTipo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Subdivisao AlertDialog ── */}
      <AlertDialog open={!!deletingSub} onOpenChange={(open) => !open && setDeletingSub(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar subdivisão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar "{deletingSub?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteSub} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Peca AlertDialog ── */}
      <AlertDialog open={!!deletingPeca} onOpenChange={(open) => !open && setDeletingPeca(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar peça</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar "{deletingPeca?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingPeca) {
                  deletePeca.mutate({ id: deletingPeca.id });
                  setDeletingPeca(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TiposManager;
