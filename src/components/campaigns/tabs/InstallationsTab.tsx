import React from "react";
import InstallationsTabComponent from "@/components/InstallationsTab";

interface InstallationsTabProps {
  campaignId: string;
  stores: any[];
  canEdit: boolean;
}

export default function InstallationsTab({ campaignId, stores, canEdit }: InstallationsTabProps) {
  return (
    <InstallationsTabComponent
      campaignId={campaignId}
      stores={stores}
      canEdit={canEdit}
    />
  );
}