import { useParams } from "react-router-dom";
import { getThumbnailUrl } from "@/lib/imageUrl";
import { toast } from "sonner";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, Lock, Clock, CheckCircle2, AlertTriangle, Send, ImageIcon, Download, Edit2, Save, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { exportSupplierBudget } from "@/lib/exportSupplierBudget";
import { formatCurrencyByCode } from "@/lib/countryConfig";
import type { CampaignPiece, CampaignKit, CampaignKitPiece, CampaignPieceLocation, CampaignPieceSubLocation } from "@/hooks/useMultiClientData";

/* ─── Types ──────────────────────────────────────────────── */
interface Supplier {
  id: string;
  campaign_id: string;
  company_name: string;
  contact_name: string;
  status: string;
  locked: boolean | null;
  submitted_at: string | null;
  access_token: string;
}

interface PieceData {
  id: string;
  name: string;
  code: number;
  kit_only: boolean;
  image_url: string | null;
  specification: string;
  size: string;
  installation_instructions: string;
  display_order: number;
  category: string;
  store_category: string | null;
  sub_location: string | null;
}

interface KitData {
  id: string;
  name: string;
  code: number;
  image_url: string | null;
  display_order: number;
  category: string | null;
  sub_location: string | null;
}

interface KitPieceData {
  id: string;
  kit_id: string;
  piece_id: string;
  quantity: number;
}

interface ExtraCosts {
  id?: string;
  supplier_id: string;
  installation_value: number | null;
  freight_value: number | null;
}

// A display row in the matrix
interface DisplayRow {
  key: string; // unique key for React
  type: "standalone_piece" | "kit_header" | "kit_piece";
  pieceId?: string; // piece_id for pricing (standalone or kit piece)
  kitId?: string;
  name: string;
  code: number;
  image_url?: string | null;
  specification?: string;
  size?: string;
  totalQty: number;
  editable: boolean;
}

/* ─── Helpers ────────────────────────────────────────────── */
// Currency formatter is created inside the component to access the campaign's currency_code

const daysUntil = (d: string | null) => {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
};

/* ─── CSS confetti keyframes ─────────────────────────────── */
const confettiCSS = `
@keyframes confetti-fall {
  0%   { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}
.confetti-piece {
  position: fixed;
  width: 10px;
  height: 10px;
  top: -10px;
  animation: confetti-fall 3s ease-in forwards;
  z-index: 9999;
  border-radius: 2px;
}
`;

