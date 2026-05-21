import React from "react";
import SchedulingTabComponent from "@/components/SchedulingTab";

interface SchedulingTabProps {
  campaignId: string;
  stores: any[];
  canEdit: boolean;
  agencyName: string;
  clientName: string;
  campaignName: string;
  clientId: string;
}

export default function SchedulingTab({ 
  campaignId, 
  stores, 
  canEdit,
  agencyName,
  clientName,
  campaignName,
  clientId
}: SchedulingTabProps) {
  return (
    <SchedulingTabComponent
      campaignId={campaignId}
      stores={stores}
      canEdit={canEdit}
      agencyName={agencyName}
      clientName={clientName}
      campaignName={campaignName}
      clientId={clientId}
    />
  );
}