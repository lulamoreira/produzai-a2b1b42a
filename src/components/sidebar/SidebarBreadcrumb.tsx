import { Link } from "react-router-dom";

interface Props {
  collapsed: boolean;
  agencyName?: string | null;
  clientName?: string | null;
  campaignName?: string | null;
  agencyId?: string;
  clientId?: string;
  campaignId?: string;
}

export function SidebarBreadcrumb({ 
  collapsed, 
  agencyName, 
  clientName, 
  campaignName,
  agencyId,
  clientId,
  campaignId
}: Props) {
  if (collapsed) return null;
  
  const parts = [
    { name: agencyName, path: agencyId ? `/agency/${agencyId}` : null },
    { name: clientName, path: (agencyId && clientId) ? `/agency/${agencyId}/clients/${clientId}` : null },
    { name: campaignName, path: (agencyId && clientId && campaignId) ? `/agency/${agencyId}/clients/${clientId}/campaigns/${campaignId}` : null }
  ].filter(p => !!p.name);

  if (parts.length === 0) return null;

  return (
    null; // Removido breadcrumb conforme solicitado
  );
}
