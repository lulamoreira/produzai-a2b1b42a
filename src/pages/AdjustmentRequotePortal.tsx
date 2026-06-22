import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, CheckCircle2, AlertTriangle, Package, Send, Clock, Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  parseAdjustmentResponseWorkbook,
  type ParsedRequoteResult,
  type ParsedRequoteRow,
  type ExpectedPiece,
} from "@/lib/parseAdjustmentResponseWorkbook";
import { ImportRequoteConfirmDialog } from "@/components/Budget/ImportRequoteConfirmDialog";

interface PortalData {
  request: {
    id: string;
    status: string;
    token_expires_at: string | null;
    is_expired: boolean;
    is_late: boolean;
    adjusted_prices_jsonb: any;
    adjusted_extras_jsonb: any;
    notes: string | null;
    submitted_at: string | null;
    rejection_notes: string | null;
    is_late_submission: boolean | null;
  };
  adjustment: { id: string; name: string; campaign_id: string };
  supplier: { id: string; company_name: string; contact_name: string };
  pieces: Array<{
    id: string; name: string; code: number;
    specification: string | null;
    change_type: string; kit_only: boolean | null;
    source_piece_id: string | null;
    image_url: string | null; image_thumb_url: string | null;
  }>;
  kits: Array<{
    id: string; name: string; source_kit_id: string | null;
    change_type: string; image_url: string | null;
  }>;
  kit_pieces: Array<{ kit_id: string; piece_id: string; quantity: number }>;
  piece_qty: Record<string, number>;
  original_piece_qty: Record<string, number>;
  baseline_prices: Record<string, number>;
  baseline_extras: { installation: number; freight: number };
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(n) ? n : 0
  );

