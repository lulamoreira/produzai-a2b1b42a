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
  /** Loja a ser focada via deep link (ex.: notificação de nova foto de instalação) */
  focusStoreId?: string | null;
}

export default function InstallationsTab({ 
  campaignId, 
  campaignName,
  stores, 
  canEdit,
  clientId,
  agencyName,
  clientName,
  focusStoreId = null
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
      focusStoreId={focusStoreId}
    />
  );
}
