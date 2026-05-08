import React, { useEffect, useMemo, useState } from "react";
import { Send, Loader2, X } from "lucide-react";
import { saveBlobAs } from "@/lib/saveBlobAs";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrencyByCode } from "@/lib/countryConfig";
import {
  buildSupplierBudgetWorkbook,
  type SupplierExportRow,
} from "@/lib/exportSupplierBudget";
import { uploadAndSign as sharedUploadAndSign, type UploadStatus } from "@/lib/budgetEmailUpload";
import { UploadProgressPanel } from "@/components/Budget/UploadProgressPanel";
import { SendSummaryPanel, type SendSummaryItem } from "@/components/Budget/SendSummaryPanel";

import type { CampaignPiece, CampaignKit } from "@/hooks/useMultiClientData";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const BUCKET = "budget-files";

interface PartialTotal {
  total: number;
  installation: number;
  freight: number;
}

interface BudgetSendClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  agencyName: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  suppliers: any[];
  supplierPartialTotals: Record<string, PartialTotal>;
  bestSupplier: { id: string; total: number; name: string } | null;
  budgetAmount: number | null;
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: { id: string; kit_id: string; piece_id: string; quantity: number }[];
  qtyMap: Record<string, number>;
  stores: { id: string; name: string }[];
  pieceTotals: Record<string, number>;
  prices: any[];
  extraCosts: any[];
  currencyCode: string;
  deadline: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function BudgetSendClientDialog(props: BudgetSendClientDialogProps) {
  const {
    open, onOpenChange, campaignId, campaignName, agencyName, clientName, clientEmail,
    suppliers, supplierPartialTotals, bestSupplier, budgetAmount,
    pieces, kits, kitPieces, qtyMap, stores, pieceTotals, prices, extraCosts,
    currencyCode, deadline,
  } = props;

  const [email, setEmail] = useState("");
  const [cc, setCc] = useState("");
  const [includeComparative, setIncludeComparative] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [stageMessage, setStageMessage] = useState<string>("");
  const [summary, setSummary] = useState<SendSummaryItem[]>([]);

  useEffect(() => {
    if (open) {
      setEmail(clientEmail || "");
      setCc("");
      setIncludeComparative(true);
      setSummary([]);
    }
  }, [open, clientEmail]);

  const submittedSuppliers = useMemo(
    () => suppliers.filter((s) => s.status === "enviado"),
    [suppliers],
  );

  const fmt = (v: number | null | undefined) =>
    v == null ? "—" : formatCurrencyByCode(v, currencyCode);

  // Build a single supplier's xlsx blob
  const buildOneSupplier = async (sup: any): Promise<{ blob: Blob; fileName: string }> => {
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
          ...kpList.map((kp) => Math.floor((pieceTotals[kp.piece_id] || 0) / (kp.quantity || 1))),
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

    return buildSupplierBudgetWorkbook({
      campaignName,
      agencyName,
      clientName,
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
        stores: stores as any,
        qtyMap,
      },
    });
  };

  // Build comparative spreadsheet (no photos, prices side-by-side)
  const buildComparativeWorkbook = async (): Promise<{ blob: Blob; fileName: string }> => {
    const ExcelJSModule = await import("exceljs");
    const ExcelJS = ExcelJSModule.default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "ProduzAI";
    wb.created = new Date();

    const BROWN = "FF8C6F4E";
    const BEIGE = "FFF7F3EC";
    const WHITE = "FFFFFFFF";
    const DARK = "FF1C1916";
    const BORDER = "FFE5E7EB";
    const GREEN = "FFD1FAE5";
    const RED = "FFFEE2E2";

    const moneyFormatStr = (() => {
      if (currencyCode === "USD") return '"US$" #,##0.00;[Red]-"US$" #,##0.00;-';
      if (currencyCode === "CLP") return '"CLP$" #,##0;[Red]-"CLP$" #,##0;-';
      if (currencyCode === "EUR") return '"€" #,##0.00;[Red]-"€" #,##0.00;-';
      return '"R$" #,##0.00;[Red]-"R$" #,##0.00;-';
    })();

    const ws = wb.addWorksheet("Comparativo de Preços", { views: [{ showGridLines: false }] });
    const supCount = submittedSuppliers.length;
    const totalCols = 2 + supCount + 1; // Código, Item, sup1..supN, Diferença

    // Title rows
    ws.mergeCells(1, 1, 1, totalCols);
    const t1 = ws.getCell(1, 1);
    t1.value = [agencyName, clientName].filter(Boolean).join(" | ") || "ProduzAI";
    t1.font = { name: "Arial", size: 10, color: { argb: WHITE } };
    t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
    t1.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 20;

    ws.mergeCells(2, 1, 2, totalCols);
    const t2 = ws.getCell(2, 1);
    t2.value = `${(campaignName || "").toUpperCase()} — COMPARATIVO DE PREÇOS`;
    t2.font = { name: "Arial", size: 13, bold: true, color: { argb: WHITE } };
    t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
    t2.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 24;

    ws.getRow(3).height = 6;

    // Header row
    const headerRowIdx = 4;
    const headerRow = ws.getRow(headerRowIdx);
    const headerVals: any[] = ["Código", "Item / Especificação"];
    submittedSuppliers.forEach((s) => headerVals.push(s.company_name));
    headerVals.push("Diferença (max-min)");
    headerRow.values = headerVals;
    headerRow.height = 32;
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true, color: { argb: WHITE } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: BORDER } },
        bottom: { style: "thin", color: { argb: BORDER } },
        left: { style: "thin", color: { argb: BORDER } },
        right: { style: "thin", color: { argb: BORDER } },
      };
    });

    // Build merged list (pieces + kits) — same logic as the Orçamento tab,
    // so the comparative shows ALL pieces and kits from the campaign.
    type Merged =
      | { type: "piece"; data: typeof pieces[number] }
      | { type: "kit"; data: typeof kits[number] };
    const merged: Merged[] = [
      ...pieces.filter((p) => !p.kit_only).map((p) => ({ type: "piece" as const, data: p })),
      ...kits.map((k) => ({ type: "kit" as const, data: k })),
    ];
    merged.sort((a, b) => (a.data.display_order ?? 0) - (b.data.display_order ?? 0));

    const supplierTotals: number[] = submittedSuppliers.map(() => 0);
    let evenIdx = 0;

    merged.forEach((item) => {
      if (item.type === "kit") {
        const kit = item.data;
        const kpList = kitPieces.filter((kp) => kp.kit_id === kit.id);
        if (kpList.length === 0) return;
        const kitTotalQty = Math.min(
          ...kpList.map((kp) => Math.floor((pieceTotals[kp.piece_id] || 0) / (kp.quantity || 1))),
        );

        // Kit header row (no prices on header itself)
        const headerVals: any[] = [kit.code, `Kit: ${kit.name}`];
        submittedSuppliers.forEach(() => headerVals.push(null));
        headerVals.push(null);
        const hRow = ws.addRow(headerVals);
        hRow.eachCell({ includeEmpty: true }, (cell, col) => {
          cell.font = { bold: true };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE3D4" } };
          cell.alignment = {
            vertical: "middle",
            horizontal: col >= 3 ? "right" : col === 1 ? "center" : "left",
            wrapText: true,
          };
          cell.border = {
            top: { style: "thin", color: { argb: BORDER } },
            bottom: { style: "thin", color: { argb: BORDER } },
            left: { style: "thin", color: { argb: BORDER } },
            right: { style: "thin", color: { argb: BORDER } },
          };
        });

        // Kit pieces
        kpList.forEach((kp) => {
          const piece = pieces.find((p) => p.id === kp.piece_id);
          if (!piece) return;
          const qty = kitTotalQty * kp.quantity;
          renderRow(piece, qty, supplierTotals, evenIdx, true);
          evenIdx++;
        });
      } else {
        const piece = item.data;
        const qty = pieceTotals[piece.id] || 0;
        renderRow(piece, qty, supplierTotals, evenIdx, false);
        evenIdx++;
      }
    });

    function renderRow(
      piece: typeof pieces[number],
      qty: number,
      totalsAcc: number[],
      idx: number,
      isKitChild: boolean,
    ) {
      const supPrices = submittedSuppliers.map((s) => {
        const pr = prices.find((x) => x.supplier_id === s.id && x.piece_id === piece.id);
        return pr && pr.unit_price != null ? Number(pr.unit_price) : null;
      });
      const numericPrices = supPrices.filter((v): v is number => v != null && v > 0);
      const minP = numericPrices.length ? Math.min(...numericPrices) : null;
      const maxP = numericPrices.length ? Math.max(...numericPrices) : null;
      const diff = minP != null && maxP != null ? maxP - minP : null;

      const itemLabel = [piece.name, (piece as any).specification, (piece as any).size]
        .filter(Boolean)
        .join(" — ");
      const rowVals: any[] = [piece.code, isKitChild ? `   ↳ ${itemLabel}` : itemLabel];
      supPrices.forEach((p) => rowVals.push(p));
      rowVals.push(diff);
      const row = ws.addRow(rowVals);
      const bg = idx % 2 === 0 ? WHITE : BEIGE;
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.alignment = {
          vertical: "middle",
          horizontal: col >= 3 ? "right" : col === 1 ? "center" : "left",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin", color: { argb: BORDER } },
          bottom: { style: "thin", color: { argb: BORDER } },
          left: { style: "thin", color: { argb: BORDER } },
          right: { style: "thin", color: { argb: BORDER } },
        };
        if (col >= 3) cell.numFmt = moneyFormatStr;
      });

      if (minP != null && maxP != null && minP !== maxP) {
        supPrices.forEach((p, i) => {
          if (p == null) return;
          const cell = row.getCell(3 + i);
          if (p === minP) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
          else if (p === maxP) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED } };
        });
      }

      supPrices.forEach((p, i) => {
        if (p != null) totalsAcc[i] += p * qty;
      });
    }

    // Totals row (items)
    ws.addRow([]);
    const totalRowVals: any[] = ["", "Total dos Itens"];
    supplierTotals.forEach((t) => totalRowVals.push(t));
    totalRowVals.push(null);
    const totalRow = ws.addRow(totalRowVals);
    totalRow.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { bold: true };
      cell.alignment = { vertical: "middle", horizontal: col >= 3 ? "right" : "right" };
      if (col >= 3 && col <= 2 + supCount) cell.numFmt = moneyFormatStr;
    });

    // Installation row
    const instalVals: any[] = ["", "Instalação"];
    submittedSuppliers.forEach((s) => {
      const ec = extraCosts.find((e) => e.supplier_id === s.id);
      instalVals.push(ec?.installation_value != null ? Number(ec.installation_value) : 0);
    });
    instalVals.push(null);
    const instalRow = ws.addRow(instalVals);
    instalRow.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.alignment = { vertical: "middle", horizontal: "right" };
      if (col >= 3 && col <= 2 + supCount) cell.numFmt = moneyFormatStr;
    });

    // Freight row
    const freightVals: any[] = ["", "Frete / Despacho"];
    submittedSuppliers.forEach((s) => {
      const ec = extraCosts.find((e) => e.supplier_id === s.id);
      freightVals.push(ec?.freight_value != null ? Number(ec.freight_value) : 0);
    });
    freightVals.push(null);
    const freightRow = ws.addRow(freightVals);
    freightRow.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.alignment = { vertical: "middle", horizontal: "right" };
      if (col >= 3 && col <= 2 + supCount) cell.numFmt = moneyFormatStr;
    });

    // Grand total row
    const grandVals: any[] = ["", "TOTAL GERAL"];
    submittedSuppliers.forEach((s, i) => {
      const partial = supplierPartialTotals[s.id];
      grandVals.push(partial?.total ?? supplierTotals[i]);
    });
    grandVals.push(null);
    const grandRow = ws.addRow(grandVals);
    grandRow.height = 24;
    grandRow.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { bold: true, color: { argb: WHITE } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
      cell.alignment = { vertical: "middle", horizontal: col >= 3 ? "right" : "right" };
      if (col >= 3 && col <= 2 + supCount) cell.numFmt = moneyFormatStr;
    });

    // Column widths
    const cols: any[] = [
      { width: 12 },
      { width: 50 },
    ];
    submittedSuppliers.forEach(() => cols.push({ width: 18 }));
    cols.push({ width: 18 });
    ws.columns = cols;
    ws.views = [{ state: "frozen", ySplit: headerRowIdx, xSplit: 2 }];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: XLSX_MIME });
    const firstName = (s?: string) =>
      (s || "").trim().split(/\s+/)[0]?.replace(/[^a-zA-Z0-9À-ÿ_-]/g, "") || "";
    const sanitizeCamp = (s?: string) =>
      (s || "").trim().replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, "").replace(/\s+/g, "_").slice(0, 40);
    const today = new Date()
      .toLocaleDateString("pt-BR", { year: "numeric", month: "2-digit", day: "2-digit" })
      .replace(/\//g, "-");
    const nameParts = [
      "Comparativo",
      sanitizeCamp(campaignName),
      firstName(clientName),
      firstName(agencyName),
      today,
    ].filter(Boolean);
    const fileName = `${nameParts.join("_")}.xlsx`;
    return { blob, fileName };
  };

  const uploadAndSign = (
    blob: Blob,
    fileName: string,
    supplierIdOrTag: string,
  ) => sharedUploadAndSign(blob, fileName, supplierIdOrTag, campaignId, setUploadStatus);

  const sendOnce = async (recipient: string, templateData: any) => {
    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "budget-results-to-client",
        recipientEmail: recipient,
        idempotencyKey: `budget-results-${campaignId}-${recipient}-${Date.now()}`,
        templateData,
      },
    });
    if (error) throw new Error(error.message || "Erro ao enviar e-mail");
  };

  const handleSend = async () => {
    if (!EMAIL_REGEX.test(email.trim())) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    const ccEmail = cc.trim();
    if (ccEmail && !EMAIL_REGEX.test(ccEmail)) {
      toast.error("E-mail do CC é inválido.");
      return;
    }
    if (submittedSuppliers.length === 0) {
      toast.error("Nenhum fornecedor enviou o orçamento ainda.");
      return;
    }

    setSending(true);
    setUploadStatus(null);
    setStageMessage("Iniciando geração das planilhas...");
    const toastId = toast.loading("Gerando planilhas e enviando...", {
      description: "Isso pode levar alguns segundos.",
    });

    try {
      const downloadUrls: { name: string; url: string }[] = [];
      const totalFiles = submittedSuppliers.length + (includeComparative && submittedSuppliers.length >= 1 ? 1 : 0);
      let fileIndex = 0;

      for (const sup of submittedSuppliers) {
        fileIndex += 1;
        setStageMessage(`Gerando planilha ${fileIndex}/${totalFiles} — ${sup.company_name}`);
        const { blob, fileName } = await buildOneSupplier(sup);
        const link = await uploadAndSign(blob, fileName, sup.id);
        downloadUrls.push(link);
      }

      if (includeComparative && submittedSuppliers.length >= 1) {
        fileIndex += 1;
        setStageMessage(`Gerando planilha ${fileIndex}/${totalFiles} — Comparativo`);
        const { blob, fileName } = await buildComparativeWorkbook();
        const link = await uploadAndSign(blob, fileName, "comparativo");
        downloadUrls.push(link);
      }

      setStageMessage("Enviando e-mail...");

      // Build templateData
      const difference = bestSupplier && budgetAmount != null ? bestSupplier.total - budgetAmount : null;
      const templateData = {
        clientName: clientName || "Cliente",
        agencyName,
        campaignName,
        bestSupplier: bestSupplier
          ? { name: bestSupplier.name, total: bestSupplier.total, totalFormatted: fmt(bestSupplier.total) }
          : null,
        budgetAmount,
        budgetAmountFormatted: budgetAmount != null ? fmt(budgetAmount) : null,
        difference,
        differenceFormatted: difference != null ? fmt(difference) : null,
        suppliers: submittedSuppliers.map((s) => {
          const partial = supplierPartialTotals[s.id] || { total: 0, installation: 0, freight: 0 };
          const submittedAtRaw = s.submitted_at ?? s.updated_at ?? s.created_at ?? null;
          const submittedAt = submittedAtRaw
            ? format(new Date(submittedAtRaw), "dd/MM/yyyy HH:mm", { locale: ptBR })
            : null;
          return {
            name: s.company_name,
            status: s.status,
            totalFormatted: fmt(partial.total),
            installationFormatted: fmt(partial.installation),
            freightFormatted: fmt(partial.freight),
            submittedAt,
          };
        }),
        deadline,
        currencyCode,
        downloadUrls,
      };

      await sendOnce(email.trim(), templateData);
      if (ccEmail) {
        await sendOnce(ccEmail, templateData);
      }

      toast.dismiss(toastId);
      toast.success("Relatório enviado com sucesso!");
      onOpenChange(false);
    } catch (e: any) {
      console.error("Send budget results error:", e);
      toast.dismiss(toastId);
      toast.error(e?.message || "Erro ao enviar o relatório.");
    } finally {
      setSending(false);
      setUploadStatus(null);
      setStageMessage("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar Resultado da Cotação ao Cliente</DialogTitle>
          <DialogDescription>
            O e-mail será enviado com os resultados e links para download das planilhas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="recipient-email">E-mail do destinatário *</Label>
            <Input
              id="recipient-email"
              type="email"
              placeholder="cliente@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cc-email">CC (opcional)</Label>
            <Input
              id="cc-email"
              type="email"
              placeholder="copia@empresa.com"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="include-comparative"
              checked={includeComparative}
              onCheckedChange={(v) => setIncludeComparative(Boolean(v))}
              disabled={sending}
            />
            <Label htmlFor="include-comparative" className="text-sm cursor-pointer">
              Incluir planilha comparativa de preços
            </Label>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Planilhas que serão geradas ({submittedSuppliers.length}{includeComparative ? " + comparativo" : ""}):
            </Label>
            {submittedSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Nenhum fornecedor enviou o orçamento ainda.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {submittedSuppliers.map((s) => (
                  <Badge key={s.id} variant="secondary" className="text-xs">
                    {s.company_name}
                  </Badge>
                ))}
                {includeComparative && (
                  <Badge variant="outline" className="text-xs">
                    Comparativo
                  </Badge>
                )}
              </div>
            )}
          </div>

          {sending && (
            <div className="space-y-2">
              {stageMessage && (
                <div className="text-xs text-muted-foreground">{stageMessage}</div>
              )}
              <UploadProgressPanel status={uploadStatus} />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            <X className="w-4 h-4 mr-1" /> Cancelar
          </Button>
          <Button onClick={handleSend} disabled={sending || submittedSuppliers.length === 0}>
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-1" /> Enviar Relatório
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
