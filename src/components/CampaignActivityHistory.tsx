import { useState, useMemo } from "react";
import { useCampaignActivityLog, type CampaignActivity } from "@/hooks/useCampaignActivityLog";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle, MapPin, Camera, Check, X, AlertTriangle,
  Calendar, RefreshCw, Key, Send, Lock, Unlock, Circle, Search,
} from "lucide-react";

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  instalacao_concluida:        { icon: <CheckCircle size={14} />, color: "success" },
  instalacao_concluida_manual: { icon: <CheckCircle size={14} />, color: "success" },
  checkin_realizado:           { icon: <MapPin size={14} />,      color: "info" },
  foto_enviada:                { icon: <Camera size={14} />,      color: "neutral" },
  aprovacao_lojista:           { icon: <Check size={14} />,       color: "success" },
  aprovacao_equipe:            { icon: <Check size={14} />,       color: "success" },
  recusa_lojista:              { icon: <X size={14} />,           color: "danger" },
  recusa_equipe:               { icon: <X size={14} />,           color: "danger" },
  ocorrencia_aberta:           { icon: <AlertTriangle size={14} />, color: "danger" },
  ocorrencia_resolvida:        { icon: <CheckCircle size={14} />, color: "success" },
  agendamento_criado:          { icon: <Calendar size={14} />,    color: "info" },
  agendamento_alterado:        { icon: <RefreshCw size={14} />,   color: "warning" },
  codigo_gerado:               { icon: <Key size={14} />,         color: "neutral" },
  codigo_enviado:              { icon: <Send size={14} />,        color: "neutral" },
  loja_bloqueada:              { icon: <Lock size={14} />,        color: "warning" },
  loja_desbloqueada:           { icon: <Unlock size={14} />,      color: "success" },
};

const ACTION_GROUPS: Record<string, string[]> = {
  "Conclusões": ["instalacao_concluida", "instalacao_concluida_manual"],
  "Check-ins": ["checkin_realizado"],
  "Fotos": ["foto_enviada"],
  "Aprovações": ["aprovacao_lojista", "aprovacao_equipe", "recusa_lojista", "recusa_equipe"],
  "Ocorrências": ["ocorrencia_aberta", "ocorrencia_resolvida"],
  "Agendamentos": ["agendamento_criado", "agendamento_alterado"],
  "Códigos": ["codigo_gerado", "codigo_enviado"],
  "Bloqueios": ["loja_bloqueada", "loja_desbloqueada"],
};

const iconColorClasses: Record<string, string> = {
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  danger:  "bg-red-500/10 text-red-600 dark:text-red-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  info:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  neutral: "bg-muted text-muted-foreground",
};

function groupByDate(activities: CampaignActivity[]): { label: string; items: CampaignActivity[] }[] {
  const groups: Record<string, CampaignActivity[]> = {};
  for (const a of activities) {
    const date = parseISO(a.created_at);
    let label: string;
    if (isToday(date)) {
      label = `Hoje — ${format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
    } else if (isYesterday(date)) {
      label = `Ontem — ${format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
    } else {
      label = format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    }
    if (!groups[label]) groups[label] = [];
    groups[label].push(a);
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

interface Props {
  campaignId: string;
}

export default function CampaignActivityHistory({ campaignId }: Props) {
  const [actionFilter, setActionFilter] = useState<string>("__all__");
  const [actorTypeFilter, setActorTypeFilter] = useState<string>("__all__");
  const [storeSearch, setStoreSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filters = useMemo(() => ({
    action: actionFilter !== "__all__" ? actionFilter : undefined,
    actorType: actorTypeFilter !== "__all__" ? actorTypeFilter : undefined,
    storeSearch: storeSearch || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [actionFilter, actorTypeFilter, storeSearch, dateFrom, dateTo]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useCampaignActivityLog(campaignId, filters);

  const allActivities = useMemo(() =>
    data?.pages.flatMap(p => p) ?? [], [data]);

  const grouped = useMemo(() => groupByDate(allActivities), [allActivities]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[170px] h-8 text-xs">
            <SelectValue placeholder="Todas as ações" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as ações</SelectItem>
            {Object.entries(ACTION_GROUPS).map(([group, actions]) => (
              actions.map(a => (
                <SelectItem key={a} value={a}>
                  {group}: {a.replace(/_/g, " ")}
                </SelectItem>
              ))
            ))}
          </SelectContent>
        </Select>

        <Select value={actorTypeFilter} onValueChange={setActorTypeFilter}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os tipos</SelectItem>
            <SelectItem value="user">Usuário</SelectItem>
            <SelectItem value="installer">Instalador</SelectItem>
            <SelectItem value="system">Sistema</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar loja..."
            value={storeSearch}
            onChange={e => setStoreSearch(e.target.value)}
            className="pl-7 h-8 text-xs w-[160px]"
          />
        </div>

        <Input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="h-8 text-xs w-[130px]"
          placeholder="Data de"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="h-8 text-xs w-[130px]"
          placeholder="Data até"
        />

        {(actionFilter !== "__all__" || actorTypeFilter !== "__all__" || storeSearch || dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
               setActionFilter("__all__");
               setActorTypeFilter("__all__");
              setStoreSearch("");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : allActivities.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Nenhuma atividade registrada.
        </div>
      ) : (
        <div className="space-y-0">
          {grouped.map((group) => (
            <div key={group.label}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3 border-b border-border mb-1">
                {group.label}
              </div>
              {group.items.map((activity) => {
                const config = ACTION_CONFIG[activity.action] ?? { icon: <Circle size={14} />, color: "neutral" };
                return (
                  <div key={activity.id} className="flex items-start gap-2.5 py-2.5 border-b border-border/50 last:border-b-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${iconColorClasses[config.color]}`}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-foreground leading-relaxed">
                        {activity.description || activity.action.replace(/_/g, " ")}
                      </p>
                      {activity.actor_name && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          por {activity.actor_name}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap pt-0.5">
                      {format(parseISO(activity.created_at), "HH:mm")}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}

          {hasNextPage && (
            <div className="pt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Carregando..." : "Carregar mais"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
