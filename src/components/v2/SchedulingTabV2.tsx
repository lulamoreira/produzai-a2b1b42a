/**
 * SchedulingTabV2 — v2 wrapper with KpiStrip chrome.
 * Renders original SchedulingTab with v2 visual wrapper when in "new" mode.
 * Full card redesign will be layered incrementally.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useInterfaceMode } from "@/hooks/useInterfaceMode";
import SchedulingTab from "@/components/SchedulingTab";
import { useCampaignSchedules } from "@/hooks/useCampaignSchedules";
import KpiStrip from "./KpiStrip";
import type { ClientStore } from "@/hooks/useMultiClientData";

interface Props {
  campaignId: string;
  stores: ClientStore[];
  canEdit: boolean;
  agencyName: string;
  clientName: string;
  campaignName: string;
  clientId: string;
}

export default function SchedulingTabV2(props: Props) {
  const { interfaceMode } = useInterfaceMode();
  const { t } = useTranslation();
  const { scheduleMap } = useCampaignSchedules(props.campaignId);

  const metrics = useMemo(() => {
    const total = props.stores.length;
    const scheduled = props.stores.filter(s => {
      const sch = scheduleMap[s.id];
      return sch?.scheduled_date && sch?.scheduled_time;
    }).length;
    const withTeam = props.stores.filter(s => scheduleMap[s.id]?.team_id).length;
    const approved = props.stores.filter(s => {
      const sch = scheduleMap[s.id];
      return sch?.store_approved && sch?.team_approved;
    }).length;
    const reschedule = props.stores.filter(s => scheduleMap[s.id]?.reschedule_enabled).length;
    return { total, scheduled, pending: total - scheduled, withTeam, approved, reschedule };
  }, [props.stores, scheduleMap]);

  if (interfaceMode !== "new") {
    return <SchedulingTab {...props} />;
  }

  const kpiItems = [
    { key: "total", label: t("common.total"), value: metrics.total, primary: true },
    { key: "scheduled", label: "📅 Agendadas", value: metrics.scheduled, color: "text-emerald-600" },
    { key: "pending", label: "⏳ Pendentes", value: metrics.pending, color: "text-amber-600" },
    { key: "withTeam", label: "🔧 Com equipe", value: metrics.withTeam },
    { key: "approved", label: "✅ Aprovadas", value: metrics.approved, color: "text-emerald-600" },
    { key: "reschedule", label: "🔄 Remarcação", value: metrics.reschedule, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-4">
      <KpiStrip items={kpiItems} activeKey="" onSelect={() => {}} />
      <SchedulingTab {...props} />
    </div>
  );
}
