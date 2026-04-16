import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { AlertTriangle, Wrench, RefreshCw, ClipboardCheck, Check, X } from "lucide-react";
import { toast } from "sonner";
import { criarNotificacao } from "@/lib/criarNotificacao";

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
        .select("*, client_stores(name, city, state)")
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

/* ── Helper ── */
const BRAND = "#5B7B5E";

const priorityColor: Record<string, string> = {
  alta: "bg-destructive/15 text-destructive",
  media: "bg-warning/15 text-warning",
  baixa: "bg-muted text-muted-foreground",
};

const statusColor: Record<string, string> = {
  aberto: "bg-destructive/15 text-destructive",
  em_andamento: "bg-warning/15 text-warning",
  resolvido: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pendente: "bg-warning/15 text-warning",
  aprovada: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  enviada: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  rejeitada: "bg-destructive/15 text-destructive",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

/* ── Main Component ── */

export default function PortalDashboard({ campaignId, clientId, isAdmin }: Props) {
  const { data: occurrences, isLoading: l1 } = usePortalOccurrences(campaignId);
  const { data: maintenance, isLoading: l2 } = usePortalMaintenance(campaignId);
  const { data: replacements, isLoading: l3 } = usePortalReplacements(campaignId);
  const { data: compliance, isLoading: l4 } = usePortalCompliance(campaignId);
  const qc = useQueryClient();

  const [confirmAction, setConfirmAction] = useState<{ id: string; status: "aprovada" | "rejeitada"; storeId: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isLoading = l1 || l2 || l3 || l4;

  /* KPIs */
  const openOccurrences = useMemo(() => (occurrences ?? []).filter((o: any) => o.status !== "resolvido").length, [occurrences]);
  const openMaintenance = useMemo(() => (maintenance ?? []).filter((m: any) => ["aberto", "em_andamento"].includes(m.status)).length, [maintenance]);
  const pendingReplacements = useMemo(() => (replacements ?? []).filter((r: any) => r.status === "pendente").length, [replacements]);
  const complianceAvg = useMemo(() => {
    const checks = compliance ?? [];
    if (checks.length === 0) return 0;
    const conforme = checks.filter((c: any) => c.overall_status === "conforme").length;
    return Math.round((conforme / checks.length) * 100);
  }, [compliance]);

  /* Charts data */
  const occByStore = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    (occurrences ?? []).filter((o: any) => o.status !== "resolvido").forEach((o: any) => {
      const name = (o.client_stores as any)?.name ?? "Desconhecida";
      const prev = map.get(o.store_id) ?? { name, count: 0 };
      map.set(o.store_id, { name: prev.name, count: prev.count + 1 });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [occurrences]);

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

  /* Pending replacements table */
  const pendingList = useMemo(() => (replacements ?? []).filter((r: any) => r.status === "pendente"), [replacements]);

  /* Action handlers */
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

      // Fire notification (silent)
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
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={AlertTriangle} label="Ocorrências abertas" value={openOccurrences} color="hsl(var(--destructive))" />
        <KpiCard icon={Wrench} label="Manutenções abertas" value={openMaintenance} color="hsl(var(--warning, 38 92% 50%))" />
        <KpiCard icon={RefreshCw} label="Reposições pendentes" value={pendingReplacements} color="hsl(var(--warning, 38 92% 50%))" />
        <KpiCard icon={ClipboardCheck} label="Conformidade média" value={`${complianceAvg}%`} color={BRAND} />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Occurrences by store */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Ocorrências por Loja (top 10)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {occByStore.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma ocorrência aberta</p>}
            {occByStore.map((d) => {
              const maxVal = Math.max(1, ...occByStore.map((x) => x.count));
              return (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-28 text-sm truncate text-muted-foreground" title={d.name}>{d.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                    <div className="h-full rounded-full bg-destructive/70 transition-all" style={{ width: `${(d.count / maxVal) * 100}%` }} />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{d.count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Replacements by status */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Reposições por Status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
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
          </CardContent>
        </Card>

        {/* Maintenance by status */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Manutenções por Status</CardTitle></CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Compliance by store */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Conformidade por Loja</CardTitle></CardHeader>
          <CardContent className="space-y-2">
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
          </CardContent>
        </Card>
      </div>

      {/* Pending Replacements Table */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reposições Pendentes de Aprovação</CardTitle>
          </CardHeader>
          <CardContent>
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
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Occurrences */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Ocorrências Recentes</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Foto</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(occurrences ?? []).slice(0, 10).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma ocorrência</TableCell></TableRow>
                )}
                {(occurrences ?? []).slice(0, 10).map((o: any) => {
                  const photos: string[] = Array.isArray(o.photo_urls) ? o.photo_urls : [];
                  return (
                  <TableRow key={o.id}>
                    <TableCell>
                      {photos.length > 0 ? (
                        <img src={photos[0]} alt="" className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{(o.client_stores as any)?.name ?? "—"}</TableCell>
                    <TableCell><span className="line-clamp-1 max-w-[250px]">{o.description}</span></TableCell>
                    <TableCell><Badge className={priorityColor[o.priority] ?? "bg-muted"}>{o.priority}</Badge></TableCell>
                    <TableCell><Badge className={statusColor[o.status] ?? "bg-muted"}>{o.status}</Badge></TableCell>
                    <TableCell>{formatDate(o.created_at)}</TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {(maintenance ?? []).slice(0, 10).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma manutenção</TableCell></TableRow>
                )}
                {(maintenance ?? []).slice(0, 10).map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{(m.client_stores as any)?.name ?? "—"}</TableCell>
                    <TableCell><span className="line-clamp-1 max-w-[250px]">{m.description}</span></TableCell>
                    <TableCell><Badge className={priorityColor[m.priority] ?? "bg-muted"}>{m.priority}</Badge></TableCell>
                    <TableCell><Badge className={statusColor[m.status] ?? "bg-muted"}>{m.status}</Badge></TableCell>
                    <TableCell>{formatDate(m.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
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
    </div>
  );
}

/* ── KPI Card ── */
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
