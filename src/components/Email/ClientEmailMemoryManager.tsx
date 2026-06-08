import { useMemo, useState } from "react";
import { useClientEmailMemory } from "@/hooks/useClientEmailMemory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Mail, Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { parseRecipients, EMAIL_REGEX } from "@/lib/emailRecipients";

interface Props {
  clientId: string;
  canEdit: boolean;
}

export default function ClientEmailMemoryManager({ clientId, canEdit }: Props) {
  const { entries, isLoading, removeEmail, updateEmail, updateContactName, record } = useClientEmailMemory({ clientId });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [addValue, setAddValue] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameValue, setNameValue] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      e.email.toLowerCase().includes(q) ||
      (e.contact_name ?? "").toLowerCase().includes(q),
    );
  }, [entries, search]);

  const startNameEdit = (email: string, current: string | null) => {
    setEditingName(email);
    setNameValue(current ?? "");
  };
  const cancelNameEdit = () => { setEditingName(null); setNameValue(""); };
  const saveNameEdit = async (email: string) => {
    try {
      await updateContactName({ email, contactName: nameValue });
      cancelNameEdit();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar o nome.");
    }
  };

  const startEdit = (email: string) => {
    setEditing(email);
    setEditValue(email);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue("");
  };

  const saveEdit = async (oldEmail: string) => {
    try {
      await updateEmail({ oldEmail, newEmail: editValue });
      toast.success("E-mail atualizado.");
      cancelEdit();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível atualizar o e-mail.");
    }
  };

  const handleDelete = async (email: string) => {
    try {
      await removeEmail(email);
      toast.success("E-mail removido da memória.");
      setConfirmDelete(null);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível remover o e-mail.");
    }
  };

  const handleAdd = () => {
    const parsed = parseRecipients(addValue);
    const valid = parsed.filter((e) => EMAIL_REGEX.test(e));
    const invalid = parsed.filter((e) => !EMAIL_REGEX.test(e));
    if (invalid.length) {
      toast.error(`E-mail inválido: ${invalid.join(", ")}`);
      return;
    }
    if (!valid.length) {
      toast.error("Informe ao menos um e-mail.");
      return;
    }
    const existing = new Set(entries.map((e) => e.email.toLowerCase()));
    const newOnes = valid.filter((e) => !existing.has(e));
    record(valid);
    setAddValue("");
    if (newOnes.length === 0) {
      toast.info("Esses e-mails já estavam na memória.");
    } else {
      toast.success(`${newOnes.length} e-mail(s) adicionado(s) à memória.`);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Input
          type="text"
          placeholder="Adicionar e-mail(s) — separe por vírgula"
          value={addValue}
          onChange={(e) => setAddValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (canEdit) handleAdd();
            }
          }}
          disabled={!canEdit}
          className="h-9 text-sm flex-1 min-w-[220px]"
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!canEdit || !addValue.trim()}
          className="h-9 gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Adicionar
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm font-semibold text-foreground">
          {entries.length} e-mail(s) salvo(s)
        </span>
        <div className="flex-1 min-w-[160px] max-w-xs">
          <Input
            placeholder="Buscar e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Esta é a memória de e-mails usados em envios desta agência. Os e-mails são sugeridos automaticamente nos formulários de envio de cotações, ajustes e aprovações para todos os clientes.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <p className="text-muted-foreground text-sm">
            {search ? "Nenhum e-mail encontrado." : "Nenhum e-mail salvo ainda. A memória é alimentada automaticamente a cada envio."}
          </p>
        </div>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">E-mail</TableHead>
                <TableHead className="text-xs">Contato</TableHead>
                <TableHead className="text-xs">Usos</TableHead>
                <TableHead className="text-xs">Último uso</TableHead>
                {canEdit && <TableHead className="text-xs text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => {
                const isEditing = editing === entry.email;
                return (
                  <TableRow key={entry.email}>
                    <TableCell className="text-sm font-medium">
                      {isEditing ? (
                        <Input
                          autoFocus
                          type="email"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(entry.email);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="h-8 text-sm"
                        />
                      ) : (
                        entry.email
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {editingName === entry.email ? (
                        <div className="flex items-center gap-1">
                          <Input
                            autoFocus
                            value={nameValue}
                            onChange={(e) => setNameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveNameEdit(entry.email);
                              if (e.key === "Escape") cancelNameEdit();
                            }}
                            placeholder="Nome do contato"
                            className="h-7 text-xs"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-green-600 shrink-0"
                            onClick={() => saveNameEdit(entry.email)}
                            title="Salvar"
                          >
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={cancelNameEdit}
                            title="Cancelar"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : canEdit ? (
                        <button
                          type="button"
                          onClick={() => startNameEdit(entry.email, entry.contact_name)}
                          className="text-left hover:underline text-foreground/90 disabled:cursor-not-allowed"
                          title="Editar nome do contato"
                        >
                          {entry.contact_name || <span className="text-muted-foreground italic">adicionar</span>}
                        </button>
                      ) : (
                        entry.contact_name || <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{entry.usage_count}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.last_used_at
                        ? new Date(entry.last_used_at).toLocaleString()
                        : "—"}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-green-600"
                                onClick={() => saveEdit(entry.email)}
                                title="Salvar"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={cancelEdit}
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => startEdit(entry.email)}
                                title="Editar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => setConfirmDelete(entry.email)}
                                title="Remover"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover e-mail da memória?</AlertDialogTitle>
            <AlertDialogDescription>
              O e-mail <span className="font-medium">{confirmDelete}</span> deixará de aparecer como sugestão nos próximos envios deste cliente. Esta ação não afeta envios anteriores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
