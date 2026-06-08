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
  // Removido breadcrumb e label "Contexto" conforme solicitado.
  // O nome da agência agora aparece em destaque na seção AGÊNCIA abaixo.
  return null;
}
