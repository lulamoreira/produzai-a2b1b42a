import React from "react";
import InstallationsTabComponent from "@/components/InstallationsTab";

interface InstallationsTabProps {
  campaignId: string;
  campaignName: string;
  stores: any[];
  canEdit: boolean;
  clientId: string;
  agencyName: string;
  clientName: string;
}

export default function InstallationsTab({ 
  campaignId, 
  campaignName,
  stores, 
  canEdit,
  clientId,
  agencyName,
  clientName
}: InstallationsTabProps) {
  return (
    <InstallationsTabComponent
      campaignId={campaignId}
      campaignName={campaignName}
      stores={stores}
      canEdit={canEdit}
      clientId={clientId}
      agencyName={agencyName}
      clientName={clientName}
    />
  );
}