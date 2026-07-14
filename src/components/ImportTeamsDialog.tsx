import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ChevronRight, Search, Users, Download, Car } from "lucide-react";
import { cn, normalizeTeamName } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
}

type CampaignRow = {
  id: string;
  name: string;
  client_id: string;
  clients: { name: string } | null;
};

type TeamRow = {
  id: string;
  name: string;
  campaign_id: string;
  members: number;
  vehicles: number;
};

export default function ImportTeamsDialog({ open, onOpenChange, campaignId }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // All accessible campaigns except current — RLS filters visibility
  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery({
    queryKey: ["import-teams-campaigns", campaignId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id,name,client_id,clients(name)")
        .neq("id", campaignId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CampaignRow[];
    },
  });

  // Fetch teams for all visible campaigns in one shot (counts included)
  const campaignIds = useMemo(() => campaigns.map((c) => c.id), [campaigns]);

  const { data: teamsByCampaign = {}, isLoading: loadingTeams } = useQuery({
    queryKey: ["import-teams-list", campaignIds.join(",")],
    enabled: open && campaignIds.length > 0,
    queryFn: async () => {
      const { data: teams, error } = await supabase
        .from("installation_teams")
        .select("id,name,campaign_id")
        .in("campaign_id", campaignIds)
        .order("name");
      if (error) throw error;
      const teamIds = (teams || []).map((t) => t.id);

      const [membersRes, vehiclesRes] = await Promise.all([
        teamIds.length
          ? supabase.from("installation_team_members").select("team_id").in("team_id", teamIds)
          : Promise.resolve({ data: [] as any[] }),
        teamIds.length
          ? supabase.from("installation_team_vehicles").select("team_id").in("team_id", teamIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const memberCount: Record<string, number> = {};
      (membersRes.data || []).forEach((m: any) => {
        memberCount[m.team_id] = (memberCount[m.team_id] || 0) + 1;
      });
      const vehicleCount: Record<string, number> = {};
      (vehiclesRes.data || []).forEach((v: any) => {
        vehicleCount[v.team_id] = (vehicleCount[v.team_id] || 0) + 1;
      });

      const map: Record<string, TeamRow[]> = {};
      (teams || []).forEach((t: any) => {
        if (!map[t.campaign_id]) map[t.campaign_id] = [];
        map[t.campaign_id].push({
          id: t.id,
          name: t.name,
          campaign_id: t.campaign_id,
          members: memberCount[t.id] || 0,
          vehicles: vehicleCount[t.id] || 0,
        });
      });
      return map;
    },
  });

  // Filter: only campaigns that have teams and match search
  const visibleCampaigns = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns
      .filter((c) => (teamsByCampaign[c.id] || []).length > 0)
      .filter((c) => {
        if (!q) return true;
        const clientName = c.clients?.name?.toLowerCase() || "";
        if (c.name.toLowerCase().includes(q) || clientName.includes(q)) return true;
        return (teamsByCampaign[c.id] || []).some((t) => t.name.toLowerCase().includes(q));
      });
  }, [campaigns, teamsByCampaign, search]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const toggleTeam = (id: string) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleCampaign = (cid: string, teams: TeamRow[]) => {
    const allSelected = teams.every((t) => selected[t.id]);
    setSelected((prev) => {
      const next = { ...prev };
      teams.forEach((t) => {
        next[t.id] = !allSelected;
      });
      return next;
    });
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (selectedIds.length === 0) return { imported: 0, skipped: 0 };

      // Existing team names in destination (to avoid duplicates)
      const { data: existing } = await supabase
        .from("installation_teams")
        .select("name")
        .eq("campaign_id", campaignId);
      const existingNames = new Set(
        (existing || []).map((t: any) => normalizeTeamName(t.name)),
      );

      // Load full source data
      const [membersRes, vehiclesRes, teamsRes] = await Promise.all([
        supabase
          .from("installation_team_members")
          .select("*")
          .in("team_id", selectedIds),
        supabase
          .from("installation_team_vehicles")
          .select("*")
          .in("team_id", selectedIds),
        supabase.from("installation_teams").select("*").in("id", selectedIds),
      ]);

      const sourceTeams = teamsRes.data || [];
      const sourceMembers = membersRes.data || [];
      const sourceVehicles = vehiclesRes.data || [];

      let imported = 0;
      let skipped = 0;

      for (const t of sourceTeams) {
        if (existingNames.has(normalizeTeamName(t.name))) {
          skipped++;
          continue;
        }
        const { data: newTeam, error: teamErr } = await supabase
          .from("installation_teams")
          .insert({ campaign_id: campaignId, name: t.name })
          .select()
          .single();
        if (teamErr || !newTeam) throw teamErr || new Error("Falha ao criar equipe");

        existingNames.add(normalizeTeamName(t.name));

        const members = sourceMembers
          .filter((m: any) => m.team_id === t.id)
          .map((m: any) => ({
            team_id: newTeam.id,
            name: m.name,
            cpf: m.cpf,
            rg: m.rg,
            phone: m.phone,
            is_leader: m.is_leader,
            is_unified_doc: m.is_unified_doc,
          }));
        if (members.length) {
          const { error } = await supabase.from("installation_team_members").insert(members);
          if (error) throw error;
        }

        const vehicles = sourceVehicles
          .filter((v: any) => v.team_id === t.id)
          .map((v: any) => ({
            team_id: newTeam.id,
            name: v.name,
            brand: v.brand,
            color: v.color,
            plate: v.plate,
          }));
        if (vehicles.length) {
          const { error } = await supabase.from("installation_team_vehicles").insert(vehicles);
          if (error) throw error;
        }

        imported++;
      }

      return { imported, skipped };
    },
    onSuccess: ({ imported, skipped }) => {
      qc.invalidateQueries({ queryKey: ["installation_teams", campaignId] });
      qc.invalidateQueries({ queryKey: ["all_team_members", campaignId] });
      qc.invalidateQueries({ queryKey: ["all_team_vehicles", campaignId] });
      if (imported > 0) toast.success(`${imported} equipe(s) importada(s)${skipped ? ` · ${skipped} ignorada(s) (nome duplicado)` : ""}`);
      else if (skipped > 0) toast.info(`Todas as ${skipped} equipe(s) já existem nesta campanha.`);
      setSelected({});
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao importar equipes"),
  });

  const isLoading = loadingCampaigns || loadingTeams;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90dvh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 sm:px-6 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Download className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Importar equipes de outra campanha
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Selecione as equipes que deseja copiar para esta campanha. Instaladores e veículos são incluídos.
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 sm:px-6 py-3 border-b bg-muted/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar campanha, cliente ou equipe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-2">
          {isLoading && (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando campanhas...</div>
          )}

          {!isLoading && visibleCampaigns.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-10">
              Nenhuma campanha com equipes disponível para importação.
            </div>
          )}

          {!isLoading &&
            visibleCampaigns.map((c) => {
              const teams = teamsByCampaign[c.id] || [];
              const isOpen = expanded[c.id];
              const allSelected = teams.length > 0 && teams.every((t) => selected[t.id]);
              const someSelected = teams.some((t) => selected[t.id]);

              return (
                <Collapsible
                  key={c.id}
                  open={isOpen}
                  onOpenChange={(o) => setExpanded((prev) => ({ ...prev, [c.id]: o }))}
                  className="rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex-1 flex items-center gap-2 min-w-0 text-left"
                      >
                        <ChevronRight
                          className={cn(
                            "w-4 h-4 text-muted-foreground shrink-0 transition-transform",
                            isOpen && "rotate-90",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm truncate">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {c.clients?.name || "—"}
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {teams.length} equipe(s)
                        </Badge>
                      </button>
                    </CollapsibleTrigger>
                    <Button
                      type="button"
                      size="sm"
                      variant={allSelected ? "default" : "outline"}
                      onClick={() => toggleCampaign(c.id, teams)}
                      className="h-7 text-[11px] px-2 shrink-0"
                    >
                      {allSelected ? "Desmarcar" : "Selecionar todas"}
                    </Button>
                  </div>

                  <CollapsibleContent>
                    <ul className="border-t divide-y">
                      {teams.map((t) => (
                        <li
                          key={t.id}
                          className={cn(
                            "flex items-center gap-3 px-3 sm:px-4 py-2 hover:bg-muted/40 cursor-pointer",
                            selected[t.id] && "bg-primary/5",
                          )}
                          onClick={() => toggleTeam(t.id)}
                        >
                          <Checkbox
                            checked={!!selected[t.id]}
                            onCheckedChange={() => toggleTeam(t.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="flex-1 text-sm truncate">{t.name}</span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-2 shrink-0">
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3 h-3" /> {t.members}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Car className="w-3 h-3" /> {t.vehicles}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    {someSelected && !allSelected && (
                      <div className="px-4 py-1.5 text-[11px] text-muted-foreground border-t bg-muted/30">
                        Seleção parcial nesta campanha
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
        </div>

        <DialogFooter className="px-4 sm:px-6 py-3 border-t bg-muted/20 flex-row items-center justify-between gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {selectedIds.length} equipe(s) selecionada(s)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={selectedIds.length === 0 || importMutation.isPending}
              onClick={() => importMutation.mutate()}
            >
              {importMutation.isPending ? "Importando..." : `Importar ${selectedIds.length || ""}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
