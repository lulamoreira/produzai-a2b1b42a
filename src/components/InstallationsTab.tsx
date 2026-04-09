import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Schedule } from "@/types/schedule";
import { useCampaignSchedules } from "@/hooks/useCampaignSchedules";
import { useOccurrenceStatusSync } from "@/hooks/useOccurrenceStatusSync";
import { buildAddress, buildContactsByStoreMap } from "@/lib/storeHelpers";
import { type ClientStore } from "@/hooks/useMultiClientData";
import { getStateColor } from "@/lib/stateColors";
import { useStoreContactsByClient, useStoreContactRoles, type StoreContact } from "@/hooks/useStoreContacts";
import { useInstallationPhotos, useAddInstallationPhoto, type InstallationPhoto } from "@/hooks/useInstallationPhotos";
import { useOrphanPhotoCleanup } from "@/hooks/useOrphanPhotoCleanup";
import { useAuth } from "@/hooks/useAuth";
import { compressImage } from "@/lib/compressImage";
import DebouncedInput from "@/components/DebouncedInput";
import TeamCodesPanel from "@/components/TeamCodesPanel";
import { useUserRole } from "@/hooks/useUserRole";
import { useClientPermission } from "@/hooks/useClientPermission";
import { useLogActivity } from "@/hooks/useActivityLogs";
import ActivityLogPanel from "@/components/ActivityLogPanel";
import PhotoCheckinDialog from "@/components/PhotoCheckinDialog";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search, CalendarIcon, Clock, FileText, Sun, Moon, HelpCircle,
  Users, MessageCircle, Phone, Mail, AlertTriangle, Wrench,
  Camera, Image, Upload, Plus, Key, CheckCircle, Download, ClipboardList, Lock, LockOpen,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { downloadPhotosAsZip } from "@/lib/downloadPhotosZip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { downloadWorkbook } from "@/lib/downloadWorkbook";
import { buildExportFileName } from "@/lib/exportFileName";
import {
  useInstallationTeams,
  useAllTeamMembers,
  useAllTeamVehicles,
  isTeamIncomplete,
  TeamCardContent,
  type InstallationTeam,
  type TeamMember,
  type TeamVehicle,
} from "@/components/InstallationTeamDialog";

interface InstallationsTabProps {
  campaignId: string;
  campaignName: string;
  stores: ClientStore[];
  canEdit: boolean;
  clientId: string;
  agencyName?: string;
  clientName?: string;
}

const CATEGORY_OPTIONS = [
  { value: "before", label: "Antes" },
  { value: "during", label: "Durante" },
  { value: "after", label: "Depois" },
];

