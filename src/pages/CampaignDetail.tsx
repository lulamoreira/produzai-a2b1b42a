import { Fragment, useState, useMemo, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  useCampaign, useClient, useClientStores, useCampaignPieces, useCampaignStorePieces,
  useAddCampaignPiece, useDeleteCampaignPiece, useUpdateCampaignPiece, useUpdateCampaignStorePiece, useUpdateCampaign,
  useCampaignPieceLocations, useAddCampaignPieceLocation, useDeleteCampaignPieceLocation,
  useCampaignPieceSubLocations,
  useUpdateClientStore,
  useCampaignStoreStatus, useUpsertCampaignStoreStatus, useBulkUpsertCampaignStoreStatus,
  useClientStoreModels,
  useCampaignKits, useAddCampaignKit, useDeleteCampaignKit, useUpdateCampaignKit,
  useCampaignKitPieces, useAddCampaignKitPiece, useDeleteCampaignKitPiece, useUpdateCampaignKitPiece, useReorderCampaignKitPieces,
  useBulkUpdateCampaignStorePieces,
} from "@/hooks/useMultiClientData";
import { useClientPermission } from "@/hooks/useClientPermission";
import { useUserRole } from "@/hooks/useUserRole";
import { useLojaALojaPermissions } from "@/hooks/useLojaALojaPermissions";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignHeader } from "@/components/campaigns/CampaignHeader";
import {
  SummaryTab, PiecesTab, OccurrencesTab, SchedulingTab, InstallationsTab,
  BudgetTab, ApprovalsTab, MatrixTab, StoresTab, HistoryTab, MockupTab, LojaALojaTab
} from "@/components/campaigns/tabs";
import TabErrorBoundary from "@/components/campaigns/TabErrorBoundary";

