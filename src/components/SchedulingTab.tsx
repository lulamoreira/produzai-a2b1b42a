import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Schedule, ApprovalStatusValue } from "@/types/schedule";
import { useCampaignSchedules } from "@/hooks/useCampaignSchedules";
import { useOccurrenceStatusSync } from "@/hooks/useOccurrenceStatusSync";
import { buildContactsByStoreMap } from "@/lib/storeHelpers";
import { isResolvedStatus } from "@/lib/occurrenceHelpers";
import { type ClientStore } from "@/hooks/useMultiClientData";
import { getStateColor } from "@/lib/stateColors";
import { useStoreContactsByClient, useStoreContactRoles, type StoreContact, type StoreContactRole } from "@/hooks/useStoreContacts";
import { useClientPermission } from "@/hooks/useClientPermission";
import { Input } from "@/components/ui/input";
import DebouncedInput from "@/components/DebouncedInput";
import ScheduleCardChat from "@/components/ScheduleCardChat";
import ScheduleHistorySheet from "@/components/ScheduleHistorySheet";
import ActivityLogPanel from "@/components/ActivityLogPanel";
import { useScheduleChatUnreadCounts, useMarkAsRead } from "@/hooks/useChatReadStatus";
import { useUserRole } from "@/hooks/useUserRole";
import { useLogActivity } from "@/hooks/useActivityLogs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Search, CalendarIcon, Clock, FileText, Sun, Moon, HelpCircle, Download, Users, MessageCircle, Phone, Mail, AlertTriangle, Wrench, CheckCircle2, AlertCircle, History, ClipboardList, Lock, LockOpen, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
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

// Schedule type is now imported from @/types/schedule

const PREFERENCE_OPTIONS = [
  { value: "not_informed", label: "Não informado", icon: HelpCircle },
  { value: "morning", label: "Manhã", icon: Sun },
  { value: "night", label: "Noite", icon: Moon },
  { value: "both", label: "Ambos", icon: Sun },
];

