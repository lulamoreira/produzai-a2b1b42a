import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAgencies, useAddAgency, useDeleteAgency } from "@/hooks/useAgencies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Plus, ArrowRight, Trash2, LogOut, Shield, Sparkles, MessageSquare } from "lucide-react";

const AgencySelect = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { data: agencies = [], isLoading } = useAgencies();
  const addAgency = useAddAgency();
  const deleteAgency = useDeleteAgency();
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await addAgency.mutateAsync({ name: newName.trim() });
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
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow-primary">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Gestão de Campanhas</h1>
              <p className="text-xs text-muted-foreground">Selecione uma agência</p>
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
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-2">Agências</h2>
          <p className="text-muted-foreground text-sm">Selecione uma agência para gerenciar seus clientes e campanhas.</p>
        </div>

        <div className="flex justify-center mb-8">
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary shadow-glow-primary text-white border-0 gap-1">
                  <Plus className="w-4 h-4" /> Nova Agência
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Agência</DialogTitle></DialogHeader>
                <form onSubmit={handleAdd} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome da agência</label>
                    <Input placeholder="Ex: Agência XPTO" value={newName} onChange={(e) => setNewName(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full gradient-primary text-white border-0" disabled={addAgency.isPending}>
                    {addAgency.isPending ? "Criando..." : "Criar Agência"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {agencies.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow-primary">
              <Building2 className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Nenhuma agência cadastrada</h3>
            <p className="text-muted-foreground text-sm">Crie sua primeira agência para começar.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agencies.map((agency) => (
              <div
                key={agency.id}
                className="group bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-6 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer relative"
                onClick={() => navigate(`/agency/${agency.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-lg flex-shrink-0">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors">{agency.name}</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Criado em {new Date(agency.created_at).toLocaleDateString("pt-BR")}
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
                          <AlertDialogTitle>Excluir agência?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Todos os clientes, campanhas e dados associados a esta agência serão apagados permanentemente. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteAgency.mutate(agency.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            SIM
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <div className="flex items-center justify-end mt-4">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                    <span>Acessar</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AgencySelect;
