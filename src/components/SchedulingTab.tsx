import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type ClientStore } from "@/hooks/useMultiClientData";
import { getStateColor } from "@/lib/stateColors";
import { useStoreContactsByClient, useStoreContactRoles, type StoreContact, type StoreContactRole } from "@/hooks/useStoreContacts";
import { Input } from "@/components/ui/input";
import DebouncedInput from "@/components/DebouncedInput";
import ScheduleCardChat from "@/components/ScheduleCardChat";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Search, CalendarIcon, Clock, FileText, Sun, Moon, HelpCircle, Download, Users, MessageCircle, Phone, Mail, AlertTriangle, Wrench, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { downloadWorkbook } from "@/lib/downloadWorkbook";
import { buildExportFileName } from "@/lib/exportFileName";
import InstallationTeamDialog, {
  useInstallationTeams,
  useAllTeamMembers,
  useAllTeamVehicles,
  isTeamIncomplete,
  TeamCardContent,
  type InstallationTeam,
  type TeamMember,
  type TeamVehicle,
} from "@/components/InstallationTeamDialog";

interface SchedulingTabProps {
  campaignId: string;
  stores: ClientStore[];
  canEdit: boolean;
  agencyName: string;
  clientName: string;
  campaignName: string;
  clientId: string;
}

type Schedule = {
  id: string;
  campaign_id: string;
  store_id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  installation_os: string | null;
  installation_preference: string | null;
  team_id: string | null;
  store_approved: boolean;
  store_approved_at: string | null;
  team_approved: boolean;
  team_approved_at: string | null;
  responsibility: string | null;
  responsibility_at: string | null;
};

const PREFERENCE_OPTIONS = [
  { value: "not_informed", label: "Não informado", icon: HelpCircle },
  { value: "morning", label: "Manhã", icon: Sun },
  { value: "night", label: "Noite", icon: Moon },
  { value: "both", label: "Ambos", icon: Sun },
];

