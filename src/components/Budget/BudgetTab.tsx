import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { format } from "date-fns";
import {
  DollarSign, Plus, Trash2, Eye, MessageCircle, Mail, Lock, Check, Clock, Edit3, CalendarIcon, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, Download, Link2, Copy, Pencil, Loader2, Send, History, Unlock, Trophy, TrendingDown, Share2, Layers, AlertCircle, FileSpreadsheet, Package, Wrench, Store, AlertTriangle, RotateCcw
} from "lucide-react";
import { useExportRequoteFinal } from "@/hooks/useExportRequoteFinal";
import RequoteFinalExportDialog from "@/components/RequoteFinalExportDialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { snapshotSupplierBudget } from "@/lib/budgetPriceSnapshot";
import { computeSupplierTotal } from "@/lib/computeSupplierTotal";
import { ClientStore } from "@/hooks/useMultiClientData";
import BudgetSupplierHistorySheet from "@/components/Budget/BudgetSupplierHistorySheet";
import { getSupplierLabels, getMessageLabels, getLocaleFromCurrency, getSupplierPortalLabels } from "@/utils/currencyLocale";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveToolbar } from "@/components/ResponsiveToolbar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { COUNTRY_CONFIGS, formatCurrencyByCode } from "@/lib/countryConfig";

import {
  useBudgetSettings, useSaveBudgetSettings,
  useBudgetSuppliers, useAddSupplier, useDeleteSupplier, useUpdateSupplier,
  useBudgetPrices, useBudgetExtraCosts, useSupplierSpecSuggestions, useExchangeRate,
} from "@/hooks/useBudget";
import { useAgencySuppliers } from "@/hooks/useAgencySuppliers";
import SupplierFormDialog from "@/components/SupplierFormDialog";

import { useBudgetTimeline } from "@/hooks/useBudgetTimeline";
import { useRealtimeBudget } from "@/hooks/useRealtimeBudget";
import { useBudgetPhase, PHASE_LABELS, type BudgetPhase } from "@/hooks/useBudgetPhase";
import { PhaseStepper } from "./PhaseStepper";
import { FrozenPhaseBanner } from "./FrozenPhaseBanner";
import { UnlockPhaseDialog } from "./UnlockPhaseDialog";
import { ArrowRight, FileEdit } from "lucide-react";
import { useCurrentTotal } from "@/hooks/useCurrentTotal";
import {
  REQUOTE_STATUS_META,
  useActiveAdjustmentRequest,
  type AdjustmentBudgetRequest,
} from "@/hooks/useAdjustmentBudgetRequest";
import { DeadlineCountdown } from "./DeadlineCountdown";
import BudgetTimelineSection from "@/components/Budget/BudgetTimelineSection";
import { exportBudgetComparison } from "@/lib/exportBudgetComparison";
import { exportSupplierBudget, type SupplierExportRow } from "@/lib/exportSupplierBudget";
import BudgetSendClientDialog from "@/components/Budget/BudgetSendClientDialog";
import BudgetSendNegotiatedDialog from "@/components/Budget/BudgetSendNegotiatedDialog";
import BudgetWinnerDialog from "@/components/Budget/BudgetWinnerDialog";
import BudgetNegotiationDialog from "@/components/Budget/BudgetNegotiationDialog";
import SendQtyRequoteDialog from "@/components/Budget/SendQtyRequoteDialog";

import type { CampaignPiece, CampaignKit } from "@/hooks/useMultiClientData";

interface BudgetTabProps {
  campaignId: string;
  clientId: string;
  agencyId: string;
  campaignName: string;
  agencyName: string;
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: { id: string; kit_id: string; piece_id: string; quantity: number }[];
  qtyMap: Record<string, number>;
  stores: any[];
  onNavigateToRateio?: () => void;
  onNavigateToSection?: (section: string) => void;
  activeAdjustment?: { id: string; name: string } | null;
}


const PUBLIC_BASE_URL = "https://produzai.lovable.app";

