import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Megaphone, Store, Package, Wrench, ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type KpiKey = "activeCampaigns" | "stores" | "pieces" | "pendingInstallations" | "totalAgencies" | "totalClients" | "totalUsers" | "myClients" | "pendingApprovals";

interface Props {
  kpiKey: KpiKey | null;
  onClose: () => void;
  navigate: (path: string) => void;
  formatters: any;
  t: (key: string, opts?: any) => string;
}

const META: Record<string, { icon: any; titleKey: string; descKey: string }> = {
  activeCampaigns: { icon: Megaphone, titleKey: "home.kpi.activeCampaigns", descKey: "homeV2.kpiDetail.activeCampaignsDesc" },
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

export function KpiDetailDialog({ kpiKey, onClose, navigate, formatters, t }: Props) {
  const { data, isLoading } = useQuery({
    enabled: !!kpiKey,
    queryKey: ["v2-kpi-detail", kpiKey],
    queryFn: async () => {
      if (kpiKey === "activeCampaigns") {
        const today = new Date().toISOString().split("T")[0];
        const { data } = await supabase
          .from("campaigns")
          .select("id, name, created_at, client_id, clients(name)")
          .or(`occurrence_end_date.is.null,occurrence_end_date.gte.${today}`)
          .order("created_at", { ascending: false });
        return (data || []).map((c: any) => ({
          id: c.id,
          title: c.name,
          subtitle: c.clients?.name,
          meta: formatters.dateShort(new Date(c.created_at)),
          onClick: () => navigate(`/agency/default/clients/${c.client_id}/campaigns/${c.id}`),
        }));
      }
      if (kpiKey === "stores") {
        const { data } = await supabase
          .from("stores")
          .select("id, name, uf, type, model")
          .order("name", { ascending: true })
          .limit(500);
        return (data || []).map((s: any) => ({
          id: s.id,
          title: s.name,
          subtitle: [s.uf, s.type, s.model].filter(Boolean).join(" • "),
          meta: null,
          onClick: null,
        }));
      }
      if (kpiKey === "pieces") {
        const { data } = await supabase
          .from("pieces")
          .select("id, name, code, category, size, created_at")
          .order("created_at", { ascending: false })
          .limit(500);
        return (data || []).map((p: any) => ({
          id: p.id,
          title: p.name,
          subtitle: [p.code, p.category, p.size].filter(Boolean).join(" • "),
          meta: p.created_at ? formatters.dateShort(new Date(p.created_at)) : null,
          onClick: null,
        }));
      }
      if (kpiKey === "pendingInstallations") {
        const { data } = await supabase
          .from("campaign_schedules")
          .select("id, scheduled_date, scheduled_time, campaign_id, store_id, client_stores(name), campaigns(name, client_id, clients(name)), installation_teams(name)")
          .is("completed_at", null)
          .order("scheduled_date", { ascending: true, nullsFirst: false })
          .limit(500);
        return (data || []).map((s: any) => ({
          id: s.id,
          title: s.client_stores?.name || t("common.store", { defaultValue: "Loja" }),
          subtitle: [s.campaigns?.clients?.name, s.campaigns?.name, s.installation_teams?.name]
            .filter(Boolean).join(" • "),
          meta: s.scheduled_date
            ? `${s.scheduled_date}${s.scheduled_time ? " " + s.scheduled_time : ""}`
            : t("scheduling.notScheduled", { defaultValue: "Sem data" }),
          onClick: s.campaign_id
            ? () => navigate(`/agency/default/clients/${s.campaigns?.client_id}/campaigns/${s.campaign_id}/instalacoes`)
            : null,
        }));
      }
      return [];
    },
  });

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
                {isLoading ? "…" : data?.length ?? 0}
              </Badge>
            </div>
          </DialogHeader>
        )}

        <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
            </div>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-12 text-sm text-stone-500">
              {t("common.noResults", { defaultValue: "Nenhum resultado" })}
            </div>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-stone-800">
              {data.map((item) => {
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
                      <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">
                        {item.title}
                      </p>
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
