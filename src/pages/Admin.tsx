import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminUsers, useUpdateUserRole } from "@/hooks/useAdminUsers";
import {
  useClients, useUserClientAccess, useAddUserClientAccess,
  useUpdateUserClientAccess, useDeleteUserClientAccess,
} from "@/hooks/useMultiClientData";
import { Navigate, useNavigate } from "react-router-dom";
import { Shield, ArrowLeft, Users, KeyRound, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import type { AppRole } from "@/hooks/useUserRole";

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

  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [canEdit, setCanEdit] = useState(false);

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
    if (!selectedUserId || !selectedClientId) return;
    addAccess.mutate({ user_id: selectedUserId, client_id: selectedClientId, can_edit: canEdit });
    setAccessDialogOpen(false);
    setSelectedUserId("");
    setSelectedClientId("");
    setCanEdit(false);
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
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <Tabs defaultValue="users">
          <TabsList className="mb-6">
            <TabsTrigger value="users" className="gap-1"><Users className="w-4 h-4" /> Usuários</TabsTrigger>
            <TabsTrigger value="access" className="gap-1"><KeyRound className="w-4 h-4" /> Acesso por Cliente</TabsTrigger>
          </TabsList>

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
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell>
                          <p className="font-medium text-foreground text-sm">{u.display_name || "Sem nome"}</p>
                          <p className="text-xs text-muted-foreground">{u.user_id.slice(0, 8)}…</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-[10px] uppercase">
                            {u.role === "admin" ? "Admin" : "Visualizador"}
                          </Badge>
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

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
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">Pode editar?</label>
                      <Switch checked={canEdit} onCheckedChange={setCanEdit} />
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
                      <TableHead>Edição</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allAccess.map((a) => {
                      const u = users.find((u) => u.user_id === a.user_id);
                      const c = clients.find((c) => c.id === a.client_id);
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm">{u?.display_name || a.user_id.slice(0, 8)}</TableCell>
                          <TableCell className="text-sm">{c?.name || a.client_id.slice(0, 8)}</TableCell>
                          <TableCell>
                            <Switch
                              checked={a.can_edit}
                              onCheckedChange={(checked) => updateAccess.mutate({ id: a.id, can_edit: checked })}
                            />
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
