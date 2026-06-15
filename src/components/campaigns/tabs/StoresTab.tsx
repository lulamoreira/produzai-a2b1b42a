import React, { useState, useMemo, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Store, Search, Filter, X, LayoutList, Users, MapPin, Phone, User, Hash, Info, Truck, FileDown, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import StoreContactsCardView from "@/components/StoreContactsCardView";
import { useCampaignStoreStatus, useUpsertCampaignStoreStatus } from "@/hooks/useMultiClientData";
import { useStoreContacts, useStoreContactRoles } from "@/hooks/useStoreContacts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getStateColor } from "@/lib/stateColors";

const PDF_I18N = {
  "pt-BR": {
    titlePageSubtitle: "Detalhes da Loja",
    totalPieces: "Total de peças",
    generatedOn: "Gerado em",
    contacts: "Contatos da Loja",
    pageOf: (p: number, t: number) => `Página ${p} de ${t}`,
    kitsSectionTitle: "Composição dos Kits",
    kitSummary: (types: number, units: number) => `${types} tipos de peça · ${units} un. total`,
    qty: (n: number) => `× ${n}`,
    categoryPieceCount: (n: number) => `${n} peças`,
    kitsCount: (n: number) => `${n} kits`,
  },
  "es-CL": {
    titlePageSubtitle: "Detalles de la Tienda",
    totalPieces: "Total de piezas",
    generatedOn: "Generado el",
    contacts: "Contactos de la Tienda",
    pageOf: (p: number, t: number) => `Página ${p} de ${t}`,
    kitsSectionTitle: "Composición de los Kits",
    kitSummary: (types: number, units: number) => `${types} tipos de pieza · ${units} un. total`,
    qty: (n: number) => `× ${n}`,
    categoryPieceCount: (n: number) => `${n} piezas`,
    kitsCount: (n: number) => `${n} kits`,
  },
  "en-US": {
    titlePageSubtitle: "Store Details",
    totalPieces: "Total pieces",
    generatedOn: "Generated on",
    contacts: "Store Contacts",
    pageOf: (p: number, t: number) => `Page ${p} of ${t}`,
    kitsSectionTitle: "Kit Composition",
    kitSummary: (types: number, units: number) => `${types} piece types · ${units} total units`,
    qty: (n: number) => `× ${n}`,
    categoryPieceCount: (n: number) => `${n} pieces`,
    kitsCount: (n: number) => `${n} kits`,
  },
} as const;

type PdfLang = keyof typeof PDF_I18N;

async function fetchStorePiecesData(campaignId: string, storeId: string) {
  const { data } = await supabase
    .from("campaign_store_pieces")
    .select("piece_id, quantity, campaign_pieces(name, image_url, category, code, size)")
    .eq("campaign_id", campaignId)
    .eq("store_id", storeId)
    .gt("quantity", 0);
  return (data ?? []) as any[];
}

async function fetchStoreKitsData(campaignId: string, storeId: string, storePieceIds: string[]) {
  const { data } = await supabase
    .from("campaign_kits")
    .select("id, code, name, display_order, campaign_kit_pieces(piece_id, quantity, display_order, campaign_pieces(name, code, image_url))")
    .eq("campaign_id", campaignId)
    .eq("is_deleted", false)
    .order("display_order");
  const idSet = new Set(storePieceIds);
  return ((data ?? []) as any[])
    .map((kit) => ({
      ...kit,
      pieces: ((kit.campaign_kit_pieces ?? []) as any[]).sort(
        (a: any, b: any) => a.display_order - b.display_order
      ),
    }))
    .filter((kit) => kit.pieces.some((kp: any) => idSet.has(kp.piece_id)));
}

function groupPiecesByCategory(pieces: any[]) {
  const map = new Map<string, any[]>();
  pieces.forEach((sp: any) => {
    const cat = sp.campaign_pieces?.category || "Outros";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(sp);
  });
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
    .map(([category, pieces]) => ({ category, pieces }));
}

function buildPiecePages(piecesByCategory: { category: string; pieces: any[] }[]) {
  const PAGE_H = 710, COLS = 8, CARD_H = 160, CARD_GAP = 7, CAT_H = 36, CAT_SEP = 14;
  const pages: { category: string; pieces: any[] }[][] = [[]];
  let usedH = 0;
  for (const cat of piecesByCategory) {
    const rows = Math.ceil(cat.pieces.length / COLS);
    const h = CAT_H + rows * CARD_H + Math.max(0, rows - 1) * CARD_GAP;
    const needed = usedH === 0 ? h : h + CAT_SEP;
    if (usedH > 0 && usedH + needed > PAGE_H) { pages.push([]); usedH = 0; }
    pages[pages.length - 1].push(cat);
    usedH += usedH === 0 ? h : needed;
  }
  return pages;
}

function buildKitPages(kits: any[]) {
  if (!kits.length) return [] as any[][];
  const PAGE_H = 640, KIT_COLS = 3, PC = 4;
  const KIT_H = (kit: any) => {
    const pieceRows = Math.ceil(kit.pieces.length / PC);
    return 80 + pieceRows * 120 + Math.max(0, pieceRows - 1) * 8 + 16;
  };
  const pages: any[][] = [[]];
  let usedH = 0;
  for (let i = 0; i < kits.length; i += KIT_COLS) {
    const row = kits.slice(i, i + KIT_COLS);
    const rowH = Math.max(...row.map(KIT_H));
    const needed = usedH === 0 ? rowH : rowH + 10;
    if (usedH > 0 && usedH + needed > PAGE_H) { pages.push([]); usedH = 0; }
    row.forEach((k) => pages[pages.length - 1].push(k));
    usedH += usedH === 0 ? rowH : needed;
  }
  return pages;
}


interface StoresTabProps {
  campaignId: string;
  clientId: string;
  allStores: any[];
  stores: any[];
  canEditStores: boolean;
  canEditCampaignStores: boolean;
  isLimitedMode: boolean;
  onOpenEditStore: (store: any) => void;
  agencyName: string;
  clientName: string;
  pieces?: any[];
  storePieces?: any[];
  kits?: any[];
  kitPieces?: any[];
}

export default function StoresTab({
  campaignId,
  clientId,
  allStores,
  stores,
  canEditStores,
  canEditCampaignStores,
  isLimitedMode,
  onOpenEditStore,
  agencyName,
  clientName,
}: StoresTabProps) {
  const { t } = useTranslation();
  const [storeSearch, setStoreSearch] = useState("");
  const [storesViewMode, setStoresViewMode] = useState<"table" | "contacts">("table");
  const [selectedStore, setSelectedStore] = useState<any | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfLangPickerOpen, setPdfLangPickerOpen] = useState(false);
  const [pdfLang, setPdfLang] = useState<PdfLang>("pt-BR");
  const pdfTemplateRef = useRef<HTMLDivElement>(null);
  const [batchPdfConfirmOpen, setBatchPdfConfirmOpen] = useState(false);
  const [batchPdfLangPickerOpen, setBatchPdfLangPickerOpen] = useState(false);
  const [batchPdfStatus, setBatchPdfStatus] = useState<string | null>(null);
  const [batchRender, setBatchRender] = useState<{
    store: any;
    piecesByCategory: { category: string; pieces: any[] }[];
    piecePages: { category: string; pieces: any[] }[][];
    kitPages: any[][];
    totalPieces: number;
    lang: PdfLang;
  } | null>(null);

  const { data: campaignStoreStatus = [] } = useCampaignStoreStatus(campaignId);
  const upsertStatus = useUpsertCampaignStoreStatus();

  const { data: selectedStoreContacts = [] } = useStoreContacts(selectedStore?.id);
  const { data: contactRoles = [] } = useStoreContactRoles(clientId);

  const { data: storePieces = [] } = useQuery({
    queryKey: ["store-pieces-pdf", campaignId, selectedStore?.id],
    enabled: !!selectedStore?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_store_pieces")
        .select("piece_id, quantity, campaign_pieces(name, image_url, category, code, size)")
        .eq("campaign_id", campaignId)
        .eq("store_id", selectedStore!.id)
        .gt("quantity", 0);
      if (error) throw error;
      return (data ?? []) as Array<{
        piece_id: string;
        quantity: number;
        campaign_pieces: { name: string; image_url: string | null; category: string; code: number; size: string } | null;
      }>;
    },
  });

  const { data: storeKits = [] } = useQuery({
    queryKey: ["store-kits-pdf", campaignId, selectedStore?.id],
    enabled: !!selectedStore?.id,
    queryFn: async () => {
      const [kitsRes, cspRes] = await Promise.all([
        supabase
          .from("campaign_kits")
          .select("id, code, name, display_order, campaign_kit_pieces(piece_id, quantity, display_order, campaign_pieces(name, code, image_url))")
          .eq("campaign_id", campaignId)
          .eq("is_deleted", false)
          .order("display_order"),
        supabase
          .from("campaign_store_pieces")
          .select("piece_id")
          .eq("campaign_id", campaignId)
          .eq("store_id", selectedStore!.id)
          .gt("quantity", 0),
      ]);
      const storePieceIds = new Set((cspRes.data ?? []).map((s: any) => s.piece_id));
      return ((kitsRes.data ?? []) as any[])
        .map((kit) => ({
          ...kit,
          pieces: ((kit.campaign_kit_pieces ?? []) as any[]).sort(
            (a: any, b: any) => a.display_order - b.display_order
          ),
        }))
        .filter((kit) => kit.pieces.some((kp: any) => storePieceIds.has(kp.piece_id)));
    },
  });

  const piecesByCategory = useMemo(() => groupPiecesByCategory(storePieces as any[]), [storePieces]);
  const pdfPiecePages = useMemo(() => buildPiecePages(piecesByCategory), [piecesByCategory]);
  const pdfKitPages = useMemo(() => buildKitPages(storeKits as any[]), [storeKits]);

  const totalPdfPages = 1 + pdfPiecePages.length + pdfKitPages.length;

  // Render context: batch export overrides single-store data when active
  const renderStore = batchRender?.store ?? selectedStore;
  const renderPiecesByCat = batchRender?.piecesByCategory ?? piecesByCategory;
  const renderPiecePages = batchRender?.piecePages ?? pdfPiecePages;
  const renderKitPages = batchRender?.kitPages ?? pdfKitPages;
  const renderTotalPages = 1 + renderPiecePages.length + renderKitPages.length;
  const renderLang: PdfLang = batchRender?.lang ?? pdfLang;
  const renderContacts = batchRender ? [] : selectedStoreContacts;
  const renderTotalPieces = batchRender
    ? batchRender.totalPieces
    : (storePieces as any[]).reduce((acc: number, sp: any) => acc + sp.quantity, 0);

  const filteredStores = useMemo(() => {
    let result = allStores;
    if (storeSearch) {
      const q = storeSearch.toLowerCase().trim();
      result = result.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.nickname && s.nickname.toLowerCase().includes(q)) ||
          (s.store_code && s.store_code.toLowerCase().includes(q)) ||
          (s.city && s.city.toLowerCase().includes(q)) ||
          (s.state && s.state.toLowerCase().includes(q))
      );
    }
    return result;
  }, [allStores, storeSearch]);

  const handleToggleStore = async (storeId: string, currentEnabled: boolean) => {
    try {
      await upsertStatus.mutateAsync({
        campaignId,
        store_id: storeId,
        enabled: !currentEnabled,
      } as any);
    } catch (error: any) {
      toast.error("Erro ao atualizar status da loja: " + error.message);
    }
  };

  const handleExportPdf = useCallback(async (lang: PdfLang) => {
    if (!selectedStore || !pdfTemplateRef.current) return;
    setPdfLang(lang);
    setExportingPdf(true);
    // wait for React to re-render the template with the new language
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const pageEls = Array.from(pdfTemplateRef.current!.children) as HTMLElement[];
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      for (let i = 0; i < pageEls.length; i++) {
        if (i > 0) pdf.addPage();
        const canvas = await html2canvas(pageEls[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          width: 1122,
          height: 794,
        });
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 297, 210);
      }
      pdf.save(`Loja_${selectedStore.store_code || selectedStore.name}.pdf`);
    } catch (e) {
      console.error("PDF export error:", e);
      toast.error("Falha ao gerar PDF");
    } finally {
      setExportingPdf(false);
    }
  }, [selectedStore]);

  const handleExportAllStoresPdf = useCallback(async (lang: PdfLang) => {
    if (!stores.length) return;
    setBatchPdfStatus(`Iniciando exportação de ${stores.length} lojas...`);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      let firstPage = true;

      for (let i = 0; i < stores.length; i++) {
        const store = stores[i];
        setBatchPdfStatus(`Gerando loja ${i + 1} de ${stores.length}: ${store.name}...`);

        const pieces = await fetchStorePiecesData(campaignId, store.id);
        if (!pieces.length) continue;
        const pieceIds = pieces.map((p: any) => p.piece_id);
        const kits = await fetchStoreKitsData(campaignId, store.id, pieceIds);
        const pbc = groupPiecesByCategory(pieces);
        const piecePages = buildPiecePages(pbc);
        const kitPages = buildKitPages(kits);
        const totalPieces = pieces.reduce((acc: number, sp: any) => acc + sp.quantity, 0);

        setBatchRender({ store, piecesByCategory: pbc, piecePages, kitPages, totalPieces, lang });
        // Wait for React to paint the new content into pdfTemplateRef
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise((r) => setTimeout(r, 50));

        if (!pdfTemplateRef.current) continue;
        const pageEls = Array.from(pdfTemplateRef.current.children) as HTMLElement[];
        for (const pageEl of pageEls) {
          if (!firstPage) pdf.addPage();
          firstPage = false;
          const canvas = await html2canvas(pageEl, {
            scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false,
            width: 1122, height: 794,
          });
          pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 297, 210);
        }
      }

      pdf.save(`Todas_as_Lojas_${campaignId}.pdf`);
    } catch (e) {
      console.error("Batch PDF export error:", e);
      toast.error("Falha ao gerar PDF em lote");
    } finally {
      setBatchRender(null);
      setBatchPdfStatus(null);
    }
  }, [stores, campaignId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">{t("modules.stores")}</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {filteredStores.length} registradas
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-md border border-input bg-background p-1">
            <Button
              variant={storesViewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs gap-1.5"
              onClick={() => setStoresViewMode("table")}
            >
              <LayoutList className="w-3.5 h-3.5" />
              Tabela
            </Button>
            <Button
              variant={storesViewMode === "contacts" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs gap-1.5"
              onClick={() => setStoresViewMode("contacts")}
            >
              <Users className="w-3.5 h-3.5" />
              Contatos
            </Button>
          </div>

          <AlertDialog open={batchPdfConfirmOpen} onOpenChange={setBatchPdfConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1.5"
                disabled={!!batchPdfStatus || stores.length === 0}
                onClick={() => setBatchPdfConfirmOpen(true)}
              >
                <Download className="w-3.5 h-3.5" />
                Exportar PDF
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Exportar PDF de todas as lojas?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso vai gerar um único PDF contendo todas as {stores.length} lojas registradas nesta campanha (peças e kits de cada uma). Pode levar alguns minutos dependendo da quantidade de lojas e imagens.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => { setBatchPdfConfirmOpen(false); setBatchPdfLangPickerOpen(true); }}>
                  Continuar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Popover open={batchPdfLangPickerOpen} onOpenChange={setBatchPdfLangPickerOpen}>
            <PopoverTrigger asChild>
              <span />
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="end">
              {(["pt-BR", "es-CL", "en-US"] as PdfLang[]).map((lang) => (
                <button
                  key={lang}
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted"
                  onClick={() => { setBatchPdfLangPickerOpen(false); handleExportAllStoresPdf(lang); }}
                >
                  {lang === "pt-BR" ? "Português Brasileiro" : lang === "es-CL" ? "Español Chileno" : "English (US)"}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {batchPdfStatus && (
            <span className="text-sm text-muted-foreground ml-2">{batchPdfStatus}</span>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("stores.searchAll")}
            value={storeSearch}
            onChange={(e) => setStoreSearch(e.target.value)}
            className="pl-9 h-10"
          />
          {storeSearch && (
            <button
              onClick={() => setStoreSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {storesViewMode === "table" ? (
        <Card className="overflow-hidden border-gray-200 dark:border-gray-700">
          <Table className="border-collapse">
            <TableHeader className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <TableRow className="hover:bg-transparent border-gray-200 dark:border-gray-700">
                <TableHead className="text-gray-900 dark:text-gray-100 font-semibold">Loja</TableHead>
                <TableHead className="text-gray-900 dark:text-gray-100 font-semibold">Cidade/UF</TableHead>
                <TableHead className="text-gray-900 dark:text-gray-100 font-semibold">Modelo</TableHead>
                <TableHead className="text-right text-gray-900 dark:text-gray-100 font-semibold w-[100px]">Ativa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStores.map((store) => {
                const status = campaignStoreStatus.find((s) => s.store_id === store.id);
                const isEnabled = status ? status.enabled : true;

                return (
                  <TableRow
                    key={store.id}
                    className={cn(
                      "odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 border-gray-200 dark:border-gray-700",
                      !isEnabled && "opacity-60 grayscale-[0.5]"
                    )}
                  >
                    <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                      <div className="flex flex-col gap-1">
                        <span
                          translate="no"
                          className="cursor-pointer hover:underline text-primary"
                          onClick={() => setSelectedStore(store)}
                        >
                          {store.name}
                        </span>
                        {store.nickname && (
                          <span translate="no" className="text-[11px] text-muted-foreground">
                            {store.nickname}
                          </span>
                        )}
                        <div className="flex gap-1 mt-1">
                          {store.tipo_entrega === "frete_apenas" ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 border border-blue-200">
                              📦 Frete Apenas
                            </span>
                          ) : store.tipo_entrega === "sem_logistica" ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-700 border border-gray-300">
                              🏪 Sem Logística
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">
                              📦🔧 Frete + Instalação
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell translate="no" className="text-gray-900 dark:text-gray-100">
                      {store.city} / {store.state}
                    </TableCell>
                    <TableCell translate="no" className="text-gray-900 dark:text-gray-100">
                      {store.store_model}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end pr-4">
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => handleToggleStore(store.id, isEnabled)}
                          disabled={upsertStatus.isPending}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <StoreContactsCardView
          stores={stores}
          clientId={clientId}
          canEdit={canEditStores}
          agencyName={agencyName}
          clientName={clientName}
        />
      )}

      <Dialog open={!!selectedStore} onOpenChange={(open) => !open && setSelectedStore(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              Detalhes da Loja
            </DialogTitle>
            <Popover open={pdfLangPickerOpen} onOpenChange={setPdfLangPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  disabled={exportingPdf || storePieces.length === 0}
                  onClick={() => setPdfLangPickerOpen(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                >
                  {exportingPdf ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-1" />
                  )}
                  {exportingPdf ? "Gerando..." : "Exportar PDF"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="end">
                {(["pt-BR", "es-CL", "en-US"] as PdfLang[]).map((lang) => (
                  <button
                    key={lang}
                    className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted"
                    onClick={() => {
                      setPdfLangPickerOpen(false);
                      handleExportPdf(lang);
                    }}
                  >
                    {lang === "pt-BR" ? "Português Brasileiro" : lang === "es-CL" ? "Español Chileno" : "English (US)"}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </DialogHeader>

          {selectedStore && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <Card className="bg-muted/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Info className="w-4 h-4 text-muted-foreground" /> Identificação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Nome</span>
                    <span translate="no" className="text-sm font-medium">{selectedStore.name}</span>
                  </div>
                  {selectedStore.nickname && (
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-muted-foreground font-bold">Apelido</span>
                      <span translate="no" className="text-sm font-medium">{selectedStore.nickname}</span>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Código</span>
                    <span translate="no" className="text-sm font-medium font-mono">{selectedStore.store_code || "—"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Modelo</span>
                    <span translate="no" className="text-sm font-medium">{selectedStore.store_model || "—"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" /> Localização
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Endereço</span>
                    <span className="text-sm font-medium">
                      {selectedStore.street || ""}, {selectedStore.number || ""} {selectedStore.complement || ""}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Bairro</span>
                    <span className="text-sm font-medium">{selectedStore.neighborhood || "—"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Cidade/UF</span>
                    <span translate="no" className="text-sm font-medium">
                      {selectedStore.city || "—"} / {selectedStore.state || "—"}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">CEP</span>
                    <span className="text-sm font-medium">{selectedStore.zip_code || "—"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" /> Contatos da Loja
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedStoreContacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhum contato cadastrado</p>
                  ) : (
                    selectedStoreContacts.map((contact) => {
                      const roleName = contact.role_id
                        ? contactRoles.find((r) => r.id === contact.role_id)?.name
                        : null;
                      return (
                        <div key={contact.id} className="flex flex-col border-b border-border/40 pb-2 last:border-0 last:pb-0">
                          <span className="text-sm font-medium">{contact.name}</span>
                          {roleName && (
                            <span className="text-[10px] uppercase text-muted-foreground font-bold">{roleName}</span>
                          )}
                          {contact.phone && (
                            <span className="text-xs text-muted-foreground">{contact.phone}</span>
                          )}
                          {contact.email && (
                            <span className="text-xs text-muted-foreground truncate" title={contact.email}>{contact.email}</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Truck className="w-4 h-4 text-muted-foreground" /> Logística
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Tipo de Entrega</span>
                    <div className="mt-1">
                      {selectedStore.tipo_entrega === "frete_apenas" ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 border border-blue-200">
                          📦 Frete Apenas
                        </span>
                      ) : selectedStore.tipo_entrega === "sem_logistica" ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-700 border border-gray-300">
                          🏪 Sem Logística
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">
                          📦🔧 Frete + Instalação
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedStore.cnpj && (
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-muted-foreground font-bold">CNPJ</span>
                      <span className="text-sm font-medium font-mono">{selectedStore.cnpj}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedStore.observations && (
                <Card className="bg-muted/30 md:col-span-2">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-semibold">Observações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedStore.observations}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden multi-page PDF Template — A4 Landscape (1122 x 794) per page */}
      {renderStore && (
            <div
              ref={pdfTemplateRef}
              style={{
                position: "fixed",
                left: "-10000px",
                top: 0,
                width: "1122px",
                background: "#ffffff",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              {/* ══════════ PAGE 1 — TITLE ══════════ */}
              <div
                style={{
                  width: "1122px",
                  height: "794px",
                  background: "#ffffff",
                  color: "#1a1a1a",
                  padding: "60px 80px",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 20, color: "#8C6F4E", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 20 }}>
                  {PDF_I18N[renderLang].titlePageSubtitle}
                </div>
                <h1 style={{ fontSize: 56, fontWeight: 800, margin: 0, color: "#1a1a1a", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                  {renderStore.name}
                </h1>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 24, fontSize: 16, color: "#555", justifyContent: "center" }}>
                  {renderStore.store_code && (
                    <span style={{ background: "#F5F2ED", padding: "6px 14px", borderRadius: 6, fontFamily: "monospace", color: "#8C6F4E", fontWeight: 700 }}>
                      # {renderStore.store_code}
                    </span>
                  )}
                  {renderStore.store_model && (
                    <span style={{ padding: "6px 14px", background: "#f4f4f5", borderRadius: 6 }}>{renderStore.store_model}</span>
                  )}
                  {(renderStore.city || renderStore.state) && (
                    <span style={{ padding: "6px 14px", background: "#f4f4f5", borderRadius: 6 }}>
                      📍 {[renderStore.city, renderStore.state].filter(Boolean).join(" / ")}
                    </span>
                  )}
                </div>
                {renderContacts.length > 0 && (
                  <div style={{ marginTop: 18, fontSize: 14, color: "#666" }}>
                    👤 {renderContacts.map((c: any) => c.name).join(" · ")}
                  </div>
                )}
                <div style={{ display: "flex", gap: 40, marginTop: 60, alignItems: "center" }}>
                  <div style={{ background: "#8C6F4E", color: "#fff", padding: "20px 36px", borderRadius: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.15em", opacity: 0.9 }}>
                      {PDF_I18N[renderLang].totalPieces}
                    </div>
                    <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, marginTop: 6 }}>
                      {renderTotalPieces}
                    </div>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 14, color: "#1a1a1a", fontWeight: 600 }}>
                      {new Date().toLocaleDateString("pt-BR")}
                    </div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                      ProduzAI · Vimer Retail Experience
                    </div>
                  </div>
                </div>
              </div>

              {/* ══════════ PIECE PAGES ══════════ */}
              {renderPiecePages.map((pageCategories, pi) => (
                <div
                  key={`pp-${pi}`}
                  style={{
                    width: "1122px",
                    height: "794px",
                    background: "#ffffff",
                    color: "#1a1a1a",
                    padding: "24px 32px",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Page top bar */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottom: "2px solid #8C6F4E", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#1a1a1a", fontWeight: 600 }}>
                      <div style={{ width: 4, height: 18, background: "#8C6F4E", borderRadius: 2 }} />
                      <span>{renderStore.name}</span>
                      {renderStore.store_code && (
                        <span style={{ color: "#888", fontWeight: 500 }}>· #{renderStore.store_code}</span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: "#888" }}>{PDF_I18N[renderLang].pageOf(pi + 2, renderTotalPages)}</span>
                  </div>

                  {/* Categories content */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, overflow: "hidden" }}>
                    {pageCategories.map(({ category, pieces }) => (
                      <div key={category}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid #e5e1d8" }}>
                          <div style={{ width: 3, height: 14, background: "#8C6F4E", borderRadius: 2 }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {category}
                          </span>
                          <span style={{ fontSize: 10, color: "#888", marginLeft: "auto" }}>
                            {PDF_I18N[renderLang].categoryPieceCount(pieces.length)}
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 7 }}>
                          {pieces.map((sp: any, i: number) => {
                            const p = sp.campaign_pieces;
                            if (!p) return null;
                            return (
                              <div key={i} style={{ border: "1px solid #e5e1d8", borderRadius: 6, overflow: "hidden", background: "#fff", minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <div style={{ width: "100%", height: 80, background: "#f4f4f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, padding: 4, flexShrink: 0 }}>
                                  {p.image_url ? (
                                    <img
                                      crossOrigin="anonymous"
                                      src={p.image_url}
                                      alt={p.name}
                                      style={{
                                        maxWidth: "calc(100% - 8px)",
                                        maxHeight: "70px",
                                        width: "auto",
                                        height: "auto",
                                        display: "block",
                                        margin: "0 auto",
                                      }}
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    "📦"
                                  )}
                                </div>
                                <div style={{ padding: "5px 7px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                                  <div style={{
                                    minHeight: "22px",
                                    display: "flex",
                                    alignItems: "flex-start",
                                    justifyContent: "center",
                                    textAlign: "center",
                                    width: "100%",
                                    marginTop: "4px",
                                    fontSize: "8px",
                                    lineHeight: 1.3,
                                    fontWeight: 600,
                                    color: "#1a1a1a",
                                  }}>
                                    {p.name}
                                  </div>
                                  {p.size && (
                                    <div style={{ fontSize: 8, color: "#888", marginTop: 2 }}>{p.size}</div>
                                  )}
                                  <div style={{ marginTop: "5px" }}>
                                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8C6F4E", background: "#F5F2ED", padding: "1px 6px", borderRadius: 4 }}>
                                      {PDF_I18N[renderLang].qty(sp.quantity)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div style={{ marginTop: 12, paddingTop: 8, borderTop: "1px solid #e5e1d8", display: "flex", justifyContent: "space-between", fontSize: 9, color: "#888" }}>
                    <span>
                      {PDF_I18N[renderLang].generatedOn} {new Date().toLocaleDateString("pt-BR")}{" "}
                      {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span>ProduzAI · {agencyName} · {clientName}</span>
                  </div>
                </div>
              ))}

              {/* ══════════ KIT PAGES ══════════ */}
              {renderKitPages.map((pageKits, ki) => (
                <div
                  key={`kp-${ki}`}
                  style={{
                    width: "1122px",
                    height: "794px",
                    background: "#ffffff",
                    color: "#1a1a1a",
                    padding: "24px 32px",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Page top bar */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottom: "2px solid #8C6F4E", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#1a1a1a", fontWeight: 600 }}>
                      <div style={{ width: 4, height: 18, background: "#d97706", borderRadius: 2 }} />
                      <span>Kits da Campanha · {renderStore.name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#888" }}>
                      {PDF_I18N[renderLang].pageOf(1 + renderPiecePages.length + ki + 1, renderTotalPages)}
                    </span>
                  </div>

                  {/* Kit composition banner */}
                  <div style={{ background: "linear-gradient(90deg, #1f2937 0%, #374151 100%)", padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, borderRadius: 6, marginBottom: 12 }}>
                    <div style={{ width: 3, height: 16, background: "#d97706", borderRadius: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#ffffff" }}>
                      {PDF_I18N[renderLang].kitsSectionTitle}
                    </span>
                    <span style={{ background: "#d97706", color: "#fff", borderRadius: 20, padding: "1px 10px", fontSize: 10, fontWeight: 700, marginLeft: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {PDF_I18N[renderLang].kitsCount(pageKits.length)}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, flex: 1, overflow: "hidden" }}>
                    {pageKits.map((kit: any) => {
                      const totalKitQty = kit.pieces.reduce((acc: number, kp: any) => acc + (kp.quantity || 0), 0);
                      return (
                        <div key={kit.id} style={{ border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden", background: "#ffffff", display: "flex", flexDirection: "column" }}>
                          <div style={{ background: "#374151", padding: "7px 10px", display: "flex", alignItems: "flex-start", gap: 7 }}>
                            <span style={{ background: "#d97706", color: "#fff", borderRadius: 4, padding: "2px 7px", fontSize: 10, fontWeight: 800, flexShrink: 0, alignSelf: "flex-start", marginTop: "1px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              [{kit.code}]
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#ffffff", lineHeight: 1.3 }}>
                                {kit.name}
                              </div>
                              <div style={{ fontSize: 8.5, color: "#9ca3af", marginTop: 2 }}>
                                {PDF_I18N[renderLang].kitSummary(kit.pieces.length, totalKitQty)}
                              </div>
                            </div>
                          </div>
                          <div style={{ padding: 8, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, flex: 1 }}>
                            {kit.pieces.map((kp: any, j: number) => {
                              const p = kp.campaign_pieces;
                              return (
                                <div key={j} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "#fff", minHeight: 110 }}>
                                  <div style={{ width: "100%", height: 58, background: "#f4f4f5", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", fontSize: 18 }}>
                                    {p?.image_url ? (
                                      <img
                                        crossOrigin="anonymous"
                                        src={p.image_url}
                                        alt={p?.name || ""}
                                        style={{ maxWidth: "calc(100% - 4px)", maxHeight: 48, width: "auto", height: "auto", display: "block" }}
                                        onError={(e) => {
                                          (e.currentTarget as HTMLImageElement).style.display = "none";
                                        }}
                                      />
                                    ) : (
                                      "📦"
                                    )}
                                  </div>
                                  <div style={{ fontSize: 8.5, color: "#1a1a1a", textAlign: "center", lineHeight: 1.2 }}>
                                    {p?.name || "—"}
                                  </div>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 3, padding: "0 5px" }}>
                                    {PDF_I18N[renderLang].qty(kp.quantity)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div style={{ marginTop: 12, paddingTop: 8, borderTop: "1px solid #e5e1d8", display: "flex", justifyContent: "space-between", fontSize: 9, color: "#888" }}>
                    <span>
                      {PDF_I18N[renderLang].generatedOn} {new Date().toLocaleDateString("pt-BR")}{" "}
                      {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span>ProduzAI · {agencyName} · {clientName}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
    </div>
  );
}