/* ═══════════════════════════════════════════════════════════ */
const SupplierPortal = () => {
  const { token } = useParams<{ token: string }>();

  // ─── State ──────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [clientName, setClientName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [deadline, setDeadline] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState<string>("BRL");
  const [timelineEntries, setTimelineEntries] = useState<{ id: string; entry_date: string; description: string }[]>([]);
  const [supportMaterials, setSupportMaterials] = useState<{ id: string; title: string; file_url: string; file_name: string | null; file_type: string | null }[]>([]);

  const [allPieces, setAllPieces] = useState<PieceData[]>([]);
  const [kitsData, setKitsData] = useState<KitData[]>([]);
  const [kitPiecesData, setKitPiecesData] = useState<KitPieceData[]>([]);
  const [storePieceQtyMap, setStorePieceQtyMap] = useState<Record<string, number>>({});

  const [prices, setPrices] = useState<Record<string, number | null>>({}); // keyed by piece_id
  const [extraCosts, setExtraCosts] = useState<ExtraCosts>({ supplier_id: "", installation_value: null, freight_value: null });
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm1, setShowConfirm1] = useState(false);
  const [showConfirm2, setShowConfirm2] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, { id: string; suggested_spec: string; orcado_por: string }>>({});
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null); // pieceId being edited
  const [suggestionDraft, setSuggestionDraft] = useState("");
  const [suggestionOrcadoPor, setSuggestionOrcadoPor] = useState<"original" | "sugerida">("original");
  const [savingSuggestion, setSavingSuggestion] = useState(false);

  // Store data for Excel export
  const [storeData, setStoreData] = useState<{ id: string; name: string; city?: string; state?: string; showcase_count?: number }[]>([]);
  const [fullQtyMap, setFullQtyMap] = useState<Record<string, number>>({});

  // ─── Data fetching ─────────────────────────────────────
  useEffect(() => {
    if (!token) { setError("Link inválido."); setLoading(false); return; }

    (async () => {
      try {
        // 1) Find supplier by token
        const { data: sup, error: supErr } = await supabase
          .from("budget_suppliers")
          .select("*")
          .eq("access_token", token)
          .maybeSingle();

        if (supErr) throw supErr;
        if (!sup) { setError("Link inválido ou expirado."); setLoading(false); return; }

        // 2) Budget settings
        const { data: settings } = await supabase
          .from("budget_settings")
          .select("deadline, currency_code")
          .eq("campaign_id", sup.campaign_id)
          .maybeSingle();

        const dl = settings?.deadline ?? null;
        setDeadline(dl);
        setCurrencyCode((settings as { currency_code?: string } | null | undefined)?.currency_code || "BRL");

        // 2b) Timeline entries
        const { data: timeline } = await supabase
          .from("budget_timeline_entries")
          .select("id, entry_date, description")
          .eq("campaign_id", sup.campaign_id)
          .order("display_order", { ascending: true });
        setTimelineEntries(timeline ?? []);

        // 2c) Materiais de apoio compartilhados com o fornecedor (via RPC segura por token)
        const { data: materialsData } = await supabase.rpc("get_supplier_support_materials" as never, { p_token: token } as never);
        setSupportMaterials((materialsData as any[] | null) ?? []);

        if (dl && new Date(dl) < new Date() && sup.status !== "enviado") {
          await supabase.from("budget_suppliers").update({ status: "prazo_encerrado" }).eq("id", sup.id);
          sup.status = "prazo_encerrado";
        }

        setSupplier(sup as Supplier);

        if (sup.status === "prazo_encerrado" && !sup.locked) {
          setError("O prazo para envio do orçamento foi encerrado.");
          setLoading(false);
          return;
        }

        // 3) Campaign + client + agency
        const { data: campaign } = await supabase
          .from("campaigns")
          .select("name, client_id")
          .eq("id", sup.campaign_id)
          .single();

        setCampaignName(campaign?.name ?? "");
        let resolvedClientName = "";
        let resolvedAgencyName = "";
        let resolvedClientId = campaign?.client_id ?? null;

        if (campaign?.client_id) {
          const { data: client } = await supabase
            .from("clients")
            .select("name, agency_id")
            .eq("id", campaign.client_id)
            .single();
          resolvedClientName = client?.name ?? "";
          setClientName(resolvedClientName);

          if (client?.agency_id) {
            const { data: agency } = await supabase
              .from("agencies")
              .select("name")
              .eq("id", client.agency_id)
              .single();
            resolvedAgencyName = agency?.name ?? "";
            setAgencyName(resolvedAgencyName);
          }
        }

        // 4) ALL pieces (including kit_only)
        const { data: piecesRaw } = await supabase
          .from("campaign_pieces")
          .select("id, name, code, kit_only, image_url, specification, size, installation_instructions, display_order, category, store_category, sub_location")
          .eq("campaign_id", sup.campaign_id)
          .order("display_order");

        const pcs = (piecesRaw ?? []) as PieceData[];
        setAllPieces(pcs);

        // 5) Kits
        const { data: kitsRaw } = await supabase
          .from("campaign_kits")
          .select("id, name, code, image_url, display_order, category, sub_location")
          .eq("campaign_id", sup.campaign_id)
          .order("display_order");

        const kts = (kitsRaw ?? []) as KitData[];
        setKitsData(kts);

        // 6) Kit pieces
        const kitIds = kts.map((k) => k.id);
        let kpData: KitPieceData[] = [];
        if (kitIds.length > 0) {
          const { data: kpRaw } = await supabase
            .from("campaign_kit_pieces")
            .select("id, kit_id, piece_id, quantity")
            .in("kit_id", kitIds);
          kpData = (kpRaw ?? []) as KitPieceData[];
        }
        setKitPiecesData(kpData);

        // 7) Store pieces for qty totals + store data for Excel
        // ⚠️ Paginação obrigatória: Supabase limita a 1000 linhas por query.
        // Em campanhas grandes (muitas lojas × peças) isso corta os dados
        // e o total fica errado / só aparecem as primeiras lojas.
        const PAGE_SIZE = 1000;
        let from = 0;
        const allStorePieces: { piece_id: string; quantity: number; store_id: string }[] = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data: page, error: pageErr } = await supabase
            .from("campaign_store_pieces")
            .select("piece_id, quantity, store_id")
            .eq("campaign_id", sup.campaign_id)
            .range(from, from + PAGE_SIZE - 1);
          if (pageErr) throw pageErr;
          const rows = (page ?? []) as { piece_id: string; quantity: number; store_id: string }[];
          allStorePieces.push(...rows);
          if (rows.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }

        const spQtyMap: Record<string, number> = {};
        const fullQMap: Record<string, number> = {};
        const storeIds = new Set<string>();
        allStorePieces.forEach((sp) => {
          spQtyMap[sp.piece_id] = (spQtyMap[sp.piece_id] || 0) + sp.quantity;
          fullQMap[`${sp.store_id}-${sp.piece_id}`] = sp.quantity;
          storeIds.add(sp.store_id);
        });
        setStorePieceQtyMap(spQtyMap);
        setFullQtyMap(fullQMap);

        // Fetch store details for Excel — também paginado para >1000 lojas
        if (storeIds.size > 0) {
          const ids = Array.from(storeIds);
          const allStores: any[] = [];
          for (let i = 0; i < ids.length; i += PAGE_SIZE) {
            const chunk = ids.slice(i, i + PAGE_SIZE);
            const { data: storesRaw } = await supabase
              .from("client_stores")
              .select("id, name, city, state, showcase_count")
              .in("id", chunk);
            if (storesRaw) allStores.push(...storesRaw);
          }
          setStoreData(allStores as any);
        }

        // 8) Existing prices (keyed by piece_id now)
        const { data: pricesData } = await supabase
          .from("budget_prices")
          .select("*")
          .eq("supplier_id", sup.id);

        const priceMap: Record<string, number | null> = {};
        (pricesData ?? []).forEach((p: any) => {
          if (p.piece_id) priceMap[p.piece_id] = p.unit_price;
        });
        setPrices(priceMap);

        // 9) Extra costs
        const { data: ecData } = await supabase
          .from("budget_extra_costs")
          .select("*")
          .eq("supplier_id", sup.id)
          .maybeSingle();

        setExtraCosts({
          id: ecData?.id,
          supplier_id: sup.id,
          installation_value: ecData?.installation_value ?? null,
          freight_value: ecData?.freight_value ?? null,
        });


        // 10) Existing spec suggestions
        const { data: suggestionsData } = await supabase
          .from("supplier_spec_suggestions")
          .select("*")
          .eq("supplier_id", sup.id);

        const sugMap: Record<string, { id: string; suggested_spec: string; orcado_por: string }> = {};
        (suggestionsData ?? []).forEach((s: any) => {
          sugMap[s.piece_id] = { id: s.id, suggested_spec: s.suggested_spec, orcado_por: s.orcado_por };
        });
        setSuggestions(sugMap);

        if (sup.locked) setSubmitted(true);
      } catch (e: unknown) {
        console.error(e);
        setError("Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // ─── Currency-aware formatter (depends on campaign currency) ─
  const fmt = useCallback(
    (v: number | null | undefined) => (v != null ? formatCurrencyByCode(v, currencyCode) : "—"),
    [currencyCode]
  );

  // ─── Build display rows ────────────────────────────────
  const displayRows = useMemo(() => {
    const rows: DisplayRow[] = [];

    // Merge pieces (non-kit_only) and kits into a single list sorted by display_order
    type MergedItem = { type: "piece"; data: typeof allPieces[number] } | { type: "kit"; data: typeof kitsData[number] };
    const merged: MergedItem[] = [
      ...allPieces.filter((p) => !p.kit_only).map((p) => ({ type: "piece" as const, data: p })),
      ...kitsData.map((k) => ({ type: "kit" as const, data: k })),
    ];
    merged.sort((a, b) => (a.data.display_order ?? 0) - (b.data.display_order ?? 0));

    merged.forEach((item) => {
      if (item.type === "kit") {
        const kit = item.data;
        const kpList = kitPiecesData.filter((kp) => kp.kit_id === kit.id);
        if (kpList.length === 0) return;

        const kitTotalQty = Math.min(
          ...kpList.map((kp) => {
            const pieceTotal = storePieceQtyMap[kp.piece_id] || 0;
            return Math.floor(pieceTotal / (kp.quantity || 1));
          })
        );

        rows.push({
          key: `kit-header-${kit.id}`,
          type: "kit_header",
          kitId: kit.id,
          name: kit.name,
          code: kit.code,
          image_url: kit.image_url,
          totalQty: kitTotalQty,
          editable: false,
        });

        kpList.forEach((kp) => {
          const piece = allPieces.find((p) => p.id === kp.piece_id);
          if (!piece) return;
          rows.push({
            key: `kit-piece-${kit.id}-${kp.piece_id}`,
            type: "kit_piece",
            pieceId: kp.piece_id,
            kitId: kit.id,
            name: piece.name,
            code: piece.code,
            image_url: piece.image_url,
            specification: piece.specification,
            size: piece.size,
            totalQty: kitTotalQty * kp.quantity,
            editable: true,
          });
        });
      } else {
        const p = item.data;
        rows.push({
          key: `piece-${p.id}`,
          type: "standalone_piece",
          pieceId: p.id,
          name: p.name,
          code: p.code,
          image_url: p.image_url,
          specification: p.specification,
          size: p.size,
          totalQty: storePieceQtyMap[p.id] || 0,
          editable: true,
        });
      }
    });

    return rows;
  }, [allPieces, kitsData, kitPiecesData, storePieceQtyMap]);

  // ─── Mark as preenchendo on first interaction ──────────
  const markFilling = useCallback(async () => {
    if (!supplier || supplier.status !== "aguardando") return;
    await supabase.from("budget_suppliers").update({ status: "preenchendo" }).eq("id", supplier.id);
    setSupplier((s) => s ? { ...s, status: "preenchendo" } : s);
  }, [supplier]);

  // ─── Save price on blur (always piece_id) ──────────────
  const savePrice = useCallback(
    async (pieceId: string, value: number | null) => {
      if (!supplier) return;
      await supabase.from("budget_prices").upsert(
        {
          supplier_id: supplier.id,
          campaign_id: supplier.campaign_id,
          piece_id: pieceId,
          unit_price: value,
        } as never,
        { onConflict: "supplier_id,piece_id" }
      );
    },
    [supplier]
  );

  // ─── Save extra costs on blur ──────────────────────────
  const saveExtraCosts = useCallback(
    async (field: "installation_value" | "freight_value", value: number | null) => {
      if (!supplier) return;
      const payload = {
        supplier_id: supplier.id,
        installation_value: field === "installation_value" ? value : extraCosts.installation_value,
        freight_value: field === "freight_value" ? value : extraCosts.freight_value,
      };

      if (extraCosts.id) {
        await supabase.from("budget_extra_costs").update({ [field]: value }).eq("id", extraCosts.id);
      } else {
        const { data } = await supabase.from("budget_extra_costs").insert(payload).select().single();
        if (data) setExtraCosts((ec) => ({ ...ec, id: data.id }));
      }
    },
    [supplier, extraCosts]
  );

  // ─── Save spec suggestion ─────────────────────────────
  const handleSaveSuggestion = useCallback(
    async (pieceId: string) => {
      if (!supplier || !suggestionDraft.trim()) return;
      setSavingSuggestion(true);
      try {
        const piece = allPieces.find((p) => p.id === pieceId);
        const { error: err } = await supabase
          .from("supplier_spec_suggestions")
          .upsert(
            {
              supplier_id: supplier.id,
              piece_id: pieceId,
              campaign_id: supplier.campaign_id,
              original_spec: piece?.specification || "",
              suggested_spec: suggestionDraft.trim(),
              orcado_por: suggestionOrcadoPor,
            } as never,
            { onConflict: "supplier_id,piece_id" }
          );

        if (err) throw err;
        setSuggestions((prev) => ({
          ...prev,
          [pieceId]: { id: prev[pieceId]?.id || "temp", suggested_spec: suggestionDraft.trim(), orcado_por: suggestionOrcadoPor },
        }));
        setExpandedSuggestion(null);
        toast.success("Sugestão salva!");
      } catch (e: any) {
        console.error('SUGGESTION ERROR:', e);
        console.error('SUGGESTION ERROR MESSAGE:', e?.message);
        console.error('SUGGESTION ERROR CODE:', e?.code);
        console.error('SUGGESTION ERROR DETAILS:', e?.details);
        console.error('SUGGESTION ERROR HINT:', e?.hint);
        toast.error(`Erro: ${e?.message || e?.code || JSON.stringify(e)}`);
      } finally {
        setSavingSuggestion(false);
      }
    },
    [supplier, suggestionDraft, suggestionOrcadoPor, allPieces]
  );

  // ─── Computed totals ───────────────────────────────────
  const lineTotals = useMemo(() => {
    const map: Record<string, number> = {};
    displayRows.forEach((row) => {
      if (!row.editable || !row.pieceId) return;
      const up = prices[row.pieceId];
      map[row.key] = up != null ? up * row.totalQty : 0;
    });
    return map;
  }, [displayRows, prices]);

  // Kit section totals
  const kitSectionTotals = useMemo(() => {
    const map: Record<string, number> = {};
    kitsData.forEach((kit) => {
      let total = 0;
      displayRows
        .filter((r) => r.type === "kit_piece" && r.kitId === kit.id)
        .forEach((r) => { total += lineTotals[r.key] || 0; });
      map[kit.id] = total;
    });
    return map;
  }, [kitsData, displayRows, lineTotals]);

  const grandTotal = useMemo(() => {
    const itemsTotal = Object.values(lineTotals).reduce((s, v) => s + v, 0);
    return itemsTotal + (extraCosts.installation_value || 0) + (extraCosts.freight_value || 0);
  }, [lineTotals, extraCosts]);

  // ─── Excel download (matches on-screen budget) ─────────
  const handleDownloadExcel = useCallback(async () => {
    if (!supplier) return;
    setDownloadingExcel(true);
    try {
      const exportRows = displayRows.map((r) => {
        const unitPrice = r.editable && r.pieceId ? prices[r.pieceId] ?? null : null;
        const lineTotal = unitPrice != null ? unitPrice * r.totalQty : 0;
        return {
          type: r.type,
          name: r.name,
          code: r.code,
          specification: r.specification,
          size: r.size,
          totalQty: r.totalQty,
          unitPrice,
          lineTotal,
        };
      });

      await exportSupplierBudget({
        campaignName,
        agencyName,
        clientName,
        supplierName: supplier.company_name,
        currencyCode,
        rows: exportRows,
        installation: extraCosts.installation_value,
        freight: extraCosts.freight_value,
        grandTotal,
      });
    } catch (e) {
      console.error("Excel export error:", e);
      toast.error("Erro ao gerar planilha.");
    } finally {
      setDownloadingExcel(false);
    }
  }, [supplier, displayRows, prices, campaignName, agencyName, clientName, currencyCode, extraCosts, grandTotal]);

  // ─── Submit ────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!supplier) return;
    setSubmitting(true);
    try {
      await supabase
        .from("budget_suppliers")
        .update({ status: "enviado", locked: true, submitted_at: new Date().toISOString() })
        .eq("id", supplier.id);

      const { data: campaign } = await supabase
        .from("campaigns")
        .select("client_id")
        .eq("id", supplier.campaign_id)
        .single();

      let agencyId: string | null = null;
      let clientId: string | null = null;
      if (campaign?.client_id) {
        clientId = campaign.client_id;
        const { data: client } = await supabase
          .from("clients")
          .select("agency_id")
          .eq("id", campaign.client_id)
          .single();
        agencyId = client?.agency_id ?? null;
      }

      if (agencyId) {
        await supabase.rpc("criar_notificacao", {
          _agency_id: agencyId,
          _campaign_id: supplier.campaign_id,
          _client_id: clientId,
          _type: "orcamento_enviado",
          _title: "Orçamento recebido",
          _body: `${supplier.company_name} enviou o orçamento para a campanha ${campaignName}.`,
          _action_url: `/agency/${agencyId}/clients/${clientId}/campaigns/${supplier.campaign_id}?section=budgets`,
        });
      }

      setSupplier((s) => s ? { ...s, status: "enviado", locked: true, submitted_at: new Date().toISOString() } : s);
      setSubmitted(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
      setShowConfirm2(false);
    }
  };

  const isLocked = supplier?.locked === true;
  const daysLeft = daysUntil(deadline);

  // ─── Loading ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-medium">Carregando...</div>
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────────
  if (error || !supplier) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md text-center px-6 py-8">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">{error || "Link inválido ou expirado"}</h1>
          <p className="text-muted-foreground text-sm">
            Caso acredite ser um erro, entre em contato com a agência responsável.
          </p>
        </div>
      </div>
    );
  }

  // ─── Success screen ────────────────────────────────────
  if (submitted) {
    const confettiColors = ["#8C6F4E", "#D4A574", "#E8D5C0", "#4CAF50", "#FF9800", "#2196F3"];
    const pricedPieces = displayRows.filter((r) => r.editable && r.pieceId && prices[r.pieceId] != null);
    return (
      <>
        <style>{confettiCSS}</style>
        {showConfetti &&
          Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}vw`,
                backgroundColor: confettiColors[i % confettiColors.length],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
                width: `${6 + Math.random() * 8}px`,
                height: `${6 + Math.random() * 8}px`,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              }}
            />
          ))}
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="max-w-lg text-center px-6 py-8">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">Orçamento Enviado!</h1>
            <p className="text-muted-foreground mb-6">
              Obrigado, {supplier.contact_name}! O orçamento de{" "}
              <strong>{supplier.company_name}</strong> para a campanha{" "}
              <strong>{campaignName}</strong> foi recebido com sucesso.
            </p>
            <Card className="text-left">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Itens cotados</span>
                  <span className="font-medium">{pricedPieces.length} peça(s)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Instalação</span>
                  <span className="font-medium">{fmt(extraCosts.installation_value)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frete/Despacho</span>
                  <span className="font-medium">{fmt(extraCosts.freight_value)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total Geral</span>
                  <span className="text-primary">{fmt(grandTotal)}</span>
                </div>
              </CardContent>
            </Card>
            <div className="mt-6 flex items-center gap-2 justify-center text-sm text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span>Os valores estão bloqueados e não podem ser alterados.</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── Piece thumbnail component ─────────────────────────
  const PieceThumbnail = ({ url }: { url?: string | null }) => (
    url ? (
      <img src={getThumbnailUrl(url, 80)} alt="" loading="lazy" decoding="async" className="w-10 h-10 rounded object-cover border shrink-0" />
    ) : (
      <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center shrink-0">
        <ImageIcon className="w-5 h-5 text-muted-foreground" />
      </div>
    )
  );

  // ─── Main portal ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Header */}
      <div className="bg-[#8C6F4E] text-white">
        <div className="max-w-4xl mx-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-5 h-5" />
                <span className="text-sm font-medium opacity-80">{agencyName}</span>
              </div>
              <h1 className="text-xl font-bold">{campaignName}</h1>
              <p className="text-sm opacity-80 mt-0.5">{supplier.company_name}</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {currencyCode !== "BRL" && (
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">
                  Valores em {currencyCode}
                </span>
              )}
              <Badge variant="secondary" className="bg-white/20 text-white border-0 hover:bg-white/30">
                {supplier.status === "aguardando" && "Aguardando"}
                {supplier.status === "preenchendo" && "Preenchendo"}
                {supplier.status === "enviado" && "Enviado"}
                {supplier.status === "prazo_encerrado" && "Prazo encerrado"}
              </Badge>
              {deadline && (
                <div className={`flex items-center gap-1 text-sm ${daysLeft != null && daysLeft < 3 ? "text-red-200 font-bold" : "opacity-80"}`}>
                  <Clock className="w-4 h-4" />
                  {daysLeft != null && daysLeft > 0
                    ? `${daysLeft} dia${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""}`
                    : daysLeft === 0
                    ? "Último dia!"
                    : "Prazo encerrado"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Locked banner */}
      {isLocked && (
        <div className="bg-warning/10 border-b border-warning/30 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-2 text-warning text-sm">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              Orçamento enviado em{" "}
              {supplier.submitted_at ? new Date(supplier.submitted_at).toLocaleDateString("pt-BR") : "—"}.
              Os valores estão bloqueados.
            </span>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 space-y-6">
        {/* Welcome text */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Olá, {supplier.contact_name}! 👋
            </h2>
            <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
              <p>
                Você foi convidado(a) a participar do processo de cotação da campanha{" "}
                <strong className="text-foreground">{campaignName}</strong>
                {clientName ? ` do cliente ${clientName}` : ""}.
              </p>
              <p>
                Preencha o <strong>preço unitário</strong> de cada peça abaixo. O total por peça será
                calculado automaticamente (preço unitário × quantidade total).
              </p>
              <p>
                Ao final, informe os valores de <strong>instalação</strong> e{" "}
                <strong>frete/despacho</strong>, se aplicáveis.
              </p>
              <p>
                Quando tudo estiver pronto, clique em{" "}
                <strong className="text-primary">ENVIAR ORÇAMENTO</strong>. Atenção: após o envio,
                os valores ficam <strong>bloqueados</strong> e não poderão ser alterados.
              </p>
              {deadline && (
                <p>
                  📅 <strong>Prazo para envio:</strong>{" "}
                  {new Date(deadline).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Material de Apoio compartilhado pelo escritório */}
        {supportMaterials.length > 0 && (
          <Card>
            <CardContent className="p-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  📎 Material de Apoio
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Arquivos disponibilizados pela agência para apoiar sua cotação. Clique em baixar quando precisar.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {supportMaterials.map((mat) => {
                  const isImage = mat.file_type?.startsWith("image/");
                  const isVideo = mat.file_type?.startsWith("video/");
                  const isPdf = mat.file_type === "application/pdf";
                  const icon = isImage ? "🖼️" : isVideo ? "🎬" : isPdf ? "📄" : "📁";
                  return (
                    <div
                      key={mat.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-lg shrink-0">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {mat.title || mat.file_name}
                        </p>
                        {mat.file_name && mat.title && (
                          <p className="text-[11px] text-muted-foreground truncate">{mat.file_name}</p>
                        )}
                      </div>
                      <a
                        href={mat.file_url}
                        download={mat.file_name || "arquivo"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
                          <Download className="w-3.5 h-3.5" />
                          Baixar
                        </Button>
                      </a>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline / Cronograma */}
        {timelineEntries.length > 0 && (
          <Card>
            <CardContent className="p-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  📅 Cronograma da Campanha
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Datas e entregas acordadas para esta campanha
                </p>
              </div>

              <ul className="space-y-2">
                {timelineEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-start gap-3 py-2 border-b border-border last:border-b-0"
                  >
                    <span className="text-sm font-semibold text-foreground min-w-[100px] shrink-0">
                      {new Date(entry.entry_date + "T00:00:00").toLocaleDateString("pt-BR")}
                    </span>
                    <span className="text-sm text-muted-foreground leading-relaxed">
                      {entry.description}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <p className="text-sm text-warning leading-relaxed">
                  <strong>Atenção:</strong> Ao enviar este orçamento, você confirma o aceite do cronograma acima.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Matrix */}
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Itens da Campanha</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Preencha o preço unitário por peça. Kits são expandidos em suas peças componentes.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                disabled={downloadingExcel}
                onClick={handleDownloadExcel}
              >
                <Download className="w-4 h-4" />
                {downloadingExcel ? "Gerando..." : "Baixar Planilha (Excel)"}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[240px] sticky left-0 z-[5] bg-card">Item</TableHead>
                    <TableHead className="text-center w-[90px]">Qtd Total</TableHead>
                    <TableHead className="text-center w-[150px] bg-primary/5 text-primary font-semibold">Preço Unitário ({currencyCode})</TableHead>
                    <TableHead className="text-right w-[140px]">Total da Peça</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.map((row) => {
                    if (row.type === "kit_header") {
                      return (
                        <TableRow key={row.key} className="bg-muted/50 border-t-2">
                          <TableCell colSpan={4}>
                            <div className="flex items-center gap-3 py-1">
                              <PieceThumbnail url={row.image_url} />
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Kit</Badge>
                                  <span className="font-semibold text-sm">{row.name}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {kitPiecesData.filter((kp) => kp.kit_id === row.kitId).length} peça(s) · Qtd kit: {row.totalQty}
                                </p>
                              </div>
                              <div className="ml-auto text-right">
                                <span className="text-sm font-semibold text-primary">
                                  {fmt(kitSectionTotals[row.kitId!] || 0)}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    const unitPrice = row.pieceId ? prices[row.pieceId] ?? null : null;
                    const lineTotal = lineTotals[row.key] || 0;
                    const isKitPiece = row.type === "kit_piece";
                    const hasSuggestion = row.pieceId ? !!suggestions[row.pieceId] : false;
                    const isExpanded = expandedSuggestion === row.pieceId;

                    return (
                      <React.Fragment key={row.key}>
                        <TableRow className={isKitPiece ? "bg-muted/20" : ""}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {isKitPiece && <div className="w-4 border-l-2 border-b-2 border-muted-foreground/30 h-5 shrink-0 ml-2" />}
                              <PieceThumbnail url={row.image_url} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] shrink-0">#{row.code}</Badge>
                                  <span className="font-medium text-sm truncate">{row.name}</span>
                                  {hasSuggestion && (
                                    <Badge className="bg-warning/15 text-warning border-warning/30 text-[9px]">Modificação sugerida</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  {row.specification && (
                                    <p className="text-xs text-muted-foreground break-words whitespace-normal">{row.specification}</p>
                                  )}
                                  {row.pieceId && !isLocked && (
                                    <button
                                      onClick={() => {
                                        if (isExpanded) {
                                          setExpandedSuggestion(null);
                                        } else {
                                          const existing = suggestions[row.pieceId!];
                                          setSuggestionDraft(existing?.suggested_spec || row.specification || "");
                                          setSuggestionOrcadoPor((existing?.orcado_por as "original" | "sugerida") || "original");
                                          setExpandedSuggestion(row.pieceId!);
                                        }
                                      }}
                                      className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                      title="Sugerir modificação"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                {row.size && (
                                  <Badge variant="secondary" className="text-[9px] mt-1">{row.size}</Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm">{row.totalQty}</TableCell>
                          <TableCell className="text-center bg-primary/5">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0,00"
                              className="w-[130px] mx-auto text-right border-primary/40 focus-visible:ring-primary/40 bg-background"
                              disabled={isLocked}
                              value={unitPrice ?? ""}
                              onFocus={markFilling}
                              onChange={(e) => {
                                if (!row.pieceId) return;
                                const val = e.target.value === "" ? null : parseFloat(e.target.value);
                                setPrices((prev) => ({ ...prev, [row.pieceId!]: val }));
                              }}
                              onBlur={() => {
                                if (row.pieceId) savePrice(row.pieceId, prices[row.pieceId] ?? null);
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                            {unitPrice != null ? fmt(lineTotal) : <span className="text-muted-foreground font-normal">—</span>}
                          </TableCell>
                        </TableRow>
                        {/* Inline suggestion form */}
                        {isExpanded && row.pieceId && (
                          <TableRow className="bg-warning/5">
                            <TableCell colSpan={4}>
                              <div className="p-3 space-y-3">
                                <Textarea
                                  value={suggestionDraft}
                                  onChange={(e) => setSuggestionDraft(e.target.value)}
                                  placeholder="Sua sugestão de modificação na especificação..."
                                  className="text-sm min-h-[60px]"
                                />
                                <div className="flex items-center gap-4">
                                  <span className="text-xs font-medium text-muted-foreground">Orçando pela:</span>
                                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`orcado-${row.pieceId}`}
                                      checked={suggestionOrcadoPor === "original"}
                                      onChange={() => setSuggestionOrcadoPor("original")}
                                      className="accent-[#8C6F4E]"
                                    />
                                    Especificação original
                                  </label>
                                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`orcado-${row.pieceId}`}
                                      checked={suggestionOrcadoPor === "sugerida"}
                                      onChange={() => setSuggestionOrcadoPor("sugerida")}
                                      className="accent-[#8C6F4E]"
                                    />
                                    Minha sugestão
                                  </label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    className="bg-[#8C6F4E] hover:bg-[#7A5F3E] text-white gap-1"
                                    disabled={savingSuggestion || !suggestionDraft.trim()}
                                    onClick={() => handleSaveSuggestion(row.pieceId!)}
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                    {savingSuggestion ? "Salvando..." : "Salvar"}
                                  </Button>
                                  {suggestions[row.pieceId!] && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="gap-1"
                                      disabled={isLocked}
                                      onClick={async () => {
                                        const pieceId = row.pieceId!;
                                        try {
                                          const { error } = await supabase
                                            .from("supplier_spec_suggestions")
                                            .delete()
                                            .eq("supplier_id", supplier!.id)
                                            .eq("piece_id", pieceId);
                                          if (error) throw error;
                                          setSuggestions((prev) => {
                                            const next = { ...prev };
                                            delete next[pieceId];
                                            return next;
                                          });
                                          setExpandedSuggestion(null);
                                          toast.success("Sugestão removida. Especificação original restaurada.");
                                        } catch (e: any) {
                                          toast.error(`Erro: ${e?.message || JSON.stringify(e)}`);
                                        }
                                      }}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Apagar sugestão
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" onClick={() => setExpandedSuggestion(null)}>
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {displayRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum item cadastrado nesta campanha.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Extra costs */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold text-foreground">Custos Adicionais</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Instalação (R$)</label>
                <Input
                  type="number" step="0.01" min="0" placeholder="0,00" disabled={isLocked}
                  value={extraCosts.installation_value ?? ""}
                  onFocus={markFilling}
                  onChange={(e) => {
                    const val = e.target.value === "" ? null : parseFloat(e.target.value);
                    setExtraCosts((ec) => ({ ...ec, installation_value: val }));
                  }}
                  onBlur={() => saveExtraCosts("installation_value", extraCosts.installation_value)}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Frete / Despacho (R$)</label>
                <Input
                  type="number" step="0.01" min="0" placeholder="0,00" disabled={isLocked}
                  value={extraCosts.freight_value ?? ""}
                  onFocus={markFilling}
                  onChange={(e) => {
                    const val = e.target.value === "" ? null : parseFloat(e.target.value);
                    setExtraCosts((ec) => ({ ...ec, freight_value: val }));
                  }}
                  onBlur={() => saveExtraCosts("freight_value", extraCosts.freight_value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grand total */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Geral do Orçamento</p>
                <p className="text-xs text-muted-foreground mt-0.5">(Itens + Instalação + Frete)</p>
              </div>
              <span className="text-2xl font-bold text-primary">{fmt(grandTotal)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Submit button */}
        {!isLocked && (
          <div className="flex justify-center pb-8">
            <Button
              size="lg"
              className="bg-[#8C6F4E] hover:bg-[#7A5F3E] text-white px-10 py-6 text-lg font-semibold"
              onClick={() => setShowConfirm1(true)}
              disabled={submitting}
            >
              <Send className="w-5 h-5 mr-2" />
              ENVIAR ORÇAMENTO
            </Button>
          </div>
        )}
      </div>

      {/* Confirmation 1 */}
      <AlertDialog open={showConfirm1} onOpenChange={setShowConfirm1}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio</AlertDialogTitle>
            <AlertDialogDescription>
              Você revisou todos os valores? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowConfirm1(false); setShowConfirm2(true); }}>
              Sim, revisei
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation 2 */}
      <AlertDialog open={showConfirm2} onOpenChange={setShowConfirm2}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmação definitiva</AlertDialogTitle>
            <AlertDialogDescription>
              Tem absoluta certeza? Após o envio, os valores ficam bloqueados e não poderão ser alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-[#8C6F4E] hover:bg-[#7A5F3E]"
            >
              {submitting ? "Enviando..." : "Confirmar Envio Definitivo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SupplierPortal;
