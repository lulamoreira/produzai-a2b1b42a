import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Megaphone } from "lucide-react";
import PortalDashboard from "@/components/LojaALoja/PortalDashboard";
import OccurrenceInviteDialog from "@/components/LojaALoja/OccurrenceInviteDialog";

interface OccurrencesTabProps {
  campaignId: string;
  clientId: string;
  lalPerms: any;
}

export default function OccurrencesTab({ campaignId, clientId, lalPerms }: OccurrencesTabProps) {
  const { t } = useTranslation();
  const [inviteOpen, setInviteOpen] = useState(false);

  if (lalPerms?.isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  }
  
  if (!lalPerms?.ocorrencias?.canView) {
    return <div className="p-8 text-center text-muted-foreground">Você não tem acesso a este módulo.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end px-1">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setInviteOpen(true)} 
          className="gap-1.5"
        >
          <Megaphone className="h-4 w-4" />
          {t("lojaAloja.inviteStores", "Convocar lojistas")}
        </Button>
      </div>

      <PortalDashboard 
        campaignId={campaignId} 
        clientId={clientId}
        permissions={{
          canView: lalPerms?.ocorrencias?.canView || false,
          canEdit: lalPerms?.ocorrencias?.canEdit || false,
          canDelete: lalPerms?.ocorrencias?.canDelete || false
        }}
      />

      <OccurrenceInviteDialog 
        open={inviteOpen} 
        onOpenChange={setInviteOpen} 
        campaignId={campaignId} 
        clientId={clientId}
      />
    </div>
  );
}
