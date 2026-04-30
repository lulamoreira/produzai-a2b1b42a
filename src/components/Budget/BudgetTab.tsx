import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DollarSign, Plus, Trash2, Eye, MessageCircle, Mail, Lock, Check, Clock, Edit3, CalendarIcon, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, Download, Link2, Copy, Pencil, Loader2, Send, History, Unlock, Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { snapshotSupplierBudget } from "@/lib/budgetPriceSnapshot";
import BudgetSupplierHistorySheet from "@/components/Budget/BudgetSupplierHistorySheet";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { COUNTRY_CONFIGS, formatCurrencyByCode } from "@/lib/countryConfig";

import {
  useBudgetSettings, useSaveBudgetSettings,
  useBudgetSuppliers, useAddSupplier, useDeleteSupplier, useUpdateSupplier,
  useBudgetPrices, useBudgetExtraCosts, useSupplierSpecSuggestions, useExchangeRate,
} from "@/hooks/useBudget";
import { useClientSuppliers, useAddClientSupplier } from "@/hooks/useClientSuppliers";
import { useBudgetTimeline } from "@/hooks/useBudgetTimeline";
import { useRealtimeBudget } from "@/hooks/useRealtimeBudget";
import BudgetTimelineSection from "@/components/Budget/BudgetTimelineSection";
import { exportBudgetComparison } from "@/lib/exportBudgetComparison";
import { exportSupplierBudget, type SupplierExportRow } from "@/lib/exportSupplierBudget";
import BudgetSendClientDialog from "@/components/Budget/BudgetSendClientDialog";
import BudgetWinnerDialog from "@/components/Budget/BudgetWinnerDialog";

import type { CampaignPiece, CampaignKit } from "@/hooks/useMultiClientData";

interface BudgetTabProps {
  campaignId: string;
  clientId: string;
  campaignName: string;
  agencyName: string;
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: { id: string; kit_id: string; piece_id: string; quantity: number }[];
  qtyMap: Record<string, number>;
  stores: { id: string; name: string }[];
}

