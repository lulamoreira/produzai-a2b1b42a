import { useState } from "react";
import { BackupRestorePanel } from "@/components/BackupRestorePanel";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { capitalizeName } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useQueryClient } from "@tanstack/react-query";
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
import { useAgencies } from "@/hooks/useAgencies";
import {
  useUserAgencyAccess, useAddUserAgencyAccess,
  useUpdateUserAgencyAccess, useDeleteUserAgencyAccess,
} from "@/hooks/useUserAgencyAccess";
import { Navigate, useNavigate } from "react-router-dom";
import { Shield, ArrowLeft, Users, KeyRound, Plus, Trash2, Tags, Edit3, UserCheck, PauseCircle, PlayCircle, ChevronDown, ChevronRight, Building2, Download, Upload, Database } from "lucide-react";
import AppHeader from "@/components/AppHeader";
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
  { key: "campaign_stores", label: "Lojas (Campanhas)" },
  { key: "pieces", label: "Peças" },
  { key: "occurrences", label: "Ocorrências" },
  { key: "schedules", label: "Agendamento" },
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
  can_view_campaign_stores: true, can_edit_campaign_stores: false, can_delete_campaign_stores: false,
  can_view_pieces: true, can_edit_pieces: false, can_delete_pieces: false,
  can_view_occurrences: true, can_edit_occurrences: false, can_delete_occurrences: false,
  can_view_schedules: true, can_edit_schedules: false, can_delete_schedules: false,
  can_edit_reporter_data: false,
});

const getCategoryField = (form: any, perm: PermKey, mod: ModuleKey): boolean => {
  return form[`can_${perm}_${mod}`] ?? false;
};

const categoryHasEditPermission = (categoryId: string, cats: PermissionCategory[]): boolean => {
  const cat = cats.find(c => c.id === categoryId);
  if (!cat) return false;
  return cat.can_edit_clients || cat.can_edit_campaigns || cat.can_edit_stores || cat.can_edit_campaign_stores || cat.can_edit_pieces || cat.can_edit_occurrences || cat.can_edit_schedules;
};

const setCategoryField = (form: any, perm: PermKey, mod: ModuleKey, val: boolean) => {
  return { ...form, [`can_${perm}_${mod}`]: val };
};

