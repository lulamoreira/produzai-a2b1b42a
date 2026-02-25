import { useState } from "react";
import { useClients, useAddClient, useUpdateClient, useDeleteClient, type Client } from "@/hooks/useMultiClientData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate, useParams } from "react-router-dom";
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
import { Package, Plus, Search, UserCircle, LogOut, Shield, Trash2, Download, Upload, Briefcase, ArrowRight, ArrowLeft, Sparkles, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { exportClients, parseClientsImport } from "@/lib/exportMultiClient";

const CARD_COLORS = [
  "from-primary/10 to-primary/5 border-primary/20",
  "from-secondary/10 to-secondary/5 border-secondary/20",
  "from-accent/10 to-accent/5 border-accent/20",
  "from-info/10 to-info/5 border-info/20",
];

const ICON_COLORS = [
  "gradient-primary",
  "gradient-secondary",
  "gradient-accent",
  "bg-info",
];

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { agencyId } = useParams<{ agencyId: string }>();
  const { data: clients = [], isLoading } = useClients(agencyId);
  const addClient = useAddClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const { data: campaignCounts = {} } = useQuery({
    queryKey: ["campaign-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("client_id");
      const counts: Record<string, number> = {};
      (data || []).forEach((c) => {
        counts[c.client_id] = (counts[c.client_id] || 0) + 1;
      });
      return counts;
    },
  });


  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await addClient.mutateAsync({ name: newName.trim(), agency_id: agencyId! });
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
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Agências
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Gestão de Campanhas</h1>
              <p className="text-xs text-muted-foreground">{clients.length} cliente(s) cadastrado(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => navigate("/chat")}>
              <MessageSquare className="w-3.5 h-3.5" /> Chat
            </Button>
            {isAdmin && (
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => navigate("/admin")}>
                <Shield className="w-3.5 h-3.5" /> Admin
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="gap-1.5 rounded-full px-3">
                  <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{user?.email?.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="hidden sm:inline text-xs max-w-[100px] truncate">{user?.email?.split("@")[0]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="text-xs text-muted-foreground" disabled>{user?.email}</DropdownMenuItem>
                <DropdownMenuItem className="text-xs" disabled>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${isAdmin ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {isAdmin ? "Admin" : "Usuário"}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{clients.length}</p>
              <p className="text-[11px] text-muted-foreground">Clientes</p>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3 col-span-1 sm:col-span-1">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground mb-1">Ações rápidas</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => exportClients(clients)}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Exportar
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
                              await addClient.mutateAsync({ ...item, agency_id: agencyId! });
                              added++;
                            }
                          }
                          toast.success(`${added} adicionado(s), ${updated} atualizado(s)!`);
                        } catch { toast.error("Erro ao importar."); }
                        e.target.value = "";
                      }} />
                      <Button size="sm" variant="outline" className="text-xs h-8" asChild>
                        <span><Upload className="w-3.5 h-3.5 mr-1" /> Importar</span>
                      </Button>
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search + Add */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-card" />
          </div>
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gradient-primary shadow-glow-primary text-white border-0 gap-1">
                  <Plus className="w-4 h-4" /> Novo Cliente
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
                <form onSubmit={handleAdd} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome do cliente</label>
                    <Input placeholder="Ex: Empresa XPTO" value={newName} onChange={(e) => setNewName(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full gradient-primary text-white border-0" disabled={addClient.isPending}>
                    {addClient.isPending ? "Criando..." : "Criar Cliente"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Client cards */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow-primary">
              <Briefcase className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {clients.length === 0 ? "Nenhum cliente cadastrado" : "Nenhum resultado"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {clients.length === 0 && isAdmin ? "Crie seu primeiro cliente para começar." : "Tente uma busca diferente."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((client, i) => {
              const colorIdx = i % CARD_COLORS.length;
              const clientCampaignCount = campaignCounts[client.id] || 0;
              return (
                <div
                  key={client.id}
                  className={`group bg-gradient-to-br ${CARD_COLORS[colorIdx]} border rounded-xl p-5 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer relative overflow-hidden`}
                  onClick={() => navigate(`/agency/${agencyId}/clients/${client.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl ${ICON_COLORS[colorIdx]} flex items-center justify-center shadow-lg flex-shrink-0`}>
                        <span className="text-white font-bold text-lg">{client.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors">{client.name}</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Criado em {new Date(client.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
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
                            <AlertDialogTitle>Tem certeza que deseja excluir este cliente?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Todos os dados associados a este cliente serão apagados permanentemente, incluindo campanhas, lojas, peças e quantidades. Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteClient.mutate(client.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              SIM
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" /> {clientCampaignCount} campanha(s)
                    </span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                      <span>Acessar</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;