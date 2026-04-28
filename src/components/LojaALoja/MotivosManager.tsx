import { useState } from "react";
import {
  useStorePortalMotivos,
  useAddMotivo,
  useUpdateMotivo,
  useDeleteMotivo,
  useReorderMotivos,
  type PortalMotivo,
} from "@/hooks/useStorePortalMotivos";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus, Check, X, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";
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
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SubAreaPermission { canView: boolean; canEdit: boolean; canDelete: boolean }

interface Props {
  clientId: string;
  permissions: SubAreaPermission;
  embedded?: boolean;
}

function SortableMotivoRow({
  m,
  canEdit,
  canDelete,
  isEditing,
  editValue,
  onChangeEditValue,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onToggleAtivo,
  onDelete,
}: {
  m: PortalMotivo;
  canEdit: boolean;
  canDelete: boolean;
  isEditing: boolean;
  editValue: string;
  onChangeEditValue: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onToggleAtivo: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: m.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-3">
      {canEdit && (
        <button
          type="button"
          className="shrink-0 cursor-grab active:cursor-grabbing touch-none text-muted-foreground/60 hover:text-muted-foreground p-1 -ml-1"
          aria-label="Arrastar para reordenar"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {isEditing ? (
        <>
          <Input
            value={editValue}
            onChange={(e) => onChangeEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            autoFocus
            className="h-8"
            disabled={!canEdit}
          />
          <Button size="sm" variant="ghost" onClick={onSaveEdit} className="h-8 px-2" disabled={!canEdit}>
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancelEdit} className="h-8 px-2">
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <span className={`flex-1 text-sm ${m.ativo ? "" : "text-muted-foreground line-through"}`}>
            {m.descricao}
          </span>
          {(canEdit || canDelete) && (
            <>
              {canEdit && <Switch checked={m.ativo} onCheckedChange={onToggleAtivo} />}
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={onStartEdit} className="h-8 w-8 p-0">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {canDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDelete}
                  className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function MotivosManager({ clientId, permissions, embedded = false }: Props) {
  const canEdit = permissions.canEdit;
  const canDelete = permissions.canDelete;
  const { data: motivos = [], isLoading } = useStorePortalMotivos(clientId);
  const addMutation = useAddMotivo();
  const updateMutation = useUpdateMotivo();
  const deleteMutation = useDeleteMotivo();
  const reorderMutation = useReorderMotivos();

  const [newDescricao, setNewDescricao] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PortalMotivo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleAdd = async () => {
    const v = newDescricao.trim();
    if (!v) return;
    try {
      await addMutation.mutateAsync({ client_id: clientId, descricao: v });
      setNewDescricao("");
      toast.success("Motivo adicionado.");
    } catch (e: any) {
      if (e?.code === "23505") toast.error("Esse motivo já existe.");
      else toast.error("Erro ao adicionar motivo.");
    }
  };

  const startEdit = (m: PortalMotivo) => {
    setEditingId(m.id);
    setEditValue(m.descricao);
  };

  const saveEdit = async (m: PortalMotivo) => {
    const v = editValue.trim();
    if (!v) return;
    try {
      await updateMutation.mutateAsync({ id: m.id, client_id: clientId, patch: { descricao: v } });
      setEditingId(null);
      toast.success("Motivo atualizado.");
    } catch (e: any) {
      if (e?.code === "23505") toast.error("Esse motivo já existe.");
      else toast.error("Erro ao atualizar.");
    }
  };

  const toggleAtivo = async (m: PortalMotivo) => {
    try {
      await updateMutation.mutateAsync({ id: m.id, client_id: clientId, patch: { ativo: !m.ativo } });
    } catch {
      toast.error("Erro ao alterar status.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteTarget.id, client_id: clientId });
      toast.success("Motivo removido.");
    } catch {
      toast.error("Erro ao remover motivo.");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = motivos.findIndex((m) => m.id === active.id);
    const newIndex = motivos.findIndex((m) => m.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(motivos, oldIndex, newIndex);
    try {
      await reorderMutation.mutateAsync({
        client_id: clientId,
        orderedIds: reordered.map((m) => m.id),
      });
    } catch {
      toast.error("Erro ao reordenar motivos.");
    }
  };

  const body = (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex gap-2">
          <Input
            placeholder="Novo motivo (ex: Peça danificada)"
            value={newDescricao}
            onChange={(e) => setNewDescricao(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <Button onClick={handleAdd} disabled={!newDescricao.trim() || addMutation.isPending} size="default">
            {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-1">Adicionar</span>
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
      ) : motivos.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum motivo cadastrado.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={motivos.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <div className="border rounded-lg divide-y">
              {motivos.map((m) => (
                <SortableMotivoRow
                  key={m.id}
                  m={m}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  isEditing={editingId === m.id}
                  editValue={editValue}
                  onChangeEditValue={setEditValue}
                  onSaveEdit={() => saveEdit(m)}
                  onCancelEdit={() => setEditingId(null)}
                  onStartEdit={() => startEdit(m)}
                  onToggleAtivo={() => toggleAtivo(m)}
                  onDelete={() => setDeleteTarget(m)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover motivo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover "{deleteTarget?.descricao}"? Ocorrências já criadas com esse motivo serão preservadas, mas o vínculo será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (embedded) return body;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Motivos de Ocorrência</CardTitle>
        <CardDescription>
          Liste e ordene os motivos disponíveis no portal da loja para esse cliente. Arraste para reordenar.
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
