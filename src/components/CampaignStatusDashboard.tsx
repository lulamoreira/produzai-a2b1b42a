import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface CampaignStatusDashboardProps {
  campaignId: string;
  onNavigate: (section: string) => void;
}

function useCampaignStats(campaignId: string) {
  return useQuery({
    queryKey: ["campaign_stats", campaignId],
    queryFn: async () => {
      const [schedulesRes, occurrencesRes, photosRes] = await Promise.all([
        supabase
          .from("campaign_schedules")
          .select("id, completed_at, checkin_timestamp, scheduled_date")
          .eq("campaign_id", campaignId),
        supabase
          .from("occurrences")
          .select("id, store_id, status")
          .eq("campaign_id", campaignId),
        supabase
          .from("installation_photos")
          .select("id")
          .eq("campaign_id", campaignId),
      ]);

      const schedules = schedulesRes.data ?? [];
      const occurrences = occurrencesRes.data ?? [];
      const photos = photosRes.data ?? [];

      const openOccurrences = occurrences.filter(
        (o) => o.status !== "resolved" && o.status !== "nao_procede"
      );
      const storesWithOccurrence = new Set(openOccurrences.map((o) => o.store_id)).size;

      const completed = schedules.filter((s) => s.completed_at);
      const pending = schedules.filter((s) => !s.completed_at);
      const withCheckin = schedules.filter((s) => s.checkin_timestamp);
      const withoutCheckin = schedules.filter((s) => !s.checkin_timestamp);
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

  const kpis: { valor: number; label: string; cor: KpiColor; section: string }[] = [
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
    },
    {
      valor: stats.instalacoes_pendentes,
      label: "Pendentes",
      cor: stats.instalacoes_pendentes > 0 ? "warning" : "neutral",
      section: "installations",
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
    },
    {
      valor: stats.sem_checkin,
      label: "Sem check-in",
      cor: stats.sem_checkin > 0 ? "danger" : "neutral",
      section: "installations",
    },
    {
      valor: stats.total_fotos,
      label: "Fotos enviadas",
      cor: "neutral",
      section: "installations",
    },
    {
      valor: stats.agendamentos_confirmados,
      label: "Agendadas",
      cor: "success",
      section: "scheduling",
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
              onClick={() => onNavigate(kpi.section)}
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
