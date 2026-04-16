import { useState } from "react";
import { useStorePortalMotivos, useAddMotivo, useUpdateMotivo, useDeleteMotivo, type PortalMotivo } from "@/hooks/useStorePortalMotivos";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  clientId: string;
  isAdmin: boolean;
  embedded?: boolean;
}

export default function MotivosManager({ clientId, isAdmin, embedded = false }: Props) {
  const { data: motivos = [], isLoading } = useStorePortalMotivos(clientId);
  const addMutation = useAddMotivo();
  const updateMutation = useUpdateMotivo();
  const deleteMutation = useDeleteMotivo();

  const [newDescricao, setNewDescricao] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PortalMotivo | null>(null);

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

  const body = (
    <div className="space-y-3">
      {/* original CardContent body below; rendered conditionally with or without Card wrapper */}
        {isAdmin && (
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
          <div className="border rounded-lg divide-y">
            {motivos.map((m) => (
              <div key={m.id} className="flex items-center gap-2 p-3">
                {editingId === m.id ? (
                  <>
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(m); if (e.key === "Escape") setEditingId(null); }}
                      autoFocus
                      className="h-8"
                    />
                    <Button size="sm" variant="ghost" onClick={() => saveEdit(m)} className="h-8 px-2">
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8 px-2">
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className={`flex-1 text-sm ${m.ativo ? "" : "text-muted-foreground line-through"}`}>{m.descricao}</span>
                    {isAdmin && (
                      <>
                        <Switch checked={m.ativo} onCheckedChange={() => toggleAtivo(m)} />
                        <Button size="sm" variant="ghost" onClick={() => startEdit(m)} className="h-8 w-8 p-0">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(m)} className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
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
      </CardContent>
    </Card>
  );
}
