import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type ClientStore } from "@/hooks/useMultiClientData";
import { getStateColor } from "@/lib/stateColors";
import { useStoreContactsByClient, useStoreContactRoles, type StoreContact } from "@/hooks/useStoreContacts";
import { useInstallationPhotos, useAddInstallationPhoto, type InstallationPhoto } from "@/hooks/useInstallationPhotos";
import { useAuth } from "@/hooks/useAuth";
import { compressImage } from "@/lib/compressImage";
import DebouncedInput from "@/components/DebouncedInput";
import TeamCodesPanel from "@/components/TeamCodesPanel";
import { useUserRole } from "@/hooks/useUserRole";
import { useClientPermission } from "@/hooks/useClientPermission";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search, CalendarIcon, Clock, FileText, Sun, Moon, HelpCircle,
  Users, MessageCircle, Phone, Mail, AlertTriangle, Wrench,
  Camera, Image, Upload, Plus, Key,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  stores: ClientStore[];
  canEdit: boolean;
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
  team_approved: boolean;
  completed_at: string | null;
};

const CATEGORY_OPTIONS = [
  { value: "before", label: "Antes" },
  { value: "during", label: "Durante" },
  { value: "after", label: "Depois" },
];

function buildAddress(store: ClientStore) {
  return [store.street, store.number, store.complement, store.neighborhood, store.city, store.state, store.zip_code]
    .filter(Boolean)
    .join(", ") || "Endereço não cadastrado";
}