// ─── Status helpers ──────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  aguardando: { label: "Aguardando", color: "bg-muted text-muted-foreground" },
  preenchendo: { label: "Preenchendo", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  enviado: { label: "Enviado", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  prazo_encerrado: { label: "Prazo encerrado", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

// Returns visual status considering revision state (sup unlocked but had submitted before)
function getDisplayStatus(sup: { status: string; locked: boolean | null; submitted_at: string | null }) {
  if (sup.status !== "enviado" && sup.submitted_at && !sup.locked) {
    return { label: "Em revisão", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  }
  return STATUS_MAP[sup.status] || STATUS_MAP.aguardando;
}

// ─── Main Component ──────────────────────────────────────
export default function BudgetTab({ campaignId, clientId, campaignName, agencyName, pieces, kits, kitPieces, qtyMap, stores }: BudgetTabProps) {
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

  // Currency-aware formatter (depends on settings)
  const settingsTyped = settings as { currency_code?: string; currency_locked?: boolean } | null | undefined;
  const currencyCode = settingsTyped?.currency_code || "BRL";
  const currencyLocked = settingsTyped?.currency_locked === true;
  const fmtCurrency = (v: number | null | undefined) =>
    v == null ? "—" : formatCurrencyByCode(v, currencyCode);
  const fmtBRL = (v: number | null | undefined) =>
    v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Exchange rate for non-BRL currencies
  const { data: rateData, isLoading: rateLoading } = useExchangeRate(currencyCode);
  const exchangeRate = rateData?.rate ?? 1;

  // Local state
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<string | null>(null);
  const [editSupplierId, setEditSupplierId] = useState<string | null>(null);
  const [editSupplierDraft, setEditSupplierDraft] = useState({ company_name: "", contact_name: "", phone: "", email: "" });
  const [newSupplier, setNewSupplier] = useState({ company_name: "", contact_name: "", phone: "", email: "" });
  const [expandedSuggestionPieceId, setExpandedSuggestionPieceId] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>(currencyCode);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [exportingBudget, setExportingBudget] = useState(false);
  const [downloadingSupplierId, setDownloadingSupplierId] = useState<string | null>(null);
  const [clientSendDialogOpen, setClientSendDialogOpen] = useState(false);
  const [historySupplierId, setHistorySupplierId] = useState<string | null>(null);
  const [reopeningSupplierId, setReopeningSupplierId] = useState<string | null>(null);
  const [winnerSupplierId, setWinnerSupplierId] = useState<string | null>(null);

  // ── Editor de "Links do Vencedor" (configuração padrão usada no e-mail de vencedor) ──
  const settingsAny = settings as any;
  const [winnerLinksOpen, setWinnerLinksOpen] = useState(false);
  const [winnerMockupUrlDraft, setWinnerMockupUrlDraft] = useState("");
  const [winnerBookUrlDraft, setWinnerBookUrlDraft] = useState("");
  const [winnerCcEmailDraft, setWinnerCcEmailDraft] = useState("");
  const [savingWinnerLinks, setSavingWinnerLinks] = useState(false);

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

  // Client suppliers picker
  const { data: clientSuppliers = [] } = useClientSuppliers(clientId);
  const addClientSupplier = useAddClientSupplier();
  const [clientSupplierSearch, setClientSupplierSearch] = useState("");
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickCreateForm, setQuickCreateForm] = useState({
    company_name: "", contact_name: "", phone: "", email: "",
  });

  // Keep selectedCurrency in sync if settings load after mount
  React.useEffect(() => {
    setSelectedCurrency(currencyCode);
  }, [currencyCode]);

  // ─── Piece total quantities (sum across all stores) ────
  const pieceTotals = useMemo(() => {
    const map: Record<string, number> = {};
    pieces.forEach((p) => {
      let total = 0;
      stores.forEach((s) => { total += qtyMap[`${s.id}-${p.id}`] || 0; });
      map[p.id] = total;
    });
    return map;
  }, [pieces, stores, qtyMap]);

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
  const supplierPartialTotals = useMemo(() => {
    const result: Record<string, { total: number; installation: number; freight: number; pricedPieces: number; totalPiecesNeeded: number; pct: number }> = {};
    suppliers.forEach((sup) => {
      let total = 0;
      let pricedPieces = 0;
      let totalPiecesNeeded = 0;
      const counted = new Set<string>();
      pieces.filter((p) => !p.kit_only).forEach((piece) => {
        const qty = pieceTotals[piece.id] || 0;
        if (qty <= 0) return;
        totalPiecesNeeded += 1;
        const pr = prices.find((x) => x.supplier_id === sup.id && x.piece_id === piece.id);
        if (pr && Number(pr.unit_price) > 0) {
          total += Number(pr.unit_price) * qty;
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
            total += Number(pr.unit_price) * kpi.qty;
            pricedPieces += 1;
            counted.add(kpi.pieceId);
          }
        });
      });
      const ec = extraCosts.find((e) => e.supplier_id === sup.id);
      const installation = Number(ec?.installation_value) || 0;
      const freight = Number(ec?.freight_value) || 0;
      total += installation + freight;
      const pct = totalPiecesNeeded > 0 ? Math.round((pricedPieces / totalPiecesNeeded) * 100) : 0;
      result[sup.id] = { total, installation, freight, pricedPieces, totalPiecesNeeded, pct };
    });
    return result;
  }, [suppliers, prices, extraCosts, pieceTotals, kitPieceTotals, pieces]);

  const supplierTotals = useMemo(() => {
    const result: Record<string, number> = {};
    suppliers.forEach((sup) => {
      if (sup.status !== "enviado") return;
      result[sup.id] = supplierPartialTotals[sup.id]?.total ?? 0;
    });
    return result;
  }, [suppliers, supplierPartialTotals]);

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

  const budgetAmount = settings?.budget_amount != null ? Number(settings.budget_amount) : null;
  const difference = bestSupplier && budgetAmount != null ? bestSupplier.total - budgetAmount : null;

  // ─── Deadline state ────────────────────────────────────
  const deadlineDate = settings?.deadline ? new Date(settings.deadline) : undefined;

  const handleSaveDeadline = (date: Date | undefined) => {
    let final: Date | null = null;
    if (date) {
      final = new Date(date);
      // Preserva hora existente OU usa padrão 15:00
      if (deadlineDate) {
        final.setHours(deadlineDate.getHours(), deadlineDate.getMinutes(), 0, 0);
      } else {
        final.setHours(15, 0, 0, 0);
      }
    }
    saveSettings.mutate({
      campaign_id: campaignId,
      budget_amount: budgetAmount,
      deadline: final ? final.toISOString() : null,
    });
  };

  const handleSaveDeadlineTime = (timeStr: string) => {
    if (!deadlineDate || !timeStr) return;
    const [hh, mm] = timeStr.split(":").map((n) => parseInt(n, 10));
    if (isNaN(hh) || isNaN(mm)) return;
    const final = new Date(deadlineDate);
    final.setHours(hh, mm, 0, 0);
    saveSettings.mutate({
      campaign_id: campaignId,
      budget_amount: budgetAmount,
      deadline: final.toISOString(),
    });
  };

  const handleSaveBudget = () => {
    const val = parseFloat(budgetDraft.replace(/[^\d.,]/g, "").replace(",", "."));
    saveSettings.mutate({
      campaign_id: campaignId,
      budget_amount: isNaN(val) ? null : val,
      deadline: settings?.deadline ?? null,
    });
    setEditingBudget(false);
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
    const portalUrl = `${window.location.origin}/orcamento/${sup.access_token}`;
    const subject = `${campaignName} — Convite para Cotação`;

    const deadlineBlock = settings?.deadline
      ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⏰ PRAZO PARA ENVIO
━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 ${new Date(settings.deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
`
      : '';

    const timelineBlock = timelineEntries.length > 0
      ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━
  📅 CRONOGRAMA DA CAMPANHA
━━━━━━━━━━━━━━━━━━━━━━━━━━

${timelineEntries.map(e => `🔸 ${new Date(e.entry_date + 'T00:00:00').toLocaleDateString('pt-BR')}
   ${e.description}`).join('\n\n')}

⚠️  ATENÇÃO: Ao preencher e enviar o orçamento, você confirma o aceite deste cronograma.
`
      : '';

    const materialsBlock = sharedMaterials.length > 0
      ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━
  📎 MATERIAL DE APOIO
━━━━━━━━━━━━━━━━━━━━━━━━━━

Os arquivos abaixo estão disponíveis para download direto:

${sharedMaterials.map((m: any) => `🔸 ${m.title || m.file_name}
   ${m.file_url}`).join('\n\n')}

💡 Você também encontrará todos esses materiais dentro do portal de cotação.
`
      : '';

    const body = `━━━━━━━━━━━━━━━━━━━━━━━━━━
  📋 CONVITE PARA COTAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━

👋 Olá, ${sup.contact_name}!

✨ A ${agencyName} está convidando a ${sup.company_name} para participar do processo de cotação da campanha:

📌 ${campaignName.toUpperCase()}

━━━━━━━━━━━━━━━━━━━━━━━━━━
  📝 COMO PARTICIPAR
━━━━━━━━━━━━━━━━━━━━━━━━━━

▸ 1️⃣  Acesse o portal de cotação pelo link abaixo
▸ 2️⃣  Preencha o preço unitário de cada peça/kit
▸ 3️⃣  Informe os valores de instalação e frete
▸ 4️⃣  Clique em ENVIAR ao concluir a cotação

━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔗 ACESSE AQUI
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
    const portalUrl = `${window.location.origin}/orcamento/${sup.access_token}`;
    const deadlineStr = deadlineDate ? format(deadlineDate, "dd/MM/yyyy 'às' HH:mm") : "não definido";
    const materialsLine = sharedMaterials.length > 0
      ? `\n\n📎 Material de apoio para download:\n${sharedMaterials.map((m: any) => `• ${m.title || m.file_name}: ${m.file_url}`).join('\n')}`
      : '';
    const msg = `Olá ${sup.contact_name}! A ${agencyName} convidou ${sup.company_name} para participar do processo de cotação da campanha ${campaignName}.\n\nPara acessar a planilha e preencher seus preços, acesse o link abaixo:\n${portalUrl}\n\nPrazo para envio: ${deadlineStr}${materialsLine}\n\nInstruções:\n1) Acesse o link acima\n2) Preencha o preço unitário de cada peça\n3) Informe os valores de instalação e frete\n4) Clique em ENVIAR quando concluir\n\nDúvidas? Entre em contato conosco.`;
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
      toast.success("Planilha de orçamento exportada.");
    } catch (error) {
      console.error("Budget export error:", error);
      toast.error("Erro ao exportar a planilha de orçamento.");
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
        const { data: storeRows } = await supabase
          .from("client_stores")
          .select("id, name, city, state, store_code")
          .in("id", storeIds);
        fullStores = storeRows ?? [];
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

  return (
    <div className="space-y-6">

      {/* ═══ KPI CARDS ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Budget da Campanha */}
        <Card>
          <CardContent className="pt-4 pb-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Budget da Campanha</p>
            {editingBudget ? (
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
            ) : (
              <button
                onClick={() => { setBudgetDraft(budgetAmount?.toString() ?? ""); setEditingBudget(true); }}
                className="text-2xl font-bold text-foreground hover:text-primary transition-colors flex items-center gap-2"
              >
                {budgetAmount != null ? fmtCurrency(budgetAmount) : "Definir"}
                <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
            {budgetAmount != null && currencyCode !== "BRL" && (
              <p className="text-xs text-muted-foreground mt-0.5">{fmtBRL(budgetAmount * exchangeRate)}</p>
            )}
            {/* Deadline + Currency */}
            <div className="flex items-center gap-2 flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-7 text-xs gap-1", !deadlineDate && "text-muted-foreground")}>
                    <CalendarIcon className="w-3 h-3" />
                    {deadlineDate ? format(deadlineDate, "dd/MM/yyyy 'às' HH:mm") : "Prazo"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deadlineDate}
                    onSelect={(d) => handleSaveDeadline(d)}
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                  />
                  {deadlineDate && (
                    <div className="border-t border-border p-3 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Horário:</span>
                      <Input
                        type="time"
                        value={format(deadlineDate, "HH:mm")}
                        onChange={(e) => handleSaveDeadlineTime(e.target.value)}
                        className="h-7 text-xs w-28"
                      />
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {currencyLocked ? (
                <div className="flex items-center gap-1.5 h-7 text-xs px-2 text-foreground">
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
                <>
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
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Melhor Proposta */}
        <Card className={bestSupplier ? "border-emerald-200 dark:border-emerald-800" : ""}>
          <CardContent className="pt-4 pb-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Melhor Proposta</p>
            {bestSupplier ? (
              <>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmtCurrency(bestSupplier.total)}</p>
                {currencyCode !== "BRL" && (
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtBRL(bestSupplier.total * exchangeRate)}</p>
                )}
                <p className="text-xs text-muted-foreground">{bestSupplier.name}</p>
              </>
            ) : (
              <p className="text-lg text-muted-foreground">Sem propostas</p>
            )}
          </CardContent>
        </Card>

        {/* Diferença */}
        <Card>
          <CardContent className="pt-4 pb-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Diferença</p>
            {difference != null ? (
              <>
                <p className={cn("text-2xl font-bold", difference <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {difference <= 0 ? "" : "+"}{fmtCurrency(difference)}
                </p>
                {currencyCode !== "BRL" && (
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtBRL(difference * exchangeRate)}</p>
                )}
              </>
            ) : (
              <p className="text-lg text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ ENVIAR CERTAME (logo abaixo dos KPIs) ═══ */}
      {suppliers.some((s) => s.status === "enviado") && (
        <div className="flex justify-end">
          <Button
            size="sm"
            className="gap-1"
            onClick={() => setClientSendDialogOpen(true)}
          >
            <Send className="w-3.5 h-3.5" /> Enviar o Certame para o Cliente
          </Button>
        </div>
      )}

      {/* Exchange rate info row (shown only when currency is not BRL) */}
      {currencyCode !== "BRL" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground -mt-2">
          <span>
            Cotação: 1 {currencyCode} = {fmtBRL(exchangeRate)}
            {rateData?.updatedAt ? ` · Atualizado em ${rateData.updatedAt}` : ""}
            {" · Fonte: AwesomeAPI"}
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

      {/* ═══ TIMELINE SECTION ═══ */}
      <BudgetTimelineSection campaignId={campaignId} />

      {/* ═══ SUPPLIERS SECTION ═══ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Fornecedores</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={handleExportBudget} disabled={exportingBudget || suppliers.length === 0}>
              <Download className="w-3.5 h-3.5" /> {exportingBudget ? "Exportando..." : "Exportar Excel"}
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setAddOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Adicionar Fornecedor
            </Button>
          </div>
        </div>

        {suppliers.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum fornecedor cadastrado.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {suppliers.map((sup) => {
              const st = getDisplayStatus(sup);
              const partial = supplierPartialTotals[sup.id];
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
                              const url = `${window.location.origin}/orcamento/${sup.access_token}`;
                              window.open(
                                url,
                                "_blank",
                                "noopener,noreferrer,popup=yes,width=1200,height=800"
                              );
                            }}
                            className="truncate text-[11px] text-primary hover:underline text-left flex-1 min-w-0"
                            title={`${window.location.origin}/orcamento/${sup.access_token}`}
                          >
                            {`${window.location.origin}/orcamento/${sup.access_token}`}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const url = `${window.location.origin}/orcamento/${sup.access_token}`;
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
                            {sup.status === "enviado" ? "Total" : inProgress ? "Parcial" : "Sem valores"}
                          </span>
                          <span className={cn(
                            "font-bold",
                            sup.status === "enviado" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                          )}>
                            {fmtCurrency(partial.total)}
                          </span>
                        </div>
                        {(partial.installation > 0 || partial.freight > 0) && (
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>Frete + Inst.</span>
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
                      {isAdminOrMaster && sup.submitted_at && (
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0"
                          title="Declarar vencedor do certame"
                          onClick={() => setWinnerSupplierId(sup.id)}
                        >
                          <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        </Button>
                      )}
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
                          {sup.locked ? (
                            <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          )}
                          <span className="text-[11px] text-muted-foreground truncate">
                            {sup.locked ? "Travado para edição" : "Liberado para revisão"}
                          </span>
                        </div>
                        <Switch
                          checked={!sup.locked}
                          disabled={reopeningSupplierId === sup.id}
                          onCheckedChange={() => handleToggleSupplierLock(sup)}
                          aria-label={sup.locked ? "Liberar planilha para revisão" : "Travar planilha novamente"}
                        />
                      </div>
                    )}
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
                      <TableHead className="text-xs text-right">Σ Peças</TableHead>
                      <TableHead className="text-xs text-right">Instalação</TableHead>
                      <TableHead className="text-xs text-right">Frete</TableHead>
                      <TableHead className="text-xs text-right">Total Geral</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((sup) => {
                      const st = getDisplayStatus(sup);
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
                          <TableCell className="text-right tabular-nums">{piecesTotal > 0 ? fmtCurrency(piecesTotal) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{p.installation > 0 ? fmtCurrency(p.installation) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{p.freight > 0 ? fmtCurrency(p.freight) : "—"}</TableCell>
                          <TableCell className={cn(
                            "text-right tabular-nums font-semibold",
                            isBest && "text-emerald-600 dark:text-emerald-400"
                          )}>
                            {p.total > 0 ? fmtCurrency(p.total) : "—"}
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
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setShowQuickCreate(false); setClientSupplierSearch(""); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Fornecedor</DialogTitle>
            <DialogDescription>Selecione um fornecedor cadastrado ou adicione manualmente.</DialogDescription>
          </DialogHeader>

          {/* ─── Picker from client suppliers ─── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Selecionar do cadastro do cliente</Label>
              {!showQuickCreate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1 text-primary"
                  onClick={() => setShowQuickCreate(true)}
                >
                  <Plus className="w-3 h-3" /> Cadastrar novo
                </Button>
              )}
            </div>

            {showQuickCreate ? (
              <div className="border border-border rounded-md p-3 space-y-2 bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground">Novo fornecedor (será salvo no cadastro do cliente)</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Empresa *"
                    value={quickCreateForm.company_name}
                    onChange={(e) => setQuickCreateForm((p) => ({ ...p, company_name: e.target.value }))}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="Contato"
                    value={quickCreateForm.contact_name}
                    onChange={(e) => setQuickCreateForm((p) => ({ ...p, contact_name: e.target.value }))}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="Telefone"
                    value={quickCreateForm.phone}
                    onChange={(e) => setQuickCreateForm((p) => ({ ...p, phone: e.target.value }))}
                    className="h-8 text-xs"
                  />
                  <Input
                    type="email"
                    placeholder="E-mail *"
                    value={quickCreateForm.email}
                    onChange={(e) => setQuickCreateForm((p) => ({ ...p, email: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setShowQuickCreate(false); setQuickCreateForm({ company_name: "", contact_name: "", phone: "", email: "" }); }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={addClientSupplier.isPending || !quickCreateForm.company_name.trim() || !quickCreateForm.email.trim()}
                    onClick={async () => {
                      try {
                        const created = await addClientSupplier.mutateAsync({
                          client_id: clientId,
                          company_name: quickCreateForm.company_name.trim(),
                          contact_name: quickCreateForm.contact_name.trim() || null,
                          phone: quickCreateForm.phone.trim() || null,
                          email: quickCreateForm.email.trim(),
                        });
                        setNewSupplier({
                          company_name: created.company_name,
                          contact_name: created.contact_name || "",
                          phone: created.phone || "",
                          email: created.email,
                        });
                        setShowQuickCreate(false);
                        setQuickCreateForm({ company_name: "", contact_name: "", phone: "", email: "" });
                      } catch { /* toast handled by hook */ }
                    }}
                  >
                    Salvar e usar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Buscar por empresa ou e-mail..."
                  value={clientSupplierSearch}
                  onChange={(e) => setClientSupplierSearch(e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="max-h-40 overflow-y-auto border border-border rounded-md divide-y divide-border">
                  {clientSuppliers.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      Nenhum fornecedor cadastrado para este cliente.
                    </div>
                  ) : (
                    clientSuppliers
                      .filter((s) => {
                        const q = clientSupplierSearch.trim().toLowerCase();
                        if (!q) return true;
                        return s.company_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
                      })
                      .map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/40">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate">{s.company_name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{s.email}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setNewSupplier({
                              company_name: s.company_name,
                              contact_name: s.contact_name || "",
                              phone: s.phone || "",
                              email: s.email,
                            })}
                          >
                            Usar
                          </Button>
                        </div>
                      ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* ─── Divider ─── */}
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-background px-2 text-muted-foreground">Ou adicionar manualmente</span>
            </div>
          </div>

          {/* ─── Manual entry form ─── */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Empresa</Label>
              <Input value={newSupplier.company_name} onChange={(e) => setNewSupplier((p) => ({ ...p, company_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Contato</Label>
              <Input value={newSupplier.contact_name} onChange={(e) => setNewSupplier((p) => ({ ...p, contact_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={newSupplier.phone} onChange={(e) => setNewSupplier((p) => ({ ...p, phone: e.target.value }))} placeholder="+5511999999999" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={newSupplier.email} onChange={(e) => setNewSupplier((p) => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddSupplier} disabled={addSupplier.isPending}>
              {addSupplier.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      <Sheet open={!!detailSupplier} onOpenChange={(o) => !o && setDetailSupplier(null)}>
        <SheetContent className="w-full sm:max-w-[min(96vw,1100px)] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {detailSup?.company_name}
              {detailSup?.locked && <Lock className="w-4 h-4 text-muted-foreground" />}
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
                <span className="text-muted-foreground font-medium">Preenchimento do fornecedor</span>
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
                  {detailSup?.status === "enviado" ? "Total final" : "Total parcial (em preenchimento)"}
                </span>
                <span className={cn(
                  "text-base font-bold",
                  detailSup?.status === "enviado" ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
                )}>
                  {fmtCurrency(supplierPartialTotals[detailSupplier].total)}
                </span>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-4">
            {/* Pieces table */}
            <div className="border rounded-md">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Peça</TableHead>
                    <TableHead className="text-xs text-right w-20">Qtd</TableHead>
                    <TableHead className="text-xs text-right w-28">Preço Unit.</TableHead>
                    <TableHead className="text-xs text-right w-28">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Standalone pieces */}
                  {pieces.filter((p) => !p.kit_only).sort((a, b) => (Number(a.code) || 0) - (Number(b.code) || 0) || String(a.code ?? '').localeCompare(String(b.code ?? ''))).map((piece) => {
                    const qty = pieceTotals[piece.id] || 0;
                    const priceRow = detailPrices.find((pr) => pr.piece_id === piece.id);
                    const unitPrice = priceRow ? Number(priceRow.unit_price) || 0 : 0;
                    const lineTotal = unitPrice * qty;
                    const sug = suggestionsMap[piece.id];
                    const isSugExpanded = expandedSuggestionPieceId === piece.id;
                    return (
                      <React.Fragment key={piece.id}>
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
                          <TableCell className="text-xs text-right">{qty}</TableCell>
                          <TableCell className="text-xs text-right">{priceRow ? fmtCurrency(unitPrice) : "—"}</TableCell>
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
                  {/* Kits expanded into pieces */}
                  {[...kits].sort((a, b) => (Number(a.code) || 0) - (Number(b.code) || 0) || String(a.code ?? '').localeCompare(String(b.code ?? ''))).map((kit) => {
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
                    return (
                      <React.Fragment key={kit.id}>
                        <TableRow className="bg-muted/40 border-t-2">
                          <TableCell colSpan={3} className="text-xs font-semibold">
                            🧩 Kit {kit.code} - {kit.name} <span className="font-normal text-muted-foreground">(Qtd kit: {kitQty})</span>
                          </TableCell>
                          <TableCell className="text-xs text-right font-semibold">{fmtCurrency(kitTotal)}</TableCell>
                        </TableRow>
                        {pieceRows.map(({ kp, piece, priceRow, unitPrice, qty, lineTotal }) => {
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
                                <TableCell className="text-xs text-right">{qty}</TableCell>
                                <TableCell className="text-xs text-right">{priceRow ? fmtCurrency(unitPrice) : "—"}</TableCell>
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
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Extra costs */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="pt-3 pb-3">
                  <p className="text-xs text-muted-foreground">Instalação</p>
                  <p className="text-sm font-semibold">{fmtCurrency(Number(detailCosts?.installation_value) || 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-3 pb-3">
                  <p className="text-xs text-muted-foreground">Frete</p>
                  <p className="text-sm font-semibold">{fmtCurrency(Number(detailCosts?.freight_value) || 0)}</p>
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
        </SheetContent>
      </Sheet>

      {/* Send budget results to client */}
      <BudgetSendClientDialog
        open={clientSendDialogOpen}
        onOpenChange={setClientSendDialogOpen}
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
        pieceTotals={pieceTotals}
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
      />
    </div>
  );
}
