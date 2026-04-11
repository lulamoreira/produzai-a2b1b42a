import { useState, useMemo } from "react";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/CardSkeleton";
import { useTranslation } from "react-i18next";
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
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp, SlidersHorizontal, Filter, MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadPhotosAsZip, downloadAllCampaignPhotosAsZip } from "@/lib/downloadPhotosZip";
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
  { value: "before", labelKey: "installations.before" },
  { value: "during", labelKey: "installations.during" },
  { value: "after", labelKey: "installations.after" },
];

const InstallationsTab = ({ campaignId, campaignName, stores, canEdit, clientId, agencyName = "", clientName = "" }: InstallationsTabProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdminOrMaster } = useUserRole();
  const { hasPermission: canManageTeamCodes } = useClientPermission(clientId, "can_manage_team_codes");
  const { hasPermission: canLockCards } = useClientPermission(clientId, "can_lock_cards");
  const { hasPermission: canViewPhotoCheckin } = useClientPermission(clientId, "can_view_photo_checkin");
  const showTeamCodesPanel = isAdminOrMaster || canManageTeamCodes;
  const showPhotoCheckin = isAdminOrMaster || canViewPhotoCheckin;
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
  const [summaryFilter, setSummaryFilter] = useState<"" | "total" | "completed" | "pending" | "withTeam" | "withPhotos" | "withReschedule" | "withOccurrence" | "noCheckin">("");
  const [filterCheckin, setFilterCheckin] = useState("");

  // UI state
  const [showCodes, setShowCodes] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logStoreId, setLogStoreId] = useState("");
  const [logStoreName, setLogStoreName] = useState("");
  const [lockLoading, setLockLoading] = useState<Record<string, boolean>>({});
  const [bulkLockLoading, setBulkLockLoading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<Record<string, string>>({});
  const [checkinStore, setCheckinStore] = useState<ClientStore | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const toggleCardExpanded = (storeId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  };

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

      // Check-in filter
      let matchesCheckin = true;
      if (filterCheckin === "checked") matchesCheckin = !!schedule?.photo_checkin;
      else if (filterCheckin === "unchecked") matchesCheckin = !schedule?.photo_checkin;

      return matchesSearch && matchesState && matchesCity && matchesStatus && matchesDate && matchesPeriod && matchesTeam && matchesLocked && matchesReschedule && matchesModel && matchesCheckin;
    }).sort((a, b) => {
      const stateComp = (a.state || "").localeCompare(b.state || "");
      if (stateComp !== 0) return stateComp;
      return a.name.localeCompare(b.name);
    });
  }, [scheduledStores, searchTerm, filterState, filterCity, filterStatus, filterDate, filterPeriod, filterTeam, filterLocked, filterReschedule, filterModel, filterCheckin, scheduleMap, photosByStore]);

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
        case "withReschedule": return !!sch?.reschedule_enabled;
        case "withOccurrence": return occ?.hasOccurrence && !occ.allResolved;
        case "noCheckin": return !sch?.photo_checkin;
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
        toast.error(t("installations.errorUpload"));
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
        [t("common.code")]: store.store_code || "",
        [t("modules.stores")]: store.name,
        [t("stores.state")]: store.state || "",
        [t("stores.city")]: store.city || "",
        [t("common.address")]: buildAddress(store),
        [t("common.contact")]: store.manager_name || "",
        [t("common.phone")]: store.phone || "",
        [t("common.date")]: effDate ? format(new Date(effDate + "T12:00:00"), "dd/MM/yyyy") : "",
        [t("common.time")]: effTime || "",
        "OS": effOs || "",
        [t("scheduling.team")]: team?.name || "",
        [t("scheduling.reschedule")]: isReschedule ? t("common.yes") : t("common.no"),
        [t("installations.completed")]: schedule?.completed_at ? format(new Date(schedule.completed_at), "dd/MM/yyyy HH:mm") : "Não",
        [t("installations.photos")]: storePhotos.length,
        [t("common.blocked")]: schedule?.locked ? t("common.yes") : t("common.no"),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t("installations.title"));
    downloadWorkbook(wb, buildExportFileName(`Instalacoes_${campaignName}`, { agencyName, clientName }));
    toast.success(t("common.spreadsheetExported"));
  };

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    const total = filteredStores.length;
    const completed = filteredStores.filter(s => scheduleMap[s.id]?.completed_at).length;
    const pending = total - completed;
    const withTeam = filteredStores.filter(s => scheduleMap[s.id]?.team_id).length;
    const withPhotos = filteredStores.filter(s => (photosByStore[s.id] || []).length > 0).length;
    const withReschedule = filteredStores.filter(s => scheduleMap[s.id]?.reschedule_enabled).length;
    const withOccurrence = filteredStores.filter(s => {
      const occ = storeOccurrenceStatus[s.id];
      return occ?.hasOccurrence && !occ.allResolved;
    }).length;
    const noCheckin = filteredStores.filter(s => !scheduleMap[s.id]?.photo_checkin).length;
    return { total, completed, pending, withTeam, withPhotos, withReschedule, withOccurrence, noCheckin };
  }, [filteredStores, scheduleMap, photosByStore, storeOccurrenceStatus]);

  // Count active secondary filters
  const secondaryFilterCount = [filterCity, filterPeriod, filterTeam, filterLocked, filterReschedule, filterModel].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Team Codes Panel (shown when toggled from Mais ações) */}
      {showTeamCodesPanel && showCodes && (
        <div className="aqua-card p-4">
          <TeamCodesPanel campaignId={campaignId} />
        </div>
      )}

      {/* Filters — Single row */}
      <div className="flex flex-wrap gap-2 items-center overflow-x-auto">
          <div className="relative w-[200px] shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("filters.searchStore")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-card border-border h-9 text-sm"
            />
          </div>
          <select
            value={filterState}
            onChange={(e) => { setFilterState(e.target.value); setFilterCity(""); }}
            className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground min-w-[100px] max-w-[150px] h-9"
          >
            <option value="">Todos estados</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground min-w-[100px] max-w-[150px] h-9"
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
            className="px-2 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-card text-foreground min-w-[120px] max-w-[160px] h-9"
            title={t("common.filter")}
          />
          {filterDate && (
            <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs text-muted-foreground" onClick={() => setFilterDate("")}>
              ✕
            </Button>
          )}

          {/* More filters button */}
          <Popover open={showMoreFilters} onOpenChange={setShowMoreFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Mais filtros
                {secondaryFilterCount > 0 && (
                  <span className="badge-base badge-info ml-1">{secondaryFilterCount}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4 space-y-3" align="start">
              <p className="text-xs font-semibold text-foreground">Filtros avançados</p>
              <select
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-card text-foreground"
              >
                <option value="">Todas cidades</option>
                {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-card text-foreground"
              >
                <option value="">Período</option>
                <option value="morning">🌅 Manhã</option>
                <option value="afternoon">☀️ Tarde</option>
                <option value="night">🌙 Noite</option>
              </select>
              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-card text-foreground"
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
                className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-card text-foreground"
              >
                <option value="">Bloqueio</option>
                <option value="locked">🔒 Bloqueado</option>
                <option value="unlocked">🔓 Liberado</option>
              </select>
              <select
                value={filterReschedule}
                onChange={(e) => setFilterReschedule(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-card text-foreground"
              >
                <option value="">Remarcação</option>
                <option value="yes">Com remarcação</option>
                <option value="no">Sem remarcação</option>
              </select>
              {storeModels.length > 0 && (
                <select
                  value={filterModel}
                  onChange={(e) => setFilterModel(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-card text-foreground"
                >
                  <option value="">Modelo</option>
                  {storeModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
              {secondaryFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    setFilterCity("");
                    setFilterPeriod("");
                    setFilterTeam("");
                    setFilterLocked("");
                    setFilterReschedule("");
                    setFilterModel("");
                  }}
                >
                  Limpar filtros avançados
                </Button>
              )}
            </PopoverContent>
          </Popover>

          {/* More actions dropdown */}
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-xs gap-1 shrink-0">
                  <MoreHorizontal className="w-3.5 h-3.5" /> Mais ações
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[220px]">
                <DropdownMenuItem onClick={() => setShowCodes(!showCodes)}>
                  <Key className="w-3.5 h-3.5 mr-2" /> {showCodes ? t("installations.hideAccessConfig") : t("installations.tempAccessConfig")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="w-3.5 h-3.5 mr-2" /> Exportar
                </DropdownMenuItem>
                {photos.length > 0 && (
                  <DropdownMenuItem onClick={() => {
                    const storeNameMap: Record<string, string> = {};
                    stores.forEach((s) => {
                      storeNameMap[s.id] = s.store_code ? `${s.store_code}_${s.name}` : s.name;
                    });
                    toast.info(`Preparando download de ${photos.length} arquivo(s)...`);
                    downloadAllCampaignPhotosAsZip(photos, storeNameMap, campaignName, (done, total) => {
                      if (done === total) toast.success(t("common.downloadComplete"));
                    }).catch(() => toast.error(t("common.errorDownloading")));
                  }}>
                    <Camera className="w-3.5 h-3.5 mr-2" /> Baixar todas as fotos ({photos.length})
                  </DropdownMenuItem>
                )}
                {canLockCards && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-[var(--s-danger)] focus:text-[var(--s-danger)]"
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
                          toast.error(err.message || t("common.errorChangingLockBulk"));
                        } finally {
                          setBulkLockLoading(false);
                        }
                      }}
                    >
                      {(() => {
                        const unlocked = displayedStores.filter(s => scheduleMap[s.id] && !scheduleMap[s.id]?.locked);
                        const allLocked = unlocked.length === 0 && displayedStores.some(s => scheduleMap[s.id]);
                        return allLocked
                          ? <><LockOpen className="w-3.5 h-3.5 mr-2" /> Desbloquear Todos</>
                          : <><Lock className="w-3.5 h-3.5 mr-2" /> Bloquear Todos</>;
                      })()}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

      {/* KPI Summary Strip — inline */}
      <div
        className="flex items-baseline overflow-x-auto"
        style={{
          padding: "10px 16px",
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          whiteSpace: "nowrap",
          WebkitOverflowScrolling: "touch",
          gap: 0,
        }}
      >
        {([
          { key: "total" as const, value: summaryMetrics.total, label: t("common.total"), isTotal: true, dangerWhenPositive: false },
          { key: "completed" as const, value: summaryMetrics.completed, label: "Concluídas", isTotal: false, dangerWhenPositive: false },
          { key: "pending" as const, value: summaryMetrics.pending, label: "Pendentes", isTotal: false, dangerWhenPositive: false },
          { key: "withTeam" as const, value: summaryMetrics.withTeam, label: "Com equipe", isTotal: false, dangerWhenPositive: false },
          { key: "withPhotos" as const, value: summaryMetrics.withPhotos, label: "Com fotos", isTotal: false, dangerWhenPositive: false },
          { key: "withReschedule" as const, value: summaryMetrics.withReschedule, label: "Remarcação", isTotal: false, dangerWhenPositive: false },
          { key: "withOccurrence" as const, value: summaryMetrics.withOccurrence, label: "Ocorrências", isTotal: false, dangerWhenPositive: true },
          { key: "noCheckin" as const, value: summaryMetrics.noCheckin, label: "Sem Check-in", isTotal: false, dangerWhenPositive: true, visible: showPhotoCheckin },
        ]).filter(m => m.visible !== false).map((m, idx, arr) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setSummaryFilter(prev => prev === m.key ? "" : m.key)}
            className="inline-flex items-baseline gap-1 transition-colors rounded-md hover:bg-[var(--bg-muted)]"
            style={{
              padding: "2px 14px",
              borderRight: idx < arr.length - 1 ? "1px solid var(--border-subtle)" : "none",
              cursor: "pointer",
              ...(summaryFilter === m.key ? { backgroundColor: "var(--bg-muted)" } : {}),
            }}
          >
            <span
              className="font-bold leading-none"
              style={{
                fontSize: m.isTotal ? 24 : 20,
                color: m.dangerWhenPositive && m.value > 0 ? "var(--s-danger)" : m.isTotal ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              {m.value}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{m.label}</span>
          </button>
        ))}
      </div>
      {summaryFilter && summaryFilter !== "total" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Filtrando por: <strong className="text-foreground">{
            { completed: t("dashboard.completed"), pending: t("dashboard.pending"), withTeam: t("installations.withTeam"), withPhotos: t("installations.withPhotos"), withReschedule: t("installations.withReschedule"), withOccurrence: t("installations.withOccurrence"), noCheckin: t("installations.noCheckin") }[summaryFilter]
          }</strong> ({displayedStores.length})</span>
          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs" onClick={() => setSummaryFilter("")}>✕</Button>
        </div>
      )}

      {/* Store Cards */}
      {displayedStores.length === 0 ? (
        <EmptyState
          icon={Camera}
          hasActiveFilters={!!(searchTerm || filterState || filterStatus || filterDate || filterCity || filterPeriod || filterTeam || filterLocked || filterReschedule || filterModel || filterCheckin || summaryFilter)}
          onClearFilters={() => {
            setSearchTerm(""); setFilterState(""); setFilterCity(""); setFilterStatus(""); setFilterDate("");
            setFilterPeriod(""); setFilterTeam(""); setFilterLocked(""); setFilterReschedule(""); setFilterModel("");
            setFilterCheckin(""); setSummaryFilter("");
          }}
        />
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
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
          const isExpanded = expandedCards.has(store.id);

          const occStatus = storeOccurrenceStatus[store.id];
          const hasOpenOccurrence = occStatus?.hasOccurrence && !occStatus.allResolved;

          // Border color logic: green=completed, red=occurrence, yellow=pending, gray=no date
          const borderLeftColor = schedule?.completed_at
            ? "var(--s-success)"
            : hasOpenOccurrence
              ? "var(--s-danger)"
              : (effectiveDate ? "var(--s-warning)" : "var(--s-neutral)");

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
                  action: newLocked ? t("common.cardBlocked") : t("common.cardUnblocked"),
                  details: newLocked ? t("common.cardBlocked") : t("common.cardUnblocked"),
                });
              }
              queryClient.invalidateQueries({ queryKey: ["campaign_schedules", campaignId] });
              toast.success(newLocked ? t("common.cardBlocked") : t("common.cardUnblocked"));
            } catch (err: any) {
              toast.error(err.message || t("common.errorChangingLock"));
            } finally {
              setLockLoading(prev => ({ ...prev, [store.id]: false }));
            }
          };

          return (
            <div
              key={store.id}
              className={cn(
                "card-base overflow-hidden flex flex-col transition-shadow duration-150 hover:shadow-md",
                isCardLocked && "opacity-80"
              )}
              style={{ borderLeft: `4px solid ${borderLeftColor}`, padding: 0 }}
            >
              {/* COLLAPSED STATE — always visible */}
              <div
                className="px-4 py-3 cursor-pointer select-none"
                onClick={(e) => {
                  // Don't toggle if clicking a button/link inside
                  if ((e.target as HTMLElement).closest("button, a, label, input, select")) return;
                  toggleCardExpanded(store.id);
                }}
              >
                {/* Row 1: Store name + occurrence badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-[var(--text-primary)] truncate">
                      {store.name}
                      {store.nickname && <span className="text-[var(--text-muted)] font-normal"> — {store.nickname}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {hasOpenOccurrence && (() => {
                      const currentPath = window.location.pathname;
                      const occUrl = `${currentPath}?section=occurrences&filterStore=${encodeURIComponent(store.name)}`;
                      return (
                        <a
                          href={occUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="badge-base badge-danger no-underline hover:opacity-80"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Ocorrência ({occStatus!.count})
                        </a>
                      );
                    })()}
                    {isReschedule && (
                      <span className="badge-base badge-warning">REM</span>
                    )}
                    {isCardLocked && (
                      <span className="badge-base badge-neutral"><Lock className="w-3 h-3" /> BLOQ</span>
                    )}
                  </div>
                </div>

                {/* Row 2: Code + State + City */}
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {store.store_code && <span className="font-mono font-semibold text-[var(--text-secondary)]">{store.store_code}</span>}
                  {store.store_code && " · "}
                  {store.state || "—"} · {store.city || "—"}
                </p>

                {/* Row 3: Team + Date + Time + OS */}
                <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--text-secondary)] flex-wrap">
                  {assignedTeam && (
                    <span className="flex items-center gap-1">
                      <Wrench className="w-3 h-3 text-[var(--text-muted)]" />
                      <span className="font-medium">{assignedTeam.name}</span>
                    </span>
                  )}
                  {selectedDate && (
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3 text-[var(--text-muted)]" />
                      {format(selectedDate, "dd/MM/yyyy")}
                    </span>
                  )}
                  {effectiveTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                      {effectiveTime}
                    </span>
                  )}
                  {effectiveOs && (
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3 text-[var(--text-muted)]" />
                      OS: {effectiveOs}
                    </span>
                  )}
                </div>

                {/* Row 4: Photo thumbnails + Complete button + Expand toggle */}
                <div className="flex items-center justify-between mt-2.5 gap-2">
                  <div className="flex items-center gap-1.5">
                    {storePhotos.slice(0, 4).map((photo) => (
                      <img
                        key={photo.id}
                        src={photo.photo_url}
                        alt=""
                        className="w-8 h-8 rounded object-cover border border-[var(--border-subtle)]"
                        onClick={(e) => { e.stopPropagation(); setCheckinStore(store); }}
                        onError={() => handleMediaError(photo.id, photo.campaign_id)}
                      />
                    ))}
                    {storePhotos.length > 4 && (
                      <span
                        className="w-8 h-8 rounded bg-[var(--s-neutral-bg)] border border-[var(--border-subtle)] flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)] cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); setCheckinStore(store); }}
                      >
                        +{storePhotos.length - 4}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {schedule?.completed_at ? (
                      <span className="badge-base badge-success">
                        <CheckCircle className="w-3 h-3" /> Concluída
                      </span>
                    ) : (
                      canEdit && schedule && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1.5 h-8"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const { error } = await supabase
                                .from("campaign_schedules")
                                .update({
                                  completed_at: new Date().toISOString(),
                                  completed_by: "agency",
                                })
                                .eq("id", schedule.id);
                              if (error) throw error;
                              queryClient.invalidateQueries({ queryKey: ["campaign_schedules", campaignId] });
                              logActivity.mutate({
                                campaign_id: campaignId,
                                store_id: store.id,
                                module: "installations",
                                action: "mark_completed",
                                details: t("common.installationCompleted"),
                              });
                              toast.success(t("common.installationCompleted"));
                            } catch {
                              toast.error(t("installations.errorUpdatingCompletion"));
                            }
                          }}
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> {t("installations.markComplete")}
                        </Button>
                      )
                    )}

                    <button
                      type="button"
                      className="w-7 h-7 rounded-md bg-[var(--bg-page)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      onClick={(e) => { e.stopPropagation(); toggleCardExpanded(store.id); }}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* EXPANDED STATE — shown on toggle */}
              <div
                className="overflow-hidden transition-all duration-250 ease-in-out"
                style={{
                  maxHeight: isExpanded ? "2000px" : "0px",
                  opacity: isExpanded ? 1 : 0,
                }}
              >
                <div className="border-t border-[var(--border-subtle)] px-4 py-3 space-y-3 bg-card">
                  {/* Address */}
                  <div className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="text-base">📍</span>
                    <span>{buildAddress(store)}</span>
                  </div>

                  {/* Contact */}
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="text-base">👤</span>
                    <span>{primaryContact?.name || store.manager_name || "—"}</span>
                    {(primaryContact?.phone || store.phone) && (
                      <span className="text-[var(--text-muted)]">· ({primaryContact?.phone || store.phone})</span>
                    )}
                  </div>

                  {/* Team details popover */}
                  {assignedTeam && (
                    <div className="flex items-center gap-2 text-xs">
                      <Wrench className="w-3 h-3 text-[var(--text-muted)]" />
                      <span className="font-medium">{assignedTeam.name}</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2">
                            <Users className="w-3 h-3" /> Ver equipe
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 max-h-64 overflow-y-auto p-3" align="start">
                          <TeamCardContent team={assignedTeam} members={teamMembers} vehicles={teamVehicles} />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  <hr className="border-[var(--border-subtle)]" />

                  {/* Completion status message */}
                  {schedule?.completed_at && (
                    <div className="flex items-center gap-2 text-xs bg-[var(--s-success-bg)] text-[var(--s-success)] rounded-lg px-3 py-2">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span className="font-medium">
                        {schedule.completed_by === "agency"
                          ? `Marcada manualmente como concluída pela equipe da Agência, em: ${format(new Date(schedule.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                          : `Concluída em ${format(new Date(schedule.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                        }
                      </span>
                    </div>
                  )}

                  {/* Photo Check-in */}
                  {showPhotoCheckin && schedule && (
                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors border min-h-[44px]",
                        schedule.photo_checkin
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20"
                          : "bg-orange-500/10 text-orange-700 border-orange-500/30 hover:bg-orange-500/20"
                      )}
                      onClick={async () => {
                        const newVal = !schedule.photo_checkin;
                        try {
                          const { error } = await supabase
                            .from("campaign_schedules")
                            .update({
                              photo_checkin: newVal,
                              photo_checkin_at: newVal ? new Date().toISOString() : null,
                            } as any)
                            .eq("id", schedule.id);
                          if (error) throw error;
                          queryClient.invalidateQueries({ queryKey: ["campaign_schedules", campaignId] });
                          logActivity.mutate({
                            campaign_id: campaignId,
                            store_id: store.id,
                            module: "installations",
                            action: newVal ? "photo_checkin_done" : "photo_checkin_removed",
                            details: newVal ? t("installations.checkinDone") : t("installations.checkinRemoved"),
                          });
                          toast.success(newVal ? t("installations.checkinDone") : t("installations.checkinRemoved"));
                        } catch {
                          toast.error(t("installations.errorUpdatingCheckin"));
                        }
                      }}
                    >
                      {schedule.photo_checkin && schedule.photo_checkin_at ? (
                        <><CheckCircle2 className="w-4 h-4" /> Fotos para ocorrências verificadas em: {format(new Date(schedule.photo_checkin_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</>
                      ) : (
                        <><AlertCircle className="w-4 h-4" /> Clique aqui para informar Check-in de fotos para ocorrências</>
                      )}
                    </button>
                  )}

                  <hr className="border-[var(--border-subtle)]" />

                  {/* Lock toggle */}
                  {canLockCards && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("h-11 text-xs gap-1.5", isCardLocked ? "text-destructive" : "")}
                        title={isCardLocked ? t("common.released") : t("common.blocked")}
                        onClick={handleToggleLock}
                        disabled={!!lockLoading[store.id]}
                      >
                        {isCardLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
                        {isCardLocked ? t("common.blocked") : t("common.released")}
                      </Button>
                      {isAdminOrMaster && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-11 text-xs gap-1.5"
                          onClick={() => {
                            setLogStoreId(store.id);
                            setLogStoreName(store.name);
                            setLogOpen(true);
                          }}
                        >
                          <ClipboardList className="w-4 h-4" /> Log
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Photo gallery expanded */}
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
                        className="text-xs gap-1.5 w-full min-h-[44px]"
                        onClick={() => {
                          toast.info(t("common.preparing"));
                          downloadPhotosAsZip(storePhotos, {
                            module: "Instalacao",
                            campaignName,
                            storeName: store.name,
                          }).then(() => toast.success(t("common.downloadComplete"))).catch(() => toast.error(t("common.errorDownloading")));
                        }}
                      >
                        <Download className="w-3 h-3" />
                        Baixar {storePhotos.length} foto(s) (.zip)
                      </Button>
                    </div>
                  )}

                  {/* Upload section */}
                  {canEdit && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <select
                        value={catForStore}
                        onChange={(e) => setUploadCategory((prev) => ({ ...prev, [store.id]: e.target.value }))}
                        className="h-8 text-xs rounded-md border border-border bg-card text-foreground px-2"
                      >
                        {CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
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
                        <Button variant="outline" size="sm" className="text-xs gap-1 pointer-events-none min-h-[44px]" asChild>
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
                        <Button variant="outline" size="sm" className="text-xs gap-1 pointer-events-none min-h-[44px]" asChild>
                          <span><Camera className="w-3 h-3" /> Foto</span>
                        </Button>
                      </label>
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="space-y-2 pt-1">
                    {/* Undo completion */}
                    {canEdit && schedule?.completed_at && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs gap-2 min-h-[44px] text-[var(--s-warning)]"
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from("campaign_schedules")
                              .update({
                                completed_at: null,
                                completed_by: null,
                              })
                              .eq("id", schedule.id);
                            if (error) throw error;
                            queryClient.invalidateQueries({ queryKey: ["campaign_schedules", campaignId] });
                            logActivity.mutate({
                              campaign_id: campaignId,
                              store_id: store.id,
                              module: "installations",
                              action: "remove_completion",
                              details: t("common.markRemoved"),
                            });
                            toast.success(t("common.markRemoved"));
                          } catch {
                            toast.error(t("installations.errorUpdatingCompletion"));
                          }
                        }}
                      >
                        Desfazer conclusão
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs gap-2 min-h-[44px]"
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

                  {/* Close button */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      className="w-7 h-7 rounded-md bg-[var(--bg-page)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      onClick={() => toggleCardExpanded(store.id)}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
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

      {checkinStore && (
        <PhotoCheckinDialog
          open={!!checkinStore}
          onOpenChange={(open) => { if (!open) setCheckinStore(null); }}
          store={checkinStore}
          photos={photos.filter((p) => p.store_id === checkinStore.id)}
        />
      )}
    </div>
  );
};

export default InstallationsTab;