const CampaignDetail = () => {
  const { agencyId, clientId, campaignId } = useParams<{ agencyId: string; clientId: string; campaignId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const locationState = location.state as { initialSection?: string; limitedMode?: boolean } | null;
  const isLimitedMode = locationState?.limitedMode || false;

  const { isAdmin, isAdminOrMaster } = useUserRole();
  const lalPerms = useLojaALojaPermissions(campaignId, clientId);
  const { data: campaign, isLoading: loadingCampaign } = useCampaign(campaignId);
  const { data: client } = useClient(clientId);
  const { data: agency } = useQuery({
    queryKey: ["agency", agencyId],
    queryFn: async () => {
      const { data } = await supabase.from("agencies").select("name, color").eq("id", agencyId).maybeSingle();
      return data;
    },
    enabled: !!agencyId,
  });

  const { data: stores = [] } = useClientStores(clientId);
  const { data: pieces = [] } = useCampaignPieces(campaignId);
  const { data: storePieces = [] } = useCampaignStorePieces(campaignId);
  const { data: kits = [] } = useCampaignKits(campaignId);
  const { data: kitPieces = [] } = useCampaignKitPieces(campaignId);
  const { data: campaignStoreStatus = [] } = useCampaignStoreStatus(campaignId);
  const { data: pieceLocations = [] } = useCampaignPieceLocations(campaignId);
  const { data: pieceSubLocations = [] } = useCampaignPieceSubLocations(campaignId);

  const [activeSection, setActiveSectionState] = useState<string | null>(locationState?.initialSection || new URLSearchParams(location.search).get("section") || null);

  const setActiveSection = useCallback((section: string | null) => {
    setActiveSectionState(section);
    const params = new URLSearchParams(location.search);
    if (section) params.set("section", section); else params.delete("section");
    navigate(`${location.pathname}${params.toString() ? `?${params}` : ""}`, { replace: true, state: location.state });
  }, [location, navigate]);

  const qtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    storePieces.forEach((sp) => { map[`${sp.store_id}-${sp.piece_id}`] = Number(sp.quantity) || 0; });
    return map;
  }, [storePieces]);

  if (loadingCampaign) return <div className="flex h-screen items-center justify-center">Carregando...</div>;
  if (!campaign) return <div className="flex h-screen items-center justify-center">Campanha não encontrada</div>;

  return (
    <AppLayout breadcrumbs={[{ label: campaign.name }]}>
      <div className="container mx-auto py-6">
        <CampaignHeader 
          campaign={campaign} agency={agency} client={client} 
          isAdminOrMaster={isAdminOrMaster} canEditCampaign={true}
          onRename={() => {}} onBackup={() => {}} onOpenSection={setActiveSection}
          pieces={pieces} kits={kits} kitPieces={kitPieces}
        />

        <Tabs value={activeSection || "summary"} onValueChange={setActiveSection} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="summary">Resumo</TabsTrigger>
            <TabsTrigger value="pieces">Peças</TabsTrigger>
            <TabsTrigger value="matrix">Matriz</TabsTrigger>
            {isAdmin && <TabsTrigger value="budgets">Orçamentos</TabsTrigger>}
            <TabsTrigger value="occurrences" className="hidden">Ocorrências</TabsTrigger>
            <TabsTrigger value="scheduling" className="hidden">Agendamento</TabsTrigger>
            <TabsTrigger value="installations" className="hidden">Instalações</TabsTrigger>
            <TabsTrigger value="approvals" className="hidden">Aprovações</TabsTrigger>
            <TabsTrigger value="stores" className="hidden">Lojas</TabsTrigger>
            <TabsTrigger value="history" className="hidden">Histórico</TabsTrigger>
            <TabsTrigger value="mockup" className="hidden">Mockup</TabsTrigger>
            <TabsTrigger value="loja_a_loja" className="hidden">Loja a Loja</TabsTrigger>
          </TabsList>

          <TabErrorBoundary>
            <Suspense fallback={<div className="p-8 text-center text-muted-foreground italic">Carregando aba...</div>}>
              <TabsContent value="summary">
                <SummaryTab 
                  campaignId={campaignId!} stores={stores} visiblePieces={pieces} kits={kits}
                  canEditCampaign={true} canViewSchedules={true} canViewInstallations={true}
                  lalPerms={lalPerms} canViewStores={true} canViewCampaignStores={true}
                  isAdmin={isAdmin} isAdminOrMaster={isAdminOrMaster} canViewPieces={true}
                  onNavigate={setActiveSection}
                />
              </TabsContent>
              <TabsContent value="pieces">
                <PiecesTab 
                  campaignId={campaignId!} clientId={clientId!} campaign={campaign} agency={agency} client={client}
                  pieces={pieces} kits={kits} kitPieces={kitPieces} stores={stores} qtyMap={qtyMap}
                  canEditPieces={true} canDeletePieces={true} pieceLocations={pieceLocations} pieceSubLocations={pieceSubLocations}
                  addPiece={{}} updatePiece={{}} deletePiece={{}} addKit={{}} updateKit={{}} deleteKit={{}}
                  addKitPiece={{}} updateKitPiece={{}} deleteKitPiece={{}} reorderKitPieces={{}}
                  handleRecodificar={() => {}} handleReviewPieceCodes={() => {}} handleDistributePiece={() => {}}
                />
              </TabsContent>
              <TabsContent value="matrix">
                <MatrixTab 
                  campaignId={campaignId!} clientId={clientId!} campaign={campaign} agency={agency} client={client}
                  pieces={pieces} kits={kits} kitPieces={kitPieces} stores={stores} qtyMap={qtyMap}
                  canEditCampaignStores={true} activeAdjustment={null} hasNegotiationRateio={false}
                  winnerSupplierId={null} winnerSupplierName="" rateioSource="original"
                  setRateioSource={() => {}} vigenteSource="original" isViewingVigente={true}
                  handleResetNegotiationRateio={() => {}} handleCancelNegotiationRateio={() => {}}
                  isNegotiationView={false} hasAnyAdjustment={false} setActiveSection={setActiveSection}
                />
              </TabsContent>
              <TabsContent value="budgets">
                <BudgetTab 
                  campaignId={campaignId!} clientId={clientId!} 
                  campaignName={campaign.name} agencyName={agency?.name || ""}
                  pieces={pieces} kits={kits} kitPieces={kitPieces} qtyMap={qtyMap}
                  stores={stores} isAdmin={isAdmin}
                />
              </TabsContent>
              <TabsContent value="occurrences">
                <OccurrencesTab campaignId={campaignId!} clientId={clientId!} lalPerms={lalPerms} />
              </TabsContent>
              <TabsContent value="scheduling">
                <SchedulingTab 
                  campaignId={campaignId!} stores={stores} canEdit={true}
                  agencyName={agency?.name || ""} clientName={client?.name || ""} 
                  campaignName={campaign.name} clientId={clientId!} 
                />
              </TabsContent>
              <TabsContent value="installations">
                <InstallationsTab 
                  campaignId={campaignId!} campaignName={campaign.name} stores={stores}
                  canEdit={true} clientId={clientId!} agencyName={agency?.name || ""}
                  clientName={client?.name || ""}
                />
              </TabsContent>
              <TabsContent value="approvals">
                <ApprovalsTab 
                  campaignId={campaignId!} campaignName={campaign.name} pieces={pieces}
                  kits={kits} kitPieces={kitPieces} storePieces={storePieces} stores={stores}
                  agencyName={agency?.name || ""} clientName={client?.name || ""}
                  currencyCode="BRL" isAdminOrMaster={isAdminOrMaster}
                />
              </TabsContent>
              <TabsContent value="stores">
                <StoresTab 
                  campaignId={campaignId!} clientId={clientId!} stores={stores}
                  canEditStores={true} canEditCampaignStores={true} isLimitedMode={isLimitedMode}
                  onOpenEditStore={() => {}} agencyName={agency?.name || ""} clientName={client?.name || ""}
                />
              </TabsContent>
              <TabsContent value="history">
                <HistoryTab campaignId={campaignId!} />
              </TabsContent>
              <TabsContent value="mockup">
                <MockupTab 
                  campaignId={campaignId!} campaignName={campaign.name} 
                  pieces={pieces} kits={kits} kitPieces={kitPieces} 
                />
              </TabsContent>
              <TabsContent value="loja_a_loja">
                <LojaALojaTab campaignId={campaignId!} clientId={clientId!} lalPerms={lalPerms} />
              </TabsContent>
            </Suspense>
          </TabErrorBoundary>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default CampaignDetail;