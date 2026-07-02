import { useParams } from "react-router-dom";
import { getSupplierLabels, getSupplierPortalLabels, getSupplierExcelLabels } from "@/utils/currencyLocale";
import { getThumbnailUrl } from "@/lib/imageUrl";
import { toast } from "sonner";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { Package, Lock, Clock, CheckCircle2, AlertTriangle, Send, ImageIcon, Download, Edit2, Save, Trash2, Store, MapPin } from "lucide-react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import * as XLSX from "xlsx";
import { exportSupplierBudget } from "@/lib/exportSupplierBudget";
import { exportStoresExcel } from "@/lib/exportStoresExcel";
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
  negotiation_status?: string | null;
  decline_reason?: string | null;
  declined_at?: string | null;
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
  adjusted_installation_value?: number | null;
  adjusted_freight_value?: number | null;
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

const parsePriceInput = (value: string): number | null => {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const priceToInput = (value: number | null | undefined) => {
  if (value == null) return "";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const focusPriceInput = (index: number) => {
  const el = document.querySelector<HTMLInputElement>(`input[data-price-input="${index}"]`);
  if (el) {
    el.focus();
    el.select();
  }
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
  const [headerIds, setHeaderIds] = useState<{ client_id: string | null; agency_id: string | null }>({ client_id: null, agency_id: null });
  const [deadline, setDeadline] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState<string>("BRL");
  const [timelineEntries, setTimelineEntries] = useState<{ id: string; entry_date: string; description: string }[]>([]);
  const [supportMaterials, setSupportMaterials] = useState<{ id: string; title: string; file_url: string; file_name: string | null; file_type: string | null }[]>([]);

  const [allPieces, setAllPieces] = useState<PieceData[]>([]);
  const [kitsData, setKitsData] = useState<KitData[]>([]);
  const [kitPiecesData, setKitPiecesData] = useState<KitPieceData[]>([]);
  const [storePieceQtyMap, setStorePieceQtyMap] = useState<Record<string, number>>({});

  const [prices, setPrices] = useState<Record<string, number | null>>({}); // keyed by piece_id — current editable price (adjusted in negotiation, otherwise unit_price)
  const [originalPrices, setOriginalPrices] = useState<Record<string, number | null>>({}); // shown as reference in negotiation mode
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [extraCosts, setExtraCosts] = useState<ExtraCosts>({ supplier_id: "", installation_value: null, freight_value: null, adjusted_installation_value: null, adjusted_freight_value: null });
  const [negotiationTarget, setNegotiationTarget] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm1, setShowConfirm1] = useState(false);
  const [showConfirm2, setShowConfirm2] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, { id: string; suggested_spec: string; orcado_por: string }>>({});
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null); // pieceId being edited
  const [suggestionDraft, setSuggestionDraft] = useState("");
  const [suggestionOrcadoPor, setSuggestionOrcadoPor] = useState<"original" | "sugerida">("original");
  const [savingSuggestion, setSavingSuggestion] = useState(false);

  // Store data for Excel export
  const [storeData, setStoreData] = useState<{ id: string; name: string; city?: string; state?: string; address?: string; street?: string; number?: string; neighborhood?: string; code?: string; zip_code?: string; nickname?: string; showcase_count?: number; tipo_entrega: 'frete_instalacao' | 'frete_apenas' | 'sem_logistica' | null }[]>([]);
  const [downloadingStores, setDownloadingStores] = useState(false);
  const [fullQtyMap, setFullQtyMap] = useState<Record<string, number>>({});

  const labels = useMemo(() => getSupplierLabels(currencyCode), [currencyCode]);
  const portal = useMemo(() => getSupplierPortalLabels(currencyCode), [currencyCode]);
  const excelLabels = useMemo(() => getSupplierExcelLabels(currencyCode), [currencyCode]);
  const dateLocale = currencyCode === "CLP" ? "es-CL" : "pt-BR";

  // ─── Excel download for stores ─────────────────────────
  const handleDownloadStoresExcel = useCallback(async () => {
    // Deduplicate by store.id
    const uniqueStores = storeData.reduce((acc, current) => {
      const x = acc.find(item => item.id === current.id);
      if (!x) {
        return acc.concat([current]);
      } else {
        return acc;
      }
    }, [] as typeof storeData);

    if (!uniqueStores.length) {
      toast.error(currencyCode === "CLP" ? "No hay datos de tiendas para exportar." : "Não há dados de lojas para exportar.");
      return;
    }

    try {
      await exportStoresExcel({
        stores: uniqueStores as any,
        campaignName,
        supplierName: supplier?.company_name || '',
        currency: currencyCode
      });
    } catch (e) {
      console.error("Store Excel export error:", e);
      toast.error(currencyCode === "CLP" ? "Error al gerar planilha de tiendas." : "Erro ao gerar planilha de lojas.");
    }
  }, [storeData, campaignName, currencyCode, supplier]);

  // ─── Data fetching ─────────────────────────────────────
  useEffect(() => {
    if (!token) { setError(portal.errorInvalidLink); setLoading(false); return; }

    (async () => {
      // Helper: tenta uma operação não-crítica e apenas loga se falhar (não derruba o portal)
      const trySoft = async <T,>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
        try {
          return await fn();
        } catch (e) {
          console.warn(`[SupplierPortal] Falha não-crítica em "${label}":`, e);
          return fallback;
        }
      };

      try {
        // 1) Find supplier by token via SECURITY DEFINER RPC (anon-safe, prices not exposed)
        const { data: portalData, error: supErr } = await supabase.rpc(
          "get_supplier_portal_budget" as never,
          { _token: token } as never
        );

        if (supErr) {
          console.error("[SupplierPortal] Erro ao buscar fornecedor:", supErr);
          setError(portal.errorValidateLink);
          setLoading(false);
          return;
        }
        if (!portalData) { setError(portal.errorTitle); setLoading(false); return; }

        const portalPayload = portalData as {
          supplier: any;
          prices: any[] | null;
          extra_costs: any[] | null;
        };
        const sup = portalPayload.supplier;
        if (!sup) { setError(portal.errorTitle); setLoading(false); return; }
        const portalPrices = portalPayload.prices ?? [];
        const portalExtraCosts = portalPayload.extra_costs ?? [];

        // 2) Budget settings (não-crítico)
        const settings = await trySoft(
          "budget_settings",
          async () => {
            const { data, error: err } = await supabase
              .from("budget_settings")
              .select("deadline, currency_code, negotiation_target")
              .eq("campaign_id", sup.campaign_id)
              .maybeSingle();
            if (err) throw err;
            return data;
          },
          null as { deadline: string | null; currency_code?: string; negotiation_target?: number | null } | null
        );

        const dl = settings?.deadline ?? null;
        setDeadline(dl);
        setCurrencyCode((settings as { currency_code?: string } | null | undefined)?.currency_code || "BRL");
        setNegotiationTarget((settings as any)?.negotiation_target ?? null);

        // 2b) Timeline entries (não-crítico)
        const timeline = await trySoft(
          "budget_timeline_entries",
          async () => {
            const { data, error: err } = await supabase
              .from("budget_timeline_entries")
              .select("id, entry_date, description")
              .eq("campaign_id", sup.campaign_id)
              .order("display_order", { ascending: true });
            if (err) throw err;
            return data;
          },
          [] as { id: string; entry_date: string; description: string }[] | null
        );
        setTimelineEntries(timeline ?? []);

        // 2c) Materiais de apoio (não-crítico — RPC pode falhar sem bloquear o portal)
        const materialsData = await trySoft(
          "get_supplier_support_materials",
          async () => {
            const { data, error: err } = await supabase.rpc("get_supplier_support_materials" as never, { p_token: token } as never);
            if (err) throw err;
            return data;
          },
          [] as any[] | null
        );
        setSupportMaterials((materialsData as any[] | null) ?? []);

        const deadlineDate = dl ? new Date(dl) : null;
        const deadlineExpired = !!deadlineDate && !Number.isNaN(deadlineDate.getTime()) && deadlineDate < new Date();

        if (deadlineExpired && sup.status !== "enviado") {
          await supabase.rpc("supplier_portal_set_status" as never, { _token: token, _status: "prazo_encerrado" } as never);
          sup.status = "prazo_encerrado";
        } else if (!deadlineExpired && sup.status === "prazo_encerrado" && !sup.locked) {
          await supabase.rpc("supplier_portal_set_status" as never, { _token: token, _status: "prazo_estendido" } as never);
          sup.status = "prazo_estendido";
          sup.locked = false;
        }

        setSupplier(sup as Supplier);

        if (deadlineExpired && sup.status === "prazo_encerrado" && !sup.locked) {
          setError(portal.errorDeadlineExpired);
          setLoading(false);
          return;
        }

        // 3) Campaign + client + agency (via SECURITY DEFINER RPC — anon-safe)
        const { data: headerData } = await supabase.rpc(
          "get_supplier_portal_header" as never,
          { _supplier_token: token } as never
        );
        const header = (headerData ?? {}) as {
          campaign_name?: string;
          client_name?: string;
          agency_name?: string;
          client_id?: string | null;
          agency_id?: string | null;
          currency_code?: string;
        };

        setCampaignName(header.campaign_name ?? "");
        const resolvedClientName = header.client_name ?? "";
        const resolvedAgencyName = header.agency_name ?? "";
        const resolvedClientId = header.client_id ?? null;
        setClientName(resolvedClientName);
        setAgencyName(resolvedAgencyName);
        setHeaderIds({ client_id: resolvedClientId, agency_id: header.agency_id ?? null });

        // 4) ALL pieces (including kit_only) — paginated
        const piecesRaw = await supabasePaginate<PieceData>((from, to) =>
          supabase
            .from("campaign_pieces")
            .select("id, name, code, kit_only, image_url, specification, size, installation_instructions, display_order, category, store_category, sub_location", { count: "exact" })
            .eq("campaign_id", sup.campaign_id)
            .eq("is_deleted", false)
            .order("display_order")
            .range(from, to) as any
        );

        const pcs = (piecesRaw ?? []) as PieceData[];
        setAllPieces(pcs);

        // 5) Kits
        const { data: kitsRaw } = await supabase
          .from("campaign_kits")
          .select("id, name, code, image_url, display_order, category, sub_location")
          .eq("campaign_id", sup.campaign_id)
          .eq("is_deleted", false)
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
        const allStorePieces = await supabasePaginate<{ piece_id: string; quantity: number; store_id: string }>(
          (from, to) =>
            supabase
              .from("campaign_store_pieces")
              .select("piece_id, quantity, store_id", { count: "exact" })
              .eq("campaign_id", sup.campaign_id)
              .order("id").range(from, to) as any
        );

        const spQtyMap: Record<string, number> = {};
        const fullQMap: Record<string, number> = {};
        const storeIds = new Set<string>();
        allStorePieces.forEach((sp) => {
          spQtyMap[sp.piece_id] = (spQtyMap[sp.piece_id] || 0) + (Number(sp.quantity) || 0);
          fullQMap[`${sp.store_id}-${sp.piece_id}`] = Number(sp.quantity) || 0;
          storeIds.add(sp.store_id);
        });
        setStorePieceQtyMap(spQtyMap);
        setFullQtyMap(fullQMap);

        // Fetch store details for Excel — também chunked para >1000 lojas
        if (storeIds.size > 0) {
          const ids = Array.from(storeIds);
          const allStores: any[] = [];
          const CHUNK = 1000;
          for (let i = 0; i < ids.length; i += CHUNK) {
            const chunk = ids.slice(i, i + CHUNK);
            const { data: storesRaw, error: storesErr } = await supabase
              .from("client_stores")
              .select("id, name, city, state, street, number, neighborhood, code:store_code, zip_code, nickname, showcase_count, tipo_entrega")
              .in("id", chunk);
            
            if (storesErr) {
              console.error("[SupplierPortal] Erro ao buscar detalhes das lojas:", storesErr);
            }
            if (storesRaw) allStores.push(...storesRaw);
          }
          
          setStoreData(allStores as any);
        }

        // 8) Existing prices (from RPC payload)
        const pricesData = portalPrices;

        // In negotiation mode (status='pending'), the editable price is adjusted_unit_price
        // (falling back to unit_price for the first edit). Original is shown as reference.
        const inNegotiation = sup.negotiation_status === "pending";
        const priceMap: Record<string, number | null> = {};
        const origMap: Record<string, number | null> = {};
        (pricesData ?? []).forEach((p: any) => {
          if (!p.piece_id) return;
          origMap[p.piece_id] = p.unit_price;
          priceMap[p.piece_id] = inNegotiation
            ? (p.adjusted_unit_price ?? p.unit_price)
            : p.unit_price;
        });
        setPrices(priceMap);
        setOriginalPrices(origMap);
        setPriceInputs(Object.fromEntries(Object.entries(priceMap).map(([pieceId, value]) => [pieceId, priceToInput(value)])));

        // 9) Extra costs (from RPC payload)
        const ecData = portalExtraCosts[0] ?? null;

        setExtraCosts({
          id: ecData?.id,
          supplier_id: sup.id,
          installation_value: inNegotiation
            ? ((ecData as any)?.adjusted_installation_value ?? ecData?.installation_value ?? null)
            : (ecData?.installation_value ?? null),
          freight_value: inNegotiation
            ? ((ecData as any)?.adjusted_freight_value ?? ecData?.freight_value ?? null)
            : (ecData?.freight_value ?? null),
          adjusted_installation_value: (ecData as any)?.adjusted_installation_value ?? null,
          adjusted_freight_value: (ecData as any)?.adjusted_freight_value ?? null,
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

        if (sup.locked && sup.negotiation_status !== "pending") setSubmitted(true);
      } catch (e: unknown) {
        console.error("[SupplierPortal] Erro crítico ao carregar:", e);
        const msg = e instanceof Error ? e.message : String(e);
        setError(`${portal.errorCritical} ${msg ? portal.errorCriticalDetail(msg) : ""} ${portal.errorDetail}`);
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
    if (!supplier || !["aguardando", "prazo_estendido"].includes(supplier.status)) return;
    
    const { error: updErr } = await supabase.rpc("supplier_portal_set_status" as never, { _token: token, _status: "preenchendo" } as never);
    if (updErr) return;

    setSupplier((s) => s ? { ...s, status: "preenchendo" } : s);

    // Enviar notificação de início de preenchimento
    try {
      const agencyId = headerIds.agency_id;
      const clientId = headerIds.client_id;

      if (agencyId) {
        await supabase.rpc("criar_notificacao", {
          _agency_id: agencyId,
          _campaign_id: supplier.campaign_id,
          _client_id: clientId,
          _type: "orcamento_em_preenchimento",
          _title: "Fornecedor iniciou preenchimento",
          _body: `${supplier.company_name} começou a preencher a cotação da campanha ${campaignName}.`,
          _action_url: `/agency/${agencyId}/clients/${clientId}/campaigns/${supplier.campaign_id}?section=budgets`,
        });
      }
    } catch (e) {
      console.warn("[SupplierPortal] Failed to send 'filling' notification:", e);
    }
  }, [supplier, campaignName, headerIds]);

  // ─── Save price on blur (always piece_id) ──────────────
  // In negotiation mode, writes to adjusted_unit_price (preserves original unit_price).
  const savePrice = useCallback(
    async (pieceId: string, value: number | null) => {
      if (!supplier) return;
      const isNeg = supplier.negotiation_status === "pending";
      await supabase.rpc("supplier_portal_save_price" as never, {
        _token: token,
        _piece_id: pieceId,
        _value: value,
        _is_negotiation: isNeg,
      } as never);
    },
    [supplier, token]
  );

  // ─── Save extra costs on blur ──────────────────────────
  const saveExtraCosts = useCallback(
    async (field: "installation_value" | "freight_value", value: number | null) => {
      if (!supplier) return;
      const isNeg = supplier.negotiation_status === "pending";
      await supabase.rpc("supplier_portal_save_extra_costs" as never, {
        _token: token,
        _field: field,
        _value: value,
        _is_negotiation: isNeg,
      } as never);
    },
    [supplier, token]
  );

  // ─── Save spec suggestion ─────────────────────────────
  const handleSaveSuggestion = useCallback(
    async (pieceId: string) => {
      if (!supplier || !suggestionDraft.trim()) return;
      setSavingSuggestion(true);
      try {
        const { error: err } = await supabase.rpc("supplier_portal_save_suggestion" as never, {
          _token: token,
          _piece_id: pieceId,
          _suggested_spec: suggestionDraft.trim(),
          _orcado_por: suggestionOrcadoPor,
        } as never);

        if (err) throw err;
        setSuggestions((prev) => ({
          ...prev,
          [pieceId]: { id: prev[pieceId]?.id || "temp", suggested_spec: suggestionDraft.trim(), orcado_por: suggestionOrcadoPor },
        }));
        setExpandedSuggestion(null);
        toast.success(portal.suggestionSaved);
      } catch (e: any) {
        console.error('SUGGESTION ERROR:', e);
        toast.error(`Erro: ${e?.message || e?.code || JSON.stringify(e)}`);
      } finally {
        setSavingSuggestion(false);
      }
    },
    [supplier, suggestionDraft, suggestionOrcadoPor, token, portal]
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
          image_url: r.image_url ?? null,
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
        labels: excelLabels,
      });
    } catch (e) {
      console.error("Excel export error:", e);
      toast.error(currencyCode === "CLP" ? "Error al generar planilla." : "Erro ao gerar planilha.");
    } finally {
      setDownloadingExcel(false);
    }
  }, [supplier, displayRows, prices, campaignName, agencyName, clientName, currencyCode, extraCosts, grandTotal]);

  const handleDecline = async () => {
    if (!supplier) return;
    const isCLP = currencyCode === "CLP";
    setDeclining(true);
    try {
      const { error } = await supabase.rpc("supplier_portal_set_status" as never, {
        _token: token,
        _status: "declinado",
        _decline_reason: declineReason.trim() || null,
      } as never);
      if (error) throw error;
      setSupplier((s) => (s ? { ...s, status: "declinado" } : s));
      setDeclineOpen(false);

      // Enviar notificação de desistência
      try {
        const agencyId = headerIds.agency_id;
        const clientId = headerIds.client_id;

        if (agencyId) {
          const reason = declineReason.trim();
          const body = `${supplier.company_name} não participará da cotação da campanha ${campaignName}.${reason ? ` Motivo: "${reason}".` : ""}`;

          await supabase.rpc("criar_notificacao", {
            _agency_id: agencyId,
            _campaign_id: supplier.campaign_id,
            _client_id: clientId,
            _type: "orcamento_declinado",
            _title: "Fornecedor desistiu da cotação",
            _body: body,
            _action_url: `/agency/${agencyId}/clients/${clientId}/campaigns/${supplier.campaign_id}?section=budgets`,
          });
        }
      } catch (e) {
        console.warn("[SupplierPortal] Failed to send 'decline' notification:", e);
      }

      toast.success(isCLP ? "Registrado. Gracias por avisar." : "Registrado. Obrigado por avisar.");
    } catch {
      toast.error(isCLP ? "No se pudo registrar. Intenta nuevamente." : "Não foi possível registrar. Tente novamente.");
    } finally {
      setDeclining(false);
    }
  };

  // ─── Submit ────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!supplier) return;
    const isNeg = supplier.negotiation_status === "pending";
    setSubmitting(true);
    try {
      const { data: rpcData, error: updErr } = await supabase.rpc("supplier_portal_submit" as never, {
        _token: token,
        _is_negotiation: isNeg,
      } as never);
      if (updErr) throw updErr;
      const result = (rpcData ?? {}) as { success?: boolean };
      if (!result.success) {
        throw new Error(currencyCode === "CLP" ? "No se pudo registrar el envío. Actualice la página e intente nuevamente." : "Não foi possível registrar o envio. Atualize a página e tente novamente.");
      }

      // Save snapshot
      try {
        const { snapshotSupplierBudget } = await import("@/lib/budgetPriceSnapshot");
        await snapshotSupplierBudget({
          supplierId: supplier.id,
          campaignId: supplier.campaign_id,
          reason: (isNeg ? "negotiation_submitted" : "submitted") as any,
        });
      } catch (snapErr) {
        console.warn("Snapshot history failed (non-blocking):", snapErr);
      }

      const agencyId = headerIds.agency_id;
      const clientId = headerIds.client_id;

      if (agencyId) {
        await supabase.rpc("criar_notificacao", {
          _agency_id: agencyId,
          _campaign_id: supplier.campaign_id,
          _client_id: clientId,
          _type: "orcamento_enviado",
          _title: isNeg ? portal.negotiationSubmittedTitle : portal.quoteSubmittedTitle,
          _body: isNeg
            ? portal.negotiationSubmittedBody(supplier.company_name, campaignName)
            : portal.quoteSubmittedBody(supplier.company_name, campaignName),
          _action_url: `/agency/${agencyId}/clients/${clientId}/campaigns/${supplier.campaign_id}?section=budgets`,
        });
      }

      setSupplier((s) => s ? {
        ...s,
        ...(isNeg
          ? { negotiation_status: "submitted", locked: true }
          : { status: "enviado", locked: true, submitted_at: new Date().toISOString() }),
      } : s);
      setSubmitted(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
      if (isNeg) toast.success(portal.negotiationSuccess);
      else toast.success(labels.successMsg);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Erro ao enviar cotação.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
      setShowConfirm2(false);
    }
  };

  const inNegotiation = supplier?.negotiation_status === "pending";
  const isLocked = supplier?.locked === true && !inNegotiation;
  const daysLeft = daysUntil(deadline);

  // ─── Loading ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-medium">{portal.loading}</div>
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
          <h1 className="text-xl font-bold text-foreground mb-2">{error || portal.errorTitle}</h1>
          <p className="text-muted-foreground text-sm mb-4">
            {portal.errorDetail}
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">
            {currencyCode === "CLP" ? "Intentar nuevamente" : "Tentar novamente"}
          </Button>
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
            <h1 className="text-2xl font-bold text-foreground mb-3">{labels.successMsg}</h1>
            <p className="text-muted-foreground mb-6" dangerouslySetInnerHTML={{ __html: portal.successSubtitle(supplier.contact_name, supplier.company_name, campaignName) }} />
            <Card className="text-left">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                   <span className="text-muted-foreground">{labels.columnItem}s {portal.quotedItems}</span>
                   <span className="font-medium">{pricedPieces.length} {labels.columnItem.toLowerCase()}(s)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{portal.installation}</span>
                  <span className="font-medium">{fmt(extraCosts.installation_value)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{portal.freight}</span>
                  <span className="font-medium">{fmt(extraCosts.freight_value)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>{portal.grandTotal}</span>
                  <span className="text-primary">{fmt(grandTotal)}</span>
                </div>
              </CardContent>
            </Card>
            <div className="mt-6 flex flex-col items-center gap-3">
              <Button
                onClick={handleDownloadExcel}
                disabled={downloadingExcel}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                {downloadingExcel ? portal.generatingExcel : portal.downloadExcel}
              </Button>
              <p className="text-xs text-muted-foreground max-w-sm">
                {portal.excelLockedNotice}
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                <Lock className="w-4 h-4" />
                <span>{portal.lockedValues}</span>
              </div>
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
                  {portal.valuesIn} {currencyCode}
                </span>
              )}
              <Badge variant="secondary" className="bg-white/20 text-white border-0 hover:bg-white/30">
                {supplier.status === "aguardando" && portal.waitingStatus}
                {supplier.status === "preenchendo" && portal.fillingStatus}
                {supplier.status === "enviado" && portal.sentStatus}
                {supplier.status === "prazo_estendido" && portal.extendedStatus}
                {supplier.status === "prazo_encerrado" && portal.closedStatus}
              </Badge>
              {deadline && (
                <div className={`flex items-center gap-1 text-sm ${daysLeft != null && daysLeft < 3 ? "text-red-200 font-bold" : "opacity-80"}`}>
                  <Clock className="w-4 h-4" />
                  {daysLeft != null && daysLeft > 0
                    ? portal.daysLeft(daysLeft)
                    : daysLeft === 0
                    ? portal.lastDay
                    : portal.closedStatus}
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
              {portal.sentAt(supplier.submitted_at ? new Date(supplier.submitted_at).toLocaleDateString(dateLocale) : "—")}{" "}
              {portal.lockedValues}
            </span>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 space-y-6">
        {/* Resumo visual no portal */}
        {(() => {
          const comFrete = storeData.filter(s => {
            const tipo = s.tipo_entrega || 'frete_instalacao';
            return tipo === 'frete_instalacao' || tipo === 'frete_apenas';
          }).length;
          
          const comInstalacao = storeData.filter(s => {
            const tipo = s.tipo_entrega || 'frete_instalacao';
            return tipo === 'frete_instalacao';
          }).length;
          
          const semLogistica = storeData.filter(s => s.tipo_entrega === 'sem_logistica').length;
          
          if (storeData.length === 0) return null;

          return (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-border shadow-sm">
                  <Package className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold">{comFrete} {portal.summaryFrete}</span>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-border shadow-sm">
                  <Edit2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold">{comInstalacao} {portal.summaryInstallations}</span>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-border shadow-sm">
                  <Package className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-bold">{semLogistica} {portal.summaryNoLogistics}</span>
                </div>
              </div>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 border-[#8C6F4E] text-[#8C6F4E] hover:bg-[#8C6F4E]/10">
                    <Store className="w-4 h-4" />
                    {portal.storesButton}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
                  <SheetHeader className="mb-6">
                    <SheetTitle className="flex items-center gap-2">
                      <Store className="w-5 h-5" />
                      {portal.storesTitle}
                    </SheetTitle>
                  </SheetHeader>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                    <Card className="bg-green-50 border-green-100">
                      <CardContent className="p-3 text-center">
                        <div className="text-xl font-bold text-green-700">
                          {storeData.filter(s => (s.tipo_entrega || 'frete_instalacao') === 'frete_instalacao').length}
                        </div>
                        <div className="text-[10px] text-green-600 font-medium uppercase leading-tight mt-1">
                          {portal.storesSummaryInstall}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-50 border-blue-100">
                      <CardContent className="p-3 text-center">
                        <div className="text-xl font-bold text-blue-700">
                          {storeData.filter(s => s.tipo_entrega === 'frete_apenas').length}
                        </div>
                        <div className="text-[10px] text-blue-600 font-medium uppercase leading-tight mt-1">
                          {portal.storesSummaryFreteOnly}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gray-50 border-gray-100">
                      <CardContent className="p-3 text-center">
                        <div className="text-xl font-bold text-gray-700">
                          {storeData.filter(s => s.tipo_entrega === 'sem_logistica').length}
                        </div>
                        <div className="text-[10px] text-gray-600 font-medium uppercase leading-tight mt-1">
                          {portal.storesSummaryNoLogistics}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">{portal.storesColName}</TableHead>
                          <TableHead className="text-xs">{portal.storesColAlias}</TableHead>
                          <TableHead className="text-xs">{portal.storesColCity}</TableHead>
                          <TableHead className="text-xs">{portal.storesColAddress}</TableHead>
                          <TableHead className="text-xs">{portal.storesColType}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const uniqueStoresList = storeData.filter((s, idx, self) => 
                            idx === self.findIndex(t => t.id === s.id)
                          );
                          return uniqueStoresList.map((store) => {
                            const tipo = store.tipo_entrega || 'frete_instalacao';
                            return (
                              <TableRow key={store.id}>
                                <TableCell className="text-xs font-medium">{store.name}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{store.nickname || '—'}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{store.city || '—'}</TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                                  {store.street ? `${store.street}${store.number ? `, ${store.number}` : ''}` : '—'}
                                </TableCell>
                                <TableCell>
                                  {tipo === 'frete_instalacao' ? (
                                    <Badge className="bg-green-100 text-green-700 border-green-200 text-[9px] whitespace-nowrap">
                                      📦🔧 {portal.typeFreteInstalacao}
                                    </Badge>
                                  ) : tipo === 'frete_apenas' ? (
                                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[9px] whitespace-nowrap">
                                      📦 {portal.typeFreteApenas}
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-[9px] whitespace-nowrap">
                                      🏪 {portal.typeSemLogistica}
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          });
                        })()}
                      </TableBody>
                    </Table>
                  </div>

                  <SheetFooter className="mt-8 border-t pt-6">
                    <Button 
                      onClick={async () => {
                        setDownloadingStores(true);
                        try {
                          await handleDownloadStoresExcel();
                          toast.success(currencyCode === "CLP" ? "Planilla descargada con éxito." : "Planilha baixada com sucesso.");
                        } finally {
                          setDownloadingStores(false);
                        }
                      }} 
                      className="w-full gap-2 bg-[#8C6F4E] hover:bg-[#7A5F3E]"
                      disabled={downloadingStores}
                    >
                      {downloadingStores ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          {currencyCode === "CLP" ? "Descargando..." : "Baixando..."}
                        </div>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          {portal.storesDownload}
                        </>
                      )}
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </div>
          );
        })()}

        {/* Welcome text */}
        <div className="flex justify-between items-center mb-1">
        </div>
        <Card>
          <CardContent className="p-5">
            <h2 className="text-lg font-semibold text-foreground mb-2">
              {portal.greeting(supplier.contact_name)}
            </h2>
            <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
              <p dangerouslySetInnerHTML={{ __html: portal.inviteText(campaignName, clientName) }} />
              <p dangerouslySetInnerHTML={{ __html: portal.instructionPrice }} />
              {(() => {
                const semLogisticaCount = storeData.filter(s => s.tipo_entrega === 'sem_logistica').length;
                if (semLogisticaCount > 0) {
                  return <p className="font-bold text-amber-600">{portal.noLogisticsNote(semLogisticaCount)}</p>;
                }
                return null;
              })()}
              <p dangerouslySetInnerHTML={{ __html: portal.instructionExtras }} />
              <p dangerouslySetInnerHTML={{ __html: portal.instructionSend }} />
              {deadline && (
                <p>
                  {portal.deadlineLabel}{" "}
                  {new Date(deadline).toLocaleDateString(dateLocale)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timeline / Cronograma */}
        {timelineEntries.length > 0 && (
          <Card>
            <CardContent className="p-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {portal.scheduleTitle}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {portal.scheduleSubtitle}
                </p>
              </div>

              <ul className="space-y-2">
                {timelineEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-start gap-3 py-2 border-b border-border last:border-b-0"
                  >
                    <span className="text-sm font-semibold text-foreground min-w-[100px] shrink-0">
                      {new Date(entry.entry_date + "T00:00:00").toLocaleDateString(dateLocale)}
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
                  <strong>{portal.scheduleAttention}</strong> {portal.scheduleAcceptance}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Material de Apoio compartilhado pelo escritório */}
        {supportMaterials.length > 0 && (
          <Card>
            <CardContent className="p-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  {portal.supportMaterialsTitle}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {portal.supportMaterialsSubtitle}
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
                        <p className="text-sm font-medium text-foreground break-words whitespace-normal">
                          {mat.title || mat.file_name}
                        </p>
                        {mat.file_name && mat.title && (
                          <p className="text-[11px] text-muted-foreground break-words whitespace-normal">{mat.file_name}</p>
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
                          {portal.downloadBtn}
                        </Button>
                      </a>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Matrix */}
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">{labels.columnItem}s {portal.matrixTitle}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {portal.matrixSubtitle}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                disabled={downloadingExcel}
                onClick={async () => {
                  setDownloadingExcel(true);
                  try {
                    await handleDownloadExcel();
                    toast.success(currencyCode === "CLP" ? "Planilla descargada con éxito." : "Planilha baixada com sucesso.");
                  } catch (e) {
                    console.error("Excel download error:", e);
                    toast.error(currencyCode === "CLP" ? "Erro ao baixar planilha." : "Erro ao baixar planilha.");
                  } finally {
                    setDownloadingExcel(false);
                  }
                }}
              >
                {downloadingExcel ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {portal.generatingExcel}
                  </div>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    {portal.downloadExcelBtn}
                  </>
                )}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[760px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-[5] bg-card w-[46%] min-w-[300px]">{labels.columnItem}</TableHead>
                    <TableHead className="text-center w-[12%] min-w-[92px]">{labels.columnQty} Total</TableHead>
                    <TableHead className="text-center w-[24%] min-w-[190px] bg-primary/5 text-primary font-semibold">{labels.columnUnitPrice} ({currencyCode})</TableHead>
                    <TableHead className="text-right w-[18%] min-w-[150px]">{labels.columnTotal}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const editableKeys = displayRows.filter((r) => r.editable && r.pieceId).map((r) => r.key);
                    const editableIndexMap = new Map<string, number>(editableKeys.map((k, i) => [k, i]));
                    const totalEditable = editableKeys.length;
                    return displayRows.map((row) => {
                    const __editableIndex = editableIndexMap.has(row.key) ? editableIndexMap.get(row.key)! : -1;
                    const __totalEditable = totalEditable;
                    if (row.type === "kit_header") {
                      return (
                        <TableRow key={row.key} className="bg-muted/50 border-t-2">
                          <TableCell colSpan={4}>
                            <div className="flex items-center gap-3 py-1">
                              <PieceThumbnail url={row.image_url} />
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">{portal.kitLabel}</Badge>
                                  <span className="font-semibold text-sm">{row.name}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {kitPiecesData.filter((kp) => kp.kit_id === row.kitId).length} {labels.columnItem.toLowerCase()}(s) · {labels.columnQty} kit: {row.totalQty}
                                </p>
                              </div>
                              {(() => {
                                const unitSum = displayRows
                                  .filter((r) => r.type === "kit_piece" && r.kitId === row.kitId)
                                  .reduce((s, r) => s + (r.pieceId ? (prices[r.pieceId] ?? 0) : 0), 0);
                                return (
                                  <div className="ml-auto flex items-center gap-6">
                                    <div className="text-right">
                                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">{portal.unitPerKit}</div>
                                      <span className="text-sm font-semibold text-foreground">{fmt(unitSum)}</span>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">{portal.totalPerKit}</div>
                                      <span className="text-sm font-semibold text-primary">
                                        {fmt(kitSectionTotals[row.kitId!] || 0)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()}
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
                                  <span className="font-medium text-sm break-words whitespace-normal">{row.name}</span>
                                  {(() => {
                                    const store = storeData.find(s => s.name === row.name);
                                    const tipo = (store as any)?.tipo_entrega ?? 'frete_instalacao';
                                    if (tipo === "frete_apenas") return (
                                      <Badge className="ml-2 bg-blue-100 text-blue-700 border-blue-200 text-[10px] font-bold uppercase">
                                        {portal.onlyDeliveryBadge}
                                      </Badge>
                                    );
                                    if (tipo === "sem_logistica") return (
                                      <Badge className="ml-2 bg-gray-100 text-gray-600 border-gray-200 text-[10px] font-bold uppercase">
                                        {portal.typeSemLogistica}
                                      </Badge>
                                    );
                                    return null;
                                  })()}
                                  {hasSuggestion && (
                                    <Badge className="bg-warning/15 text-warning border-warning/30 text-[9px]">{portal.suggestModificationActive}</Badge>
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
                                      title={portal.suggestModification}
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
                          <TableCell className="bg-primary/5 px-3">
                            <div className="flex min-w-[160px] items-center rounded-md border border-primary/40 bg-background shadow-sm focus-within:ring-2 focus-within:ring-primary/30">
                              <span className="px-2 text-xs font-medium text-muted-foreground">{currencyCode}</span>
                              <Input
                                inputMode="decimal"
                                placeholder={labels.noPrice}
                                data-price-input={__editableIndex}
                                className="h-10 min-w-0 flex-1 border-0 bg-transparent px-2 text-right font-semibold text-foreground shadow-none focus-visible:ring-0"
                                disabled={isLocked}
                                value={row.pieceId ? priceInputs[row.pieceId] ?? "" : ""}
                                onFocus={(e) => { markFilling(); e.currentTarget.select(); }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || (e.key === "ArrowDown" && !e.shiftKey)) {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                    const next = e.shiftKey ? __editableIndex - 1 : __editableIndex + 1;
                                    if (next >= 0 && next < __totalEditable) {
                                      setTimeout(() => focusPriceInput(next), 0);
                                    }
                                  } else if (e.key === "ArrowUp") {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                    if (__editableIndex - 1 >= 0) {
                                      setTimeout(() => focusPriceInput(__editableIndex - 1), 0);
                                    }
                                  } else if (e.key === "Escape") {
                                    e.currentTarget.blur();
                                  }
                                }}
                                onChange={(e) => {
                                  if (!row.pieceId) return;
                                  const raw = e.target.value.replace(/[^0-9.,]/g, "");
                                  const val = parsePriceInput(raw);
                                  setPriceInputs((prev) => ({ ...prev, [row.pieceId!]: raw }));
                                  setPrices((prev) => ({ ...prev, [row.pieceId!]: val }));
                                }}
                                onBlur={() => {
                                  if (!row.pieceId) return;
                                  const value = prices[row.pieceId] ?? null;
                                  setPriceInputs((prev) => ({ ...prev, [row.pieceId!]: priceToInput(value) }));
                                  savePrice(row.pieceId, value);
                                }}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                            {unitPrice != null ? fmt(lineTotal) : <span className="text-muted-foreground font-normal">{labels.noPrice}</span>}
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
                                  placeholder={portal.suggestionPlaceholder}
                                  className="text-sm min-h-[60px]"
                                />
                                <div className="flex items-center gap-4">
                                  <span className="text-xs font-medium text-muted-foreground">{portal.suggestOrcadoPor}</span>
                                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`orcado-${row.pieceId}`}
                                      checked={suggestionOrcadoPor === "original"}
                                      onChange={() => setSuggestionOrcadoPor("original")}
                                      className="accent-[#8C6F4E]"
                                    />
                                    {portal.suggestOriginalSpec}
                                  </label>
                                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`orcado-${row.pieceId}`}
                                      checked={suggestionOrcadoPor === "sugerida"}
                                      onChange={() => setSuggestionOrcadoPor("sugerida")}
                                      className="accent-[#8C6F4E]"
                                    />
                                    {portal.suggestMySpec}
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
                                    {savingSuggestion ? portal.savingBtn : portal.saveBtn}
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
                                          const { error } = await supabase.rpc("supplier_portal_delete_suggestion" as never, {
                                            _token: token,
                                            _piece_id: pieceId,
                                          } as never);
                                          if (error) throw error;
                                          setSuggestions((prev) => {
                                            const next = { ...prev };
                                            delete next[pieceId];
                                            return next;
                                          });
                                          setExpandedSuggestion(null);
                                          toast.success(portal.suggestionRemoved);
                                        } catch (e: any) {
                                          toast.error(`Erro: ${e?.message || JSON.stringify(e)}`);
                                        }
                                      }}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      {portal.deleteSuggestion}
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" onClick={() => setExpandedSuggestion(null)}>
                                    {portal.cancelBtn}
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  });
                  })()}
                  {displayRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        {portal.noItems}
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
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{portal.extraCostsTitle}</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadingStores}
                  className="gap-1.5 h-8 text-xs font-medium border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
                  onClick={handleDownloadStoresExcel}
                >
                  <Download className={`w-3.5 h-3.5 ${downloadingStores ? 'animate-bounce' : ''}`} />
                  {downloadingStores ? (currencyCode === "CLP" ? "Generando..." : "Gerando...") : portal.storesDownload}
                </Button>

                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-xs font-medium border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
                    >
                      <Store className="w-3.5 h-3.5" />
                      {portal.storesButton}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        <Store className="w-5 h-5 text-primary" />
                        {portal.storesTitle}
                      </SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 space-y-6 pb-8">
                      {/* Summary Chips inside Sheet */}
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-center justify-between p-3 rounded-lg border border-primary/10 bg-primary/5">
                          <span className="text-sm font-medium text-primary flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            {portal.storesSummaryInstall}
                          </span>
                          <span className="text-lg font-bold text-primary">
                            {storeData.filter(s => (s.tipo_entrega ?? 'frete_instalacao') === 'frete_instalacao').length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-blue-100 bg-blue-50/50">
                          <span className="text-sm font-medium text-blue-700 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            {portal.storesSummaryFreteOnly}
                          </span>
                          <span className="text-lg font-bold text-blue-700">
                            {storeData.filter(s => s.tipo_entrega === 'frete_apenas').length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                          <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-gray-400" />
                            {portal.storesSummaryNoLogistics}
                          </span>
                          <span className="text-lg font-bold text-gray-600">
                            {storeData.filter(s => s.tipo_entrega === 'sem_logistica').length}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-md border border-border overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead className="text-xs h-10">{portal.storesColName}</TableHead>
                              <TableHead className="text-xs h-10">{portal.storesColCity}</TableHead>
                              <TableHead className="text-xs h-10">{portal.storesColType}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {storeData.map((store) => (
                              <TableRow key={store.id} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="py-3">
                                  <div className="font-medium text-sm leading-none">{store.name}</div>
                                  {store.nickname && (
                                    <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{store.nickname}</div>
                                  )}
                                </TableCell>
                                <TableCell className="py-3">
                                  <div className="text-xs text-muted-foreground">{store.city}</div>
                                </TableCell>
                                <TableCell className="py-3">
                                  {(() => {
                                    const tipo = store.tipo_entrega ?? 'frete_instalacao';
                                    if (tipo === 'frete_instalacao') return (
                                      <Badge variant="outline" className="text-[10px] font-semibold border-primary/20 text-primary bg-primary/5 px-1.5 py-0 leading-tight">
                                        {portal.typeFreteInstalacao}
                                      </Badge>
                                    );
                                    if (tipo === 'frete_apenas') return (
                                      <Badge variant="outline" className="text-[10px] font-semibold border-blue-200 text-blue-700 bg-blue-50 px-1.5 py-0 leading-tight">
                                        {portal.typeFreteApenas}
                                      </Badge>
                                    );
                                    return (
                                      <Badge variant="outline" className="text-[10px] font-semibold border-gray-200 text-gray-500 bg-gray-50 px-1.5 py-0 leading-tight">
                                        {portal.typeSemLogistica}
                                      </Badge>
                                    );
                                  })()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    {portal.installation}
                    <span className="text-[11px] font-normal text-muted-foreground">({currencyCode})</span>
                  </label>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                    {storeData.filter(s => (s.tipo_entrega ?? 'frete_instalacao') === 'frete_instalacao').length} {portal.summaryInstallations}
                  </div>
                </div>
                <div className="relative group">
                  <Input
                    type="number" 
                    step="0.01" 
                    min="0" 
                    placeholder={labels.noPrice} 
                    disabled={isLocked}
                    className="h-11 bg-background border-border group-hover:border-primary/30 focus:border-primary transition-all pr-12 font-semibold"
                    value={extraCosts.installation_value ?? ""}
                    onFocus={markFilling}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : parseFloat(e.target.value);
                      setExtraCosts((ec) => ({ ...ec, installation_value: val }));
                    }}
                    onBlur={() => saveExtraCosts("installation_value", extraCosts.installation_value)}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-40">
                    <MapPin className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    {portal.freight}
                    <span className="text-[11px] font-normal text-muted-foreground">({currencyCode})</span>
                  </label>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                    {storeData.filter(s => (s.tipo_entrega ?? 'frete_instalacao') !== 'sem_logistica').length} {portal.summaryFrete}
                  </div>
                </div>
                <div className="relative group">
                  <Input
                    type="number" 
                    step="0.01" 
                    min="0" 
                    placeholder={labels.noPrice} 
                    disabled={isLocked}
                    className="h-11 bg-background border-border group-hover:border-primary/30 focus:border-primary transition-all pr-12 font-semibold"
                    value={extraCosts.freight_value ?? ""}
                    onFocus={markFilling}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : parseFloat(e.target.value);
                      setExtraCosts((ec) => ({ ...ec, freight_value: val }));
                    }}
                    onBlur={() => saveExtraCosts("freight_value", extraCosts.freight_value)}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-40">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {storeData.filter(s => s.tipo_entrega === 'sem_logistica').length > 0 && (
              <div className="mt-2 p-2.5 rounded-lg bg-gray-50 border border-gray-200 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                <AlertTriangle className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <p className="text-[11px] leading-tight text-gray-600 font-medium italic">
                  {portal.noLogisticsNote(storeData.filter(s => s.tipo_entrega === 'sem_logistica').length)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>


        {/* Grand total */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{labels.columnTotal} {portal.grandTotalBudget}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{portal.grandTotalFormula}</p>
              </div>
              <span className="text-2xl font-bold text-primary">{fmt(grandTotal)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Submit button */}
        {!isLocked && supplier?.status !== 'declinado' && (() => {
          const overTarget = inNegotiation && negotiationTarget != null && grandTotal > negotiationTarget;
          const pct = inNegotiation && negotiationTarget && negotiationTarget > 0
            ? Math.round((grandTotal / negotiationTarget) * 100) : 0;
          return (
            <div className="space-y-3 pb-8">
              {inNegotiation && negotiationTarget != null && (
                <Card className={overTarget ? "border-red-300 bg-red-50 dark:bg-red-900/10" : "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/10"}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm">{portal.negotiationTitle}</div>
                    <p className="text-xs text-muted-foreground">{portal.negotiationSubtitle}</p>
                    <div className="flex justify-between text-sm"><span>{portal.negotiationTarget}</span><span className="font-bold">{fmt(negotiationTarget)}</span></div>
                    <div className="flex justify-between text-sm">
                      <span>{portal.negotiationCurrentTotal}</span>
                      <span className={`font-bold ${overTarget ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                        {fmt(grandTotal)} ({overTarget ? portal.negotiationOverTarget : portal.negotiationWithinTarget})
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full transition-all ${overTarget ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <div className="text-[11px] text-muted-foreground text-right">{pct}% {portal.negotiationTargetPct}</div>
                  </CardContent>
                </Card>
              )}
              <div className="flex flex-col items-center gap-4">
                <Button
                  size="lg"
                  className={inNegotiation && !overTarget
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-6 text-lg font-semibold"
                    : "bg-[#8C6F4E] hover:bg-[#7A5F3E] text-white px-10 py-6 text-lg font-semibold"}
                  onClick={() => setShowConfirm1(true)}
                  disabled={submitting || overTarget}
                  title={overTarget ? (currencyCode === "CLP" ? "Total sobre el techo máximo" : "Total acima do teto máximo") : undefined}
                >
                  <Send className="w-5 h-5 mr-2" />
                  {inNegotiation ? portal.submitButtonNegotiation : portal.submitButton}
                </Button>

                <Button
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeclineOpen(true)}
                >
                  {currencyCode === "CLP" ? "No participaré en esta cotización" : "Não participarei desta cotação"}
                </Button>
              </div>
            </div>
          );
        })()}

        {supplier?.status === 'declinado' && (
          <div className="pb-8">
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-6 text-center space-y-2">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                <h3 className="font-semibold text-amber-900">
                  {currencyCode === "CLP" ? "Has declinado participar" : "Você declinou participar"}
                </h3>
                <p className="text-sm text-amber-800">
                  {currencyCode === "CLP" ? "Tu decisión ha sido registrada. ¡Gracias!" : "Sua decisão foi registrada. Obrigado!"}
                </p>
                {supplier.decline_reason && (
                  <div className="mt-4 pt-4 border-t border-amber-200 text-left">
                    <p className="text-xs font-medium text-amber-900 uppercase tracking-wider mb-1">
                      {currencyCode === "CLP" ? "Motivo informado:" : "Motivo informado:"}
                    </p>
                    <p className="text-sm text-amber-800 italic">"{supplier.decline_reason}"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <AlertDialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {currencyCode === "CLP" ? "¿Confirmas que no participarás?" : "Confirma que não irá participar?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {currencyCode === "CLP" 
                ? "Esta acción informará al equipo que no enviarás una propuesta para esta campaña."
                : "Esta ação informará à equipe que você não enviará uma proposta para esta campanha."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-2">
            <label className="text-sm font-medium">
              {currencyCode === "CLP" ? "Motivo (opcional):" : "Motivo (opcional):"}
            </label>
            <Textarea
              placeholder={currencyCode === "CLP" ? "Escribe aquí si quieres explicar por qué..." : "Escreva aqui se quiser explicar o motivo..."}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={declining}>{labels.cancelBtn}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleDecline();
              }}
              disabled={declining}
            >
              {declining ? "Registrando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Confirmation 1 */}
      <AlertDialog open={showConfirm1} onOpenChange={setShowConfirm1}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{portal.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {portal.confirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{labels.cancelBtn}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowConfirm1(false); setShowConfirm2(true); }}>
              {portal.confirmYes}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation 2 */}
      <AlertDialog open={showConfirm2} onOpenChange={setShowConfirm2}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{portal.confirmDefinitiveTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {portal.confirmDefinitiveDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>{labels.cancelBtn}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-[#8C6F4E] hover:bg-[#7A5F3E]"
            >
              {submitting ? portal.submittingBtn : portal.confirmSubmitBtn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SupplierPortal;
