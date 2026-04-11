/**
 * InstallationsTabV2 — v2 card-based UI for Installations module.
 * Reuses ALL data hooks from the original. Zero logic changes.
 * Renders collapsible cards with KpiStrip and CollapsibleFilters.
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCampaignSchedules } from "@/hooks/useCampaignSchedules";
import { useOccurrenceStatusSync } from "@/hooks/useOccurrenceStatusSync";
import { buildAddress, buildContactsByStoreMap } from "@/lib/storeHelpers";
import { type ClientStore } from "@/hooks/useMultiClientData";
import { getStateColor } from "@/lib/stateColors";
import { useStoreContactsByClient, useStoreContactRoles } from "@/hooks/useStoreContacts";
import { useInstallationPhotos, useAddInstallationPhoto, type InstallationPhoto } from "@/hooks/useInstallationPhotos";
import { useOrphanPhotoCleanup } from "@/hooks/useOrphanPhotoCleanup";
import { useAuth } from "@/hooks/useAuth";
import { compressImage } from "@/lib/compressImage";
import TeamCodesPanel from "@/components/TeamCodesPanel";
import { useUserRole } from "@/hooks/useUserRole";
import { useClientPermission } from "@/hooks/useClientPermission";
import { useLogActivity } from "@/hooks/useActivityLogs";
import ActivityLogPanel from "@/components/ActivityLogPanel";
import PhotoCheckinDialog from "@/components/PhotoCheckinDialog";
import KpiStrip from "./KpiStrip";
import CollapsibleFilters, { type FilterConfig } from "./CollapsibleFilters";
import CardV2 from "./CardV2";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CalendarIcon, Clock, FileText, Sun, Moon, HelpCircle,
  Users, AlertTriangle, Wrench,
  Camera, Upload, Key, CheckCircle, Download, ClipboardList, Lock, LockOpen,
  CheckCircle2, AlertCircle, Image,
} from "lucide-react";
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
  TeamCardContent,
  type InstallationTeam,
  type TeamMember,
  type TeamVehicle,
} from "@/components/InstallationTeamDialog";

interface Props {
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

export default function InstallationsTabV2({ campaignId, campaignName, stores, canEdit, clientId, agencyName = "", clientName = "" }: Props) {
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
  const [summaryFilter, setSummaryFilter] = useState<string>("");
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

  // Data hooks (same as original)
  const { scheduleMap } = useCampaignSchedules(campaignId);
  const { storeOccurrenceStatus } = useOccurrenceStatusSync(campaignId);
  const { data: teams = [] } = useInstallationTeams(campaignId);
  const { data: allMembersMap = {} } = useAllTeamMembers(campaignId);
  const { data: allVehiclesMap = {} } = useAllTeamVehicles(campaignId);
  const { data: photos = [] } = useInstallationPhotos(campaignId);
  const addPhoto = useAddInstallationPhoto();
  const { handleMediaError } = useOrphanPhotoCleanup();
  const { data: allContacts = [] } = useStoreContactsByClient(clientId);

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

  // Only stores with scheduled date+time
  const scheduledStores = useMemo(() => stores.filter((s) => {
    const sch = scheduleMap[s.id];
    if (!sch) return false;
    if (sch.reschedule_enabled) return !!sch.reschedule_date && !!sch.reschedule_time;
    return !!sch.scheduled_date && !!sch.scheduled_time;
  }), [stores, scheduleMap]);

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

  // Filtering logic (preserved from original)
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
          if (!isToday || !effTime) { matchesStatus = false; }
          else {
            const [h, m] = effTime.split(":").map(Number);
            const scheduledMs = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m).getTime();
            matchesStatus = scheduledMs <= Date.now() - 3 * 60 * 60 * 1000;
          }
        }
      } else if (filterStatus === "no_photo") {
        matchesStatus = (photosByStore[s.id] || []).length === 0;
      }

      let matchesDate = true;
      if (filterDate) {
        const effDate = schedule?.reschedule_enabled ? schedule?.reschedule_date : schedule?.scheduled_date;
        matchesDate = effDate === filterDate;
      }

      let matchesPeriod = true;
      if (filterPeriod) {
        const effTime = schedule?.reschedule_enabled ? schedule?.reschedule_time : schedule?.scheduled_time;
        if (!effTime) matchesPeriod = false;
        else {
          const hour = parseInt(effTime.split(":")[0], 10);
          if (filterPeriod === "morning") matchesPeriod = hour >= 1 && hour <= 11;
          else if (filterPeriod === "afternoon") matchesPeriod = hour >= 12 && hour <= 17;
          else if (filterPeriod === "night") matchesPeriod = hour >= 18 && hour <= 23;
        }
      }

      let matchesTeam = true;
      if (filterTeam) {
        if (filterTeam === "no_team") matchesTeam = !schedule?.team_id;
        else matchesTeam = schedule?.team_id === filterTeam;
      }

      let matchesLocked = true;
      if (filterLocked === "locked") matchesLocked = !!schedule?.locked;
      else if (filterLocked === "unlocked") matchesLocked = !schedule?.locked;

      let matchesReschedule = true;
      if (filterReschedule === "yes") matchesReschedule = !!schedule?.reschedule_enabled;
      else if (filterReschedule === "no") matchesReschedule = !schedule?.reschedule_enabled;

      let matchesModel = true;
      if (filterModel) matchesModel = s.store_model === filterModel;

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

  // Summary filter
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

  // Metrics
  const metrics = useMemo(() => {
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

  // Upload handler
  const handleUploadPhoto = async (storeId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const category = uploadCategory[storeId] || "before";
    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImage(file, 1200, 0.7);
        const fileName = `${campaignId}/${storeId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: uploadErr } = await supabase.storage.from("installation-photos").upload(fileName, compressed, { contentType: "image/jpeg" });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("installation-photos").getPublicUrl(fileName);
        await addPhoto.mutateAsync({ campaign_id: campaignId, store_id: storeId, photo_url: urlData.publicUrl, category, uploaded_by: user?.id, upload_method: "upload" });
      } catch (err) {
        console.error("Upload error:", err);
        toast.error(t("installations.errorUpload"));
      }
    }
    logActivity.mutate({ campaign_id: campaignId, store_id: storeId, module: "installations", action: `Enviou ${files.length} foto(s)`, details: `Categoria: ${category}` });
    toast.success(`${files.length} foto(s) enviada(s)!`);
  };

  // Export handler
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
        [t("common.date")]: effDate ? format(new Date(effDate + "T12:00:00"), "dd/MM/yyyy") : "",
        [t("common.time")]: effTime || "",
        "OS": effOs || "",
        [t("scheduling.team")]: team?.name || "",
        [t("installations.completed")]: schedule?.completed_at ? format(new Date(schedule.completed_at), "dd/MM/yyyy HH:mm") : "Não",
        [t("installations.photos")]: storePhotos.length,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t("installations.title"));
    downloadWorkbook(wb, buildExportFileName(`Instalacoes_${campaignName}`, { agencyName, clientName }));
    toast.success(t("common.spreadsheetExported"));
  };

  // KPI items
  const kpiItems = [
    { key: "total", label: t("common.total"), value: metrics.total, primary: true },
    { key: "completed", label: "✅ Concluídas", value: metrics.completed, color: "text-emerald-600" },
    { key: "pending", label: "⏳ Pendentes", value: metrics.pending, color: "text-amber-600" },
    { key: "withTeam", label: "🔧 Com equipe", value: metrics.withTeam },
    { key: "withPhotos", label: "📷 Com fotos", value: metrics.withPhotos },
    { key: "withReschedule", label: "🔄 Remarcação", value: metrics.withReschedule, color: "text-amber-600" },
    { key: "withOccurrence", label: "⚠️ Ocorrências", value: metrics.withOccurrence, color: "text-destructive" },
    ...(showPhotoCheckin ? [{ key: "noCheckin", label: "🔍 Sem Check-in", value: metrics.noCheckin, color: "text-orange-600" }] : []),
  ];

  // Filters config
  const primaryFilters: FilterConfig[] = [
    {
      key: "state", label: "Estado", type: "select" as const, value: filterState,
      onChange: (v: string) => { setFilterState(v); setFilterCity(""); },
      options: [{ value: "", label: "Todos estados" }, ...states.map(s => ({ value: s, label: s }))],
    },
    {
      key: "status", label: "Status", type: "select" as const, value: filterStatus,
      onChange: (v: string) => setFilterStatus(v as any),
      options: [{ value: "", label: "Todos status" }, { value: "completed", label: "✅ Concluídas" }, { value: "pending", label: "⏳ Pendentes" }, { value: "no_photo", label: "📷 Sem fotos" }],
    },
    {
      key: "date", label: "Data", type: "date" as const, value: filterDate,
      onChange: (v: string) => setFilterDate(v),
    },
  ];

  const secondaryFilters: FilterConfig[] = [
    {
      key: "city", label: "Cidade", type: "select" as const, value: filterCity,
      onChange: (v: string) => setFilterCity(v),
      options: [{ value: "", label: "Todas cidades" }, ...cities.map(c => ({ value: c, label: c }))],
    },
    {
      key: "team", label: "Equipe", type: "select" as const, value: filterTeam,
      onChange: (v: string) => setFilterTeam(v),
      options: [{ value: "", label: "Equipe" }, { value: "no_team", label: "Sem equipe" }, ...teams.map(t => ({ value: t.id, label: t.name }))],
    },
    {
      key: "period", label: "Período", type: "select" as const, value: filterPeriod,
      onChange: (v: string) => setFilterPeriod(v),
      options: [{ value: "", label: "Período" }, { value: "morning", label: "🌅 Manhã" }, { value: "afternoon", label: "☀️ Tarde" }, { value: "night", label: "🌙 Noite" }],
    },
    {
      key: "locked", label: "Bloqueio", type: "select" as const, value: filterLocked,
      onChange: (v: string) => setFilterLocked(v),
      options: [{ value: "", label: "Bloqueio" }, { value: "locked", label: "🔒 Bloqueado" }, { value: "unlocked", label: "🔓 Liberado" }],
    },
    {
      key: "reschedule", label: "Remarcação", type: "select" as const, value: filterReschedule,
      onChange: (v: string) => setFilterReschedule(v),
      options: [{ value: "", label: "Remarcação" }, { value: "yes", label: "Com remarcação" }, { value: "no", label: "Sem remarcação" }],
    },
    ...(storeModels.length > 0 ? [{
      key: "model", label: "Modelo", type: "select" as const, value: filterModel,
      onChange: (v: string) => setFilterModel(v),
      options: [{ value: "", label: "Modelo" }, ...storeModels.map(m => ({ value: m, label: m }))],
    }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Team Codes Panel */}
      {showTeamCodesPanel && (
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setShowCodes(!showCodes)}>
            <Key className="w-3.5 h-3.5" />
            {showCodes ? t("installations.hideAccessConfig") : t("installations.tempAccessConfig")}
          </Button>
          {showCodes && <div className="card-v2 p-4"><TeamCodesPanel campaignId={campaignId} /></div>}
        </div>
      )}

      {/* Filters */}
      <CollapsibleFilters
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t("filters.searchStore")}
        primaryFilters={primaryFilters}
        secondaryFilters={secondaryFilters}
      />

      {/* Action buttons */}
      <div className="flex flex-wrap gap-1.5">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExport}>
          <Download className="w-3.5 h-3.5" /> Exportar
        </Button>
        {photos.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
            const storeNameMap: Record<string, string> = {};
            stores.forEach((s) => { storeNameMap[s.id] = s.store_code ? `${s.store_code}_${s.name}` : s.name; });
            toast.info(`Preparando download de ${photos.length} arquivo(s)...`);
            downloadAllCampaignPhotosAsZip(photos, storeNameMap, campaignName, (done, total) => {
              if (done === total) toast.success(t("common.downloadComplete"));
            }).catch(() => toast.error(t("common.errorDownloading")));
          }}>
            <Camera className="w-3.5 h-3.5" /> Baixar todas as fotos ({photos.length})
          </Button>
        )}
        {canLockCards && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={bulkLockLoading} onClick={async () => {
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
            } finally { setBulkLockLoading(false); }
          }}>
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

      {/* KPI Strip */}
      <KpiStrip
        items={kpiItems}
        activeKey={summaryFilter}
        onItemClick={(key) => setSummaryFilter(prev => prev === key ? "" : key)}
      />

      {summaryFilter && summaryFilter !== "total" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Filtrando: <strong className="text-foreground">{displayedStores.length}</strong> resultados</span>
          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs" onClick={() => setSummaryFilter("")}>✕</Button>
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {displayedStores.map((store) => {
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
          const isCardLocked = !!schedule?.locked;
          const cardCanEdit = canEdit && (!isCardLocked || isAdminOrMaster);
          const occStatus = storeOccurrenceStatus[store.id];
          const hasOpenOccurrence = occStatus?.hasOccurrence && !occStatus.allResolved;
          const catForStore = uploadCategory[store.id] || "before";

          const cardStatus = schedule?.completed_at ? "success" as const
            : hasOpenOccurrence ? "danger" as const
            : isReschedule ? "warning" as const
            : "neutral" as const;

          return (
            <CardV2
              key={store.id}
              status={cardStatus}
              collapsed={
                <div className="space-y-1.5">
                  {/* Store name */}
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground truncate">{store.name}</h3>
                    <div className="flex items-center gap-1 shrink-0">
                      {hasOpenOccurrence && (
                        <span className="badge-v2 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                          ● Ocorrência ({occStatus!.count})
                        </span>
                      )}
                      {isReschedule && (
                        <span className="badge-v2 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">REM</span>
                      )}
                      {isCardLocked && (
                        <Lock className="w-3.5 h-3.5 text-destructive" />
                      )}
                    </div>
                  </div>
                  {/* Code + location */}
                  <p className="text-xs text-muted-foreground">
                    {store.store_code || "—"} · {store.state} · {store.city || "—"}
                  </p>
                  {/* Team + date + OS */}
                  <p className="text-xs text-muted-foreground">
                    {assignedTeam?.name || "Sem equipe"} · {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "—"} {effectiveTime || ""} {effectiveOs ? `· OS: ${effectiveOs}` : ""}
                  </p>
                  {/* Photo thumbnails + completion */}
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="flex gap-1">
                      {storePhotos.slice(0, 4).map((photo) => (
                        <img key={photo.id} src={photo.photo_url} alt="" className="w-8 h-8 rounded object-cover border border-border" onError={() => handleMediaError(photo.id, photo.campaign_id)} />
                      ))}
                      {storePhotos.length > 4 && (
                        <span className="w-8 h-8 rounded bg-muted border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground">+{storePhotos.length - 4}</span>
                      )}
                    </div>
                    {schedule?.completed_at ? (
                      <span className="badge-v2 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                        <CheckCircle className="w-3 h-3" /> Concluída
                      </span>
                    ) : canEdit && schedule ? (
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={async () => {
                          try {
                            const { error } = await supabase.from("campaign_schedules").update({ completed_at: new Date().toISOString(), completed_by: "agency" }).eq("id", schedule.id);
                            if (error) throw error;
                            queryClient.invalidateQueries({ queryKey: ["campaign_schedules", campaignId] });
                            logActivity.mutate({ campaign_id: campaignId, store_id: store.id, module: "installations", action: "mark_completed", details: t("common.installationCompleted") });
                            toast.success(t("common.installationCompleted"));
                          } catch { toast.error(t("installations.errorUpdatingCompletion")); }
                        }}
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Marcar Concluída
                      </Button>
                    ) : null}
                  </div>
                </div>
              }
              expanded={
                <div className="space-y-3">
                  {/* Address */}
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Endereço:</span> {buildAddress(store)}
                  </div>
                  {/* Contact */}
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4">
                    <span><span className="font-medium text-foreground">Contato:</span> {primaryContact?.name || store.manager_name || "—"}</span>
                    <span><span className="font-medium text-foreground">Tel:</span> {primaryContact?.phone || store.phone || "—"}</span>
                  </div>

                  {/* Completion info */}
                  {schedule?.completed_at && (
                    <div className="flex items-center gap-2 text-xs bg-emerald-500/10 text-emerald-700 rounded-lg px-3 py-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span className="font-medium">
                        {schedule.completed_by === "agency"
                          ? `Marcada manualmente como concluída pela Agência ${format(new Date(schedule.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                          : `Concluída em ${format(new Date(schedule.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}
                      </span>
                    </div>
                  )}

                  {/* Photo check-in */}
                  {showPhotoCheckin && schedule && (
                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors border min-h-[44px]",
                        schedule.photo_checkin
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                          : "bg-orange-500/10 text-orange-700 border-orange-500/30"
                      )}
                      onClick={async () => {
                        const newVal = !schedule.photo_checkin;
                        try {
                          const { error } = await supabase.from("campaign_schedules").update({ photo_checkin: newVal, photo_checkin_at: newVal ? new Date().toISOString() : null } as any).eq("id", schedule.id);
                          if (error) throw error;
                          queryClient.invalidateQueries({ queryKey: ["campaign_schedules", campaignId] });
                          logActivity.mutate({ campaign_id: campaignId, store_id: store.id, module: "installations", action: newVal ? "photo_checkin_done" : "photo_checkin_removed", details: newVal ? t("installations.checkinDone") : t("installations.checkinRemoved") });
                          toast.success(newVal ? t("installations.checkinDone") : t("installations.checkinRemoved"));
                        } catch { toast.error(t("installations.errorUpdatingCheckin")); }
                      }}
                    >
                      {schedule.photo_checkin && schedule.photo_checkin_at ? (
                        <><CheckCircle2 className="w-4 h-4" /> Fotos verificadas em: {format(new Date(schedule.photo_checkin_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</>
                      ) : (
                        <><AlertCircle className="w-4 h-4" /> Check-in de fotos para ocorrências</>
                      )}
                    </button>
                  )}

                  {/* Photos grid */}
                  {storePhotos.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex gap-1.5 flex-wrap">
                        {storePhotos.slice(0, 6).map((photo) => (
                          <img key={photo.id} src={photo.photo_url} alt="" className="w-12 h-12 rounded-md object-cover border border-border cursor-pointer hover:opacity-80" onClick={() => setCheckinStore(store)} onError={() => handleMediaError(photo.id, photo.campaign_id)} />
                        ))}
                        {storePhotos.length > 6 && (
                          <button className="w-12 h-12 rounded-md bg-muted border border-border flex items-center justify-center text-xs font-bold text-muted-foreground" onClick={() => setCheckinStore(store)}>+{storePhotos.length - 6}</button>
                        )}
                      </div>
                      <Button variant="outline" size="sm" className="text-xs gap-1.5 w-full" onClick={() => {
                        toast.info(t("common.preparing"));
                        downloadPhotosAsZip(storePhotos, { module: "Instalacao", campaignName, storeName: store.name }).then(() => toast.success(t("common.downloadComplete"))).catch(() => toast.error(t("common.errorDownloading")));
                      }}>
                        <Download className="w-3 h-3" /> Baixar {storePhotos.length} foto(s) (.zip)
                      </Button>
                    </div>
                  )}

                  {/* Upload section */}
                  {canEdit && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <select value={catForStore} onChange={(e) => setUploadCategory((prev) => ({ ...prev, [store.id]: e.target.value }))} className="h-8 text-xs rounded-md border border-border bg-card text-foreground px-2">
                        {CATEGORY_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>))}
                      </select>
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleUploadPhoto(store.id, e.target.files); e.target.value = ""; }} />
                        <Button variant="outline" size="sm" className="text-xs gap-1 pointer-events-none h-[44px]" asChild><span><Upload className="w-3 h-3" /> Upload</span></Button>
                      </label>
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { handleUploadPhoto(store.id, e.target.files); e.target.value = ""; }} />
                        <Button variant="outline" size="sm" className="text-xs gap-1 pointer-events-none h-[44px]" asChild><span><Camera className="w-3 h-3" /> Foto</span></Button>
                      </label>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {canEdit && schedule && !schedule.completed_at && (
                      <Button size="sm" className="flex-1 h-[44px] text-xs gap-2" onClick={async () => {
                        try {
                          const { error } = await supabase.from("campaign_schedules").update({ completed_at: new Date().toISOString(), completed_by: "agency" }).eq("id", schedule.id);
                          if (error) throw error;
                          queryClient.invalidateQueries({ queryKey: ["campaign_schedules", campaignId] });
                          logActivity.mutate({ campaign_id: campaignId, store_id: store.id, module: "installations", action: "mark_completed", details: t("common.installationCompleted") });
                          toast.success(t("common.installationCompleted"));
                        } catch { toast.error(t("installations.errorUpdatingCompletion")); }
                      }}>
                        <CheckCircle className="w-4 h-4" /> {t("installations.markComplete")}
                      </Button>
                    )}
                    {canEdit && schedule?.completed_at && (
                      <Button variant="outline" size="sm" className="flex-1 h-[44px] text-xs gap-2" onClick={async () => {
                        try {
                          const { error } = await supabase.from("campaign_schedules").update({ completed_at: null, completed_by: null }).eq("id", schedule.id);
                          if (error) throw error;
                          queryClient.invalidateQueries({ queryKey: ["campaign_schedules", campaignId] });
                          logActivity.mutate({ campaign_id: campaignId, store_id: store.id, module: "installations", action: "remove_completion", details: t("common.markRemoved") });
                          toast.success(t("common.markRemoved"));
                        } catch { toast.error(t("installations.errorUpdatingCompletion")); }
                      }}>
                        Desfazer conclusão
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-[44px] text-xs gap-2" onClick={() => setCheckinStore(store)}>
                      <Camera className="w-4 h-4" /> Checkin {storePhotos.length > 0 && `(${storePhotos.length})`}
                    </Button>
                  </div>

                  {/* Lock toggle */}
                  {canLockCards && (
                    <Button variant="ghost" size="sm" className={cn("text-xs gap-1.5 w-full h-[44px]", isCardLocked && "text-destructive")} onClick={async () => {
                      if (!schedule) return;
                      setLockLoading(prev => ({ ...prev, [store.id]: true }));
                      try {
                        const newLocked = !isCardLocked;
                        const { error } = await supabase.from("campaign_schedules").update({ locked: newLocked } as any).eq("id", schedule.id);
                        if (error) throw error;
                        if (user) {
                          await supabase.from("activity_logs").insert({ campaign_id: campaignId, store_id: store.id, user_id: user.id, module: "installations", action: newLocked ? t("common.cardBlocked") : t("common.cardUnblocked"), details: newLocked ? t("common.cardBlocked") : t("common.cardUnblocked") });
                        }
                        queryClient.invalidateQueries({ queryKey: ["campaign_schedules", campaignId] });
                        toast.success(newLocked ? t("common.cardBlocked") : t("common.cardUnblocked"));
                      } catch (err: any) { toast.error(err.message || t("common.errorChangingLock")); }
                      finally { setLockLoading(prev => ({ ...prev, [store.id]: false })); }
                    }} disabled={!!lockLoading[store.id]}>
                      {isCardLocked ? <><Lock className="w-3.5 h-3.5" /> Desbloquear</> : <><LockOpen className="w-3.5 h-3.5" /> Bloquear</>}
                    </Button>
                  )}

                  {/* Activity log button */}
                  {isAdminOrMaster && (
                    <Button variant="ghost" size="sm" className="text-xs gap-1.5 w-full" onClick={() => { setLogStoreId(store.id); setLogStoreName(store.name); setLogOpen(true); }}>
                      <ClipboardList className="w-3.5 h-3.5" /> Ver atividades
                    </Button>
                  )}
                </div>
              }
            />
          );
        })}
      </div>

      {displayedStores.length === 0 && (
        <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma loja com agendamento encontrada</p>
      )}

      {isAdminOrMaster && (
        <ActivityLogPanel open={logOpen} onOpenChange={setLogOpen} campaignId={campaignId} storeId={logStoreId} storeName={logStoreName} module="installations" />
      )}

      {checkinStore && (
        <PhotoCheckinDialog open={!!checkinStore} onOpenChange={(open) => { if (!open) setCheckinStore(null); }} store={checkinStore} photos={photos.filter((p) => p.store_id === checkinStore.id)} />
      )}
    </div>
  );
}
