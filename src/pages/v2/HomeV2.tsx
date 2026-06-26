import React, { useState, useEffect } from "react";
import { useUserAgencyAccess } from "@/hooks/useUserAgencyAccess";
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
  ExternalLink,
  Building2,
  Users,
  UserCheck,
  MapPin,
  ClipboardCheck,
  PowerOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useFormatters } from "@/lib/formatters";
import { SkeletonCard } from "@/components/v2/ui/SkeletonCard";
import { EmptyStateV2 } from "@/components/v2/ui/EmptyStateV2";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KpiDetailDialog } from "@/components/v2/home/KpiDetailDialog";
import { useUserRole } from "@/hooks/useUserRole";

export function HomeV2() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: allAgencyAccess = [], isLoading: loadingAgencyAccessTable } = useUserAgencyAccess();
  const myAgencyAccess = allAgencyAccess.filter(a => a.user_id === user?.id && !a.suspended);
  const { role, isAdmin, isMaster, isAdminOrMaster, isLoading: loadingRole } = useUserRole();
  const navigate = useNavigate();
  const { displayName } = useDisplayName();
  const formatters = useFormatters();
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);

  const { data: userAgency, isLoading: loadingAgency } = useQuery({
    queryKey: ["user-agency-id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.agency_id;
    },
    enabled: !!user?.id
  });

  useEffect(() => {
    if (loadingRole || loadingAgencyAccessTable || isAdminOrMaster) return;
    if (myAgencyAccess.length > 0) {
      navigate(`/agency/${myAgencyAccess[0].agency_id}`);
    } else {
      navigate('/my-campaigns');
    }
  }, [loadingRole, loadingAgencyAccessTable, isAdminOrMaster, myAgencyAccess, navigate]);

  const { data: dashboardData, isLoading: loadingKpis } = useQuery({
    queryKey: ["v2-dashboard-data", role, userAgency, isAdminOrMaster],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      if (isAdminOrMaster) {
        const [agenciesRes, clientsRes, activeCampaignsRes, profilesRes, rolesRes] = await Promise.all([
          (supabase.from("agencies") as any).select("id, name, created_at").is("deleted_at", null).order("name"),
          (supabase.from("clients") as any).select("id, name, created_at, agency_id, agencies(name)").order("name"),
          (supabase.from("campaigns") as any).select("id, name, created_at, client_id, is_active, clients(name, agency_id), occurrence_end_date").order("created_at", { ascending: false }),
          (supabase.from("profiles") as any).select("id, display_name, created_at, user_id").order("display_name"),
          (supabase.from("user_roles") as any).select("user_id, role")
        ]);

        const rolesMap: Record<string, string[]> = {};
        (rolesRes.data || []).forEach((r: any) => {
          if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
          rolesMap[r.user_id].push(r.role);
        });
        const profilesWithRoles = (profilesRes.data || []).map((p: any) => ({
          ...p,
          user_roles: (rolesMap[p.user_id] || []).map((role) => ({ role }))
        }));

        const allCampaigns = activeCampaignsRes.data || [];
        return {
          totalAgencies: agenciesRes.data || [],
          totalClients: clientsRes.data || [],
          activeCampaigns: allCampaigns.filter((c: any) => c.is_active !== false),
          inactiveCampaigns: allCampaigns.filter((c: any) => c.is_active === false),
          totalUsers: profilesWithRoles
        };
      } else {
        const agencyId = userAgency;
        if (!agencyId) return null;

        const agencyClientsRes = await (supabase.from("clients") as any).select("id, name, created_at, agencies(name)").eq("agency_id", agencyId).order("name");
        const agencyClientIds = (agencyClientsRes.data || []).map((c: any) => c.id);

        const [activeCampaignsRes, pendingApprovalsRes, pendingInstRes] = await Promise.all([
          agencyClientIds.length
            ? (supabase.from("campaigns") as any).select("id, name, created_at, client_id, is_active, clients(name)").in("client_id", agencyClientIds).order("created_at", { ascending: false })
            : Promise.resolve({ data: [] }),
          (supabase.from("user_approvals" as any).select("id, created_at") as any).eq("status", "pending"),
          agencyClientIds.length
            ? (async () => {
                const campIds = (await (supabase.from("campaigns") as any).select("id").in("client_id", agencyClientIds)).data?.map((c: any) => c.id) || [];
                return campIds.length
                  ? (supabase.from("campaign_schedules") as any).select("id, scheduled_date, scheduled_time, campaign_id, store_id, client_stores(name), campaigns(name, client_id, clients(name)), installation_teams(name)").is("completed_at", null).in("campaign_id", campIds)
                  : { data: [] };
              })()
            : Promise.resolve({ data: [] })
        ]);
        const clientsRes = agencyClientsRes;

        return {
          activeCampaigns: activeCampaignsRes.data || [],
          myClients: clientsRes.data || [],
          pendingInstallations: pendingInstRes.data || [],
          pendingApprovals: pendingApprovalsRes.data || []
        };
      }
    }
  });

  const kpis = isAdminOrMaster ? {
    totalAgencies: dashboardData?.totalAgencies?.length || 0,
    totalClients: dashboardData?.totalClients?.length || 0,
    activeCampaigns: dashboardData?.activeCampaigns?.length || 0,
    totalUsers: dashboardData?.totalUsers?.length || 0,
    inactiveCampaigns: (dashboardData as any)?.inactiveCampaigns?.length || 0
  } : {
    activeCampaigns: dashboardData?.activeCampaigns?.length || 0,
    myClients: dashboardData?.myClients?.length || 0,
    pendingInstallations: dashboardData?.pendingInstallations?.length || 0,
    pendingApprovals: dashboardData?.pendingApprovals?.length || 0
  };

  const { data: recentCampaigns = [], isLoading: loadingCampaigns } = useQuery({
    queryKey: ["v2-recent-campaigns", isAdmin, isMaster, userAgency],
    enabled: isAdminOrMaster && !loadingAgency,
    queryFn: async () => {
      if (isAdmin) {
        const { data, error } = await supabase
          .from("campaigns")
          .select(`id, name, created_at, client_id, is_active, clients (name)`)
          .order("created_at", { ascending: false })
          .limit(6);
        if (error) { console.error("Error fetching recent campaigns:", error); return []; }
        return data || [];
      }
      // Master: filter by their agency's clients
      if (!userAgency) return [];
      const { data: clients } = await supabase
        .from("clients").select("id").eq("agency_id", userAgency);
      const clientIds = (clients || []).map((c: any) => c.id);
      if (!clientIds.length) return [];
      const { data, error } = await supabase
        .from("campaigns")
        .select(`id, name, created_at, client_id, is_active, clients (name)`)
        .in("client_id", clientIds)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) { console.error("Error fetching recent campaigns:", error); return []; }
      return data || [];
    }
  });

  const { data: recentActivity = [], isLoading: loadingActivity } = useQuery({
    queryKey: ["v2-recent-activity", isAdmin, isMaster, userAgency],
    enabled: isAdminOrMaster && !loadingAgency,
    queryFn: async () => {
      // Determine accessible campaign IDs for masters
      let accessibleCampaignIds: string[] | null = null;
      if (!isAdmin) {
        if (!userAgency) return [];
        const { data: clients } = await supabase
          .from("clients").select("id").eq("agency_id", userAgency);
        const clientIds = (clients || []).map((c: any) => c.id);
        if (!clientIds.length) return [];
        const { data: cams } = await supabase
          .from("campaigns").select("id").in("client_id", clientIds);
        accessibleCampaignIds = (cams || []).map((c: any) => c.id);
        if (!accessibleCampaignIds.length) return [];
      }

      const [activityLogRes, occurrencesRes, campaignsRes] = await Promise.all([
        accessibleCampaignIds
          ? supabase.from("campaign_activity_log")
              .select("*, campaigns(name, client_id, clients(name)), client_stores(name)")
              .in("campaign_id", accessibleCampaignIds)
              .order("created_at", { ascending: false }).limit(10)
          : supabase.from("campaign_activity_log")
              .select("*, campaigns(name, client_id, clients(name)), client_stores(name)")
              .order("created_at", { ascending: false }).limit(10),
        accessibleCampaignIds
          ? supabase.from("occurrences")
              .select("*, campaigns(name, client_id, clients(name)), client_stores(name)")
              .in("campaign_id", accessibleCampaignIds)
              .order("created_at", { ascending: false }).limit(5)
          : supabase.from("occurrences")
              .select("*, campaigns(name, client_id, clients(name)), client_stores(name)")
              .order("created_at", { ascending: false }).limit(5),
        accessibleCampaignIds
          ? supabase.from("campaigns")
              .select("*, clients(name)")
              .in("id", accessibleCampaignIds)
              .order("created_at", { ascending: false }).limit(5)
          : supabase.from("campaigns")
              .select("*, clients(name)")
              .order("created_at", { ascending: false }).limit(5),
      ]);

      const userIds = [...new Set((activityLogRes.data || []).map((item: any) => item.user_id).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles").select("user_id, display_name").in("user_id", userIds);
        profiles?.forEach((p: any) => { profileMap[p.user_id] = p.display_name; });
      }

      const activities: any[] = [];

      (activityLogRes.data || []).forEach((item: any) => {
        const actorName = item.actor_name || profileMap[item.user_id] || t("common.user");
        let icon = Wrench;
        if (item.action?.includes("concluida")) icon = Package;
        if (item.action?.includes("foto")) icon = Megaphone;
        if (item.action?.includes("agendamento")) icon = CalendarIcon;
        activities.push({
          id: `log-${item.id}`,
          type: "activity",
          title: item.client_stores?.name || item.campaigns?.name || t("common.activity"),
          description: item.description || item.action,
          time: new Date(item.created_at),
          icon,
          campaignId: item.campaign_id,
          clientId: item.campaigns?.client_id,
          clientName: item.campaigns?.clients?.name,
          campaignName: item.campaigns?.name,
          actor: actorName,
          extra: item.action?.replace(/_/g, " "),
          navigateTo: item.campaign_id && userAgency ? `/agency/${userAgency}/clients/${item.campaigns?.client_id}/campaigns/${item.campaign_id}` : null,
        });
      });

      (occurrencesRes.data || []).forEach((item: any) => {
        activities.push({
          id: `occ-${item.id}`,
          type: "occurrence",
          title: item.campaigns?.name || t("common.occurrence"),
          description: item.description || t("common.occurrence"),
          time: new Date(item.created_at),
          icon: Inbox,
          campaignId: item.campaign_id,
          clientId: item.campaigns?.client_id,
          clientName: item.campaigns?.clients?.name,
          campaignName: item.campaigns?.name,
          actor: item.reporter_name,
          extra: item.status,
          navigateTo: item.campaign_id && userAgency ? `/agency/${userAgency}/clients/${item.campaigns?.client_id}/campaigns/${item.campaign_id}` : null,
        });
      });

      (campaignsRes.data || []).forEach((item: any) => {
        activities.push({
          id: `camp-${item.id}`,
          type: "campaign",
          title: item.name,
          description: t("homeV2.recentActivity.newCampaign"),
          time: new Date(item.created_at),
          icon: Megaphone,
          campaignId: item.id,
          clientId: item.client_id,
          clientName: item.clients?.name,
          campaignName: item.name,
          navigateTo: userAgency ? `/agency/${userAgency}/clients/${item.client_id}/campaigns/${item.id}` : null,
        });
      });

      return activities.sort((a: any, b: any) => b.time.getTime() - a.time.getTime());
    }
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return t("homeV2.greeting.morning");
    if (hour >= 12 && hour < 18) return t("homeV2.greeting.afternoon");
    return t("homeV2.greeting.evening");
  };

  const userName = (displayName || user?.email?.split("@")[0] || t("header.user")).trim().split(/\s+/)[0];

  if (!isAdminOrMaster) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

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
      <section className={cn("grid grid-cols-2 gap-4 mt-6", isAdminOrMaster ? "md:grid-cols-5" : "md:grid-cols-4")}>
        {(isAdminOrMaster ? [
          { key: "totalAgencies", label: t("home.kpi.totalAgencies"), value: kpis?.totalAgencies, icon: Building2, color: "text-[#C2714F]" },
          { key: "totalClients", label: t("home.kpi.totalClients"), value: kpis?.totalClients, icon: Users, color: "text-[#C2714F]" },
          { key: "activeCampaigns", label: t("home.kpi.activeCampaigns"), value: kpis?.activeCampaigns, icon: Megaphone, color: "text-[#C2714F]" },
          { key: "inactiveCampaigns", label: t("home.kpi.inactiveCampaigns", "Campanhas Inativas"), value: (kpis as any)?.inactiveCampaigns, icon: PowerOff, color: "text-red-500" },
          { key: "totalUsers", label: t("home.kpi.totalUsers"), value: kpis?.totalUsers, icon: UserCheck, color: "text-[#C2714F]" },
        ] : [
          { key: "activeCampaigns", label: t("home.kpi.activeCampaigns"), value: kpis?.activeCampaigns, icon: Megaphone, color: "text-[#C2714F]" },
          { key: "myClients", label: t("home.kpi.myClients"), value: kpis?.myClients, icon: Users, color: "text-[#C2714F]" },
          { key: "pendingInstallations", label: t("home.kpi.pendingInstallations"), value: kpis?.pendingInstallations, icon: MapPin, color: "text-[#C2714F]" },
          { key: "pendingApprovals", label: t("home.kpi.pendingApprovals"), value: kpis?.pendingApprovals, icon: ClipboardCheck, color: "text-[#C2714F]" },
        ]).map((card) => (
          <Card
            key={card.key}
            onClick={() => setSelectedKpi(card.key as any)}
            className="bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 p-5 shadow-sm cursor-pointer hover:shadow-md hover:border-stone-200 transition-all rounded-xl"
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">
                {card.label}
              </span>
              <card.icon className={cn("w-5 h-5", card.color)} />
            </div>
            {loadingKpis ? (
              <div className="h-10 w-20 bg-stone-50 dark:bg-stone-800 animate-pulse rounded my-2" />
            ) : (
              <div className="text-4xl font-bold text-stone-900 dark:text-stone-100 my-2">
                {card.value ?? 0}
              </div>
            )}
            <div className="text-xs text-stone-400 mt-1 flex items-center gap-1">
              {t("homeV2.kpis.updatedNow")} <ChevronRight className="w-3 h-3" />
            </div>
          </Card>
        ))}
      </section>

      <KpiDetailDialog
        kpiKey={selectedKpi as any}
        onClose={() => setSelectedKpi(null)}
        navigate={navigate}
        formatters={formatters}
        t={t}
        initialData={selectedKpi ? (dashboardData as any)?.[selectedKpi] : null}
        agencyId={userAgency ?? undefined}
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
                  onClick={() => userAgency && navigate(`/agency/${userAgency}/clients/${camp.client_id}/campaigns/${camp.id}`)}
                >
                  <div className="flex justify-between items-center mb-2">
                    <Badge 
                      variant={camp.is_active === false ? "destructive" : "outline"} 
                      className={cn(
                        "text-[10px] font-semibold uppercase",
                        camp.is_active === false 
                          ? "bg-red-100 text-red-600 border-red-200 hover:bg-red-100" 
                          : ""
                      )}
                    >
                      {camp.is_active === false ? t("common.campaign_inactive") : t("campaigns.status.active")}
                    </Badge>
                    <span className="text-[10px] text-stone-400">
                      {formatters.dateShort(new Date(camp.created_at))}
                    </span>
                  </div>
                  <h4 className={cn(
                    "text-sm font-semibold truncate group-hover:text-brand-400 transition-colors",
                    camp.is_active === false ? "text-stone-400" : "text-stone-800 dark:text-stone-100"
                  )}>
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
                <div className="p-8">
                  <EmptyStateV2 
                    icon={Inbox}
                    title={t("common.noResults")}
                    description={t("common.noResults")}
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <Dialog open={!!selectedActivity} onOpenChange={(open) => !open && setSelectedActivity(null)}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 shadow-2xl">
          <DialogHeader className="p-6 pb-4 bg-stone-50/50 dark:bg-stone-900/50 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-white dark:bg-stone-800 flex items-center justify-center shadow-sm border border-stone-100 dark:border-stone-700">
                {selectedActivity?.icon && <selectedActivity.icon className="w-5 h-5 text-[#C2714F]" />}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-stone-900 dark:text-stone-100 leading-tight">
                  {selectedActivity?.title}
                </DialogTitle>
                <div className="text-xs text-stone-500 font-medium flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  {selectedActivity?.time && formatters.dateTime(selectedActivity.time)}
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-stone-50/30 dark:bg-stone-900/30 border border-stone-100/50 dark:border-stone-800/50">
                <Building2 className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{t("common.client")}</p>
                  <p className="text-sm font-semibold text-stone-800 dark:text-stone-200 truncate">
                    {selectedActivity?.clientName || "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-stone-50/30 dark:bg-stone-900/30 border border-stone-100/50 dark:border-stone-800/50">
                <Megaphone className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{t("common.campaign")}</p>
                  <p className="text-sm font-semibold text-stone-800 dark:text-stone-200 truncate">
                    {selectedActivity?.campaignName || "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-stone-50/30 dark:bg-stone-900/30 border border-stone-100/50 dark:border-stone-800/50">
                <UserCheck className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{t("common.by")}</p>
                  <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                    {selectedActivity?.actor || "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100 dark:border-stone-800">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">DETALHES DA AÇÃO</p>
              <div className="p-4 rounded-xl bg-[#C2714F]/5 border border-[#C2714F]/10">
                <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
                  {selectedActivity?.description}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-stone-50 dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 flex flex-row gap-2 sm:justify-end">
            <Button 
              variant="outline" 
              onClick={() => setSelectedActivity(null)}
              className="flex-1 sm:flex-none h-11 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-white dark:hover:bg-stone-800 font-bold rounded-xl"
            >
              {t("common.close").toUpperCase()}
            </Button>
            {selectedActivity?.navigateTo && (
              <Button 
                onClick={() => {
                  navigate(selectedActivity.navigateTo);
                  setSelectedActivity(null);
                }}
                className="flex-1 sm:flex-none h-11 bg-[#C2714F] hover:bg-[#A35D3F] text-white font-bold gap-2 rounded-xl shadow-lg shadow-[#C2714F]/20"
              >
                {t("common.openCampaign").toUpperCase()}
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
