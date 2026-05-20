import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { 
  Megaphone, 
  Store, 
  Package, 
  Wrench, 
  ArrowRight,
  ChevronRight,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { useLanguage } from "@/hooks/useLanguage";

// Custom hook to mimic useFormatters() if not available or for better control
const useFormatters = () => {
  const { language } = useLanguage();
  const locale = language === "pt-BR" ? ptBR : language === "es" ? es : enUS;

  return {
    custom: (date: Date, pattern: string) => format(date, pattern, { locale }),
    dateShort: (date: Date) => format(date, "dd/MM/yy", { locale }),
    relative: (date: Date) => {
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(mins / 60);
      const days = Math.floor(hours / 24);

      if (mins < 1) return "agora";
      if (mins < 60) return `${mins}m`;
      if (hours < 24) return `${hours}h`;
      return `${days}d`;
    }
  };
};

export function HomeV2() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const formatters = useFormatters();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return t("homeV2.greeting.morning");
    if (hour >= 12 && hour < 18) return t("homeV2.greeting.afternoon");
    return t("homeV2.greeting.evening");
  };

  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ["v2-dashboard-kpis"],
    queryFn: async () => {
      const [
        { count: activeCampaigns },
        { count: storesCount },
        { count: piecesCount },
        { count: pendingInstallations }
      ] = await Promise.all([
        supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("stores").select("*", { count: "exact", head: true }),
        supabase.from("pieces").select("*", { count: "exact", head: true }),
        supabase.from("installations").select("*", { count: "exact", head: true }).eq("status", "pending")
      ]);

      return {
        activeCampaigns: activeCampaigns || 0,
        storesCount: storesCount || 0,
        piecesCount: piecesCount || 0,
        pendingInstallations: pendingInstallations || 0
      };
    }
  });

  const { data: recentCampaigns, isLoading: loadingCampaigns } = useQuery({
    queryKey: ["v2-recent-campaigns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select(`
          id, 
          name, 
          status, 
          created_at,
          clients (name),
          campaign_pieces (count),
          campaign_stores (count)
        `)
        .order("created_at", { ascending: false })
        .limit(6);
      return data || [];
    }
  });

  const { data: recentActivity, isLoading: loadingActivity } = useQuery({
    queryKey: ["v2-recent-activity"],
    queryFn: async () => {
      // Combining results from different tables to simulate an activity feed
      const [campaigns, installations, occurrences] = await Promise.all([
        supabase.from("campaigns").select("id, name, updated_at").order("updated_at", { ascending: false }).limit(4),
        supabase.from("installations").select("id, status, updated_at, stores(name)").order("updated_at", { ascending: false }).limit(4),
        supabase.from("occurrences").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(4)
      ]);

      const activities = [
        ...(campaigns.data || []).map(item => ({
          id: `camp-${item.id}`,
          type: "campaign",
          title: item.name,
          description: "Campanha atualizada",
          time: new Date(item.updated_at),
          icon: Megaphone
        })),
        ...(installations.data || []).map(item => ({
          id: `inst-${item.id}`,
          type: "installation",
          title: (item as any).stores?.name || "Instalação",
          description: `Instalação ${item.status}`,
          time: new Date(item.updated_at),
          icon: Wrench
        })),
        ...(occurrences.data || []).map(item => ({
          id: `occ-${item.id}`,
          type: "occurrence",
          title: item.title,
          description: "Nova ocorrência registrada",
          time: new Date(item.updated_at),
          icon: Package
        }))
      ];

      return activities.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 8);
    }
  });

  const userName = user?.email?.split("@")[0] || "Usuário";

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Greeting Section */}
      <section>
        <h2 className="text-2xl font-semibold text-stone-800 dark:text-stone-100">
          {getGreeting()}, {userName}
        </h2>
        <p className="text-sm text-stone-500 mt-0.5">
          {formatters.custom(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy")}
        </p>
      </section>

      {/* KPI Section */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {[
          { label: t("homeV2.kpis.activeCampaigns"), value: kpis?.activeCampaigns, icon: Megaphone, color: "text-brand-400" },
          { label: t("homeV2.kpis.stores"), value: kpis?.storesCount, icon: Store, color: "text-stone-600" },
          { label: t("homeV2.kpis.piecesInProduction"), value: kpis?.piecesCount, icon: Package, color: "text-amber-600" },
          { label: t("homeV2.kpis.pendingInstallations"), value: kpis?.pendingInstallations, icon: Wrench, color: "text-rose-500" },
        ].map((card, idx) => (
          <Card key={idx} className="bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 p-4 shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-medium text-stone-500 uppercase tracking-wider">
                {card.label}
              </span>
              <card.icon className={cn("w-4 h-4", card.color)} />
            </div>
            {loadingKpis ? (
              <div className="h-9 w-16 bg-stone-100 dark:bg-stone-800 animate-pulse rounded mt-2" />
            ) : (
              <div className="text-3xl font-bold text-stone-800 dark:text-stone-100 mt-2">
                {card.value}
              </div>
            )}
            <div className="text-[10px] text-stone-400 mt-1">
              {t("homeV2.kpis.updatedNow")}
            </div>
          </Card>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        {/* Recent Campaigns Section */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-stone-700 dark:text-stone-200">
              {t("homeV2.recentCampaigns.title")}
            </h3>
            <button 
              onClick={() => navigate("/agencies")}
              className="text-sm text-brand-400 hover:text-brand-500 flex items-center gap-1 font-medium"
            >
              {t("homeV2.recentCampaigns.viewAll")} <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loadingCampaigns ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="h-32 bg-stone-100 dark:bg-stone-800 animate-pulse rounded-xl" />
              ))
            ) : (
              recentCampaigns?.map((camp) => (
                <Card 
                  key={camp.id}
                  className="bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 p-4 hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => navigate(`/agency/default/clients/default/campaigns/${camp.id}`)}
                >
                  <div className="flex justify-between items-center mb-2">
                    <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                      {camp.status}
                    </Badge>
                    <span className="text-[10px] text-stone-400">
                      {formatters.dateShort(new Date(camp.created_at))}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate group-hover:text-brand-400 transition-colors">
                    {camp.name}
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5 truncate">
                    {(camp as any).clients?.name || "Cliente"}
                  </p>
                  <div className="border-t border-stone-100 dark:border-stone-800 mt-3 pt-3 flex justify-between items-center text-[10px] text-stone-500">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" /> {(camp as any).campaign_pieces?.[0]?.count || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Store className="w-3 h-3" /> {(camp as any).campaign_stores?.[0]?.count || 0}
                      </span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-stone-300" />
                  </div>
                </Card>
              ))
            )}
          </div>
        </section>

        {/* Recent Activity Section */}
        <section>
          <h3 className="text-base font-semibold text-stone-700 dark:text-stone-200 mb-4">
            {t("homeV2.recentActivity.title")}
          </h3>
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden shadow-sm">
            <div className="divide-y divide-stone-100 dark:divide-stone-800">
              {loadingActivity ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="p-4 h-14 bg-stone-50 dark:bg-stone-800/50 animate-pulse" />
                ))
              ) : (
                recentActivity?.map((activity) => (
                  <div key={activity.id} className="flex gap-3 p-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center flex-shrink-0">
                      <activity.icon className="w-4 h-4 text-stone-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-700 dark:text-stone-300 truncate font-medium">
                        {activity.title}
                      </p>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-stone-500">
                          {activity.description}
                        </span>
                        <span className="text-[10px] text-stone-400 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> {formatters.relative(activity.time)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
