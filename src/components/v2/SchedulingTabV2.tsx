/**
 * SchedulingTabV2 — wrapper for interface mode routing.
 * Renders original SchedulingTab in both modes for now.
 * V2 card redesign will be layered incrementally.
 */
import { useInterfaceMode } from "@/hooks/useInterfaceMode";
import SchedulingTab from "@/components/SchedulingTab";
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
  return <SchedulingTab {...props} />;
}