// ─── Status helpers ──────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  aguardando: { label: "Aguardando", color: "bg-muted text-muted-foreground" },
  preenchendo: { label: "Preenchendo", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  enviado: { label: "Enviado", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  prazo_estendido: { label: "Prazo estendido", color: "bg-warning/10 text-warning border-warning/30" },
  prazo_encerrado: { label: "Prazo encerrado", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  declinado: { label: "Desistiu", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
};

// Returns visual status considering revision/deadline state.
function getDisplayStatus(sup: { status: string; locked: boolean | null; submitted_at: string | null }, deadline?: Date) {
  if (sup.status === "prazo_encerrado" && deadline && deadline > new Date()) {
    return STATUS_MAP.prazo_estendido;
  }
  if (sup.status !== "enviado" && sup.submitted_at && !sup.locked) {
    return { label: "Em revisão", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  }
  return STATUS_MAP[sup.status] || STATUS_MAP.aguardando;
}

// ─── Admin inline number input (price/freight/installation) ──────
function AdminInlineNumberInput({
  initial,
  onSave,
  ariaLabel,
  placeholder = "—",
  className,
}: {
  initial: number | null;
  onSave: (val: number | null) => Promise<void>;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  const fmt2 = (n: number | null) => (n == null ? "" : n.toFixed(2));
  const [val, setVal] = React.useState<string>(fmt2(initial));
  const [saving, setSaving] = React.useState(false);
  const [savedFlash, setSavedFlash] = React.useState(false);
  const initialRef = React.useRef<number | null>(initial);
  const focusedRef = React.useRef(false);

  React.useEffect(() => {
    if (focusedRef.current) return;
    if (initial !== initialRef.current) {
      initialRef.current = initial;
      setVal(fmt2(initial));
    }
  }, [initial]);

  const commit = async () => {
    focusedRef.current = false;
    const trimmed = val.trim().replace(",", ".");
    const num = trimmed === "" ? null : Number(trimmed);
    const cur = initialRef.current;
    if (num != null && (Number.isNaN(num) || num < 0)) {
      setVal(fmt2(cur));
      return;
    }
    if ((num ?? null) === (cur ?? null)) {
      setVal(fmt2(cur));
      return;
    }
    setSaving(true);
    try {
      await onSave(num);
      initialRef.current = num;
      setVal(fmt2(num));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
      setVal(fmt2(cur));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn("inline-flex items-center gap-1 justify-end", className)}>
      <Input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={val}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onFocus={() => { focusedRef.current = true; }}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setVal(fmt2(initialRef.current));
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="h-7 w-24 text-xs text-right tabular-nums px-2"
      />
      {saving ? (
        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />
      ) : savedFlash ? (
        <Check className="w-3 h-3 text-emerald-500 shrink-0" />
      ) : (
        <span className="w-3 h-3 shrink-0" />
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function BudgetTab({ campaignId, clientId, agencyId, campaignName, agencyName, pieces, kits, kitPieces, qtyMap, stores, onNavigateToRateio, onNavigateToSection, activeAdjustment }: BudgetTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Data hooks
  const { data: settings } = useBudgetSettings(campaignId);
  const saveSettings = useSaveBudgetSettings();
  const { data: suppliers = [] } = useBudgetSuppliers(campaignId);
  const addSupplier = useAddSupplier();
  const deleteSupplier = useDeleteSupplier();
  const updateSupplier = useUpdateSupplier();
  const { data: prices = [] } = useBudgetPrices(campaignId);
  const { data: extraCosts = [] } = useBudgetExtraCosts(campaignId);
  const { data: timelineEntries = [] } = useBudgetTimeline(campaignId);

  // ═══ Recotação por Quantidade ═══
  const [qtyRequoteOpen, setQtyRequoteOpen] = useState(false);
  const [reviewingQtyRequote, setReviewingQtyRequote] = useState<any | null>(null);
  const [qtyRejectNotes, setQtyRejectNotes] = useState("");
  const [qtyReviewProcessing, setQtyReviewProcessing] = useState(false);
  const [qtyExcludedKeys, setQtyExcludedKeys] = useState<Set<string>>(new Set());
  const { data: qtyRequotes = [] } = useQuery({
    queryKey: ["budget_qty_requotes", campaignId],
    queryFn: async () => {
      const { data } = await supabase
        .from("budget_qty_requotes" as any)
        .select("id, status, supplier_id, created_at, submitted_at, qty_changes, submitted_prices, notes, rejection_notes, expires_at, access_token")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      return (data as any[]) ?? [];
    },
  });

  // Realtime: refresh comparison & best proposal as soon as a supplier submits
  useRealtimeBudget(campaignId);

  // Materiais de apoio marcados como "compartilhar com fornecedor"
  const { data: sharedMaterials = [] } = useQuery({
    queryKey: ["shared_support_materials", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_support_materials")
        .select("id, title, file_url, file_name")
        .eq("campaign_id", campaignId)
        .eq("share_with_supplier", true as never)
        .not("file_url", "is", null)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Último envio de resultado da cotação ao cliente
  const { data: lastResultSentAt } = useQuery({
    queryKey: ["last_resultado_cotacao_enviado", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_activity_log")
        .select("created_at")
        .eq("campaign_id", campaignId)
        .eq("action", "resultado_cotacao_enviado")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data?.created_at ?? null;
    },
  });

  // Currency-aware formatter (depends on settings)
  const settingsTyped = settings as { currency_code?: string; currency_locked?: boolean } | null | undefined;
  const currencyCode = settingsTyped?.currency_code || "BRL";
  const currencyLocked = settingsTyped?.currency_locked === true;
  const fmtCurrency = (v: number | null | undefined) =>
    v == null ? "—" : `${currencyCode} ${formatCurrencyByCode(v, currencyCode)}`;
  const fmtBRL = (v: number | null | undefined) =>
    v == null ? "—" : `BRL ${v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;

  // Exchange rate for non-BRL currencies
  const { data: rateData, isLoading: rateLoading } = useExchangeRate(currencyCode);
  const exchangeRate = rateData?.rate ?? 1;

  // Local state
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [deadlineDraft, setDeadlineDraft] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<string | null>(null);
  const [editSupplierId, setEditSupplierId] = useState<string | null>(null);
  const [editSupplierDraft, setEditSupplierDraft] = useState({ company_name: "", contact_name: "", phone: "", email: "" });
  const [newSupplier, setNewSupplier] = useState({ company_name: "", contact_name: "", phone: "", email: "" });
  const [expandedSuggestionPieceId, setExpandedSuggestionPieceId] = useState<string | null>(null);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>(currencyCode);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [exportingBudget, setExportingBudget] = useState(false);
  const [downloadingSupplierId, setDownloadingSupplierId] = useState<string | null>(null);
  const [downloadingRequoteId, setDownloadingRequoteId] = useState<string | null>(null);
  const [clientSendDialogOpen, setClientSendDialogOpen] = useState(false);
  const [historySupplierId, setHistorySupplierId] = useState<string | null>(null);
  const [reopeningSupplierId, setReopeningSupplierId] = useState<string | null>(null);
  const [winnerSupplierId, setWinnerSupplierId] = useState<string | null>(null);
  const [negotiationSupplierId, setNegotiationSupplierId] = useState<string | null>(null);
  const [sendNegotiatedOpen, setSendNegotiatedOpen] = useState(false);

  // ── Editor de "Links do Vencedor" (configuração padrão usada no e-mail de vencedor) ──
  const settingsAny = settings as any;
  const [winnerLinksOpen, setWinnerLinksOpen] = useState(false);
  const [winnerMockupUrlDraft, setWinnerMockupUrlDraft] = useState("");
  const [winnerBookUrlDraft, setWinnerBookUrlDraft] = useState("");
  const [winnerCcEmailDraft, setWinnerCcEmailDraft] = useState("");
  const [savingWinnerLinks, setSavingWinnerLinks] = useState(false);

  // Collapsible sections (start collapsed)
  const [winnerLinksExpanded, setWinnerLinksExpanded] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  React.useEffect(() => {
    setWinnerMockupUrlDraft(settingsAny?.winner_mockup_url ?? "");
    setWinnerBookUrlDraft(settingsAny?.winner_book_url ?? "");
    setWinnerCcEmailDraft(settingsAny?.winner_cc_email ?? "");
  }, [settingsAny?.winner_mockup_url, settingsAny?.winner_book_url, settingsAny?.winner_cc_email]);

  const handleSaveWinnerLinks = async () => {
    const mockup = winnerMockupUrlDraft.trim();
    const book = winnerBookUrlDraft.trim();
    const cc = winnerCcEmailDraft.trim();
    const URL_RE = /^https?:\/\/.+/i;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (mockup && !URL_RE.test(mockup)) { toast.error("Link de mockup inválido (use http:// ou https://)."); return; }
    if (book && !URL_RE.test(book)) { toast.error("Link do book inválido (use http:// ou https://)."); return; }
    if (cc && !EMAIL_RE.test(cc)) { toast.error("E-mail de CC inválido."); return; }
    setSavingWinnerLinks(true);
    try {
      await saveSettings.mutateAsync({
        campaign_id: campaignId,
        budget_amount: settings?.budget_amount ?? null,
        deadline: settings?.deadline ?? null,
        winner_mockup_url: mockup || null,
        winner_book_url: book || null,
        winner_cc_email: cc || null,
      });
      toast.success("Links do vencedor salvos.");
      setWinnerLinksOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar links.");
    } finally {
      setSavingWinnerLinks(false);
    }
  };

  const { isAdminOrMaster } = useUserRole();
  const { user } = useAuth();

  const handleToggleSupplierLock = async (sup: { id: string; campaign_id: string; locked: boolean | null; status: string; company_name: string; submitted_at: string | null }) => {
    setReopeningSupplierId(sup.id);
    try {
      if (sup.status === "declinado") {
        await updateSupplier.mutateAsync({
          id: sup.id,
          campaign_id: sup.campaign_id,
          updates: { status: "aguardando", decline_reason: null, declined_at: null, locked: false } as never,
        });
        toast.success(`Participação reaberta para ${sup.company_name}.`);
        return;
      }
      if (sup.locked) {
        // ─── REOPEN: snapshot then unlock, preserving submitted_at so we can restore "Enviado" later
        await snapshotSupplierBudget({
          supplierId: sup.id,
          campaignId: sup.campaign_id,
          reason: "reopened",
          createdBy: user?.id ?? null,
        });
        await updateSupplier.mutateAsync({
          id: sup.id,
          campaign_id: sup.campaign_id,
          updates: { locked: false, status: "preenchendo" } as never,
        });
        toast.success(`Planilha liberada para ${sup.company_name} revisar.`);
      } else {
        // ─── RE-LOCK: restore to "enviado" without changing submitted_at.
        // If the supplier did not submit again, the original submission date must be preserved.
        const updates: Record<string, unknown> = { locked: true, status: "enviado" };
        await updateSupplier.mutateAsync({
          id: sup.id,
          campaign_id: sup.campaign_id,
          updates: updates as never,
        });
        toast.success(`Planilha de ${sup.company_name} travada novamente.`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao alterar trava da planilha. Tente novamente.");
    } finally {
      setReopeningSupplierId(null);
    }
  };

  // ─── Fetch client name + email (for "Send results" feature) ─────
  const { data: clientData } = useQuery({
    queryKey: ["client-name-email", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("name, email")
        .eq("id", clientId)
        .maybeSingle();
      return data as { name: string | null; email: string | null } | null;
    },
    enabled: !!clientId,
  });
  const clientName = clientData?.name || "";
  const clientEmail = (clientData as any)?.email || "";

  // Agency suppliers picker (multi-select)
  const { data: agencySuppliers = [] } = useAgencySuppliers(agencyId);
  const [agencySupplierSearch, setAgencySupplierSearch] = useState("");
  const [selectedAgencySupplierIds, setSelectedAgencySupplierIds] = useState<string[]>([]);
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);



  // Keep selectedCurrency in sync if settings load after mount
  React.useEffect(() => {
    setSelectedCurrency(currencyCode);
  }, [currencyCode]);

  // ─── Piece total quantities (sum across all stores) ────
  const pieceTotalsFull = useMemo(() => {
    const map: Record<string, number> = {};
    const installationMap: Record<string, number> = {};
    const freightMap: Record<string, number> = {};
    const noLogisticsMap: Record<string, number> = {};

    pieces.forEach((p) => {
      let total = 0;
      let inst = 0;
      let freight = 0;
      let none = 0;

      stores.forEach((s) => {
        const qty = qtyMap[`${s.id}-${p.id}`] || 0;
        const tipo = (s as any).tipo_entrega ?? 'frete_instalacao';
        
        if (tipo === 'frete_instalacao') inst += qty;
        else if (tipo === 'frete_apenas') freight += qty;
        else none += qty;

        total += qty;
      });

      map[p.id] = total;
      installationMap[p.id] = inst;
      freightMap[p.id] = freight;
      noLogisticsMap[p.id] = none;
    });

    return { map, installationMap, freightMap, noLogisticsMap };
  }, [pieces, stores, qtyMap]);

  const pieceTotals = pieceTotalsFull.map;

  // ─── Build per-piece quantities including kit expansion ─
  const kitPieceTotals = useMemo(() => {
    // For each kit, compute per-piece qty = kitTotalQty × kitPieceQuantity
    const map: Record<string, { kitId: string; pieceId: string; qty: number }[]> = {};
    kits.forEach((kit) => {
      const kpList = kitPieces.filter((kp) => kp.kit_id === kit.id);
      if (kpList.length === 0) return;
      const kitQty = Math.min(...kpList.map((kp) => {
        const pieceTotal = pieceTotals[kp.piece_id] || 0;
        return Math.floor(pieceTotal / (kp.quantity || 1));
      }));
      map[kit.id] = kpList.map((kp) => ({
        kitId: kit.id,
        pieceId: kp.piece_id,
        qty: kitQty * kp.quantity,
      }));
    });
    return map;
  }, [kits, kitPieces, pieceTotals]);

  // ─── Compute supplier totals (per-piece pricing) ──────
  // Partial: para TODOS os fornecedores, mesmo em preenchimento.
  // Final (supplierTotals): apenas status "enviado".
  // O total monetário usa o helper compartilhado computeSupplierTotal,
  // garantindo paridade EXATA com supplierNegotiationTotals (mesma
  // lógica de kit_only + expansão de kits + dedup).
  const supplierPartialTotals = useMemo(() => {
    const result: Record<string, { total: number; installation: number; freight: number; pricedPieces: number; totalPiecesNeeded: number; pct: number }> = {};
    const qtyResolver = (pieceId: string) => pieceTotals[pieceId] || 0;
    suppliers.forEach((sup) => {
      const priceResolver = (_sid: string, pid: string) => {
        const pr = prices.find((x) => x.supplier_id === sup.id && x.piece_id === pid);
        return Number(pr?.unit_price ?? 0);
      };
      const extraCostResolver = () => {
        const ec = extraCosts.find((e) => e.supplier_id === sup.id);
        return {
          installation: Number(ec?.installation_value) || 0,
          freight: Number(ec?.freight_value) || 0,
        };
      };
      const total = computeSupplierTotal({
        supplierId: sup.id,
        pieces,
        kitPieceTotals,
        qtyResolver,
        priceResolver,
        extraCostResolver,
      });

      // Counters (pricedPieces / totalPiecesNeeded / pct) — preservados
      // exatamente como antes, pois alimentam barras de progresso da UI.
      let pricedPieces = 0;
      let totalPiecesNeeded = 0;
      const counted = new Set<string>();
      pieces.filter((p) => !p.kit_only).forEach((piece) => {
        const qty = pieceTotals[piece.id] || 0;
        if (qty <= 0) return;
        totalPiecesNeeded += 1;
        const pr = prices.find((x) => x.supplier_id === sup.id && x.piece_id === piece.id);
        if (pr && Number(pr.unit_price) > 0) {
          pricedPieces += 1;
          counted.add(piece.id);
        }
      });
      Object.values(kitPieceTotals).forEach((kpItems) => {
        kpItems.forEach((kpi) => {
          if (counted.has(kpi.pieceId)) return;
          if (kpi.qty <= 0) return;
          totalPiecesNeeded += 1;
          const pr = prices.find((x) => x.supplier_id === sup.id && x.piece_id === kpi.pieceId);
          if (pr && Number(pr.unit_price) > 0) {
            pricedPieces += 1;
            counted.add(kpi.pieceId);
          }
        });
      });
      const ec = extraCosts.find((e) => e.supplier_id === sup.id);
      const installation = Number(ec?.installation_value) || 0;
      const freight = Number(ec?.freight_value) || 0;
      const pct = totalPiecesNeeded > 0 ? Math.round((pricedPieces / totalPiecesNeeded) * 100) : 0;
      result[sup.id] = { total, installation, freight, pricedPieces, totalPiecesNeeded, pct };
    });
    return result;
  }, [suppliers, prices, extraCosts, pieceTotals, kitPieceTotals, pieces]);

  // ─── Negotiation rateio (per-supplier isolated quantities) ───
  const negotiatingSupplierIds = useMemo(
    () => (suppliers as any[]).filter((s) => s.negotiation_status).map((s) => s.id),
    [suppliers]
  );
  const { data: negRateioRows = [] } = useQuery({
    queryKey: ["budget_negotiation_rateio_totals", campaignId, negotiatingSupplierIds.join(",")],
    enabled: negotiatingSupplierIds.length > 0,
    queryFn: async () => {
      try {
        return await supabasePaginate<any>((from, to) =>
          supabase
            .from("budget_negotiation_store_pieces" as never)
            .select("supplier_id, piece_id, quantity")
            .in("supplier_id", negotiatingSupplierIds)
            .range(from, to) as any
        );
      } catch {
        return [];
      }
    },
  });
  const negPieceTotalsBySupplier = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    for (const r of negRateioRows as any[]) {
      const m = (out[r.supplier_id] ||= {});
      m[r.piece_id] = (m[r.piece_id] || 0) + Number(r.quantity || 0);
    }
    return out;
  }, [negRateioRows]);

  // ─── Negotiation totals — usa preços ajustados (se houver) e o rateio
  // de negociação (se existir), reaproveitando o helper compartilhado para
  // garantir que a lógica de kit/dedup seja IDÊNTICA à do rateio original.
  // Quando o rateio de negociação é igual ao original e não há ajustes,
  // este total deve ser exatamente igual a supplierPartialTotals[id].total.
  const supplierNegotiationTotals = useMemo(() => {
    const result: Record<string, number> = {};
    for (const sup of suppliers as any[]) {
      if (!sup.negotiation_status) continue;
      const negTotals = negPieceTotalsBySupplier[sup.id];
      const hasNeg = negTotals && Object.keys(negTotals).length > 0;
      const qtyResolver = (pieceId: string) => {
        if (hasNeg) {
          const v = negTotals![pieceId];
          return v != null ? v : (pieceTotals[pieceId] || 0);
        }
        return pieceTotals[pieceId] || 0;
      };
      const priceResolver = (_sid: string, pid: string) => {
        const pr = prices.find((p) => p.supplier_id === sup.id && p.piece_id === pid) as any;
        return Number(pr?.adjusted_unit_price ?? pr?.unit_price ?? 0);
      };
      const extraCostResolver = () => {
        const ec = extraCosts.find((e) => e.supplier_id === sup.id) as any;
        return {
          installation: Number(ec?.adjusted_installation_value ?? ec?.installation_value ?? 0),
          freight: Number(ec?.adjusted_freight_value ?? ec?.freight_value ?? 0),
        };
      };
      result[sup.id] = computeSupplierTotal({
        supplierId: sup.id,
        pieces,
        kitPieceTotals,
        qtyResolver,
        priceResolver,
        extraCostResolver,
      });
    }
    return result;
  }, [suppliers, extraCosts, pieces, prices, pieceTotals, kitPieceTotals, negPieceTotalsBySupplier]);

  // Vencedor declarado (apenas 1 por campanha, garantido por índice único)
  const winnerSupplier = useMemo(() => {
    return (suppliers as any[]).find((s) => s.is_winner === true) || null;
  }, [suppliers]);

  // ─── Phase awareness ──────────────────────────────────
  const {
    currentPhase,
    phaseLockedAt,
    isPhaseLocked,
    unlockPhase,
    isUnlocking,
  } = useBudgetPhase(campaignId);
  const [unlockTarget, setUnlockTarget] = useState<BudgetPhase | null>(null);
  const { data: currentTotal } = useCurrentTotal(
    winnerSupplier?.id,
    campaignId,
    currentPhase,
    winnerSupplier
      ? {
          negotiation_status: (winnerSupplier as any).negotiation_status,
          negotiation_locked_total: (winnerSupplier as any).negotiation_locked_total,
          winner_locked_total: (winnerSupplier as any).winner_locked_total,
        }
      : undefined
  );


  // Totais por fornecedor:
  // - Se houver vencedor declarado, usa o valor congelado (winner_locked_total) de cada um.
  // - Caso contrário, usa o rateio atual (supplierPartialTotals) — refletindo edições recentes.
  const supplierTotals = useMemo(() => {
    const result: Record<string, number> = {};
    const hasWinner = !!winnerSupplier;
    suppliers.forEach((sup) => {
      if (sup.status !== "enviado") return;
      const locked = (sup as any).winner_locked_total;
      result[sup.id] = hasWinner && locked != null
        ? Number(locked)
        : (supplierPartialTotals[sup.id]?.total ?? 0);
    });
    return result;
  }, [suppliers, supplierPartialTotals, winnerSupplier]);

  const bestSupplier = useMemo(() => {
    let best: { id: string; total: number; name: string } | null = null;
    Object.entries(supplierTotals).forEach(([id, total]) => {
      if (!best || total < best.total) {
        const sup = suppliers.find((s) => s.id === id);
        best = { id, total, name: sup?.company_name || "" };
      }
    });
    return best;
  }, [supplierTotals, suppliers]);


  const handleToggleWinner = async (sup: { id: string; campaign_id: string; company_name: string }, makeWinner: boolean) => {
    try {
      if (makeWinner) {
        // Desmarcar qualquer outro vencedor da campanha primeiro
        const others = (suppliers as any[]).filter((s) => s.is_winner === true && s.id !== sup.id);
        for (const o of others) {
          await supabase.from("budget_suppliers")
            .update({ is_winner: false, winner_declared_at: null } as never)
            .eq("id", o.id);
        }
        // Congelar total de TODOS os fornecedores no momento da declaração
        for (const s of suppliers as any[]) {
          const total = supplierPartialTotals[s.id]?.total ?? 0;
          await supabase
            .from("budget_suppliers")
            .update({ winner_locked_total: total } as never)
            .eq("id", s.id);
        }
        // Congelar preços via snapshot antes de declarar o vencedor
        await snapshotSupplierBudget({
          supplierId: sup.id,
          campaignId,
          reason: "winner_declared" as any,
          createdBy: user?.id ?? null,
        });
        const { error } = await supabase.from("budget_suppliers")
          .update({
            is_winner: true,
            winner_declared_at: new Date().toISOString(),
            locked: true,
          } as never)
          .eq("id", sup.id);
        if (error) throw error;
        toast.success(`${sup.company_name} declarada vencedora. Preços congelados.`);
      } else {
        // Mantém snapshot e trava — admin destrava manualmente se necessário
        const { error } = await supabase.from("budget_suppliers")
          .update({ is_winner: false, winner_declared_at: null } as never)
          .eq("id", sup.id);
        if (error) throw error;
        toast.success("Vencedor desmarcado.");
      }
      queryClient.invalidateQueries({ queryKey: ["budget_suppliers", campaignId] });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao atualizar vencedor.");
    }
  };

  const budgetAmount = settings?.budget_amount != null ? Number(settings.budget_amount) : null;

  // ─── Winner KPI helpers ────────────────────────────────
  const winnerNegotiationStatus: string | null = (winnerSupplier as any)?.negotiation_status ?? null;
  const winnerInNegotiation = winnerNegotiationStatus === "pending" || winnerNegotiationStatus === "submitted" || winnerNegotiationStatus === "approved";
  const winnerOriginalTotal = winnerSupplier
    ? ((winnerSupplier as any).winner_locked_total ?? supplierPartialTotals[(winnerSupplier as any).id]?.total ?? 0)
    : 0;
  const winnerNegotiatedTotal = useMemo(() => {
    if (currentTotal) return currentTotal.total;
    if (!winnerSupplier) return 0;
    const w: any = winnerSupplier;
    if (w.negotiation_status === "approved" && w.negotiation_locked_total != null) {
      return Number(w.negotiation_locked_total);
    }
    return supplierNegotiationTotals[w.id] ?? winnerOriginalTotal;
  }, [currentTotal, winnerSupplier, supplierNegotiationTotals, winnerOriginalTotal]);

  // SourceBadge component for showing where the displayed total comes from
  const SourceBadge = () => {
    if (!currentTotal) return null;
    const labels: Record<string, { label: string; color: string }> = {
      original: { label: "Cotação original", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
      negotiated: { label: "Negociado", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
      adjustment: { label: "Ajuste ativo", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    };
    const meta = labels[currentTotal.source];
    if (!meta) return null;
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
        {meta.label}
      </span>
    );
  };


  const difference = (() => {
    if (budgetAmount == null) return null;
    if (winnerSupplier && winnerNegotiationStatus === "approved") {
      return winnerNegotiatedTotal - budgetAmount;
    }
    if (winnerSupplier) {
      return winnerOriginalTotal - budgetAmount;
    }
    return bestSupplier ? bestSupplier.total - budgetAmount : null;
  })();

  // ─── Deadline state ────────────────────────────────────
  const deadlineDate = settings?.deadline ? new Date(settings.deadline) : undefined;


  const handleSaveBudget = () => {
    const val = parseFloat(budgetDraft.replace(/[^\d.,]/g, "").replace(",", "."));
    saveSettings.mutate({
      campaign_id: campaignId,
      budget_amount: isNaN(val) ? null : val,
      deadline: settings?.deadline ?? null,
    });
    setEditingBudget(false);
  };

  const handleDeadlineChange = async (localIso: string) => {
    const finalIso = localIso ? new Date(localIso).toISOString() : null;
    const isFutureDeadline = !!finalIso && new Date(finalIso) > new Date();

    try {
      await saveSettings.mutateAsync({
        campaign_id: campaignId,
        budget_amount: budgetAmount,
        deadline: finalIso,
      });

      if (!isFutureDeadline) return;

      queryClient.setQueryData(["budget_suppliers", campaignId], (old: typeof suppliers | undefined) =>
        old?.map((sup) =>
          sup.status === "prazo_encerrado"
            ? { ...sup, status: "prazo_estendido", locked: false }
            : sup,
        ) ?? old,
      );

      const { error } = await supabase
        .from("budget_suppliers")
        .update({ status: "prazo_estendido", locked: false })
        .eq("campaign_id", campaignId)
        .eq("status", "prazo_encerrado");

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["budget_suppliers", campaignId] });
      toast.success("Prazo estendido. Fornecedores reabertos.");
    } catch (e) {
      console.error("Failed to update deadline", e);
      toast.error("Não foi possível atualizar o prazo. Tente novamente.");
      queryClient.invalidateQueries({ queryKey: ["budget_settings", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["budget_suppliers", campaignId] });
    }
  };

  const handleAddSupplier = () => {
    if (!newSupplier.company_name || !newSupplier.email) {
      toast.error("Preencha empresa e email.");
      return;
    }
    addSupplier.mutate(
      { campaign_id: campaignId, ...newSupplier },
      {
        onSuccess: () => {
          toast.success("Fornecedor adicionado!");
          setAddOpen(false);
          setNewSupplier({ company_name: "", contact_name: "", phone: "", email: "" });
        },
        onError: (e: any) => toast.error(e.message?.includes("duplicate") ? "Este email já foi cadastrado." : "Erro ao adicionar."),
      }
    );
  };

  // ─── Email mailto: builder ─────────────────────────────
  const buildEmailMailto = (sup: typeof suppliers[0]) => {
    const portalUrl = `${PUBLIC_BASE_URL}/orcamento/${sup.access_token}`;
    const labels = getMessageLabels(currencyCode);
    const locale = getLocaleFromCurrency(currencyCode);
    const subject = `${campaignName} — ${labels.inviteSubject}`;

    const deadlineBlock = settings?.deadline
      ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⏰ ${labels.inviteDeadline.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 ${new Date(settings.deadline).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
`
      : '';

    const timelineBlock = timelineEntries.length > 0
      ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━
  📅 ${labels.inviteTimelineTitle}
━━━━━━━━━━━━━━━━━━━━━━━━━━

${timelineEntries.map(e => `🔸 ${new Date(e.entry_date + 'T00:00:00').toLocaleDateString(locale)}\n   ${e.description}`).join('\n\n')}

⚠️  ${labels.inviteTimelineAcceptance}
`
      : '';

    const materialsBlock = sharedMaterials.length > 0
      ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━
  📎 ${labels.inviteMaterials.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━

${sharedMaterials.map((m: any) => `🔸 ${m.title || m.file_name}\n   ${m.file_url}`).join('\n\n')}

💡 Você também encontrará todos esses materiais dentro do portal de cotação.
`
      : '';

    const body = `━━━━━━━━━━━━━━━━━━━━━━━━━━
  📋 ${labels.inviteSubject.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━

👋 ${labels.inviteGreeting}, ${sup.contact_name}!

✨ A ${agencyName} ${labels.inviteIntro} a ${sup.company_name} ${labels.inviteAction}:

${clientName ? `🏢 CLIENTE: ${clientName.toUpperCase()}\n` : ''}📌 ${locale === 'es-CL' ? 'CAMPAÑA' : 'CAMPANHA'}: ${campaignName.toUpperCase()}


━━━━━━━━━━━━━━━━━━━━━━━━━━
  📝 ${locale === 'es-CL' ? 'CÓMO PARTICIPAR' : 'COMO PARTICIPAR'}
━━━━━━━━━━━━━━━━━━━━━━━━━━

${labels.inviteInstructions.map((inst, i) => `▸ ${i + 1}️⃣  ${inst}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔗 ${locale === 'es-CL' ? 'ACCEDA AQUÍ' : 'ACESSE AQUI'}
━━━━━━━━━━━━━━━━━━━━━━━━━━

👉 ${portalUrl}
${deadlineBlock}${timelineBlock}${materialsBlock}
━━━━━━━━━━━━━━━━━━━━━━━━━━

💼 Este convite foi enviado em nome da ${agencyName}.
🚀 Powered by ProduzAI
`;

    return `mailto:${sup.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // ─── WhatsApp message builder ──────────────────────────
  const buildWhatsAppUrl = (sup: typeof suppliers[0]) => {
    const portalUrl = `${PUBLIC_BASE_URL}/orcamento/${sup.access_token}`;
    const labels = getMessageLabels(currencyCode);
    const locale = getLocaleFromCurrency(currencyCode);
    const deadlineStr = deadlineDate ? format(deadlineDate, locale === 'es-CL' ? "dd/MM/yyyy 'a las' HH:mm" : "dd/MM/yyyy 'às' HH:mm") : (locale === 'es-CL' ? "no definido" : "não definido");
    const materialsLine = sharedMaterials.length > 0
      ? `\n\n📎 ${labels.inviteMaterials}:\n${sharedMaterials.map((m: any) => `• ${m.title || m.file_name}: ${m.file_url}`).join('\n')}`
      : '';
    
    const instrStr = labels.inviteInstructions.map((inst, i) => `${i + 1}) ${inst}`).join('\n');
    
    const clientLine = clientName ? `🏢 *${locale === 'es-CL' ? 'CLIENTE' : 'CLIENTE'}: ${clientName.toUpperCase()}*\n` : '';
    const msg = `${labels.inviteGreeting} ${sup.contact_name}! A ${agencyName} ${labels.inviteIntro} ${sup.company_name} ${labels.inviteAction} ${campaignName}.\n\n${clientLine}${labels.inviteLinkText}\n${portalUrl}\n\n${labels.inviteDeadline}: ${deadlineStr}${materialsLine}\n\n${labels.inviteInstructionsTitle}\n${instrStr}\n\n${labels.inviteFooter}`;

    const phone = sup.phone.replace(/\D/g, "");
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const handleWhatsAppClick = (sup: typeof suppliers[0]) => {
    if (!sup.invited_at) {
      updateSupplier.mutate({ id: sup.id, campaign_id: campaignId, updates: { invited_at: new Date().toISOString() } });
    }
  };

  const handleExportBudget = async () => {
    if (suppliers.length === 0) {
      toast.error("Adicione ao menos um fornecedor para exportar.");
      return;
    }

    setExportingBudget(true);
    try {
      await exportBudgetComparison({
        campaignName,
        agencyName,
        clientName: "",
        currencyCode,
        budgetAmount,
        suppliers,
        prices,
        extraCosts,
        pieces,
        kits,
        kitPieces,
        qtyMap,
        stores,
      });
      toast.success("Planilha de cotação exportada.");
    } catch (error) {
      console.error("Budget export error:", error);
      toast.error("Erro ao exportar a planilha de cotação.");
    } finally {
      setExportingBudget(false);
    }
  };

  // ─── Download a single supplier's filled spreadsheet ─────
  const handleDownloadSupplierSheet = async (sup: typeof suppliers[0]) => {
    if (downloadingSupplierId) return;
    setDownloadingSupplierId(sup.id);
    const toastId = toast.loading(`Gerando planilha de ${sup.company_name}...`, {
      description: "Baixando imagens e montando o arquivo. Isso pode levar alguns segundos.",
    });
    try {
      // Build display rows matching SupplierPortal layout
      type Merged =
        | { type: "piece"; data: typeof pieces[number] }
        | { type: "kit"; data: typeof kits[number] };
      const merged: Merged[] = [
        ...pieces.filter((p) => !p.kit_only).map((p) => ({ type: "piece" as const, data: p })),
        ...kits.map((k) => ({ type: "kit" as const, data: k })),
      ];
      merged.sort((a, b) => (a.data.display_order ?? 0) - (b.data.display_order ?? 0));

      const supPrices = prices.filter((p) => p.supplier_id === sup.id);
      const priceFor = (pieceId: string): number | null => {
        const pr = supPrices.find((x) => x.piece_id === pieceId);
        return pr && pr.unit_price != null ? Number(pr.unit_price) : null;
      };

      const rows: SupplierExportRow[] = [];
      merged.forEach((item) => {
        if (item.type === "kit") {
          const kit = item.data;
          const kpList = kitPieces.filter((kp) => kp.kit_id === kit.id);
          if (kpList.length === 0) return;
          const kitTotalQty = Math.min(
            ...kpList.map((kp) => Math.floor((pieceTotals[kp.piece_id] || 0) / (kp.quantity || 1)))
          );
          rows.push({
            type: "kit_header",
            name: kit.name,
            code: kit.code,
            totalQty: kitTotalQty,
            unitPrice: null,
            lineTotal: 0,
            image_url: (kit as any).image_report_url ?? kit.image_url ?? null,
          });
          kpList.forEach((kp) => {
            const piece = pieces.find((p) => p.id === kp.piece_id);
            if (!piece) return;
            const qty = kitTotalQty * kp.quantity;
            const up = priceFor(kp.piece_id);
            rows.push({
              type: "kit_piece",
              name: piece.name,
              code: piece.code,
              specification: (piece as any).specification ?? "",
              size: (piece as any).size ?? "",
              totalQty: qty,
              unitPrice: up,
              lineTotal: up != null ? up * qty : 0,
              image_url: (piece as any).image_report_url ?? piece.image_url ?? null,
            });
          });
        } else {
          const p = item.data;
          const qty = pieceTotals[p.id] || 0;
          const up = priceFor(p.id);
          rows.push({
            type: "standalone_piece",
            name: p.name,
            code: p.code,
            specification: (p as any).specification ?? "",
            size: (p as any).size ?? "",
            totalQty: qty,
            unitPrice: up,
            lineTotal: up != null ? up * qty : 0,
            image_url: (p as any).image_report_url ?? p.image_url ?? null,
          });
        }
      });

      const ec = extraCosts.find((e) => e.supplier_id === sup.id);
      const installation = ec?.installation_value != null ? Number(ec.installation_value) : null;
      const freight = ec?.freight_value != null ? Number(ec.freight_value) : null;
      const itemsTotal = rows.reduce((s, r) => s + (r.type === "kit_header" ? 0 : r.lineTotal), 0);
      const grandTotal = itemsTotal + (installation || 0) + (freight || 0);

      // Fetch full store data (city/state/store_code) for the Rateio sheet
      const storeIds = stores.map((s) => s.id);
      let fullStores: any[] = [];
      if (storeIds.length > 0) {
        // Chunk .in() to stay under URL limits and the 1000-row response cap
        const CHUNK = 500;
        for (let i = 0; i < storeIds.length; i += CHUNK) {
          const chunk = storeIds.slice(i, i + CHUNK);
          const { data: storeRows } = await supabase
            .from("client_stores")
            .select("id, name, city, state, store_code")
            .in("id", chunk);
          if (storeRows) fullStores.push(...storeRows);
        }
      }
      // Preserve the order of the stores prop
      const storeMap = new Map(fullStores.map((s) => [s.id, s]));
      const orderedStores = stores
        .map((s) => storeMap.get(s.id) ?? { id: s.id, name: s.name, city: null, state: null, store_code: null })
        .filter(Boolean);

      await exportSupplierBudget({
        campaignName,
        agencyName,
        clientName: "",
        supplierName: sup.company_name,
        currencyCode,
        rows,
        installation,
        freight,
        grandTotal,
        rateio: {
          pieces,
          kits,
          kitPieces: kitPieces as any,
          stores: orderedStores as any,
          qtyMap,
        },
      });
      toast.dismiss(toastId);
      toast.success("Planilha do fornecedor gerada.");
    } catch (e) {
      console.error("Supplier sheet export error:", e);
      toast.dismiss(toastId);
      toast.error("Erro ao gerar planilha do fornecedor.");
    } finally {
      setDownloadingSupplierId(null);
    }
  };

  // ─── Download per-supplier requote sheet (same layout as supplier sheet, but with requote prices/qtys) ───
  const handleDownloadRequoteSheet = async (sup: typeof suppliers[0], rq: any) => {
    if (downloadingRequoteId) return;
    setDownloadingRequoteId(rq.id);
    const toastId = toast.loading(`Gerando planilha da recotação de ${sup.company_name}...`, {
      description: "Aplicando preços e quantidades recotadas.",
    });
    try {
      const submittedPrices = (rq.submitted_prices ?? {}) as Record<string, number>;
      const qtyChanges = (rq.qty_changes ?? {}) as Record<string, { old_qty: number; new_qty: number }>;

      type Merged =
        | { type: "piece"; data: typeof pieces[number] }
        | { type: "kit"; data: typeof kits[number] };
      const merged: Merged[] = [
        ...pieces.filter((p) => !p.kit_only).map((p) => ({ type: "piece" as const, data: p })),
        ...kits.map((k) => ({ type: "kit" as const, data: k })),
      ];
      merged.sort((a, b) => (a.data.display_order ?? 0) - (b.data.display_order ?? 0));

      const supPrices = prices.filter((p) => p.supplier_id === sup.id);
      const priceFor = (pieceId: string): number | null => {
        if (submittedPrices[pieceId] != null) return Number(submittedPrices[pieceId]);
        const pr = supPrices.find((x) => x.piece_id === pieceId);
        return pr && pr.unit_price != null ? Number(pr.unit_price) : null;
      };
      const qtyFor = (pieceId: string): number => {
        if (qtyChanges[pieceId]?.new_qty != null) return Number(qtyChanges[pieceId].new_qty);
        return pieceTotals[pieceId] || 0;
      };

      const rows: SupplierExportRow[] = [];
      merged.forEach((item) => {
        if (item.type === "kit") {
          const kit = item.data;
          const kpList = kitPieces.filter((kp) => kp.kit_id === kit.id);
          if (kpList.length === 0) return;
          const rqKitKey = `kit:${kit.id}`;
          const kitTotalQty = qtyChanges[rqKitKey]?.new_qty != null
            ? Number(qtyChanges[rqKitKey].new_qty)
            : Math.min(
              ...kpList.map((kp) => Math.floor(qtyFor(kp.piece_id) / (kp.quantity || 1)))
            );
          rows.push({
            type: "kit_header",
            name: kit.name,
            code: kit.code,
            totalQty: kitTotalQty,
            unitPrice: null,
            lineTotal: 0,
            image_url: (kit as any).image_report_url ?? kit.image_url ?? null,
          });
          kpList.forEach((kp) => {
            const piece = pieces.find((p) => p.id === kp.piece_id);
            if (!piece) return;
            const qty = kitTotalQty * kp.quantity;
            const up = priceFor(kp.piece_id);
            rows.push({
              type: "kit_piece",
              name: piece.name,
              code: piece.code,
              specification: (piece as any).specification ?? "",
              size: (piece as any).size ?? "",
              totalQty: qty,
              unitPrice: up,
              lineTotal: up != null ? up * qty : 0,
              image_url: (piece as any).image_report_url ?? piece.image_url ?? null,
            });
          });
        } else {
          const p = item.data;
          const qty = qtyFor(p.id);
          const up = priceFor(p.id);
          rows.push({
            type: "standalone_piece",
            name: p.name,
            code: p.code,
            specification: (p as any).specification ?? "",
            size: (p as any).size ?? "",
            totalQty: qty,
            unitPrice: up,
            lineTotal: up != null ? up * qty : 0,
            image_url: (p as any).image_report_url ?? p.image_url ?? null,
          });
        }
      });

      const ec = extraCosts.find((e) => e.supplier_id === sup.id);
      const installation = ec?.installation_value != null ? Number(ec.installation_value) : null;
      const freight = ec?.freight_value != null ? Number(ec.freight_value) : null;
      const itemsTotal = rows.reduce((s, r) => s + (r.type === "kit_header" ? 0 : r.lineTotal), 0);
      const grandTotal = itemsTotal + (installation || 0) + (freight || 0);

      // ─── Build Rateio (Matriz Lojas x Peças) using the negotiation rateio
      //     for this supplier. Falls back to the original campaign qtyMap when
      //     no negotiation rateio exists for the supplier. ───────────────────
      let rateioQtyMap: Record<string, number> = { ...qtyMap };
      try {
        const negRows = await supabasePaginate<any>((from, to) =>
          supabase
            .from("budget_negotiation_store_pieces" as never)
            .select("store_id, piece_id, quantity")
            .eq("supplier_id", sup.id)
            .range(from, to) as any
        );
        if (Array.isArray(negRows) && negRows.length > 0) {
          // Use ONLY negotiation rateio as source of truth for this supplier.
          const negMap: Record<string, number> = {};
          for (const r of negRows) {
            negMap[`${r.store_id}-${r.piece_id}`] = Number(r.quantity || 0);
          }
          rateioQtyMap = negMap;
        }
      } catch (err) {
        console.warn("Falha ao carregar rateio de negociação — usando rateio original.", err);
      }

      await exportSupplierBudget({
        campaignName: `${campaignName} — Recotação`,
        agencyName,
        clientName: "",
        supplierName: sup.company_name,
        currencyCode,
        rows,
        installation,
        freight,
        grandTotal,
        rateio: {
          pieces,
          kits,
          kitPieces: kitPieces as any,
          stores,
          qtyMap: rateioQtyMap,
        },
      });
      toast.dismiss(toastId);
      toast.success("Planilha da recotação gerada.");
    } catch (e) {
      console.error("Requote sheet export error:", e);
      toast.dismiss(toastId);
      toast.error("Erro ao gerar planilha da recotação.");
    } finally {
      setDownloadingRequoteId(null);
    }
  };


  const detailSup = detailSupplier ? suppliers.find((s) => s.id === detailSupplier) : null;
  const detailPrices = detailSupplier ? prices.filter((p) => p.supplier_id === detailSupplier) : [];
  const detailCosts = detailSupplier ? extraCosts.find((e) => e.supplier_id === detailSupplier) : null;
  const { data: detailSuggestions = [] } = useSupplierSpecSuggestions(detailSupplier);
  const suggestionsMap = useMemo(() => {
    const map: Record<string, { suggested_spec: string; orcado_por: string }> = {};
    detailSuggestions.forEach((s: any) => { map[s.piece_id] = { suggested_spec: s.suggested_spec, orcado_por: s.orcado_por }; });
    return map;
  }, [detailSuggestions]);

  const detailGrandTotal = useMemo(() => {
    if (!detailSupplier) return 0;
    let total = 0;
    // Per-piece pricing for standalone pieces
    detailPrices.forEach((pr) => {
      if (!pr.piece_id) return;
      const piece = pieces.find((p) => p.id === pr.piece_id);
      if (piece && !piece.kit_only) {
        total += (Number(pr.unit_price) || 0) * (pieceTotals[pr.piece_id] || 0);
      }
      // Kit pieces
      Object.values(kitPieceTotals).forEach((kpItems) => {
        const match = kpItems.find((kpi) => kpi.pieceId === pr.piece_id);
        if (match) {
          total += (Number(pr.unit_price) || 0) * match.qty;
        }
      });
    });
    total += Number(detailCosts?.installation_value) || 0;
    total += Number(detailCosts?.freight_value) || 0;
    return total;
  }, [detailSupplier, detailPrices, detailCosts, pieceTotals, kitPieceTotals, pieces]);

  // ─── Admin manual edit (works even when supplier is locked) ───
  const upsertAdminPrice = async (pieceId: string, value: number | null) => {
    if (!detailSupplier) return;
    if (value == null) {
      const { error } = await supabase
        .from("budget_prices")
        .delete()
        .eq("supplier_id", detailSupplier)
        .eq("piece_id", pieceId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("budget_prices")
        .upsert(
          { supplier_id: detailSupplier, campaign_id: campaignId, piece_id: pieceId, unit_price: value } as never,
          { onConflict: "supplier_id,piece_id" }
        );
      if (error) throw error;
    }
    await queryClient.invalidateQueries({ queryKey: ["budget_prices", campaignId] });
  };

  const upsertAdminExtra = async (field: "installation_value" | "freight_value", value: number | null) => {
    if (!detailSupplier) return;
    const { error } = await supabase
      .from("budget_extra_costs")
      .upsert(
        { supplier_id: detailSupplier, [field]: value ?? 0 } as never,
        { onConflict: "supplier_id" }
      );
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ["budget_extra_costs", campaignId] });
  };

  return (
    <div className="space-y-6">
      {activeAdjustment && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 flex items-center gap-1.5">
          <Layers className="w-3 h-3" />
          <span>Ajuste de mockup ativo: <strong>{activeAdjustment.name}</strong>. A cotação vigente pode ser diferente do original.</span>
        </div>
      )}

      {(() => {
        const pLabels = getSupplierPortalLabels(currencyCode);
        const comFrete = stores.filter(s => {
          const tipo = (s as any).tipo_entrega ?? 'frete_instalacao';
          return tipo === 'frete_instalacao' || tipo === 'frete_apenas';
        }).length;
        const comInstalacao = stores.filter(s => ((s as any).tipo_entrega ?? 'frete_instalacao') === 'frete_instalacao').length;
        const semLogistica = stores.filter(s => (s as any).tipo_entrega === 'sem_logistica').length;
        
        return (
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full border border-border shadow-sm">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold">{comFrete} {pLabels.summaryFrete}</span>
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">
              <Wrench className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">{comInstalacao} {pLabels.summaryInstallations}</span>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
              <Store className="w-4 h-4 text-gray-600" />
              <span className="text-xs font-semibold text-gray-700">{semLogistica} {pLabels.summaryNoLogistics}</span>
            </div>
          </div>
        );
      })()}

      {(() => {
        const semLogistica = stores.filter(s => (s as any).tipo_entrega === 'sem_logistica').length;
        if (semLogistica === 0) return null;
        const pLabels = getSupplierPortalLabels(currencyCode);
        return (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
            <p className="text-xs font-medium text-amber-800 leading-snug">
              {pLabels.noLogisticsNote(semLogistica)}
            </p>
          </div>
        );
      })()}

      <PhaseStepperWithApproval
        campaignId={campaignId}
        currentPhase={currentPhase}
        phaseLockedAt={phaseLockedAt as Record<string, string>}
        isAdminOrMaster={isAdminOrMaster}
        onUnlock={(phase) => setUnlockTarget(phase)}
        isUnlocking={isUnlocking}
      />

      <AdjustmentKPIBlock campaignId={campaignId} currencyCode={currencyCode} />

      {/* ═══ KPI CARDS ═══ */}
      <div className={cn("grid grid-cols-1 gap-4 items-stretch", winnerSupplier ? "md:grid-cols-4" : "md:grid-cols-3")}>
        {/* Reusable header with fixed height for visual alignment across all KPI cards */}
        {/* Empresa Vencedora (só aparece quando há vencedor declarado) */}
        {winnerSupplier && (
          <Card className="border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 h-full flex flex-col">
            <div className="px-6 h-12 flex items-center gap-1.5 border-b border-amber-200/60 dark:border-amber-800/60">
              <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Empresa Vencedora</p>
            </div>
            <CardContent className="px-6 py-4 flex-1 flex flex-col gap-3">
              <div>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-400 leading-tight truncate" title={(winnerSupplier as any).company_name}>
                  {(winnerSupplier as any).company_name}
                </p>
                {(winnerSupplier as any).winner_declared_at && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Declarada em {format(new Date((winnerSupplier as any).winner_declared_at), "dd/MM/yyyy")}
                  </p>
                )}
              </div>

              {/* Valor vencedor — sempre fixo (frozen no momento da declaração) */}
              <div className="mt-auto">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Valor vencedor</p>
                  <SourceBadge />
                </div>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                  {fmtCurrency(winnerOriginalTotal)}
                </p>
                {currencyCode !== "BRL" && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">Ref. {fmtBRL(winnerOriginalTotal * exchangeRate)}</p>
                )}
              </div>

              {/* Valor negociado — aparece quando há negociação */}
              {winnerInNegotiation && (
                <div className="pt-3 border-t border-border">
                  <p className={`text-[10px] uppercase tracking-wide ${winnerNegotiationStatus === "approved" ? "text-emerald-600" : "text-amber-600"}`}>
                    {winnerNegotiationStatus === "approved" ? "✅ Valor negociado (vale)" : "🤝 Em negociação"}
                  </p>
                  <p className={`text-xl font-bold mt-0.5 ${winnerNegotiationStatus === "approved" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                    {fmtCurrency(winnerNegotiatedTotal)}
                    {(winnerSupplier as any)?.negotiation_status === "approved" && (winnerSupplier as any)?.negotiation_locked_total != null && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Lock className="w-3.5 h-3.5 text-muted-foreground inline ml-1 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            Valor congelado no momento da aprovação da negociação. Não é afetado por ajustes de mockup ou exclusão de peças.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </p>
                  {currencyCode !== "BRL" && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">Ref. {fmtBRL(winnerNegotiatedTotal * exchangeRate)}</p>
                  )}
                </div>
              )}

              {(winnerSupplier as any).negotiation_status && (
                <Button
                  size="sm"
                  className="w-full gap-1.5 mt-2 px-2 text-[11px] font-semibold whitespace-nowrap bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white border-0 shadow-md hover:shadow-lg transition-all"
                  onClick={() => setSendNegotiatedOpen(true)}
                >
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  Enviar Proposta Negociada
                </Button>
              )}
            </CardContent>
          </Card>
        )}


        {/* Budget da Campanha */}
        <Card className="h-full flex flex-col">
          <div className="px-6 h-12 flex items-center border-b border-border/60">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Budget da Campanha</p>
          </div>
          <CardContent className="px-6 py-4 flex-1 flex flex-col gap-4">
            <div>
              {(() => {
                const canEditBudgetMeta =
                  currentPhase === "rateio" || currentPhase === "cotacoes" || isAdminOrMaster;
                if (editingBudget && canEditBudgetMeta) {
                  return (
                    <div className="flex items-center gap-2">
                      <Input
                        autoFocus
                        value={budgetDraft}
                        onChange={(e) => setBudgetDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveBudget()}
                        placeholder="0,00"
                        className="h-8 text-sm"
                      />
                      <Button size="sm" variant="ghost" onClick={handleSaveBudget}><Check className="w-4 h-4" /></Button>
                    </div>
                  );
                }
                if (canEditBudgetMeta) {
                  return (
                    <button
                      onClick={() => { setBudgetDraft(budgetAmount?.toString() ?? ""); setEditingBudget(true); }}
                      className="text-2xl font-bold text-foreground hover:text-primary transition-colors flex items-center gap-2"
                    >
                      {budgetAmount != null ? fmtCurrency(budgetAmount) : "Definir"}
                      <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  );
                }
                return (
                  <span className="text-2xl font-bold text-foreground flex items-center gap-2">
                    {budgetAmount != null ? fmtCurrency(budgetAmount) : "—"}
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  </span>
                );
              })()}
              {budgetAmount != null && currencyCode !== "BRL" && (
                <p className="text-[11px] text-muted-foreground mt-1">Ref. em Reais: {fmtBRL(budgetAmount * exchangeRate)}</p>
              )}
            </div>

            <div className="mt-auto space-y-3">
              {/* Deadline */}
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Prazo p/ envio das cotações</p>
                {(() => {
                  const currentVal = settings?.deadline ?? null;
                  const draftVal = deadlineDraft ?? currentVal;
                  const hasChange = (draftVal ?? "") !== (currentVal ?? "");
                  return (
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 min-w-0">
                        <DateTimePicker
                          value={draftVal}
                          onChange={(v) => setDeadlineDraft(v)}
                          placeholder="Definir prazo"
                          buttonClassName="h-7 text-xs"
                        />
                      </div>
                      {hasChange && (
                        <>
                          <Button
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            disabled={saveSettings.isPending}
                            onClick={async () => {
                              await handleDeadlineChange(draftVal ?? "");
                              setDeadlineDraft(null);
                            }}
                            title="Confirmar prazo"
                          >
                            {saveSettings.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 shrink-0"
                            onClick={() => setDeadlineDraft(null)}
                            title={t("budgets.cancel")}
                          >
                            <span className="text-xs">×</span>
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>


              {/* Currency */}
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Moeda</p>
                {currencyLocked ? (
                  <div className="flex items-center gap-1.5 h-7 text-xs text-foreground">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-medium">
                      {currencyCode === "USD"
                        ? "Dólar Americano"
                        : currencyCode === "CLP"
                          ? "Peso Chileno"
                          : "Real Brasileiro"}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                      <SelectTrigger className="h-7 w-auto text-xs gap-1 px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BRL" className="text-xs">🇧🇷 Real Brasileiro (BRL)</SelectItem>
                        <SelectItem value="USD" className="text-xs">🇺🇸 Dólar Americano (USD)</SelectItem>
                        <SelectItem value="CLP" className="text-xs">🇨🇱 Peso Chileno (CLP)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setShowLockConfirm(true)}
                    >
                      Confirmar moeda
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Melhor Proposta / Vencedor em negociação */}
        <Card className={cn("h-full flex flex-col", (winnerSupplier && winnerInNegotiation) || bestSupplier ? "border-emerald-200 dark:border-emerald-800" : "")}>
          <div className="px-6 h-12 flex items-center border-b border-border/60">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {winnerSupplier && winnerInNegotiation
                ? (winnerNegotiationStatus === "approved" ? "Proposta negociada" : "Em negociação")
                : "Melhor Proposta"}
            </p>
          </div>
          <CardContent className="px-6 py-4 flex-1 flex flex-col gap-3">
            <div>
              {winnerSupplier && winnerInNegotiation ? (
                <>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {fmtCurrency(winnerNegotiatedTotal)}
                    {(winnerSupplier as any)?.negotiation_status === "approved" && (winnerSupplier as any)?.negotiation_locked_total != null && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Lock className="w-4 h-4 text-muted-foreground inline ml-1.5 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            Valor congelado no momento da aprovação da negociação. Não é afetado por ajustes de mockup ou exclusão de peças.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </p>
                  {currencyCode !== "BRL" && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">Ref. {fmtBRL(winnerNegotiatedTotal * exchangeRate)}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground line-through mt-1">
                    Original: {fmtCurrency(winnerOriginalTotal)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{(winnerSupplier as any).company_name}</p>
                  {(() => {
                    const ec = extraCosts.find((e) => e.supplier_id === (winnerSupplier as any).id) as any;
                    const installation = Number(ec?.adjusted_installation_value ?? ec?.installation_value ?? 0);
                    const freight = Number(ec?.adjusted_freight_value ?? ec?.freight_value ?? 0);
                    const production = Math.max(0, winnerNegotiatedTotal - installation - freight);
                    return (
                      <div className="mt-3 pt-3 border-t border-border/60 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Produção</span>
                          <span className="font-medium tabular-nums">{fmtCurrency(production)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Embalagem / Frete</span>
                          <span className="font-medium tabular-nums">{fmtCurrency(freight)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Instalação</span>
                          <span className="font-medium tabular-nums">{fmtCurrency(installation)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : bestSupplier ? (
                <>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmtCurrency(bestSupplier.total)}</p>
                  {currencyCode !== "BRL" && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">Ref. {fmtBRL(bestSupplier.total * exchangeRate)}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{bestSupplier.name}</p>
                  {(() => {
                    const sup = (suppliers as any[]).find((s) => s.company_name === bestSupplier.name);
                    if (!sup) return null;
                    const ec = extraCosts.find((e) => e.supplier_id === sup.id) as any;
                    const installation = Number(ec?.installation_value ?? 0);
                    const freight = Number(ec?.freight_value ?? 0);
                    const production = Math.max(0, bestSupplier.total - installation - freight);
                    return (
                      <div className="mt-3 pt-3 border-t border-border/60 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Produção</span>
                          <span className="font-medium tabular-nums">{fmtCurrency(production)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Embalagem / Frete</span>
                          <span className="font-medium tabular-nums">{fmtCurrency(freight)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Instalação</span>
                          <span className="font-medium tabular-nums">{fmtCurrency(installation)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t("budgets.empty")}</p>
              )}
            </div>
            {suppliers.some((s) => s.status === "enviado") && (
              <div className="mt-auto">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5 h-8 text-xs whitespace-normal leading-tight border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                  onClick={() => setClientSendDialogOpen(true)}
                >
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Enviar ao cliente</span>
                </Button>
                {lastResultSentAt && (
                  <p className="mt-1.5 text-[10px] text-muted-foreground text-center">
                    Último envio ao cliente: {format(new Date(lastResultSentAt), "dd/MM/yyyy 'às' HH:mm")}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>


        {/* Diferença */}
        {(() => {
          const winnerDiff = budgetAmount != null && winnerSupplier
            ? (winnerNegotiationStatus === "approved" ? winnerNegotiatedTotal : winnerOriginalTotal) - budgetAmount
            : null;
          const bestDiff = budgetAmount != null && bestSupplier ? bestSupplier.total - budgetAmount : null;
          const renderDiff = (label: string, val: number | null) => (
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
              {val != null ? (
                <>
                  <p className={cn("text-lg font-bold", val <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                    {val <= 0 ? "" : "+"}{fmtCurrency(val)}
                  </p>
                  {currencyCode !== "BRL" && (
                    <p className="text-[10px] text-muted-foreground">Ref. {fmtBRL(val * exchangeRate)}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
          );
          return (
            <Card className="h-full flex flex-col">
              <div className="px-6 h-12 flex items-center border-b border-border/60">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Diferença</p>
              </div>
              <CardContent className="px-6 py-4 flex-1 flex flex-col justify-around gap-3">
                {renderDiff("vs. Proposta vencedora", winnerDiff)}
                {renderDiff("vs. Melhor proposta", bestDiff)}
              </CardContent>
            </Card>
          );
        })()}

      </div>

      {/* ═══ LINKS DO VENCEDOR (Admin/Master) ═══ */}
      {isAdminOrMaster && (
        <Card>
          <Collapsible open={winnerLinksExpanded} onOpenChange={setWinnerLinksExpanded}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors rounded-t-lg"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-sm font-semibold leading-tight">Links do Vencedor</p>
                  {!winnerLinksExpanded && (
                    <span className="text-[11px] text-muted-foreground italic ml-2 truncate hidden sm:inline">
                      Mockup: {settingsAny?.winner_mockup_url ? "configurado" : "não configurado"}
                    </span>
                  )}
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", winnerLinksExpanded && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Pré-preenchem o e-mail enviado ao fornecedor vencedor (mockup, book e CC).
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-[11px]">
                        <span className="text-muted-foreground">
                          Mockup:{" "}
                          <span className={settingsAny?.winner_mockup_url ? "text-foreground font-medium" : "italic"}>
                            {settingsAny?.winner_mockup_url ? "configurado" : "não configurado"}
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          Book:{" "}
                          <span className={settingsAny?.winner_book_url ? "text-foreground font-medium" : "italic"}>
                            {settingsAny?.winner_book_url ? "configurado" : "opcional"}
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          CC:{" "}
                          <span className={settingsAny?.winner_cc_email ? "text-foreground font-medium" : "italic"}>
                            {settingsAny?.winner_cc_email || "não definido"}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {winnerSupplier && (() => {
                      const sup: any = winnerSupplier;
                      const mockup = settingsAny?.winner_mockup_url || "";
                      const book = settingsAny?.winner_book_url || "";
                      const ccEmail = settingsAny?.winner_cc_email || "";
                      const canShare = !!mockup;
                      const greetingName = sup.contact_name || sup.company_name;
                      const msgLabels = getMessageLabels(currencyCode);
                      const subject = `${campaignName} — ${msgLabels.winnerSubject}`;
                      const body =
`${msgLabels.inviteGreeting} ${greetingName},

${msgLabels.winnerIntro} ${campaignName} ${msgLabels.winnerIntroProduction}

🎨 ${msgLabels.winnerMockupTitle}:
${mockup}
${book ? `\n📘 ${msgLabels.winnerBookTitle}:\n${book}\n` : ""}
${msgLabels.winnerFooter}

${msgLabels.winnerRegards},
${agencyName}`;
                      const waMsg =
`${msgLabels.inviteGreeting} ${greetingName}! ${msgLabels.winnerWaIntro} *${campaignName}*:

🎨 ${msgLabels.winnerMockupTitle}:
${mockup}${book ? `\n\n📘 ${msgLabels.winnerBookTitle}:\n${book}` : ""}

${msgLabels.winnerWaFooter}
— ${agencyName}`;
                      const mailtoHref = `mailto:${sup.email}${ccEmail ? `?cc=${encodeURIComponent(ccEmail)}&` : "?"}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                      const phone = (sup.phone || "").replace(/\D/g, "");
                      const waHref = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(waMsg)}` : "";
                      return (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            disabled={!canShare}
                            title={canShare ? "Reenviar links por e-mail" : "Configure o link do mockup primeiro"}
                            onClick={() => {
                              if (!canShare) { toast.error("Configure o link do mockup antes de reenviar."); return; }
                              window.open(mailtoHref, "_blank");
                            }}
                          >
                            <Mail className="w-3 h-3" /> E-mail
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            disabled={!canShare || !phone}
                            title={!canShare ? "Configure o link do mockup primeiro" : (!phone ? "Vencedor sem telefone cadastrado" : "Reenviar links por WhatsApp")}
                            onClick={() => {
                              if (!canShare) { toast.error("Configure o link do mockup antes de reenviar."); return; }
                              if (!phone) { toast.error("Vencedor sem telefone cadastrado."); return; }
                              window.open(waHref, "_blank");
                            }}
                          >
                            <MessageCircle className="w-3 h-3" /> WhatsApp
                          </Button>
                        </>
                      );
                    })()}
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setWinnerLinksOpen(true)}>
                      <Pencil className="w-3 h-3" /> Editar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Exchange rate info row (shown only when currency is not BRL) */}
      {currencyCode !== "BRL" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground -mt-2">
          <span>
            Cotação: 1 {currencyCode} = {exchangeRate < 0.1 
              ? `R$ ${exchangeRate.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
              : fmtBRL(exchangeRate).replace("BRL ", "")}
            {rateData?.updatedAt ? ` · Atualizado às ${rateData.updatedAt}` : ""}
            {` · Fonte: ${(rateData as any)?.source || "AwesomeAPI"}`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={rateLoading}
            onClick={() => queryClient.invalidateQueries({ queryKey: ["exchange_rate", currencyCode] })}
          >
            <RefreshCw className={cn("w-3 h-3", rateLoading && "animate-spin")} />
          </Button>
        </div>
      )}

      {/* ═══ TIMELINE SECTION (collapsible, starts collapsed) ═══ */}
      <Card>
        <Collapsible open={timelineExpanded} onOpenChange={setTimelineExpanded}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-2 min-w-0">
                <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                <p className="text-sm font-semibold leading-tight">Cronograma da Campanha</p>
                {!timelineExpanded && (
                  <span className="text-[11px] text-muted-foreground italic ml-2 hidden sm:inline">
                    Datas e entregas acordadas com o fornecedor
                  </span>
                )}
              </div>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", timelineExpanded && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <BudgetTimelineSection campaignId={campaignId} hideHeader bare />
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {isPhaseLocked("cotacoes") && (
        <FrozenPhaseBanner
          frozenPhase="cotacoes"
          activePhase={currentPhase}
          lockedAt={(phaseLockedAt as Record<string, string>)["cotacoes"]}
          isAdminOrMaster={isAdminOrMaster}
          onUnlock={() => setUnlockTarget("cotacoes")}
          isUnlocking={isUnlocking}
        />
      )}

      {isPhaseLocked("negociacao") && (
        <FrozenPhaseBanner
          frozenPhase="negociacao"
          activePhase={currentPhase}
          lockedAt={(phaseLockedAt as Record<string, string>)["negociacao"]}
          isAdminOrMaster={isAdminOrMaster}
          onUnlock={() => setUnlockTarget("negociacao")}
          isUnlocking={isUnlocking}
        />
      )}

      {/* ═══ QTY REQUOTES LIST ═══ */}
      {qtyRequotes.length > 0 && (
        <div className="border rounded-lg p-4 bg-muted/20 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Recotações por Quantidade
          </div>
          {qtyRequotes.map((rq: any) => {
            const sup = suppliers.find((s) => s.id === rq.supplier_id);
            const piecesCount = Object.keys(rq.qty_changes ?? {}).length;
            const statusLabel =
              rq.status === "pending" ? "Aguardando" :
              rq.status === "submitted" ? "Respondida" :
              rq.status === "approved" ? "Aprovada" : "Recusada";
            const statusVariant: any =
              rq.status === "submitted" ? "default" :
              rq.status === "approved" ? "secondary" :
              rq.status === "rejected" ? "destructive" : "outline";
            return (
              <div key={rq.id} className="flex items-center justify-between text-sm border rounded p-2 bg-background gap-2 flex-wrap">
                <div>
                  <span className="font-medium">{sup?.company_name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {piecesCount} peças · criada {format(new Date(rq.created_at), "dd/MM HH:mm")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant}>{statusLabel}</Badge>
                  {rq.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/recotacao-qtd/${rq.access_token}`);
                          toast.success("Link copiado!");
                        }}
                      >
                        <Copy className="w-3 h-3" /> Copiar link
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                        title="Excluir recotação"
                        onClick={async () => {
                          if (!window.confirm("Excluir esta recotação não respondida? O link ficará inválido.")) return;
                          const { error } = await supabase
                            .from("budget_qty_requotes" as any)
                            .delete()
                            .eq("id", rq.id);
                          if (error) {
                            toast.error("Erro ao excluir: " + error.message);
                          } else {
                            toast.success("Recotação excluída");
                            queryClient.invalidateQueries({ queryKey: ["budget_qty_requotes", campaignId] });
                          }
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                  {rq.status === "submitted" && (
                    <Button size="sm" className="h-7 text-xs" onClick={() => setReviewingQtyRequote(rq)}>
                      Revisar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ SUPPLIERS SECTION ═══ */}
      <div className="space-y-3">

        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Fornecedores</h3>
          {(() => {
            const phaseAllowsAdd = currentPhase === "cotacoes" || isAdminOrMaster;
            const canAddSupplier = phaseAllowsAdd;
            return (
              <ResponsiveToolbar
                primaryActions={
                  canAddSupplier ? (
                    <Button size="sm" className="gap-1 min-h-[44px] md:min-h-0" onClick={() => setAddOpen(true)}>
                      <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Adicionar Fornecedor</span><span className="sm:hidden">Adicionar</span>
                    </Button>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button size="sm" className="gap-1 min-h-[44px] md:min-h-0" disabled>
                              <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Adicionar Fornecedor</span><span className="sm:hidden">Adicionar</span>
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Fase {PHASE_LABELS[currentPhase]} — apenas Admin ou Master podem adicionar fornecedores nesta fase
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                }

                secondaryActions={
                  <>
                    {(currentPhase === "cotacoes" || isAdminOrMaster) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 min-h-[44px] md:min-h-0 w-full md:w-auto justify-start md:justify-center"
                        onClick={() => setQtyRequoteOpen(true)}
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Recotação por Qtd.
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1 min-h-[44px] md:min-h-0 w-full md:w-auto justify-start md:justify-center" onClick={handleExportBudget} disabled={exportingBudget || suppliers.length === 0}>
                      <Download className="w-3.5 h-3.5" /> {exportingBudget ? "Exportando..." : "Exportar Excel"}
                    </Button>
                  </>
                }
              />
            );
          })()}
        </div>

        {suppliers.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum fornecedor cadastrado.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {suppliers.map((sup) => {
              const st = getDisplayStatus(sup, deadlineDate);
              const partial = supplierPartialTotals[sup.id];
              const isFrozen = !!winnerSupplier && (sup as any).winner_locked_total != null;
              const displayTotal = isFrozen
                ? Number((sup as any).winner_locked_total)
                : partial?.total ?? 0;
              const inProgress = partial && partial.pricedPieces > 0 && sup.status !== "enviado";
              return (
                <Card key={sup.id} className="relative">
                  <CardContent className="pt-4 pb-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{sup.company_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{sup.contact_name}</p>
                      </div>
                      <Badge className={cn("text-[10px] shrink-0", st.color)}>{st.label}</Badge>
                    </div>
                    {sup.status === 'declinado' && (
                      <div className="bg-amber-50 border border-amber-100 rounded p-2 mb-2">
                        <p className="text-[11px] font-semibold text-amber-900 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Optou por não participar
                        </p>
                        <p className="text-[10px] text-amber-800 mt-1 italic leading-tight">
                          Motivo: {(sup as any).decline_reason || "Não informou o motivo"}
                        </p>
                        {(sup as any).declined_at && (
                          <p className="text-[9px] text-amber-600 mt-1">
                            {format(new Date((sup as any).declined_at), "dd/MM/yyyy HH:mm")}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>{sup.email}</p>
                      <p>{sup.phone}</p>
                      {sup.submitted_at && (
                        <p className="text-emerald-600 dark:text-emerald-400">
                          Enviado em {format(new Date(sup.submitted_at), "dd/MM/yyyy HH:mm")}
                        </p>
                      )}
                      {sup.invited_at && (
                        <p className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Convidado em {format(new Date(sup.invited_at), "dd/MM/yyyy")}
                        </p>
                      )}
                      {sup.access_token && (
                        <div className="flex items-center gap-1 pt-1">
                          <Link2 className="w-3 h-3 shrink-0 text-muted-foreground" />
                          <button
                            type="button"
                            onClick={() => {
                              const url = `${PUBLIC_BASE_URL}/orcamento/${sup.access_token}`;
                              window.open(
                                url,
                                "_blank",
                                "noopener,noreferrer,popup=yes,width=1200,height=800"
                              );
                            }}
                            className="truncate text-[11px] text-primary hover:underline text-left flex-1 min-w-0"
                            title={`${PUBLIC_BASE_URL}/orcamento/${sup.access_token}`}
                          >
                            {`${PUBLIC_BASE_URL}/orcamento/${sup.access_token}`}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const url = `${PUBLIC_BASE_URL}/orcamento/${sup.access_token}`;
                              navigator.clipboard.writeText(url);
                              toast.success("Link copiado!");
                            }}
                            className="text-muted-foreground hover:text-foreground shrink-0"
                            title="Copiar link"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Resumo de preenchimento (visível mesmo em andamento) */}
                    {partial && partial.totalPiecesNeeded > 0 && (
                      <div className="rounded-md border border-border/60 bg-muted/30 p-2 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Preenchimento</span>
                          <span className="font-semibold text-foreground">
                            {partial.pricedPieces}/{partial.totalPiecesNeeded} ({partial.pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full transition-all", sup.status === "enviado" ? "bg-emerald-500" : "bg-primary")}
                            style={{ width: `${partial.pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-0.5">
                          <span className="text-muted-foreground">
                            {sup.status === "enviado" ? t("budgets.total") : inProgress ? "Parcial" : "Sem valores"}
                          </span>
                          <span className={cn(
                            "font-bold",
                            sup.status === "enviado" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                          )}>
                            {fmtCurrency(displayTotal)}
                            {isFrozen && (
                              <span className="text-xs text-muted-foreground ml-1" title="Valor congelado no momento da declaração do vencedor">🔒</span>
                            )}
                          </span>
                        </div>
                        {(partial.installation > 0 || partial.freight > 0) && (
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>Embalagem / Frete + Inst.</span>
                            <span>{fmtCurrency(partial.installation + partial.freight)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Actions */}
                    <div className="flex items-center gap-1 pt-1">
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => handleWhatsAppClick(sup)}
                        asChild
                      >
                        <a href={buildWhatsAppUrl(sup)} target="_blank" rel="noopener noreferrer" title="WhatsApp">
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        </a>
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        title="Enviar convite por e-mail"
                        onClick={() => {
                          window.location.href = buildEmailMailto(sup);
                          if (!sup.invited_at) {
                            updateSupplier.mutate({
                              id: sup.id,
                              campaign_id: campaignId,
                              updates: { invited_at: new Date().toISOString() },
                            });
                          }
                        }}
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDetailSupplier(sup.id)} title="Ver detalhes">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        title="Editar dados"
                        onClick={() => {
                          setEditSupplierDraft({
                            company_name: sup.company_name ?? "",
                            contact_name: sup.contact_name ?? "",
                            phone: sup.phone ?? "",
                            email: sup.email ?? "",
                          });
                          setEditSupplierId(sup.id);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        title="Baixar planilha preenchida"
                        disabled={downloadingSupplierId === sup.id}
                        onClick={() => handleDownloadSupplierSheet(sup)}
                      >
                        {downloadingSupplierId === sup.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                      </Button>
                      {isAdminOrMaster && sup.submitted_at && (
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0"
                          title="Histórico de valores"
                          onClick={() => setHistorySupplierId(sup.id)}
                        >
                          <History className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {isAdminOrMaster && sup.submitted_at && (() => {
                        const canDeclareWinner = currentPhase === "cotacoes" || isAdminOrMaster;
                        const btn = (
                          <Button
                            size="sm" variant="ghost" className="h-7 w-7 p-0"
                            title="Declarar vencedor do certame"
                            onClick={() => setWinnerSupplierId(sup.id)}
                            disabled={!canDeclareWinner}
                          >
                            <Trophy className="w-3.5 h-3.5 text-amber-500" />
                          </Button>
                        );
                        if (canDeclareWinner) return btn;
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild><span>{btn}</span></TooltipTrigger>
                              <TooltipContent>Disponível apenas na fase Cotações</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })()}
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0 ml-auto text-destructive hover:text-destructive"
                        title="Excluir fornecedor"
                        onClick={() => setDeleteId(sup.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Lock toggle: visible to admin/master always */}
                    {isAdminOrMaster && (
                      <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-border/60">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {sup.status === "declinado" ? (
                            <RotateCcw className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          ) : sup.locked ? (
                            <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          )}
                          <span className="text-[11px] text-muted-foreground truncate">
                            {sup.status === "declinado"
                              ? "Desistiu — reabrir participação"
                              : (sup.locked ? "Travado para edição" : "Liberado para revisão")}
                          </span>
                        </div>
                        <Switch
                          checked={sup.status === "declinado" ? false : !sup.locked}
                          disabled={reopeningSupplierId === sup.id}
                          onCheckedChange={() => handleToggleSupplierLock(sup)}
                          aria-label={sup.status === "declinado" ? "Reabrir participação do fornecedor" : (sup.locked ? "Liberar planilha para revisão" : "Travar planilha novamente")}
                        />
                      </div>
                    )}

                    {/* Winner toggle: admin/master, visible only after submission */}
                    {isAdminOrMaster && sup.submitted_at && (
                      <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-border/60">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Trophy className={cn("w-3.5 h-3.5 shrink-0", (sup as any).is_winner ? "text-amber-500" : "text-muted-foreground")} />
                          <span className="text-[11px] text-muted-foreground truncate">
                            {(sup as any).is_winner ? "Empresa vencedora" : "Declarar vencedora"}
                          </span>
                        </div>
                        <Switch
                          checked={!!(sup as any).is_winner}
                          onCheckedChange={(checked) => handleToggleWinner(sup, checked)}
                          aria-label={(sup as any).is_winner ? "Desmarcar vencedora" : "Declarar vencedora do certame"}
                        />
                      </div>
                    )}

                    {/* Negotiation: only for declared winner */}
                    {isAdminOrMaster && (sup as any).is_winner && (
                      <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-border/60">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <TrendingDown className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-[11px] text-muted-foreground truncate">
                            {(() => {
                              const ns = (sup as any).negotiation_status;
                              if (!ns) return "Negociação";
                              if (ns === "pending") return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px]">Negociação Pendente</Badge>;
                              if (ns === "submitted") return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[10px]">Proposta Enviada</Badge>;
                              if (ns === "approved") return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px]">Negociação Aprovada</Badge>;
                              return ns;
                            })()}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant={(sup as any).negotiation_status ? "outline" : "default"}
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => setNegotiationSupplierId(sup.id)}
                        >
                          <TrendingDown className="w-3 h-3" />
                          {(sup as any).negotiation_status === "submitted" ? "Ver proposta" :
                           (sup as any).negotiation_status ? "Gerenciar" : "Iniciar Negociação"}
                        </Button>
                      </div>
                    )}

                    {/* ─── Recotação por Quantidade para este fornecedor ─── */}
                    {(() => {
                      const supRequotes = (qtyRequotes as any[]).filter((r) => r.supplier_id === sup.id);
                      if (supRequotes.length === 0) return null;
                      const rq = supRequotes[0]; // most recent (query is desc)
                      const statusMeta: Record<string, { label: string; cls: string }> = {
                        pending: { label: "Recotação — Aguardando", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
                        submitted: { label: "Recotação — Respondida", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
                        approved: { label: "Recotação — Aprovada", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
                        rejected: { label: "Recotação — Recusada", cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
                      };
                      const meta = statusMeta[rq.status] ?? { label: rq.status, cls: "" };
                      const piecesCount = Object.keys(rq.qty_changes ?? {}).length;
                      const canDownload = rq.status === "submitted" || rq.status === "approved";
                      return (
                        <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-border/60 flex-wrap">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <RefreshCw className="w-3.5 h-3.5 text-primary shrink-0" />
                            <Badge className={cn("text-[10px]", meta.cls)}>{meta.label}</Badge>
                            <span className="text-[11px] text-muted-foreground truncate">
                              {piecesCount} peça{piecesCount === 1 ? "" : "s"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {rq.status === "pending" && (
                              <Button
                                size="sm" variant="ghost" className="h-7 text-[11px] gap-1"
                                onClick={() => {
                                  navigator.clipboard.writeText(`${window.location.origin}/recotacao-qtd/${rq.access_token}`);
                                  toast.success("Link copiado!");
                                }}
                                title="Copiar link público da recotação"
                              >
                                <Copy className="w-3 h-3" /> Copiar link
                              </Button>
                            )}
                            {rq.status === "submitted" && (
                              <Button
                                size="sm" className="h-7 text-[11px]"
                                onClick={() => setReviewingQtyRequote(rq)}
                              >
                                Revisar
                              </Button>
                            )}
                            {canDownload && (
                              <Button
                                size="sm" variant="ghost" className="h-7 w-7 p-0"
                                title="Baixar planilha da recotação"
                                disabled={downloadingRequoteId === rq.id}
                                onClick={() => handleDownloadRequoteSheet(sup, rq)}
                              >
                                {downloadingRequoteId === rq.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ═══ COMPARATIVO DE FORNECEDORES (mesmo em preenchimento) ═══ */}
        {suppliers.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Comparativo lado a lado</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Acompanhe o preenchimento parcial de todos os fornecedores em tempo real.
                  </p>
                </div>
                {bestSupplier && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">
                    Melhor proposta enviada: {bestSupplier.name}
                  </Badge>
                )}
              </div>
              <div className="overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Fornecedor</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-center">Preenchimento</TableHead>
                      <TableHead className="text-xs text-right">Produção</TableHead>
                      <TableHead className="text-xs text-right">Frete</TableHead>
                      <TableHead className="text-xs text-right">Instalação</TableHead>
                      <TableHead className="text-xs text-right">Total Geral</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((sup) => {
                      const st = getDisplayStatus(sup, deadlineDate);
                      const p = supplierPartialTotals[sup.id];
                      if (!p) return null;
                      const piecesTotal = p.total - p.installation - p.freight;
                      const isBest = bestSupplier?.id === sup.id;
                      return (
                        <TableRow key={sup.id} className={cn(isBest && "bg-emerald-50/60 dark:bg-emerald-900/10")}>
                          <TableCell className="font-medium text-foreground">
                            <button onClick={() => setDetailSupplier(sup.id)} className="hover:underline text-left">
                              {sup.company_name}
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-[10px]", st.color)}>{st.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-center gap-1 min-w-[100px]">
                              <span className="text-[11px] font-medium">{p.pricedPieces}/{p.totalPiecesNeeded} · {p.pct}%</span>
                              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                  className={cn("h-full", sup.status === "enviado" ? "bg-emerald-500" : "bg-primary")}
                                  style={{ width: `${p.pct}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {piecesTotal > 0 ? fmtCurrency(piecesTotal) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.freight > 0 ? fmtCurrency(p.freight) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.installation > 0 ? fmtCurrency(p.installation) : "—"}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right tabular-nums font-semibold",
                            isBest && "text-emerald-600 dark:text-emerald-400"
                          )}>
                            {(() => {
                              const frozen = !!winnerSupplier && (sup as any).winner_locked_total != null;
                              const compTotal = frozen ? Number((sup as any).winner_locked_total) : p.total;
                              return compTotal > 0 ? (
                                <>
                                  {fmtCurrency(compTotal)}
                                  {frozen && (
                                    <span className="text-xs text-muted-foreground ml-1" title="Valor congelado">🔒</span>
                                  )}
                                </>
                              ) : "—";
                            })()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══ ADD SUPPLIER DIALOG ═══ */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setAgencySupplierSearch(""); setSelectedAgencySupplierIds([]); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Fornecedor</DialogTitle>
            <DialogDescription>Selecione um ou mais fornecedores do cadastro da agência.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Selecionar do cadastro da agência</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1 text-primary"
                onClick={() => setSupplierFormOpen(true)}
              >
                <Plus className="w-3 h-3" /> Cadastrar Novo
              </Button>
            </div>

            <Input
              placeholder="Buscar por empresa ou e-mail..."
              value={agencySupplierSearch}
              onChange={(e) => setAgencySupplierSearch(e.target.value)}
              className="h-8 text-xs"
            />

            <div className="max-h-72 overflow-y-auto border border-border rounded-md divide-y divide-border">
              {agencySuppliers.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  Nenhum fornecedor cadastrado na agência.
                </div>
              ) : (
                agencySuppliers
                  .filter((s) => {
                    const q = agencySupplierSearch.trim().toLowerCase();
                    if (!q) return true;
                    const email = (s.contacts?.[0]?.email || s.email || "").toLowerCase();
                    return s.company_name.toLowerCase().includes(q) || email.includes(q);
                  })
                  .map((s) => {
                    const email = s.contacts?.[0]?.email || s.email || "";
                    const checked = selectedAgencySupplierIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setSelectedAgencySupplierIds((prev) =>
                              e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                            )
                          }
                          className="h-4 w-4"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{s.company_name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {email || <span className="italic">sem e-mail</span>}
                          </p>
                        </div>
                      </label>
                    );
                  })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button
              disabled={addSupplier.isPending || selectedAgencySupplierIds.length === 0}
              onClick={async () => {
                const existingEmails = new Set(
                  (suppliers || [])
                    .map((sup: any) => (sup.email || "").trim().toLowerCase())
                    .filter(Boolean)
                );
                const chosen = agencySuppliers.filter((s) => selectedAgencySupplierIds.includes(s.id));
                const missingEmail: string[] = [];
                const duplicates: string[] = [];
                const toAdd: { company_name: string; contact_name: string; phone: string; email: string }[] = [];

                for (const s of chosen) {
                  const email = (s.contacts?.[0]?.email || s.email || "").trim();
                  if (!email) {
                    missingEmail.push(s.company_name);
                    continue;
                  }
                  if (existingEmails.has(email.toLowerCase())) {
                    duplicates.push(s.company_name);
                    continue;
                  }
                  toAdd.push({
                    company_name: s.company_name,
                    contact_name: (s.contacts?.[0]?.nome || s.contact_name || ""),
                    phone: (s.contacts?.[0]?.telefone || s.phone || ""),
                    email,
                  });
                  existingEmails.add(email.toLowerCase());
                }

                if (missingEmail.length > 0) {
                  toast.warning(`Sem e-mail (ignorados): ${missingEmail.join(", ")}`);
                }
                if (duplicates.length > 0) {
                  toast.warning(`Já participam (ignorados): ${duplicates.join(", ")}`);
                }
                if (toAdd.length === 0) {
                  if (missingEmail.length === 0 && duplicates.length === 0) {
                    toast.error("Selecione ao menos um fornecedor.");
                  }
                  return;
                }

                let added = 0;
                for (const payload of toAdd) {
                  try {
                    await addSupplier.mutateAsync({ campaign_id: campaignId, ...payload });
                    added++;
                  } catch (e: any) {
                    toast.error(`Erro ao adicionar ${payload.company_name}: ${e?.message || ""}`);
                  }
                }
                if (added > 0) toast.success(`${added} fornecedor(es) adicionado(s)!`);
                setSelectedAgencySupplierIds([]);
                setAgencySupplierSearch("");
                setAddOpen(false);
              }}
            >
              {addSupplier.isPending ? "Salvando..." : `Adicionar selecionados (${selectedAgencySupplierIds.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SupplierFormDialog
        open={supplierFormOpen}
        onOpenChange={setSupplierFormOpen}
        agencyId={agencyId}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["agency_suppliers", agencyId] });
        }}
      />



      {/* ═══ EDIT SUPPLIER DIALOG ═══ */}
      <Dialog open={!!editSupplierId} onOpenChange={(o) => !o && setEditSupplierId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar fornecedor</DialogTitle>
            <DialogDescription>Atualize os dados de contato do fornecedor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Empresa</Label>
              <Input
                value={editSupplierDraft.company_name}
                onChange={(e) => setEditSupplierDraft((d) => ({ ...d, company_name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Contato</Label>
              <Input
                value={editSupplierDraft.contact_name}
                onChange={(e) => setEditSupplierDraft((d) => ({ ...d, contact_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input
                  value={editSupplierDraft.phone}
                  onChange={(e) => setEditSupplierDraft((d) => ({ ...d, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email"
                  value={editSupplierDraft.email}
                  onChange={(e) => setEditSupplierDraft((d) => ({ ...d, email: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSupplierId(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!editSupplierId) return;
                if (!editSupplierDraft.company_name.trim() || !editSupplierDraft.email.trim()) {
                  toast.error("Empresa e e-mail são obrigatórios.");
                  return;
                }
                updateSupplier.mutate(
                  {
                    id: editSupplierId,
                    campaign_id: campaignId,
                    updates: {
                      company_name: editSupplierDraft.company_name.trim(),
                      contact_name: editSupplierDraft.contact_name.trim(),
                      phone: editSupplierDraft.phone.trim(),
                      email: editSupplierDraft.email.trim(),
                    },
                  },
                  {
                    onSuccess: () => {
                      toast.success("Fornecedor atualizado.");
                      setEditSupplierId(null);
                    },
                    onError: (e: any) => toast.error("Erro: " + (e?.message || "")),
                  }
                );
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ DELETE CONFIRMATION ═══ */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os preços e dados enviados por este fornecedor serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) {
                  deleteSupplier.mutate(
                    { id: deleteId, campaign_id: campaignId },
                    { onSuccess: () => { toast.success("Fornecedor removido."); setDeleteId(null); } }
                  );
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ CURRENCY LOCK CONFIRMATION ═══ */}
      <AlertDialog open={showLockConfirm} onOpenChange={setShowLockConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar moeda da campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Após confirmar, a moeda não poderá ser alterada. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                saveSettings.mutate(
                  {
                    campaign_id: campaignId,
                    budget_amount: budgetAmount,
                    deadline: settings?.deadline ?? null,
                    currency_code: selectedCurrency,
                    currency_locked: true,
                  },
                  {
                    onSuccess: () => {
                      toast.success("Moeda confirmada e bloqueada.");
                      setShowLockConfirm(false);
                    },
                    onError: () => toast.error("Erro ao confirmar moeda."),
                  }
                );
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ SUPPLIER DETAIL SHEET ═══ */}
      <Sheet open={!!detailSupplier} onOpenChange={(o) => { if (!o) { setDetailSupplier(null); setShowOnlyMissing(false); } }}>
        <SheetContent className="w-full sm:max-w-[min(96vw,1100px)] overflow-y-auto max-h-screen">
          {(() => {
            const labels = getSupplierLabels(currencyCode);
            const missingCount = detailSupplier && supplierPartialTotals[detailSupplier] 
              ? supplierPartialTotals[detailSupplier].totalPiecesNeeded - supplierPartialTotals[detailSupplier].pricedPieces
              : 0;

            return (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    {detailSup?.company_name}
                    {detailSup?.locked && <Lock className="w-4 h-4 text-muted-foreground" />}
                    {detailSup?.locked && isAdminOrMaster && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">Edição administrativa</Badge>
                    )}
                    {detailSup?.status === "enviado" && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">Enviado</Badge>}
                  </SheetTitle>
                  <SheetDescription>
                    {detailSup?.contact_name} · {detailSup?.email} · {detailSup?.phone}
                  </SheetDescription>
                </SheetHeader>

                {/* Resumo de preenchimento (sempre visível, mesmo em andamento) */}
                {detailSupplier && supplierPartialTotals[detailSupplier] && (
                  <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">{labels.fillTitle}</span>
                      <span className="font-semibold text-foreground">
                        {supplierPartialTotals[detailSupplier].pricedPieces}/{supplierPartialTotals[detailSupplier].totalPiecesNeeded} peças
                        ({supplierPartialTotals[detailSupplier].pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full transition-all", detailSup?.status === "enviado" ? "bg-emerald-500" : "bg-primary")}
                        style={{ width: `${supplierPartialTotals[detailSupplier].pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted-foreground">
                        {detailSup?.status === "enviado" ? "Total final" : labels.partialTotal}
                      </span>
                      <span className={cn(
                        "text-base font-bold",
                        detailSup?.status === "enviado" ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
                      )}>
                        {fmtCurrency(supplierPartialTotals[detailSupplier].total)}
                      </span>
                    </div>
                    <div className="flex justify-end pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={showOnlyMissing ? "default" : "outline"}
                        onClick={() => setShowOnlyMissing((v) => !v)}
                        disabled={missingCount <= 0 && !showOnlyMissing}
                        className="h-7 text-xs gap-1.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        {showOnlyMissing ? "Mostrar todas" : `${labels.onlyWithoutPrice} (${missingCount})`}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="mt-6 space-y-4">
                  {/* Pieces table */}
                  <div className="border rounded-md overflow-x-auto">
                    <Table className="w-full min-w-[560px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">{labels.columnItem}</TableHead>
                          <TableHead className="text-xs text-right">Frete + Inst.</TableHead>
                          <TableHead className="text-xs text-right">Frete Apenas</TableHead>
                          <TableHead className="text-xs text-right">Sem Log.</TableHead>
                          <TableHead className="text-xs text-right w-20">{labels.columnQty}</TableHead>
                          <TableHead className="text-xs text-right w-28">{labels.columnUnitPrice}</TableHead>
                          <TableHead className="text-xs text-right w-28">{labels.columnTotal}</TableHead>
                        </TableRow>
                      </TableHeader>
                <TableBody>
                  {(() => {
                    const codeKey = (c: any) => {
                      const n = Number(c);
                      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
                    };
                    type Merged =
                      | { kind: "piece"; code: any; data: typeof pieces[number] }
                      | { kind: "kit"; code: any; data: typeof kits[number] };
                    const merged: Merged[] = [
                      ...pieces.filter((p) => !p.kit_only).map((p) => ({ kind: "piece" as const, code: p.code, data: p })),
                      ...kits.map((k) => ({ kind: "kit" as const, code: k.code, data: k })),
                    ];
                    merged.sort((a, b) => {
                      const diff = codeKey(a.code) - codeKey(b.code);
                      if (diff !== 0) return diff;
                      return String(a.code ?? "").localeCompare(String(b.code ?? ""));
                    });
                    return merged.map((item) => {
                      if (item.kind === "piece") {
                        const piece = item.data;
                        if (showOnlyMissing) {
                          const pr0 = detailPrices.find((pr) => pr.piece_id === piece.id);
                          const up0 = pr0 ? Number(pr0.unit_price) || 0 : 0;
                          if (pr0 && up0 > 0) return null;
                        }
                        const qty = pieceTotals[piece.id] || 0;
                        const priceRow = detailPrices.find((pr) => pr.piece_id === piece.id);
                        const unitPrice = priceRow ? Number(priceRow.unit_price) || 0 : 0;
                        const lineTotal = unitPrice * qty;
                        const sug = suggestionsMap[piece.id];
                        const isSugExpanded = expandedSuggestionPieceId === piece.id;
                        return (
                          <React.Fragment key={`piece-${piece.id}`}>
                            <TableRow>
                              <TableCell className="text-xs font-medium">
                                {piece.code} - {piece.name}
                                {sug && sug.orcado_por === "sugerida" ? (
                                  <>
                                    <div className="text-amber-700 text-xs break-words whitespace-normal mt-0.5">
                                      {sug.suggested_spec}
                                      <span className="text-amber-500 italic ml-1">(especificação modificada pelo fornecedor)</span>
                                    </div>
                                    {piece.specification && (
                                      <div className="text-muted-foreground text-[10px] break-words whitespace-normal mt-0.5 line-through">{piece.specification}</div>
                                    )}
                                  </>
                                ) : (
                                  piece.specification && <div className="text-muted-foreground text-xs break-words whitespace-normal mt-0.5">{piece.specification}</div>
                                )}
                                {sug && (
                                  <button onClick={() => setExpandedSuggestionPieceId(isSugExpanded ? null : piece.id)} className="ml-1 inline-flex items-center">
                                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] cursor-pointer gap-0.5">
                                      Sugestão {isSugExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                                    </Badge>
                                  </button>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono">{pieceTotalsFull.installationMap[piece.id] || 0}</TableCell>
                              <TableCell className="text-xs text-right font-mono">{pieceTotalsFull.freightMap[piece.id] || 0}</TableCell>
                              <TableCell className="text-xs text-right font-mono text-muted-foreground">{pieceTotalsFull.noLogisticsMap[piece.id] || 0}</TableCell>
                              <TableCell className="text-xs text-right font-bold">{qty}</TableCell>
                              <TableCell className="text-xs text-right">
                                {isAdminOrMaster ? (
                                  <AdminInlineNumberInput
                                    initial={priceRow ? Number(priceRow.unit_price) : null}
                                    onSave={(v) => upsertAdminPrice(piece.id, v)}
                                    ariaLabel={`Preço unitário ${piece.code}`}
                                  />
                                ) : (
                                  priceRow ? fmtCurrency(unitPrice) : "—"
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-right">{priceRow ? fmtCurrency(lineTotal) : "—"}</TableCell>
                            </TableRow>
                            {sug && isSugExpanded && (
                              <TableRow className="bg-amber-50/80">
                                <TableCell colSpan={4} className="text-xs p-3">
                                  <p className="text-amber-800 font-medium mb-1">Sugestão do fornecedor:</p>
                                  <p className="text-amber-700 italic">"{sug.suggested_spec}"</p>
                                  <Badge className={cn("mt-1 text-[9px]", sug.orcado_por === "sugerida" ? "bg-amber-200 text-amber-800" : "bg-muted text-muted-foreground")}>
                                    Orçou pela: {sug.orcado_por === "sugerida" ? "Minha sugestão" : "Especificação original"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      }
                      const kit = item.data;
                      const kpList = kitPieces.filter((kp) => kp.kit_id === kit.id);
                      if (kpList.length === 0) return null;
                      const kitQty = Math.min(...kpList.map((kp) => Math.floor((pieceTotals[kp.piece_id] || 0) / (kp.quantity || 1))));
                      let kitTotal = 0;
                      const pieceRows = kpList.map((kp) => {
                        const piece = pieces.find((p) => p.id === kp.piece_id) || (null as any);
                        const priceRow = detailPrices.find((pr) => pr.piece_id === kp.piece_id);
                        const unitPrice = priceRow ? Number(priceRow.unit_price) || 0 : 0;
                        const qty = kitQty * kp.quantity;
                        const lineTotal = unitPrice * qty;
                        kitTotal += lineTotal;
                        return { kp, piece, priceRow, unitPrice, qty, lineTotal };
                      });
                      const kitUnitTotal = pieceRows.reduce((sum, r) => sum + r.unitPrice, 0);
                      const visibleRows = showOnlyMissing
                        ? pieceRows.filter((r) => !r.priceRow || r.unitPrice <= 0)
                        : pieceRows;
                      if (showOnlyMissing && visibleRows.length === 0) return null;
                      return (
                        <React.Fragment key={`kit-${kit.id}`}>
                          <TableRow className="bg-muted/40 border-t-2">
                            <TableCell colSpan={5} className="text-xs font-semibold">
                              🧩 Kit {kit.code} - {kit.name} <span className="font-normal text-muted-foreground">(Qtd kit: {kitQty})</span>
                            </TableCell>
                            <TableCell className="text-xs text-right font-semibold">
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">Unit. por kit</div>
                              <div>{fmtCurrency(kitUnitTotal)}</div>
                            </TableCell>
                            <TableCell className="text-xs text-right font-semibold">{fmtCurrency(kitTotal)}</TableCell>
                          </TableRow>
                          {visibleRows.map(({ kp, piece, priceRow, unitPrice, qty, lineTotal }) => {
                            const sug = piece ? suggestionsMap[piece.id] : null;
                            const isSugExpanded = expandedSuggestionPieceId === kp.piece_id;
                            return (
                              <React.Fragment key={kp.id}>
                                <TableRow className="bg-muted/10">
                                  <TableCell className="text-xs pl-6">
                                    {piece ? `${piece.code} - ${piece.name}` : kp.piece_id}
                                    {piece && sug && sug.orcado_por === "sugerida" ? (
                                      <>
                                        <div className="text-amber-700 text-xs break-words whitespace-normal mt-0.5">
                                          {sug.suggested_spec}
                                          <span className="text-amber-500 italic ml-1">(especificação modificada pelo fornecedor)</span>
                                        </div>
                                        {piece.specification && (
                                          <div className="text-muted-foreground text-[10px] break-words whitespace-normal mt-0.5 line-through">{piece.specification}</div>
                                        )}
                                      </>
                                    ) : (
                                      piece?.specification && <div className="text-muted-foreground text-xs break-words whitespace-normal mt-0.5">{piece.specification}</div>
                                    )}
                                    {sug && (
                                      <button onClick={() => setExpandedSuggestionPieceId(isSugExpanded ? null : kp.piece_id)} className="ml-1 inline-flex items-center">
                                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] cursor-pointer gap-0.5">
                                          Sugestão {isSugExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                                        </Badge>
                                      </button>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs text-right font-mono">{pieceTotalsFull.installationMap[kp.piece_id] || 0}</TableCell>
                                  <TableCell className="text-xs text-right font-mono">{pieceTotalsFull.freightMap[kp.piece_id] || 0}</TableCell>
                                  <TableCell className="text-xs text-right font-mono text-muted-foreground">{pieceTotalsFull.noLogisticsMap[kp.piece_id] || 0}</TableCell>
                                  <TableCell className="text-xs text-right font-bold">{qty}</TableCell>
                                  <TableCell className="text-xs text-right">
                                    {isAdminOrMaster ? (
                                      <AdminInlineNumberInput
                                        initial={priceRow ? Number(priceRow.unit_price) : null}
                                        onSave={(v) => upsertAdminPrice(kp.piece_id, v)}
                                        ariaLabel={`Preço unitário ${piece?.code ?? kp.piece_id}`}
                                      />
                                    ) : (
                                      priceRow ? fmtCurrency(unitPrice) : "—"
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs text-right">{priceRow ? fmtCurrency(lineTotal) : "—"}</TableCell>
                                </TableRow>
                                {sug && isSugExpanded && (
                                  <TableRow className="bg-amber-50/80">
                                    <TableCell colSpan={4} className="text-xs p-3">
                                      <p className="text-amber-800 font-medium mb-1">Sugestão do fornecedor:</p>
                                      <p className="text-amber-700 italic">"{sug.suggested_spec}"</p>
                                      <Badge className={cn("mt-1 text-[9px]", sug.orcado_por === "sugerida" ? "bg-amber-200 text-amber-800" : "bg-muted text-muted-foreground")}>
                                        Orçou pela: {sug.orcado_por === "sugerida" ? "Minha sugestão" : "Especificação original"}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </React.Fragment>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>

            {/* Extra costs */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="pt-3 pb-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Instalação</p>
                  {isAdminOrMaster ? (
                    <AdminInlineNumberInput
                      initial={detailCosts?.installation_value != null ? Number(detailCosts.installation_value) : null}
                      onSave={(v) => upsertAdminExtra("installation_value", v)}
                      ariaLabel="Valor de instalação"
                      className="justify-start"
                    />
                  ) : (
                    <p className="text-sm font-semibold">{fmtCurrency(Number(detailCosts?.installation_value) || 0)}</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-3 pb-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Embalagem / Frete</p>
                  {isAdminOrMaster ? (
                    <AdminInlineNumberInput
                      initial={detailCosts?.freight_value != null ? Number(detailCosts.freight_value) : null}
                      onSave={(v) => upsertAdminExtra("freight_value", v)}
                      ariaLabel="Valor de embalagem / frete"
                      className="justify-start"
                    />
                  ) : (
                    <p className="text-sm font-semibold">{fmtCurrency(Number(detailCosts?.freight_value) || 0)}</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Grand Total */}
            <Card className="border-primary/30">
              <CardContent className="pt-3 pb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Total Geral</p>
                <p className="text-xl font-bold text-primary">{fmtCurrency(detailGrandTotal)}</p>
              </CardContent>
            </Card>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Send budget results to client */}
      <BudgetSendClientDialog
        open={clientSendDialogOpen}
        onOpenChange={(o) => {
          setClientSendDialogOpen(o);
          if (!o) {
            queryClient.invalidateQueries({ queryKey: ["last_resultado_cotacao_enviado", campaignId] });
          }
        }}
        campaignId={campaignId}
        campaignName={campaignName}
        agencyName={agencyName}
        clientId={clientId}
        clientName={clientName}
        clientEmail={clientEmail}
        suppliers={suppliers}
        supplierPartialTotals={supplierPartialTotals}
        bestSupplier={bestSupplier}
        budgetAmount={budgetAmount}
        pieces={pieces}
        kits={kits}
        kitPieces={kitPieces}
        qtyMap={qtyMap}
        stores={stores}
        pieceTotals={pieceTotalsFull}
        prices={prices}
        extraCosts={extraCosts}
        currencyCode={currencyCode}
        deadline={settings?.deadline ?? null}
      />

      {/* Histórico de valores do fornecedor (Admin/Master) */}
      <BudgetSupplierHistorySheet
        open={!!historySupplierId}
        onOpenChange={(o) => !o && setHistorySupplierId(null)}
        supplierId={historySupplierId}
        supplierName={suppliers.find((s) => s.id === historySupplierId)?.company_name}
        currencyCode={currencyCode}
        pieces={pieces}
        kits={kits}
      />

      {/* Declarar vencedor (Admin/Master) */}
      <BudgetWinnerDialog
        open={!!winnerSupplierId}
        onOpenChange={(o) => !o && setWinnerSupplierId(null)}
        campaignId={campaignId}
        campaignName={campaignName}
        agencyName={agencyName}
        supplier={(() => {
          const s = suppliers.find((x) => x.id === winnerSupplierId);
          return s ? { id: s.id, company_name: s.company_name, contact_name: s.contact_name, email: s.email } : null;
        })()}
        defaultMockupUrl={settingsAny?.winner_mockup_url ?? ""}
        defaultBookUrl={settingsAny?.winner_book_url ?? ""}
        defaultCcEmail={settingsAny?.winner_cc_email ?? ""}
      />

      {/* Negociação pós-cotação (Admin/Master) */}
      {negotiationSupplierId && (() => {
        const sup = suppliers.find((x) => x.id === negotiationSupplierId) as any;
        if (!sup) return null;
        const portalBase = typeof window !== "undefined" ? window.location.origin : "";
        return (
          <BudgetNegotiationDialog
            open
            onOpenChange={(o) => !o && setNegotiationSupplierId(null)}
            supplier={sup}
            campaignId={campaignId}
            campaignName={campaignName}
            pieces={pieces}
            prices={prices as any}
            extraCosts={extraCosts as any}
            pieceTotals={pieceTotalsFull}
            kitPieceTotals={kitPieceTotals}
            settings={settings}
            currencyCode={currencyCode}
            fmtCurrency={fmtCurrency}
            publicPortalUrl={`${portalBase}/supplier/${sup.access_token}`}
            frozenTotal={sup?.winner_locked_total != null ? Number(sup.winner_locked_total) : null}
            onNavigateToRateio={onNavigateToRateio}
          />
        );
      })()}

      <Dialog open={winnerLinksOpen} onOpenChange={(o) => !savingWinnerLinks && setWinnerLinksOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Links do Vencedor
            </DialogTitle>
            <DialogDescription>
              Estes valores serão pré-preenchidos no e-mail enviado ao fornecedor vencedor. Você ainda poderá ajustá-los no momento do envio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cfg-mockup">Link das peças fechadas do mockup</Label>
              <Input
                id="cfg-mockup"
                type="url"
                placeholder="https://drive.google.com/..."
                value={winnerMockupUrlDraft}
                onChange={(e) => setWinnerMockupUrlDraft(e.target.value)}
                disabled={savingWinnerLinks}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cfg-book">Link do book de mockup (opcional)</Label>
              <Input
                id="cfg-book"
                type="url"
                placeholder="https://drive.google.com/..."
                value={winnerBookUrlDraft}
                onChange={(e) => setWinnerBookUrlDraft(e.target.value)}
                disabled={savingWinnerLinks}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cfg-cc">E-mail de cópia (CC) padrão (opcional)</Label>
              <Input
                id="cfg-cc"
                type="email"
                placeholder="copia@empresa.com"
                value={winnerCcEmailDraft}
                onChange={(e) => setWinnerCcEmailDraft(e.target.value)}
                disabled={savingWinnerLinks}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setWinnerLinksOpen(false)} disabled={savingWinnerLinks}>
              Cancelar
            </Button>
            <Button onClick={handleSaveWinnerLinks} disabled={savingWinnerLinks}>
              {savingWinnerLinks ? (<><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Salvando...</>) : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {winnerSupplier && (
        <BudgetSendNegotiatedDialog
          open={sendNegotiatedOpen}
          onOpenChange={setSendNegotiatedOpen}
          campaignId={campaignId}
          campaignName={campaignName}
          agencyName={agencyName}
          clientName={(clientName as any) || ""}
          currencyCode={currencyCode}
          supplier={{
            id: (winnerSupplier as any).id,
            company_name: (winnerSupplier as any).company_name,
            contact_name: (winnerSupplier as any).contact_name,
            email: (winnerSupplier as any).email ?? null,
            phone: (winnerSupplier as any).phone ?? null,
          }}
          pieces={pieces}
          kits={kits}
          kitPieces={kitPieces as any}
          stores={stores as any}
          defaultCcEmail={settingsAny?.winner_cc_email ?? null}
        />
      )}

      {(currentPhase === "ajuste" || currentPhase === "negociacao") && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">
                Fase 4 — Ajuste pós-mockup
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {currentPhase === "ajuste"
                  ? "Fase ativa — ajustes sendo aplicados"
                  : "Disponível após aprovação da negociação"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigateToSection?.("adjustments")}
              className="gap-2 shrink-0"
            >
              <FileEdit className="w-3.5 h-3.5" />
              Abrir Ajustes
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          {currentPhase === "ajuste" && (
            <AdjustmentSummaryCard campaignId={campaignId} onNavigateToSection={onNavigateToSection} />
          )}
        </div>
      )}

      <UnlockPhaseDialog
        open={unlockTarget !== null}
        onOpenChange={(v) => !v && setUnlockTarget(null)}
        phaseToUnlock={unlockTarget}
        onConfirm={() => {
          if (unlockTarget) {
            unlockPhase(unlockTarget);
            setUnlockTarget(null);
          }
        }}
        isUnlocking={isUnlocking}
      />

      {/* Send qty requote */}
      <SendQtyRequoteDialog
        open={qtyRequoteOpen}
        onOpenChange={(o) => {
          setQtyRequoteOpen(o);
          if (!o) queryClient.invalidateQueries({ queryKey: ["budget_qty_requotes", campaignId] });
        }}
        campaignId={campaignId}
        campaignName={campaignName}
        pieces={pieces}
      />

      {/* Review qty requote */}
      <Dialog
        open={!!reviewingQtyRequote}
        onOpenChange={(o) => { if (!o) { setReviewingQtyRequote(null); setQtyRejectNotes(""); setQtyExcludedKeys(new Set()); } }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Revisar Recotação por Quantidade</DialogTitle>
            <DialogDescription>
              {(() => {
                const sup = suppliers.find((s) => s.id === reviewingQtyRequote?.supplier_id);
                return sup?.company_name ?? "—";
              })()}
            </DialogDescription>
          </DialogHeader>

          {reviewingQtyRequote && (() => {
            const submitted = (reviewingQtyRequote.submitted_prices ?? {}) as Record<string, number>;
            const qtyChanges = (reviewingQtyRequote.qty_changes ?? {}) as Record<string, { old_qty: number; new_qty: number }>;
            const previousPrices: Record<string, number> = {};
            (prices as any[]).forEach((p: any) => {
              if (p.supplier_id === reviewingQtyRequote.supplier_id && p.piece_id) {
                previousPrices[p.piece_id] = Number(p.adjusted_unit_price ?? p.unit_price ?? 0);
              }
              if (p.supplier_id === reviewingQtyRequote.supplier_id && p.kit_id) {
                previousPrices[`kit:${p.kit_id}`] = Number(p.adjusted_unit_price ?? p.unit_price ?? 0);
              }
            });
            const pieceRows = Object.keys(qtyChanges).map((itemKey) => {
              const isKit = itemKey.startsWith("kit:");
              const rawId = isKit ? itemKey.slice(4) : itemKey;
              const item = isKit
                ? kits.find((k) => k.id === rawId)
                : pieces.find((p) => p.id === rawId);
              const prev = previousPrices[itemKey] ?? 0;
              const next = Number(submitted[itemKey] ?? 0);
              const pct = prev > 0 ? ((next - prev) / prev) * 100 : 0;
              const oldQty = qtyChanges[itemKey]?.old_qty ?? 0;
              const newQty = qtyChanges[itemKey]?.new_qty ?? 0;
              return {
                itemKey,
                kind: isKit ? "KIT" : "Peça",
                name: item?.name ?? (isKit ? "(kit)" : "(peça)"),
                code: item?.code ?? 0,
                oldQty,
                newQty,
                prev,
                next,
                pct,
                prevTotal: prev * oldQty,
                newTotal: next * newQty,
              };
            });

            // Map: pieceId -> kitId (which kit owns it as component)
            const pieceToKit = new Map<string, string>();
            (kitPieces ?? []).forEach((kp) => {
              if (!pieceToKit.has(kp.piece_id)) pieceToKit.set(kp.piece_id, kp.kit_id);
            });
            const componentPieceIds = new Set(pieceToKit.keys());

            // Top-level rows (kits + standalone pieces) sorted by code; kit components nested below their kit.
            const rowByKey = new Map(pieceRows.map((r) => [r.itemKey, r]));
            const topLevel = pieceRows
              .filter((r) => r.kind === "KIT" || !componentPieceIds.has(r.itemKey))
              .sort((a, b) => a.code - b.code);
            const orderedRows: typeof pieceRows = [];
            for (const r of topLevel) {
              orderedRows.push(r);
              if (r.kind === "KIT") {
                const kitId = r.itemKey.slice(4);
                const comps = pieceRows
                  .filter((p) => p.kind !== "KIT" && pieceToKit.get(p.itemKey) === kitId)
                  .sort((a, b) => a.code - b.code);
                orderedRows.push(...comps);
              }
            }

            const ec = extraCosts.find((e) => e.supplier_id === reviewingQtyRequote.supplier_id) as any;
            const prevInstallation = Number(ec?.adjusted_installation_value ?? ec?.installation_value ?? 0);
            const prevFreight = Number(ec?.adjusted_freight_value ?? ec?.freight_value ?? 0);
            const newInstallation = submitted.installation != null ? Number(submitted.installation) : prevInstallation;
            const newFreight = submitted.freight != null ? Number(submitted.freight) : prevFreight;

            // Totals: only top-level rows (kits + standalone pieces). Kit component pieces are already accounted for by the kit.
            const includedRows = topLevel.filter((r) => !qtyExcludedKeys.has(r.itemKey));
            const prevItemsTotal = includedRows.reduce((s, r) => s + r.prevTotal, 0);
            const newItemsTotal = includedRows.reduce((s, r) => s + r.newTotal, 0);
            const prevGrand = prevItemsTotal + prevInstallation + prevFreight;
            const newGrand = newItemsTotal + newInstallation + newFreight;
            const grandPct = prevGrand > 0 ? ((newGrand - prevGrand) / prevGrand) * 100 : 0;

            const toggleExclude = (key: string) => {
              setQtyExcludedKeys((s) => {
                const n = new Set(s);
                if (n.has(key)) n.delete(key); else n.add(key);
                return n;
              });
            };

            return (
              <div className="space-y-3 max-h-[60vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Peça / Kit</TableHead>
                      <TableHead className="text-center w-20">Qtd. ant.</TableHead>
                      <TableHead className="text-center w-20">Qtd. nova</TableHead>
                      <TableHead className="text-right">Preço anterior</TableHead>
                      <TableHead className="text-right">Novo preço</TableHead>
                      <TableHead className="text-right w-24">Variação</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderedRows.map((r) => {
                      const excluded = qtyExcludedKeys.has(r.itemKey);
                      const isComponent = r.kind !== "KIT" && componentPieceIds.has(r.itemKey);
                      return (
                        <TableRow key={r.itemKey} className={cn(excluded && "opacity-40 line-through", isComponent && "bg-muted/20")}>
                          <TableCell className="text-sm">
                            <div className={cn("flex items-center gap-2", isComponent && "pl-6")}>
                              {isComponent && <span className="text-xs text-muted-foreground">↳</span>}
                              {r.kind === "KIT" && <Badge variant="secondary" className="text-[10px]">KIT</Badge>}
                              <span>#{r.code} {r.name}</span>
                              {isComponent && <span className="text-[10px] text-muted-foreground italic">(incluso no kit)</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-center tabular-nums text-muted-foreground">{r.oldQty}</TableCell>
                          <TableCell className="text-center tabular-nums font-semibold">{r.newQty}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {r.prev.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {r.next.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </TableCell>
                          <TableCell className={cn("text-right tabular-nums text-xs", r.pct > 0 ? "text-destructive" : r.pct < 0 ? "text-emerald-600" : "text-muted-foreground")}>
                            {r.pct > 0 ? "+" : ""}{r.pct.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 no-underline"
                              onClick={() => toggleExclude(r.itemKey)}
                              title={excluded ? "Restaurar item" : "Remover item da recotação"}
                            >
                              {excluded
                                ? <RotateCcw className="w-3.5 h-3.5" />
                                : <Trash2 className="w-3.5 h-3.5 text-destructive" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1.5">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Instalação (anterior → nova)</span>
                    <span className="tabular-nums">
                      {prevInstallation.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      {" → "}
                      <span className="font-semibold">{newInstallation.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Frete (anterior → novo)</span>
                    <span className="tabular-nums">
                      {prevFreight.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      {" → "}
                      <span className="font-semibold">{newFreight.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 pt-1 border-t">
                    <span className="text-muted-foreground">Subtotal peças (anterior)</span>
                    <span className="tabular-nums">{prevItemsTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Subtotal peças (novo)</span>
                    <span className="tabular-nums font-semibold">{newItemsTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                  </div>
                  <div className="flex justify-between gap-4 pt-1 border-t text-sm">
                    <span className="font-semibold">Total geral</span>
                    <span className="tabular-nums">
                      <span className="text-muted-foreground">{prevGrand.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                      {" → "}
                      <span className="font-bold">{newGrand.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                      <span className={cn("ml-2 text-xs", grandPct > 0 ? "text-destructive" : grandPct < 0 ? "text-emerald-600" : "text-muted-foreground")}>
                        ({grandPct > 0 ? "+" : ""}{grandPct.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  {qtyExcludedKeys.size > 0 && (
                    <p className="text-[11px] text-destructive pt-1">
                      {qtyExcludedKeys.size} item(s) removido(s) — não serão aprovados.
                    </p>
                  )}
                </div>

                {reviewingQtyRequote.notes && (
                  <div className="text-xs border rounded p-2 bg-muted/30 whitespace-pre-wrap">
                    <span className="font-semibold">Observações: </span>{reviewingQtyRequote.notes}
                  </div>
                )}
                <div className="space-y-1.5 pt-2">
                  <Label className="text-xs">Motivo (apenas se recusar)</Label>
                  <Textarea
                    rows={2}
                    value={qtyRejectNotes}
                    onChange={(e) => setQtyRejectNotes(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              disabled={qtyReviewProcessing}
              onClick={async () => {
                if (!reviewingQtyRequote) return;
                setQtyReviewProcessing(true);
                try {
                  const { error } = await supabase.rpc(
                    "reject_budget_qty_requote" as any,
                    { p_id: reviewingQtyRequote.id, p_notes: qtyRejectNotes || null } as any
                  );
                  if (error) throw error;
                  toast.success("Recotação recusada");
                  setReviewingQtyRequote(null);
                  setQtyRejectNotes("");
                  setQtyExcludedKeys(new Set());
                  queryClient.invalidateQueries({ queryKey: ["budget_qty_requotes", campaignId] });
                } catch (e: any) {
                  toast.error(e?.message || "Erro");
                } finally {
                  setQtyReviewProcessing(false);
                }
              }}
            >
              Recusar
            </Button>
            <Button
              disabled={qtyReviewProcessing}
              onClick={async () => {
                if (!reviewingQtyRequote) return;
                setQtyReviewProcessing(true);
                try {
                  if (qtyExcludedKeys.size > 0) {
                    const submitted = { ...(reviewingQtyRequote.submitted_prices ?? {}) } as Record<string, any>;
                    const qtyChanges = { ...(reviewingQtyRequote.qty_changes ?? {}) } as Record<string, any>;
                    qtyExcludedKeys.forEach((k) => { delete submitted[k]; delete qtyChanges[k]; });
                    const { error: upErr } = await supabase
                      .from("budget_qty_requotes")
                      .update({ submitted_prices: submitted, qty_changes: qtyChanges })
                      .eq("id", reviewingQtyRequote.id);
                    if (upErr) throw upErr;
                  }
                  const { error } = await supabase.rpc(
                    "approve_budget_qty_requote" as any,
                    { p_id: reviewingQtyRequote.id } as any
                  );
                  if (error) throw error;
                  toast.success("Recotação aprovada! Preços atualizados.");
                  setReviewingQtyRequote(null);
                  setQtyExcludedKeys(new Set());
                  queryClient.invalidateQueries({ queryKey: ["budget_qty_requotes", campaignId] });
                  queryClient.invalidateQueries({ queryKey: ["budget_prices", campaignId] });
                } catch (e: any) {
                  toast.error(e?.message || "Erro");
                } finally {
                  setQtyReviewProcessing(false);
                }
              }}
            >
              Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}

function computeRequoteTotal(requote: AdjustmentBudgetRequest): number {
  const prices = requote.adjusted_prices_jsonb?.prices ?? [];
  const kits = requote.adjusted_prices_jsonb?.kits ?? [];
  const installation = Number(
    requote.adjusted_extras_jsonb?.installation ?? requote.adjusted_prices_jsonb?.installation ?? 0
  );
  const freight = Number(
    requote.adjusted_extras_jsonb?.freight ?? requote.adjusted_prices_jsonb?.freight ?? 0
  );
  const pricesSum = [...prices, ...kits].reduce(
    (sum: number, p: any) => sum + Number(p.new_price ?? 0),
    0
  );
  return pricesSum + installation + freight;
}

function AdjustmentSummaryCard({
  campaignId,
  onNavigateToSection,
}: {
  campaignId: string;
  onNavigateToSection?: (section: string) => void;
}) {
  const { data: adjustment } = useQuery({
    queryKey: ["active_adjustment_summary", campaignId],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_adjustments")
        .select("id, name, status, approved_at, notes")
        .eq("campaign_id", campaignId)
        .eq("status", "active")
        .maybeSingle();
      return data as { id: string; name: string; status: string; approved_at: string | null; notes: string | null } | null;
    },
  });
  const { data: requote } = useActiveAdjustmentRequest(campaignId);

  if (!adjustment) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Nenhum ajuste ativo ainda.
      </p>
    );
  }

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-foreground">{adjustment.name}</span>
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]">Ativo</Badge>
      </div>
      {adjustment.notes && (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{adjustment.notes}</p>
      )}
      {adjustment.approved_at && (
        <p className="text-[11px] text-muted-foreground">
          Iniciado em {format(new Date(adjustment.approved_at), "dd/MM/yyyy")}
        </p>
      )}

      {requote && (
        <div className="mt-3 pt-3 border-t space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recotação do ajuste
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  REQUOTE_STATUS_META[requote.status]?.badgeClass ?? ""
                }`}
              >
                {REQUOTE_STATUS_META[requote.status]?.label}
              </span>
              {requote.is_late_submission && (
                <span className="text-xs text-red-600">Fora do prazo</span>
              )}
            </div>
            {requote.token_expires_at && ["sent", "filling"].includes(requote.status) && (
              <DeadlineCountdown expiresAt={requote.token_expires_at} />
            )}
          </div>

          {["submitted", "approved"].includes(requote.status) && requote.adjusted_prices_jsonb && (
            <RequoteTotalsBreakdown requote={requote} />
          )}

          {requote.status === "submitted" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigateToSection?.("adjustments")}
              className="w-full gap-2 text-purple-600 border-purple-300"
            >
              Revisar recotação →
            </Button>
          )}

          {requote.status === "approved" && (
            <RequoteApprovedExportRow
              campaignId={campaignId}
              adjustmentId={requote.adjustment_id}
              supplierId={requote.supplier_id}
            />
          )}
        </div>
      )}
    </div>
  );
}


function RequoteApprovedExportRow({
  campaignId,
  adjustmentId,
  supplierId,
}: {
  campaignId: string;
  adjustmentId: string;
  supplierId: string;
}) {
  const { exportFinal, isExporting } = useExportRequoteFinal(campaignId, adjustmentId, supplierId);
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium flex-1">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Recotação aprovada
      </div>
      <Button
        size="sm"
        onClick={() => setDialogOpen(true)}
        disabled={isExporting}
        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs"
      >
        {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
        Planilha final
      </Button>
      <RequoteFinalExportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onExport={(extraFields) => exportFinal(extraFields)}
      />
    </div>
  );
}

function RequoteTotalsBreakdown({ requote }: { requote: AdjustmentBudgetRequest }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  const j = (requote.adjusted_prices_jsonb || {}) as {
    prices?: { piece_id: string; new_price: number }[];
    installation?: number;
    freight?: number;
  };
  const extras = (requote.adjusted_extras_jsonb || {}) as {
    installation?: number;
    freight?: number;
  };
  const installation = Number(extras.installation ?? j.installation ?? 0);
  const freight = Number(extras.freight ?? j.freight ?? 0);

  const enabled = !!requote.adjustment_id && !!requote.supplier_id;

  const { data: adjPieces } = useQuery({
    queryKey: ["requote_breakdown_pieces", requote.adjustment_id],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_adjustment_pieces")
        .select("id, source_piece_id, is_deleted")
        .eq("adjustment_id", requote.adjustment_id)
        .eq("is_deleted", false);
      return data ?? [];
    },
  });

  const { data: baselinePrices } = useQuery({
    queryKey: ["requote_breakdown_baseline", requote.supplier_id],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("budget_prices")
        .select("piece_id, adjusted_unit_price, unit_price")
        .eq("supplier_id", requote.supplier_id);
      return data ?? [];
    },
  });

  const { data: storeQty } = useQuery({
    queryKey: ["requote_breakdown_qty_all", requote.adjustment_id, requote.response_received_at],
    enabled,
    queryFn: async () => {
      const pageSize = 1000;
      let from = 0;
      const all: { piece_id: string; quantity: number }[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("campaign_adjustment_store_pieces" as any)
          .select("piece_id, quantity")
          .eq("adjustment_id", requote.adjustment_id)
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data ?? []) as unknown as { piece_id: string; quantity: number }[];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const ready = !!adjPieces && !!baselinePrices && !!storeQty;

  let production = 0;
  if (ready) {
    const sourceByAdj = new Map<string, string | null>();
    for (const p of adjPieces!) {
      sourceByAdj.set(String(p.id), p.source_piece_id ? String(p.source_piece_id) : null);
    }
    const prevBySource = new Map<string, number>();
    for (const r of baselinePrices!) {
      if (!r.piece_id) continue;
      prevBySource.set(
        String(r.piece_id),
        Number(r.adjusted_unit_price ?? r.unit_price ?? 0),
      );
    }
    const qtyByAdj = new Map<string, number>();
    for (const sp of storeQty!) {
      const pid = String(sp.piece_id);
      qtyByAdj.set(pid, (qtyByAdj.get(pid) || 0) + Number(sp.quantity || 0));
    }
    const newPriceByAdj = new Map<string, number>();
    for (const row of j.prices || []) {
      newPriceByAdj.set(String(row.piece_id), Number(row.new_price) || 0);
    }
    for (const p of adjPieces!) {
      const adjId = String(p.id);
      const srcId = sourceByAdj.get(adjId);
      const prevPrice = srcId ? (prevBySource.get(srcId) || 0) : 0;
      const price = newPriceByAdj.has(adjId) ? (newPriceByAdj.get(adjId) || 0) : prevPrice;
      production += price * (qtyByAdj.get(adjId) || 0);
    }
  }

  const grand = production + installation + freight;

  return (
    <div className="space-y-1 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Valor de produção</span>
        <span className="font-medium">{ready ? fmt(production) : "…"}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Instalação</span>
        <span className="font-medium">{fmt(installation)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Embalagem / Frete</span>
        <span className="font-medium">{fmt(freight)}</span>
      </div>
      <div className="flex items-center justify-between pt-1 border-t">
        <span className="text-foreground font-semibold">Total geral</span>
        <span className="font-semibold">{ready ? fmt(grand) : "…"}</span>
      </div>
    </div>
  );
}

function PhaseStepperWithApproval(props: {
  campaignId: string;
  currentPhase: BudgetPhase;
  phaseLockedAt: Record<string, string>;
  isAdminOrMaster: boolean;
  onUnlock: (phase: BudgetPhase) => void;
  isUnlocking: boolean;
}) {
  const { data: requote } = useActiveAdjustmentRequest(props.campaignId);
  const isAdjustmentApproved = requote?.status === "approved";
  return <PhaseStepper {...props} isAdjustmentApproved={isAdjustmentApproved} />;
}

function AdjustmentKPIBlock({ campaignId, currencyCode }: { campaignId: string; currencyCode: string }) {
  const { t } = useTranslation();
  const { data: adjustment } = useQuery({
    queryKey: ["active_adjustment_summary", campaignId],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_adjustments")
        .select("id, name, status, approved_at, notes, created_at")
        .eq("campaign_id", campaignId)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
  });

  const { data: requote } = useActiveAdjustmentRequest(campaignId);
  const isApproved = requote?.status === "approved";

  const { data: adjPieces } = useQuery({
    queryKey: ["requote_breakdown_pieces", requote?.adjustment_id],
    enabled: isApproved && !!requote?.adjustment_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_adjustment_pieces")
        .select("id, source_piece_id, is_deleted")
        .eq("adjustment_id", requote!.adjustment_id)
        .eq("is_deleted", false);
      return data ?? [];
    },
  });

  const { data: baselinePrices } = useQuery({
    queryKey: ["requote_breakdown_baseline", requote?.supplier_id],
    enabled: isApproved && !!requote?.supplier_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("budget_prices")
        .select("piece_id, adjusted_unit_price, unit_price")
        .eq("supplier_id", requote!.supplier_id);
      return data ?? [];
    },
  });

  const { data: storeQty } = useQuery({
    queryKey: ["requote_breakdown_qty_all", requote?.adjustment_id, requote?.response_received_at],
    enabled: isApproved && !!requote?.adjustment_id,
    queryFn: async () => {
      const pageSize = 1000;
      let from = 0;
      const all: { piece_id: string; quantity: number }[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("campaign_adjustment_store_pieces" as any)
          .select("piece_id, quantity")
          .eq("adjustment_id", requote!.adjustment_id)
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data ?? []) as unknown as { piece_id: string; quantity: number }[];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const { data: supplier } = useQuery({
    queryKey: ["requote_supplier", requote?.supplier_id],
    enabled: isApproved && !!requote?.supplier_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("budget_suppliers")
        .select("company_name")
        .eq("id", requote!.supplier_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: budgetSettings } = useQuery({
    queryKey: ["budget_settings_initial", campaignId],
    enabled: isApproved,
    queryFn: async () => {
      const { data } = await supabase
        .from("budget_settings")
        .select("budget_amount")
        .eq("campaign_id", campaignId)
        .maybeSingle();
      return data;
    },
  });

  if (!adjustment || !isApproved || !requote) return null;

  const fmt = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: currencyCode }).format(n);

  const j = (requote.adjusted_prices_jsonb || {}) as {
    prices?: { piece_id: string; new_price: number }[];
    installation?: number;
    freight?: number;
  };
  const extras = (requote.adjusted_extras_jsonb || {}) as {
    installation?: number;
    freight?: number;
  };
  const installation = Number(extras.installation ?? j.installation ?? 0);
  const freight = Number(extras.freight ?? j.freight ?? 0);

  const ready = !!adjPieces && !!baselinePrices && !!storeQty;

  let production = 0;
  if (ready) {
    const sourceByAdj = new Map<string, string | null>();
    for (const p of adjPieces!) {
      sourceByAdj.set(String(p.id), p.source_piece_id ? String(p.source_piece_id) : null);
    }
    const prevBySource = new Map<string, number>();
    for (const r of baselinePrices!) {
      if (!r.piece_id) continue;
      prevBySource.set(
        String(r.piece_id),
        Number(r.adjusted_unit_price ?? r.unit_price ?? 0),
      );
    }
    const qtyByAdj = new Map<string, number>();
    for (const sp of storeQty!) {
      const pid = String(sp.piece_id);
      qtyByAdj.set(pid, (qtyByAdj.get(pid) || 0) + Number(sp.quantity || 0));
    }
    const newPriceByAdj = new Map<string, number>();
    for (const row of j.prices || []) {
      newPriceByAdj.set(String(row.piece_id), Number(row.new_price) || 0);
    }
    for (const p of adjPieces!) {
      const adjId = String(p.id);
      const srcId = sourceByAdj.get(adjId);
      const prevPrice = srcId ? (prevBySource.get(srcId) || 0) : 0;
      const price = newPriceByAdj.has(adjId) ? (newPriceByAdj.get(adjId) || 0) : prevPrice;
      production += price * (qtyByAdj.get(adjId) || 0);
    }
  }

  const total = production + installation + freight;
  const initialValue = budgetSettings?.budget_amount ? Number(budgetSettings.budget_amount) : total;
  const diff = total - initialValue;

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-md p-6 md:p-8 mt-4 border-l-4 border-l-[#C2714F]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-[#C2714F]" />
          <div>
            <h3 className="text-stone-500 text-sm font-medium uppercase tracking-wide">
              {t("budgets.finalResult")}
            </h3>
            <p className="text-stone-400 text-xs mt-0.5">
              {adjustment.name} {adjustment.created_at && `· ${format(new Date(adjustment.created_at), "dd/MM/yyyy")}`}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-stone-400 text-[10px] uppercase tracking-wide mb-1">
          {t("budgets.winner")}
        </p>
        <p className="text-stone-900 text-xl font-bold">
          {supplier?.company_name || "—"}
        </p>
      </div>

      <div className="h-px bg-stone-100 mb-6" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="space-y-1">
          <p className="text-stone-400 text-[10px] uppercase tracking-wide">
            {t("budgets.production")}
          </p>
          <p className="text-stone-900 font-semibold text-lg">
            {ready ? fmt(production) : "—"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-stone-400 text-[10px] uppercase tracking-wide">
            {t("budgets.freight")}
          </p>
          <p className="text-stone-900 font-semibold text-lg">
            {fmt(freight)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-stone-400 text-[10px] uppercase tracking-wide">
            {t("budgets.installation")}
          </p>
          <p className="text-stone-900 font-semibold text-lg">
            {fmt(installation)}
          </p>
        </div>
        <div className="bg-[#C2714F] rounded-xl p-4 flex flex-col justify-center">
          <p className="text-white/80 text-[10px] uppercase tracking-wide">
            {t("budgets.totalPrice")}
          </p>
          <p className="text-white text-2xl font-extrabold tabular-nums">
            {ready ? fmt(total) : "—"}
          </p>
        </div>
      </div>

      <div className="h-px bg-stone-100 mb-4" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-stone-400 text-sm">{t("budgets.initialPrice")}:</p>
          <p className="text-stone-600 text-sm font-medium">{fmt(initialValue)}</p>
        </div>
        {diff !== 0 && (
          <div className={cn("text-sm font-medium", diff < 0 ? "text-emerald-600" : "text-red-500")}>
            {diff < 0 ? (
              <>{t("budgets.savings")}: {fmt(Math.abs(diff))}</>
            ) : (
              <>{t("budgets.increase")}: {fmt(diff)}</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
