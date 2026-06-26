import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Megaphone, Store, Package, Wrench, ChevronRight, Loader2, PowerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type KpiKey = "activeCampaigns" | "inactiveCampaigns" | "stores" | "pieces" | "pendingInstallations" | "totalAgencies" | "totalClients" | "totalUsers" | "myClients" | "pendingApprovals";

interface Props {
  kpiKey: KpiKey | null;
  onClose: () => void;
  navigate: (path: string) => void;
  formatters: any;
  t: (key: string, opts?: any) => string;
  initialData?: any[];
  agencyId?: string;
}

const META: Record<string, { icon: any; titleKey: string; descKey: string }> = {
  activeCampaigns: { icon: Megaphone, titleKey: "home.kpi.activeCampaigns", descKey: "homeV2.kpiDetail.activeCampaignsDesc" },
  inactiveCampaigns: { icon: PowerOff, titleKey: "home.kpi.inactiveCampaigns", descKey: "homeV2.kpiDetail.genericDesc" },
  stores: { icon: Store, titleKey: "homeV2.kpis.stores", descKey: "homeV2.kpiDetail.storesDesc" },
  pieces: { icon: Package, titleKey: "homeV2.kpis.piecesInProduction", descKey: "homeV2.kpiDetail.piecesDesc" },
  pendingInstallations: { icon: Wrench, titleKey: "home.kpi.pendingInstallations", descKey: "homeV2.kpiDetail.pendingDesc" },
  totalAgencies: { icon: Building2, titleKey: "home.kpi.totalAgencies", descKey: "homeV2.kpiDetail.genericDesc" },
  totalClients: { icon: Users, titleKey: "home.kpi.totalClients", descKey: "homeV2.kpiDetail.genericDesc" },
  totalUsers: { icon: UserCheck, titleKey: "home.kpi.totalUsers", descKey: "homeV2.kpiDetail.genericDesc" },
  myClients: { icon: Users, titleKey: "home.kpi.myClients", descKey: "homeV2.kpiDetail.genericDesc" },
  pendingApprovals: { icon: ClipboardCheck, titleKey: "home.kpi.pendingApprovals", descKey: "homeV2.kpiDetail.genericDesc" },
};

import { Building2, Users, UserCheck, ClipboardCheck } from "lucide-react";

