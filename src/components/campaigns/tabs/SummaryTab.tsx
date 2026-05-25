import React from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, Camera, LayoutGrid, Store, AlertTriangle, DollarSign, Layers, LayoutList, Grid3X3, Package, MapPin, ClipboardCheck } from "lucide-react";
import CampaignStatusDashboard from "@/components/CampaignStatusDashboard";
import SupportMaterialsSection from "@/components/SupportMaterialsSection";
import ModuleGrid from "@/components/ModuleGrid";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

interface SummaryTabProps {
  campaignId: string;
  stores: any[];
  visiblePieces: any[];
  kits: any[];
  canEditCampaign: boolean;
  canViewSchedules: boolean;
  canViewInstallations: boolean;
  lalPerms: any;
  canViewStores: boolean;
  canViewCampaignStores: boolean;
  isAdmin: boolean;
  isAdminOrMaster: boolean;
  canViewPieces: boolean;
  onNavigate: (section: string, filter?: any) => void;
  campaignKpis?: {
    stores: number;
    pieces: number;
    pendingInstallations: number;
    pendingApprovals: number;
  };
}

export default function SummaryTab({
  campaignId,
  stores,
  visiblePieces,
  kits,
  canEditCampaign,
  canViewSchedules,
  canViewInstallations,
  lalPerms,
  canViewStores,
  canViewCampaignStores,
  isAdmin,
  isAdminOrMaster,
  canViewPieces,
  onNavigate
}: SummaryTabProps) {
  const { t } = useTranslation();

  const { data: campaignKpis } = useQuery({
    queryKey: ["campaign-summary-kpis", campaignId],
    queryFn: async () => {
      const storesRes = await (supabase.from("client_stores") as any).select("id", { count: "exact", head: true }).eq("campaign_id", campaignId);
      const piecesRes = await (supabase.from("pieces") as any).select("id", { count: "exact", head: true }).eq("campaign_id", campaignId);
      const pendingInstallationsRes = await (supabase.from("campaign_schedules") as any).select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).is("completed_at", null);
      const pendingApprovalsRes = await (supabase.from("user_approvals" as any).select("id", { count: "exact", head: true }) as any).eq("campaign_id", campaignId).eq("status", "pending");

      return {
        stores: storesRes.count || 0,
        pieces: piecesRes.count || 0,
        pendingInstallations: pendingInstallationsRes.count || 0,
        pendingApprovals: pendingApprovalsRes.count || 0
      };
    },
    enabled: !!campaignId
  });

  return (
    <div className="space-y-6">
      {/* Campaign KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: t("campaign.kpi.stores"), value: campaignKpis?.stores, icon: Store },
          { label: t("campaign.kpi.pieces"), value: campaignKpis?.pieces, icon: Package },
          { label: t("campaign.kpi.pendingInstallations"), value: campaignKpis?.pendingInstallations, icon: MapPin },
          { label: t("campaign.kpi.pendingApprovals"), value: campaignKpis?.pendingApprovals, icon: ClipboardCheck },
        ].map((kpi, idx) => (
          <Card key={idx} className="bg-stone-50 dark:bg-stone-900/50 p-4 border-stone-100 dark:border-stone-800 relative overflow-hidden group">
            <div className="flex flex-col">
              <span className="text-[10px] text-stone-400 uppercase tracking-widest font-medium mb-1">
                {kpi.label}
              </span>
              <span className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                {kpi.value ?? 0}
              </span>
            </div>
            <kpi.icon className="absolute top-4 right-4 w-4 h-4 text-[#C2714F] opacity-80" />
          </Card>
        ))}
      </div>
      {/* KPI Stats moved to Header or kept here? The user prompt suggests SummaryTab is the overview */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <button onClick={() => onNavigate("stores")} className="inline-flex items-baseline gap-1.5 group cursor-pointer">
          <span className="text-xl font-bold text-foreground">{stores?.length || 0}</span>
          <span className="text-[13px] text-muted-foreground group-hover:underline">{t("stores.registered")}</span>
        </button>
        <span className="text-border-default">·</span>
        <button onClick={() => onNavigate("pieces")} className="inline-flex items-baseline gap-1.5 group cursor-pointer">
          <span className="text-xl font-bold text-foreground">{(visiblePieces?.length || 0) + (kits?.length || 0)}</span>
          <span className="text-[13px] text-muted-foreground group-hover:underline">{t("pieces.registered")}</span>
        </button>
      </div>

      <CampaignStatusDashboard
        campaignId={campaignId}
        onNavigate={(section, filter) => {
          onNavigate(section, filter);
        }}
      />

      <SupportMaterialsSection campaignId={campaignId} canEdit={canEditCampaign} />

      <ModuleGrid
        items={[
          { key: "scheduling", label: t("modules.scheduling"), icon: CalendarDays, visible: canViewSchedules, color: "#5C6B3F" },
          { key: "installations", label: t("modules.installations"), icon: Camera, visible: canViewInstallations, color: "#7B5E3A" },
          { key: "loja_a_loja", label: t("modules.loja_a_loja"), icon: LayoutGrid, visible: lalPerms.canViewModule, color: "#5B7B5E" },
          { key: "stores", label: t("modules.stores"), icon: Store, visible: canViewStores || canViewCampaignStores, color: "#6B4F2E" },
          { key: "occurrences", label: t("modules.occurrences"), icon: AlertTriangle, visible: lalPerms.ocorrencias.canView, color: "#7A3B2E" },
          { key: "budgets", label: t("modules.budgets"), icon: DollarSign, visible: isAdmin, color: "#4A5568" },
          { key: "adjustments", label: "Ajustes", icon: Layers, visible: isAdminOrMaster, color: "#6E5A7A" },
          { key: "pieces", label: t("modules.pieces"), icon: LayoutList, visible: canViewPieces, color: "#A07850" },
          { key: "matrix", label: t("modules.matrix"), icon: Grid3X3, visible: canViewCampaignStores, color: "#8C6F4E" },
          { key: "mockup", label: "Mockup", icon: LayoutGrid, visible: true, color: "#7A6A8C" },
        ]}
        onSelect={(key) => onNavigate(key)}
      />
    </div>
  );
}