const InstallationsTab = ({ campaignId, campaignName, stores, canEdit, clientId, agencyName = "", clientName = "" }: InstallationsTabProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdminOrMaster } = useUserRole();
  const { hasPermission: canManageTeamCodes } = useClientPermission(clientId, "can_manage_team_codes");
  const { hasPermission: canLockCards } = useClientPermission(clientId, "can_lock_cards");
  const showTeamCodesPanel = isAdminOrMaster || canManageTeamCodes;
  const logActivity = useLogActivity();

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "completed" | "pending" | "no_photo">("");
  const [filterDate, setFilterDate] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterLocked, setFilterLocked] = useState("");
  const [filterReschedule, setFilterReschedule] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [summaryFilter, setSummaryFilter] = useState<"" | "total" | "completed" | "pending" | "withTeam" | "withPhotos" | "locked" | "withOccurrence">("");

  // UI state
  const [showCodes, setShowCodes] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logStoreId, setLogStoreId] = useState("");
  const [logStoreName, setLogStoreName] = useState("");
  const [lockLoading, setLockLoading] = useState<Record<string, boolean>>({});
  const [bulkLockLoading, setBulkLockLoading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<Record<string, string>>({});
  const [checkinStore, setCheckinStore] = useState<ClientStore | null>(null);

  // Shared hooks
  const { schedules, scheduleMap } = useCampaignSchedules(campaignId);
  const { storeOccurrenceStatus } = useOccurrenceStatusSync(campaignId);

  // Only show stores that have a schedule with date AND time (original or reschedule)
  const scheduledStores = useMemo(() => stores.filter((s) => {
    const sch = scheduleMap[s.id];
    if (!sch) return false;
    if (sch.reschedule_enabled) {
      return !!sch.reschedule_date && !!sch.reschedule_time;
    }
    return !!sch.scheduled_date && !!sch.scheduled_time;
  }), [stores, scheduleMap]);

  const { data: teams = [] } = useInstallationTeams(campaignId);
  const { data: allMembersMap = {} } = useAllTeamMembers(campaignId);
  const { data: allVehiclesMap = {} } = useAllTeamVehicles(campaignId);
  const { data: photos = [] } = useInstallationPhotos(campaignId);
  const addPhoto = useAddInstallationPhoto();
  const { handleMediaError } = useOrphanPhotoCleanup();

  const { data: allContacts = [] } = useStoreContactsByClient(clientId);
  const { data: contactRoles = [] } = useStoreContactRoles(clientId);

  const teamMap = useMemo(() => {
    const map: Record<string, InstallationTeam> = {};
    teams.forEach((t) => { map[t.id] = t; });
    return map;
  }, [teams]);

  const contactsByStore = useMemo(() => buildContactsByStoreMap(allContacts), [allContacts]);

  const photosByStore = useMemo(() => {
    const map: Record<string, InstallationPhoto[]> = {};
    photos.forEach((p) => { (map[p.store_id] = map[p.store_id] || []).push(p); });
    return map;
  }, [photos]);

  // Filter options
  const states = useMemo(() => [...new Set(scheduledStores.map((s) => s.state?.trim()).filter(Boolean))].sort() as string[], [scheduledStores]);
  const cities = useMemo(() => {
    const filtered = filterState ? scheduledStores.filter((s) => s.state?.trim() === filterState) : scheduledStores;
    return [...new Set(filtered.map((s) => s.city).filter(Boolean))].sort() as string[];
  }, [scheduledStores, filterState]);
  const storeModels = useMemo(() => {
    const set = new Set(scheduledStores.map((s) => s.store_model).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [scheduledStores]);

  const filteredStores = useMemo(() => {
    return scheduledStores.filter((s) => {
      const matchesSearch = !searchTerm ||
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.store_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.city || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.state || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesState = !filterState || s.state?.trim() === filterState;
      const matchesCity = !filterCity || s.city === filterCity;
      const schedule = scheduleMap[s.id];

      // Status filter
      let matchesStatus = true;
      if (filterStatus === "completed") {
        matchesStatus = !!schedule?.completed_at;
      } else if (filterStatus === "pending") {
        if (!schedule || schedule.completed_at) {
          matchesStatus = false;
        } else {
          const today = new Date();
          const todayStr = today.toISOString().slice(0, 10);
          const effDate = schedule.reschedule_enabled ? schedule.reschedule_date : schedule.scheduled_date;
          const effTime = schedule.reschedule_enabled ? schedule.reschedule_time : schedule.scheduled_time;
          const isToday = effDate === todayStr;
          if (!isToday || !effTime) {
            matchesStatus = false;
          } else {
            const [h, m] = effTime.split(":").map(Number);
            const scheduledMs = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m).getTime();
            const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
            matchesStatus = scheduledMs <= threeHoursAgo;
          }
        }
      } else if (filterStatus === "no_photo") {
        matchesStatus = (photosByStore[s.id] || []).length === 0;
      }

      // Date filter
      let matchesDate = true;
      if (filterDate) {
        const effDate = schedule?.reschedule_enabled ? schedule?.reschedule_date : schedule?.scheduled_date;
        matchesDate = effDate === filterDate;
      }

      // Period filter
      let matchesPeriod = true;
      if (filterPeriod) {
        const effTime = schedule?.reschedule_enabled ? schedule?.reschedule_time : schedule?.scheduled_time;
        if (!effTime) {
          matchesPeriod = false;
        } else {
          const hour = parseInt(effTime.split(":")[0], 10);
          if (filterPeriod === "morning") matchesPeriod = hour >= 1 && hour <= 11;
          else if (filterPeriod === "afternoon") matchesPeriod = hour >= 12 && hour <= 17;
          else if (filterPeriod === "night") matchesPeriod = hour >= 18 && hour <= 23;
        }
      }

      // Team filter
      let matchesTeam = true;
      if (filterTeam) {
        if (filterTeam === "no_team") {
          matchesTeam = !schedule?.team_id;
        } else {
          matchesTeam = schedule?.team_id === filterTeam;
        }
      }

      // Locked filter
      let matchesLocked = true;
      if (filterLocked === "locked") matchesLocked = !!schedule?.locked;
      else if (filterLocked === "unlocked") matchesLocked = !schedule?.locked;

      // Reschedule filter
      let matchesReschedule = true;
      if (filterReschedule === "yes") matchesReschedule = !!schedule?.reschedule_enabled;
      else if (filterReschedule === "no") matchesReschedule = !schedule?.reschedule_enabled;

      // Model filter
      let matchesModel = true;
      if (filterModel) matchesModel = s.store_model === filterModel;

      return matchesSearch && matchesState && matchesCity && matchesStatus && matchesDate && matchesPeriod && matchesTeam && matchesLocked && matchesReschedule && matchesModel;
    }).sort((a, b) => {
      const stateComp = (a.state || "").localeCompare(b.state || "");
      if (stateComp !== 0) return stateComp;
      return a.name.localeCompare(b.name);
    });
  }, [scheduledStores, searchTerm, filterState, filterCity, filterStatus, filterDate, filterPeriod, filterTeam, filterLocked, filterReschedule, filterModel, scheduleMap, photosByStore]);

  // Apply summary filter on top of filteredStores
  const displayedStores = useMemo(() => {
    if (!summaryFilter || summaryFilter === "total") return filteredStores;
    return filteredStores.filter((s) => {
      const sch = scheduleMap[s.id];
      const occ = storeOccurrenceStatus[s.id];
      switch (summaryFilter) {
        case "completed": return !!sch?.completed_at;
        case "pending": return !sch?.completed_at;
        case "withTeam": return !!sch?.team_id;
        case "withPhotos": return (photosByStore[s.id] || []).length > 0;
        case "locked": return !!sch?.locked;
        case "withOccurrence": return occ?.hasOccurrence && !occ.allResolved;
        default: return true;
      }
    });
  }, [filteredStores, summaryFilter, scheduleMap, photosByStore, storeOccurrenceStatus]);

  const handleUploadPhoto = async (storeId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const category = uploadCategory[storeId] || "before";

    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImage(file, 1200, 0.7);
        const fileName = `${campaignId}/${storeId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from("installation-photos")
          .upload(fileName, compressed, { contentType: "image/jpeg" });
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage.from("installation-photos").getPublicUrl(fileName);

        await addPhoto.mutateAsync({
          campaign_id: campaignId,
          store_id: storeId,
          photo_url: urlData.publicUrl,
          category,
          uploaded_by: user?.id,
          upload_method: "upload",
        });
      } catch (err) {
        console.error("Upload error:", err);
        toast.error("Erro ao enviar foto");
      }
    }
    logActivity.mutate({
      campaign_id: campaignId,
      store_id: storeId,
      module: "installations",
      action: `Enviou ${files.length} foto(s)`,
      details: `Categoria: ${category}`,
    });
    toast.success(`${files.length} foto(s) enviada(s)!`);
  };

  const handleExport = () => {
    const rows = displayedStores.map((store) => {
      const schedule = scheduleMap[store.id];
      const team = schedule?.team_id ? teamMap[schedule.team_id] : null;
      const storePhotos = photosByStore[store.id] || [];
      const isReschedule = !!schedule?.reschedule_enabled;
      const effDate = isReschedule ? schedule?.reschedule_date : schedule?.scheduled_date;
      const effTime = isReschedule ? schedule?.reschedule_time : schedule?.scheduled_time;
      const effOs = isReschedule ? schedule?.reschedule_os : schedule?.installation_os;
      return {
        "Código": store.store_code || "",
        "Loja": store.name,
        "Estado": store.state || "",
        "Cidade": store.city || "",
        "Endereço": buildAddress(store),
        "Contato": store.manager_name || "",
        "Telefone": store.phone || "",
        "Data": effDate ? format(new Date(effDate + "T12:00:00"), "dd/MM/yyyy") : "",
        "Horário": effTime || "",
        "OS": effOs || "",
        "Equipe": team?.name || "",
        "Remarcação": isReschedule ? "Sim" : "Não",
        "Concluída": schedule?.completed_at ? format(new Date(schedule.completed_at), "dd/MM/yyyy HH:mm") : "Não",
        "Fotos": storePhotos.length,
        "Bloqueado": schedule?.locked ? "Sim" : "Não",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Instalações");
    downloadWorkbook(wb, buildExportFileName(`Instalacoes_${campaignName}`, { agencyName, clientName }));
    toast.success("Planilha exportada!");
  };

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    const total = filteredStores.length;
    const completed = filteredStores.filter(s => scheduleMap[s.id]?.completed_at).length;
    const pending = total - completed;
    const withTeam = filteredStores.filter(s => scheduleMap[s.id]?.team_id).length;
    const withPhotos = filteredStores.filter(s => (photosByStore[s.id] || []).length > 0).length;
    const locked = filteredStores.filter(s => scheduleMap[s.id]?.locked).length;
    const withOccurrence = filteredStores.filter(s => {
      const occ = storeOccurrenceStatus[s.id];
      return occ?.hasOccurrence && !occ.allResolved;
    }).length;
    return { total, completed, pending, withTeam, withPhotos, locked, withOccurrence };
  }, [filteredStores, scheduleMap, photosByStore, storeOccurrenceStatus]);

  return (
    <div className="space-y-4">
      {/* Team Codes Panel (admin/master or users with permission) */}
      {showTeamCodesPanel && (
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setShowCodes(!showCodes)}
          >
            <Key className="w-3.5 h-3.5" />
            {showCodes ? "Ocultar Config Acesso" : "Config Acesso Temporário"}
          </Button>
          {showCodes && (
            <div className="aqua-card p-4">
              <TeamCodesPanel campaignId={campaignId} />
            </div>
          )}
        </div>
      )}

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
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground flex-1 min-w-[100px] max-w-[150px]"
          >
            <option value="">Todas cidades</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground flex-1 min-w-[100px] max-w-[150px]"
          >
            <option value="">Todos status</option>
            <option value="completed">✅ Concluídas</option>
            <option value="pending">⏳ Pendentes</option>
            <option value="no_photo">📷 Sem fotos</option>
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
                  const unlocked = displayedStores.filter(s => scheduleMap[s.id] && !scheduleMap[s.id]?.locked);
                  const allLocked = unlocked.length === 0;
                  const newLocked = !allLocked;
                  const ids = displayedStores.map(s => scheduleMap[s.id]?.id).filter(Boolean) as string[];
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
                const unlocked = displayedStores.filter(s => scheduleMap[s.id] && !scheduleMap[s.id]?.locked);
                const allLocked = unlocked.length === 0 && displayedStores.some(s => scheduleMap[s.id]);
                return allLocked
                  ? <><LockOpen className="w-3.5 h-3.5" /> Desbloquear Todos</>
                  : <><Lock className="w-3.5 h-3.5" /> Bloquear Todos</>;
              })()}
            </Button>
          )}
        </div>
      </div>

      {/* Summary Bar - Clickable Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {([
          { key: "total" as const, value: summaryMetrics.total, label: "Total", color: "text-foreground" },
          { key: "completed" as const, value: summaryMetrics.completed, label: "✅ Concluídas", color: "text-emerald-600" },
          { key: "pending" as const, value: summaryMetrics.pending, label: "⏳ Pendentes", color: "text-amber-600" },
          { key: "withTeam" as const, value: summaryMetrics.withTeam, label: "🔧 Com equipe", color: "text-foreground" },
          { key: "withPhotos" as const, value: summaryMetrics.withPhotos, label: "📷 Com fotos", color: "text-foreground" },
          { key: "locked" as const, value: summaryMetrics.locked, label: "🔒 Bloqueadas", color: "text-foreground" },
          { key: "withOccurrence" as const, value: summaryMetrics.withOccurrence, label: "⚠️ Ocorrências", color: "text-destructive" },
        ]).map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setSummaryFilter(prev => prev === m.key ? "" : m.key)}
            className={cn(
              "bg-card border rounded-lg px-3 py-2 text-center transition-all cursor-pointer hover:shadow-md",
              summaryFilter === m.key
                ? "border-primary ring-2 ring-primary/30 shadow-sm"
                : "border-border"
            )}
          >
            <p className={cn("text-lg font-bold", m.color)}>{m.value}</p>
            <p className="text-[10px] text-muted-foreground">{m.label}</p>
          </button>
        ))}
      </div>
      {summaryFilter && summaryFilter !== "total" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Filtrando por: <strong className="text-foreground">{
            { completed: "Concluídas", pending: "Pendentes", withTeam: "Com equipe", withPhotos: "Com fotos", locked: "Bloqueadas", withOccurrence: "Ocorrências" }[summaryFilter]
          }</strong> ({displayedStores.length})</span>
          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs" onClick={() => setSummaryFilter("")}>✕</Button>
        </div>
      )}

      {/* Store Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 sm:gap-4">
        {displayedStores.map((store) => {
          const colors = getStateColor(store.state);
          const schedule = scheduleMap[store.id];
          const assignedTeam = schedule?.team_id ? teamMap[schedule.team_id] : null;
          const teamMembers: TeamMember[] = schedule?.team_id ? (allMembersMap[schedule.team_id] || []) : [];
          const teamVehicles: TeamVehicle[] = schedule?.team_id ? (allVehiclesMap[schedule.team_id] || []) : [];
          const storePhotos = photosByStore[store.id] || [];
          const storeContacts = contactsByStore[store.id] || [];
          const primaryContact = storeContacts[0];
          const isReschedule = !!schedule?.reschedule_enabled;
          const effectiveDate = isReschedule ? schedule?.reschedule_date : schedule?.scheduled_date;
          const effectiveTime = isReschedule ? schedule?.reschedule_time : schedule?.scheduled_time;
          const effectiveOs = isReschedule ? schedule?.reschedule_os : schedule?.installation_os;
          const selectedDate = effectiveDate ? new Date(effectiveDate + "T12:00:00") : undefined;
          const catForStore = uploadCategory[store.id] || "before";
          const isCardLocked = !!schedule?.locked;
          const cardCanEdit = canEdit && (!isCardLocked || isAdminOrMaster);

          const handleToggleLock = async () => {
            if (!schedule) return;
            setLockLoading(prev => ({ ...prev, [store.id]: true }));
            try {
              const newLocked = !isCardLocked;
              const { error } = await supabase.from("campaign_schedules").update({ locked: newLocked } as any).eq("id", schedule.id);
              if (error) throw error;
              if (user) {
                await supabase.from("activity_logs").insert({
                  campaign_id: campaignId,
                  store_id: store.id,
                  user_id: user.id,
                  module: "installations",
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

          // Occurrence status
          const occStatus = storeOccurrenceStatus[store.id];
          const hasOpenOccurrence = occStatus?.hasOccurrence && !occStatus.allResolved;

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
                    {schedule?.completed_at && (
                      <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#22c55e' }} />
                    )}
                    {storePhotos.length > 0 && (
                      <span className="flex items-center gap-1 text-xs font-bold opacity-80">
                        <Image className="w-3.5 h-3.5" /> {storePhotos.length}
                      </span>
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

              {/* Occurrence Status Indicator */}
              {hasOpenOccurrence && (() => {
                const currentPath = window.location.pathname;
                const occUrl = `${currentPath}?section=occurrences&filterStore=${encodeURIComponent(store.name)}`;
                return (
                  <div className="mx-4 mb-1 mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <a href={occUrl} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 cursor-pointer">
                      Ocorrência registrada ({occStatus!.count})
                    </a>
                  </div>
                );
              })()}

              <div className="p-4 space-y-3 bg-card flex-1">
                {/* Address */}
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Endereço:</span> {buildAddress(store)}
                </div>

                {/* Contact */}
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4">
                  <span><span className="font-medium text-foreground">Contato:</span> {primaryContact?.name || store.manager_name || "—"}</span>
                  <span><span className="font-medium text-foreground">Tel:</span> {primaryContact?.phone || store.phone || "—"}</span>
                </div>

                <hr className="border-border" />

                {/* Team */}
                {assignedTeam && (
                  <div className="flex items-center gap-2 text-xs">
                    <Wrench className="w-3 h-3 text-muted-foreground" />
                    <span className="font-medium text-foreground">{assignedTeam.name}</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2">
                          <Users className="w-3 h-3" /> Ver
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 max-h-64 overflow-y-auto p-3" align="start">
                        <TeamCardContent team={assignedTeam} members={teamMembers} vehicles={teamVehicles} />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Schedule info */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {selectedDate && (
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      <span className="font-medium text-foreground">{format(selectedDate, "dd/MM/yyyy")}</span>
                    </span>
                  )}
                  {effectiveTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span className="font-medium text-foreground">{effectiveTime}</span>
                    </span>
                  )}
                  {effectiveOs && (
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      <span className="font-medium text-foreground">OS: {effectiveOs}</span>
                    </span>
                  )}
                  {isReschedule && (
                    <span className="text-[10px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full">REMARCAÇÃO</span>
                  )}
                </div>

                {/* Completion status */}
                {schedule?.completed_at && (
                  <div className="flex items-center gap-2 text-xs bg-success/10 text-success rounded-lg px-3 py-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span className="font-medium">
                      {schedule.completed_by === "agency"
                        ? `Marcada manualmente como concluída pela equipe da Agência, em: ${format(new Date(schedule.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                        : `Concluída em ${format(new Date(schedule.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                      }
                    </span>
                  </div>
                )}

                <hr className="border-border" />

                {/* Photo thumbnails */}
                {storePhotos.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5 flex-wrap">
                      {storePhotos.slice(0, 6).map((photo) => (
                        <img
                          key={photo.id}
                          src={photo.photo_url}
                          alt=""
                          className="w-12 h-12 rounded-md object-cover border border-border cursor-pointer hover:opacity-80"
                          onClick={() => setCheckinStore(store)}
                          onError={() => handleMediaError(photo.id, photo.campaign_id)}
                        />
                      ))}
                      {storePhotos.length > 6 && (
                        <button
                          className="w-12 h-12 rounded-md bg-muted border border-border flex items-center justify-center text-xs font-bold text-muted-foreground hover:bg-muted/80"
                          onClick={() => setCheckinStore(store)}
                        >
                          +{storePhotos.length - 6}
                        </button>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5 w-full"
                      onClick={() => {
                        toast.info("Preparando download...");
                        downloadPhotosAsZip(storePhotos, {
                          module: "Instalacao",
                          campaignName,
                          storeName: store.name,
                        }).then(() => toast.success("Download concluído!")).catch(() => toast.error("Erro ao baixar fotos"));
                      }}
                    >
                      <Download className="w-3 h-3" />
                      Baixar {storePhotos.length} foto(s) (.zip)
                    </Button>
                  </div>
                )}

                {/* Upload section - never locked, any editor can upload */}
                {canEdit && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <select
                      value={catForStore}
                      onChange={(e) => setUploadCategory((prev) => ({ ...prev, [store.id]: e.target.value }))}
                      className="h-8 text-xs rounded-md border border-border bg-card text-foreground px-2"
                    >
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => { handleUploadPhoto(store.id, e.target.files); e.target.value = ""; }}
                      />
                      <Button variant="outline" size="sm" className="text-xs gap-1 pointer-events-none" asChild>
                        <span><Upload className="w-3 h-3" /> Upload</span>
                      </Button>
                    </label>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => { handleUploadPhoto(store.id, e.target.files); e.target.value = ""; }}
                      />
                      <Button variant="outline" size="sm" className="text-xs gap-1 pointer-events-none" asChild>
                        <span><Camera className="w-3 h-3" /> Foto</span>
                      </Button>
                    </label>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-2">
                {/* Mark complete - any editor, not blocked by card lock */}
                {canEdit && schedule && (
                  <Button
                    variant={schedule.completed_at ? "default" : "outline"}
                    size="sm"
                    className={cn("w-full text-xs gap-2", schedule.completed_at && "bg-green-600 hover:bg-green-700")}
                    onClick={async () => {
                      const isCompleted = !!schedule.completed_at;
                      try {
                        const { error } = await supabase
                          .from("campaign_schedules")
                          .update({
                            completed_at: isCompleted ? null : new Date().toISOString(),
                            completed_by: isCompleted ? null : "agency",
                          })
                          .eq("id", schedule.id);
                        if (error) throw error;
                        queryClient.invalidateQueries({ queryKey: ["campaign_schedules", campaignId] });
                        logActivity.mutate({
                          campaign_id: campaignId,
                          store_id: store.id,
                          module: "installations",
                          action: isCompleted ? "remove_completion" : "mark_completed",
                          details: isCompleted ? "Removeu marcação de concluída" : "Marcou instalação como concluída",
                        });
                        toast.success(isCompleted ? "Marcação removida" : "Instalação marcada como concluída!");
                      } catch {
                        toast.error("Erro ao atualizar conclusão");
                      }
                    }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {schedule.completed_at ? "Instalação Concluída ✓" : "Marcar como Concluída"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs gap-2"
                  onClick={() => setCheckinStore(store)}
                >
                  <Camera className="w-4 h-4" />
                  Checkin Fotográfico
                  {storePhotos.length > 0 && (
                    <span className="ml-auto bg-primary/15 text-primary font-bold px-2 py-0.5 rounded-full text-[10px]">
                      {storePhotos.length}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {displayedStores.length === 0 && (
        <p className="text-center text-muted-foreground py-8 text-sm">
          Nenhuma loja com agendamento encontrada
        </p>
      )}

      {/* Activity Log (admin/master only) */}
      {isAdminOrMaster && (
        <ActivityLogPanel
          open={logOpen}
          onOpenChange={setLogOpen}
          campaignId={campaignId}
          storeId={logStoreId}
          storeName={logStoreName}
          module="installations"
        />
      )}
    </div>
  );
};

export default InstallationsTab;
