import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminOccurrenceDialog from "@/components/occurrences/AdminOccurrenceDialog";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Megaphone, Plus } from "lucide-react";
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
  const [newOccOpen, setNewOccOpen] = useState(false);

  // Ocorrências existem só na versão mais recente da cadeia de renegociação.
  const { data: latestCampaignId, isFetched: latestFetched } = useQuery({
    queryKey: ["latest-campaign-in-chain", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_latest_campaign_in_chain", { p_campaign_id: campaignId });
      if (error) return null;
      return (data as string | null) ?? null;
    },
    enabled: !!campaignId && isAdminOrMaster,
    staleTime: 60_000,
  });
  const canCreateInternal = isAdminOrMaster && latestFetched && (!latestCampaignId || latestCampaignId === campaignId);

  if (lalPerms?.isLoading) {
    return <div className="p-4">Carregando...</div>;
  }

  if (!lalPerms?.ocorrencias?.canView) {
    return <div className="p-4">Você não tem acesso a este módulo.</div>;
  }

  return (
    <div className="space-y-4">
      {isAdminOrMaster && (
        <div className="flex flex-wrap justify-end gap-2">
          {canCreateInternal && (
            <Button variant="outline" onClick={() => setNewOccOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              NOVA OCORRÊNCIA
            </Button>
          )}
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

      {canCreateInternal && (
        <AdminOccurrenceDialog open={newOccOpen} onOpenChange={setNewOccOpen} campaignId={campaignId} clientId={clientId} />
      )}

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