function buildWhatsAppUrl(phone: string, contactName: string, agencyName: string, clientName: string, campaignName: string, date: string | null, time: string | null, messageTemplate?: string, storeName?: string) {
  const firstName = contactName.split(" ")[0];
  const agencyFirst = agencyName.split(" ")[0];
  const clientFirst = clientName.split(" ")[0];
  const dateStr = date ? format(new Date(date + "T12:00:00"), "dd/MM/yyyy") : "(data a definir)";
  const timeStr = time || "(horário a definir)";

  const message = messageTemplate
    ? messageTemplate
        .replace(/\{name\}/g, firstName)
        .replace(/\{store\}/g, storeName || "")
        .replace(/\{agency\}/g, agencyFirst)
        .replace(/\{client\}/g, clientFirst)
        .replace(/\{campaign\}/g, campaignName)
        .replace(/\{date\}/g, dateStr)
        .replace(/\{time\}/g, timeStr)
    : `Olá 😊\n\nSomos da ${agencyFirst}, responsáveis pelo agendamento das instalações da Campanha ${clientFirst} - ${campaignName}.\n\nGostaríamos de solicitar a autorização para seguir com a instalação da campanha, que está prevista para o dia ${dateStr} às ${timeStr}.\n\nPode, por gentileza, verificar com o shopping a liberação o quanto antes?\n\nAgradecemos imensamente sua colaboração e aguardamos o retorno dessa mensagem com a autorização/OS para a instalação.\n\nFicamos à disposição! 🙏🏼`;

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
  const [filterMessages, setFilterMessages] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterPreference, setFilterPreference] = useState("");
  const [filterResponsibility, setFilterResponsibility] = useState("");
  const [filterLocked, setFilterLocked] = useState("");
  const [filterReschedule, setFilterReschedule] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyStoreId, setHistoryStoreId] = useState("");
  const [historyStoreName, setHistoryStoreName] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  const [logStoreId, setLogStoreId] = useState("");
  const [logStoreName, setLogStoreName] = useState("");
  const { isAdminOrMaster } = useUserRole();
  const { hasPermission: canLockCards } = useClientPermission(clientId, "can_lock_cards");
  const logActivity = useLogActivity();
  const [lockLoading, setLockLoading] = useState<Record<string, boolean>>({});
  const [bulkLockLoading, setBulkLockLoading] = useState(false);
  const [expandedOriginal, setExpandedOriginal] = useState<Record<string, boolean>>({});

  // Unread message counts
  const { data: chatCounts } = useScheduleChatUnreadCounts(campaignId);
  const markAsRead = useMarkAsRead();

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

  const contactsByStore = useMemo(() => buildContactsByStoreMap(allContacts), [allContacts]);

  // Fetch WhatsApp scheduling message template
  const { data: schedulingMsgTemplate } = useQuery({
    queryKey: ["system_message", "whatsapp_scheduling_authorization"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_messages")
        .select("content")
        .eq("key", "whatsapp_scheduling_authorization")
        .is("agency_id", null)
        .maybeSingle();
      return data?.content as string | undefined;
    },
  });

  // Shared hooks for schedules and occurrence status sync
  const { schedules, scheduleMap } = useCampaignSchedules(campaignId);
  const { storeOccurrenceStatus } = useOccurrenceStatusSync(campaignId);

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

  const storeModels = useMemo(() => {
    const set = new Set(stores.map((s) => s.store_model).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [stores]);

  const filteredStores = useMemo(() => {
    let result = [...stores];
    if (filterState) result = result.filter((s) => s.state === filterState);
    if (filterCity) result = result.filter((s) => s.city === filterCity);
    if (filterModel) result = result.filter((s) => s.store_model === filterModel);
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
        const isResch = !!sch?.reschedule_enabled;
        const storeStatus = isResch ? (sch?.reschedule_store_approval_status ?? "under_review") : (sch?.store_approval_status ?? "under_review");
        const teamStatus = isResch ? (sch?.reschedule_team_approval_status ?? "under_review") : (sch?.team_approval_status ?? "under_review");
        const effOs = isResch ? sch?.reschedule_os : sch?.installation_os;
        if (filterApproval === "approved") return storeStatus === "approved" && teamStatus === "approved";
        if (filterApproval === "pending") return storeStatus !== "approved" || teamStatus !== "approved";
        if (filterApproval === "rejected") return storeStatus === "rejected" || teamStatus === "rejected";
        if (filterApproval === "missing_os") return storeStatus === "approved" && teamStatus === "approved" && !effOs;
        return true;
      });
    }
    if (filterDate) {
      result = result.filter((s) => {
        const sch = scheduleMap[s.id];
        const effDate = sch?.reschedule_enabled ? sch?.reschedule_date : sch?.scheduled_date;
        return effDate === filterDate;
      });
    }
    if (filterPeriod) {
      result = result.filter((s) => {
        const sch = scheduleMap[s.id];
        const time = sch?.reschedule_enabled ? sch?.reschedule_time : sch?.scheduled_time;
        if (!time) return false;
        const hour = parseInt(time.split(":")[0], 10);
        if (filterPeriod === "morning") return hour >= 1 && hour <= 11;
        if (filterPeriod === "afternoon") return hour >= 12 && hour <= 17;
        if (filterPeriod === "night") return hour >= 18 && hour <= 23;
        return true;
      });
    }
    if (filterMessages === "unread") {
      result = result.filter((s) => (chatCounts?.unreadPerStore[s.id] || 0) > 0);
    } else if (filterMessages === "has_messages") {
      result = result.filter((s) => (chatCounts?.totalPerStore[s.id] || 0) > 0);
    }
    if (filterTeam) {
      if (filterTeam === "no_team") {
        result = result.filter((s) => !scheduleMap[s.id]?.team_id);
      } else {
        result = result.filter((s) => scheduleMap[s.id]?.team_id === filterTeam);
      }
    }
    if (filterPreference) {
      result = result.filter((s) => {
        const pref = scheduleMap[s.id]?.installation_preference ?? "not_informed";
        return pref === filterPreference;
      });
    }
    if (filterResponsibility) {
      result = result.filter((s) => {
        const resp = scheduleMap[s.id]?.responsibility ?? "team";
        return resp === filterResponsibility;
      });
    }
    if (filterLocked === "locked") {
      result = result.filter((s) => !!scheduleMap[s.id]?.locked);
    } else if (filterLocked === "unlocked") {
      result = result.filter((s) => !scheduleMap[s.id]?.locked);
    }
    if (filterReschedule === "yes") {
      result = result.filter((s) => !!scheduleMap[s.id]?.reschedule_enabled);
    } else if (filterReschedule === "no") {
      result = result.filter((s) => !scheduleMap[s.id]?.reschedule_enabled);
    }
    return result.sort((a, b) => (a.state || "").localeCompare(b.state || "") || a.name.localeCompare(b.name));
  }, [stores, filterState, filterCity, filterModel, searchTerm, filterApproval, filterDate, filterPeriod, filterMessages, filterTeam, filterPreference, filterResponsibility, filterLocked, filterReschedule, scheduleMap, chatCounts]);

  const fieldLabels: Record<string, string> = {
    scheduled_date: "Data",
    scheduled_time: "Horário",
    installation_os: "OS Instalação",
    installation_preference: "Preferência",
    team_id: "Equipe",
    store_approval_status: "Aprovação Lojista",
    team_approval_status: "Aprovação Equipe",
    responsibility: "Responsável",
    suggested_date: "Data Sugerida",
    suggested_time: "Horário Sugerido",
    reschedule_enabled: "Remarcação",
    reschedule_date: "Data (Remarcação)",
    reschedule_time: "Horário (Remarcação)",
    reschedule_os: "OS (Remarcação)",
    reschedule_preference: "Preferência (Remarcação)",
    reschedule_store_approval_status: "Aprovação Lojista (Remarcação)",
    reschedule_team_approval_status: "Aprovação Equipe (Remarcação)",
    reschedule_responsibility: "Responsável (Remarcação)",
    reschedule_suggested_date: "Data Sugerida (Remarcação)",
    reschedule_suggested_time: "Horário Sugerido (Remarcação)",
    reschedule_suggested_date_2: "Data Sugerida 2 (Remarcação)",
    reschedule_suggested_time_2: "Horário Sugerido 2 (Remarcação)",
  };

  const handleFieldChange = (storeId: string, field: string, value: any) => {
    const existing = scheduleMap[storeId];
    const storeName = stores.find(s => s.id === storeId)?.name || storeId;
    const label = fieldLabels[field] || field;
    const oldVal = existing ? (existing as any)[field] : null;
    logActivity.mutate({
      campaign_id: campaignId,
      store_id: storeId,
      module: "scheduling",
      action: `Alterou "${label}"`,
      details: `${oldVal ?? "(vazio)"} → ${value ?? "(vazio)"}`,
    });
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
      store_approval_status: existing?.store_approval_status ?? "under_review",
      team_approval_status: existing?.team_approval_status ?? "under_review",
      responsibility: existing?.responsibility ?? "team",
      store_approved_at: existing?.store_approved_at ?? null,
      team_approved_at: existing?.team_approved_at ?? null,
      responsibility_at: existing?.responsibility_at ?? null,
      suggested_date: existing?.suggested_date ?? null,
      suggested_time: existing?.suggested_time ?? null,
      ...(typeof field === "string" ? { [field]: value } : {}),
    });
  };

  const formatFieldValue = (field: string, value: any): string => {
    if (value === null || value === undefined || value === "") return "(vazio)";
    if (field === "store_approval_status" || field === "team_approval_status" || field === "reschedule_store_approval_status" || field === "reschedule_team_approval_status") {
      if (value === "approved") return "Aprovado";
      if (value === "rejected") return "Desaprovado";
      if (value === "under_review") return "Em análise";
      if (value === "pending") return "Pendente";
      return String(value);
    }
    if (field === "responsibility" || field === "reschedule_responsibility") {
      if (value === "team") return "Equipe";
      if (value === "client") return "Cliente";
      return String(value);
    }
    if (field === "installation_preference" || field === "reschedule_preference") return prefLabel(value);
    if (field === "team_id") {
      const team = value ? teamMap[value] : null;
      return team?.name || "(nenhuma)";
    }
    if ((field === "scheduled_date" || field === "suggested_date" || field === "suggested_date_2" || field === "reschedule_date" || field === "reschedule_suggested_date" || field === "reschedule_suggested_date_2") && value) {
      try { return format(new Date(value + "T12:00:00"), "dd/MM/yyyy"); } catch { return String(value); }
    }
    if (field === "store_approved" || field === "team_approved") return value ? "Sim" : "Não";
    if (field === "reschedule_enabled") return value ? "Sim" : "Não";
    return String(value);
  };

  const handleMultiFieldChange = (storeId: string, fields: Record<string, any>) => {
    const existing = scheduleMap[storeId];

    // Log each meaningful field change
    const loggableFields: Record<string, string> = {
      ...fieldLabels,
      suggested_date_2: "Data Sugerida 2",
      suggested_time_2: "Horário Sugerido 2",
      store_approved: "Aprovação Lojista (bool)",
      team_approved: "Aprovação Equipe (bool)",
    };
    const skipFields = ["store_approved_at", "team_approved_at", "responsibility_at", "store_approved", "team_approved", "reschedule_store_approved_at", "reschedule_team_approved_at", "reschedule_responsibility_at"];
    const changedDetails: string[] = [];
    for (const [key, newVal] of Object.entries(fields)) {
      if (skipFields.includes(key)) continue;
      const label = loggableFields[key];
      if (!label) continue;
      const oldVal = existing ? (existing as any)[key] : null;
      if (oldVal === newVal) continue;
      changedDetails.push(`${label}: ${formatFieldValue(key, oldVal)} → ${formatFieldValue(key, newVal)}`);
    }
    if (changedDetails.length > 0) {
      logActivity.mutate({
        campaign_id: campaignId,
        store_id: storeId,
        module: "scheduling",
        action: changedDetails.length === 1 ? `Alterou "${changedDetails[0].split(":")[0]}"` : "Alteração múltipla",
        details: changedDetails.join("\n"),
      });
    }

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
      store_approval_status: existing?.store_approval_status ?? "under_review",
      team_approval_status: existing?.team_approval_status ?? "under_review",
      responsibility: existing?.responsibility ?? "team",
      store_approved_at: existing?.store_approved_at ?? null,
      team_approved_at: existing?.team_approved_at ?? null,
      responsibility_at: existing?.responsibility_at ?? null,
      suggested_date: existing?.suggested_date ?? null,
      suggested_time: existing?.suggested_time ?? null,
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

  const approvalLabel = (val: ApprovalStatusValue | undefined) => {
    if (val === "approved") return "Aprovado";
    if (val === "rejected") return "Desaprovado";
    return "Em análise";
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
        "Aprovação Lojista": approvalLabel(schedule?.store_approval_status as ApprovalStatusValue | undefined),
        "Aprovação Equipe": approvalLabel(schedule?.team_approval_status as ApprovalStatusValue | undefined),
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
      <div className="space-y-2">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar loja..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={filterState}
            onChange={(e) => { setFilterState(e.target.value); setFilterCity(""); }}
            className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground flex-1 min-w-[100px] max-w-[150px]"
          >
            <option value="">Todos estados</option>
            {states.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground flex-1 min-w-[100px] max-w-[150px]"
          >
            <option value="">Todas cidades</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filterApproval}
            onChange={(e) => setFilterApproval(e.target.value)}
            className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground flex-1 min-w-[100px] max-w-[160px]"
          >
            <option value="">Aprovações</option>
            <option value="approved">✅ Aprovado</option>
            <option value="pending">⚠️ Pendência</option>
            <option value="rejected">❌ Desaprovado</option>
            <option value="missing_os">📋 Falta OS</option>
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground min-w-[120px] max-w-[160px]"
            title="Filtrar por data"
          />
          {filterDate && (
            <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs text-muted-foreground" onClick={() => setFilterDate("")}>
              ✕
            </Button>
          )}
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground flex-1 min-w-[100px] max-w-[140px]"
          >
            <option value="">Período</option>
            <option value="morning">🌅 Manhã</option>
            <option value="afternoon">☀️ Tarde</option>
            <option value="night">🌙 Noite</option>
          </select>
          {filterPeriod && (
            <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs text-muted-foreground" onClick={() => setFilterPeriod("")}>
              ✕
            </Button>
          )}
          <select
            value={filterMessages}
            onChange={(e) => setFilterMessages(e.target.value)}
            className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground flex-1 min-w-[100px] max-w-[160px]"
          >
            <option value="">Mensagens</option>
            <option value="unread">💬 Novas</option>
            <option value="has_messages">📩 Com msg</option>
          </select>
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground flex-1 min-w-[100px] max-w-[160px]"
          >
            <option value="">Equipe</option>
            <option value="no_team">Sem equipe</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select
            value={filterPreference}
            onChange={(e) => setFilterPreference(e.target.value)}
            className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground flex-1 min-w-[100px] max-w-[160px]"
          >
            <option value="">Preferência</option>
            {PREFERENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={filterResponsibility}
            onChange={(e) => setFilterResponsibility(e.target.value)}
            className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground flex-1 min-w-[100px] max-w-[150px]"
          >
            <option value="">Responsável</option>
            <option value="team">Equipe</option>
            <option value="client">Cliente</option>
          </select>
          <select
            value={filterLocked}
            onChange={(e) => setFilterLocked(e.target.value)}
            className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground flex-1 min-w-[100px] max-w-[150px]"
          >
            <option value="">Bloqueio</option>
            <option value="locked">🔒 Bloqueado</option>
            <option value="unlocked">🔓 Liberado</option>
          </select>
          <select
            value={filterReschedule}
            onChange={(e) => setFilterReschedule(e.target.value)}
            className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground flex-1 min-w-[100px] max-w-[150px]"
          >
            <option value="">Remarcação</option>
            <option value="yes">Com remarcação</option>
            <option value="no">Sem remarcação</option>
          </select>
          {storeModels.length > 0 && (
            <select
              value={filterModel}
              onChange={(e) => setFilterModel(e.target.value)}
              className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground flex-1 min-w-[100px] max-w-[150px]"
            >
              <option value="">Modelo</option>
              {storeModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setTeamDialogOpen(true)}>
            <Wrench className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Equipes</span><span className="sm:hidden">Eq.</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportTeams}>
            <Users className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Exportar Equipes</span><span className="sm:hidden">Exp. Eq.</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
          {canLockCards && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={bulkLockLoading}
              onClick={async () => {
                setBulkLockLoading(true);
                try {
                  const unlocked = filteredStores.filter(s => scheduleMap[s.id] && !scheduleMap[s.id]?.locked);
                  const allLocked = unlocked.length === 0;
                  const newLocked = !allLocked;
                  const ids = filteredStores.map(s => scheduleMap[s.id]?.id).filter(Boolean) as string[];
                  if (ids.length === 0) { setBulkLockLoading(false); return; }
                  const { error } = await supabase.from("campaign_schedules").update({ locked: newLocked } as any).in("id", ids);
                  if (error) throw error;
                  queryClient.invalidateQueries({ queryKey: ["campaign_schedules", campaignId] });
                  toast.success(newLocked ? `${ids.length} cards bloqueados!` : `${ids.length} cards desbloqueados!`);
                } catch (err: any) {
                  toast.error(err.message || "Erro ao alterar bloqueio em massa.");
                } finally {
                  setBulkLockLoading(false);
                }
              }}
            >
              {(() => {
                const unlocked = filteredStores.filter(s => scheduleMap[s.id] && !scheduleMap[s.id]?.locked);
                const allLocked = unlocked.length === 0 && filteredStores.some(s => scheduleMap[s.id]);
                return allLocked
                  ? <><LockOpen className="w-3.5 h-3.5" /> Desbloquear Todos</>
                  : <><Lock className="w-3.5 h-3.5" /> Bloquear Todos</>;
              })()}
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      {(() => {
        const total = filteredStores.length;
        const scheduled = filteredStores.filter(s => {
          const sch = scheduleMap[s.id];
          const effDate = sch?.reschedule_enabled ? sch?.reschedule_date : sch?.scheduled_date;
          return !!effDate;
        }).length;
        const noDate = total - scheduled;
        const approved = filteredStores.filter(s => {
          const sch = scheduleMap[s.id];
          return sch?.store_approval_status === "approved" && sch?.team_approval_status === "approved";
        }).length;
        const locked = filteredStores.filter(s => scheduleMap[s.id]?.locked).length;
        const withTeam = filteredStores.filter(s => scheduleMap[s.id]?.team_id).length;
        return (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-2">
            <span><strong className="text-foreground">{total}</strong> loja(s)</span>
            <span>📅 <strong className="text-foreground">{scheduled}</strong> agendadas</span>
            <span>⏳ <strong className="text-foreground">{noDate}</strong> sem data</span>
            <span>✅ <strong className="text-foreground">{approved}</strong> aprovadas</span>
            <span>🔧 <strong className="text-foreground">{withTeam}</strong> com equipe</span>
            <span>🔒 <strong className="text-foreground">{locked}</strong> bloqueadas</span>
          </div>
        );
      })()}

      {/* Store Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 sm:gap-4">
        {filteredStores.map((store) => {
          const colors = getStateColor(store.state);
          const schedule = scheduleMap[store.id];
          const selectedDate = schedule?.scheduled_date ? new Date(schedule.scheduled_date + "T12:00:00") : undefined;
          const storeContacts = contactsByStore[store.id] || [];
          const assignedTeam = schedule?.team_id ? teamMap[schedule.team_id] : null;
          const teamMembers: TeamMember[] = schedule?.team_id ? (allMembersMap[schedule.team_id] || []) : [];
          const teamVehicles: TeamVehicle[] = schedule?.team_id ? (allVehiclesMap[schedule.team_id] || []) : [];
          const teamIncomplete = assignedTeam ? isTeamIncomplete(teamMembers) : false;

          // Determine effective status: use reschedule if enabled
          const isReschedule = !!schedule?.reschedule_enabled;
          const effectiveStoreStatus = isReschedule
            ? ((schedule?.reschedule_store_approval_status ?? "under_review") as ApprovalStatusValue)
            : ((schedule?.store_approval_status ?? "under_review") as ApprovalStatusValue);
          const effectiveTeamStatus = isReschedule
            ? ((schedule?.reschedule_team_approval_status ?? "under_review") as ApprovalStatusValue)
            : ((schedule?.team_approval_status ?? "under_review") as ApprovalStatusValue);
          const effectiveOs = isReschedule ? schedule?.reschedule_os : schedule?.installation_os;
          const effectiveDate = isReschedule ? schedule?.reschedule_date : schedule?.scheduled_date;
          const effectiveTime = isReschedule ? schedule?.reschedule_time : schedule?.scheduled_time;

          const storeApprovalStatus = (schedule?.store_approval_status ?? "under_review") as ApprovalStatusValue;
          const teamApprovalStatus = (schedule?.team_approval_status ?? "under_review") as ApprovalStatusValue;
          const storeApproved = effectiveStoreStatus === "approved";
          const teamApproved = effectiveTeamStatus === "approved";
          const hasOs = !!(effectiveOs?.trim());
          const fullyApproved = storeApproved && teamApproved && hasOs;
          const hasPendency = !fullyApproved;
          const isCardLocked = !!schedule?.locked;
          const cardCanEdit = canEdit && (!isCardLocked || isAdminOrMaster);

          const handleToggleLock = async () => {
            if (!schedule) return;
            setLockLoading(prev => ({ ...prev, [store.id]: true }));
            try {
              const newLocked = !isCardLocked;
              const { error } = await supabase.from("campaign_schedules").update({ locked: newLocked } as any).eq("id", schedule.id);
              if (error) throw error;
              const { data: { user: currentUser } } = await supabase.auth.getUser();
              if (currentUser) {
                await supabase.from("activity_logs").insert({
                  campaign_id: campaignId,
                  store_id: store.id,
                  user_id: currentUser.id,
                  module: "schedules",
                  action: newLocked ? "Card bloqueado" : "Card desbloqueado",
                  details: newLocked ? "Card bloqueado para edição" : "Card desbloqueado para edição",
                });
              }
              queryClient.invalidateQueries({ queryKey: ["campaign_schedules", campaignId] });
              toast.success(newLocked ? "Card bloqueado!" : "Card desbloqueado!");
            } catch (err: any) {
              toast.error(err.message || "Erro ao alterar bloqueio.");
            } finally {
              setLockLoading(prev => ({ ...prev, [store.id]: false }));
            }
          };

          return (
            <div
              key={store.id}
              className={`aqua-card overflow-hidden shadow-sm flex flex-col ${isCardLocked ? "opacity-80" : ""}`}
              style={{ borderColor: colors.text, borderWidth: 2, border: `2px solid ${colors.text}` }}
            >
              {/* Header */}
              <div
                className="px-4 py-3 relative"
                style={{ backgroundColor: colors.bg, color: colors.text }}
              >
                <div className="font-semibold text-sm break-words leading-snug">{store.name}</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg leading-none">{store.store_code || "—"}</span>
                    <span className="text-xs opacity-80">{store.state} · {store.city || "—"}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 relative"
                      style={{ color: colors.text }}
                      title="Abrir chat"
                      onClick={() => {
                        setChatStoreId(store.id);
                        setChatStoreName(store.name);
                        setChatOpen(true);
                        markAsRead.mutate({ contextType: "schedule_chat", contextId: `${campaignId}:${store.id}` });
                      }}
                    >
                      <MessageCircle className="w-4 h-4" />
                      {(chatCounts?.unreadPerStore[store.id] || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
                          {chatCounts!.unreadPerStore[store.id]}
                        </span>
                      )}
                      {(chatCounts?.totalPerStore[store.id] || 0) > 0 && !(chatCounts?.unreadPerStore[store.id]) && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-muted text-muted-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
                          {chatCounts!.totalPerStore[store.id]}
                        </span>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      style={{ color: colors.text }}
                      title="Histórico"
                      onClick={() => {
                        setHistoryStoreId(store.id);
                        setHistoryStoreName(store.name);
                        setHistoryOpen(true);
                      }}
                    >
                      <History className="w-4 h-4" />
                    </Button>
                    {isAdminOrMaster && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        style={{ color: colors.text }}
                        title="Log de Atividades"
                        onClick={() => {
                          setLogStoreId(store.id);
                          setLogStoreName(store.name);
                          setLogOpen(true);
                        }}
                      >
                        <ClipboardList className="w-4 h-4" />
                      </Button>
                    )}
                    {canLockCards && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 shrink-0 ${isCardLocked ? "text-destructive" : ""}`}
                        style={!isCardLocked ? { color: colors.text } : undefined}
                        title={isCardLocked ? "Desbloquear card" : "Bloquear card"}
                        onClick={handleToggleLock}
                        disabled={!!lockLoading[store.id]}
                      >
                        {isCardLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
                      </Button>
                    )}
                    {fullyApproved ? (
                      <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-600 drop-shadow" />
                    ) : (effectiveStoreStatus === "approved" && effectiveTeamStatus === "approved" && !hasOs && effectiveDate && effectiveTime) ? (
                      <span className="text-[10px] font-bold text-destructive whitespace-nowrap leading-tight text-center shrink-0 bg-destructive/10 px-1.5 py-0.5 rounded">FALTA<br/>OS</span>
                    ) : (
                      <AlertCircle className="w-6 h-6 shrink-0 text-amber-500 drop-shadow" />
                    )}
                  </div>
                </div>
                {isReschedule && (
                  <span className="absolute top-1 right-1 text-[8px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full leading-none">REM</span>
                )}
                {isCardLocked && !isReschedule && (
                  <span className="absolute top-1 right-1 text-[8px] font-bold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full leading-none flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> BLOQ
                  </span>
                )}
                {isCardLocked && isReschedule && (
                  <span className="absolute top-1 left-1 text-[8px] font-bold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full leading-none flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> BLOQ
                  </span>
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
                  messageTemplate={schedulingMsgTemplate}
                />

                <hr className="border-border" />

                {/* Team assignment */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1">
                    <Wrench className="w-3 h-3" /> Equipe de Instalação
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      disabled={!cardCanEdit}
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

                {/* Scheduling fields - show reschedule as primary when enabled */}
                {isReschedule ? (
                  <>
                    {/* Collapsible original data */}
                    <div className="rounded-md border border-muted bg-muted/20">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide hover:bg-muted/40 transition-colors"
                        onClick={() => setExpandedOriginal(prev => ({ ...prev, [store.id]: !prev[store.id] }))}
                      >
                        <span>📋 Dados do agendamento original</span>
                        {expandedOriginal[store.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      {expandedOriginal[store.id] && (
                        <div className="px-3 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div><span className="font-medium text-foreground">Data:</span> {schedule?.scheduled_date ? format(new Date(schedule.scheduled_date + "T12:00:00"), "dd/MM/yyyy") : "—"}</div>
                          <div><span className="font-medium text-foreground">Horário:</span> {schedule?.scheduled_time || "—"}</div>
                          <div><span className="font-medium text-foreground">OS:</span> {schedule?.installation_os || "—"}</div>
                          <div><span className="font-medium text-foreground">Preferência:</span> {prefLabel(schedule?.installation_preference || "not_informed")}</div>
                        </div>
                      )}
                    </div>

                    {/* Reschedule fields as primary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                              disabled={!cardCanEdit}
                              className={cn("w-full justify-start text-left text-xs font-normal h-8 overflow-hidden", !schedule?.reschedule_date && "text-muted-foreground")}
                            >
                              <span className="truncate">{schedule?.reschedule_date ? format(new Date(schedule.reschedule_date + "T12:00:00"), "dd/MM/yyyy") : "Selecionar"}</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={schedule?.reschedule_date ? new Date(schedule.reschedule_date + "T12:00:00") : undefined}
                              onSelect={(date) => handleFieldChange(store.id, "reschedule_date", date ? format(date, "yyyy-MM-dd") : null)}
                              locale={ptBR}
                              className="p-3 pointer-events-auto"
                            />
                            {schedule?.reschedule_date && (
                              <div className="px-3 pb-3">
                                <Button variant="ghost" size="sm" className="w-full text-xs text-destructive hover:text-destructive" onClick={() => handleFieldChange(store.id, "reschedule_date", null)}>
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
                            disabled={!cardCanEdit}
                            value={schedule?.reschedule_time || ""}
                            onValueCommit={(val) => handleFieldChange(store.id, "reschedule_time", val || null)}
                            className="h-8 text-xs flex-1"
                          />
                          {schedule?.reschedule_time && cardCanEdit && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive shrink-0" onClick={() => handleFieldChange(store.id, "reschedule_time", null)} title="Limpar horário">
                              ✕
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* OS */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground flex items-center gap-1">
                          <FileText className="w-3 h-3" /> OS Instalação
                          {!hasOs && schedule?.reschedule_date && schedule?.reschedule_time && (
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                          )}
                        </label>
                        <DebouncedInput
                          disabled={!cardCanEdit}
                          placeholder="Nº OS"
                          value={schedule?.reschedule_os || ""}
                          onValueCommit={(val) => handleFieldChange(store.id, "reschedule_os", val || null)}
                          className="h-8 text-xs"
                        />
                      </div>

                      {/* Preference - always visible */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground flex items-center gap-1">
                          <Sun className="w-3 h-3" /> Preferência
                        </label>
                        <select
                          disabled={!cardCanEdit}
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
                  </>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                            disabled={!cardCanEdit}
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
                          disabled={!cardCanEdit}
                          value={schedule?.scheduled_time || ""}
                          onValueCommit={(val) => handleFieldChange(store.id, "scheduled_time", val || null)}
                          className="h-8 text-xs flex-1"
                        />
                        {schedule?.scheduled_time && cardCanEdit && (
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
                        disabled={!cardCanEdit}
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
                        disabled={!cardCanEdit}
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
                )}
              </div>

              {/* Footer - Approval Toggles: use reschedule approval when reschedule is active */}
              {isReschedule ? (
                <RescheduleApprovalToggles
                  schedule={schedule}
                  storeId={store.id}
                  campaignId={campaignId}
                  canEdit={cardCanEdit}
                  hasDateAndTime={!!(schedule?.reschedule_date && schedule?.reschedule_time)}
                  onMultiUpdate={(fields) => handleMultiFieldChange(store.id, fields)}
                />
              ) : (
                <ApprovalToggles
                  schedule={schedule}
                  storeId={store.id}
                  campaignId={campaignId}
                  canEdit={cardCanEdit}
                  hasDateAndTime={!!(schedule?.scheduled_date && schedule?.scheduled_time)}
                  onMultiUpdate={(fields) => handleMultiFieldChange(store.id, fields)}
                />
              )}

              {/* Occurrence Status Indicator */}
              {(() => {
                const occStatus = storeOccurrenceStatus[store.id];
                const hasOpenOccurrence = occStatus?.hasOccurrence && !occStatus.allResolved;
                const isOk = !hasOpenOccurrence;
                
                const currentPath = window.location.pathname;
                const occUrl = `${currentPath}?section=occurrences&filterStore=${encodeURIComponent(store.name)}`;

                if (isOk) return null;
                return (
                  <div className="mx-4 mb-3 mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <a href={occUrl} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 cursor-pointer">
                      Ocorrência registrada ({occStatus!.count})
                    </a>
                  </div>
                );
              })()}

              {/* Reschedule Section - toggle only, no duplicate fields */}
              <RescheduleSection
                schedule={schedule}
                storeId={store.id}
                campaignId={campaignId}
                canEdit={cardCanEdit}
                teams={teams}
                teamMap={teamMap}
                onFieldChange={(field, value) => handleFieldChange(store.id, field, value)}
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

      {/* Per-card History */}
      <ScheduleHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        campaignId={campaignId}
        storeId={historyStoreId}
        storeName={historyStoreName}
      />

      {/* Per-card Activity Log (admin/master only) */}
      {isAdminOrMaster && (
        <ActivityLogPanel
          open={logOpen}
          onOpenChange={setLogOpen}
          campaignId={campaignId}
          storeId={logStoreId}
          storeName={logStoreName}
          module="scheduling"
        />
      )}
    </div>
  );
};

// ─── Sub-component: Approval Toggles ────────────────────

interface ApprovalTogglesProps {
  schedule: Schedule | undefined;
  storeId: string;
  campaignId: string;
  canEdit: boolean;
  hasDateAndTime: boolean;
  onMultiUpdate: (fields: Record<string, any>) => void;
}

function ApprovalToggles({ schedule, storeId, campaignId, canEdit, hasDateAndTime, onMultiUpdate }: ApprovalTogglesProps) {
  const { user } = useAuth();
  const dbStoreStatus = (schedule?.store_approval_status ?? "under_review") as ApprovalStatusValue;
  const dbTeamStatus = (schedule?.team_approval_status ?? "under_review") as ApprovalStatusValue;

  const [optimisticStoreStatus, setOptimisticStoreStatus] = useState<ApprovalStatusValue | null>(null);
  const [optimisticTeamStatus, setOptimisticTeamStatus] = useState<ApprovalStatusValue | null>(null);

  const storeStatus = optimisticStoreStatus ?? dbStoreStatus;
  const teamStatus = optimisticTeamStatus ?? dbTeamStatus;

  // Reset optimistic state when DB catches up
  useEffect(() => {
    if (optimisticStoreStatus && dbStoreStatus === optimisticStoreStatus) setOptimisticStoreStatus(null);
  }, [dbStoreStatus, optimisticStoreStatus]);
  useEffect(() => {
    if (optimisticTeamStatus && dbTeamStatus === optimisticTeamStatus) setOptimisticTeamStatus(null);
  }, [dbTeamStatus, optimisticTeamStatus]);

  const hasPendency = storeStatus !== "approved" || teamStatus !== "approved";
  const responsibility = schedule?.responsibility || "team";

  const [localSuggestedDate, setLocalSuggestedDate] = useState(schedule?.suggested_date || "");
  const [localSuggestedTime, setLocalSuggestedTime] = useState(schedule?.suggested_time || "");
  const [localSuggestedDate2, setLocalSuggestedDate2] = useState((schedule as any)?.suggested_date_2 || "");
  const [localSuggestedTime2, setLocalSuggestedTime2] = useState((schedule as any)?.suggested_time_2 || "");

  // Sync local state when schedule changes
  useEffect(() => {
    setLocalSuggestedDate(schedule?.suggested_date || "");
    setLocalSuggestedTime(schedule?.suggested_time || "");
    setLocalSuggestedDate2((schedule as any)?.suggested_date_2 || "");
    setLocalSuggestedTime2((schedule as any)?.suggested_time_2 || "");
  }, [schedule?.suggested_date, schedule?.suggested_time, (schedule as any)?.suggested_date_2, (schedule as any)?.suggested_time_2]);

  const handleSetStatus = (field: "store_approval_status" | "team_approval_status", newVal: ApprovalStatusValue) => {
    if (!canEdit) return;
    const now = new Date().toISOString();
    const atField = field === "store_approval_status" ? "store_approved_at" : "team_approved_at";
    const boolField = field === "store_approval_status" ? "store_approved" : "team_approved";
    const otherStatus = field === "store_approval_status"
      ? (schedule?.team_approval_status ?? "under_review")
      : (schedule?.store_approval_status ?? "under_review");

    const updates: Record<string, any> = {
      [field]: newVal,
      [boolField]: newVal === "approved",
      [atField]: now,
    };

    if (newVal === "approved" && otherStatus === "approved") {
      updates.responsibility = null;
      updates.responsibility_at = null;
    }

    // Clear suggested fields when changing away from rejected
    if (field === "store_approval_status" && newVal !== "rejected") {
      updates.suggested_date = null;
      updates.suggested_time = null;
    }

    // When team disapproves, set responsibility to client
    if (field === "team_approval_status" && newVal === "rejected") {
      updates.responsibility = "client";
      updates.responsibility_at = now;
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

  const handleSaveSuggested = (field: "suggested_date" | "suggested_time", value: string) => {
    const updates: Record<string, any> = { [field]: value || null };
    if (value) {
      updates.team_approval_status = "pending";
    }
    onMultiUpdate(updates);
  };

  const handleAcceptSuggestion = async (set: 1 | 2) => {
    if (!canEdit) return;
    const oldDate = schedule?.scheduled_date || "";
    const oldTime = schedule?.scheduled_time || "";
    const newDate = set === 1
      ? (localSuggestedDate || schedule?.suggested_date)
      : (localSuggestedDate2 || (schedule as any)?.suggested_date_2);
    const newTime = set === 1
      ? (localSuggestedTime || schedule?.suggested_time)
      : (localSuggestedTime2 || (schedule as any)?.suggested_time_2);
    if (!newDate && !newTime) return;

    const now = new Date().toISOString();

    // Save history BEFORE mutating state
    if (user) {
      let dataPart = "Não definida";
      if (oldDate) {
        try {
          dataPart = format(new Date(oldDate + "T12:00:00"), "dd/MM/yyyy");
        } catch { dataPart = oldDate; }
      }
      const timePart = oldTime || "Não definido";
      const historyMsg = `📋 Sugestão aceita (Opção ${set}). Data anterior: ${dataPart} | Horário anterior: ${timePart}`;
      const { error: histErr } = await supabase.from("schedule_history").insert({
        campaign_id: campaignId,
        store_id: storeId,
        user_id: user.id,
        content: historyMsg,
      });
      if (histErr) console.error("Erro ao salvar histórico:", histErr);
    }

    // Optimistic UI: instantly update status and clear suggestions
    setOptimisticStoreStatus("approved");
    setOptimisticTeamStatus("approved");
    setLocalSuggestedDate("");
    setLocalSuggestedTime("");
    setLocalSuggestedDate2("");
    setLocalSuggestedTime2("");

    onMultiUpdate({
      ...(newDate ? { scheduled_date: newDate } : {}),
      ...(newTime ? { scheduled_time: newTime } : {}),
      suggested_date: null,
      suggested_time: null,
      suggested_date_2: null,
      suggested_time_2: null,
      store_approval_status: "approved",
      store_approved: true,
      store_approved_at: now,
      team_approval_status: "approved",
      team_approved: true,
      team_approved_at: now,
    });

    toast.success("Sugestão aceita! Lojista e Equipe aprovados.");
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
  const showSuggestion = storeStatus === "rejected";
  const hasSuggestionValues = !!(localSuggestedDate || localSuggestedTime);
  const hasSuggestionValues2 = !!(localSuggestedDate2 || localSuggestedTime2);

  return (
    <div className={cn("border-t border-border bg-muted/30 px-4 py-3 space-y-2", !hasDateAndTime && "opacity-50")}>
      <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide mb-1">
        Status de aprovação da instalação
        {!hasDateAndTime && <span className="ml-2 text-muted-foreground font-normal normal-case">(preencha data e horário)</span>}
      </p>
      <ThreeStateToggle
        label="Lojista"
        value={storeStatus}
        onChange={(val) => handleSetStatus("store_approval_status", val)}
        timestamp={storeStatus === "approved" ? formatTimestamp(schedule?.store_approved_at ?? null) : null}
        disabled={sectionDisabled}
      />

      {/* Suggested date/time when LOJISTA is rejected */}
      {showSuggestion && (
        <div className="ml-[78px] space-y-3 p-3 rounded-lg border border-red-500/30 bg-red-500/5">
          <p className="text-[10px] font-semibold text-destructive uppercase tracking-wide">Sugestões do Lojista</p>
          
          {/* Sugestão 1 */}
          <div className="space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground">Opção 1</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Data Sugerida</label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={localSuggestedDate}
                  onChange={(e) => {
                    setLocalSuggestedDate(e.target.value);
                    handleSaveSuggested("suggested_date", e.target.value);
                  }}
                  className="w-full h-7 text-xs rounded-md border border-border bg-card text-foreground px-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Horário Sugerido</label>
                <input
                  type="time"
                  disabled={!canEdit}
                  value={localSuggestedTime}
                  onChange={(e) => {
                    setLocalSuggestedTime(e.target.value);
                    handleSaveSuggested("suggested_time", e.target.value);
                  }}
                  className="w-full h-7 text-xs rounded-md border border-border bg-card text-foreground px-2"
                />
              </div>
            </div>
            {hasSuggestionValues && canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 h-7"
                onClick={() => handleAcceptSuggestion(1)}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Aceitar opção 1
              </Button>
            )}
          </div>

          <div className="border-t border-border" />

          {/* Sugestão 2 */}
          <div className="space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground">Opção 2</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Data Sugerida 2</label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={localSuggestedDate2}
                  onChange={(e) => {
                    setLocalSuggestedDate2(e.target.value);
                    handleSaveSuggested("suggested_date_2" as any, e.target.value);
                  }}
                  className="w-full h-7 text-xs rounded-md border border-border bg-card text-foreground px-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Horário Sugerido 2</label>
                <input
                  type="time"
                  disabled={!canEdit}
                  value={localSuggestedTime2}
                  onChange={(e) => {
                    setLocalSuggestedTime2(e.target.value);
                    handleSaveSuggested("suggested_time_2" as any, e.target.value);
                  }}
                  className="w-full h-7 text-xs rounded-md border border-border bg-card text-foreground px-2"
                />
              </div>
            </div>
            {hasSuggestionValues2 && canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 h-7"
                onClick={() => handleAcceptSuggestion(2)}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Aceitar opção 2
              </Button>
            )}
          </div>
        </div>
      )}

      <ThreeStateToggle
        label="Equipe"
        value={teamStatus}
        onChange={(val) => handleSetStatus("team_approval_status", val)}
        timestamp={teamStatus === "approved" ? formatTimestamp(schedule?.team_approved_at ?? null) : null}
        disabled={sectionDisabled}
      />

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

// ─── Sub-component: Reschedule Section ──────────────────

interface RescheduleSectionProps {
  schedule: Schedule | undefined;
  storeId: string;
  campaignId: string;
  canEdit: boolean;
  teams: InstallationTeam[];
  teamMap: Record<string, InstallationTeam>;
  onFieldChange: (field: string, value: any) => void;
  onMultiUpdate: (fields: Record<string, any>) => void;
}

function RescheduleSection({ schedule, storeId, campaignId, canEdit, teams, teamMap, onFieldChange, onMultiUpdate }: RescheduleSectionProps) {
  const { user } = useAuth();
  const isEnabled = !!schedule?.reschedule_enabled;

  const handleToggleReschedule = (enabled: boolean) => {
    if (!canEdit) return;
    const updates: Record<string, any> = { reschedule_enabled: enabled };
    if (!enabled) {
      // Clear all reschedule fields
      updates.reschedule_date = null;
      updates.reschedule_time = null;
      updates.reschedule_os = null;
      updates.reschedule_preference = "not_informed";
      updates.reschedule_store_approval_status = "under_review";
      updates.reschedule_store_approved_at = null;
      updates.reschedule_team_approval_status = "under_review";
      updates.reschedule_team_approved_at = null;
      updates.reschedule_responsibility = null;
      updates.reschedule_responsibility_at = null;
      updates.reschedule_suggested_date = null;
      updates.reschedule_suggested_time = null;
      updates.reschedule_suggested_date_2 = null;
      updates.reschedule_suggested_time_2 = null;
    }
    onMultiUpdate(updates);
  };

  const rescheduleDate = schedule?.reschedule_date ? new Date(schedule.reschedule_date + "T12:00:00") : undefined;
  const hasRescheduleDateTime = !!(schedule?.reschedule_date && schedule?.reschedule_time);

  return (
    <div className="border-t-2 border-orange-400/50">
      {/* Toggle */}
      <div className="px-4 py-2 flex items-center justify-between bg-orange-500/5">
        <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
          🔄 Remarcação da Instalação
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => handleToggleReschedule(!isEnabled)}
            className={cn(
              "relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
              isEnabled ? "bg-orange-500" : "bg-muted",
              !canEdit && "opacity-50 cursor-not-allowed"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition-transform",
                isEnabled ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
          <span className="text-[10px] font-bold text-muted-foreground">{isEnabled ? "SIM" : "NÃO"}</span>
        </div>
      </div>

      {isEnabled && (
        <div className="px-4 py-2 bg-orange-500/5">
          <p className="text-[10px] text-muted-foreground">
            Os campos de Data, Horário, OS e Aprovação acima já refletem os dados da remarcação.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: Reschedule Approval Toggles ─────────

interface RescheduleApprovalTogglesProps {
  schedule: Schedule | undefined;
  storeId: string;
  campaignId: string;
  canEdit: boolean;
  hasDateAndTime: boolean;
  onMultiUpdate: (fields: Record<string, any>) => void;
}

function RescheduleApprovalToggles({ schedule, storeId, campaignId, canEdit, hasDateAndTime, onMultiUpdate }: RescheduleApprovalTogglesProps) {
  const { user } = useAuth();
  const dbStoreStatus = (schedule?.reschedule_store_approval_status ?? "under_review") as ApprovalStatusValue;
  const dbTeamStatus = (schedule?.reschedule_team_approval_status ?? "under_review") as ApprovalStatusValue;

  const [optimisticStoreStatus, setOptimisticStoreStatus] = useState<ApprovalStatusValue | null>(null);
  const [optimisticTeamStatus, setOptimisticTeamStatus] = useState<ApprovalStatusValue | null>(null);

  const storeStatus = optimisticStoreStatus ?? dbStoreStatus;
  const teamStatus = optimisticTeamStatus ?? dbTeamStatus;

  useEffect(() => {
    if (optimisticStoreStatus && dbStoreStatus === optimisticStoreStatus) setOptimisticStoreStatus(null);
  }, [dbStoreStatus, optimisticStoreStatus]);
  useEffect(() => {
    if (optimisticTeamStatus && dbTeamStatus === optimisticTeamStatus) setOptimisticTeamStatus(null);
  }, [dbTeamStatus, optimisticTeamStatus]);

  const hasPendency = storeStatus !== "approved" || teamStatus !== "approved";
  const responsibility = schedule?.reschedule_responsibility || "team";

  const [localSuggestedDate, setLocalSuggestedDate] = useState(schedule?.reschedule_suggested_date || "");
  const [localSuggestedTime, setLocalSuggestedTime] = useState(schedule?.reschedule_suggested_time || "");
  const [localSuggestedDate2, setLocalSuggestedDate2] = useState(schedule?.reschedule_suggested_date_2 || "");
  const [localSuggestedTime2, setLocalSuggestedTime2] = useState(schedule?.reschedule_suggested_time_2 || "");

  useEffect(() => {
    setLocalSuggestedDate(schedule?.reschedule_suggested_date || "");
    setLocalSuggestedTime(schedule?.reschedule_suggested_time || "");
    setLocalSuggestedDate2(schedule?.reschedule_suggested_date_2 || "");
    setLocalSuggestedTime2(schedule?.reschedule_suggested_time_2 || "");
  }, [schedule?.reschedule_suggested_date, schedule?.reschedule_suggested_time, schedule?.reschedule_suggested_date_2, schedule?.reschedule_suggested_time_2]);

  const handleSetStatus = (field: "reschedule_store_approval_status" | "reschedule_team_approval_status", newVal: ApprovalStatusValue) => {
    if (!canEdit) return;
    const now = new Date().toISOString();
    const atField = field === "reschedule_store_approval_status" ? "reschedule_store_approved_at" : "reschedule_team_approved_at";

    const updates: Record<string, any> = {
      [field]: newVal,
      [atField]: now,
    };

    if (newVal === "approved") {
      const otherStatus = field === "reschedule_store_approval_status"
        ? (schedule?.reschedule_team_approval_status ?? "under_review")
        : (schedule?.reschedule_store_approval_status ?? "under_review");
      if (otherStatus === "approved") {
        updates.reschedule_responsibility = null;
        updates.reschedule_responsibility_at = null;
      }
    }

    if (field === "reschedule_store_approval_status" && newVal !== "rejected") {
      updates.reschedule_suggested_date = null;
      updates.reschedule_suggested_time = null;
    }

    if (field === "reschedule_team_approval_status" && newVal === "rejected") {
      updates.reschedule_responsibility = "client";
      updates.reschedule_responsibility_at = now;
    }

    onMultiUpdate(updates);
  };

  const handleSetResponsibility = (value: string) => {
    if (!canEdit) return;
    onMultiUpdate({
      reschedule_responsibility: value,
      reschedule_responsibility_at: new Date().toISOString(),
    });
  };

  const handleSaveSuggested = (field: string, value: string) => {
    const updates: Record<string, any> = { [field]: value || null };
    if (value) {
      updates.reschedule_team_approval_status = "pending";
    }
    onMultiUpdate(updates);
  };

  const handleAcceptSuggestion = async (set: 1 | 2) => {
    if (!canEdit) return;
    const newDate = set === 1 ? localSuggestedDate : localSuggestedDate2;
    const newTime = set === 1 ? localSuggestedTime : localSuggestedTime2;
    if (!newDate && !newTime) return;

    const now = new Date().toISOString();

    setOptimisticStoreStatus("approved");
    setOptimisticTeamStatus("approved");
    setLocalSuggestedDate("");
    setLocalSuggestedTime("");
    setLocalSuggestedDate2("");
    setLocalSuggestedTime2("");

    onMultiUpdate({
      ...(newDate ? { reschedule_date: newDate } : {}),
      ...(newTime ? { reschedule_time: newTime } : {}),
      reschedule_suggested_date: null,
      reschedule_suggested_time: null,
      reschedule_suggested_date_2: null,
      reschedule_suggested_time_2: null,
      reschedule_store_approval_status: "approved",
      reschedule_store_approved_at: now,
      reschedule_team_approval_status: "approved",
      reschedule_team_approved_at: now,
    });

    toast.success("Sugestão aceita! Lojista e Equipe aprovados (Remarcação).");
  };

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return null;
    try { return format(new Date(ts), "dd/MM/yy HH:mm", { locale: ptBR }); } catch { return null; }
  };

  const sectionDisabled = !canEdit || !hasDateAndTime;
  const showSuggestion = storeStatus === "rejected";
  const hasSuggestionValues = !!(localSuggestedDate || localSuggestedTime);
  const hasSuggestionValues2 = !!(localSuggestedDate2 || localSuggestedTime2);

  return (
    <div className={cn("border-t border-orange-400/30 pt-2 space-y-2", !hasDateAndTime && "opacity-50")}>
      <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide mb-1">
        Status de aprovação (Remarcação)
        {!hasDateAndTime && <span className="ml-2 text-muted-foreground font-normal normal-case">(preencha data e horário)</span>}
      </p>
      <ThreeStateToggle
        label="Lojista"
        value={storeStatus}
        onChange={(val) => handleSetStatus("reschedule_store_approval_status", val)}
        timestamp={storeStatus === "approved" ? formatTimestamp(schedule?.reschedule_store_approved_at ?? null) : null}
        disabled={sectionDisabled}
      />

      {showSuggestion && (
        <div className="ml-[78px] space-y-3 p-3 rounded-lg border border-red-500/30 bg-red-500/5">
          <p className="text-[10px] font-semibold text-destructive uppercase tracking-wide">Sugestões do Lojista (Remarcação)</p>
          <div className="space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground">Opção 1</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Data Sugerida</label>
                <input type="date" disabled={!canEdit} value={localSuggestedDate}
                  onChange={(e) => { setLocalSuggestedDate(e.target.value); handleSaveSuggested("reschedule_suggested_date", e.target.value); }}
                  className="w-full h-7 text-xs rounded-md border border-border bg-card text-foreground px-2" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Horário Sugerido</label>
                <input type="time" disabled={!canEdit} value={localSuggestedTime}
                  onChange={(e) => { setLocalSuggestedTime(e.target.value); handleSaveSuggested("reschedule_suggested_time", e.target.value); }}
                  className="w-full h-7 text-xs rounded-md border border-border bg-card text-foreground px-2" />
              </div>
            </div>
            {hasSuggestionValues && canEdit && (
              <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 h-7" onClick={() => handleAcceptSuggestion(1)}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Aceitar opção 1
              </Button>
            )}
          </div>
          <div className="border-t border-border" />
          <div className="space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground">Opção 2</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Data Sugerida 2</label>
                <input type="date" disabled={!canEdit} value={localSuggestedDate2}
                  onChange={(e) => { setLocalSuggestedDate2(e.target.value); handleSaveSuggested("reschedule_suggested_date_2", e.target.value); }}
                  className="w-full h-7 text-xs rounded-md border border-border bg-card text-foreground px-2" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Horário Sugerido 2</label>
                <input type="time" disabled={!canEdit} value={localSuggestedTime2}
                  onChange={(e) => { setLocalSuggestedTime2(e.target.value); handleSaveSuggested("reschedule_suggested_time_2", e.target.value); }}
                  className="w-full h-7 text-xs rounded-md border border-border bg-card text-foreground px-2" />
              </div>
            </div>
            {hasSuggestionValues2 && canEdit && (
              <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 h-7" onClick={() => handleAcceptSuggestion(2)}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Aceitar opção 2
              </Button>
            )}
          </div>
        </div>
      )}

      <ThreeStateToggle
        label="Equipe"
        value={teamStatus}
        onChange={(val) => handleSetStatus("reschedule_team_approval_status", val)}
        timestamp={teamStatus === "approved" ? formatTimestamp(schedule?.reschedule_team_approved_at ?? null) : null}
        disabled={sectionDisabled}
      />

      {hasPendency && (
        <ToggleSwitch
          label="Responsável"
          leftLabel="Cliente"
          rightLabel="Equipe"
          isLeft={responsibility !== "team"}
          onClickLeft={() => handleSetResponsibility("client")}
          onClickRight={() => handleSetResponsibility("team")}
          timestamp={formatTimestamp(schedule?.reschedule_responsibility_at ?? null)}
          disabled={sectionDisabled}
        />
      )}
    </div>
  );
}


interface ThreeStateToggleProps {
  label: string;
  value: ApprovalStatusValue;
  onChange: (val: ApprovalStatusValue) => void;
  timestamp: string | null;
  disabled?: boolean;
}

const STATUS_CONFIG: Record<ApprovalStatusValue, { label: string; bg: string; border: string; activeBg: string }> = {
  approved: { label: "Aprovado", bg: "bg-emerald-500/15", border: "border-emerald-500/40", activeBg: "bg-emerald-500" },
  under_review: { label: "Em análise", bg: "bg-amber-500/15", border: "border-amber-500/40", activeBg: "bg-amber-500" },
  rejected: { label: "Desaprovado", bg: "bg-red-500/15", border: "border-red-500/40", activeBg: "bg-red-500" },
};

function ThreeStateToggle({ label, value, onChange, timestamp, disabled }: ThreeStateToggleProps) {
  const options: ApprovalStatusValue[] = ["approved", "under_review", "rejected"];
  // Fallback for legacy DB values like "pending"
  const safeValue: ApprovalStatusValue = STATUS_CONFIG[value] ? value : "under_review";
  const activeIdx = options.indexOf(safeValue);
  const cfg = STATUS_CONFIG[safeValue];

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold text-muted-foreground w-[70px] shrink-0 uppercase tracking-wide">{label}</span>
      <div
        className={cn(
          "relative flex items-center rounded-full h-7 w-full max-w-[280px] border transition-colors select-none overflow-hidden",
          disabled && "opacity-60 cursor-not-allowed",
          cfg.bg, cfg.border
        )}
      >
        {/* Sliding indicator */}
        <span
          className={cn(
            "absolute top-0.5 bottom-0.5 rounded-full transition-all duration-300 shadow-sm pointer-events-none",
            cfg.activeBg
          )}
          style={{
            width: `calc(${100 / 3}% - 4px)`,
            left: activeIdx === 0 ? "2px" : activeIdx === 1 ? `calc(${100 / 3}% + 0px)` : `calc(${200 / 3}% - 2px)`,
          }}
        />
        {options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={cn(
              "relative z-10 flex-1 text-center text-[9px] font-bold transition-colors cursor-pointer h-full",
              i === activeIdx ? "text-primary-foreground" : "text-foreground"
            )}
          >
            {STATUS_CONFIG[opt].label}
          </button>
        ))}
      </div>
      {timestamp && (
        <span className="text-[9px] text-muted-foreground whitespace-nowrap">{timestamp}</span>
      )}
    </div>
  );
}

// ─── Sub-component: Toggle Switch (binary, used for Responsibility) ──

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
  messageTemplate?: string;
}

function StoreContactsDisplay({ store, contacts, roleMap, schedule, agencyName, clientName, campaignName, messageTemplate }: StoreContactsDisplayProps) {
  const storeName = store.nickname || store.name;
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
        messageTemplate={messageTemplate}
        storeName={storeName}
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
                  messageTemplate={messageTemplate}
                  storeName={storeName}
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
  messageTemplate?: string;
  storeName?: string;
}

function ContactRow({ contact, roleMap, schedule, agencyName, clientName, campaignName, showRole, messageTemplate, storeName }: ContactRowProps) {
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
              href={buildWhatsAppUrl(contact.phone, contact.name, agencyName, clientName, campaignName, schedule?.scheduled_date ?? null, schedule?.scheduled_time ?? null, messageTemplate, storeName)}
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
