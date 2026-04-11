import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
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
import { Package, Plus, Search, Trash2, Briefcase, ArrowRight, GripVertical, Palette, Users } from "lucide-react";
import AppLayout from "@/components/AppLayout";
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

function getClientAvatarColor(name: string): string {
  const letter = (name?.[0] ?? "A").toUpperCase();
  const colors: Record<string, string> = {
    A: "#8C6F4E", B: "#7B5E3A", C: "#6B4F2E",
    D: "#5C6B3F", E: "#4A5568", F: "#735A3D",
    G: "#7A3B2E", H: "#5A4A3A", I: "#8C6F4E",
    J: "#6B4F2E", K: "#7B5E3A", L: "#5C6B3F",
    M: "#A07850", N: "#7B5E3A", O: "#6B4F2E",
    P: "#8C6F4E", Q: "#5A4A3A", R: "#7A3B2E",
    S: "#735A3D", T: "#5C6B3F", U: "#4A5568",
    V: "#8C6F4E", W: "#7B5E3A", X: "#6B4F2E",
    Y: "#A07850", Z: "#5A4A3A",
  };
  return colors[letter] ?? "#8C6F4E";
}

// ─── Sortable Client Card ─────────────────────────────────
function SortableClientCard({
  client,
  campaignCount,
  userCount,
  isAdmin,
  onNavigate,
  onDelete,
  onColorChange,
  t,
}: {
  client: Client;
  campaignCount: number;
  userCount: number;
  isAdmin: boolean;
  onNavigate: () => void;
  onDelete: () => void;
  onColorChange: (color: string) => void;
  t: (key: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: client.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  const color = client.color || "#6366f1";
  const avatarColor = getClientAvatarColor(client.name);

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderLeft: `4px solid ${avatarColor}`,
      }}
      className="group bg-card rounded-xl shadow-sm border border-border hover:shadow-md transition-all duration-200 cursor-pointer px-4 py-3.5 flex items-center gap-3.5"
      onClick={onNavigate}
    >
      {/* Avatar */}
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: 44, height: 44, borderRadius: 10,
          backgroundColor: avatarColor,
          fontSize: 18, fontWeight: 700, color: "#FFFFFF",
        }}
      >
        {client.name.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
          {client.name}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {t("clientDashboard.createdAt")} {new Date(client.created_at).toLocaleDateString()}
        </p>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Package className="w-3 h-3" /> {campaignCount} {t("clientDashboard.campaigns")}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" /> {userCount} {t("clientDashboard.users")}
          </span>
        </div>
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                <Palette className="w-3.5 h-3.5" style={{ color }} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" onClick={(e) => e.stopPropagation()}>
              <p className="text-xs font-medium text-muted-foreground mb-2">{t("clientDashboard.clientColor")}</p>
              <div className="grid grid-cols-6 gap-1.5">
                {CLIENT_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={(e) => { e.stopPropagation(); onColorChange(c); }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <button
            className="cursor-grab active:cursor-grabbing touch-none p-1 text-muted-foreground hover:text-foreground transition-colors"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("clientDashboard.deleteClientTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("clientDashboard.deleteClientDesc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {t("common.yes").toUpperCase()}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Access arrow */}
      <div className="flex items-center gap-1 text-xs font-medium shrink-0" style={{ color: "#8C6F4E" }}>
        <span className="hidden sm:inline">{t("clientDashboard.access")}</span>
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────
const Dashboard = () => {
  const { t } = useTranslation();
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

  const { data: userCounts = {} } = useQuery({
    queryKey: ["user-counts-by-client"],
    queryFn: async () => {
      const { data } = await supabase.from("user_client_access").select("client_id, user_id").eq("suspended", false);
      const counts: Record<string, Set<string>> = {};
      (data || []).forEach((r) => {
        if (!counts[r.client_id]) counts[r.client_id] = new Set();
        counts[r.client_id].add(r.user_id);
      });
      const result: Record<string, number> = {};
      Object.entries(counts).forEach(([k, v]) => { result[k] = v.size; });
      return result;
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
    <AppLayout
      breadcrumbs={[
        { label: agencyInfo?.name || "Agência", href: "/" },
        { label: t("sidebar.clients") },
      ]}
    >
      <div className="max-w-6xl mx-auto">

        {/* Search + Add */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("clientDashboard.searchClient")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-card" />
          </div>
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1">
                  <Plus className="w-4 h-4" /> {t("clientDashboard.newClient")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("clientDashboard.newClient")}</DialogTitle></DialogHeader>
                <form onSubmit={handleAdd} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("clientDashboard.clientName")}</label>
                    <Input placeholder="Ex: Empresa XPTO" value={newName} onChange={(e) => setNewName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">{t("clientDashboard.clientColor")}</label>
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
                    {addClient.isPending ? t("clientDashboard.creating") : t("clientDashboard.createClient")}
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
              {clients.length === 0 ? t("clientDashboard.noClients") : t("clientDashboard.noResults")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {clients.length === 0 && isAdmin ? t("clientDashboard.createFirst") : t("clientDashboard.tryDifferent")}
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filtered.map((c) => c.id)} strategy={rectSortingStrategy}>
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                {filtered.map((client) => (
                  <SortableClientCard
                    key={client.id}
                    client={client}
                    campaignCount={campaignCounts[client.id] || 0}
                    userCount={userCounts[client.id] || 0}
                    isAdmin={isAdmin}
                    onNavigate={() => navigate(`/agency/${agencyId}/clients/${client.id}`)}
                    onDelete={() => deleteClient.mutate(client.id)}
                    onColorChange={(color) => handleColorChange(client.id, color)}
                    t={t}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
