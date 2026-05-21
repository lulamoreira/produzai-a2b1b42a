import React from "react";
import AdjustmentsTab from "@/components/AdjustmentsTab";

interface ApprovalsTabProps {
  campaignId: string;
  isAdminOrMaster: boolean;
}

export default function ApprovalsTab({ campaignId, isAdminOrMaster }: ApprovalsTabProps) {
  return (
    <AdjustmentsTab 
      campaignId={campaignId} 
      isAdminOrMaster={isAdminOrMaster} 
    />
  );
}