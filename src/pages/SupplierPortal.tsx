import { useParams } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, Lock, Clock, CheckCircle2, AlertTriangle, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

interface PriceRow {
  id: string;
  piece_id: string | null;
  kit_id: string | null;
  unit_price: number | null;
  supplier_id: string;
  campaign_id: string;
}

interface ExtraCosts {
  id?: string;
  supplier_id: string;
  installation_value: number | null;
  freight_value: number | null;
}

interface LineItem {
  id: string;
  name: string;
  code: number;
  type: "piece" | "kit";
  totalQty: number;
}

/* ─── Helpers ────────────────────────────────────────────── */
const fmt = (v: number | null | undefined) =>
  v != null
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
    : "—";

const daysUntil = (d: string | null) => {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  return diff;
};

/* ─── CSS confetti keyframes (injected once) ─────────────── */
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
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [extraCosts, setExtraCosts] = useState<ExtraCosts>({ supplier_id: "", installation_value: null, freight_value: null });
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm1, setShowConfirm1] = useState(false);
  const [showConfirm2, setShowConfirm2] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

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

        // 2) Get budget settings for deadline
        const { data: settings } = await supabase
          .from("budget_settings")
          .select("deadline")
          .eq("campaign_id", sup.campaign_id)
          .maybeSingle();

        const dl = settings?.deadline ?? null;
        setDeadline(dl);

        // Check deadline expiry
        if (dl && new Date(dl) < new Date() && sup.status !== "enviado") {
          await supabase
            .from("budget_suppliers")
            .update({ status: "prazo_encerrado" })
            .eq("id", sup.id);
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

        if (campaign?.client_id) {
          const { data: client } = await supabase
            .from("clients")
            .select("name, agency_id")
            .eq("id", campaign.client_id)
            .single();
          setClientName(client?.name ?? "");

          if (client?.agency_id) {
            const { data: agency } = await supabase
              .from("agencies")
              .select("name")
              .eq("id", client.agency_id)
              .single();
            setAgencyName(agency?.name ?? "");
          }
        }

        // 4) Pieces (non kit_only)
        const { data: piecesData } = await supabase
          .from("campaign_pieces")
          .select("id, name, code, kit_only")
          .eq("campaign_id", sup.campaign_id)
          .eq("kit_only", false)
          .order("display_order");

        // 5) Kits
        const { data: kitsData } = await supabase
          .from("campaign_kits")
          .select("id, name, code")
          .eq("campaign_id", sup.campaign_id)
          .order("display_order");

        // 6) Store pieces for qty totals
        const { data: storePieces } = await supabase
          .from("campaign_store_pieces")
          .select("piece_id, quantity")
          .eq("campaign_id", sup.campaign_id);

        // Build qty map: piece_id -> total
        const qtyMap: Record<string, number> = {};
        (storePieces ?? []).forEach((sp) => {
          qtyMap[sp.piece_id] = (qtyMap[sp.piece_id] || 0) + sp.quantity;
        });

        // 7) Kit pieces for kit qty calculation
        const { data: kitPiecesData } = await supabase
          .from("campaign_kit_pieces")
          .select("kit_id, piece_id, quantity")
          .in("kit_id", (kitsData ?? []).map((k) => k.id));

        // Kit total qty = for each store, min(floor(pieceQty / kitPieceQty)) across all kit pieces, then sum stores
        // Simplified: use total piece qty / kit_piece_qty across all pieces and take min
        const kitQtyMap: Record<string, number> = {};
        (kitsData ?? []).forEach((kit) => {
          const kpList = (kitPiecesData ?? []).filter((kp) => kp.kit_id === kit.id);
          if (kpList.length === 0) { kitQtyMap[kit.id] = 0; return; }
          const ratios = kpList.map((kp) => {
            const totalPieceQty = qtyMap[kp.piece_id] || 0;
            return Math.floor(totalPieceQty / kp.quantity);
          });
          kitQtyMap[kit.id] = Math.min(...ratios);
        });

        // Build line items
        const items: LineItem[] = [
          ...(piecesData ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            type: "piece" as const,
            totalQty: qtyMap[p.id] || 0,
          })),
          ...(kitsData ?? []).map((k) => ({
            id: k.id,
            name: k.name,
            code: k.code,
            type: "kit" as const,
            totalQty: kitQtyMap[k.id] || 0,
          })),
        ];
        setLineItems(items);

        // 8) Existing prices
        const { data: pricesData } = await supabase
          .from("budget_prices")
          .select("*")
          .eq("supplier_id", sup.id);

        const priceMap: Record<string, number | null> = {};
        (pricesData ?? []).forEach((p: PriceRow) => {
          const key = p.piece_id || p.kit_id || "";
          priceMap[key] = p.unit_price;
        });
        setPrices(priceMap);

        // 9) Existing extra costs
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

        if (sup.locked) setSubmitted(true);
      } catch (e: unknown) {
        console.error(e);
        setError("Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // ─── Mark as preenchendo on first interaction ──────────
  const markFilling = useCallback(async () => {
    if (!supplier || supplier.status !== "aguardando") return;
    await supabase
      .from("budget_suppliers")
      .update({ status: "preenchendo" })
      .eq("id", supplier.id);
    setSupplier((s) => s ? { ...s, status: "preenchendo" } : s);
  }, [supplier]);

  // ─── Save price on blur ────────────────────────────────
  const savePrice = useCallback(
    async (itemId: string, itemType: "piece" | "kit", value: number | null) => {
      if (!supplier) return;
      const payload: Record<string, unknown> = {
        supplier_id: supplier.id,
        campaign_id: supplier.campaign_id,
        unit_price: value,
      };
      if (itemType === "piece") {
        payload.piece_id = itemId;
        payload.kit_id = null;
      } else {
        payload.kit_id = itemId;
        payload.piece_id = null;
      }

      await supabase.from("budget_prices").upsert(payload as never, {
        onConflict: "supplier_id,piece_id,kit_id",
      });
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
        await supabase
          .from("budget_extra_costs")
          .update({ [field]: value })
          .eq("id", extraCosts.id);
      } else {
        const { data } = await supabase
          .from("budget_extra_costs")
          .insert(payload)
          .select()
          .single();
        if (data) setExtraCosts((ec) => ({ ...ec, id: data.id }));
      }
    },
    [supplier, extraCosts]
  );

  // ─── Computed totals ───────────────────────────────────
  const lineTotals = useMemo(() => {
    const map: Record<string, number> = {};
    lineItems.forEach((item) => {
      const up = prices[item.id];
      map[item.id] = up != null ? up * item.totalQty : 0;
    });
    return map;
  }, [lineItems, prices]);

  const grandTotal = useMemo(() => {
    const piecesTotal = Object.values(lineTotals).reduce((s, v) => s + v, 0);
    return piecesTotal + (extraCosts.installation_value || 0) + (extraCosts.freight_value || 0);
  }, [lineTotals, extraCosts]);

  // ─── Submit ────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!supplier) return;
    setSubmitting(true);
    try {
      // Lock supplier
      await supabase
        .from("budget_suppliers")
        .update({
          status: "enviado",
          locked: true,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", supplier.id);

      // Get campaign -> client -> agency for notification
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

      // Fire notification via RPC (SECURITY DEFINER, works from anon)
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
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="animate-pulse text-[#8C6F4E] font-medium">Carregando...</div>
      </div>
    );
  }

  // ─── Error / Deadline expired ──────────────────────────
  if (error || !supplier) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="max-w-md text-center px-6 py-8">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            {error || "Link inválido ou expirado"}
          </h1>
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
        <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
          <div className="max-w-lg text-center px-6 py-8">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
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
                  <span className="font-medium">{lineItems.filter((li) => prices[li.id] != null).length} de {lineItems.length}</span>
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
                  <span className="text-[#8C6F4E]">{fmt(grandTotal)}</span>
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
            <div className="flex items-center gap-3">
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
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-2 text-amber-800 text-sm">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              Orçamento enviado em{" "}
              {supplier.submitted_at
                ? new Date(supplier.submitted_at).toLocaleDateString("pt-BR")
                : "—"}
              . Os valores estão bloqueados.
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
                Preencha o <strong>preço unitário</strong> de cada item abaixo. O total por item será
                calculado automaticamente (preço unitário × quantidade total).
              </p>
              <p>
                Ao final, informe os valores de <strong>instalação</strong> e{" "}
                <strong>frete/despacho</strong>, se aplicáveis.
              </p>
              <p>
                Quando tudo estiver pronto, clique em{" "}
                <strong className="text-[#8C6F4E]">ENVIAR ORÇAMENTO</strong>. Atenção: após o envio,
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

        {/* Matrix */}
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-foreground">Itens da Campanha</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Preencha o preço unitário. O total será calculado automaticamente.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Item</TableHead>
                    <TableHead className="text-center w-[100px]">Qtd Total</TableHead>
                    <TableHead className="text-center w-[160px]">Preço Unitário</TableHead>
                    <TableHead className="text-right w-[140px]">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item) => {
                    const unitPrice = prices[item.id] ?? null;
                    const lineTotal = lineTotals[item.id] || 0;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {item.type === "kit" ? "Kit" : `#${item.code}`}
                            </Badge>
                            <span className="font-medium text-sm">{item.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm">
                          {item.totalQty}
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
                            className="w-[130px] mx-auto text-right"
                            disabled={isLocked}
                            value={unitPrice ?? ""}
                            onFocus={markFilling}
                            onChange={(e) => {
                              const val = e.target.value === "" ? null : parseFloat(e.target.value);
                              setPrices((prev) => ({ ...prev, [item.id]: val }));
                            }}
                            onBlur={() => savePrice(item.id, item.type, prices[item.id] ?? null)}
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">
                          {unitPrice != null ? fmt(lineTotal) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {lineItems.length === 0 && (
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
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  disabled={isLocked}
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
                <label className="text-sm text-muted-foreground mb-1 block">
                  Frete / Despacho (R$)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  disabled={isLocked}
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
        <Card className="border-[#8C6F4E]/30 bg-[#8C6F4E]/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Geral do Orçamento</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  (Itens + Instalação + Frete)
                </p>
              </div>
              <span className="text-2xl font-bold text-[#8C6F4E]">{fmt(grandTotal)}</span>
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
            <AlertDialogAction
              onClick={() => {
                setShowConfirm1(false);
                setShowConfirm2(true);
              }}
            >
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
              Tem absoluta certeza? Após o envio, os valores ficam bloqueados e não poderão ser
              alterados.
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
