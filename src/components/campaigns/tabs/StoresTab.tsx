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
import StoreContactsCardView from "@/components/StoreContactsCardView";
import { useCampaignStoreStatus, useUpsertCampaignStoreStatus } from "@/hooks/useMultiClientData";
import { useStoreContacts, useStoreContactRoles } from "@/hooks/useStoreContacts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getStateColor } from "@/lib/stateColors";

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
  const pdfTemplateRef = useRef<HTMLDivElement>(null);

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

  const piecesByCategory = useMemo(() => {
    const map = new Map<string, typeof storePieces>();
    storePieces.forEach((sp) => {
      const cat = sp.campaign_pieces?.category || "Outros";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(sp);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([category, pieces]) => ({ category, pieces }));
  }, [storePieces]);

  // Pre-calculate which categories fit on each piece page (8 cols, 132px card, 36px cat header)
  const pdfPiecePages = useMemo(() => {
    const PAGE_H = 710; const COLS = 8; const CARD_H = 132; const CARD_GAP = 7;
    const CAT_H = 36; const CAT_SEP = 14;
    type PCat = typeof piecesByCategory[number];
    const pages: PCat[][] = [[]]; let usedH = 0;
    for (const cat of piecesByCategory) {
      const rows = Math.ceil(cat.pieces.length / COLS);
      const h = CAT_H + rows * CARD_H + Math.max(0, rows - 1) * CARD_GAP;
      const needed = usedH === 0 ? h : h + CAT_SEP;
      if (usedH > 0 && usedH + needed > PAGE_H) { pages.push([]); usedH = 0; }
      pages[pages.length - 1].push(cat);
      usedH += usedH === 0 ? h : needed;
    }
    return pages;
  }, [piecesByCategory]);

  // Pre-calculate which kits fit on each kit page
  const pdfKitPages = useMemo(() => {
    if (!storeKits.length) return [] as any[][];
    const PAGE_H = 710; const KIT_COLS = 3; const PC = 4;
    const KIT_H = (kit: any) => 50 + Math.ceil(kit.pieces.length / PC) * 90 + 14;
    const pages: any[][] = [[]]; let usedH = 0;
    for (let i = 0; i < storeKits.length; i += KIT_COLS) {
      const row = (storeKits as any[]).slice(i, i + KIT_COLS);
      const rowH = Math.max(...row.map(KIT_H));
      const needed = usedH === 0 ? rowH : rowH + 10;
      if (usedH > 0 && usedH + needed > PAGE_H) { pages.push([]); usedH = 0; }
      row.forEach((k) => pages[pages.length - 1].push(k));
      usedH += usedH === 0 ? rowH : needed;
    }
    return pages;
  }, [storeKits]);

  const totalPdfPages = 1 + pdfPiecePages.length + pdfKitPages.length;

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

  const handleExportPdf = useCallback(async () => {
    if (!selectedStore || !pdfTemplateRef.current) return;
    setExportingPdf(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const pageEls = Array.from(pdfTemplateRef.current.children) as HTMLElement[];
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
            <Button
              size="sm"
              onClick={handleExportPdf}
              disabled={exportingPdf || storePieces.length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
            >
              {exportingPdf ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-1" />
              )}
              {exportingPdf ? "Gerando..." : "Exportar PDF"}
            </Button>
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

          {/* Hidden PDF Template — A4 Landscape (1123 x 794) */}
          {selectedStore && (
            <div
              ref={pdfTemplateRef}
              style={{
                position: "fixed",
                left: "-10000px",
                top: 0,
                width: "1123px",
                background: "#ffffff",
                color: "#1a1a1a",
                fontFamily: "Inter, system-ui, sans-serif",
                padding: "32px 40px",
              }}
            >
              {/* HEADER */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #8C6F4E", paddingBottom: 16, marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "#1a1a1a", letterSpacing: "-0.02em" }}>
                    {selectedStore.name}
                  </h1>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, fontSize: 13, color: "#555" }}>
                    {selectedStore.store_code && (
                      <span style={{ background: "#F5F2ED", padding: "3px 8px", borderRadius: 4, fontFamily: "monospace", color: "#8C6F4E", fontWeight: 600 }}>
                        {selectedStore.store_code}
                      </span>
                    )}
                    {selectedStore.store_model && <span>{selectedStore.store_model}</span>}
                    {(selectedStore.city || selectedStore.state) && (
                      <span>📍 {[selectedStore.city, selectedStore.state].filter(Boolean).join(" / ")}</span>
                    )}
                    {selectedStoreContacts.length > 0 && (
                      <span>👤 {selectedStoreContacts.map((c) => c.name).join(" · ")}</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right", marginLeft: 24, background: "#8C6F4E", color: "#fff", padding: "12px 20px", borderRadius: 8, minWidth: 130 }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.8 }}>
                    Total de Peças
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, marginTop: 4 }}>
                    {storePieces.reduce((acc, sp) => acc + sp.quantity, 0)}
                  </div>
                </div>
              </div>

              {/* PIECES BY CATEGORY */}
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {piecesByCategory.map(({ category, pieces }) => (
                  <div key={category} data-pdf-section="true">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #e5e1d8" }}>
                      <div style={{ width: 4, height: 16, background: "#8C6F4E", borderRadius: 2 }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {category}
                      </span>
                      <span style={{ fontSize: 11, color: "#888", marginLeft: "auto" }}>
                        {pieces.length} {pieces.length === 1 ? "peça" : "peças"}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 10 }}>
                      {pieces.map((sp, i) => {
                        const p = sp.campaign_pieces;
                        if (!p) return null;
                        return (
                          <div key={i} style={{ border: "1px solid #e5e1d8", borderRadius: 6, overflow: "hidden", background: "#fff" }}>
                            <div style={{ width: "100%", minHeight: 80, background: "#f4f4f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, padding: 4 }}>
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
                            <div style={{ padding: "6px 8px" }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.25, minHeight: 24, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                {p.name}
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                                {p.size ? (
                                  <span style={{ fontSize: 9, color: "#888" }}>{p.size}</span>
                                ) : (
                                  <span />
                                )}
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#8C6F4E", background: "#F5F2ED", padding: "1px 6px", borderRadius: 4 }}>
                                  ×{sp.quantity}
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

              {/* KITS */}
              {storeKits.length > 0 && (
                <div data-pdf-section="true">
                  <div style={{
                    width: "100%",
                    background: "linear-gradient(90deg, #1f2937 0%, #374151 100%)",
                    padding: "10px 32px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginTop: "8px",
                  }}>
                    <div style={{ width: "3px", height: "18px", background: "#d97706", borderRadius: "2px", flexShrink: 0 }} />
                    <span style={{
                      fontSize: "12px", fontWeight: 800, textTransform: "uppercase",
                      letterSpacing: "0.1em", color: "#ffffff",
                    }}>
                      Kits da Campanha — Composição
                    </span>
                    <span style={{
                      background: "#d97706", color: "#fff",
                      borderRadius: "20px", padding: "1px 10px",
                      fontSize: "10px", fontWeight: 700,
                    }}>
                      {storeKits.length} kits
                    </span>
                  </div>

                  <div style={{ padding: "14px 32px 24px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                    {storeKits.map((kit: any) => {
                      const totalKitQty = kit.pieces.reduce((acc: number, kp: any) => acc + (kp.quantity || 0), 0);
                      return (
                        <div key={kit.id} style={{
                          border: "1px solid #d1d5db", borderRadius: "8px",
                          overflow: "hidden", background: "#ffffff",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        }}>
                          <div style={{
                            background: "#374151", padding: "7px 12px",
                            display: "flex", alignItems: "flex-start", gap: "7px",
                          }}>
                            <span style={{
                              background: "#d97706", color: "#fff",
                              borderRadius: "4px", padding: "2px 7px",
                              fontSize: "10px", fontWeight: 800, flexShrink: 0, marginTop: "1px",
                            }}>
                              [{kit.code}]
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{
                                fontSize: "10px", fontWeight: 700, color: "#ffffff",
                                lineHeight: 1.3, overflow: "hidden", maxHeight: "26px",
                              }}>
                                {kit.name}
                              </div>
                              <div style={{ fontSize: "8.5px", color: "#9ca3af", marginTop: "2px" }}>
                                {kit.pieces.length} {kit.pieces.length === 1 ? "tipo de peça" : "tipos de peça"} · {totalKitQty} un. total
                              </div>
                            </div>
                          </div>
                          <div style={{ padding: "6px 12px 8px" }}>
                            {kit.pieces.map((kp: any, j: number) => (
                              <div key={j} style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "3px 0",
                                borderBottom: j < kit.pieces.length - 1 ? "1px solid #f3f4f6" : "none",
                                gap: "6px",
                              }}>
                                <span style={{ fontSize: "8.5px", color: "#374151", flex: 1, lineHeight: 1.3 }}>
                                  {kp.campaign_pieces?.name || "—"}
                                </span>
                                <span style={{
                                  background: "#fef3c7", color: "#92400e",
                                  border: "1px solid #fde68a",
                                  borderRadius: "3px", padding: "0px 5px",
                                  fontSize: "9px", fontWeight: 700, flexShrink: 0,
                                }}>
                                  ×{kp.quantity}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* FOOTER */}
              <div style={{ marginTop: 28, paddingTop: 12, borderTop: "1px solid #e5e1d8", display: "flex", justifyContent: "space-between", fontSize: 9, color: "#888" }}>
                <span>
                  Gerado em {new Date().toLocaleDateString("pt-BR")} às{" "}
                  {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span>ProduzAI · {agencyName} · {clientName}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
