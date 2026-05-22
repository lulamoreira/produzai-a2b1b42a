import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useDisplayName } from "@/components/AppHeader";
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
  Clock,
  Inbox,
  User as UserIcon,
  Calendar as CalendarIcon,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useFormatters } from "@/lib/formatters";
import { SkeletonCard } from "@/components/v2/ui/SkeletonCard";
import { EmptyStateV2 } from "@/components/v2/ui/EmptyStateV2";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function HomeV2() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { displayName } = useDisplayName();
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
        activeCampaignsRes,
        storesCountRes,
        piecesCountRes,
        pendingInstallationsRes
      ] = await Promise.all([
        supabase.from("campaigns").select("id", { count: "exact", head: true }),
        supabase.from("stores").select("id", { count: "exact", head: true }),
        supabase.from("pieces").select("id", { count: "exact", head: true }),
        supabase.from("campaign_schedules").select("id", { count: "exact", head: true }).is("completed_at", null)
      ]);

      return {
        activeCampaigns: activeCampaignsRes.count || 0,
        storesCount: storesCountRes.count || 0,
        piecesCount: piecesCountRes.count || 0,
        pendingInstallations: pendingInstallationsRes.count || 0
      };
    }
  });

  const { data: recentCampaigns, isLoading: loadingCampaigns } = useQuery({
    queryKey: ["v2-recent-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select(`
          id, 
          name, 
          created_at,
          client_id,
          clients (name)
        `)
        .order("created_at", { ascending: false })
        .limit(6);
      
      if (error) {
        console.error("Error fetching recent campaigns:", error);
        return [];
      }
      
      return data || [];
    }
  });

  const { data: recentActivity, isLoading: loadingActivity } = useQuery({
    queryKey: ["v2-recent-activity"],
    queryFn: async () => {
      const [activityLogRes, occurrencesRes, campaignsRes] = await Promise.all([
        supabase.from("campaign_activity_log")
          .select("*, campaigns(name, client_id, clients(name)), client_stores(name)")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.from("occurrences")
          .select("*, campaigns(name, client_id, clients(name)), client_stores(name)")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("campaigns")
          .select("*, clients(name)")
          .order("created_at", { ascending: false })
          .limit(5)
      ]);

      // Get user profiles for activity log actors
      const userIds = [...new Set((activityLogRes.data || []).map(item => item.user_id).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        
        profiles?.forEach(p => {
          profileMap[p.user_id] = p.display_name;
        });
      }

      const activities: any[] = [];

      // Add activity log items
      (activityLogRes.data || []).forEach((item: any) => {
        const actorName = item.actor_name || profileMap[item.user_id] || t("common.user");
        let icon = Wrench;
        if (item.action?.includes("concluida")) icon = Package;
        if (item.action?.includes("foto")) icon = Megaphone; // Or an Image icon if available
        if (item.action?.includes("agendamento")) icon = CalendarIcon;

        activities.push({
          id: `log-${item.id}`,
          type: "activity",
          title: item.client_stores?.name || item.campaigns?.name || t("common.activity"),
          description: item.description || item.action,
          time: new Date(item.created_at),
          icon: icon,
          campaignId: item.campaign_id,
          clientId: item.campaigns?.client_id,
          clientName: item.campaigns?.clients?.name,
          campaignName: item.campaigns?.name,
          actor: actorName,
          extra: item.action?.replace(/_/g, " "),
          navigateTo: item.campaign_id ? `/agency/default/clients/${item.campaigns?.client_id}/campaigns/${item.campaign_id}` : null,
        });
      });

      // Add occurrences
      (occurrencesRes.data || []).forEach((item: any) => {
        activities.push({
          id: `occ-${item.id}`,
          type: "occurrence",
          title: item.description || item.client_stores?.name || t("common.occurrence"),
          description: t("common.registered"),
          time: new Date(item.created_at || new Date()),
          icon: Package,
          campaignId: item.campaign_id,
          clientId: item.campaigns?.client_id,
          clientName: item.campaigns?.clients?.name,
          campaignName: item.campaigns?.name,
          actor: item.reporter_name || t("common.user"),
          extra: item.client_stores?.name || null,
          navigateTo: `/agency/default/clients/${item.campaigns?.client_id}/campaigns/${item.campaign_id}/ocorrencias`,
        });
      });

      // Add campaigns
      (campaignsRes.data || []).forEach((item: any) => {
        activities.push({
          id: `camp-${item.id}`,
          type: "campaign",
          title: item.name,
          description: t("common.new") + " " + t("common.campaign").toLowerCase(),
          time: new Date(item.created_at),
          icon: Megaphone,
          campaignId: item.id,
          clientId: item.client_id,
          clientName: item.clients?.name,
          campaignName: item.name,
          actor: t("common.system", { defaultValue: "Sistema" }),
          extra: null,
          navigateTo: `/agency/default/clients/${item.client_id}/campaigns/${item.id}`,
        });
      });

      return activities.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 10);
    }
  });

  type ActivityItem = NonNullable<typeof recentActivity>[number];
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  type KpiKey = "activeCampaigns" | "stores" | "pieces" | "pendingInstallations";
  const [selectedKpi, setSelectedKpi] = useState<KpiKey | null>(null);


  const userName = (displayName || user?.email?.split("@")[0] || t("header.user")).trim().split(/\s+/)[0];

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
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
          { key: "activeCampaigns" as const, label: t("homeV2.kpis.activeCampaigns"), value: kpis?.activeCampaigns, icon: Megaphone, color: "text-brand-400" },
          { key: "stores" as const, label: t("homeV2.kpis.stores"), value: kpis?.storesCount, icon: Store, color: "text-stone-600" },
          { key: "pieces" as const, label: t("homeV2.kpis.piecesInProduction"), value: kpis?.piecesCount, icon: Package, color: "text-amber-600" },
          { key: "pendingInstallations" as const, label: t("homeV2.kpis.pendingInstallations"), value: kpis?.pendingInstallations, icon: Wrench, color: "text-rose-500" },
        ].map((card) => (
          <Card
            key={card.key}
            onClick={() => setSelectedKpi(card.key)}
            className="bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 p-4 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-300 transition-all"
          >
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
            <div className="text-[10px] text-stone-400 mt-1 flex items-center gap-1">
              {t("homeV2.kpis.updatedNow")} <ChevronRight className="w-2.5 h-2.5" />
            </div>
          </Card>
        ))}
      </section>

      <KpiDetailDialog
        kpiKey={selectedKpi}
        onClose={() => setSelectedKpi(null)}
        navigate={navigate}
        formatters={formatters}
        t={t}
      />


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
                <SkeletonCard key={i} />
              ))
            ) : recentCampaigns && recentCampaigns.length > 0 ? (
              recentCampaigns.map((camp) => (
                <Card 
                  key={camp.id}
                  className="bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 p-4 hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => navigate(`/agency/default/clients/${camp.client_id}/campaigns/${camp.id}`)}
                >
                  <div className="flex justify-between items-center mb-2">
                    <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                      {t("campaigns.status.active")}
                    </Badge>
                    <span className="text-[10px] text-stone-400">
                      {formatters.dateShort(new Date(camp.created_at))}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate group-hover:text-brand-400 transition-colors">
                    {camp.name}
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5 truncate">
                    {(camp as any).clients?.name || t("common.client")}
                  </p>
                  <div className="border-t border-stone-100 dark:border-stone-800 mt-3 pt-3 flex justify-between items-center text-[10px] text-stone-500">
                    <ChevronRight className="w-3 h-3 text-stone-300 ml-auto" />
                  </div>
                </Card>
              ))
            ) : (
              <div className="md:col-span-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl">
                <EmptyStateV2 
                  icon={Megaphone}
                  title={t("common.noResults")}
                  description={t("common.noResults")}
                />
              </div>
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
              ) : recentActivity && recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <button
                    type="button"
                    key={activity.id}
                    onClick={() => setSelectedActivity(activity)}
                    className="w-full text-left flex gap-3 p-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center flex-shrink-0">
                      <activity.icon className="w-4 h-4 text-stone-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-stone-700 dark:text-stone-300 truncate font-medium">
                          {activity.title}
                        </p>
                        <span className="text-[10px] text-stone-400 flex items-center gap-1 flex-shrink-0">
                          <Clock className="w-2.5 h-2.5" /> {formatters.relative(activity.time)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5 gap-2">
                        <span className="text-xs text-stone-500 truncate">
                          {activity.actor && <span className="font-semibold text-brand-400 mr-1">{activity.actor}:</span>}
                          {activity.campaignName ? activity.campaignName : activity.description}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <EmptyStateV2 
                  icon={Inbox}
                  title={t("common.noResults")}
                  description={t("common.noResults")}
                />
              )}
            </div>
          </div>
        </section>
      </div>

      <Dialog open={!!selectedActivity} onOpenChange={(o) => !o && setSelectedActivity(null)}>
        <DialogContent className="max-w-md">
          {selectedActivity && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center flex-shrink-0">
                    <selectedActivity.icon className="w-5 h-5 text-stone-600 dark:text-stone-300" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-left truncate">{selectedActivity.title}</DialogTitle>
                    <DialogDescription className="text-left">
                      {selectedActivity.description}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3 text-sm mt-2">
                {selectedActivity.campaignName && (
                  <div className="flex items-start gap-2">
                    <Megaphone className="w-4 h-4 text-stone-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-stone-400">
                        {t("common.campaign")}
                      </div>
                      <div className="text-stone-700 dark:text-stone-200">{selectedActivity.campaignName}</div>
                    </div>
                  </div>
                )}
                {selectedActivity.clientName && (
                  <div className="flex items-start gap-2">
                    <Store className="w-4 h-4 text-stone-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-stone-400">
                        {t("common.client")}
                      </div>
                      <div className="text-stone-700 dark:text-stone-200">{selectedActivity.clientName}</div>
                    </div>
                  </div>
                )}
                {selectedActivity.actor && (
                  <div className="flex items-start gap-2">
                    <UserIcon className="w-4 h-4 text-stone-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-stone-400">
                        {t("common.by", { defaultValue: "Por" })}
                      </div>
                      <div className="text-stone-700 dark:text-stone-200">{selectedActivity.actor}</div>
                    </div>
                  </div>
                )}
                {selectedActivity.extra && (
                  <div className="flex items-start gap-2">
                    <CalendarIcon className="w-4 h-4 text-stone-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-stone-400">
                        {t("common.details", { defaultValue: "Detalhes" })}
                      </div>
                      <div className="text-stone-700 dark:text-stone-200">{selectedActivity.extra}</div>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-stone-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-stone-400">
                      {t("common.when", { defaultValue: "Quando" })}
                    </div>
                    <div className="text-stone-700 dark:text-stone-200">
                      {formatters.dateTime(selectedActivity.time)} · {formatters.relative(selectedActivity.time)}
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setSelectedActivity(null)}>
                  {t("common.close", { defaultValue: "Fechar" })}
                </Button>
                {selectedActivity.campaignId && selectedActivity.clientId && (
                  <Button
                    onClick={() => {
                      const target = selectedActivity.navigateTo;
                      setSelectedActivity(null);
                      navigate(target);
                    }}
                  >
                    {t("common.openCampaign", { defaultValue: "Abrir campanha" })}
                    <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}