function buildWhatsAppUrl(phone: string, contactName: string, agencyName: string, clientName: string, campaignName: string, date: string | null, time: string | null) {
  const firstName = contactName.split(" ")[0];
  const agencyFirst = agencyName.split(" ")[0];
  const clientFirst = clientName.split(" ")[0];
  const dateStr = date ? format(new Date(date + "T12:00:00"), "dd/MM/yyyy") : "(data a definir)";
  const timeStr = time || "(horário a definir)";

  const message = `Olá 😊

Somos da ${agencyFirst}, responsáveis pelo agendamento das instalações da Campanha ${clientFirst} - ${campaignName}.

Gostaríamos de solicitar a autorização para seguir com a instalação da campanha, que está prevista para o dia ${dateStr} às ${timeStr}.

Pode, por gentileza, verificar com o shopping a liberação o quanto antes?

Agradecemos imensamente sua colaboração e aguardamos o retorno dessa mensagem com a autorização/OS para a instalação.

Ficamos à disposição! 🙏🏼`;

  const digits = phone.replace(/\D/g, "");
  const fullNumber = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${fullNumber}?text=${encodeURIComponent(message)}`;
}

const SchedulingTab = ({ campaignId, stores, canEdit, agencyName, clientName, campaignName, clientId }: SchedulingTabProps) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatStoreId, setChatStoreId] = useState("");
  const [chatStoreName, setChatStoreName] = useState("");
  const [filterApproval, setFilterApproval] = useState("");

  // Fetch all contacts for the client
  const { data: allContacts = [] } = useStoreContactsByClient(clientId);
  const { data: contactRoles = [] } = useStoreContactRoles(clientId);

  // Fetch teams
  const { data: teams = [] } = useInstallationTeams(campaignId);
  const { data: allMembersMap = {} } = useAllTeamMembers(campaignId);
  const { data: allVehiclesMap = {} } = useAllTeamVehicles(campaignId);

  const teamMap = useMemo(() => {
    const map: Record<string, InstallationTeam> = {};
    teams.forEach((t) => { map[t.id] = t; });
    return map;
  }, [teams]);

  const roleMap = useMemo(() => {
    const map: Record<string, string> = {};
    contactRoles.forEach((r) => { map[r.id] = r.name; });
    return map;
  }, [contactRoles]);

  const contactsByStore = useMemo(() => {
    const map: Record<string, StoreContact[]> = {};
    allContacts.forEach((c) => {
      if (!map[c.store_id]) map[c.store_id] = [];
      map[c.store_id].push(c);
    });
    return map;
  }, [allContacts]);

  // Fetch schedules
  const { data: schedules = [] } = useQuery({
    queryKey: ["campaign_schedules", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_schedules")
        .select("*")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data as Schedule[];
    },
    enabled: !!campaignId,
  });

  // Upsert schedule
  const upsertSchedule = useMutation({
    mutationFn: async (payload: {
      campaign_id: string;
      store_id: string;
      [key: string]: any;
    }) => {
      const { data, error } = await supabase
        .from("campaign_schedules")
        .upsert(payload, { onConflict: "campaign_id,store_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign_schedules", campaignId] });
    },
    onError: () => toast.error("Erro ao salvar agendamento"),
  });

  const scheduleMap = useMemo(() => {
    const map: Record<string, Schedule> = {};
    schedules.forEach((s) => { map[s.store_id] = s; });
    return map;
  }, [schedules]);

  const states = useMemo(() => {
    const set = new Set(stores.map((s) => s.state).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [stores]);

  const cities = useMemo(() => {
    let filtered = stores;
    if (filterState) filtered = filtered.filter((s) => s.state === filterState);
    const set = new Set(filtered.map((s) => s.city).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [stores, filterState]);

  const filteredStores = useMemo(() => {
    let result = [...stores];
    if (filterState) result = result.filter((s) => s.state === filterState);
    if (filterCity) result = result.filter((s) => s.city === filterCity);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          (s.store_code || "").toLowerCase().includes(term) ||
          (s.city || "").toLowerCase().includes(term) ||
          (s.state || "").toLowerCase().includes(term)
      );
    }
    if (filterApproval) {
      result = result.filter((s) => {
        const sch = scheduleMap[s.id];
        const storeOk = sch?.store_approved ?? false;
        const teamOk = sch?.team_approved ?? false;
        if (filterApproval === "approved") return storeOk && teamOk;
        if (filterApproval === "pending") return !storeOk || !teamOk;
        return true;
      });
    }
    return result.sort((a, b) => (a.state || "").localeCompare(b.state || "") || a.name.localeCompare(b.name));
  }, [stores, filterState, filterCity, searchTerm, filterApproval, scheduleMap]);

  const handleFieldChange = (storeId: string, field: string, value: any) => {
    const existing = scheduleMap[storeId];
    upsertSchedule.mutate({
      campaign_id: campaignId,
      store_id: storeId,
      scheduled_date: existing?.scheduled_date ?? null,
      scheduled_time: existing?.scheduled_time ?? null,
      installation_os: existing?.installation_os ?? null,
      installation_preference: existing?.installation_preference ?? "not_informed",
      team_id: existing?.team_id ?? null,
      store_approved: existing?.store_approved ?? false,
      team_approved: existing?.team_approved ?? false,
      responsibility: existing?.responsibility ?? "team",
      store_approved_at: existing?.store_approved_at ?? null,
      team_approved_at: existing?.team_approved_at ?? null,
      responsibility_at: existing?.responsibility_at ?? null,
      ...(typeof field === "string" ? { [field]: value } : {}),
    });
  };

  const handleMultiFieldChange = (storeId: string, fields: Record<string, any>) => {
    const existing = scheduleMap[storeId];
    upsertSchedule.mutate({
      campaign_id: campaignId,
      store_id: storeId,
      scheduled_date: existing?.scheduled_date ?? null,
      scheduled_time: existing?.scheduled_time ?? null,
      installation_os: existing?.installation_os ?? null,
      installation_preference: existing?.installation_preference ?? "not_informed",
      team_id: existing?.team_id ?? null,
      store_approved: existing?.store_approved ?? false,
      team_approved: existing?.team_approved ?? false,
      responsibility: existing?.responsibility ?? "team",
      store_approved_at: existing?.store_approved_at ?? null,
      team_approved_at: existing?.team_approved_at ?? null,
      responsibility_at: existing?.responsibility_at ?? null,
      ...fields,
    });
  };

  const buildAddress = (s: ClientStore) => {
    const parts = [s.street, s.number, s.complement, s.neighborhood, s.city, s.state, s.zip_code].filter(Boolean);
    return parts.join(", ") || "Endereço não informado";
  };

  const prefLabel = (val: string | null) => {
    const opt = PREFERENCE_OPTIONS.find((o) => o.value === val);
    return opt?.label || "Não informado";
  };

  const handleExport = () => {
    const rows = filteredStores.map((store) => {
      const schedule = scheduleMap[store.id];
      const team = schedule?.team_id ? teamMap[schedule.team_id] : null;
      return {
        "Código": store.store_code || "",
        "Loja": store.name,
        "Estado": store.state || "",
        "Cidade": store.city || "",
        "Bairro": store.neighborhood || "",
        "Endereço": store.street || "",
        "Número": store.number || "",
        "Complemento": store.complement || "",
        "CEP": store.zip_code || "",
        "Contato": store.manager_name || "",
        "Telefone": store.phone || "",
        "E-mail": store.email || "",
        "Data Agendada": schedule?.scheduled_date ? format(new Date(schedule.scheduled_date + "T12:00:00"), "dd/MM/yyyy") : "",
        "Horário": schedule?.scheduled_time || "",
        "OS Instalação": schedule?.installation_os || "",
        "Preferência": prefLabel(schedule?.installation_preference ?? null),
        "Equipe": team?.name || "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Agendamento");
    XLSX.writeFile(wb, buildExportFileName(`Agendamento_${campaignName}`, { agencyName, clientName }));
    toast.success("Planilha exportada!");
  };

  const handleExportTeams = () => {
    if (teams.length === 0) {
      toast.error("Nenhuma equipe cadastrada para exportar.");
      return;
    }

    const wb = XLSX.utils.book_new();
    const sheetData: (string | number)[][] = [];

    teams.forEach((team, teamIndex) => {
      const members = allMembersMap[team.id] || [];
      const vehicles = allVehiclesMap[team.id] || [];
      const incomplete = isTeamIncomplete(members);

      // Add blank separator row between teams
      if (teamIndex > 0) sheetData.push([]);

      // Team header row
      sheetData.push([
        `Equipe: ${team.name}`,
        "",
        "",
        `Instaladores: ${members.length}`,
        `Veículos: ${vehicles.length}`,
        incomplete ? "Dados Incompletos" : "Completo",
      ]);

      if (members.length > 0) {
        sheetData.push(["Instalador", "Nome", "RG", "CPF", "RU", "Telefone"]);
        members.forEach((m: TeamMember) => {
          const isRU = !!(m as any).is_unified_doc;
          sheetData.push(["", m.name, isRU ? "" : (m.rg || ""), isRU ? "" : (m.cpf || ""), isRU ? (m.cpf || "") : "", m.phone || ""]);
        });
      }

      if (vehicles.length > 0) {
        sheetData.push(["Veículo", "Nome", "Marca", "Cor", "Placa", ""]);
        vehicles.forEach((v: TeamVehicle) => {
          sheetData.push(["", v.name || "", v.brand || "", v.color || "", v.plate || "", ""]);
        });
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, "Equipes");

    downloadWorkbook(wb, buildExportFileName(`Equipes_${campaignName}`, { agencyName, clientName }));
    toast.success("Planilha de equipes exportada!");
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar loja..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        <select
          value={filterState}
          onChange={(e) => { setFilterState(e.target.value); setFilterCity(""); }}
          className="px-3 py-2 text-sm rounded-md border border-border bg-card text-foreground"
        >
          <option value="">Todos os estados</option>
          {states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          className="px-3 py-2 text-sm rounded-md border border-border bg-card text-foreground"
        >
          <option value="">Todas as cidades</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterApproval}
          onChange={(e) => setFilterApproval(e.target.value)}
          className="px-3 py-2 text-sm rounded-md border border-border bg-card text-foreground"
        >
          <option value="">Todas as aprovações</option>
          <option value="approved">✅ 100% Aprovado</option>
          <option value="pending">⚠️ Com pendência</option>
        </select>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTeamDialogOpen(true)}>
          <Wrench className="w-4 h-4" /> Equipes
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportTeams}>
          <Users className="w-4 h-4" /> Exportar Equipes
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
          <Download className="w-4 h-4" /> Exportar
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{filteredStores.length} loja(s)</p>

      {/* Store Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredStores.map((store) => {
          const colors = getStateColor(store.state);
          const schedule = scheduleMap[store.id];
          const selectedDate = schedule?.scheduled_date ? new Date(schedule.scheduled_date + "T12:00:00") : undefined;
          const storeContacts = contactsByStore[store.id] || [];
          const assignedTeam = schedule?.team_id ? teamMap[schedule.team_id] : null;
          const teamMembers: TeamMember[] = schedule?.team_id ? (allMembersMap[schedule.team_id] || []) : [];
          const teamVehicles: TeamVehicle[] = schedule?.team_id ? (allVehiclesMap[schedule.team_id] || []) : [];
          const teamIncomplete = assignedTeam ? isTeamIncomplete(teamMembers) : false;

          const storeApproved = schedule?.store_approved ?? false;
          const teamApproved = schedule?.team_approved ?? false;
          const hasOs = !!(schedule?.installation_os?.trim());
          const fullyApproved = storeApproved && teamApproved && hasOs;
          const hasPendency = !fullyApproved;

          return (
            <div
              key={store.id}
              className="rounded-xl border overflow-hidden shadow-sm flex flex-col"
              style={{ borderColor: colors.text, borderWidth: 2 }}
            >
              {/* Header */}
              <div
                className="px-4 py-3 flex items-center gap-3 relative"
                style={{ backgroundColor: colors.bg, color: colors.text }}
              >
                <span className="font-bold text-lg">{store.store_code || "—"}</span>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-semibold truncate text-sm">{store.name}</span>
                  <span className="text-xs opacity-80">{store.state} · {store.city || "—"}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  style={{ color: colors.text }}
                  title="Abrir chat"
                  onClick={() => { setChatStoreId(store.id); setChatStoreName(store.name); setChatOpen(true); }}
                >
                  <MessageCircle className="w-4 h-4" />
                </Button>
                {/* Approval status icon */}
                {fullyApproved ? (
                  <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-600 drop-shadow" />
                ) : (storeApproved && teamApproved && !hasOs && schedule?.scheduled_date && schedule?.scheduled_time) ? (
                  <span className="text-[10px] font-bold text-destructive whitespace-nowrap leading-tight text-center shrink-0">FALTA<br/>DADOS DE OS</span>
                ) : (
                  <AlertCircle className="w-6 h-6 shrink-0 text-amber-500 drop-shadow" />
                )}
              </div>

              {/* Body */}
              <div className="p-4 space-y-3 bg-card flex-1">
                {/* Address */}
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Endereço:</span> {buildAddress(store)}
                </div>

                {/* Contacts section */}
                <StoreContactsDisplay
                  store={store}
                  contacts={storeContacts}
                  roleMap={roleMap}
                  schedule={schedule}
                  agencyName={agencyName}
                  clientName={clientName}
                  campaignName={campaignName}
                />

                <hr className="border-border" />

                {/* Team assignment */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1">
                    <Wrench className="w-3 h-3" /> Equipe de Instalação
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      disabled={!canEdit}
                      value={schedule?.team_id || ""}
                      onChange={(e) => handleFieldChange(store.id, "team_id", e.target.value || null)}
                      className="flex-1 h-8 text-xs rounded-md border border-border bg-card text-foreground px-2"
                    >
                      <option value="">Nenhuma equipe</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    {assignedTeam && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className={cn("h-7 text-xs gap-1 px-2", teamIncomplete && "text-amber-500")}>
                            {teamIncomplete && <AlertTriangle className="w-3 h-3" />}
                            <Users className="w-3 h-3" /> Ver
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 max-h-64 overflow-y-auto p-3" align="start">
                          <TeamCardContent team={assignedTeam} members={teamMembers} vehicles={teamVehicles} />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  {assignedTeam && teamIncomplete && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-medium">Equipe com dados incompletos (RG, CPF ou Telefone)</span>
                    </div>
                  )}
                </div>

                {/* Scheduling fields */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Date */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" /> Data
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canEdit}
                          className={cn("w-full justify-start text-left text-xs font-normal h-8 overflow-hidden", !selectedDate && "text-muted-foreground")}
                        >
                          <span className="truncate">{selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecionar"}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => handleFieldChange(store.id, "scheduled_date", date ? format(date, "yyyy-MM-dd") : null)}
                          locale={ptBR}
                          className="p-3 pointer-events-auto"
                        />
                        {selectedDate && (
                          <div className="px-3 pb-3">
                            <Button variant="ghost" size="sm" className="w-full text-xs text-destructive hover:text-destructive" onClick={() => handleFieldChange(store.id, "scheduled_date", null)}>
                              Limpar data
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Time */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Horário
                    </label>
                    <div className="flex items-center gap-1">
                      <DebouncedInput
                        type="time"
                        disabled={!canEdit}
                        value={schedule?.scheduled_time || ""}
                        onValueCommit={(val) => handleFieldChange(store.id, "scheduled_time", val || null)}
                        className="h-8 text-xs flex-1"
                      />
                      {schedule?.scheduled_time && canEdit && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive shrink-0" onClick={() => handleFieldChange(store.id, "scheduled_time", null)} title="Limpar horário">
                          ✕
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* OS */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1">
                      <FileText className="w-3 h-3" /> OS Instalação
                      {!hasOs && schedule?.scheduled_date && schedule?.scheduled_time && (
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                      )}
                    </label>
                    <DebouncedInput
                      disabled={!canEdit}
                      placeholder="Nº OS"
                      value={schedule?.installation_os || ""}
                      onValueCommit={(val) => handleFieldChange(store.id, "installation_os", val || null)}
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* Preference */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1">
                      <Sun className="w-3 h-3" /> Preferência
                    </label>
                    <select
                      disabled={!canEdit}
                      value={schedule?.installation_preference || "not_informed"}
                      onChange={(e) => handleFieldChange(store.id, "installation_preference", e.target.value)}
                      className="w-full h-8 text-xs rounded-md border border-border bg-card text-foreground px-2"
                    >
                      {PREFERENCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Footer - Approval Toggles */}
              <ApprovalToggles
                schedule={schedule}
                storeId={store.id}
                canEdit={canEdit}
                hasDateAndTime={!!(schedule?.scheduled_date && schedule?.scheduled_time)}
                onMultiUpdate={(fields) => handleMultiFieldChange(store.id, fields)}
              />
            </div>
          );
        })}
      </div>

      {filteredStores.length === 0 && (
        <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma loja encontrada</p>
      )}

      {/* Team Management Dialog */}
      <InstallationTeamDialog
        open={teamDialogOpen}
        onOpenChange={setTeamDialogOpen}
        campaignId={campaignId}
        canEdit={canEdit}
      />

      {/* Per-card Chat */}
      <ScheduleCardChat
        open={chatOpen}
        onOpenChange={setChatOpen}
        campaignId={campaignId}
        storeId={chatStoreId}
        storeName={chatStoreName}
      />
    </div>
  );
};

// ─── Sub-component: Approval Toggles ────────────────────

interface ApprovalTogglesProps {
  schedule: Schedule | undefined;
  storeId: string;
  canEdit: boolean;
  hasDateAndTime: boolean;
  onMultiUpdate: (fields: Record<string, any>) => void;
}

function ApprovalToggles({ schedule, storeId, canEdit, hasDateAndTime, onMultiUpdate }: ApprovalTogglesProps) {
  const storeApproved = schedule?.store_approved ?? false;
  const teamApproved = schedule?.team_approved ?? false;
  const hasPendency = !storeApproved || !teamApproved;
  const responsibility = schedule?.responsibility || "team";

  const handleSetApproval = (field: "store_approved" | "team_approved", newVal: boolean) => {
    if (!canEdit) return;
    const now = new Date().toISOString();
    const atField = field === "store_approved" ? "store_approved_at" : "team_approved_at";
    const otherApproved = field === "store_approved" ? (schedule?.team_approved ?? false) : (schedule?.store_approved ?? false);
    
    const updates: Record<string, any> = {
      [field]: newVal,
      [atField]: now,
    };

    // If both become approved, clear responsibility
    if (newVal && otherApproved) {
      updates.responsibility = null;
      updates.responsibility_at = null;
    }

    onMultiUpdate(updates);
  };

  const handleSetResponsibility = (value: string) => {
    if (!canEdit) return;
    onMultiUpdate({
      responsibility: value,
      responsibility_at: new Date().toISOString(),
    });
  };

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return null;
    try {
      return format(new Date(ts), "dd/MM/yy HH:mm", { locale: ptBR });
    } catch {
      return null;
    }
  };

  const sectionDisabled = !canEdit || !hasDateAndTime;

  return (
    <div className={cn("border-t border-border bg-muted/30 px-4 py-3 space-y-2", !hasDateAndTime && "opacity-50")}>
      <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide mb-1">
        Status de aprovação da instalação
        {!hasDateAndTime && <span className="ml-2 text-muted-foreground font-normal normal-case">(preencha data e horário)</span>}
      </p>
      {/* Toggle 1: Lojista */}
      <ToggleSwitch
        label="Lojista"
        leftLabel="Aprovado"
        rightLabel="Desaprovado"
        isLeft={storeApproved}
        onClickLeft={() => handleSetApproval("store_approved", true)}
        onClickRight={() => handleSetApproval("store_approved", false)}
        timestamp={formatTimestamp(schedule?.store_approved_at ?? null)}
        disabled={sectionDisabled}
      />

      {/* Toggle 2: Equipe */}
      <ToggleSwitch
        label="Equipe"
        leftLabel="Aprovado"
        rightLabel="Desaprovado"
        isLeft={teamApproved}
        onClickLeft={() => handleSetApproval("team_approved", true)}
        onClickRight={() => handleSetApproval("team_approved", false)}
        timestamp={formatTimestamp(schedule?.team_approved_at ?? null)}
        disabled={sectionDisabled}
      />

      {/* Toggle 3: Responsabilidade — only when there's a pendency */}
      {hasPendency && (
        <ToggleSwitch
          label="Responsável"
          leftLabel="Cliente"
          rightLabel="Equipe"
          isLeft={responsibility !== "team"}
          onClickLeft={() => handleSetResponsibility("client")}
          onClickRight={() => handleSetResponsibility("team")}
          timestamp={formatTimestamp(schedule?.responsibility_at ?? null)}
          disabled={sectionDisabled}
        />
      )}
    </div>
  );
}

// ─── Sub-component: Toggle Switch ───────────────────────

interface ToggleSwitchProps {
  label: string;
  leftLabel: string;
  rightLabel: string;
  isLeft: boolean;
  onClickLeft: () => void;
  onClickRight: () => void;
  timestamp: string | null;
  disabled?: boolean;
}

function ToggleSwitch({ label, leftLabel, rightLabel, isLeft, onClickLeft, onClickRight, timestamp, disabled }: ToggleSwitchProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold text-muted-foreground w-[70px] shrink-0 uppercase tracking-wide">{label}</span>
      <div
        className={cn(
          "relative flex items-center rounded-full h-7 w-full max-w-[220px] border transition-colors select-none overflow-hidden",
          disabled && "opacity-60 cursor-not-allowed",
          isLeft
            ? "bg-emerald-500/15 border-emerald-500/40"
            : "bg-amber-500/15 border-amber-500/40"
        )}
      >
        {/* Sliding indicator */}
        <span
          className={cn(
            "absolute top-0.5 bottom-0.5 w-1/2 rounded-full transition-all duration-300 shadow-sm pointer-events-none",
            isLeft
              ? "left-0.5 bg-emerald-500"
              : "left-[calc(50%-2px)] bg-amber-500"
          )}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={onClickLeft}
          className={cn(
            "relative z-10 flex-1 text-center text-[10px] font-bold transition-colors cursor-pointer h-full",
            isLeft ? "text-primary-foreground" : "text-foreground"
          )}
        >{leftLabel}</button>
        <button
          type="button"
          disabled={disabled}
          onClick={onClickRight}
          className={cn(
            "relative z-10 flex-1 text-center text-[10px] font-bold transition-colors cursor-pointer h-full",
            !isLeft ? "text-primary-foreground" : "text-foreground"
          )}
        >{rightLabel}</button>
      </div>
      {timestamp && (
        <span className="text-[9px] text-muted-foreground whitespace-nowrap">{timestamp}</span>
      )}
    </div>
  );
}

// ─── Sub-component: Store Contacts Display ──────────────

interface StoreContactsDisplayProps {
  store: ClientStore;
  contacts: StoreContact[];
  roleMap: Record<string, string>;
  schedule: Schedule | undefined;
  agencyName: string;
  clientName: string;
  campaignName: string;
}

function StoreContactsDisplay({ store, contacts, roleMap, schedule, agencyName, clientName, campaignName }: StoreContactsDisplayProps) {
  const hasContacts = contacts.length > 0;
  const primaryContact = hasContacts ? contacts[0] : null;

  if (!hasContacts) {
    return (
      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4">
        <span><span className="font-medium text-foreground">Contato:</span> {store.manager_name || "—"}</span>
        <span><span className="font-medium text-foreground">Tel:</span> {store.phone || "—"}</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <ContactRow
        contact={primaryContact!}
        roleMap={roleMap}
        schedule={schedule}
        agencyName={agencyName}
        clientName={clientName}
        campaignName={campaignName}
      />
      {contacts.length > 1 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2 text-muted-foreground hover:text-foreground">
              <Users className="w-3 h-3" />
              Ver todos os {contacts.length} contatos
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 max-h-64 overflow-y-auto p-3" align="start">
            <p className="text-xs font-semibold text-foreground mb-2">Contatos da loja</p>
            <div className="space-y-2.5">
              {contacts.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  roleMap={roleMap}
                  schedule={schedule}
                  agencyName={agencyName}
                  clientName={clientName}
                  campaignName={campaignName}
                  showRole
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// ─── Sub-component: Single Contact Row ──────────────────

interface ContactRowProps {
  contact: StoreContact;
  roleMap: Record<string, string>;
  schedule: Schedule | undefined;
  agencyName: string;
  clientName: string;
  campaignName: string;
  showRole?: boolean;
}

function ContactRow({ contact, roleMap, schedule, agencyName, clientName, campaignName, showRole }: ContactRowProps) {
  const roleName = contact.role_id ? roleMap[contact.role_id] : null;

  return (
    <div className="text-xs text-muted-foreground space-y-0.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-medium text-foreground">{contact.name || "—"}</span>
        {showRole && roleName && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{roleName}</span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {contact.phone && (
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {contact.phone}
            <a
              href={buildWhatsAppUrl(contact.phone, contact.name, agencyName, clientName, campaignName, schedule?.scheduled_date ?? null, schedule?.scheduled_time ?? null)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-primary-foreground transition-colors"
              title="Enviar mensagem no WhatsApp"
            >
              <MessageCircle className="w-3 h-3" />
            </a>
          </span>
        )}
        {contact.email && (
          <span className="flex items-center gap-1">
            <Mail className="w-3 h-3" />
            {contact.email}
          </span>
        )}
      </div>
    </div>
  );
}

export default SchedulingTab;
