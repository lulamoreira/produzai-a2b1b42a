import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { AlertTriangle, Wrench, RefreshCw, ClipboardCheck, Check, X, Trash2, Clock, RotateCw, AlertCircle, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { criarNotificacao } from "@/lib/criarNotificacao";
import OccurrenceDetailSheet from "./OccurrenceDetailSheet";

interface CollapsibleCardProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleCard({ title, defaultOpen = false, children }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors">
            <CardTitle className="text-base">{title}</CardTitle>
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface Props {
  campaignId: string;
  clientId: string;
  isAdmin: boolean;
}

/* ── Data hooks ── */

function usePortalOccurrences(campaignId: string) {
  return useQuery({
    queryKey: ["portal-occurrences", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_occurrence_reports")
        .select(`
          id, store_id, loja_a_loja_peca_id, motive_id, reporter_type,
          description, priority, status, photo_urls, created_at, resolved_at,
          expected_resolution_date, needs_reinstallation, resolution_photo_urls,
          tratativa_status, tratativa_notes,
          client_stores(name, city, state),
          loja_a_loja_pecas(nome),
          store_portal_motivos(descricao)
        ` as any)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function usePortalMaintenance(campaignId: string) {
  return useQuery({
    queryKey: ["portal-maintenance", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_maintenance_requests")
        .select("*, client_stores(name, city, state)")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function usePortalReplacements(campaignId: string) {
  return useQuery({
    queryKey: ["portal-replacements", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_replacement_requests")
        .select("*, client_stores(name, city, state), loja_a_loja_pecas(nome)")
        .eq("campaign_id", campaignId)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function usePortalCompliance(campaignId: string) {
  return useQuery({
    queryKey: ["portal-compliance", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_compliance_checks")
        .select("*, client_stores(name, city, state)")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

const BRAND = "#5B7B5E";

const priorityColor: Record<string, string> = {
  critica: "bg-red-600 text-white",
  alta: "bg-orange-500 text-white",
  media: "bg-yellow-500 text-white",
  baixa: "bg-blue-400 text-white",
};

const tratativaColor: Record<string, string> = {
  aberta: "bg-destructive/15 text-destructive",
  em_andamento: "bg-warning/15 text-warning",
  resolvida: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const tratativaLabel: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  resolvida: "Resolvida",
};

const statusColor: Record<string, string> = {
  aberto: "bg-destructive/15 text-destructive",
  em_andamento: "bg-warning/15 text-warning",
  resolvido: "bg-green-100 text-green-700",
  pendente: "bg-warning/15 text-warning",
  aprovada: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  enviada: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  rejeitada: "bg-destructive/15 text-destructive",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function reporterLabel(r: string | null | undefined) {
  if (!r) return "—";
  if (r.startsWith("agencia:")) return r.slice(8);
  if (r.startsWith("cliente:")) return r.slice(8);
  if (r === "lojista") return "Lojista";
  if (r === "fornecedor") return "Fornecedor";
  return r;
}

function daysOpen(createdAt: string, resolvedAt: string | null) {
  const start = new Date(createdAt).getTime();
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}

export default function PortalDashboard({ campaignId, clientId, isAdmin }: Props) {
  const { data: occurrences, isLoading: l1 } = usePortalOccurrences(campaignId);
  const { data: maintenance, isLoading: l2 } = usePortalMaintenance(campaignId);
  const { data: replacements, isLoading: l3 } = usePortalReplacements(campaignId);
  const { data: compliance, isLoading: l4 } = usePortalCompliance(campaignId);
  const qc = useQueryClient();

  const [confirmAction, setConfirmAction] = useState<{ id: string; status: "aprovada" | "rejeitada"; storeId: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; table: "store_occurrence_reports" | "store_maintenance_requests" | "store_replacement_requests"; queryKey: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Occurrence filters & detail sheet
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStore, setFilterStore] = useState<string>("all");
  const [selectedOccurrence, setSelectedOccurrence] = useState<any | null>(null);

  const isLoading = l1 || l2 || l3 || l4;

  /* Occurrence KPIs */
  const occList = (occurrences ?? []) as any[];
  const total = occList.length;
  const abertas = occList.filter((o) => (o.tratativa_status ?? "aberta") === "aberta").length;
  const emAndamento = occList.filter((o) => o.tratativa_status === "em_andamento").length;
  const resolvidas = occList.filter((o) => o.tratativa_status === "resolvida").length;
  const atrasadas = occList.filter((o) =>
    o.expected_resolution_date &&
    new Date(o.expected_resolution_date).getTime() < Date.now() &&
    o.tratativa_status !== "resolvida"
  ).length;
  const reinst = occList.filter((o) => o.needs_reinstallation).length;

  const storeOptions = useMemo(() => {
    const m = new Map<string, string>();
    occList.forEach((o) => {
      const name = (o.client_stores as any)?.name ?? "—";
      m.set(o.store_id, name);
    });
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [occList]);

  const filteredOccurrences = useMemo(() => {
    return occList.filter((o) => {
      if (filterStatus !== "all" && (o.tratativa_status ?? "aberta") !== filterStatus) return false;
      if (filterPriority !== "all" && o.priority !== filterPriority) return false;
      if (filterStore !== "all" && o.store_id !== filterStore) return false;
      return true;
    });
  }, [occList, filterStatus, filterPriority, filterStore]);

  /* Other KPIs */
  const openMaintenance = useMemo(() => (maintenance ?? []).filter((m: any) => ["aberto", "em_andamento"].includes(m.status)).length, [maintenance]);
  const pendingReplacements = useMemo(() => (replacements ?? []).filter((r: any) => r.status === "pendente").length, [replacements]);
  const complianceAvg = useMemo(() => {
    const checks = compliance ?? [];
    if (checks.length === 0) return 0;
    const conforme = checks.filter((c: any) => c.overall_status === "conforme").length;
    return Math.round((conforme / checks.length) * 100);
  }, [compliance]);

  const replacementsByStatus = useMemo(() => {
    const counts: Record<string, number> = { pendente: 0, aprovada: 0, enviada: 0, rejeitada: 0 };
    (replacements ?? []).forEach((r: any) => {
      if (r.status in counts) counts[r.status]++;
    });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, [replacements]);

  const maintenanceByStatus = useMemo(() => {
    const counts: Record<string, number> = { aberto: 0, em_andamento: 0, resolvido: 0 };
    (maintenance ?? []).forEach((m: any) => {
      if (m.status in counts) counts[m.status]++;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts).map(([status, count]) => ({ status, count, pct: (count / total) * 100 }));
  }, [maintenance]);

  const complianceByStore = useMemo(() => {
    const map = new Map<string, { name: string; conforme: number; total: number }>();
    (compliance ?? []).forEach((c: any) => {
      const name = (c.client_stores as any)?.name ?? "Desconhecida";
      const prev = map.get(c.store_id) ?? { name, conforme: 0, total: 0 };
      map.set(c.store_id, {
        name: prev.name,
        conforme: prev.conforme + (c.overall_status === "conforme" ? 1 : 0),
        total: prev.total + 1,
      });
    });
    return Array.from(map.values())
      .map((s) => ({ ...s, pct: Math.round((s.conforme / s.total) * 100) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 10);
  }, [compliance]);

  const pendingList = useMemo(() => (replacements ?? []).filter((r: any) => r.status === "pendente"), [replacements]);

  /* Actions */
  async function handleReplacementAction() {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;

      const { error } = await supabase
        .from("store_replacement_requests")
        .update({
          status: confirmAction.status,
          reviewed_at: new Date().toISOString(),
          reviewed_by_user_id: userId,
        })
        .eq("id", confirmAction.id);
      if (error) throw error;

      toast.success(confirmAction.status === "aprovada" ? "Reposição aprovada" : "Reposição rejeitada");

      try {
        const { data: campaignData } = await supabase
          .from("campaigns")
          .select("client_id, clients(agency_id)")
          .eq("id", campaignId)
          .single();
        const agencyId = (campaignData?.clients as any)?.agency_id;
        if (agencyId) {
          await criarNotificacao({
            agency_id: agencyId,
            campaign_id: campaignId,
            store_id: confirmAction.storeId,
            client_id: clientId,
            type: confirmAction.status === "aprovada" ? "store_replacement_approved" : "store_replacement_rejected",
            title: confirmAction.status === "aprovada" ? "Reposição aprovada" : "Reposição rejeitada",
            body: `Uma solicitação de reposição foi ${confirmAction.status === "aprovada" ? "aprovada" : "rejeitada"}.`,
          });
        }
      } catch {}

      qc.invalidateQueries({ queryKey: ["portal-replacements", campaignId] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from(deleteTarget.table).delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Registro excluído com sucesso");
      qc.invalidateQueries({ queryKey: [deleteTarget.queryKey, campaignId] });
    } catch (e: any) {
      toast.error("Erro ao excluir: " + e.message);
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top KPI Row (overview) — Ocorrências sempre, demais só se > 0 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={AlertTriangle} label="Ocorrências (total)" value={total} color="hsl(var(--destructive))" />
        {openMaintenance > 0 && (
          <KpiCard icon={Wrench} label="Manutenções abertas" value={openMaintenance} color="hsl(var(--warning, 38 92% 50%))" />
        )}
        {pendingReplacements > 0 && (
          <KpiCard icon={RefreshCw} label="Reposições pendentes" value={pendingReplacements} color="hsl(var(--warning, 38 92% 50%))" />
        )}
        {complianceAvg > 0 && (
          <KpiCard icon={ClipboardCheck} label="Conformidade média" value={`${complianceAvg}%`} color={BRAND} />
        )}
      </div>

      {/* OCCURRENCE MANAGEMENT */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Gestão de Ocorrências</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Occurrence sub-KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <MiniKpi label="Total" value={total} icon={AlertCircle} color="text-muted-foreground" />
            <MiniKpi label="Abertas" value={abertas} icon={AlertTriangle} color="text-destructive" />
            <MiniKpi label="Em andamento" value={emAndamento} icon={Clock} color="text-yellow-600" />
            <MiniKpi label="Resolvidas" value={resolvidas} icon={CheckCircle2} color="text-green-600" />
            <MiniKpi label="Atrasadas" value={atrasadas} icon={Clock} color="text-red-600" />
            <MiniKpi label="Precisam reinst." value={reinst} icon={RotateCw} color="text-orange-600" />
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="resolvida">Resolvida</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as prioridades</SelectItem>
                <SelectItem value="critica">Crítica</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStore} onValueChange={setFilterStore}>
              <SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Loja" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as lojas</SelectItem>
                {storeOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Occurrences table */}
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>Peça</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Reportado por</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Previsão</TableHead>
                  <TableHead className="text-center">Dias</TableHead>
                  {isAdmin && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOccurrences.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 10 : 9} className="text-center text-muted-foreground py-6">Nenhuma ocorrência encontrada.</TableCell>
                  </TableRow>
                )}
                {filteredOccurrences.map((o: any) => {
                  const ts = o.tratativa_status ?? "aberta";
                  const overdue = o.expected_resolution_date && new Date(o.expected_resolution_date).getTime() < Date.now() && ts !== "resolvida";
                  return (
                    <TableRow key={o.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelectedOccurrence(o)}>
                      <TableCell className="font-medium">{(o.client_stores as any)?.name ?? "—"}</TableCell>
                      <TableCell>{(o.loja_a_loja_pecas as any)?.nome ?? "—"}</TableCell>
                      <TableCell><span className="line-clamp-1 max-w-[160px]">{(o.store_portal_motivos as any)?.descricao ?? "—"}</span></TableCell>
                      <TableCell className="text-xs">{reporterLabel(o.reporter_type)}</TableCell>
                      <TableCell><Badge className={priorityColor[o.priority] ?? "bg-muted"}>{o.priority}</Badge></TableCell>
                      <TableCell><Badge className={tratativaColor[ts] ?? "bg-muted"}>{tratativaLabel[ts] ?? ts}</Badge></TableCell>
                      <TableCell className="text-xs">{formatDate(o.created_at)}</TableCell>
                      <TableCell className={`text-xs ${overdue ? "text-destructive font-medium" : ""}`}>{formatDate(o.expected_resolution_date)}</TableCell>
                      <TableCell className="text-center text-xs">{daysOpen(o.created_at, o.resolved_at)}</TableCell>
                      {isAdmin && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ id: o.id, table: "store_occurrence_reports", queryKey: "portal-occurrences" })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <CollapsibleCard title="Reposições por Status">
          <div className="space-y-2">
            {replacementsByStatus.map((d) => {
              const maxVal = Math.max(1, ...replacementsByStatus.map((x) => x.count));
              const colors: Record<string, string> = { pendente: "bg-warning", aprovada: "bg-green-500", enviada: "bg-blue-500", rejeitada: "bg-destructive" };
              return (
                <div key={d.status} className="flex items-center gap-2">
                  <span className="w-20 text-sm capitalize text-muted-foreground">{d.status}</span>
                  <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${colors[d.status] ?? "bg-primary"}`} style={{ width: `${(d.count / maxVal) * 100}%` }} />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{d.count}</span>
                </div>
              );
            })}
          </div>
        </CollapsibleCard>

        <CollapsibleCard title="Manutenções por Status">
          <div className="flex gap-1 h-6 rounded-full overflow-hidden mb-3">
            {maintenanceByStatus.map((d) => {
              const colors: Record<string, string> = { aberto: "bg-destructive", em_andamento: "bg-warning", resolvido: "bg-green-500" };
              return d.pct > 0 ? (
                <div key={d.status} className={`${colors[d.status] ?? "bg-muted"} transition-all`} style={{ width: `${d.pct}%` }} title={`${d.status}: ${d.count}`} />
              ) : null;
            })}
          </div>
          <div className="flex gap-4 flex-wrap">
            {maintenanceByStatus.map((d) => {
              const colors: Record<string, string> = { aberto: "bg-destructive", em_andamento: "bg-warning", resolvido: "bg-green-500" };
              return (
                <div key={d.status} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded-sm ${colors[d.status]}`} />
                  <span className="text-xs text-muted-foreground capitalize">{d.status.replace("_", " ")}</span>
                  <span className="text-xs font-medium">{d.count}</span>
                </div>
              );
            })}
          </div>
        </CollapsibleCard>

        <CollapsibleCard title="Conformidade por Loja">
          <div className="space-y-2">
            {complianceByStore.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma verificação registrada</p>}
            {complianceByStore.map((d) => {
              const barColor = d.pct >= 80 ? "bg-green-500" : d.pct >= 50 ? "bg-warning" : "bg-destructive";
              return (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-28 text-sm truncate text-muted-foreground" title={d.name}>{d.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className="text-sm font-medium w-10 text-right">{d.pct}%</span>
                </div>
              );
            })}
          </div>
        </CollapsibleCard>
      </div>

      {/* Pending Replacements Table */}
      {isAdmin && (
        <CollapsibleCard title="Reposições Pendentes de Aprovação">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>Peça</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingList.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma reposição pendente</TableCell></TableRow>
                )}
                {pendingList.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{(r.client_stores as any)?.name ?? "—"}</TableCell>
                    <TableCell>{(r.loja_a_loja_pecas as any)?.nome ?? "—"}</TableCell>
                    <TableCell className="text-center">{r.quantity_requested}</TableCell>
                    <TableCell>
                      <span className="line-clamp-1 max-w-[200px]" title={r.reason}>{r.reason}</span>
                    </TableCell>
                    <TableCell>{formatDate(r.requested_at)}</TableCell>
                    <TableCell className="text-right">
                       <div className="flex gap-1 justify-end">
                         <Button size="sm" variant="ghost" className="h-7 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" onClick={() => setConfirmAction({ id: r.id, status: "aprovada", storeId: r.store_id })}>
                           <Check className="h-4 w-4" />
                         </Button>
                         <Button size="sm" variant="ghost" className="h-7 text-destructive hover:bg-destructive/10" onClick={() => setConfirmAction({ id: r.id, status: "rejeitada", storeId: r.store_id })}>
                           <X className="h-4 w-4" />
                         </Button>
                         <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ id: r.id, table: "store_replacement_requests", queryKey: "portal-replacements" })}>
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleCard>
      )}

      {/* Recent Maintenance */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Manutenções Recentes</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                 <TableRow>
                   <TableHead>Loja</TableHead>
                   <TableHead>Descrição</TableHead>
                   <TableHead>Prioridade</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead>Data</TableHead>
                   {isAdmin && <TableHead className="w-10" />}
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {(maintenance ?? []).slice(0, 10).length === 0 && (
                   <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground">Nenhuma manutenção</TableCell></TableRow>
                 )}
                 {(maintenance ?? []).slice(0, 10).map((m: any) => (
                   <TableRow key={m.id}>
                     <TableCell className="font-medium">{(m.client_stores as any)?.name ?? "—"}</TableCell>
                     <TableCell><span className="line-clamp-1 max-w-[250px]">{m.description}</span></TableCell>
                     <TableCell><Badge className={priorityColor[m.priority] ?? "bg-muted"}>{m.priority}</Badge></TableCell>
                     <TableCell><Badge className={statusColor[m.status] ?? "bg-muted"}>{m.status}</Badge></TableCell>
                     <TableCell>{formatDate(m.created_at)}</TableCell>
                     {isAdmin && (
                       <TableCell>
                         <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ id: m.id, table: "store_maintenance_requests", queryKey: "portal-maintenance" })}>
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </TableCell>
                     )}
                   </TableRow>
                 ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Dialogs */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.status === "aprovada" ? "Aprovar reposição?" : "Rejeitar reposição?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.status === "aprovada"
                ? "A loja será notificada que a reposição foi aprovada."
                : "A loja será notificada que a reposição foi rejeitada."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReplacementAction} disabled={actionLoading}>
              {actionLoading ? "Processando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteLoading ? "Excluindo..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Occurrence Detail Sheet */}
      <OccurrenceDetailSheet
        open={!!selectedOccurrence}
        onOpenChange={(o) => !o && setSelectedOccurrence(null)}
        occurrence={selectedOccurrence}
        isAdmin={isAdmin}
        campaignId={campaignId}
      />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold truncate">{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniKpi({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="border rounded-md p-2.5 flex items-center gap-2 bg-card">
      <Icon className={`w-4 h-4 shrink-0 ${color}`} />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground truncate uppercase tracking-wide">{label}</p>
        <p className="text-base font-bold leading-none">{value}</p>
      </div>
    </div>
  );
}
