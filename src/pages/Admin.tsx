import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminUsers, useUpdateUserRole } from "@/hooks/useAdminUsers";
import {
  useClients, useUserClientAccess, useAddUserClientAccess,
  useUpdateUserClientAccess, useDeleteUserClientAccess,
} from "@/hooks/useMultiClientData";
import {
  usePermissionCategories, useAddPermissionCategory,
  useUpdatePermissionCategory, useDeletePermissionCategory,
  type PermissionCategory,
} from "@/hooks/usePermissionCategories";
import { Navigate, useNavigate } from "react-router-dom";
import { Shield, ArrowLeft, Users, KeyRound, Plus, Trash2, Tags, Edit3, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { AppRole } from "@/hooks/useUserRole";

const MODULES = [
  { key: "clients", label: "Clientes" },
  { key: "campaigns", label: "Campanhas" },
  { key: "stores", label: "Lojas" },
  { key: "pieces", label: "Peças" },
] as const;

const PERMISSIONS = [
  { key: "view", label: "Visualizar" },
  { key: "edit", label: "Editar" },
  { key: "delete", label: "Apagar" },
] as const;

type ModuleKey = typeof MODULES[number]["key"];
type PermKey = typeof PERMISSIONS[number]["key"];

const defaultCategoryForm = (): Omit<PermissionCategory, "id" | "created_at"> => ({
  name: "",
  can_view_clients: true, can_edit_clients: false, can_delete_clients: false,
  can_view_campaigns: true, can_edit_campaigns: false, can_delete_campaigns: false,
  can_view_stores: true, can_edit_stores: false, can_delete_stores: false,
  can_view_pieces: true, can_edit_pieces: false, can_delete_pieces: false,
});

const getCategoryField = (form: any, perm: PermKey, mod: ModuleKey): boolean => {
  return form[`can_${perm}_${mod}`] ?? false;
};

const setCategoryField = (form: any, perm: PermKey, mod: ModuleKey, val: boolean) => {
  return { ...form, [`can_${perm}_${mod}`]: val };
};

const Admin = () => {
  const { user } = useAuth();
  const { isAdmin, isLoading: loadingRole } = useUserRole();
  const { data: users = [], isLoading: loadingUsers } = useAdminUsers();
  const updateRole = useUpdateUserRole();
  const navigate = useNavigate();

  const { data: clients = [] } = useClients();
  const { data: allAccess = [] } = useUserClientAccess();
  const addAccess = useAddUserClientAccess();
  const updateAccess = useUpdateUserClientAccess();
  const deleteAccess = useDeleteUserClientAccess();

  const { data: categories = [] } = usePermissionCategories();
  const addCategory = useAddPermissionCategory();
  const updateCategory = useUpdatePermissionCategory();
  const deleteCategory = useDeletePermissionCategory();

  // Access dialog state
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PermissionCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState(defaultCategoryForm());

  if (loadingRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  const handleRoleChange = (userId: string, newRole: AppRole) => {
    if (userId === user?.id) return;
    updateRole.mutate({ userId, newRole });
  };

  const handleAddAccess = () => {
    if (!selectedUserId || !selectedClientId || !selectedCategoryId) return;
    addAccess.mutate({
      user_id: selectedUserId,
      client_id: selectedClientId,
      can_edit: false,
      category_id: selectedCategoryId,
    });
    setAccessDialogOpen(false);
    setSelectedUserId("");
    setSelectedClientId("");
    setSelectedCategoryId("");
  };

  const openNewCategory = () => {
    setEditingCategory(null);
    setCategoryForm(defaultCategoryForm());
    setCategoryDialogOpen(true);
  };

  const openEditCategory = (cat: PermissionCategory) => {
    setEditingCategory(cat);
    const { id, created_at, ...rest } = cat;
    setCategoryForm(rest);
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = () => {
    if (!categoryForm.name.trim()) return;
    if (editingCategory) {
      updateCategory.mutate({ id: editingCategory.id, ...categoryForm });
    } else {
      addCategory.mutate(categoryForm);
    }
    setCategoryDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <Shield className="w-5 h-5 text-primary" />
           <h1 className="text-lg font-bold text-foreground">Painel de Administração</h1>
           <Button variant="outline" size="sm" className="ml-auto gap-1" onClick={() => navigate("/approvals")}>
             <UserCheck className="w-4 h-4" /> Aprovações
           </Button>
         </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <Tabs defaultValue="users">
          <TabsList className="mb-6">
            <TabsTrigger value="users" className="gap-1"><Users className="w-4 h-4" /> Usuários</TabsTrigger>
            <TabsTrigger value="categories" className="gap-1"><Tags className="w-4 h-4" /> Roles</TabsTrigger>
            <TabsTrigger value="access" className="gap-1"><KeyRound className="w-4 h-4" /> Acesso por Cliente</TabsTrigger>
          </TabsList>

          {/* ─── Users Tab ─── */}
          <TabsContent value="users">
            <h2 className="text-base font-semibold text-foreground mb-4">Usuários ({users.length})</h2>
            {loadingUsers ? (
              <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" /></div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Role / Cliente</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => {
                      const userAccesses = allAccess.filter((a) => a.user_id === u.user_id);

                      return (
                      <TableRow key={u.user_id}>
                        <TableCell>
                          <p className="font-medium text-foreground text-sm">{u.display_name || "Sem nome"}</p>
                          <p className="text-xs text-muted-foreground">{u.user_id.slice(0, 8)}…</p>
                        </TableCell>
                        <TableCell>
                          {u.role === "admin" ? (
                            <Badge variant="default" className="text-[10px] uppercase">Admin</Badge>
                          ) : userAccesses.length > 0 ? (
                            <div className="space-y-1.5">
                              {userAccesses.map((a) => {
                                const c = clients.find((c) => c.id === a.client_id);
                                return (
                                  <div key={a.id} className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground min-w-[80px] truncate">{c?.name || "—"}</span>
                                    <Select
                                      value={a.category_id || ""}
                                      onValueChange={(val) => updateAccess.mutate({ id: a.id, can_edit: false, category_id: val })}
                                    >
                                      <SelectTrigger className="w-[140px] h-7 text-xs"><SelectValue placeholder="Sem role" /></SelectTrigger>
                                      <SelectContent>
                                        {categories.map((cat) => (
                                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Sem acesso</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {u.user_id === user?.id ? (
                            <span className="text-xs text-muted-foreground italic">Você</span>
                          ) : (
                            <Select value={u.role} onValueChange={(val) => handleRoleChange(u.user_id, val as AppRole)}>
                              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="viewer">Visualizador</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ─── Categories Tab ─── */}
          <TabsContent value="categories">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base font-semibold text-foreground">Roles ({categories.length})</h2>
              <Button size="sm" onClick={openNewCategory}><Plus className="w-4 h-4 mr-1" /> Novo Role</Button>
            </div>

            {categories.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Nenhum role criado ainda.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {categories.map((cat) => (
                  <div key={cat.id} className="border border-border rounded-lg p-4 bg-card">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-foreground">{cat.name}</h3>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditCategory(cat)}>
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
                              <AlertDialogTitle>Excluir role "{cat.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>Usuários com este role perderão suas permissões associadas.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteCategory.mutate(cat.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">SIM</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr>
                            <th className="text-left pb-1 text-muted-foreground font-medium">Módulo</th>
                            {PERMISSIONS.map((p) => (
                              <th key={p.key} className="text-center pb-1 text-muted-foreground font-medium">{p.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {MODULES.map((m) => (
                            <tr key={m.key}>
                              <td className="py-0.5 text-foreground">{m.label}</td>
                              {PERMISSIONS.map((p) => (
                                <td key={p.key} className="text-center">
                                  {getCategoryField(cat, p.key, m.key) ? (
                                    <span className="text-primary font-bold">✓</span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Category Create/Edit Dialog */}
            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingCategory ? "Editar Role" : "Novo Role"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Nome</label>
                    <Input
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: Editor de Campanhas"
                    />
                  </div>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Módulo</TableHead>
                          {PERMISSIONS.map((p) => (
                            <TableHead key={p.key} className="text-xs text-center">{p.label}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {MODULES.map((m) => (
                          <TableRow key={m.key}>
                            <TableCell className="text-sm font-medium">{m.label}</TableCell>
                            {PERMISSIONS.map((p) => (
                              <TableCell key={p.key} className="text-center">
                                <Checkbox
                                  checked={getCategoryField(categoryForm, p.key, m.key)}
                                  onCheckedChange={(checked) =>
                                    setCategoryForm((f) => setCategoryField(f, p.key, m.key, !!checked))
                                  }
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                   <Button onClick={handleSaveCategory} className="w-full" disabled={addCategory.isPending || updateCategory.isPending}>
                    {editingCategory ? "Salvar" : "Criar Role"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ─── Access Tab ─── */}
          <TabsContent value="access">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base font-semibold text-foreground">Acessos ({allAccess.length})</h2>
              <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo Acesso</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Conceder Acesso</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Usuário</label>
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger><SelectValue placeholder="Selecione o usuário" /></SelectTrigger>
                        <SelectContent>
                          {users.filter((u) => u.role !== "admin").map((u) => (
                            <SelectItem key={u.user_id} value={u.user_id}>{u.display_name || u.user_id.slice(0, 8)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Cliente</label>
                      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                        <SelectContent>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Role</label>
                      <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                        <SelectTrigger><SelectValue placeholder="Selecione o role" /></SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddAccess} className="w-full" disabled={addAccess.isPending}>Conceder</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {allAccess.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Nenhum acesso configurado. Admins têm acesso total automaticamente.</p>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allAccess.map((a) => {
                      const u = users.find((u) => u.user_id === a.user_id);
                      const c = clients.find((c) => c.id === a.client_id);
                      const cat = categories.find((cat) => cat.id === a.category_id);
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm">{u?.display_name || a.user_id.slice(0, 8)}</TableCell>
                          <TableCell className="text-sm">{c?.name || a.client_id.slice(0, 8)}</TableCell>
                          <TableCell>
                            <Select
                              value={a.category_id || ""}
                              onValueChange={(val) => updateAccess.mutate({ id: a.id, can_edit: false, category_id: val })}
                            >
                              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                              <SelectContent>
                                {categories.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteAccess.mutate(a.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
