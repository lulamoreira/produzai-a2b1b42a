import { useState } from "react";
import { useClients, useAddClient, useUpdateClient, useDeleteClient, type Client } from "@/hooks/useMultiClientData";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Package, Plus, Search, UserCircle, LogOut, Shield, Trash2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { exportClients, parseClientsImport } from "@/lib/exportMultiClient";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { data: clients = [], isLoading } = useClients();
  const addClient = useAddClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await addClient.mutateAsync({ name: newName.trim() });
    setNewName("");
    setDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-gradient-to-r from-card via-card to-primary/5 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-display font-bold text-foreground">Gestão de Campanhas</h1>
              <p className="text-xs text-muted-foreground">Selecione um cliente</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="gap-1">
                <UserCircle className="w-4 h-4" />
                <span className="hidden sm:inline text-xs max-w-[100px] truncate">{user?.email?.split("@")[0]}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-xs text-muted-foreground" disabled>{user?.email}</DropdownMenuItem>
              <DropdownMenuItem className="text-xs" disabled>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isAdmin ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {isAdmin ? "Admin" : "Visualizador"}
                </span>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => navigate("/admin")}>
                  <Shield className="w-4 h-4 mr-2" /> Painel Admin
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={signOut}><LogOut className="w-4 h-4 mr-2" /> Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Button size="sm" variant="outline" onClick={() => exportClients(clients)}>
            <Download className="w-4 h-4 mr-1" /> Exportar
          </Button>
          {isAdmin && (
            <>
              <label className="cursor-pointer">
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const items = await parseClientsImport(file);
                    if (items.length === 0) { toast.error("Nenhum cliente encontrado."); return; }
                    let added = 0, updated = 0;
                    for (const item of items) {
                      const existing = clients.find(c => c.name.toLowerCase() === item.name.toLowerCase());
                      if (existing) {
                        await updateClient.mutateAsync({ id: existing.id, name: item.name });
                        updated++;
                      } else {
                        await addClient.mutateAsync(item);
                        added++;
                      }
                    }
                    toast.success(`${added} adicionado(s), ${updated} atualizado(s)!`);
                  } catch { toast.error("Erro ao importar."); }
                  e.target.value = "";
                }} />
                <Button size="sm" variant="outline" asChild>
                  <span><Upload className="w-4 h-4 mr-1" /> Importar</span>
                </Button>
              </label>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo Cliente</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
                  <form onSubmit={handleAdd} className="space-y-4">
                    <Input placeholder="Nome do cliente" value={newName} onChange={(e) => setNewName(e.target.value)} required />
                    <Button type="submit" className="w-full" disabled={addClient.isPending}>
                      {addClient.isPending ? "Criando..." : "Criar Cliente"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-display font-bold text-foreground mb-2">
              {clients.length === 0 ? "Nenhum cliente cadastrado" : "Nenhum resultado"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {clients.length === 0 && isAdmin ? "Crie seu primeiro cliente para começar." : "Tente uma busca diferente."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((client) => (
              <div
                key={client.id}
                className="group bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer relative"
                onClick={() => navigate(`/clients/${client.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display font-bold text-foreground text-lg group-hover:text-primary transition-colors">{client.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Criado em {new Date(client.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Todas as campanhas, lojas e dados deste cliente serão removidos permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteClient.mutate(client.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
