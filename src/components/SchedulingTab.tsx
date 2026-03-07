import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type ClientStore } from "@/hooks/useMultiClientData";
import { getStateColor } from "@/lib/stateColors";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Search, CalendarIcon, Clock, FileText, Sun, Moon, HelpCircle, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface SchedulingTabProps {
  campaignId: string;
  stores: ClientStore[];
  canEdit: boolean;
}

type Schedule = {
  id: string;
  campaign_id: string;
  store_id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  installation_os: string | null;
  installation_preference: string | null;
};

const PREFERENCE_OPTIONS = [
  { value: "not_informed", label: "Não informado", icon: HelpCircle },
  { value: "morning", label: "Manhã", icon: Sun },
  { value: "night", label: "Noite", icon: Moon },
  { value: "both", label: "Ambos", icon: Sun },
];

const SchedulingTab = ({ campaignId, stores, canEdit }: SchedulingTabProps) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterCity, setFilterCity] = useState("");

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
      scheduled_date?: string | null;
      scheduled_time?: string | null;
      installation_os?: string | null;
      installation_preference?: string | null;
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

  // Derive unique states and cities
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

  // Filter stores
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
    return result.sort((a, b) => (a.state || "").localeCompare(b.state || "") || a.name.localeCompare(b.name));
  }, [stores, filterState, filterCity, searchTerm]);

  const handleFieldChange = (storeId: string, field: string, value: string | null) => {
    const existing = scheduleMap[storeId];
    upsertSchedule.mutate({
      campaign_id: campaignId,
      store_id: storeId,
      scheduled_date: existing?.scheduled_date ?? null,
      scheduled_time: existing?.scheduled_time ?? null,
      installation_os: existing?.installation_os ?? null,
      installation_preference: existing?.installation_preference ?? "not_informed",
      [field]: value,
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
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Agendamento");
    XLSX.writeFile(wb, "agendamento.xlsx");
    toast.success("Planilha exportada!");
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

          return (
            <div
              key={store.id}
              className="rounded-xl border overflow-hidden shadow-sm"
              style={{ borderColor: colors.text, borderWidth: 2 }}
            >
              {/* Header */}
              <div
                className="px-4 py-3 flex items-center gap-3"
                style={{ backgroundColor: colors.bg, color: colors.text }}
              >
                <span className="font-bold text-lg">{store.store_code || "—"}</span>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold truncate text-sm">{store.name}</span>
                  <span className="text-xs opacity-80">{store.state} · {store.city || "—"}</span>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 space-y-3 bg-card">
                {/* Address */}
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Endereço:</span> {buildAddress(store)}
                </div>

                {/* Contact */}
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4">
                  <span><span className="font-medium text-foreground">Contato:</span> {store.manager_name || "—"}</span>
                  <span><span className="font-medium text-foreground">Tel:</span> {store.phone || "—"}</span>
                </div>

                <hr className="border-border" />

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
                          className={cn("w-full justify-start text-left text-xs font-normal h-8", !selectedDate && "text-muted-foreground")}
                        >
                          {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecionar"}
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
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Time */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Horário
                    </label>
                    <Input
                      type="time"
                      disabled={!canEdit}
                      value={schedule?.scheduled_time || ""}
                      onChange={(e) => handleFieldChange(store.id, "scheduled_time", e.target.value || null)}
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* OS */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1">
                      <FileText className="w-3 h-3" /> OS Instalação
                    </label>
                    <Input
                      disabled={!canEdit}
                      placeholder="Nº OS"
                      value={schedule?.installation_os || ""}
                      onChange={(e) => handleFieldChange(store.id, "installation_os", e.target.value || null)}
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
            </div>
          );
        })}
      </div>

      {filteredStores.length === 0 && (
        <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma loja encontrada</p>
      )}
    </div>
  );
};

export default SchedulingTab;
