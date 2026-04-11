/**
 * InstallationsTabV2 — wrapper that renders the original InstallationsTab
 * in legacy mode, or adds v2 enhancements (KPI strip, collapsible filters)
 * in new mode.
 *
 * Phase 1: wraps the original tab. Card-level redesign will be added
 * incrementally without touching the original component.
 */
import { useInterfaceMode } from "@/hooks/useInterfaceMode";
import InstallationsTab from "@/components/InstallationsTab";
import type { ClientStore } from "@/hooks/useMultiClientData";

interface Props {
  campaignId: string;
  campaignName: string;
  stores: ClientStore[];
  canEdit: boolean;
  clientId: string;
  agencyName?: string;
  clientName?: string;
}

export default function InstallationsTabV2(props: Props) {
  const { interfaceMode } = useInterfaceMode();

  // For now, both modes render the original.
  // The v2 card redesign will be layered on top progressively.
  return <InstallationsTab {...props} />;
}
