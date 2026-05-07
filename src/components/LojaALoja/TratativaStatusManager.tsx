import { useState } from "react";
import {
  useLalTratativaStatuses,
  useAddTratativaStatus,
  useUpdateTratativaStatus,
  useDeleteTratativaStatus,
  useReorderTratativaStatuses,
  useSetDefaultTratativaStatus,
  type TratativaStatus,
} from "@/hooks/useLalTratativaStatuses";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus, Check, X, Loader2, GripVertical, Star } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SubAreaPermission { canView: boolean; canEdit: boolean; canDelete: boolean }
interface Props { clientId: string; permissions: SubAreaPermission; embedded?: boolean }

function SortableRow({
  s, canEdit, canDelete, isEditing, editLabel, editColor, editResolved,
  onChangeLabel, onChangeColor, onChangeResolved,
  onSave, onCancel, onStartEdit, onToggleAtivo, onSetDefault, onDelete,
}: {
  s: TratativaStatus;
  canEdit: boolean; canDelete: boolean;
  isEditing: boolean;
  editLabel: string; editColor: string; editResolved: boolean;
  onChangeLabel: (v: string) => void;
  onChangeColor: (v: string) => void;
  onChangeResolved: (v: boolean) => void;
  onSave: () => void; onCancel: () => void;
  onStartEdit: () => void; onToggleAtivo: () => void;
  onSetDefault: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-3">
      {canEdit && (
        <button type="button" className="shrink-0 cursor-grab active:cursor-grabbing touch-none text-muted-foreground/60 hover:text-muted-foreground p-1 -ml-1"
          aria-label="Arrastar" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {isEditing ? (
        <>
          <input type="color" value={editColor} onChange={(e) => onChangeColor(e.target.value)}
            className="h-8 w-10 rounded border border-input cursor-pointer" disabled={!canEdit} />
          <Input value={editLabel} onChange={(e) => onChangeLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
            autoFocus className="h-8 flex-1" disabled={!canEdit} />
          <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
            <Switch checked={editResolved} onCheckedChange={onChangeResolved} />
            Resolvido
          </label>
          <Button size="sm" variant="ghost" onClick={onSave} className="h-8 px-2" disabled={!canEdit}>
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} className="h-8 px-2">
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <span className="inline-block w-3 h-3 rounded-full shrink-0 border border-border" style={{ backgroundColor: s.color }} />
          <span className={`flex-1 text-sm flex items-center gap-2 ${s.ativo ? "" : "text-muted-foreground line-through"}`}>
            {s.label}
            {s.is_default && <Badge variant="outline" className="text-[10px] h-4 px-1">Padrão</Badge>}
            {s.is_resolved && <Badge variant="outline" className="text-[10px] h-4 px-1 text-green-700 border-green-300">Resolvido</Badge>}
          </span>
          {(canEdit || canDelete) && (
            <>
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={onSetDefault} className="h-8 w-8 p-0" title="Definir como padrão" disabled={s.is_default}>
                  <Star className={`h-3.5 w-3.5 ${s.is_default ? "fill-yellow-400 text-yellow-500" : ""}`} />
                </Button>
              )}
              {canEdit && <Switch checked={s.ativo} onCheckedChange={onToggleAtivo} />}
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={onStartEdit} className="h-8 w-8 p-0">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {canDelete && (
                <Button size="sm" variant="ghost" onClick={onDelete} className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10">
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

export default function TratativaStatusManager({ clientId, permissions, embedded = false }: Props) {
  const canEdit = permissions.canEdit;
  const canDelete = permissions.canDelete;
  const { data: statuses = [], isLoading } = useLalTratativaStatuses(clientId);
  const addM = useAddTratativaStatus();
  const updateM = useUpdateTratativaStatus();
  const deleteM = useDeleteTratativaStatus();
  const reorderM = useReorderTratativaStatuses();
  const defaultM = useSetDefaultTratativaStatus();

  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#8C6F4E");
  const [newResolved, setNewResolved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("#8C6F4E");
  const [editResolved, setEditResolved] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TratativaStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleAdd = async () => {
    const v = newLabel.trim();
    if (!v) return;
    try {
      await addM.mutateAsync({ client_id: clientId, label: v, color: newColor, is_resolved: newResolved });
      setNewLabel(""); setNewColor("#8C6F4E"); setNewResolved(false);
      toast.success("Status adicionado.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao adicionar status.");
    }
  };

  const startEdit = (s: TratativaStatus) => {
    setEditingId(s.id); setEditLabel(s.label); setEditColor(s.color); setEditResolved(s.is_resolved);
  };

  const saveEdit = async (s: TratativaStatus) => {
    const v = editLabel.trim();
    if (!v) return;
    try {
      await updateM.mutateAsync({ id: s.id, client_id: clientId, patch: { label: v, color: editColor, is_resolved: editResolved } });
      setEditingId(null);
      toast.success("Status atualizado.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar.");
    }
  };

  const toggleAtivo = async (s: TratativaStatus) => {
    try { await updateM.mutateAsync({ id: s.id, client_id: clientId, patch: { ativo: !s.ativo } }); }
    catch { toast.error("Erro ao alterar status."); }
  };

  const setDefault = async (s: TratativaStatus) => {
    try { await defaultM.mutateAsync({ id: s.id, client_id: clientId }); toast.success("Status padrão definido."); }
    catch { toast.error("Erro ao definir padrão."); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteM.mutateAsync({ id: deleteTarget.id, client_id: clientId });
      toast.success("Status removido.");
    } catch { toast.error("Erro ao remover."); }
    finally { setDeleteTarget(null); }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = statuses.findIndex((s) => s.id === active.id);
    const newIdx = statuses.findIndex((s) => s.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(statuses, oldIdx, newIdx);
    try { await reorderM.mutateAsync({ client_id: clientId, orderedIds: reordered.map((s) => s.id) }); }
    catch { toast.error("Erro ao reordenar."); }
  };

  const body = (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap gap-2 items-center">
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
            className="h-9 w-12 rounded border border-input cursor-pointer" />
          <Input placeholder="Novo status (ex: Aguardando peça)" value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }} className="flex-1 min-w-[200px]" />
          <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
            <Switch checked={newResolved} onCheckedChange={setNewResolved} />
            Marca como resolvido
          </label>
          <Button onClick={handleAdd} disabled={!newLabel.trim() || addM.isPending}>
            {addM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-1">Adicionar</span>
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
      ) : statuses.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Nenhum status personalizado. Os status padrão (Aberta, Em andamento, Resolvida) estão em uso.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={statuses.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="border rounded-lg divide-y">
              {statuses.map((s) => (
                <SortableRow key={s.id} s={s} canEdit={canEdit} canDelete={canDelete}
                  isEditing={editingId === s.id}
                  editLabel={editLabel} editColor={editColor} editResolved={editResolved}
                  onChangeLabel={setEditLabel} onChangeColor={setEditColor} onChangeResolved={setEditResolved}
                  onSave={() => saveEdit(s)} onCancel={() => setEditingId(null)}
                  onStartEdit={() => startEdit(s)} onToggleAtivo={() => toggleAtivo(s)}
                  onSetDefault={() => setDefault(s)} onDelete={() => setDeleteTarget(s)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover status</AlertDialogTitle>
            <AlertDialogDescription>
              Remover "{deleteTarget?.label}"? Ocorrências que já usam esse status manterão o valor, mas ele não aparecerá mais como opção.
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
        <CardTitle className="text-lg">Status da Tratativa</CardTitle>
        <CardDescription>
          Personalize os status disponíveis para a tratativa das ocorrências (rótulo, cor, ordem). Marque um como padrão (usado em novas ocorrências) e quais contam como "resolvido".
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
