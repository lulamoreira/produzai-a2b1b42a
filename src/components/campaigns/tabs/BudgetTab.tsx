import React from "react";
import BudgetTabComponent from "@/components/Budget/BudgetTab";

interface BudgetTabProps {
  campaignId: string;
  clientId: string;
  agencyId: string;
  campaignName: string;
  agencyName: string;
  pieces: any[];
  kits: any[];
  kitPieces: any[];
  qtyMap: Record<string, number>;
  stores: any[];
  isAdmin: boolean;
}

export default function BudgetTab({ 
  campaignId, 
  clientId,
  agencyId,
  campaignName,
  agencyName,
  pieces = [],
  kits = [],
  kitPieces = [],
  qtyMap = {},
  stores = [],
  isAdmin 
}: BudgetTabProps) {
  return (
    <BudgetTabComponent
      campaignId={campaignId}
      clientId={clientId}
      agencyId={agencyId}
      campaignName={campaignName}
      agencyName={agencyName}
      pieces={pieces}
      kits={kits}
      kitPieces={kitPieces}
      qtyMap={qtyMap}
      stores={stores}
    />
  );
}
