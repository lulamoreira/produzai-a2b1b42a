/**
 * OccurrencesTabV2 — wrapper for interface mode routing.
 * Renders original OccurrencesTab in both modes for now.
 * V2 card redesign will be layered incrementally.
 */
import { useInterfaceMode } from "@/hooks/useInterfaceMode";
import OccurrencesTab from "@/components/OccurrencesTab";
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
  return <OccurrencesTab {...props} />;
}
