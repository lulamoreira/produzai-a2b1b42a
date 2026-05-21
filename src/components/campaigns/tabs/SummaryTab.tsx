import React from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, Camera, LayoutGrid, Store, AlertTriangle, DollarSign, Layers, LayoutList, Grid3X3 } from "lucide-react";
import CampaignStatusDashboard from "@/components/CampaignStatusDashboard";
import SupportMaterialsSection from "@/components/SupportMaterialsSection";
import ModuleGrid from "@/components/ModuleGrid";

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

  return (
    <div className="space-y-6">
      {/* KPI Stats moved to Header or kept here? The user prompt suggests SummaryTab is the overview */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <button onClick={() => onNavigate("stores")} className="inline-flex items-baseline gap-1.5 group cursor-pointer">
          <span className="text-xl font-bold text-foreground">{stores.length}</span>
          <span className="text-[13px] text-muted-foreground group-hover:underline">{t("stores.registered")}</span>
        </button>
        <span className="text-border-default">·</span>
        <button onClick={() => onNavigate("pieces")} className="inline-flex items-baseline gap-1.5 group cursor-pointer">
          <span className="text-xl font-bold text-foreground">{visiblePieces.length + kits.length}</span>
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