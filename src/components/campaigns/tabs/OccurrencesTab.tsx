import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Megaphone } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import PortalDashboard from "@/components/LojaALoja/PortalDashboard";
import OccurrenceInviteDialog from "@/components/LojaALoja/OccurrenceInviteDialog";

interface OccurrencesTabProps {
  campaignId: string;
  clientId: string;
  lalPerms: any;
}

export default function OccurrencesTab({ campaignId, clientId, lalPerms }: OccurrencesTabProps) {
  const { t } = useTranslation();
  const { isAdminOrMaster } = useUserRole();
  const [inviteOpen, setInviteOpen] = useState(false);

  if (lalPerms?.isLoading) {
    return <div className="p-4">Carregando...</div>;
  }

  if (!lalPerms?.ocorrencias?.canView) {
    return <div className="p-4">Você não tem acesso a este módulo.</div>;
  }

  return (
    <div className="space-y-4">
      {isAdminOrMaster && (
        <div className="flex justify-end">
          <Button onClick={() => setInviteOpen(true)} className="gap-1.5">
            <Megaphone className="h-4 w-4" />
            {t("lojaAloja.inviteStores", "Convocar lojistas")}
          </Button>
        </div>
      )}

      <PortalDashboard 
        campaignId={campaignId} 
        clientId={clientId} 
        permissions={lalPerms.ocorrencias} 
      />

      {isAdminOrMaster && (
        <OccurrenceInviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          campaignId={campaignId}
          clientId={clientId}
        />
      )}
    </div>
  );
}
