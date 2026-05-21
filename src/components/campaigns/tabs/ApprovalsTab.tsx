import React from "react";
import AdjustmentsTab from "@/components/AdjustmentsTab";

interface ApprovalsTabProps {
  campaignId: string;
  campaignName: string;
  pieces: any[];
  kits: any[];
  kitPieces: any[];
  storePieces: any[];
  stores: any[];
  agencyName: string;
  clientName: string;
  currencyCode: string;
  isAdminOrMaster: boolean;
  winnerSupplierId?: string | null;
  hasNegotiationRateio?: boolean;
  onBackToBudgets?: () => void;
}

export default function ApprovalsTab({ 
  campaignId, 
  campaignName,
  pieces,
  kits,
  kitPieces,
  storePieces,
  stores,
  agencyName,
  clientName,
  currencyCode,
  isAdminOrMaster,
  winnerSupplierId,
  hasNegotiationRateio
}: ApprovalsTabProps) {
  return (
    <AdjustmentsTab 
      campaignId={campaignId}
      campaignName={campaignName}
      pieces={pieces}
      kits={kits}
      kitPieces={kitPieces}
      storePieces={storePieces}
      stores={stores}
      agencyName={agencyName}
      clientName={clientName}
      currencyCode={currencyCode}
      winnerSupplierId={winnerSupplierId}
      hasNegotiationRateio={hasNegotiationRateio}
    />
  );
}