const parseNum = (v: string): number => {
  const cleaned = (v || "").toString().replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

export default function AdjustmentRequotePortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prices, setPrices] = useState<Record<string, string>>({});
  const [installation, setInstallation] = useState("");
  const [freight, setFreight] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("itens");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parseResult, setParseResult] = useState<ParsedRequoteResult | null>(null);
  const [parseLoading, setParseLoading] = useState(false);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc(
          "get_adjustment_requote" as any,
          { p_token: token } as any
        );
        if (rpcErr) throw rpcErr;
        const payload = rpcData as any;
        if (!payload || payload.error) {
          setError(payload?.error || "Token inválido");
          return;
        }
        const d = payload as PortalData;
        setData(d);

        // Pre-fill from previous submission or baseline
        const savedPrices = d.request.adjusted_prices_jsonb?.prices as
          | Array<{ piece_id?: string; new_price?: number }>
          | undefined;
        const pre: Record<string, string> = {};
        if (savedPrices?.length) {
          savedPrices.forEach((p) => {
            if (p.piece_id) pre[p.piece_id] = String(p.new_price ?? "");
          });
        }
        for (const p of d.pieces) {
          if (pre[p.id] == null) {
            const base = d.baseline_prices[p.id];
            pre[p.id] = base != null ? String(base) : "";
          }
        }
        setPrices(pre);

        const savedExtras = d.request.adjusted_extras_jsonb as
          | { installation?: number; freight?: number }
          | null;
        setInstallation(
          String(savedExtras?.installation ?? d.baseline_extras.installation ?? "")
        );
        setFreight(String(savedExtras?.freight ?? d.baseline_extras.freight ?? ""));
        setNotes(d.request.notes || "");

        // Silently mark as filling
        if (d.request.status === "sent") {
          await supabase.rpc("mark_requote_filling" as any, { p_token: token } as any);
        }
      } catch (e: any) {
        setError(e?.message || "Erro ao carregar recotação.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const previousTotal = useMemo(() => {
    if (!data) return 0;
    let t = 0;
    for (const p of data.pieces) {
      const qty = data.piece_qty[p.id] || 0;
      t += (data.baseline_prices[p.id] || 0) * qty;
    }
    return t + (data.baseline_extras.installation || 0) + (data.baseline_extras.freight || 0);
  }, [data]);

  const newTotal = useMemo(() => {
    if (!data) return 0;
    let t = 0;
    for (const p of data.pieces) {
      const qty = data.piece_qty[p.id] || 0;
      t += parseNum(prices[p.id] || "0") * qty;
    }
    return t + parseNum(installation) + parseNum(freight);
  }, [data, prices, installation, freight]);

  const expectedPieces: ExpectedPiece[] = useMemo(() => {
    if (!data) return [];
    return data.pieces.map((p) => ({
      code: String(p.code),
      name: p.name,
      pieceId: p.id,
      previousPrice: data.baseline_prices[p.id] ?? 0,
    }));
  }, [data]);

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return;
    setParseLoading(true);
    try {
      const result = await parseAdjustmentResponseWorkbook(file, expectedPieces);
      setParseResult(result);
      setImportConfirmOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao ler planilha");
    } finally {
      setParseLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.name.toLowerCase().endsWith(".xlsx")) handleFileSelect(file);
    else toast.error("Apenas arquivos .xlsx são aceitos");
  };

  const handleImportConfirm = (
    rows: ParsedRequoteRow[],
    inst: number | null,
    fr: number | null
  ) => {
    const newPrices = { ...prices };
    for (const row of rows) {
      const key = row.pieceId ?? row.kitId ?? row.code;
      if (row.newPrice !== null) newPrices[key] = String(row.newPrice);
    }
    setPrices(newPrices);
    if (inst !== null) setInstallation(String(inst));
    if (fr !== null) setFreight(String(fr));
    setActiveTab("itens");
    toast.success(`${rows.length} preço(s) importados. Revise e envie a recotação.`);
  };

  const handleSubmit = async () => {
    if (!data || !token) return;
    const missing = data.pieces.filter((p) => !prices[p.id] || parseNum(prices[p.id]) <= 0);
    if (missing.length) {
      const proceed = window.confirm(
        `${missing.length} peça(s) sem preço. Deseja enviar mesmo assim?`
      );
      if (!proceed) return;
    }
    setSubmitting(true);
    try {
      const prices_jsonb = {
        prices: data.pieces.map((p) => ({
          piece_id: p.id,
          new_price: parseNum(prices[p.id] || "0"),
        })),
      };
      const extras_jsonb = {
        installation: parseNum(installation),
        freight: parseNum(freight),
      };
      const { data: res, error: rpcErr } = await supabase.rpc(
        "submit_adjustment_requote" as any,
        {
          p_token: token,
          p_prices_jsonb: prices_jsonb,
          p_extras_jsonb: extras_jsonb,
          p_notes: notes || null,
        } as any
      );
      if (rpcErr) throw rpcErr;
      const r = res as any;
      if (!r?.success) throw new Error(r?.error || "Falha ao enviar.");
      setJustSubmitted(true);
      toast.success("Recotação enviada com sucesso!");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <AlertTriangle className="w-12 h-12 mx-auto text-amber-500" />
            <h1 className="text-lg font-semibold">Link inválido</h1>
            <p className="text-sm text-muted-foreground">{error || "Token inválido"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = data.request.status;
  const isReadOnly =
    justSubmitted || ["submitted", "approved", "rejected"].includes(status);

  if (justSubmitted || status === "submitted") {
    return (
      <ThankYouScreen
        supplier={data.supplier.company_name}
        isLate={data.request.is_late || !!data.request.is_late_submission}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-44">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            ProduzAI · Recotação
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
            {data.adjustment.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data.supplier.company_name}
            {data.supplier.contact_name ? ` · ${data.supplier.contact_name}` : ""}
          </p>

          <div className="flex flex-wrap gap-2 mt-3 items-center">
            {data.request.token_expires_at && (
              <Badge variant="outline" className="gap-1.5">
                <Clock className="w-3 h-3" />
                Prazo:{" "}
                {format(
                  new Date(data.request.token_expires_at),
                  "dd/MM/yyyy 'às' HH:mm",
                  { locale: ptBR }
                )}
              </Badge>
            )}
            <StatusBadge status={status} />
            {data.request.is_late && (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                Prazo encerrado — ainda aceito
              </Badge>
            )}
          </div>

          {status === "rejected" && data.request.rejection_notes && (
            <div className="mt-3 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-900 dark:text-red-200">
              <strong>Recotação recusada.</strong>
              <div className="text-xs mt-1 whitespace-pre-wrap">
                {data.request.rejection_notes}
              </div>
            </div>
          )}
          {status === "approved" && (
            <div className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 inline mr-1" />
              Recotação aprovada.
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="itens">Itens</TabsTrigger>
            <TabsTrigger value="extras">Extras</TabsTrigger>
            {!isReadOnly && (
              <TabsTrigger value="anexar" className="gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Anexar planilha
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="itens" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 w-12"></th>
                        <th className="text-left px-3 py-2 w-20">Código</th>
                        <th className="text-left px-3 py-2">Peça</th>
                        <th className="text-right px-3 py-2 w-24">Qtd</th>
                        <th className="text-right px-3 py-2 w-36">Preço anterior</th>
                        <th className="text-right px-3 py-2 w-40">Novo preço</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pieces.map((p) => {
                        const qty = data.piece_qty[p.id] || 0;
                        const prev = data.baseline_prices[p.id] || 0;
                        return (
                          <tr key={p.id} className="border-t">
                            <td className="px-3 py-2">
                              {p.image_thumb_url || p.image_url ? (
                                <img
                                  src={p.image_thumb_url || p.image_url || ""}
                                  alt=""
                                  className="w-8 h-8 rounded object-cover bg-muted"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                  <Package className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span>{p.name}</span>
                                {p.change_type === "added" && (
                                  <Badge className="bg-emerald-100 text-emerald-700 text-[10px] py-0">
                                    Nova
                                  </Badge>
                                )}
                                {p.change_type === "modified" && (
                                  <Badge className="bg-amber-100 text-amber-700 text-[10px] py-0">
                                    Modificada
                                  </Badge>
                                )}
                              </div>
                              {p.specification && (
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  {p.specification}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {qty}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {fmtBRL(prev)}
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={prices[p.id] ?? ""}
                                onChange={(e) =>
                                  setPrices((s) => ({ ...s, [p.id]: e.target.value }))
                                }
                                disabled={isReadOnly}
                                placeholder="0,00"
                                className="h-8 text-right tabular-nums"
                              />
                            </td>
                          </tr>
                        );
                      })}
                      {data.pieces.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-8 text-center text-sm text-muted-foreground"
                          >
                            Nenhuma peça neste ajuste.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="extras" className="mt-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Instalação
                  </label>
                  <div className="text-xs text-muted-foreground mb-1">
                    Anterior: {fmtBRL(data.baseline_extras.installation)}
                  </div>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={installation}
                    onChange={(e) => setInstallation(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="0,00"
                    className="max-w-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Embalagem / Frete</label>
                  <div className="text-xs text-muted-foreground mb-1">
                    Anterior: {fmtBRL(data.baseline_extras.freight)}
                  </div>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={freight}
                    onChange={(e) => setFreight(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="0,00"
                    className="max-w-xs"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {!isReadOnly && (
            <TabsContent value="anexar" className="mt-4">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Importar planilha preenchida</h3>
                    <p className="text-xs text-muted-foreground">
                      Se preferir, baixe a planilha enviada pelo nosso time, preencha e faça o upload aqui.
                      Os preços serão importados automaticamente.
                    </p>
                  </div>

                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    {parseLoading ? (
                      <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <div className="text-sm font-medium">
                          Arraste a planilha aqui ou clique para selecionar
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Apenas arquivos .xlsx
                        </div>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0])}
                    />
                  </div>

                  {parseResult && !importConfirmOpen && (
                    <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <div className="text-xs flex-1">
                        {parseResult.matched} peças identificadas
                        {parseResult.unmatched > 0 && ` (${parseResult.unmatched} não encontradas)`}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setImportConfirmOpen(true)}>
                        Revisar e aplicar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>


      {/* Sticky footer */}
      {!isReadOnly && (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-card shadow-lg">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <Textarea
                  rows={1}
                  placeholder="Observações (opcional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-sm min-h-[40px]"
                />
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Total anterior
                </div>
                <div className="text-sm text-muted-foreground tabular-nums">
                  {fmtBRL(previousTotal)}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                  Total novo
                </div>
                <div className="text-lg font-semibold text-foreground tabular-nums">
                  {fmtBRL(newTotal)}
                </div>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                size="lg"
                className="gap-2 w-full sm:w-auto"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Enviar recotação
              </Button>
            </div>
          </div>
        </div>
      )}

      <ImportRequoteConfirmDialog
        open={importConfirmOpen}
        onOpenChange={setImportConfirmOpen}
        result={parseResult}
        onConfirmSelected={handleImportConfirm}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; cls: string }> = {
    pending: { label: "Não enviado", cls: "bg-muted text-muted-foreground" },
    sent: { label: "Aguardando preenchimento", cls: "bg-amber-100 text-amber-800" },
    filling: { label: "Em preenchimento", cls: "bg-blue-100 text-blue-800" },
    submitted: { label: "Enviado para revisão", cls: "bg-purple-100 text-purple-800" },
    approved: { label: "Aprovado", cls: "bg-emerald-100 text-emerald-800" },
    rejected: { label: "Recusado", cls: "bg-red-100 text-red-800" },
  };
  const m = meta[status] || meta.pending;
  return <Badge className={m.cls}>{m.label}</Badge>;
}

function ThankYouScreen({ supplier, isLate }: { supplier: string; isLate: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full">
        <CardContent className="p-10 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500" />
          <h1 className="text-xl font-semibold">Recotação enviada com sucesso!</h1>
          <p className="text-sm text-muted-foreground">
            Obrigado, <strong>{supplier}</strong>. Sua resposta foi registrada e o responsável será
            notificado.
          </p>
          {isLate && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
              Enviado fora do prazo — a equipe foi informada.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