export function KpiDetailDialog({ kpiKey, onClose, navigate, formatters, t, initialData, agencyId }: Props) {
  const { data, isLoading } = useQuery({
    enabled: !!kpiKey && !initialData,
    queryKey: ["v2-kpi-detail", kpiKey],
    queryFn: async () => {
      // Keep existing fetch logic for other KPIs not in dashboardData if needed
      // But for our main 4 KPIs we now use initialData
      return [];
    },
  });

  const displayData = React.useMemo(() => {
    const rawData = initialData || data || [];
    
    if (kpiKey === "activeCampaigns" || kpiKey === "inactiveCampaigns") {
      return rawData.map((c: any) => {
        const isInactive = c.is_active === false;
        return {
          id: c.id,
          title: (
            <div className="flex items-center gap-2">
              <span className={isInactive ? "text-stone-400" : ""}>{c.name}</span>
              {isInactive && (
                <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-100 hover:bg-red-50 text-[10px] uppercase font-bold px-1.5 py-0 rounded-sm">
                  {t("common.campaign_inactive")}
                </Badge>
              )}
            </div>
          ),
          subtitle: c.clients?.name || c.client?.name,
          meta: c.created_at ? formatters.dateShort(new Date(c.created_at)) : null,
          onClick: () => {
            const resolvedAgencyId = c.clients?.agency_id || agencyId;
            if (!resolvedAgencyId) {
              console.warn("[KpiDetailDialog] Sem agency_id resolvido para a campanha", c.id);
              return;
            }
            navigate(`/agency/${resolvedAgencyId}/clients/${c.client_id}/campaigns/${c.id}`);
            onClose();
          },
        };
      });
    }
    
    if (kpiKey === "totalAgencies") {
      return rawData.map((a: any) => ({
        id: a.id,
        title: a.name,
        subtitle: null,
        meta: formatters.dateShort(new Date(a.created_at)),
        onClick: () => {
          navigate(`/agency/${a.id}`);
          onClose();
        },
      }));
    }

    if (kpiKey === "totalClients" || kpiKey === "myClients") {
      return rawData.map((c: any) => ({
        id: c.id,
        title: c.name,
        subtitle: c.agencies?.name,
        meta: formatters.dateShort(new Date(c.created_at)),
        onClick: () => {
          const resolvedAgencyId = c.agency_id || agencyId;
          if (!resolvedAgencyId) {
            console.warn("[KpiDetailDialog] Sem agency_id resolvido para o cliente", c.id);
            return;
          }
          navigate(`/agency/${resolvedAgencyId}/clients/${c.id}`);
          onClose();
        },
      }));
    }

    if (kpiKey === "totalUsers") {
      return rawData.map((p: any) => {
        const role = p.user_roles?.[0]?.role;
        return {
          id: p.id,
          title: p.display_name || t("common.user"),
          subtitle: p.user_id,
          meta: role ? (
            <Badge variant="secondary" className="text-[10px] bg-stone-100 text-stone-600 border-none">
              {role.toUpperCase()}
            </Badge>
          ) : null,
          onClick: () => {
            navigate(`/admin?tab=users&userId=${p.user_id}`);
            onClose();
          },
        };
      });
    }

    if (kpiKey === "pendingInstallations") {
      return rawData.map((s: any) => ({
        id: s.id,
        title: s.client_stores?.name || t("common.store"),
        subtitle: [s.campaigns?.clients?.name, s.campaigns?.name, s.installation_teams?.name]
          .filter(Boolean).join(" • "),
        meta: s.scheduled_date
          ? `${s.scheduled_date}${s.scheduled_time ? " " + s.scheduled_time : ""}`
          : t("scheduling.notScheduled"),
        onClick: s.campaign_id
          ? () => {
              const agencyId = s.campaigns?.agency_id || "default";
              navigate(`/agency/${agencyId}/clients/${s.campaigns?.client_id}/campaigns/${s.campaign_id}/instalacoes`);
              onClose();
            }
          : null,
      }));
    }

    // fallback for other raw data
    return rawData;
  }, [kpiKey, initialData, data, formatters, navigate, t]);

  const open = !!kpiKey;
  const meta = kpiKey ? META[kpiKey] : null;
  const Icon = meta?.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {meta && Icon && (
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
                <Icon className="w-5 h-5 text-stone-600 dark:text-stone-300" />
              </div>
              <div>
                <DialogTitle className="text-left">{t(meta.titleKey)}</DialogTitle>
                <DialogDescription className="text-left">
                  {t(meta.descKey, { defaultValue: "Veja todos os itens que compõem este indicador." })}
                </DialogDescription>
              </div>
              <Badge variant="outline" className="ml-auto">
                {isLoading ? "…" : displayData?.length ?? 0}
              </Badge>
            </div>
          </DialogHeader>
        )}

        <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
            </div>
          ) : !displayData || displayData.length === 0 ? (
            <div className="text-center py-12 text-sm text-stone-500">
              {t("common.noResults", { defaultValue: "Nenhum resultado" })}
            </div>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-stone-800">
              {displayData.map((item: any) => {
                const Tag: any = item.onClick ? "button" : "div";
                return (
                  <Tag
                    key={item.id}
                    type={item.onClick ? "button" : undefined}
                    onClick={item.onClick || undefined}
                    className={`w-full text-left flex items-center gap-3 py-3 ${
                      item.onClick ? "hover:bg-stone-50 dark:hover:bg-stone-800/50 cursor-pointer -mx-2 px-2 rounded" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <p className="text-xs text-stone-500 truncate mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                    {item.meta && (
                      <span className="text-xs text-stone-400 flex-shrink-0">{item.meta}</span>
                    )}
                    {item.onClick && <ChevronRight className="w-3 h-3 text-stone-300 flex-shrink-0" />}
                  </Tag>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
