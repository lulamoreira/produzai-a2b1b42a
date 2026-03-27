import { useState, useCallback } from "react";
import { useClients, useAddClient, useUpdateClient, useDeleteClient, useReorderClients, type Client } from "@/hooks/useMultiClientData";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Package, Plus, Search, Trash2, Download, Upload, Briefcase, ArrowRight, GripVertical, Palette } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { toast } from "sonner";
import { exportClients, parseClientsImport } from "@/lib/exportMultiClient";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

const CLIENT_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316",
  "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#2563eb", "#4f46e5", "#7c3aed",
  "#1e3a5f", "#334155", "#475569", "#78716c",
];

// ─── Sortable Client Card ─────────────────────────────────
function SortableClientCard({
  client,
  campaignCount,
  isAdmin,
  onNavigate,
  onDelete,
  onColorChange,
}: {
  client: Client;
  campaignCount: number;
  isAdmin: boolean;
  onNavigate: () => void;
  onDelete: () => void;
  onColorChange: (color: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: client.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  const color = client.color || "#6366f1";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group card-item hover:-translate-y-0.5 transition-all duration-200 cursor-pointer relative overflow-hidden p-5"
      onClick={onNavigate}
    >
      {/* Color accent strip */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-lg" style={{ backgroundColor: color }} />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              className="cursor-grab active:cursor-grabbing touch-none p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: color }}
          >
            <span className="text-white font-bold text-lg">{client.name.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors">{client.name}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Criado em {new Date(client.created_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Palette className="w-4 h-4" style={{ color }} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-3" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-medium text-muted-foreground mb-2">Cor do cliente</p>
                <div className="grid grid-cols-6 gap-1.5">
                  {CLIENT_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onColorChange(c);
                      }}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
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
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    SIM
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-4">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Package className="w-3.5 h-3.5" /> {campaignCount} campanha(s)
        </span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
          <span>Acessar</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────
const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { agencyId } = useParams<{ agencyId: string }>();
  const { data: clients = [], isLoading } = useClients(agencyId);

  const { data: agencyInfo } = useQuery({
    queryKey: ["agency_name", agencyId],
    queryFn: async () => {
      if (!agencyId) return null;
      const { data } = await supabase.from("agencies").select("name").eq("id", agencyId).maybeSingle();
      return data;
    },
    enabled: !!agencyId,
  });
  const addClient = useAddClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const reorderClients = useReorderClients();

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
  const [newColor, setNewColor] = useState(CLIENT_COLORS[0]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filtered.findIndex((c) => c.id === active.id);
    const newIndex = filtered.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(filtered, oldIndex, newIndex);
    const updates = reordered.map((c, i) => ({ id: c.id, display_order: i }));
    reorderClients.mutate(updates);
  }, [filtered, reorderClients]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await addClient.mutateAsync({ name: newName.trim(), agency_id: agencyId! });
    // Set color after creation
    const { data } = await supabase.from("clients").select("id").eq("name", newName.trim()).eq("agency_id", agencyId!).order("created_at", { ascending: false }).limit(1);
    if (data?.[0]) {
      await updateClient.mutateAsync({ id: data[0].id, color: newColor } as any);
    }
    setNewName("");
    setNewColor(CLIENT_COLORS[0]);
    setDialogOpen(false);
  };

  const handleColorChange = (clientId: string, color: string) => {
    updateClient.mutate({ id: clientId, color } as any);
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
      <AppHeader
        backTo="/"
        backLabel="Agências"
        subtitle={`${clients.length} cliente(s) cadastrado(s)`}
        maxWidth="max-w-6xl"
      />

      <main className="max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Stats bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          <div className="card-kpi flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{clients.length}</p>
              <p className="text-[11px] text-muted-foreground">Clientes</p>
            </div>
          </div>
          <div className="card-kpi col-span-1 sm:col-span-1">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground mb-1">Ações rápidas</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => exportClients(clients)}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Exportar
                </Button>
                {isAdmin && (
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
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1">
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
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Cor do cliente</label>
                    <div className="grid grid-cols-8 gap-1.5">
                      {CLIENT_COLORS.map((c) => (
                        <button
                          type="button"
                          key={c}
                          className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${newColor === c ? "border-foreground scale-110 ring-2 ring-primary/30" : "border-transparent"}`}
                          style={{ backgroundColor: c }}
                          onClick={() => setNewColor(c)}
                        />
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={addClient.isPending}>
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
            <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filtered.map((c) => c.id)} strategy={rectSortingStrategy}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((client) => (
                  <SortableClientCard
                    key={client.id}
                    client={client}
                    campaignCount={campaignCounts[client.id] || 0}
                    isAdmin={isAdmin}
                    onNavigate={() => navigate(`/agency/${agencyId}/clients/${client.id}`)}
                    onDelete={() => deleteClient.mutate(client.id)}
                    onColorChange={(color) => handleColorChange(client.id, color)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
