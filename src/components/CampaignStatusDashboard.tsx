import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeStoreOccurrences } from "@/hooks/useRealtimeStoreOccurrences";

export type DashboardFilter =
  | { type: "status"; value: "completed" | "pending" }
  | { type: "checkin"; value: "checked" | "unchecked" }
  | { type: "summary"; value: "withPhotos" | "scheduled" };

interface CampaignStatusDashboardProps {
  campaignId: string;
  onNavigate: (section: string, filter?: DashboardFilter) => void;
}

function useCampaignStats(campaignId: string) {
  return useQuery({
    queryKey: ["campaign_stats", campaignId],
    queryFn: async () => {
      const [schedules, lalOccurrencesRes, photosCountRes] = await Promise.all([
        supabasePaginate<{ id: string; store_id: string; completed_at: string | null; checkin_timestamp: string | null; manual_checkin_at: string | null; manual_checkout_at: string | null; scheduled_date: string | null }>(
          (from, to) =>
            supabase
              .from("campaign_schedules")
              .select("id, store_id, completed_at, checkin_timestamp, manual_checkin_at, manual_checkout_at, scheduled_date")
              .eq("campaign_id", campaignId)
              .range(from, to) as any
        ),
        supabase
          .from("store_occurrence_reports")
          .select("id, store_id, tratativa_status")
          .eq("campaign_id", campaignId),
        supabase
          .from("installation_photos")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaignId),
      ]);

      const lalOccurrences = lalOccurrencesRes.data ?? [];
      const photosCount = photosCountRes.count ?? 0;

      // Loja a Loja: open occurrences = tratativa_status != 'resolvida'
      const openLalOccurrences = lalOccurrences.filter(
        (o) => (o.tratativa_status ?? "aberta") !== "resolvida"
      );
      const storesWithOccurrence = new Set(openLalOccurrences.map((o) => o.store_id)).size;

      const completed = schedules.filter((s) => s.completed_at);
      const pending = schedules.filter((s) => !s.completed_at);
      // Check-in counts ANY check-in: GPS (checkin_timestamp), manual check-in OR manual check-out
      const hasAnyCheckin = (s: typeof schedules[number]) =>
        !!(s.checkin_timestamp || s.manual_checkin_at || s.manual_checkout_at);
      const withCheckin = schedules.filter(hasAnyCheckin);
      const withoutCheckin = schedules.filter((s) => !hasAnyCheckin(s));
      const scheduled = schedules.filter((s) => s.scheduled_date);

      return {
        total_lojas: schedules.length,
        instalacoes_concluidas: completed.length,
        instalacoes_pendentes: pending.length,
        lojas_com_ocorrencia: storesWithOccurrence,
        checkins_realizados: withCheckin.length,
        sem_checkin: withoutCheckin.length,
        total_fotos: photos.length,
        agendamentos_confirmados: scheduled.length,
      };
    },
    enabled: !!campaignId,
    refetchInterval: 30000,
  });
}

type KpiColor = "neutral" | "success" | "warning" | "danger";

const colorClasses: Record<KpiColor, { card: string; value: string }> = {
  neutral: { card: "bg-muted/30", value: "text-foreground" },
  success: { card: "bg-emerald-500/10", value: "text-emerald-600 dark:text-emerald-400" },
  warning: { card: "bg-amber-500/10", value: "text-amber-600 dark:text-amber-400" },
  danger: { card: "bg-red-500/10", value: "text-red-600 dark:text-red-400" },
};

export default function CampaignStatusDashboard({
  campaignId,
  onNavigate,
}: CampaignStatusDashboardProps) {
  const { data: stats, isLoading } = useCampaignStats(campaignId);
  useRealtimeStoreOccurrences(campaignId);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
          {Array(8)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-lg" />
            ))}
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    );
  }

  if (!stats || stats.total_lojas === 0) return null;

  const pct = stats.total_lojas > 0
    ? Math.round((stats.instalacoes_concluidas / stats.total_lojas) * 100)
    : 0;

  const kpis: { valor: number; label: string; cor: KpiColor; section: string; filter?: DashboardFilter }[] = [
    {
      valor: stats.total_lojas,
      label: "Lojas total",
      cor: "neutral",
      section: "installations",
    },
    {
      valor: stats.instalacoes_concluidas,
      label: "Concluídas",
      cor: "success",
      section: "installations",
      filter: { type: "status", value: "completed" },
    },
    {
      valor: stats.instalacoes_pendentes,
      label: "Pendentes",
      cor: stats.instalacoes_pendentes > 0 ? "warning" : "neutral",
      section: "installations",
      filter: { type: "status", value: "pending" },
    },
    {
      valor: stats.lojas_com_ocorrencia,
      label: "Com ocorrência",
      cor: stats.lojas_com_ocorrencia > 0 ? "danger" : "neutral",
      section: "occurrences",
    },
    {
      valor: stats.checkins_realizados,
      label: "Com check-in",
      cor: "success",
      section: "installations",
      filter: { type: "checkin", value: "checked" },
    },
    {
      valor: stats.sem_checkin,
      label: "Sem check-in",
      cor: stats.sem_checkin > 0 ? "danger" : "neutral",
      section: "installations",
      filter: { type: "checkin", value: "unchecked" },
    },
    {
      valor: stats.total_fotos,
      label: "Fotos enviadas",
      cor: "neutral",
      section: "installations",
      filter: { type: "summary", value: "withPhotos" },
    },
    {
      valor: stats.agendamentos_confirmados,
      label: "Agendadas",
      cor: "success",
      section: "scheduling",
      filter: { type: "summary", value: "scheduled" },
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">
          Status da Campanha
        </span>
        <span className="text-[11px] text-muted-foreground">
          Atualiza a cada 30s
        </span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        {kpis.map((kpi, i) => {
          const colors = colorClasses[kpi.cor];
          return (
            <button
              key={i}
              onClick={() => onNavigate(kpi.section, kpi.filter)}
              className={`flex flex-col items-start gap-1 p-3 rounded-lg text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${colors.card}`}
            >
              <span className={`text-2xl font-bold leading-none ${colors.value}`}>
                {kpi.valor.toLocaleString("pt-BR")}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                {kpi.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          {pct}% concluída
        </span>
      </div>
    </div>
  );
}