const InstallationsTab = ({ campaignId, stores, canEdit, clientId }: InstallationsTabProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdminOrMaster } = useUserRole();
  const { hasPermission: canManageTeamCodes } = useClientPermission(clientId, "can_manage_team_codes");
  const showTeamCodesPanel = isAdminOrMaster || canManageTeamCodes;
  const [searchTerm, setSearchTerm] = useState("");
  const [showCodes, setShowCodes] = useState(false);
  const [filterState, setFilterState] = useState("");
  const [filterCity, setFilterCity] = useState("");
  
  const [uploadCategory, setUploadCategory] = useState<Record<string, string>>({});

  // Fetch schedules (only stores with schedules)
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

  const scheduleMap = useMemo(() => {
    const map: Record<string, Schedule> = {};
    schedules.forEach((s) => { map[s.store_id] = s; });
    return map;
  }, [schedules]);

  // Only show stores that have a schedule
  const scheduledStores = useMemo(() => stores.filter((s) => scheduleMap[s.id]), [stores, scheduleMap]);

  const { data: teams = [] } = useInstallationTeams(campaignId);
  const { data: allMembersMap = {} } = useAllTeamMembers(campaignId);
  const { data: allVehiclesMap = {} } = useAllTeamVehicles(campaignId);
  const { data: photos = [] } = useInstallationPhotos(campaignId);
  const addPhoto = useAddInstallationPhoto();

  const { data: allContacts = [] } = useStoreContactsByClient(clientId);
  const { data: contactRoles = [] } = useStoreContactRoles(clientId);

  const teamMap = useMemo(() => {
    const map: Record<string, InstallationTeam> = {};
    teams.forEach((t) => { map[t.id] = t; });
    return map;
  }, [teams]);


  const contactsByStore = useMemo(() => {
    const map: Record<string, StoreContact[]> = {};
    allContacts.forEach((c) => { (map[c.store_id] = map[c.store_id] || []).push(c); });
    return map;
  }, [allContacts]);

  const photosByStore = useMemo(() => {
    const map: Record<string, InstallationPhoto[]> = {};
    photos.forEach((p) => { (map[p.store_id] = map[p.store_id] || []).push(p); });
    return map;
  }, [photos]);

  // Filters
  const states = useMemo(() => [...new Set(scheduledStores.map((s) => s.state?.trim()).filter(Boolean))].sort() as string[], [scheduledStores]);
  const cities = useMemo(() => {
    const filtered = filterState ? scheduledStores.filter((s) => s.state?.trim() === filterState) : scheduledStores;
    return [...new Set(filtered.map((s) => s.city).filter(Boolean))].sort() as string[];
  }, [scheduledStores, filterState]);

  const filteredStores = useMemo(() => {
    return scheduledStores.filter((s) => {
      const matchesSearch = !searchTerm ||
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.store_code?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesState = !filterState || s.state?.trim() === filterState;
      const matchesCity = !filterCity || s.city === filterCity;
      return matchesSearch && matchesState && matchesCity;
    }).sort((a, b) => {
      const stateComp = (a.state || "").localeCompare(b.state || "");
      if (stateComp !== 0) return stateComp;
      return a.name.localeCompare(b.name);
    });
  }, [scheduledStores, searchTerm, filterState, filterCity]);

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
    toast.success(`${files.length} foto(s) enviada(s)!`);
  };

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
            {showCodes ? "Ocultar Códigos de Acesso" : "Códigos de Acesso Temporário"}
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
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{filteredStores.length} loja(s) com agendamento</p>

      {/* Store Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {filteredStores.map((store) => {
          const colors = getStateColor(store.state);
          const schedule = scheduleMap[store.id];
          const assignedTeam = schedule?.team_id ? teamMap[schedule.team_id] : null;
          const teamMembers: TeamMember[] = schedule?.team_id ? (allMembersMap[schedule.team_id] || []) : [];
          const teamVehicles: TeamVehicle[] = schedule?.team_id ? (allVehiclesMap[schedule.team_id] || []) : [];
          const storePhotos = photosByStore[store.id] || [];
          const storeContacts = contactsByStore[store.id] || [];
          const primaryContact = storeContacts[0];
          const selectedDate = schedule?.scheduled_date ? new Date(schedule.scheduled_date + "T12:00:00") : undefined;
          const catForStore = uploadCategory[store.id] || "before";

          return (
            <div
              key={store.id}
              className="aqua-card overflow-hidden shadow-sm flex flex-col"
              style={{ borderColor: colors.text, borderWidth: 2, border: `2px solid ${colors.text}` }}
            >
              {/* Header */}
              <div
                className="px-4 py-3 flex items-center gap-3"
                style={{ backgroundColor: colors.bg, color: colors.text }}
              >
                <span className="font-bold text-lg">{store.store_code || "—"}</span>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-semibold truncate text-sm">{store.name}</span>
                  <span className="text-xs opacity-80">{store.state} · {store.city || "—"}</span>
                </div>
                {storePhotos.length > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold opacity-80">
                    <Image className="w-3.5 h-3.5" /> {storePhotos.length}
                  </span>
                )}
              </div>

              {/* Body */}
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
                  {schedule?.scheduled_time && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span className="font-medium text-foreground">{schedule.scheduled_time}</span>
                    </span>
                  )}
                  {schedule?.installation_os && (
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      <span className="font-medium text-foreground">OS: {schedule.installation_os}</span>
                    </span>
                  )}
                </div>

                <hr className="border-border" />

                {/* Photo thumbnails */}
                {storePhotos.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {storePhotos.slice(0, 6).map((photo) => (
                      <img
                        key={photo.id}
                        src={photo.photo_url}
                        alt=""
                        className="w-12 h-12 rounded-md object-cover border border-border cursor-pointer hover:opacity-80"
                        onClick={() => window.open(`/checkin/${campaignId}/${store.id}`, '_blank')}
                      />
                    ))}
                    {storePhotos.length > 6 && (
                      <button
                        className="w-12 h-12 rounded-md bg-muted border border-border flex items-center justify-center text-xs font-bold text-muted-foreground hover:bg-muted/80"
                        onClick={() => window.open(`/checkin/${campaignId}/${store.id}`, '_blank')}
                      >
                        +{storePhotos.length - 6}
                      </button>
                    )}
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

              {/* Footer - Checkin button */}
              <div className="border-t border-border bg-muted/30 px-4 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs gap-2"
                  onClick={() => window.open(`/checkin/${campaignId}/${store.id}`, '_blank')}
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

      {filteredStores.length === 0 && (
        <p className="text-center text-muted-foreground py-8 text-sm">
          Nenhuma loja com agendamento encontrada
        </p>
      )}

    </div>
  );
};

export default InstallationsTab;
