import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Users, Car, Crown, Phone, AlertTriangle, ChevronUp, ChevronDown, Download, Pencil, Trash2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useInstallationTeams,
  useAllTeamMembers,
  useAllTeamVehicles,
  isTeamIncomplete,
  type InstallationTeam,
  type TeamMember,
  type TeamVehicle,
} from "@/components/InstallationTeamDialog";
import ImportTeamsDialog from "@/components/ImportTeamsDialog";

interface ViewTeamsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  clientId?: string;
  canEdit?: boolean;
  onEditTeam?: (teamId: string) => void;
}

export default function ViewTeamsDialog({ open, onOpenChange, campaignId, clientId, canEdit = false, onEditTeam }: ViewTeamsDialogProps) {
  const queryClient = useQueryClient();
  const { data: teams = [], isLoading: loadingTeams } = useInstallationTeams(campaignId);
  const { data: membersMap = {}, isLoading: loadingMembers } = useAllTeamMembers(campaignId);
  const { data: vehiclesMap = {}, isLoading: loadingVehicles } = useAllTeamVehicles(campaignId);

  const [search, setSearch] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<InstallationTeam | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

  const deleteTeam = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("installation_teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Equipe removida");
      queryClient.invalidateQueries({ queryKey: ["installation_teams", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["all_team_members", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["all_team_vehicles", campaignId] });
      setTeamToDelete(null);
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao remover equipe"),
  });

  const isLoading = loadingTeams || loadingMembers || loadingVehicles;

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) => {
      if (t.name.toLowerCase().includes(q)) return true;
      const members = membersMap[t.id] || [];
      if (members.some((m) => m.name?.toLowerCase().includes(q))) return true;
      const vehicles = vehiclesMap[t.id] || [];
      if (vehicles.some((v) => `${v.name} ${v.brand} ${v.plate}`.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [teams, membersMap, vehiclesMap, search]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setSearch("");
      setActiveIdx(0);
    }
  }, [open]);

  // Clamp active index when list changes
  useEffect(() => {
    if (activeIdx >= filteredTeams.length) setActiveIdx(Math.max(0, filteredTeams.length - 1));
  }, [filteredTeams.length, activeIdx]);

  // Scroll active item into view
  useEffect(() => {
    const el = itemRefs.current[activeIdx];
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIdx]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredTeams.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filteredTeams.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIdx(filteredTeams.length - 1);
    } else if (e.key === "Enter" && onEditTeam) {
      const target = filteredTeams[activeIdx];
      if (target) {
        e.preventDefault();
        onEditTeam(target.id);
      }
    }
  };

  const totalMembers = useMemo(
    () => teams.reduce((acc, t) => acc + (membersMap[t.id]?.length || 0), 0),
    [teams, membersMap],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl max-h-[90dvh] flex flex-col gap-0 p-0"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="px-4 sm:px-6 pt-5 pb-3 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Consultar Equipes
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {teams.length} equipe(s) · {totalMembers} instalador(es) cadastrado(s)
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              className="shrink-0 h-8 text-xs gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Importar de outra campanha</span>
              <span className="sm:hidden">Importar</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Search */}
        <div className="px-4 sm:px-6 py-3 border-b bg-muted/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar equipe, instalador, veículo..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveIdx(0);
              }}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <p className="hidden sm:flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
            Use <kbd className="px-1.5 py-0.5 rounded border bg-background"><ChevronUp className="inline w-3 h-3" /></kbd>
            <kbd className="px-1.5 py-0.5 rounded border bg-background"><ChevronDown className="inline w-3 h-3" /></kbd>
            para navegar entre as equipes
          </p>
        </div>

        {/* List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-4 py-3 space-y-2"
        >
          {isLoading && (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando equipes...</div>
          )}

          {!isLoading && filteredTeams.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-10">
              {teams.length === 0
                ? "Nenhuma equipe cadastrada para esta campanha."
                : "Nenhuma equipe corresponde à busca."}
            </div>
          )}

          {!isLoading && filteredTeams.map((team, idx) => (
            <TeamViewCard
              key={team.id}
              team={team}
              members={membersMap[team.id] || []}
              vehicles={vehiclesMap[team.id] || []}
              active={idx === activeIdx}
              canEdit={canEdit}
              onFocus={() => setActiveIdx(idx)}
              onSelect={onEditTeam ? () => onEditTeam(team.id) : undefined}
              onDelete={canEdit ? () => setTeamToDelete(team) : undefined}
              ref={(el) => (itemRefs.current[idx] = el)}
            />
          ))}
        </div>
      </DialogContent>

      <ImportTeamsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        campaignId={campaignId}
        clientId={clientId}
      />

      <AlertDialog open={!!teamToDelete} onOpenChange={(o) => !o && setTeamToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover equipe?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a equipe <strong>{teamToDelete?.name}</strong>? Todos os
              instaladores e veículos vinculados a ela também serão removidos desta campanha. Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTeam.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteTeam.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (teamToDelete) deleteTeam.mutate(teamToDelete.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTeam.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

interface TeamViewCardProps {
  team: InstallationTeam;
  members: TeamMember[];
  vehicles: TeamVehicle[];
  active: boolean;
  canEdit?: boolean;
  onFocus: () => void;
  onSelect?: () => void;
  onDelete?: () => void;
}

const TeamViewCard = forwardRef<HTMLDivElement, TeamViewCardProps>(function TeamViewCard(
  { team, members, vehicles, active, canEdit, onFocus, onSelect, onDelete },
  ref,
) {
  const incomplete = isTeamIncomplete(members);
  const leader = members.find((m) => m.is_leader);
  const others = members.filter((m) => !m.is_leader);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      onClick={() => {
        onFocus();
        onSelect?.();
      }}
      className={cn(
        "rounded-lg border bg-card transition-all cursor-pointer hover:shadow-sm",
        active
          ? "border-primary ring-2 ring-primary/30 shadow-sm"
          : "border-border hover:border-primary/40",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b bg-muted/40 rounded-t-lg flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-4 h-4 text-primary shrink-0" />
          <h3 className="font-semibold text-sm sm:text-base truncate">{team.name}</h3>
          {incomplete && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/40 gap-1">
              <AlertTriangle className="w-3 h-3" /> Incompleta
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Badge variant="secondary" className="text-[10px]">{members.length} instalador(es)</Badge>
          {vehicles.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{vehicles.length} veículo(s)</Badge>
          )}
        </div>
      </div>

      {canEdit && (onSelect || onDelete) && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 sm:px-4 py-2 border-b bg-background">
          {onSelect && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
            >
              <Pencil className="w-3 h-3" /> Editar
            </Button>
          )}
          {onSelect && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              title="Abrir editor para adicionar instaladores"
            >
              <UserPlus className="w-3 h-3" /> Adicionar instalador
            </Button>
          )}
          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="w-3 h-3" /> Remover
            </Button>
          )}
        </div>
      )}

      <div className="px-3 sm:px-4 py-3 grid gap-3 sm:grid-cols-2">
        {/* Members */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Instaladores
          </p>
          {members.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum instalador cadastrado</p>
          ) : (
            <ul className="space-y-1.5">
              {leader && <MemberRow member={leader} isLeader />}
              {others.map((m) => (
                <MemberRow key={m.id} member={m} />
              ))}
            </ul>
          )}
        </div>

        {/* Vehicles */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Veículos
          </p>
          {vehicles.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum veículo cadastrado</p>
          ) : (
            <ul className="space-y-1.5">
              {vehicles.map((v) => (
                <li key={v.id} className="flex items-start gap-2 text-xs">
                  <Car className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="min-w-0 break-words">
                    <span className="font-medium">{v.name || "—"}</span>
                    {(v.brand || v.color) && (
                      <span className="text-muted-foreground"> · {[v.brand, v.color].filter(Boolean).join(" · ")}</span>
                    )}
                    {v.plate && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">{v.plate}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
});

function MemberRow({ member, isLeader }: { member: TeamMember; isLeader?: boolean }) {
  return (
    <li className="flex items-start gap-2 text-xs">
      {isLeader ? (
        <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
      ) : (
        <span className="w-3.5 h-3.5 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium break-words">{member.name || "—"}</span>
          {isLeader && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/40 text-amber-600">
              Líder
            </Badge>
          )}
        </div>
        {member.phone && (
          <a
            href={`tel:${member.phone.replace(/\D/g, "")}`}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <Phone className="w-3 h-3" /> {member.phone}
          </a>
        )}
      </div>
    </li>
  );
}
