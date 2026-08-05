import PortalDashboard from "@/components/LojaALoja/PortalDashboard";

interface OccurrencesTabProps {
  campaignId: string;
  clientId: string;
  lalPerms: any;
}

export default function OccurrencesTab({ campaignId, clientId, lalPerms }: OccurrencesTabProps) {
  if (lalPerms?.isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  }
  
  if (!lalPerms?.ocorrencias?.canView) {
    return <div className="p-8 text-center text-muted-foreground">Você não tem acesso a este módulo.</div>;
  }

  return (
    <div className="space-y-6">
      <PortalDashboard 
        campaignId={campaignId} 
        clientId={clientId}
        permissions={{
          canView: lalPerms.ocorrencias.canView,
          canEdit: lalPerms.ocorrencias.canEdit,
          canDelete: lalPerms.ocorrencias.canDelete
        }}
      />
    </div>
  );
}

