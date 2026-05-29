import { Fragment, useState, useMemo, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { capitalizeName } from "@/lib/utils";
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
import { useUserDirectAccess } from "@/hooks/useUserDirectAccess";
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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const locationState = location.state as { initialSection?: string; limitedMode?: boolean } | null;
  const isLimitedMode = locationState?.limitedMode || false;
  const { version } = useUIVersion();

  const { isAdmin, isAdminOrMaster } = useUserRole();
  const { isLimited, campaigns: myCampaigns } = useUserDirectAccess();
  const myCampaignAccess = myCampaigns.find(c => c.campaignId === campaignId);
  const userModules = myCampaignAccess?.modules ?? [];
  const hasModule = (mod: string) => !isLimited || userModules.includes(mod);


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
  const { data: pieces = [], refetch: refetchPieces } = useCampaignPieces(campaignId);
  const { data: storePieces = [], isLoading: loadingStorePieces, isFetching: fetchingStorePieces } = useCampaignStorePieces(campaignId);
  const { data: kits = [] } = useCampaignKits(campaignId);
  const { data: kitPieces = [] } = useCampaignKitPieces(campaignId);
  const { data: campaignStoreStatus = [] } = useCampaignStoreStatus(campaignId);
  const { data: pieceLocations = [] } = useCampaignPieceLocations(campaignId);
  const { data: pieceSubLocations = [] } = useCampaignPieceSubLocations(campaignId);

  const { data: campaignKpis } = useQuery({
    queryKey: ["campaign-summary-kpis", campaignId],
    queryFn: async () => {
      const storesRes = await (supabase.from("client_stores") as any).select("id", { count: "exact", head: true }).eq("campaign_id", campaignId);
      const piecesRes = await (supabase.from("pieces") as any).select("id", { count: "exact", head: true }).eq("campaign_id", campaignId);
      const pendingInstallationsRes = await (supabase.from("campaign_schedules") as any).select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).is("completed_at", null);
      const pendingApprovalsRes = await (supabase.from("user_approvals" as any).select("id", { count: "exact", head: true }) as any).eq("campaign_id", campaignId).eq("status", "pending");

      return {
        stores: storesRes.count || 0,
        pieces: piecesRes.count || 0,
        pendingInstallations: pendingInstallationsRes.count || 0,
        pendingApprovals: pendingApprovalsRes.count || 0
      };
    },
    enabled: !!campaignId
  });

  const updateCampaign = useUpdateCampaign();
  const addPiece = useAddCampaignPiece();
  const updatePiece = useUpdateCampaignPiece();
  const deletePiece = useDeleteCampaignPiece();
  const addKit = useAddCampaignKit();
  const updateKit = useUpdateCampaignKit();
  const deleteKit = useDeleteCampaignKit();
  const addKitPiece = useAddCampaignKitPiece();
  const updateKitPiece = useUpdateCampaignKitPiece();
  const deleteKitPiece = useDeleteCampaignKitPiece();
  const reorderKitPieces = useReorderCampaignKitPieces();


  const [activeSection, setActiveSectionState] = useState<string | null>(() => {
    return locationState?.initialSection || new URLSearchParams(location.search).get("section") || "summary";
  });
  const [backupOpen, setBackupOpen] = useState(false);

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

  useEffect(() => {
    if (!isLimited || !activeSection || activeSection === "summary") return;
    if (userModules.length === 0) return;
    if (!userModules.includes(activeSection)) {
      setActiveSection(userModules[0] ?? "summary");
    }
  }, [activeSection, isLimited, userModules, setActiveSection]);

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
  
  // Restricted access check for inactive campaigns
  if (campaign && campaign.is_active === false && !isAdminOrMaster) {
    return (
      <AppLayout breadcrumbs={[{ label: t("campaign.unavailable", "Campanha indisponível") }]}>
        <div className="container mx-auto py-24 flex flex-col items-center justify-center text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500" />
          <h1 className="text-2xl font-bold">{t("campaign.unavailable_title", "Campanha indisponível")}</h1>
          <p className="text-muted-foreground max-w-md">
            {t("campaign.unavailable_description", "Esta campanha foi inativada e não está acessível no momento.")}
          </p>
          <Button onClick={() => navigate(-1)} variant="outline">
            {t("common.back", "Voltar")}
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (!campaign) return <div className="flex h-screen items-center justify-center">Campanha não encontrada</div>;

  return (
    <AppLayout breadcrumbs={[{ label: campaign.name }]}>
      <div className="container mx-auto py-6">
        <CampaignHeader 
          campaign={campaign} agency={agency} client={client} 
          isAdminOrMaster={isAdminOrMaster} canEditCampaign={true}
          onRename={async () => {
            const newName = prompt(t("clientDashboard.renameCampaign"), campaign.name);
            if (newName && newName.trim() !== campaign.name) {
              const formattedName = capitalizeName(newName.trim());
              await updateCampaign.mutateAsync({ id: campaignId!, name: formattedName });
            }
          }} onBackup={() => setBackupOpen(true)} onOpenSection={setActiveSection}
          pieces={pieces} kits={kits} kitPieces={kitPieces}
          activeAdjustment={activeAdjustment}
        />

        <CampaignBackupDialog
          open={backupOpen}
          onOpenChange={setBackupOpen}
          campaignId={campaignId!}
          campaignName={campaign.name}
        />

        <Tabs value={activeSection || "summary"} onValueChange={setActiveSection} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="summary">{t("tabs.summary", "Resumo")}</TabsTrigger>
            {hasModule("pieces") && <TabsTrigger value="pieces">{t("tabs.pieces", "Peças")}</TabsTrigger>}
            {hasModule("matrix") && <TabsTrigger value="matrix">{t("tabs.rateio", "Rateio")}</TabsTrigger>}
            {isAdmin && <TabsTrigger value="budgets">{t("tabs.cotacoes", "Cotações")}</TabsTrigger>}
            {hasModule("occurrences") && <TabsTrigger value="occurrences">{t("occurrences.title", "Ocorrências")}</TabsTrigger>}
            {hasModule("scheduling") && <TabsTrigger value="scheduling" className="hidden">Agendamento</TabsTrigger>}
            {hasModule("installations") && <TabsTrigger value="installations" className="hidden">Instalações</TabsTrigger>}
            <TabsTrigger value="approvals" className="hidden">Aprovações</TabsTrigger>
            {hasModule("adjustments") && <TabsTrigger value="adjustments" className="hidden">Ajustes</TabsTrigger>}

            {hasModule("stores") && <TabsTrigger value="stores" className="hidden">Lojas</TabsTrigger>}
            <TabsTrigger value="history" className="hidden">Histórico</TabsTrigger>
            {hasModule("mockup") && <TabsTrigger value="mockup" className="hidden">Mockup</TabsTrigger>}
            {hasModule("loja_a_loja") && <TabsTrigger value="loja_a_loja" className="hidden">Loja a Loja</TabsTrigger>}
          </TabsList>

          <TabErrorBoundary>
            <TabsContent value="summary">
              <SummaryTab 
                campaignId={campaignId!} stores={stores} visiblePieces={pieces} kits={kits}
                canEditCampaign={true} 
                canViewSchedules={hasModule("scheduling")} 
                canViewInstallations={hasModule("installations")}
                canViewOccurrences={hasModule("occurrences")}
                lalPerms={lalPerms} 
                canViewStores={hasModule("stores")} 
                canViewCampaignStores={hasModule("matrix")}
                isAdmin={isAdmin} isAdminOrMaster={isAdminOrMaster} 
                canViewPieces={hasModule("pieces")}
                onNavigate={setActiveSection}
                campaignKpis={campaignKpis}
              />

            </TabsContent>
            <TabsContent value="pieces">
              <PiecesTab 
                campaignId={campaignId!} clientId={clientId!} campaign={campaign} agency={agency} client={client}
                pieces={pieces} kits={kits} kitPieces={kitPieces} stores={stores} qtyMap={qtyMap}
                canEditPieces={true} canDeletePieces={true} pieceLocations={pieceLocations} pieceSubLocations={pieceSubLocations}
                addPiece={addPiece} updatePiece={updatePiece} deletePiece={deletePiece} addKit={addKit} updateKit={updateKit} deleteKit={deleteKit}
                addKitPiece={addKitPiece} updateKitPiece={updateKitPiece} deleteKitPiece={deleteKitPiece} reorderKitPieces={reorderKitPieces}
                handleRecodificar={async () => {
                  if (!confirm(t("pieces.confirmRecode", "Deseja realmente recodificar todas as peças e kits? Isso atribuirá novos códigos sequenciais baseados na ordem de exibição."))) return;
                  
                  const toastId = toast.loading("Recodificando...");
                  try {
                    const allItems = [
                      ...pieces.map(p => ({ id: p.id, type: 'piece', display_order: p.display_order })),
                      ...kits.map(k => ({ id: k.id, type: 'kit', display_order: k.display_order }))
                    ].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

                    for (let i = 0; i < allItems.length; i++) {
                      const item = allItems[i];
                      const newCode = i + 1;
                      if (item.type === 'piece') {
                        await updatePiece.mutateAsync({ id: item.id, code: newCode });
                      } else {
                        await updateKit.mutateAsync({ id: item.id, code: newCode });
                      }
                    }

                    toast.success("Recodificação concluída!", { id: toastId });
                  } catch (error: any) {
                    toast.error("Erro ao recodificar: " + error.message, { id: toastId });
                  }
                }} 
                handleReviewPieceCodes={() => {
                  const codes = new Map<number, string[]>();
                  const missing: string[] = [];

                  pieces.forEach(p => {
                    if (!p.code) missing.push(`Peça: ${p.name}`);
                    else {
                      const existing = codes.get(p.code) || [];
                      existing.push(`Peça: ${p.name}`);
                      codes.set(p.code, existing);
                    }
                  });

                  kits.forEach(k => {
                    if (!k.code) missing.push(`Kit: ${k.name}`);
                    else {
                      const existing = codes.get(k.code) || [];
                      existing.push(`Kit: ${k.name}`);
                      codes.set(k.code, existing);
                    }
                  });

                  const duplicates = Array.from(codes.entries()).filter(([_, items]) => items.length > 1);

                  if (duplicates.length === 0 && missing.length === 0) {
                    toast.success("Nenhum problema encontrado nos códigos!");
                  } else {
                    let msg = "";
                    if (duplicates.length > 0) {
                      msg += "Códigos duplicados encontrados:\n" + duplicates.map(([code, items]) => `Código ${code}: ${items.join(", ")}`).join("\n");
                    }
                    if (missing.length > 0) {
                      msg += (msg ? "\n\n" : "") + "Peças/Kits sem código:\n" + missing.join(", ");
                    }
                    alert(msg);
                  }
                }} 
                handleDistributePiece={async (piece: any) => {
                  const isDistributed = stores.some(s => qtyMap[`${s.id}-${piece.id}`] > 0);
                  
                  if (isDistributed) {
                    if (!confirm(`Deseja remover a peça "${piece.name}" de todas as lojas?`)) return;
                    const toastId = toast.loading("Removendo distribuição...");
                    try {
                      const distributedStores = stores.filter(s => qtyMap[`${s.id}-${piece.id}`] > 0);
                      for (const store of distributedStores) {
                        await supabase
                          .from("campaign_store_pieces")
                          .delete()
                          .eq("campaign_id", campaignId)
                          .eq("store_id", store.id)
                          .eq("piece_id", piece.id);
                      }
                      queryClient.invalidateQueries({ queryKey: ["campaign_store_pieces", campaignId] });
                      toast.success("Distribuição removida!", { id: toastId });
                    } catch (error: any) {
                      toast.error("Erro ao remover: " + error.message, { id: toastId });
                    }
                    return;
                  }

                  if (!confirm(`Deseja distribuir a peça "${piece.name}" para todas as lojas compatíveis?`)) return;
                  
                  const toastId = toast.loading("Distribuindo...");
                  try {
                    const compatibleStores = stores.filter(s => !piece.store_category || s.store_model === piece.store_category);
                    
                    const upserts = compatibleStores.map(store => ({
                      campaign_id: campaignId,
                      store_id: store.id,
                      piece_id: piece.id,
                      quantity: 1
                    }));

                    const { error } = await supabase
                      .from("campaign_store_pieces")
                      .upsert(upserts, { onConflict: "campaign_id,store_id,piece_id" });

                    if (error) throw error;
                    
                    queryClient.invalidateQueries({ queryKey: ["campaign_store_pieces", campaignId] });
                    toast.success("Distribuição concluída!", { id: toastId });
                  } catch (error: any) {
                    toast.error("Erro ao distribuir: " + error.message, { id: toastId });
                  }
                }}
                refetch={refetchPieces}
              />
            </TabsContent>
            <TabsContent value="matrix" className="h-[calc(100vh-160px)]">
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
                  srcToAdjPieceId={adjustmentRateio?.sourceToAdj}
                  adjKitPieces={adjustmentRateio?.adjKitPieces}
                  isLoadingQuantities={loadingStorePieces || fetchingStorePieces}
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
            {hasModule("adjustments") && (
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
            )}
            <TabsContent value="budgets">
              <BudgetTab 
                campaignId={campaignId!} clientId={clientId!} 
                campaignName={campaign.name} agencyName={agency?.name || ""}
                pieces={pieces} kits={kits} kitPieces={kitPieces} qtyMap={qtyMap}
                stores={stores} isAdmin={isAdmin}
              />
            </TabsContent>


            <Suspense fallback={<div className="p-8 text-center text-muted-foreground italic">Carregando aba...</div>}>
              {hasModule("occurrences") && (
                <TabsContent value="occurrences">
                  <OccurrencesTab 
                    campaignId={campaignId!} 
                    clientId={clientId!} 
                    lalPerms={lalPerms} 
                  />
                </TabsContent>
              )}
              {hasModule("scheduling") && (
                <TabsContent value="scheduling">
                  <SchedulingTab 
                    campaignId={campaignId!} stores={stores} canEdit={true}
                    agencyName={agency?.name || ""} clientName={client?.name || ""} 
                    campaignName={campaign.name} clientId={clientId!} 
                  />
                </TabsContent>
              )}
              {hasModule("installations") && (
                <TabsContent value="installations">
                  <InstallationsTab 
                    campaignId={campaignId!} campaignName={campaign.name} stores={stores}
                    canEdit={true} clientId={clientId!} agencyName={agency?.name || ""}
                    clientName={client?.name || ""}
                  />
                </TabsContent>
              )}
              <TabsContent value="approvals">
                <ApprovalsTab 
                  campaignId={campaignId!} campaignName={campaign.name} pieces={pieces}
                  kits={kits} kitPieces={kitPieces} storePieces={storePieces} stores={stores}
                  agencyName={agency?.name || ""} clientName={client?.name || ""}
                  currencyCode="BRL" isAdminOrMaster={isAdminOrMaster}
                />
              </TabsContent>
              {hasModule("stores") && (
                <TabsContent value="stores">
                  <StoresTab 
                    campaignId={campaignId!} clientId={clientId!} stores={stores}
                    canEditStores={true} canEditCampaignStores={true} isLimitedMode={isLimitedMode}
                    onOpenEditStore={() => {}} agencyName={agency?.name || ""} clientName={client?.name || ""}
                  />
                </TabsContent>
              )}
              <TabsContent value="history">
                <HistoryTab campaignId={campaignId!} />
              </TabsContent>
              {hasModule("mockup") && (
                <TabsContent value="mockup">
                  <MockupTab 
                    campaignId={campaignId!} campaignName={campaign.name} 
                    pieces={pieces} kits={kits} kitPieces={kitPieces} 
                  />
                </TabsContent>
              )}
              {hasModule("loja_a_loja") && (
                <TabsContent value="loja_a_loja">
                  <LojaALojaTab campaignId={campaignId!} clientId={clientId!} lalPerms={lalPerms} />
                </TabsContent>
              )}
            </Suspense>
          </TabErrorBoundary>

        </Tabs>
      </div>
    </AppLayout>
  );
};

export default CampaignDetail;
