import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DebouncedInput from "@/components/DebouncedInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, UserPlus, Settings, X } from "lucide-react";
import {
  useStoreContacts,
  useAddStoreContact,
  useUpdateStoreContact,
  useDeleteStoreContact,
  useStoreContactRoles,
  useAddStoreContactRole,
  useDeleteStoreContactRole,
  type StoreContact,
  type StoreContactRole,
} from "@/hooks/useStoreContacts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)})${digits.slice(2)}`;
  return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7)}`;
}

interface Props {
  storeId: string | undefined;
  clientId: string | undefined;
  canEdit: boolean;
}

const StoreContactsSection = ({ storeId, clientId, canEdit }: Props) => {
  const { data: contacts = [] } = useStoreContacts(storeId);
  const { data: roles = [] } = useStoreContactRoles(clientId);
  const addContact = useAddStoreContact();
  const updateContact = useUpdateStoreContact();
  const deleteContact = useDeleteStoreContact();
  const addRole = useAddStoreContactRole();
  const deleteRole = useDeleteStoreContactRole();

  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "", role_id: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [deleteRoleConfirm, setDeleteRoleConfirm] = useState<string | null>(null);

  const getRoleName = (roleId: string | null) => {
    if (!roleId) return "—";
    return roles.find(r => r.id === roleId)?.name || "—";
  };

  const handleAddContact = async () => {
    if (!storeId || !newContact.name.trim()) return;
    await addContact.mutateAsync({
      store_id: storeId,
      name: newContact.name.trim(),
      phone: newContact.phone || undefined,
      email: newContact.email || undefined,
      role_id: newContact.role_id || null,
    });
    setNewContact({ name: "", phone: "", email: "", role_id: "" });
    setShowAdd(false);
  };

  const handleDeleteContact = async (contact: StoreContact) => {
    await deleteContact.mutateAsync({ id: contact.id, store_id: contact.store_id });
  };

  const handleUpdateField = async (contact: StoreContact, field: string, value: string) => {
    await updateContact.mutateAsync({ id: contact.id, [field]: field === "role_id" ? (value || null) : value });
  };

  const handleAddRole = async () => {
    if (!clientId || !newRoleName.trim()) return;
    await addRole.mutateAsync({ client_id: clientId, name: newRoleName.trim() });
    setNewRoleName("");
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!clientId) return;
    await deleteRole.mutateAsync({ id: roleId, client_id: clientId });
    setDeleteRoleConfirm(null);
  };

  return (
    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />
          Contatos da Loja
        </h3>
        <div className="flex items-center gap-1">
          {canEdit && (
            <>
              <Dialog open={rolesOpen} onOpenChange={setRolesOpen}>
                <DialogTrigger asChild>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs">
                    <Settings className="w-3 h-3 mr-1" /> Cargos
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>Gerenciar Cargos</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Novo cargo..."
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddRole())}
                        className="text-sm"
                      />
                      <Button type="button" size="sm" onClick={handleAddRole} disabled={!newRoleName.trim() || addRole.isPending}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {roles.map(role => (
                        <div key={role.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50">
                          <span className="text-sm">{role.name}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive"
                            onClick={() => setDeleteRoleConfirm(role.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      {roles.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum cargo cadastrado</p>}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <AlertDialog open={!!deleteRoleConfirm} onOpenChange={(o) => !o && setDeleteRoleConfirm(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir cargo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Os contatos que possuem este cargo ficarão sem cargo atribuído.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteRoleConfirm && handleDeleteRole(deleteRoleConfirm)}>
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Contact list */}
      <div className="space-y-2">
        {contacts.map((contact) => (
          <div key={contact.id} className="flex flex-wrap items-center gap-2 bg-background rounded-md border border-border p-2">
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] text-muted-foreground">Contato</label>
              <Input
                value={contact.name}
                onChange={(e) => handleUpdateField(contact, "name", e.target.value)}
                onBlur={(e) => handleUpdateField(contact, "name", e.target.value)}
                className="h-7 text-xs"
                disabled={!canEdit}
              />
            </div>
            <div className="w-[110px]">
              <label className="text-[10px] text-muted-foreground">Cargo</label>
              <Select
                value={contact.role_id || "__none__"}
                onValueChange={(v) => handleUpdateField(contact, "role_id", v === "__none__" ? "" : v)}
                disabled={!canEdit}
              >
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[130px]">
              <label className="text-[10px] text-muted-foreground">Telefone</label>
              <div className="flex gap-0.5 items-center">
                <Input
                  value={contact.phone ? formatPhone(contact.phone) : ""}
                  onChange={(e) => handleUpdateField(contact, "phone", formatPhone(e.target.value))}
                  className="h-7 text-xs"
                  placeholder="(00)00000-0000"
                  maxLength={14}
                  disabled={!canEdit}
                />
                {contact.phone && (
                  <a
                    href={`https://wa.me/55${contact.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, ${contact.name.split(" ")[0]}, como vai?`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors"
                    title="Enviar WhatsApp"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-green-600 fill-current">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </a>
                )}
              </div>
            </div>
            {canEdit && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive mt-3"
                onClick={() => handleDeleteContact(contact)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        ))}
        {contacts.length === 0 && !showAdd && (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhum contato cadastrado</p>
        )}
      </div>

      {/* Add new contact */}
      {canEdit && (
        showAdd ? (
          <div className="flex flex-wrap items-end gap-2 bg-background rounded-md border border-dashed border-primary/30 p-2">
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] text-muted-foreground">Contato</label>
              <Input
                value={newContact.name}
                onChange={(e) => setNewContact(c => ({ ...c, name: e.target.value }))}
                className="h-7 text-xs"
                placeholder="Nome do contato"
                autoFocus
              />
            </div>
            <div className="w-[110px]">
              <label className="text-[10px] text-muted-foreground">Cargo</label>
              <Select
                value={newContact.role_id || "__none__"}
                onValueChange={(v) => setNewContact(c => ({ ...c, role_id: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[130px]">
              <label className="text-[10px] text-muted-foreground">Telefone</label>
              <Input
                value={formatPhone(newContact.phone)}
                onChange={(e) => setNewContact(c => ({ ...c, phone: formatPhone(e.target.value) }))}
                className="h-7 text-xs"
                placeholder="(00)00000-0000"
                maxLength={14}
              />
            </div>
            <div className="flex gap-1 mt-3">
              <Button type="button" size="sm" className="h-7 text-xs" onClick={handleAddContact} disabled={!newContact.name.trim() || addContact.isPending}>
                Salvar
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowAdd(false); setNewContact({ name: "", phone: "", email: "", role_id: "" }); }}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs border-dashed"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="w-3 h-3 mr-1" /> Adicionar Contato
          </Button>
        )
      )}
    </div>
  );
};

export default StoreContactsSection;