const Admin = () => {
  const { user } = useAuth();
  const { isAdmin, isMaster, isAdminOrMaster, isLoading: loadingRole } = useUserRole();
  const { data: users = [], isLoading: loadingUsers } = useAdminUsers();
  const updateRole = useUpdateUserRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: clients = [] } = useClients();
  const { data: allAccess = [] } = useUserClientAccess();
  const addAccess = useAddUserClientAccess();
  const updateAccess = useUpdateUserClientAccess();
  const deleteAccess = useDeleteUserClientAccess();

  const { data: categories = [] } = usePermissionCategories();
  const addCategory = useAddPermissionCategory();
  const updateCategory = useUpdatePermissionCategory();
  const deleteCategory = useDeletePermissionCategory();

  const { data: agencies = [] } = useAgencies();
  const { data: allAgencyAccess = [] } = useUserAgencyAccess();
  const addAgencyAccess = useAddUserAgencyAccess();
  const updateAgencyAccess = useUpdateUserAgencyAccess();
  const deleteAgencyAccess = useDeleteUserAgencyAccess();

  const getClientLabel = (client: { name: string; agency_id?: string } | undefined) => {
    if (!client) return "—";
    const ag = agencies.find(a => a.id === (client as any).agency_id);
    return ag ? `${ag.name} / ${client.name}` : client.name;
  };

  // Access dialog state
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [expandedAgencyUsers, setExpandedAgencyUsers] = useState<Set<string>>(new Set());

  // Multi-client add state
  const [multiClientSelections, setMultiClientSelections] = useState<Array<{ clientId: string; categoryId: string }>>([{ clientId: "", categoryId: "" }]);

  // Agency access dialog state
  const [agencyAccessDialogOpen, setAgencyAccessDialogOpen] = useState(false);
  const [agencySelectedUserId, setAgencySelectedUserId] = useState("");
  const [agencySelectedAgencyId, setAgencySelectedAgencyId] = useState("");
  const [agencySelectedCategoryId, setAgencySelectedCategoryId] = useState("");

  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PermissionCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState(defaultCategoryForm());

  // Edit display name state
  const [editingNameUserId, setEditingNameUserId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");

  const handleSaveDisplayName = async () => {
    if (!editingNameUserId || !editNameValue.trim()) return;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: editNameValue.trim() })
      .eq("user_id", editingNameUserId);
    if (error) {
      toast.error("Erro ao atualizar nome.");
    } else {
      toast.success("Nome atualizado!");
      queryClient.invalidateQueries({ queryKey: ["admin_users_list"] });
    }
    setEditingNameUserId(null);
    setEditNameValue("");
  };

  if (loadingRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdminOrMaster) return <Navigate to="/" replace />;

  const handleRoleChange = (userId: string, newRole: AppRole) => {
    if (userId === user?.id) return;
    updateRole.mutate({ userId, newRole });
  };

  const handleAddMultiAccess = () => {
    if (!selectedUserId) return;
    const valid = multiClientSelections.filter(s => s.clientId && s.categoryId);
    if (valid.length === 0) return;
    // Check for existing accesses to avoid duplicates
    const existingClientIds = allAccess.filter(a => a.user_id === selectedUserId).map(a => a.client_id);
    const newEntries = valid.filter(s => !existingClientIds.includes(s.clientId));
    if (newEntries.length === 0) {
      toast.error("Usuário já possui acesso a todos os clientes selecionados.");
      return;
    }
    newEntries.forEach(s => {
      addAccess.mutate({
        user_id: selectedUserId,
        client_id: s.clientId,
        can_edit: categoryHasEditPermission(s.categoryId, categories),
        category_id: s.categoryId,
      });
    });
    setAccessDialogOpen(false);
    setSelectedUserId("");
    setMultiClientSelections([{ clientId: "", categoryId: "" }]);
    setExpandedUsers(prev => new Set([...prev, selectedUserId]));
  };

  const handleAddAgencyAccess = () => {
    if (!agencySelectedUserId || !agencySelectedAgencyId || !agencySelectedCategoryId) return;
    const existing = allAgencyAccess.find(a => a.user_id === agencySelectedUserId && a.agency_id === agencySelectedAgencyId);
    if (existing) {
      toast.error("Usuário já possui acesso a esta agência.");
      return;
    }
    addAgencyAccess.mutate({
      user_id: agencySelectedUserId,
      agency_id: agencySelectedAgencyId,
      category_id: agencySelectedCategoryId,
      can_edit: categoryHasEditPermission(agencySelectedCategoryId, categories),
    });
    setAgencyAccessDialogOpen(false);
    setAgencySelectedUserId("");
    setAgencySelectedAgencyId("");
    setAgencySelectedCategoryId("");
    setExpandedAgencyUsers(prev => new Set([...prev, agencySelectedUserId]));
  };

  const toggleExpandUser = (userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleExpandAgencyUser = (userId: string) => {
    setExpandedAgencyUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const addClientRow = () => {
    setMultiClientSelections(prev => [...prev, { clientId: "", categoryId: "" }]);
  };

  const updateClientRow = (index: number, field: "clientId" | "categoryId", value: string) => {
    setMultiClientSelections(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const removeClientRow = (index: number) => {
    setMultiClientSelections(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
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
      <AppHeader
        backTo="/"
        backLabel="Voltar"
        title="Painel de Administração"
        showNav={false}
      >
        <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={() => navigate("/approvals")}>
          <UserCheck className="w-4 h-4" /> Aprovações
        </Button>
      </AppHeader>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <Tabs defaultValue="users">
          <TabsList className="mb-6 bg-card border border-border flex-wrap overflow-x-auto w-full justify-start">
            <TabsTrigger value="users" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Users className="w-4 h-4" /> Usuários</TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="categories" className="gap-1.5 data-[state=active]:bg-secondary/10 data-[state=active]:text-secondary"><Tags className="w-4 h-4" /> Roles</TabsTrigger>
                <TabsTrigger value="agency_access" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Building2 className="w-4 h-4" /> Acesso por Agência</TabsTrigger>
                <TabsTrigger value="access" className="gap-1.5 data-[state=active]:bg-accent/10 data-[state=active]:text-accent-foreground"><KeyRound className="w-4 h-4" /> Acesso por Cliente</TabsTrigger>
                <TabsTrigger value="backup" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Database className="w-4 h-4" /> Backup</TabsTrigger>
              </>
            )}
          </TabsList>

          {/* ─── Users Tab ─── */}
          <TabsContent value="users">
            <h2 className="text-base font-semibold text-foreground mb-4">Usuários ({users.length})</h2>
            {loadingUsers ? (
              <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" /></div>
            ) : (
              <div className="border border-border rounded-lg overflow-x-auto">
                <Table className="min-w-[500px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      {isAdmin && <TableHead>Role / Cliente</TableHead>}
                      {isAdmin && <TableHead className="text-right">Tipo</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => {
                      const userAccesses = allAccess.filter((a) => a.user_id === u.user_id);

                      // Master/Editor can only edit names of non-admin users in the same agency
                      const canEditName = isAdmin
                        ? true
                        : isMasterOrEditor && u.role !== "admin" && (() => {
                            // Get current user's agency IDs (from agency access)
                            const myAgencyIds = allAgencyAccess
                              .filter((a) => a.user_id === user?.id)
                              .map((a) => a.agency_id);
                            // Get current user's agency IDs via client access
                            const myClientAgencyIds = allAccess
                              .filter((a) => a.user_id === user?.id)
                              .map((a) => {
                                const c = clients.find((c) => c.id === a.client_id);
                                return c?.agency_id;
                              })
                              .filter(Boolean);
                            const allMyAgencyIds = [...new Set([...myAgencyIds, ...myClientAgencyIds])];
                            if (allMyAgencyIds.length === 0) return false;
                            // Check if target user shares any agency
                            const targetAgencyIds = allAgencyAccess
                              .filter((a) => a.user_id === u.user_id)
                              .map((a) => a.agency_id);
                            const targetClientAgencyIds = allAccess
                              .filter((a) => a.user_id === u.user_id)
                              .map((a) => {
                                const c = clients.find((c) => c.id === a.client_id);
                                return c?.agency_id;
                              })
                              .filter(Boolean);
                            const allTargetAgencyIds = [...new Set([...targetAgencyIds, ...targetClientAgencyIds])];
                            return allMyAgencyIds.some((id) => allTargetAgencyIds.includes(id));
                          })();

                      return (
                      <TableRow key={u.user_id}>
                        <TableCell>
                          {editingNameUserId === u.user_id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                className="h-7 text-sm w-40"
                                value={editNameValue}
                                onChange={(e) => setEditNameValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleSaveDisplayName(); if (e.key === "Escape") setEditingNameUserId(null); }}
                                autoFocus
                              />
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleSaveDisplayName}>OK</Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group">
                              <p className="font-medium text-foreground text-sm">{capitalizeName(u.display_name) || "Sem nome"}</p>
                              {canEditName && (
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => { setEditingNameUserId(u.user_id); setEditNameValue(u.display_name || ""); }}
                              >
                                <Edit3 className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                              </button>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">{u.user_id.slice(0, 8)}…</p>
                        </TableCell>
                        {isAdmin && (
                        <TableCell>
                          {u.role === "admin" ? (
                            <Badge variant="default" className="text-[10px] uppercase">Admin</Badge>
                          ) : userAccesses.length > 0 ? (
                            <div className="space-y-1.5">
                              {userAccesses.map((a) => {
                                const c = clients.find((c) => c.id === a.client_id);
                                return (
                                  <div key={a.id} className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground min-w-[80px] truncate">{getClientLabel(c)}</span>
                                    <Select
                                      value={a.category_id || ""}
onValueChange={(val) => updateAccess.mutate({ id: a.id, can_edit: categoryHasEditPermission(val, categories), category_id: val })}
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
                        )}
                        {isAdmin && (
                        <TableCell className="text-right">
                          {u.user_id === user?.id ? (
                            <span className="text-xs text-muted-foreground italic">Você</span>
                          ) : (
                            <Select value={u.role} onValueChange={(val) => handleRoleChange(u.user_id, val as AppRole)}>
                              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="viewer">Usuário</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        )}
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
                  {/* Permissão especial: Editar Dados do Lojista */}
                  <div className="flex items-center gap-3 pt-2 border-t border-border">
                    <Checkbox
                      checked={!!categoryForm.can_edit_reporter_data}
                      onCheckedChange={(checked) =>
                        setCategoryForm((f) => ({ ...f, can_edit_reporter_data: !!checked }))
                      }
                    />
                    <label className="text-sm font-medium">Editar Dados do Lojista (Ocorrências)</label>
                  </div>
                   <Button onClick={handleSaveCategory} className="w-full" disabled={addCategory.isPending || updateCategory.isPending}>
                    {editingCategory ? "Salvar" : "Criar Role"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ─── Agency Access Tab ─── */}
          <TabsContent value="agency_access">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base font-semibold text-foreground">Acessos por Agência</h2>
              <Dialog open={agencyAccessDialogOpen} onOpenChange={(open) => {
                setAgencyAccessDialogOpen(open);
                if (!open) {
                  setAgencySelectedUserId("");
                  setAgencySelectedAgencyId("");
                  setAgencySelectedCategoryId("");
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo Acesso</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Conceder Acesso a Agência</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Usuário</label>
                      <Select value={agencySelectedUserId} onValueChange={setAgencySelectedUserId}>
                        <SelectTrigger><SelectValue placeholder="Selecione o usuário" /></SelectTrigger>
                        <SelectContent>
                          {users.filter(u => u.role !== "admin").map(u => (
                            <SelectItem key={u.user_id} value={u.user_id}>{capitalizeName(u.display_name) || u.user_id.slice(0, 8)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Agência</label>
                      <Select value={agencySelectedAgencyId} onValueChange={setAgencySelectedAgencyId}>
                        <SelectTrigger><SelectValue placeholder="Selecione a agência" /></SelectTrigger>
                        <SelectContent>
                          {agencies.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Role</label>
                      <Select value={agencySelectedCategoryId} onValueChange={setAgencySelectedCategoryId}>
                        <SelectTrigger><SelectValue placeholder="Selecione o role" /></SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddAgencyAccess} className="w-full" disabled={addAgencyAccess.isPending}>
                      Conceder Acesso
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Ao conceder acesso a uma agência, o usuário terá acesso a <strong>todos os clientes</strong> dessa agência automaticamente (com o role selecionado).
            </p>

            {(() => {
              const nonAdminUsers = users.filter(u => u.role !== "admin");
              const usersWithAgencyAccess = nonAdminUsers.map(u => ({
                ...u,
                agencyAccesses: allAgencyAccess.filter(a => a.user_id === u.user_id),
              }));

              return usersWithAgencyAccess.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Nenhum usuário disponível.</p>
              ) : (
                <div className="space-y-2">
                  {usersWithAgencyAccess.map(u => {
                    const isExpanded = expandedAgencyUsers.has(u.user_id);
                    return (
                      <div key={u.user_id} className="border border-border rounded-lg bg-card overflow-hidden">
                        <button
                          onClick={() => toggleExpandAgencyUser(u.user_id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">{capitalizeName(u.display_name) || "Sem nome"}</p>
                            <p className="text-[11px] text-muted-foreground">{u.user_id.slice(0, 8)}…</p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {u.agencyAccesses.length} agência{u.agencyAccesses.length !== 1 ? "s" : ""}
                          </Badge>
                          {u.agencyAccesses.some(a => a.suspended) && (
                            <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-700 border-yellow-500/30">
                              Suspenso
                            </Badge>
                          )}
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border">
                            {u.agencyAccesses.length === 0 ? (
                              <p className="text-xs text-muted-foreground px-4 py-3 italic">Sem acesso a nenhuma agência.</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Agência</TableHead>
                                    <TableHead className="text-xs">Role</TableHead>
                                    <TableHead className="text-xs">Status</TableHead>
                                    <TableHead className="text-xs text-right">Ações</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {u.agencyAccesses.map(a => {
                                    const ag = agencies.find(ag => ag.id === a.agency_id);
                                    return (
                                      <TableRow key={a.id} className={a.suspended ? "opacity-50" : ""}>
                                        <TableCell className="text-sm">{ag?.name || a.agency_id.slice(0, 8)}</TableCell>
                                        <TableCell>
                                          <Select
                                            value={a.category_id || ""}
                                            onValueChange={(val) => updateAgencyAccess.mutate({ id: a.id, category_id: val, can_edit: categoryHasEditPermission(val, categories) })}
                                          >
                                            <SelectTrigger className="w-[140px] h-7 text-xs"><SelectValue placeholder="Sem role" /></SelectTrigger>
                                            <SelectContent>
                                              {categories.map(cat => (
                                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant="outline" className={`text-[10px] ${a.suspended ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" : "bg-green-500/10 text-green-700 border-green-500/30"}`}>
                                            {a.suspended ? "Suspenso" : "Ativo"}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <div className="flex items-center justify-end gap-1">
                                            <Button
                                              variant="ghost" size="icon" className="h-7 w-7"
                                              title={a.suspended ? "Reativar" : "Suspender"}
                                              onClick={() => updateAgencyAccess.mutate({ id: a.id, suspended: !a.suspended })}
                                            >
                                              {a.suspended ? <PlayCircle className="w-3.5 h-3.5 text-green-600" /> : <PauseCircle className="w-3.5 h-3.5 text-yellow-600" />}
                                            </Button>
                                            <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                                </Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent>
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>Remover acesso à agência "{ag?.name}"?</AlertDialogTitle>
                                                  <AlertDialogDescription>O usuário perderá acesso a todos os clientes desta agência.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                  <AlertDialogAction onClick={() => deleteAgencyAccess.mutate(a.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">SIM, remover</AlertDialogAction>
                                                </AlertDialogFooter>
                                              </AlertDialogContent>
                                            </AlertDialog>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            )}
                            <div className="px-4 py-2 border-t border-border">
                              <Button
                                variant="ghost" size="sm" className="text-xs gap-1"
                                onClick={() => {
                                  setAgencySelectedUserId(u.user_id);
                                  setAgencySelectedAgencyId("");
                                  setAgencySelectedCategoryId("");
                                  setAgencyAccessDialogOpen(true);
                                }}
                              >
                                <Plus className="w-3 h-3" /> Adicionar agência
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>

          {/* ─── Access Tab ─── */}
          <TabsContent value="access">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base font-semibold text-foreground">Acessos por Usuário</h2>
              <Dialog open={accessDialogOpen} onOpenChange={(open) => {
                setAccessDialogOpen(open);
                if (!open) {
                  setSelectedUserId("");
                  setMultiClientSelections([{ clientId: "", categoryId: "" }]);
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo Acesso</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Conceder Acesso a Clientes</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Usuário</label>
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger><SelectValue placeholder="Selecione o usuário" /></SelectTrigger>
                        <SelectContent>
                          {users.filter((u) => u.role !== "admin").map((u) => (
                            <SelectItem key={u.user_id} value={u.user_id}>{capitalizeName(u.display_name) || u.user_id.slice(0, 8)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground block">Clientes e Roles</label>
                      {multiClientSelections.map((row, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Select value={row.clientId} onValueChange={(val) => updateClientRow(idx, "clientId", val)}>
                            <SelectTrigger className="flex-1"><SelectValue placeholder="Cliente" /></SelectTrigger>
                            <SelectContent>
                              {clients.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{getClientLabel(c)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={row.categoryId} onValueChange={(val) => updateClientRow(idx, "categoryId", val)}>
                            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Role" /></SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {multiClientSelections.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeClientRow(idx)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={addClientRow} className="w-full">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar outro cliente
                      </Button>
                    </div>

                    <Button onClick={handleAddMultiAccess} className="w-full" disabled={addAccess.isPending}>
                      Conceder Acesso
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {(() => {
              // Group accesses by user
              const nonAdminUsers = users.filter(u => u.role !== "admin");
              const usersWithAccess = nonAdminUsers.map(u => ({
                ...u,
                accesses: allAccess.filter(a => a.user_id === u.user_id),
              }));

              return usersWithAccess.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Nenhum usuário disponível. Admins têm acesso total automaticamente.</p>
              ) : (
                <div className="space-y-2">
                  {usersWithAccess.map(u => {
                    const isExpanded = expandedUsers.has(u.user_id);
                    return (
                      <div key={u.user_id} className="border border-border rounded-lg bg-card overflow-hidden">
                        <button
                          onClick={() => toggleExpandUser(u.user_id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">{capitalizeName(u.display_name) || "Sem nome"}</p>
                            <p className="text-[11px] text-muted-foreground">{u.user_id.slice(0, 8)}…</p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {u.accesses.length} cliente{u.accesses.length !== 1 ? "s" : ""}
                          </Badge>
                          {u.accesses.some(a => a.suspended) && (
                            <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-700 border-yellow-500/30">
                              Suspenso
                            </Badge>
                          )}
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border">
                            {u.accesses.length === 0 ? (
                              <p className="text-xs text-muted-foreground px-4 py-3 italic">Sem acesso a nenhum cliente.</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Cliente</TableHead>
                                    <TableHead className="text-xs">Role</TableHead>
                                    <TableHead className="text-xs">Status</TableHead>
                                    <TableHead className="text-xs text-right">Ações</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {u.accesses.map(a => {
                                    const c = clients.find(c => c.id === a.client_id);
                                    return (
                                      <TableRow key={a.id} className={a.suspended ? "opacity-50" : ""}>
                                        <TableCell className="text-sm">{getClientLabel(c)}</TableCell>
                                        <TableCell>
                                          <Select
                                            value={a.category_id || ""}
                                            onValueChange={(val) => updateAccess.mutate({ id: a.id, can_edit: categoryHasEditPermission(val, categories), category_id: val })}
                                          >
                                            <SelectTrigger className="w-[140px] h-7 text-xs"><SelectValue placeholder="Sem role" /></SelectTrigger>
                                            <SelectContent>
                                              {categories.map(cat => (
                                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant="outline" className={`text-[10px] ${a.suspended ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" : "bg-green-500/10 text-green-700 border-green-500/30"}`}>
                                            {a.suspended ? "Suspenso" : "Ativo"}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <div className="flex items-center justify-end gap-1">
                                            <Button
                                              variant="ghost" size="icon" className="h-7 w-7"
                                              title={a.suspended ? "Reativar" : "Suspender"}
                                              onClick={() => updateAccess.mutate({ id: a.id, can_edit: a.can_edit, suspended: !a.suspended })}
                                            >
                                              {a.suspended ? <PlayCircle className="w-3.5 h-3.5 text-green-600" /> : <PauseCircle className="w-3.5 h-3.5 text-yellow-600" />}
                                            </Button>
                                            <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                                </Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent>
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>Remover acesso ao cliente "{getClientLabel(c)}"?</AlertDialogTitle>
                                                  <AlertDialogDescription>O usuário perderá todas as permissões neste cliente permanentemente.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                  <AlertDialogAction onClick={() => deleteAccess.mutate(a.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">SIM, remover</AlertDialogAction>
                                                </AlertDialogFooter>
                                              </AlertDialogContent>
                                            </AlertDialog>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            )}
                            <div className="px-4 py-2 border-t border-border">
                              <Button
                                variant="ghost" size="sm" className="text-xs gap-1"
                                onClick={() => {
                                  setSelectedUserId(u.user_id);
                                  setMultiClientSelections([{ clientId: "", categoryId: "" }]);
                                  setAccessDialogOpen(true);
                                }}
                              >
                                <Plus className="w-3 h-3" /> Adicionar cliente
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>

          {/* ─── Backup Tab ─── */}
          {isAdmin && (
          <TabsContent value="backup">
            <BackupRestorePanel />
          </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
