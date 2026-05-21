import React from "react";
import SchedulingTabComponent from "@/components/SchedulingTab";

interface SchedulingTabProps {
  campaignId: string;
  stores: any[];
  canEdit: boolean;
}

export default function SchedulingTab({ campaignId, stores, canEdit }: SchedulingTabProps) {
  return (
    <SchedulingTabComponent
      campaignId={campaignId}
      stores={stores}
      canEdit={canEdit}
    />
  );
}