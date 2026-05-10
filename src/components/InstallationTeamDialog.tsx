import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Users, Car, AlertTriangle, ChevronDown, ChevronRight, Edit3, Check, X, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn, normalizeTeamName, normalizeMemberName } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

export type InstallationTeam = {
  id: string;
  campaign_id: string;
  name: string;
  created_at: string;
};

export type TeamVehicle = {
  id: string;
  team_id: string;
  name: string;
  brand: string;
  color: string;
  plate: string;
};

export type TeamMember = {
  id: string;
  team_id: string;
  name: string;
  rg: string;
  cpf: string;
  phone: string;
  is_unified_doc: boolean;
  is_leader: boolean;
};

// ─── CPF Validation ──────────────────────────────────────

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function isValidCpf(cpf: string): boolean {
  const stripped = cpf.replace(/\D/g, "");
  if (stripped.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(stripped)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(stripped[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(stripped[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(stripped[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(stripped[10]);
}

// ─── Hooks ───────────────────────────────────────────────

export function useInstallationTeams(campaignId: string) {
  return useQuery({
    queryKey: ["installation_teams", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installation_teams")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("name");
      if (error) throw error;
      return data as InstallationTeam[];
    },
    enabled: !!campaignId,
  });
}

export function useTeamVehicles(teamId: string | null) {
  return useQuery({
    queryKey: ["team_vehicles", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installation_team_vehicles")
        .select("*")
        .eq("team_id", teamId!);
      if (error) throw error;
      return data as TeamVehicle[];
    },
    enabled: !!teamId,
  });
}

export function useTeamMembers(teamId: string | null) {
  return useQuery({
    queryKey: ["team_members", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installation_team_members")
        .select("*")
        .eq("team_id", teamId!);
      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: !!teamId,
  });
}

export function useAllTeamMembers(campaignId: string) {
  return useQuery({
    queryKey: ["all_team_members", campaignId],
    queryFn: async () => {
      const { data: teams } = await supabase
        .from("installation_teams")
        .select("id")
        .eq("campaign_id", campaignId);
      if (!teams || teams.length === 0) return {};
      const teamIds = teams.map((t) => t.id);
      const { data: members } = await supabase
        .from("installation_team_members")
        .select("*")
        .in("team_id", teamIds);
      const map: Record<string, TeamMember[]> = {};
      (members || []).forEach((m) => {
        if (!map[m.team_id]) map[m.team_id] = [];
        map[m.team_id].push(m as TeamMember);
      });
      return map;
    },
    enabled: !!campaignId,
  });
}

export function useAllTeamVehicles(campaignId: string) {
  return useQuery({
    queryKey: ["all_team_vehicles", campaignId],
    queryFn: async () => {
      const { data: teams } = await supabase
        .from("installation_teams")
        .select("id")
        .eq("campaign_id", campaignId);
      if (!teams || teams.length === 0) return {};
      const teamIds = teams.map((t) => t.id);
      const { data: vehicles } = await supabase
        .from("installation_team_vehicles")
        .select("*")
        .in("team_id", teamIds);
      const map: Record<string, TeamVehicle[]> = {};
      (vehicles || []).forEach((v) => {
        if (!map[v.team_id]) map[v.team_id] = [];
        map[v.team_id].push(v as TeamVehicle);
      });
      return map;
    },
    enabled: !!campaignId,
  });
}

// ─── Check if team has incomplete data ───────────────────

export function isTeamIncomplete(members: TeamMember[]): boolean {
  if (members.length === 0) return true;
  return members.some((m) => {
    if (m.is_unified_doc) return !m.cpf;
    return !m.rg || !m.cpf;
  });
}

export function getMemberMissingFields(member: TeamMember): string[] {
  const missing: string[] = [];
  if (member.is_unified_doc) {
    if (!member.cpf) missing.push("RU");
  } else {
    if (!member.rg) missing.push("RG");
    if (!member.cpf) missing.push("CPF");
  }
  return missing;
}

// ─── Main Dialog ─────────────────────────────────────────

interface InstallationTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  canEdit: boolean;
}

export function InstallationTeamDialog({ open, onOpenChange, campaignId, canEdit }: InstallationTeamDialogProps) {
  const queryClient = useQueryClient();
  const { data: teams = [] } = useInstallationTeams(campaignId);
  const { data: teamStoreCounts = {} } = useQuery({
    queryKey: ["team_store_counts", campaignId],
    queryFn: async () => {
      const data = await supabasePaginate<{ team_id: string | null }>((from, to) =>
        supabase
          .from("campaign_schedules")
          .select("team_id")
          .eq("campaign_id", campaignId)
          .not("team_id", "is", null)
          .range(from, to) as any
      );
      const counts: Record<string, number> = {};
      data.forEach((s) => {
        if (s.team_id) counts[s.team_id] = (counts[s.team_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!campaignId,
  });
  const [newTeamName, setNewTeamName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState("");

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["installation_teams", campaignId] });
    queryClient.invalidateQueries({ queryKey: ["all_team_members", campaignId] });
    queryClient.invalidateQueries({ queryKey: ["all_team_vehicles", campaignId] });
  };

  const addTeam = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("installation_teams").insert({ campaign_id: campaignId, name: normalizeTeamName(name) });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setNewTeamName(""); toast.success("Equipe criada!"); },
    onError: () => toast.error("Erro ao criar equipe"),
  });

  const updateTeam = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("installation_teams").update({ name: normalizeTeamName(name) }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setEditingTeamId(null); toast.success("Equipe atualizada!"); },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const deleteTeam = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("installation_teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      if (selectedTeamId) setSelectedTeamId(null);
      toast.success("Equipe removida!");
    },
    onError: () => toast.error("Erro ao remover"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" /> Equipes de Instalação
          </DialogTitle>
        </DialogHeader>

        {/* Add team */}
        {canEdit && (
          <div className="flex gap-2">
            <Input
              placeholder="Nome da equipe de instalação"
              value={newTeamName}
              onChange={(e) => setNewTeamName(normalizeTeamName(e.target.value))}
              className="flex-1"
              onKeyDown={(e) => { if (e.key === "Enter" && newTeamName.trim()) addTeam.mutate(newTeamName.trim()); }}
            />
            <Button size="sm" disabled={!newTeamName.trim()} onClick={() => addTeam.mutate(newTeamName.trim())}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>
        )}

        {/* Team list */}
        <div className="space-y-2 mt-2">
          {teams.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma equipe cadastrada</p>}
          {teams.map((team) => (
            <div key={team.id} className="border rounded-lg overflow-hidden">
              <div
                className={cn(
                  "flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors",
                  selectedTeamId === team.id && "bg-muted"
                )}
                onClick={() => setSelectedTeamId(selectedTeamId === team.id ? null : team.id)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {selectedTeamId === team.id ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                  {editingTeamId === team.id ? (
                    <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={editingTeamName}
                        onChange={(e) => setEditingTeamName(normalizeTeamName(e.target.value))}
                        className="h-7 text-sm"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter" && editingTeamName.trim()) updateTeam.mutate({ id: team.id, name: editingTeamName.trim() }); }}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (editingTeamName.trim()) updateTeam.mutate({ id: team.id, name: editingTeamName.trim() }); }}>
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingTeamId(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-sm truncate">{team.name}</span>
                      {(teamStoreCounts[team.id] ?? 0) > 0 && (
                        <Badge variant="secondary" className="ml-2 text-xs shrink-0 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {teamStoreCounts[team.id]} {teamStoreCounts[team.id] === 1 ? "loja" : "lojas"}
                        </Badge>
                      )}
                    </>
                  )}
                </div>
                {canEdit && editingTeamId !== team.id && (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingTeamId(team.id); setEditingTeamName(team.name); }}>
                      <Edit3 className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteTeam.mutate(team.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
              {selectedTeamId === team.id && (
                <div className="border-t p-3 space-y-4 bg-card">
                  <TeamVehiclesSection teamId={team.id} canEdit={canEdit} campaignId={campaignId} />
                  <hr className="border-border" />
                  <TeamMembersSection teamId={team.id} canEdit={canEdit} campaignId={campaignId} />
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Vehicles Section ────────────────────────────────────

function TeamVehiclesSection({ teamId, canEdit, campaignId }: { teamId: string; canEdit: boolean; campaignId: string }) {
  const queryClient = useQueryClient();
  const { data: vehicles = [] } = useTeamVehicles(teamId);
  const [showVehicles, setShowVehicles] = useState(vehicles.length > 0);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", brand: "", color: "", plate: "" });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["team_vehicles", teamId] });
    queryClient.invalidateQueries({ queryKey: ["all_team_vehicles", campaignId] });
  };

  const addVehicle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("installation_team_vehicles").insert({ team_id: teamId, ...form });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setForm({ name: "", brand: "", color: "", plate: "" }); setAdding(false); toast.success("Veículo adicionado!"); },
    onError: () => toast.error("Erro ao adicionar veículo"),
  });

  const updateVehicle = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TeamVehicle> }) => {
      const { error } = await supabase.from("installation_team_vehicles").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setEditingId(null); toast.success("Veículo atualizado!"); },
    onError: () => toast.error("Erro ao atualizar veículo"),
  });

  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("installation_team_vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Veículo removido!"); },
  });

  const startEditing = (v: TeamVehicle) => {
    setEditingId(v.id);
    setForm({ name: v.name || "", brand: v.brand || "", color: v.color || "", plate: v.plate || "" });
  };

  const saveEdit = () => {
    if (editingId) updateVehicle.mutate({ id: editingId, data: form });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Car className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Veículos</span>
        {canEdit && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground">Possui veículo?</span>
            <Switch checked={showVehicles} onCheckedChange={(v) => { setShowVehicles(v); if (!v) { setAdding(false); setEditingId(null); } }} />
          </div>
        )}
      </div>

      {showVehicles && (
        <div className="space-y-2 pl-6">
          {vehicles.map((v) => (
            editingId === v.id ? (
              <div key={v.id} className="grid grid-cols-2 gap-2 bg-muted/50 rounded p-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Nome</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-7 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Marca</label>
                  <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="h-7 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Cor</label>
                  <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-7 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Placa</label>
                  <Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} className="h-7 text-xs" />
                </div>
                <div className="col-span-2 flex gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={saveEdit}><Check className="w-3 h-3 mr-1" />Salvar</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div key={v.id} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5">
                <span className="font-medium">{v.name || "Sem nome"}</span>
                {v.brand && <span className="text-muted-foreground">· {v.brand}</span>}
                {v.color && <span className="text-muted-foreground">· {v.color}</span>}
                {v.plate && <span className="font-mono uppercase">{v.plate}</span>}
                {canEdit && (
                  <div className="flex items-center gap-1 ml-auto">
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => startEditing(v)}>
                      <Edit3 className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => deleteVehicle.mutate(v.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            )
          ))}
          {canEdit && !adding && !editingId && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setAdding(true); setForm({ name: "", brand: "", color: "", plate: "" }); }}>
              <Plus className="w-3 h-3" /> Adicionar veículo
            </Button>
          )}
          {canEdit && adding && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">Nome</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-7 text-xs" placeholder="Ex: Van 01" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Marca</label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="h-7 text-xs" placeholder="Ex: Fiat" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Cor</label>
                <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-7 text-xs" placeholder="Ex: Branco" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Placa</label>
                <Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} className="h-7 text-xs" placeholder="Ex: ABC1D23" />
              </div>
              <div className="col-span-2 flex gap-2">
                <Button size="sm" className="h-7 text-xs" disabled={!form.name.trim()} onClick={() => addVehicle.mutate()}>Salvar</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Members Section ─────────────────────────────────────

function TeamMembersSection({ teamId, canEdit, campaignId }: { teamId: string; canEdit: boolean; campaignId: string }) {
  const queryClient = useQueryClient();
  const { data: members = [] } = useTeamMembers(teamId);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", rg: "", cpf: "", phone: "", isUnifiedDoc: false, isLeader: false });
  const [cpfError, setCpfError] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["team_members", teamId] });
    queryClient.invalidateQueries({ queryKey: ["all_team_members", campaignId] });
  };

  const addMember = useMutation({
    mutationFn: async () => {
      if (form.cpf && !isValidCpf(form.cpf)) {
        throw new Error("CPF inválido");
      }
      // If marking as leader, unset other leaders first
      if (form.isLeader) {
        await supabase.from("installation_team_members").update({ is_leader: false }).eq("team_id", teamId).eq("is_leader", true);
      }
      const { error } = await supabase.from("installation_team_members").insert({
        team_id: teamId,
        name: normalizeMemberName(form.name),
        rg: form.isUnifiedDoc ? "" : form.rg,
        cpf: form.cpf.replace(/\D/g, ""),
        phone: form.phone,
        is_unified_doc: form.isUnifiedDoc,
        is_leader: form.isLeader,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setForm({ name: "", rg: "", cpf: "", phone: "", isUnifiedDoc: false, isLeader: false }); setCpfError(""); setAdding(false); toast.success("Instalador adicionado!"); },
    onError: (e) => toast.error(e.message || "Erro ao adicionar"),
  });

  const updateMember = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; rg: string; cpf: string; phone: string; isUnifiedDoc: boolean; isLeader: boolean } }) => {
      if (data.cpf && !isValidCpf(data.cpf)) {
        throw new Error("CPF inválido");
      }
      // If marking as leader, unset other leaders first
      if (data.isLeader) {
        await supabase.from("installation_team_members").update({ is_leader: false }).eq("team_id", teamId).eq("is_leader", true);
      }
      const { error } = await supabase.from("installation_team_members").update({
        name: normalizeMemberName(data.name),
        rg: data.isUnifiedDoc ? "" : data.rg,
        cpf: data.cpf.replace(/\D/g, ""),
        phone: data.phone,
        is_unified_doc: data.isUnifiedDoc,
        is_leader: data.isLeader,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setEditingId(null); setCpfError(""); toast.success("Instalador atualizado!"); },
    onError: (e) => toast.error(e.message || "Erro ao atualizar"),
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("installation_team_members").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["team_members", teamId] });
      const previous = queryClient.getQueryData<TeamMember[]>(["team_members", teamId]);
      queryClient.setQueryData<TeamMember[]>(["team_members", teamId], (old) => (old || []).filter(m => m.id !== id));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(["team_members", teamId], context.previous);
      toast.error("Erro ao remover instalador");
    },
    onSettled: () => { invalidate(); },
    onSuccess: () => { toast.success("Instalador removido!"); },
  });

  const handleCpfChange = (value: string) => {
    const formatted = formatCpf(value);
    setForm({ ...form, cpf: formatted });
    const stripped = formatted.replace(/\D/g, "");
    if (stripped.length === 11) {
      setCpfError(isValidCpf(formatted) ? "" : "CPF inválido");
    } else {
      setCpfError("");
    }
  };

  const startEditing = (m: TeamMember) => {
    setEditingId(m.id);
    setForm({ name: m.name, rg: m.rg || "", cpf: m.cpf ? formatCpf(m.cpf) : "", phone: m.phone || "", isUnifiedDoc: !!m.is_unified_doc, isLeader: !!m.is_leader });
    setCpfError("");
  };

  const memberFormFields = (isNew: boolean) => (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <label className="text-xs font-medium">Nome *</label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} onBlur={(e) => setForm((f) => ({ ...f, name: normalizeMemberName(f.name) }))} className="h-7 text-xs" placeholder="Nome completo" />
      </div>
      <div className="space-y-1 flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium">{form.isUnifiedDoc ? "—" : "RG"}</label>
          <Input
            value={form.isUnifiedDoc ? "" : form.rg}
            onChange={(e) => setForm({ ...form, rg: e.target.value })}
            className="h-7 text-xs"
            placeholder="RG"
            disabled={form.isUnifiedDoc}
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">{form.isUnifiedDoc ? "RU" : "CPF"}</label>
        <Input value={form.cpf} onChange={(e) => handleCpfChange(e.target.value)} className={cn("h-7 text-xs", cpfError && "border-destructive")} placeholder="000.000.000-00" />
        {cpfError && <p className="text-[10px] text-destructive">{cpfError}</p>}
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Telefone</label>
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-7 text-xs" placeholder="(00) 00000-0000" />
      </div>
      <div className="col-span-2 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Switch checked={form.isUnifiedDoc} onCheckedChange={(v) => setForm({ ...form, isUnifiedDoc: v, rg: v ? "" : form.rg })} />
          <span className="text-[10px] text-muted-foreground">Registro Unificado (RU)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch checked={form.isLeader} onCheckedChange={(v) => setForm({ ...form, isLeader: v })} />
          <span className="text-[10px] text-muted-foreground">⭐ Líder da equipe</span>
        </div>
      </div>
      <div className="col-span-2 flex gap-2">
        {isNew ? (
          <Button size="sm" className="h-7 text-xs" disabled={!form.name.trim() || !!cpfError} onClick={() => addMember.mutate()}>Salvar</Button>
        ) : (
          <Button size="sm" className="h-7 text-xs" disabled={!form.name.trim() || !!cpfError} onClick={() => updateMember.mutate({ id: editingId!, data: form })}><Check className="w-3 h-3 mr-1" />Salvar</Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { isNew ? setAdding(false) : setEditingId(null); setCpfError(""); }}>Cancelar</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Instaladores</span>
        <span className="text-xs text-muted-foreground">({members.length})</span>
      </div>

      <div className="space-y-2 pl-6">
        {members.map((m) => {
          const missingFields = getMemberMissingFields(m);
          if (editingId === m.id) {
            return <div key={m.id} className="bg-muted/50 rounded p-2">{memberFormFields(false)}</div>;
          }
          return (
            <div key={m.id} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5 flex-wrap">
              <span className="font-medium">{m.name}</span>
              {m.is_leader && <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">⭐ Líder</span>}
              {m.is_unified_doc ? (
                m.cpf && <span className="text-muted-foreground">RU: {formatCpf(m.cpf)}</span>
              ) : (
                <>
                  {m.rg && <span className="text-muted-foreground">RG: {m.rg}</span>}
                  {m.cpf && <span className="text-muted-foreground">CPF: {formatCpf(m.cpf)}</span>}
                </>
              )}
              {m.phone && <span className="text-muted-foreground">Tel: {m.phone}</span>}
              {missingFields.length > 0 && (
                <span className="text-amber-500 flex items-center gap-0.5" title={`Faltam: ${missingFields.join(", ")}`}>
                  <AlertTriangle className="w-3 h-3" />
                  <span className="text-[10px]">Falta: {missingFields.join(", ")}</span>
                </span>
              )}
              {canEdit && (
                <div className="flex items-center gap-1 ml-auto">
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => startEditing(m)}>
                    <Edit3 className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => deleteMember.mutate(m.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {canEdit && !adding && !editingId && (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setAdding(true); setForm({ name: "", rg: "", cpf: "", phone: "", isUnifiedDoc: false, isLeader: false }); }}>
            <Plus className="w-3 h-3" /> Adicionar instalador
          </Button>
        )}

        {canEdit && adding && memberFormFields(true)}
      </div>
    </div>
  );
}

// ─── Team Card Popover Content ───────────────────────────

interface TeamCardProps {
  team: InstallationTeam;
  members: TeamMember[];
  vehicles: TeamVehicle[];
}

export function TeamCardContent({ team, members, vehicles }: TeamCardProps) {
  const incomplete = isTeamIncomplete(members);

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm">{team.name}</span>
        {incomplete && (
          <span className="text-amber-500 flex items-center gap-1 text-[10px]">
            <AlertTriangle className="w-3 h-3" /> Dados incompletos
          </span>
        )}
      </div>

      {vehicles.length > 0 && (
        <div>
          <p className="font-medium text-muted-foreground mb-1 flex items-center gap-1"><Car className="w-3 h-3" /> Veículos</p>
          {vehicles.map((v) => (
            <p key={v.id} className="pl-4">
              {v.name}{v.brand ? ` · ${v.brand}` : ""}{v.color ? ` · ${v.color}` : ""}{v.plate ? ` · ${v.plate}` : ""}
            </p>
          ))}
        </div>
      )}

      <div>
        <p className="font-medium text-muted-foreground mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Instaladores ({members.length})</p>
        {members.length === 0 && <p className="pl-4 text-muted-foreground italic">Nenhum instalador cadastrado</p>}
        {members.map((m) => {
          const missing = getMemberMissingFields(m);
          return (
            <div key={m.id} className="pl-4 flex items-center gap-2 flex-wrap">
              <span className="font-medium">{m.name}</span>
              {missing.length > 0 && <span className="text-amber-500 text-[10px]">(Falta: {missing.join(", ")})</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default InstallationTeamDialog;
