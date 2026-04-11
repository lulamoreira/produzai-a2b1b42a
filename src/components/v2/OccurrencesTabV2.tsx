/**
 * OccurrencesTabV2 — v2 wrapper with KpiStrip chrome.
 * Renders original OccurrencesTab with v2 visual wrapper when in "new" mode.
 * Full card redesign will be layered incrementally.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useInterfaceMode } from "@/hooks/useInterfaceMode";
import OccurrencesTab from "@/components/OccurrencesTab";
import { useOccurrences } from "@/hooks/useOccurrences";
import KpiStrip from "./KpiStrip";
import type { CampaignPiece, ClientStore } from "@/hooks/useMultiClientData";

interface Props {
  campaignId: string;
  clientId?: string;
  stores: ClientStore[];
  pieces: CampaignPiece[];
  canEdit?: boolean;
  canDelete?: boolean;
  canEditReporter?: boolean;
}

export default function OccurrencesTabV2(props: Props) {
  const { interfaceMode } = useInterfaceMode();
  const { t } = useTranslation();
  const { data: occurrences = [] } = useOccurrences(props.campaignId);

  const metrics = useMemo(() => {
    const total = occurrences.length;
    const open = occurrences.filter(o => o.status !== "resolved" && o.status !== "closed").length;
    const resolved = occurrences.filter(o => o.status === "resolved" || o.status === "closed").length;
    const highPriority = occurrences.filter(o => o.priority === "high" || o.priority === "urgent").length;
    return { total, open, resolved, highPriority };
  }, [occurrences]);

  if (interfaceMode !== "new") {
    return <OccurrencesTab {...props} />;
  }

  const kpiItems = [
    { key: "total", label: t("common.total"), value: metrics.total, primary: true },
    { key: "open", label: "🔴 Abertas", value: metrics.open, color: "text-destructive" },
    { key: "resolved", label: "✅ Resolvidas", value: metrics.resolved, color: "text-emerald-600" },
    { key: "highPriority", label: "⚠️ Alta prioridade", value: metrics.highPriority, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-4">
      <KpiStrip items={kpiItems} activeKey="" onItemClick={() => {}} />
      <OccurrencesTab {...props} />
    </div>
  );
}
