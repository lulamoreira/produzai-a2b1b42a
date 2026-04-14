import { useState } from "react";
import {
  usePermissionCategories, useAddPermissionCategory,
  useUpdatePermissionCategory, useDeletePermissionCategory,
  type PermissionCategory,
} from "@/hooks/usePermissionCategories";
import { Plus, Edit3, Trash2, Eye, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MODULES = [
  { key: "clients", label: "Clientes", icon: "🏢" },
  { key: "campaigns", label: "Campanhas", icon: "📢" },
  { key: "stores", label: "Lojas", icon: "🏪" },
  { key: "campaign_stores", label: "Lojas (Campanhas)", icon: "📍" },
  { key: "pieces", label: "Peças", icon: "🧩" },
  { key: "occurrences", label: "Ocorrências", icon: "📋" },
  { key: "schedules", label: "Agendamento", icon: "📅" },
  { key: "installations", label: "Instalações", icon: "📷" },
] as const;

const PERMISSIONS = [
  { key: "view", label: "Ver", icon: <Eye className="w-3.5 h-3.5" /> },
  { key: "edit", label: "Editar", icon: <Pencil className="w-3.5 h-3.5" /> },
  { key: "delete", label: "Apagar", icon: <X className="w-3.5 h-3.5" /> },
] as const;

type ModuleKey = typeof MODULES[number]["key"];
type PermKey = typeof PERMISSIONS[number]["key"];

const getField = (form: any, perm: PermKey, mod: ModuleKey): boolean => form[`can_${perm}_${mod}`] ?? false;
const setField = (form: any, perm: PermKey, mod: ModuleKey, val: boolean) => ({ ...form, [`can_${perm}_${mod}`]: val });

const defaultForm = (): Omit<PermissionCategory, "id" | "created_at"> => ({
  name: "",
  can_view_clients: true, can_edit_clients: false, can_delete_clients: false,
  can_view_campaigns: true, can_edit_campaigns: false, can_delete_campaigns: false,
  can_view_stores: true, can_edit_stores: false, can_delete_stores: false,
  can_view_campaign_stores: true, can_edit_campaign_stores: false, can_delete_campaign_stores: false,
  can_view_pieces: true, can_edit_pieces: false, can_delete_pieces: false,
  can_view_occurrences: true, can_edit_occurrences: false, can_delete_occurrences: false,
  can_view_schedules: true, can_edit_schedules: false, can_delete_schedules: false,
  can_view_installations: true, can_edit_installations: false, can_delete_installations: false,
  can_edit_reporter_data: false,
  can_manage_team_codes: false,
  can_lock_cards: false,
  can_view_photo_checkin: false,
  can_view_loja_a_loja: false,
  can_edit_loja_a_loja: false,
});

export default function CategoryManager() {
  const { data: categories = [] } = usePermissionCategories();
  const addCategory = useAddPermissionCategory();
  const updateCategory = useUpdatePermissionCategory();
  const deleteCategory = useDeletePermissionCategory();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PermissionCategory | null>(null);
  const [form, setForm] = useState(defaultForm());

  const openNew = () => { setEditing(null); setForm(defaultForm()); setDialogOpen(true); };
  const openEdit = (cat: PermissionCategory) => {
    setEditing(cat);
    const { id, created_at, ...rest } = cat;
    setForm(rest);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editing) updateCategory.mutate({ id: editing.id, ...form });
    else addCategory.mutate(form);
    setDialogOpen(false);
  };

  const countPerms = (cat: PermissionCategory) => {
    let count = 0;
    for (const m of MODULES) {
      for (const p of PERMISSIONS) {
        if (getField(cat, p.key, m.key)) count++;
      }
    }
    if (cat.can_edit_reporter_data) count++;
    if (cat.can_manage_team_codes) count++;
    if (cat.can_lock_cards) count++;
    if (cat.can_view_photo_checkin) count++;
    return count;
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-base font-semibold text-foreground">Categorias de Permissão ({categories.length})</h2>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="w-4 h-4" /> Nova Categoria
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Nenhuma categoria criada.</p>
          <p className="text-xs mt-1">Crie categorias como "Editor", "Visualizador" etc.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(cat => (
            <div key={cat.id} className="border border-border rounded-xl p-4 bg-card hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground text-base">{cat.name}</h3>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir "{cat.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>Usuários com esta categoria perderão suas permissões.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteCategory.mutate(cat.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Visual matrix */}
              <div className="space-y-1.5">
                {MODULES.map(m => {
                  const hasView = getField(cat, "view", m.key);
                  const hasEdit = getField(cat, "edit", m.key);
                  const hasDelete = getField(cat, "delete", m.key);
                  if (!hasView && !hasEdit && !hasDelete) return null;
                  return (
                    <div key={m.key} className="flex items-center gap-2">
                      <span className="text-xs w-28 truncate text-muted-foreground">{m.icon} {m.label}</span>
                      <div className="flex gap-1">
                        {hasView && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-muted)", color: "var(--text-secondary)" }}>Ver</span>}
                        {hasEdit && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-muted)", color: "var(--text-secondary)" }}>Editar</span>}
                        {hasDelete && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--s-danger-bg)", color: "var(--s-danger)" }}>Apagar</span>}
                      </div>
                    </div>
                  );
                })}
                {cat.can_edit_reporter_data && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-28 truncate text-muted-foreground">📝 Lojista</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/20">Editar</span>
                  </div>
                )}
                {cat.can_manage_team_codes && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-28 truncate text-muted-foreground">🔑 Códigos</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-700 border border-indigo-500/20">Gerenciar</span>
                  </div>
                )}
                {cat.can_lock_cards && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-28 truncate text-muted-foreground">🔒 Cards</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 border border-purple-500/20">Bloquear</span>
                  </div>
                )}
                {cat.can_view_photo_checkin && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-28 truncate text-muted-foreground">✅ Check-in</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-700 border border-teal-500/20">Ver</span>
                  </div>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground mt-3">{countPerms(cat)} permissão(ões) ativas</p>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome</label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Editor, Visualizador, Equipe de Campo"
              />
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Módulo</th>
                    {PERMISSIONS.map(p => (
                      <th key={p.key} className="text-center text-xs font-medium text-muted-foreground px-2 py-2 w-20">
                        <div className="flex items-center justify-center gap-1">{p.icon} {p.label}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((m, i) => (
                    <tr key={m.key} className={i % 2 === 0 ? "bg-card" : "bg-muted/10"}>
                      <td className="text-sm font-medium px-3 py-2.5">{m.icon} {m.label}</td>
                      {PERMISSIONS.map(p => (
                        <td key={p.key} className="text-center px-2 py-2.5">
                          <Checkbox
                            checked={getField(form, p.key, m.key)}
                            onCheckedChange={checked => setForm(f => setField(f, p.key, m.key, !!checked))}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <Checkbox
                checked={!!form.can_edit_reporter_data}
                onCheckedChange={checked => setForm(f => ({ ...f, can_edit_reporter_data: !!checked }))}
              />
              <label className="text-sm font-medium">📝 Editar Dados do Lojista (Ocorrências)</label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                checked={!!form.can_manage_team_codes}
                onCheckedChange={checked => setForm(f => ({ ...f, can_manage_team_codes: !!checked }))}
              />
              <label className="text-sm font-medium">🔑 Gerenciar Códigos de Acesso Temporário</label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                checked={!!form.can_lock_cards}
                onCheckedChange={checked => setForm(f => ({ ...f, can_lock_cards: !!checked }))}
              />
              <label className="text-sm font-medium">🔒 Bloquear/Desbloquear Cards (Ocorrências, Agendamento, Instalações)</label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                checked={!!form.can_view_photo_checkin}
                onCheckedChange={checked => setForm(f => ({ ...f, can_view_photo_checkin: !!checked }))}
              />
              <label className="text-sm font-medium">✅ Ver Check-in de Fotos para Ocorrências</label>
            </div>

            <Button onClick={handleSave} className="w-full" disabled={addCategory.isPending || updateCategory.isPending}>
              {editing ? "Salvar Alterações" : "Criar Categoria"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
