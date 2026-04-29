import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CalendarIcon, ChevronDown, ChevronRight, Download, Search, Store as StoreIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import OccurrenceDetailSheet from "./OccurrenceDetailSheet";
import { useRealtimeStoreOccurrences } from "@/hooks/useRealtimeStoreOccurrences";

interface SubAreaPermission { canView: boolean; canEdit: boolean; canDelete: boolean }
interface Props {
  campaignId: string;
  clientId: string;
  permissions: SubAreaPermission;
}

function useOccurrencesByStore(campaignId: string) {
  return useQuery({
    queryKey: ["portal-occurrences-by-store", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_occurrence_reports")
        .select(`
          id, store_id, loja_a_loja_peca_id, motive_id, reporter_type,
          description, priority, status, photo_urls, created_at, resolved_at,
          expected_resolution_date, needs_reinstallation, resolution_photo_urls,
          reinstallation_scheduled_at, reinstallation_os,
          tratativa_status, tratativa_notes,
          client_stores(name, city, state),
          loja_a_loja_pecas(nome, image_url, loja_a_loja_tipos(letra, nome), loja_a_loja_subdivisoes(nome)),
          store_portal_motivos(descricao)
        ` as any)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

const tratativaColor: Record<string, string> = {
  aberta: "bg-destructive/15 text-destructive",
  em_andamento: "bg-warning/15 text-warning",
  resolvida: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const tratativaLabel: Record<string, string> = {
  aberta: "Pendente",
  em_andamento: "Em andamento",
  resolvida: "Resolvida",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

export default function OccurrencesByStoreTab({ campaignId, permissions }: Props) {
  const { data, isLoading } = useOccurrencesByStore(campaignId);

  const [filterStore, setFilterStore] = useState<string>("__all__");
  const [filterMotive, setFilterMotive] = useState<string>("__all__");
  const [filterStatus, setFilterStatus] = useState<string>("__all__");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [selectedOccurrence, setSelectedOccurrence] = useState<any | null>(null);
  const [openStores, setOpenStores] = useState<Record<string, boolean>>({});

  const occList = data ?? [];

  const storeOptions = useMemo(() => {
    const m = new Map<string, string>();
    occList.forEach((o) => m.set(o.store_id, (o.client_stores as any)?.name ?? "—"));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [occList]);

  const motiveOptions = useMemo(() => {
    const m = new Map<string, string>();
    occList.forEach((o) => {
      if (o.motive_id) m.set(o.motive_id, (o.store_portal_motivos as any)?.descricao ?? "—");
    });
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [occList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = occList.filter((o) => {
      if (filterStore !== "__all__" && o.store_id !== filterStore) return false;
      if (filterMotive !== "__all__" && o.motive_id !== filterMotive) return false;
      const st = o.tratativa_status ?? "aberta";
      if (filterStatus !== "__all__" && st !== filterStatus) return false;
      if (dateFrom && new Date(o.created_at) < dateFrom) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(o.created_at) > end) return false;
      }
      if (q) {
        const hay = [
          (o.client_stores as any)?.name,
          (o.loja_a_loja_pecas as any)?.nome,
          (o.store_portal_motivos as any)?.descricao,
          o.description,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    result.sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortOrder === "desc" ? tb - ta : ta - tb;
    });
    return result;
  }, [occList, filterStore, filterMotive, filterStatus, dateFrom, dateTo, search, sortOrder]);

  const grouped = useMemo(() => {
    const map = new Map<string, { storeId: string; storeName: string; city: string; state: string; items: any[] }>();
    filtered.forEach((o) => {
      const cs = (o.client_stores as any) ?? {};
      const key = o.store_id;
      const prev = map.get(key) ?? {
        storeId: o.store_id,
        storeName: cs.name ?? "—",
        city: cs.city ?? "",
        state: cs.state ?? "",
        items: [],
      };
      prev.items.push(o);
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => a.storeName.localeCompare(b.storeName, "pt-BR"));
  }, [filtered]);

  const totalOcorrencias = filtered.length;
  const totalLojas = grouped.length;
  const totalPendentes = filtered.filter((o) => (o.tratativa_status ?? "aberta") === "aberta").length;
  const totalAndamento = filtered.filter((o) => o.tratativa_status === "em_andamento").length;
  const totalResolvidas = filtered.filter((o) => o.tratativa_status === "resolvida").length;

  const clearFilters = () => {
    setFilterStore("__all__");
    setFilterMotive("__all__");
    setFilterStatus("__all__");
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearch("");
  };

  const hasActiveFilters =
    filterStore !== "__all__" ||
    filterMotive !== "__all__" ||
    filterStatus !== "__all__" ||
    dateFrom ||
    dateTo ||
    search.trim() !== "";

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    grouped.forEach((g) => (next[g.storeId] = true));
    setOpenStores(next);
  };
  const collapseAll = () => setOpenStores({});

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("Nenhuma ocorrência para exportar");
      return;
    }
    try {
      const rows = filtered.map((o) => ({
        Loja: (o.client_stores as any)?.name ?? "—",
        Cidade: (o.client_stores as any)?.city ?? "",
        UF: (o.client_stores as any)?.state ?? "",
        Peça: (o.loja_a_loja_pecas as any)?.nome ?? "—",
        Motivo: (o.store_portal_motivos as any)?.descricao ?? "—",
        Status: tratativaLabel[o.tratativa_status ?? "aberta"] ?? o.tratativa_status,
        Prioridade: o.priority ?? "",
        "Aberta em": formatDate(o.created_at),
        "Prev. resolução": formatDate(o.expected_resolution_date),
        "Resolvida em": formatDate(o.resolved_at),
        Descrição: o.description ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ocorrências por Loja");

      // Resumo por loja
      const summary = grouped.map((g) => ({
        Loja: g.storeName,
        Cidade: g.city,
        UF: g.state,
        Total: g.items.length,
        Pendentes: g.items.filter((o) => (o.tratativa_status ?? "aberta") === "aberta").length,
        "Em andamento": g.items.filter((o) => o.tratativa_status === "em_andamento").length,
        Resolvidas: g.items.filter((o) => o.tratativa_status === "resolvida").length,
      }));
      const ws2 = XLSX.utils.json_to_sheet(summary);
      XLSX.utils.book_append_sheet(wb, ws2, "Resumo por Loja");

      // Resumo por motivo (contagem desc)
      const motiveCounts = new Map<string, number>();
      filtered.forEach((o) => {
        const desc = (o.store_portal_motivos as any)?.descricao ?? "Sem motivo";
        motiveCounts.set(desc, (motiveCounts.get(desc) ?? 0) + 1);
      });
      const motiveSummary = Array.from(motiveCounts.entries())
        .map(([Motivo, Total]) => ({ Motivo, Total }))
        .sort((a, b) => b.Total - a.Total);
      const ws3 = XLSX.utils.json_to_sheet(motiveSummary);
      XLSX.utils.book_append_sheet(wb, ws3, "Resumo por Motivo");

      const fileName = `ocorrencias-por-loja-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Excel exportado");
    } catch (e: any) {
      toast.error("Erro ao exportar: " + (e?.message ?? "desconhecido"));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiMini label="Lojas" value={totalLojas} />
        <KpiMini label="Ocorrências" value={totalOcorrencias} />
        <KpiMini label="Pendentes" value={totalPendentes} tone="destructive" />
        <KpiMini label="Resolvidas" value={totalResolvidas} tone="success" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Loja</label>
              <Select value={filterStore} onValueChange={setFilterStore}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as lojas</SelectItem>
                  {storeOptions.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Motivo</label>
              <Select value={filterMotive} onValueChange={setFilterMotive}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os motivos</SelectItem>
                  {motiveOptions.map(([id, desc]) => (
                    <SelectItem key={id} value={id}>{desc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os status</SelectItem>
                  <SelectItem value="aberta">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="resolvida">Resolvida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Período</label>
              <div className="flex gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal text-xs", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {dateFrom ? format(dateFrom, "dd/MM/yy") : "De"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal text-xs", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {dateTo ? format(dateTo, "dd/MM/yy") : "Até"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por loja, peça, motivo ou descrição..."
                className="pl-8"
              />
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "desc" | "asc")}>
                <SelectTrigger className="h-9 w-[170px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Mais recentes primeiro</SelectItem>
                  <SelectItem value="asc">Mais antigas primeiro</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" /> Limpar
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={expandAll}>Expandir</Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>Recolher</Button>
              <Button size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grouped by store */}
      {grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma ocorrência encontrada com os filtros aplicados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {grouped.map((g) => {
            const open = !!openStores[g.storeId];
            const pend = g.items.filter((o) => (o.tratativa_status ?? "aberta") === "aberta").length;
            const andamento = g.items.filter((o) => o.tratativa_status === "em_andamento").length;
            const resolv = g.items.filter((o) => o.tratativa_status === "resolvida").length;
            return (
              <Card key={g.storeId}>
                <Collapsible open={open} onOpenChange={(v) => setOpenStores((s) => ({ ...s, [g.storeId]: v }))}>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <StoreIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{g.storeName}</div>
                          {(g.city || g.state) && (
                            <div className="text-xs text-muted-foreground truncate">
                              {[g.city, g.state].filter(Boolean).join(" / ")}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        <Badge variant="secondary" className="text-xs">{g.items.length} total</Badge>
                        {pend > 0 && <Badge className={cn("text-xs", tratativaColor.aberta)}>{pend} pend.</Badge>}
                        {andamento > 0 && <Badge className={cn("text-xs", tratativaColor.em_andamento)}>{andamento} and.</Badge>}
                        {resolv > 0 && <Badge className={cn("text-xs", tratativaColor.resolvida)}>{resolv} res.</Badge>}
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t divide-y">
                      {g.items.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setSelectedOccurrence(o)}
                          className="w-full text-left px-4 py-2.5 hover:bg-muted/30 transition-colors flex items-start gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">
                                {(o.loja_a_loja_pecas as any)?.nome ?? "Peça —"}
                              </span>
                              <Badge className={cn("text-xs", tratativaColor[o.tratativa_status ?? "aberta"])}>
                                {tratativaLabel[o.tratativa_status ?? "aberta"]}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {(o.store_portal_motivos as any)?.descricao ?? "Sem motivo"}
                              {o.description ? ` • ${o.description}` : ""}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground shrink-0 text-right">
                            <div>{formatDate(o.created_at)}</div>
                            {o.expected_resolution_date && (
                              <div className="mt-0.5">prev: {formatDate(o.expected_resolution_date)}</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      <OccurrenceDetailSheet
        occurrence={selectedOccurrence}
        open={!!selectedOccurrence}
        onOpenChange={(open) => !open && setSelectedOccurrence(null)}
        campaignId={campaignId}
        canEdit={permissions.canEdit}
        canDelete={permissions.canDelete}
      />
    </div>
  );
}

function KpiMini({ label, value, tone }: { label: string; value: number | string; tone?: "destructive" | "success" }) {
  const color =
    tone === "destructive" ? "text-destructive" :
    tone === "success" ? "text-green-600 dark:text-green-400" :
    "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn("text-2xl font-semibold mt-0.5", color)}>{value}</div>
      </CardContent>
    </Card>
  );
}
