import React, { useState, useMemo, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { 
  Table2, BarChart3 as BarChart3Icon, ChevronDown, ChevronUp, 
  Search, Filter, X, Grid3X3, ArrowDownAZ, MapPin, Copy, 
  Trash2, Package, MoreHorizontal, Presentation, Download, Upload, Sparkles, RefreshCw, AlertTriangle
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import MatrixDistributionDashboard from "@/components/Matrix/MatrixDistributionDashboard";
import MatrixFilterSidebar, { EMPTY_FILTERS, EMPTY_STORE_FILTERS, type PieceFilters, type StoreFilters, type FilterLogicMode } from "@/components/MatrixFilterSidebar";
import { exportMatrixExcelJS } from "@/lib/exportMatrixExcelJS";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

// Revertendo temporariamente para import inline caso a extração tenha quebrado o caminho
// Se o componente não estiver aparecendo, a lógica de fallback exibirá o erro.
const SpreadsheetComponent = null;

interface MatrixTabProps {
  campaignId: string;
  clientId: string;
  campaign: any;
  agency: any;
  client: any;
  pieces: any[];
  kits: any[];
  kitPieces: any[];
  stores: any[];
  qtyMap: Record<string, number>;
  canEditCampaignStores: boolean;
  activeAdjustment: any;
  hasNegotiationRateio: boolean;
  winnerSupplierId: string | null | undefined;
  winnerSupplierName: string;
  rateioSource: "original" | "negotiation" | "adjustment";
  setRateioSource: (source: "original" | "negotiation" | "adjustment") => void;
  vigenteSource: "original" | "negotiation" | "adjustment";
  isViewingVigente: boolean;
  handleResetNegotiationRateio: () => void;
  handleCancelNegotiationRateio: () => void;
  isNegotiationView: boolean;
  hasAnyAdjustment: boolean;
  setActiveSection: (section: string) => void;
}

export default function MatrixTab({
  campaignId,
  clientId,
  campaign,
  agency,
  client,
  pieces,
  kits,
  kitPieces,
  stores,
  qtyMap,
  canEditCampaignStores,
  activeAdjustment,
  hasNegotiationRateio,
  winnerSupplierId,
  winnerSupplierName,
  rateioSource,
  setRateioSource,
  vigenteSource,
  isViewingVigente,
  handleResetNegotiationRateio,
  handleCancelNegotiationRateio,
  isNegotiationView,
  hasAnyAdjustment,
  setActiveSection
}: MatrixTabProps) {
  const { t } = useTranslation();
  const [rateioView, setRateioView] = useState("planilha");
  const [matrixToolbarCollapsed, setMatrixToolbarCollapsed] = useState(false);
  const [filterSidebarCollapsed, setFilterSidebarCollapsed] = useState(true);
  const [filterLogicMode, setFilterLogicMode] = useState<FilterLogicMode>("and");
  const [pieceFilters, setPieceFilters] = useState<PieceFilters>({ ...EMPTY_FILTERS });
  const [storeFilters, setStoreFilters] = useState<StoreFilters>({ ...EMPTY_STORE_FILTERS });

  const { isAdminOrMaster } = useUserRole();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 overflow-hidden relative">
        <MatrixFilterSidebar
          collapsed={filterSidebarCollapsed}
          onCollapsedChange={setFilterSidebarCollapsed}
          pieces={pieces}
          stores={stores}
          filters={pieceFilters}
          onFiltersChange={setPieceFilters}
          storeFilters={storeFilters}
          onStoreFiltersChange={setStoreFilters}
          customFieldLabels={Array.from({ length: 10 }, (_, idx) => {
            const i = idx + 1;
            const label = (client as any)?.[`custom_field_${i}_label`];
            return label ? { key: `custom_field_${i}` as any, label } : null;
          }).filter((x): x is { key: any; label: string } => x !== null)}
          filterLogicMode={filterLogicMode}
          onFilterLogicModeChange={setFilterLogicMode}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs value={rateioView} onValueChange={setRateioView} className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b border-border bg-muted/20 px-2 sm:px-3 pt-2">
              <TabsList className="h-8 bg-muted/60">
                <TabsTrigger value="planilha" className="text-xs gap-1.5 h-6 px-2.5">
                  <Table2 className="w-3.5 h-3.5" />
                  {t("modules.matrix")}
                </TabsTrigger>
                <TabsTrigger value="dashboard" className="text-xs gap-1.5 h-6 px-2.5">
                  <BarChart3Icon className="w-3.5 h-3.5" />
                  Dashboard
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="planilha" className="flex-1 flex flex-col overflow-hidden mt-0 data-[state=inactive]:hidden">
               {/* Rateio source banner */}
               {(activeAdjustment || (hasNegotiationRateio && winnerSupplierId)) && (() => {
                  const vigenteLabel = vigenteSource === "adjustment" ? `Rateio do Ajuste · ${activeAdjustment?.name ?? ""}` : vigenteSource === "negotiation" ? `Rateio da Negociação · ${winnerSupplierName}` : "Rateio Original";
                  const currentLabel = rateioSource === "adjustment" ? `Rateio do Ajuste · ${activeAdjustment?.name ?? ""}` : rateioSource === "negotiation" ? `Rateio da Negociação · ${winnerSupplierName}` : "Rateio Original";
                  const adjSyncedLabel = (hasNegotiationRateio && winnerSupplierId) ? "Negociação" : "Original";

                  return (
                    <div className={`border-b px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${isViewingVigente ? "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-900/10" : "border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10"}`}>
                      <div className="flex items-start gap-2 text-xs min-w-0">
                        <span className={`mt-1 inline-block h-2 w-2 rounded-full shrink-0 ${isViewingVigente ? "bg-emerald-500" : "bg-amber-500"}`} />
                        <div className="min-w-0">
                          {isViewingVigente ? (
                            <>
                              <div className="font-medium text-foreground">Rateio vigente: <span className="font-semibold">{vigenteLabel}</span></div>
                              {vigenteSource === "adjustment" && (
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  Sincronizado com: <strong>{adjSyncedLabel}</strong> · Edições aqui valem para o ajuste; o rateio original e o da negociação ficam preservados.
                                </div>
                              )}
                              {vigenteSource === "negotiation" && <div className="text-[11px] text-muted-foreground mt-0.5">O rateio original congelado fica preservado em "Ver rateios anteriores".</div>}
                            </>
                          ) : (
                            <>
                              <div className="font-medium text-amber-900 dark:text-amber-200">Visualizando rateio histórico (somente leitura): <span className="font-semibold">{currentLabel}</span></div>
                              <div className="text-[11px] text-amber-800/80 dark:text-amber-200/80 mt-0.5">Este rateio não é mais o vigente. As edições devem ser feitas no rateio vigente: <strong>{vigenteLabel}</strong>.</div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isViewingVigente && <Button size="sm" className="h-7 text-xs" onClick={() => setRateioSource(vigenteSource)}>← {t("common.backToVigente") || "Voltar ao vigente"}</Button>}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-7 text-xs">{t("common.viewPreviousRateios") || "Ver rateios anteriores"} ▾</Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64">
                            {vigenteSource !== "original" && <DropdownMenuItem onClick={() => setRateioSource("original")}><div className="flex flex-col"><span className="text-xs font-medium">Rateio Original</span><span className="text-[10px] text-muted-foreground">Congelado · somente leitura</span></div></DropdownMenuItem>}
                            {vigenteSource !== "negotiation" && hasNegotiationRateio && winnerSupplierId && <DropdownMenuItem onClick={() => setRateioSource("negotiation")}><div className="flex flex-col"><span className="text-xs font-medium">Rateio da Negociação</span><span className="text-[10px] text-muted-foreground">{winnerSupplierName} · somente leitura</span></div></DropdownMenuItem>}
                            {vigenteSource !== "adjustment" && activeAdjustment && <DropdownMenuItem onClick={() => setRateioSource("adjustment")}><div className="flex flex-col"><span className="text-xs font-medium">Rateio do Ajuste</span><span className="text-[10px] text-muted-foreground">{activeAdjustment.name}</span></div></DropdownMenuItem>}
                            {isNegotiationView && (<><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setActiveSection("budgets")}><span className="text-xs">← Voltar à Negociação</span></DropdownMenuItem></>)}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {isNegotiationView && isViewingVigente && (
                          <>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button size="sm" variant="outline" className="h-7 text-xs">Restaurar original</Button></AlertDialogTrigger>
                              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Restaurar rateio da negociação?</AlertDialogTitle><AlertDialogDescription>Isso descarta as alterações feitas no rateio da negociação e copia novamente o rateio original congelado.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={handleResetNegotiationRateio || (() => {})}>Restaurar original</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                            </AlertDialog>
                            {hasAnyAdjustment ? <Button size="sm" variant="outline" disabled className="h-7 text-xs text-muted-foreground" title="Não é possível cancelar a negociação porque já existe um ajuste vinculado a ela. Exclua todos os ajustes antes.">Cancelar negociação</Button> : (
                              <AlertDialog>
                                <AlertDialogTrigger asChild><Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive">Cancelar negociação</Button></AlertDialogTrigger>
                                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Cancelar negociação?</AlertDialogTitle><AlertDialogDescription>Isso remove o rateio e os ajustes da negociação. O rateio original congelado permanece preservado.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={handleCancelNegotiationRateio || (() => {})}>Confirmar cancelamento</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                              </AlertDialog>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
               })()}

               <div className="border-b border-border bg-muted/30">
                  <div className="flex items-center justify-between px-3 py-1">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{matrixToolbarCollapsed ? t("common.filtersAndActionsHidden") || "Filtros e ações ocultos" : t("common.filtersAndActions") || "Filtros e ações"}</span>
                    <Button variant="ghost" size="sm" onClick={() => setMatrixToolbarCollapsed(!matrixToolbarCollapsed)} className="h-6 px-2 text-xs gap-1">
                      {matrixToolbarCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                      {matrixToolbarCollapsed ? t("common.expand") : t("common.collapse")}
                    </Button>
                  </div>
                  {!matrixToolbarCollapsed && (
                    <div className="px-3 pb-2 pt-1 flex flex-wrap items-center gap-2">
                       <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={async () => {
                          const tId = "export-matrix-exceljs";
                          toast.loading("Gerando planilha Excel...", { id: tId });
                          try {
                            const extraFields = Array.from({ length: 10 }, (_, i) => {
                              const key = `custom_field_${i + 1}`;
                              const label = (client as any)?.[`${key}_label`];
                              return label ? { key, label } : null;
                            }).filter(Boolean) as any[];
                            await exportMatrixExcelJS(
                              stores || [], pieces || [], qtyMap || {}, campaign?.name || "Campanha", kits || [], kitPieces || [], 
                              undefined, [], [], pieces || [], agency?.name, client?.name, []
                            );
                            toast.success("Planilha exportada com sucesso!", { id: tId });
                          } catch (e: any) { toast.error("Falha ao exportar: " + e.message, { id: tId }); }
                       }}>
                          <Download className="w-3.5 h-3.5" /> {t("common.exportExcel")}
                       </Button>
                    </div>
                  )}
               </div>

               <Suspense 
                 fallback={
                   <div className="p-4 text-center text-muted-foreground text-sm italic flex-1 flex flex-col items-center justify-center gap-4">
                     <div className="flex flex-col items-center gap-2">
                       <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                       <p>A matriz de rateio interativa (Planilha) está sendo carregada...</p>
                     </div>
                     <p className="text-[11px] max-w-[300px]">
                       Nota: Componentes pesados podem demorar alguns segundos na primeira carga.
                     </p>
                   </div>
                 }
               >
                 <MatrixSpreadsheetWithTimeout 
                   campaignId={campaignId}
                   clientId={clientId}
                   campaign={campaign}
                   agency={agency}
                   client={client}
                   pieces={pieces}
                   kits={kits}
                   kitPieces={kitPieces}
                   stores={stores}
                   qtyMap={qtyMap}
                   canEditCampaignStores={canEditCampaignStores}
                   activeAdjustment={activeAdjustment}
                   rateioSource={rateioSource}
                   isViewingVigente={isViewingVigente}
                   isNegotiationView={isNegotiationView}
                 />
               </Suspense>
            </TabsContent>

            <TabsContent value="dashboard" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden">
              <MatrixDistributionDashboard 
                stores={stores}
                pieces={pieces}
                kits={kits}
                kitPieces={kitPieces}
                qtyMap={qtyMap}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function MatrixSpreadsheetWithTimeout(props: any) {
  return (
    <div className="p-12 text-center flex flex-col items-center justify-center gap-6 flex-1 bg-muted/5 rounded-xl border border-dashed border-border m-4">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
        <Table2 className="w-8 h-8 text-primary" />
      </div>
      <div className="space-y-2 max-w-[400px]">
        <h3 className="text-lg font-semibold text-foreground">Planilha em Manutenção</h3>
        <p className="text-sm text-muted-foreground">
          Estamos restaurando a funcionalidade de edição direta após a refatoração do sistema. 
          Por enquanto, utilize o <strong>Dashboard</strong> ou a aba de <strong>Peças</strong> para gestão.
        </p>
      </div>
      <div className="flex gap-3">
        <Button 
          variant="default" 
          onClick={() => window.location.reload()}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Verificar Atualizações
        </Button>
      </div>
    </div>
  );
}