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
import { useUIVersion } from "@/hooks/useUIVersion";
import RateioTabV2 from "@/components/v2/campaigns/RateioTabV2";
import { useActiveAdjustment } from "@/hooks/useAdjustments";
import { useAdjustmentRateio } from "@/hooks/useAdjustmentRateio";
import { useNegotiationStorePieces } from "@/hooks/useNegotiationStorePieces";
import OccurrencesPortalV2 from "@/pages/v2/OccurrencesPortalV2";
import OccurrencesPortal from "@/pages/OccurrencesPortal";
import CampaignBackupDialog from "@/components/CampaignBackupDialog";



const CampaignDetail = () => {
  const { agencyId, clientId, campaignId } = useParams<{ agencyId: string; clientId: string; campaignId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const locationState = location.state as { initialSection?: string; limitedMode?: boolean } | null;
  const isLimitedMode = locationState?.limitedMode || false;
  const { version } = useUIVersion();

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

  const [activeSection, setActiveSectionState] = useState<string | null>(() => {
    return locationState?.initialSection || new URLSearchParams(location.search).get("section") || "summary";
  });

  // Keep activeSection in sync with URL changes (e.g. from sidebar clicks)
  useEffect(() => {
    const section = new URLSearchParams(location.search).get("section") || "summary";
    if (section !== activeSection) {
      setActiveSectionState(section);
    }
  }, [location.search, activeSection]);

  const setActiveSection = useCallback((section: string | null) => {
    setActiveSectionState(section);
    const params = new URLSearchParams(location.search);
    if (section && section !== "summary") params.set("section", section); 
    else params.delete("section");
    
    navigate(`${location.pathname}${params.toString() ? `?${params}` : ""}`, { replace: true, state: location.state });
  }, [location, navigate]);

  const qtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    storePieces.forEach((sp) => { map[`${sp.store_id}-${sp.piece_id}`] = Number(sp.quantity) || 0; });
    return map;
  }, [storePieces]);

  // ─── Rateio version detection (Original / Negociação / Ajuste) ───
  type RateioSource = "original" | "negotiation" | "adjustment";
  const { data: activeAdjustment, isLoading: loadingActiveAdjustment } = useActiveAdjustment(campaignId);

  const { data: budgetSuppliers = [], isLoading: loadingBudgetSuppliers } = useQuery({
    queryKey: ["budget_suppliers_winner", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data } = await supabase
        .from("budget_suppliers")
        .select("id, company_name, is_winner, negotiation_status")
        .eq("campaign_id", campaignId!);
      return data || [];
    },
  });
  const winnerSupplier = useMemo(
    () => (budgetSuppliers as any[]).find((s) => s.is_winner === true) || null,
    [budgetSuppliers]
  );
  const winnerSupplierId: string | null = winnerSupplier?.id ?? null;
  const winnerSupplierName: string = winnerSupplier?.company_name ?? "";

  const { data: negRateioCount = 0, isLoading: loadingNegRateioCount } = useQuery({
    queryKey: ["has_negotiation_rateio", campaignId, winnerSupplierId],
    enabled: !!campaignId && !!winnerSupplierId,
    queryFn: async () => {
      const { count } = await supabase
        .from("budget_negotiation_store_pieces" as any)
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId!)
        .eq("supplier_id", winnerSupplierId!);
      return count || 0;
    },
  });
  const hasNegotiationRateio = (negRateioCount as number) > 0;

  // The "vigente" source is the most recent: adjustment > negotiation > original
  const vigenteSource: RateioSource =
    activeAdjustment ? "adjustment" : hasNegotiationRateio ? "negotiation" : "original";

  const rateioVersionsReady = !loadingActiveAdjustment && !loadingBudgetSuppliers && (!winnerSupplierId || !loadingNegRateioCount);
  const availableRateioSources = useMemo<RateioSource[]>(() => {
    const sources: RateioSource[] = ["original"];
    if (hasNegotiationRateio && winnerSupplierId) sources.push("negotiation");
    if (activeAdjustment) sources.push("adjustment");
    return sources;
  }, [activeAdjustment, hasNegotiationRateio, winnerSupplierId]);

  const [rateioSource, setRateioSource] = useState<RateioSource | null>(null);
  useEffect(() => {
    if (!rateioVersionsReady) return;
    setRateioSource((current) => {
      if (current && availableRateioSources.includes(current)) return current;
      return vigenteSource;
    });
  }, [availableRateioSources, rateioVersionsReady, vigenteSource]);

  const resolvedRateioSource = rateioSource ?? vigenteSource;
  const isViewingVigente = resolvedRateioSource === vigenteSource;

  // ─── Rateio data overlays per source ───
  // Adjustment overlay: uses campaign_adjustment_store_pieces remapped to base piece ids.
  const { data: adjustmentRateio } = useAdjustmentRateio(
    resolvedRateioSource === "adjustment" ? activeAdjustment?.id : null,
  );
  // Negotiation overlay: budget_negotiation_store_pieces is already keyed by base piece_id.
  const { data: negotiationRows = [] } = useNegotiationStorePieces(
    resolvedRateioSource === "negotiation" ? winnerSupplierId : null,
    campaignId,
    resolvedRateioSource === "negotiation",
  );

  // Pick the qtyMap that matches the currently selected rateio source so the
  // matrix shows the correct quantities for Original / Negociação / Ajuste.
  const matrixQtyMap = useMemo(() => {
    if (resolvedRateioSource === "adjustment" && adjustmentRateio?.qtyMap) {
      return adjustmentRateio.qtyMap;
    }
    if (resolvedRateioSource === "negotiation") {
      const map: Record<string, number> = {};
      for (const row of negotiationRows as any[]) {
        map[`${row.store_id}-${row.piece_id}`] = Number(row.quantity) || 0;
      }
      return map;
    }
    return qtyMap;
  }, [resolvedRateioSource, adjustmentRateio, negotiationRows, qtyMap]);



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
          activeAdjustment={activeAdjustment}
        />

        <Tabs value={activeSection || "summary"} onValueChange={setActiveSection} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="summary">{t("tabs.summary", "Resumo")}</TabsTrigger>
            <TabsTrigger value="pieces">{t("tabs.pieces", "Peças")}</TabsTrigger>
            <TabsTrigger value="matrix">{t("tabs.rateio", "Rateio")}</TabsTrigger>
            {isAdmin && <TabsTrigger value="budgets">{t("tabs.cotacoes", "Cotações")}</TabsTrigger>}
            <TabsTrigger value="occurrences">{t("occurrences.portal.title")}</TabsTrigger>
            <TabsTrigger value="scheduling" className="hidden">Agendamento</TabsTrigger>
            <TabsTrigger value="installations" className="hidden">Instalações</TabsTrigger>
            <TabsTrigger value="approvals" className="hidden">Aprovações</TabsTrigger>
            <TabsTrigger value="adjustments" className="hidden">Ajustes</TabsTrigger>

            <TabsTrigger value="stores" className="hidden">Lojas</TabsTrigger>
            <TabsTrigger value="history" className="hidden">Histórico</TabsTrigger>
            <TabsTrigger value="mockup" className="hidden">Mockup</TabsTrigger>
            <TabsTrigger value="loja_a_loja" className="hidden">Loja a Loja</TabsTrigger>
          </TabsList>

          <TabErrorBoundary>
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
              {version === "v2" ? (
                <RateioTabV2 
                  campaignId={campaignId!} clientId={clientId!} campaign={campaign} agency={agency} client={client}
                  pieces={pieces} kits={kits} kitPieces={kitPieces} stores={stores} qtyMap={matrixQtyMap}
                  canEditCampaignStores={true} 
                  activeAdjustment={activeAdjustment} 
                  hasNegotiationRateio={hasNegotiationRateio}
                  winnerSupplierId={winnerSupplierId} 
                  winnerSupplierName={winnerSupplierName} 
                  rateioSource={resolvedRateioSource}
                  setRateioSource={setRateioSource}
                  vigenteSource={vigenteSource} 
                  isViewingVigente={isViewingVigente}
                  handleResetNegotiationRateio={() => {}} 
                  handleCancelNegotiationRateio={() => {}}
                  isNegotiationView={false} 
                  hasAnyAdjustment={!!activeAdjustment} 
                  setActiveSection={setActiveSection}
                />
              ) : (
                <MatrixTab 
                  campaignId={campaignId!} clientId={clientId!} campaign={campaign} agency={agency} client={client}
                  pieces={pieces} kits={kits} kitPieces={kitPieces} stores={stores} qtyMap={matrixQtyMap}
                  canEditCampaignStores={true} 
                  activeAdjustment={activeAdjustment} 
                  hasNegotiationRateio={hasNegotiationRateio}
                  winnerSupplierId={winnerSupplierId} 
                  winnerSupplierName={winnerSupplierName} 
                  rateioSource={resolvedRateioSource}
                  setRateioSource={setRateioSource}
                  vigenteSource={vigenteSource} 
                  isViewingVigente={isViewingVigente}
                  handleResetNegotiationRateio={() => {}} 
                  handleCancelNegotiationRateio={() => {}}
                  isNegotiationView={false} 
                  hasAnyAdjustment={!!activeAdjustment} 
                  setActiveSection={setActiveSection}
                />
              )}
            </TabsContent>
            <TabsContent value="adjustments">
              <Suspense fallback={<div className="p-8 text-center text-muted-foreground italic">Carregando aba...</div>}>
                <ApprovalsTab 
                  campaignId={campaignId!} campaignName={campaign.name} pieces={pieces}
                  kits={kits} kitPieces={kitPieces} storePieces={storePieces} stores={stores}
                  agencyName={agency?.name || ""} clientName={client?.name || ""}
                  currencyCode="BRL" isAdminOrMaster={isAdminOrMaster}
                  winnerSupplierId={winnerSupplierId}
                  hasNegotiationRateio={hasNegotiationRateio}
                  onBackToBudgets={() => setActiveSection("budgets")}
                />
              </Suspense>
            </TabsContent>
            <TabsContent value="budgets">
              <BudgetTab 
                campaignId={campaignId!} clientId={clientId!} 
                campaignName={campaign.name} agencyName={agency?.name || ""}
                pieces={pieces} kits={kits} kitPieces={kitPieces} qtyMap={qtyMap}
                stores={stores} isAdmin={isAdmin}
              />
            </TabsContent>


            <Suspense fallback={<div className="p-8 text-center text-muted-foreground italic">Carregando aba...</div>}>
              <TabsContent value="occurrences">
                {version === "v2" ? (
                  <OccurrencesPortalV2 />
                ) : (
                  <OccurrencesPortal />
                )}
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
