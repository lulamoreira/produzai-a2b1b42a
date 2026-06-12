import React, { useEffect, useMemo, useState } from "react";
import { Send, Loader2, X, ArrowLeft, Copy } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR, es } from "date-fns/locale";
import { getLocaleFromCurrency } from "@/utils/currencyLocale";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { mergeRecipients, parseRecipients } from "@/lib/emailRecipients";
import EmailRecipientsInput from "@/components/Email/EmailRecipientsInput";
import { useClientEmailMemory } from "@/hooks/useClientEmailMemory";

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
  stores: any[];
  pieceTotals: { map: Record<string, number>; installationMap: Record<string, number>; freightMap: Record<string, number>; noLogisticsMap: Record<string, number> };
  prices: any[];
  extraCosts: any[];
  currencyCode: string;
  deadline: string | null;
}



export default function BudgetSendClientDialog(props: BudgetSendClientDialogProps) {
  const {
    open, onOpenChange, campaignId, campaignName, agencyName, clientId, clientName, clientEmail,
    suppliers, supplierPartialTotals, bestSupplier, budgetAmount,
    pieces, kits, kitPieces, qtyMap, stores, pieceTotals, prices, extraCosts,
    currencyCode, deadline,
  } = props;

  const [email, setEmail] = useState("");
  const [cc, setCc] = useState("");
  const { suggestions: emailSuggestions, record: recordEmails } = useClientEmailMemory({ clientId });
  const [includeComparative, setIncludeComparative] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [stageMessage, setStageMessage] = useState<string>("");

  // Preview state
  const [step, setStep] = useState<"form" | "preview">("form");
  const [previewSubject, setPreviewSubject] = useState("");
  const [openingMessage, setOpeningMessage] = useState("");
  const [downloadUrls, setDownloadUrls] = useState<{ name: string; url: string }[]>([]);

  useEffect(() => {
    if (open) {
      setEmail(clientEmail || "");
      setCc("");
      setIncludeComparative(true);
      setStep("form");
      setPreviewSubject("");
      setOpeningMessage("");
      setDownloadUrls([]);
    }
  }, [open, clientEmail]);

  const submittedSuppliers = useMemo(
    () => suppliers.filter((s) => s.status === "enviado"),
    [suppliers],
  );

  const declinedSuppliers = useMemo(
    () => suppliers.filter((s) => s.status === "declinado"),
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
          ...kpList.map((kp) => Math.floor((pieceTotals.map[kp.piece_id] || 0) / (kp.quantity || 1))),
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
        const qty = pieceTotals.map[p.id] || 0;
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

    // Build merged list (pieces + kits) — same logic as the Cotações tab,
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
          ...kpList.map((kp) => Math.floor((pieceTotals.map[kp.piece_id] || 0) / (kp.quantity || 1))),
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
        const qty = pieceTotals.map[piece.id] || 0;
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

  const handleGenerateAndPreview = async () => {
    const merged = mergeRecipients(email, cc);
    if (merged.invalid.length) {
      toast.error(`E-mail(s) inválido(s): ${merged.invalid.join(", ")}`);
      return;
    }
    if (merged.valid.length === 0) {
      toast.error("Informe pelo menos um e-mail válido.");
      return;
    }
    if (submittedSuppliers.length === 0) {
      toast.error("Nenhum fornecedor enviou a cotação ainda.");
      return;
    }

    setSending(true);
    setUploadStatus(null);
    setStageMessage("Iniciando geração das planilhas...");

    const toastId = toast.loading("Gerando planilhas...", {
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

      // Build subject + opening message (plain text editable by user)
      const subject = `Resultado da Cotação — ${campaignName} (${clientName || "Cliente"})`;
      const opening = `Segue o resultado da cotação da campanha "${campaignName}"${clientName ? ` — ${clientName}` : ""}.`;

      setPreviewSubject(subject);
      setOpeningMessage(opening);
      setDownloadUrls(downloadUrls);
      setStep("preview");

      toast.dismiss(toastId);
      toast.success("Planilhas geradas. Revise o e-mail antes de enviar.");
    } catch (e: any) {
      console.error("Generate budget results error:", e);
      toast.dismiss(toastId);
      toast.error(e?.message || "Erro ao gerar as planilhas.");
    } finally {
      setSending(false);
      setUploadStatus(null);
      setStageMessage("");
    }
  };

  const escapeHtml = (s: string) =>
    (s || "").replace(/[&<>"']/g, (c) =>
      c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
    );

  const dateLocale = getLocaleFromCurrency(currencyCode) === "es-CL" ? es : ptBR;

  const buildEmailHtml = (): string => {
    const BRAND = "#8C6F4E";
    const DARK = "#1C1916";
    const BEIGE = "#f9f7f5";
    const CREAM = "#fef9f0";
    const BORDER = "#e5d8c8";
    const ESPRESSO = "#3F2E1E";
    const GREEN = "#2e7d32";
    const RED = "#c62828";

    const opening = escapeHtml(openingMessage).replace(/\n/g, "<br/>");
    const greetName = (clientName || "").trim();
    const greeting = greetName ? `Olá, ${escapeHtml(greetName)}!` : "Olá!";

    // Header bands + campaign / client title
    const header = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr><td style="background:${DARK};padding:14px 24px;text-align:center;color:#fff;font:bold 14px 'Segoe UI',Arial,sans-serif;letter-spacing:0.5px;">${escapeHtml(agencyName || "ProduzAI")}</td></tr>
        <tr><td style="background:${BRAND};padding:14px 24px;text-align:center;color:#fff;font:bold 16px 'Segoe UI',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">Resultado da Cotação</td></tr>
        <tr><td style="padding:22px 24px 6px;text-align:center;">
          <div style="font:bold 22px 'Segoe UI',Arial,sans-serif;color:${DARK};margin:0 0 4px;">${escapeHtml(campaignName || "")}</div>
          ${greetName ? `<div style="font:14px 'Segoe UI',Arial,sans-serif;color:#6b5937;margin:0;">Preparado para <strong>${escapeHtml(greetName)}</strong></div>` : ""}
        </td></tr>
      </table>`;

    // KPI cards (3 cells)
    let kpis = "";
    if (bestSupplier || budgetAmount != null) {
      const bestCell = bestSupplier
        ? `<td width="33%" valign="top" style="background:${BEIGE};border:1px solid ${BORDER};border-radius:6px;padding:14px 12px;text-align:center;">
            <div style="font:bold 11px 'Segoe UI',Arial,sans-serif;color:#6b5937;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;">Melhor Proposta</div>
            <div style="font:bold 18px 'Segoe UI',Arial,sans-serif;color:${DARK};margin:0;">${escapeHtml(fmt(bestSupplier.total))}</div>
            <div style="font:11px 'Segoe UI',Arial,sans-serif;color:#666;margin:4px 0 0;">${escapeHtml(bestSupplier.name)}</div>
          </td>`
        : `<td width="33%" style="background:${BEIGE};border:1px solid ${BORDER};border-radius:6px;padding:14px 12px;text-align:center;color:#999;">—</td>`;
      const budgetCell = `<td width="33%" valign="top" style="background:${CREAM};border:1px solid ${BORDER};border-radius:6px;padding:14px 12px;text-align:center;">
        <div style="font:bold 11px 'Segoe UI',Arial,sans-serif;color:#6b5937;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;">Verba Prevista</div>
        <div style="font:bold 18px 'Segoe UI',Arial,sans-serif;color:${DARK};margin:0;">${budgetAmount != null ? escapeHtml(fmt(budgetAmount)) : "Não definida"}</div>
      </td>`;
      let diffCell = `<td width="33%" valign="top" style="background:${BEIGE};border:1px solid ${BORDER};border-radius:6px;padding:14px 12px;text-align:center;">
        <div style="font:bold 11px 'Segoe UI',Arial,sans-serif;color:#6b5937;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;">Diferença</div>
        <div style="font:bold 18px 'Segoe UI',Arial,sans-serif;color:#999;margin:0;">—</div>
      </td>`;
      if (bestSupplier && budgetAmount != null) {
        const diff = bestSupplier.total - budgetAmount;
        const color = diff > 0 ? RED : GREEN;
        const sign = diff > 0 ? "+" : "";
        diffCell = `<td width="33%" valign="top" style="background:${BEIGE};border:1px solid ${BORDER};border-radius:6px;padding:14px 12px;text-align:center;">
          <div style="font:bold 11px 'Segoe UI',Arial,sans-serif;color:#6b5937;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;">Diferença</div>
          <div style="font:bold 18px 'Segoe UI',Arial,sans-serif;color:${color};margin:0;">${sign}${escapeHtml(fmt(diff))}</div>
        </td>`;
      }
      kpis = `<table role="presentation" cellpadding="0" cellspacing="8" border="0" width="100%" style="border-collapse:separate;margin:8px 0 4px;"><tr>${bestCell}${budgetCell}${diffCell}</tr></table>`;
    }

    // Suppliers table
    const winnerName = bestSupplier?.name || "";
    const supplierRows = submittedSuppliers
      .map((s, i) => {
        const partial = supplierPartialTotals[s.id] || { total: 0, installation: 0, freight: 0 };
        const isWinner = s.company_name === winnerName;
        const bg = isWinner ? ESPRESSO : i % 2 === 0 ? "#ffffff" : BEIGE;
        const color = isWinner ? "#ffffff" : "#333";
        const weight = isWinner ? "bold" : "normal";
        const td = `padding:8px;border:1px solid #e5e5e5;color:${color};font-weight:${weight};`;
        const tdR = `${td}text-align:right;`;
        return `<tr style="background:${bg};">
          <td style="${td}">${isWinner ? "🏆 " : ""}${escapeHtml(s.company_name)}</td>
          <td style="${tdR}">${escapeHtml(fmt(partial.total))}</td>
          <td style="${tdR}">${escapeHtml(fmt(partial.installation))}</td>
          <td style="${tdR}">${escapeHtml(fmt(partial.freight))}</td>
        </tr>`;
      })
      .join("");
    const th = `background:${BRAND};color:#fff;font:bold 12px 'Segoe UI',Arial,sans-serif;padding:10px 8px;border:1px solid #d4c2a8;text-align:left;`;
    const thR = `${th}text-align:right;`;
    const suppliersBlock = supplierRows
      ? `<h3 style="font:bold 16px 'Segoe UI',Arial,sans-serif;color:${DARK};margin:24px 0 12px;">Fornecedores Participantes</h3>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid #e5e5e5;font-family:'Segoe UI',Arial,sans-serif;">
          <thead><tr>
            <th style="${th}">Fornecedor</th>
            <th style="${thR}">Total</th>
            <th style="${thR}">Instalação</th>
            <th style="${thR}">Frete</th>
          </tr></thead>
          <tbody>${supplierRows}</tbody>
        </table>`
      : "";

    // Declined block — boxed with brand left border
    const declinedBlock = declinedSuppliers.length
      ? `<h3 style="font:bold 16px 'Segoe UI',Arial,sans-serif;color:${DARK};margin:24px 0 12px;">Fornecedores que não participaram</h3>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 16px;">
          <tr><td style="background:${CREAM};border-left:4px solid ${BRAND};padding:14px 18px;font:13px 'Segoe UI',Arial,sans-serif;color:#444;">
            ${declinedSuppliers
              .map((s: any) => {
                const declinedAt = s.declined_at
                  ? format(new Date(s.declined_at), "dd/MM/yyyy", { locale: dateLocale })
                  : "—";
                const reason = (s.decline_reason && String(s.decline_reason).trim()) || "Motivo não informado";
                return `<div style="margin:0 0 6px;"><strong style="color:${DARK};">${escapeHtml(s.company_name)}</strong> <em style="color:#777;">— ${escapeHtml(declinedAt)} — ${escapeHtml(reason)}</em></div>`;
              })
              .join("")}
          </td></tr>
        </table>`
      : "";

    // Downloads as button-links
    const downloadsBlock = downloadUrls.length
      ? `<h3 style="font:bold 16px 'Segoe UI',Arial,sans-serif;color:${DARK};margin:24px 0 12px;">Planilhas para Download</h3>
        <div>${downloadUrls
          .map((d, i) => {
            const isComp = /comparativo/i.test(d.name);
            let label = "";
            if (isComp) {
              label = `${i + 1} · Comparativo de Preços`;
            } else {
              const fornecedor = d.name
                .replace(/\.xlsx$/i, "")
                .replace(/^or[çc]amento\s*[-—]\s*/i, "")
                .replace(/^cota[çc][aã]o\s*[-—]\s*/i, "");
              label = `${i + 1} · Cotação — ${fornecedor}`;
            }
            return `<a href="${escapeHtml(d.url)}" style="background:${BRAND};color:#fff;padding:10px 20px;border-radius:6px;display:inline-block;margin:4px;font:bold 13px 'Segoe UI',Arial,sans-serif;text-decoration:none;">📥 ${escapeHtml(label)}</a>`;
          })
          .join("")}</div>
        <p style="font:12px 'Segoe UI',Arial,sans-serif;color:#777;margin:8px 0 0;">Os links de download ficam ativos por 30 dias.</p>`
      : "";

    const body = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr><td style="padding:18px 24px 8px;font-family:'Segoe UI',Arial,sans-serif;color:${DARK};font-size:14px;line-height:1.6;">
          <p style="margin:0 0 12px;font-weight:bold;">${greeting}</p>
          <p style="margin:0 0 12px;">${opening}</p>
          ${kpis}
          ${suppliersBlock}
          ${declinedBlock}
          ${downloadsBlock}
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0 14px;" />
          <p style="margin:0 0 6px;font-size:13px;color:#555;">Qualquer dúvida, é só responder este e-mail.</p>
          <p style="margin:0;font-weight:bold;color:${BRAND};">${escapeHtml(agencyName || "")}</p>
        </td></tr>
      </table>`;

    return `<div style="background:#ffffff;">${header}${body}</div>`;
  };

  const buildEmailPlainText = (): string => {
    const lines: string[] = [];
    lines.push(`Olá,`, "", openingMessage, "");
    if (bestSupplier) {
      lines.push(`Melhor fornecedor: ${bestSupplier.name} — Total ${fmt(bestSupplier.total)}`);
      if (budgetAmount != null) {
        const diff = bestSupplier.total - budgetAmount;
        const sign = diff > 0 ? "+" : "";
        lines.push(`Verba prevista: ${fmt(budgetAmount)} | Diferença: ${sign}${fmt(diff)}`);
      }
      lines.push("");
    }
    lines.push("Fornecedores participantes:");
    submittedSuppliers.forEach((s) => {
      const partial = supplierPartialTotals[s.id] || { total: 0, installation: 0, freight: 0 };
      lines.push(`• ${s.company_name} — Total: ${fmt(partial.total)} (Instalação: ${fmt(partial.installation)} | Frete: ${fmt(partial.freight)})`);
    });
    if (declinedSuppliers.length > 0) {
      lines.push("", "Fornecedores que não participaram:");
      declinedSuppliers.forEach((s: any) => {
        const declinedAt = s.declined_at
          ? format(new Date(s.declined_at), "dd/MM/yyyy", { locale: dateLocale })
          : "—";
        const reason = (s.decline_reason && String(s.decline_reason).trim()) || "Motivo não informado";
        lines.push(`• ${s.company_name} — Desistiu em ${declinedAt} — Motivo: ${reason}`);
      });
    }
    lines.push("", "Planilhas para download:");
    downloadUrls.forEach((u, i) => lines.push(`${i + 1}. ${u.name}: ${u.url}`));
    lines.push("", "Qualquer dúvida, é só responder este e-mail.", "", agencyName || "");
    return lines.join("\n");
  };

  const emailHtml = useMemo(
    () => (step === "preview" ? buildEmailHtml() : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, openingMessage, downloadUrls, submittedSuppliers, declinedSuppliers, bestSupplier, budgetAmount, agencyName, clientName, campaignName],
  );

  const buildMailtoUrl = () => {
    const merged = mergeRecipients(email, cc);
    const toEmails = parseRecipients(email);
    const ccEmails = merged.valid.filter((e) => !toEmails.includes(e));
    const params = new URLSearchParams();
    if (ccEmails.length) params.set("cc", ccEmails.join(","));
    params.set("subject", previewSubject);
    const query = params.toString().replace(/\+/g, "%20");
    return `mailto:${toEmails.join(",")}?${query}`;
  };

  const copyRichBody = async () => {
    const html = buildEmailHtml();
    const plain = buildEmailPlainText();
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
    } else {
      await navigator.clipboard.writeText(plain);
    }
  };

  const handleOpenMail = async () => {
    try {
      await copyRichBody();
    } catch (e) {
      console.warn("Rich clipboard copy failed", e);
    }
    const merged = mergeRecipients(email, cc);
    recordEmails(merged.valid);
    const url = buildMailtoUrl();
    try {
      window.open(url, "_self");
    } catch {
      window.location.href = url;
    }
    toast.success(
      "Rascunho aberto! Clique no corpo do e-mail e cole com Cmd+V para inserir o conteúdo formatado.",
      { duration: 6000, closeButton: true },
    );

    // Log activity (fire-and-forget)
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { user } } = await supabase.auth.getUser();
      let actorName: string | null = null;
      if (user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();
        actorName = prof?.display_name || user.email || null;
      }
      const toList = parseRecipients(email).valid.join(", ");
      const ccList = parseRecipients(cc).valid.join(", ");
      await supabase.from("campaign_activity_log").insert({
        campaign_id: campaignId,
        user_id: user?.id || null,
        actor_name: actorName,
        actor_type: "user",
        action: "resultado_cotacao_enviado",
        description: `Resultado da cotação enviado ao cliente — destinatários: ${toList}${ccList ? `; cc: ${ccList}` : ""}`,
        metadata: {
          to: parseRecipients(email).valid,
          cc: parseRecipients(cc).valid,
          assunto: previewSubject,
          planilhas: downloadUrls.map((d) => d.name),
        },
      });
    } catch (err) {
      console.warn("Failed to log resultado_cotacao_enviado", err);
    }

    setTimeout(() => {
      onOpenChange(false);
      setStep("form");
    }, 1500);
  };

  const handleCopyBody = async () => {
    try {
      await copyRichBody();
      toast.success("Corpo formatado copiado. Cole no seu e-mail com Cmd+V.");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enviar Resultado da Cotação ao Cliente</DialogTitle>
          <DialogDescription>
            {step === "form"
              ? "Gere as planilhas e revise o e-mail antes de abrir no seu cliente de e-mail."
              : "Revise (e edite, se quiser) o conteúdo antes de abrir no seu e-mail."}
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="recipient-email">E-mail(s) do destinatário *</Label>
              <EmailRecipientsInput
                id="recipient-email"
                placeholder="cliente1@empresa.com, cliente2@empresa.com"
                value={email}
                onChange={setEmail}
                suggestions={emailSuggestions}
                disabled={sending}
              />
              <p className="text-[11px] text-muted-foreground">Separe múltiplos e-mails por vírgula ou ponto e vírgula.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cc-email">CC (opcional)</Label>
              <EmailRecipientsInput
                id="cc-email"
                placeholder="copia1@empresa.com, copia2@empresa.com"
                value={cc}
                onChange={setCc}
                suggestions={emailSuggestions}
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
                  Nenhum fornecedor enviou a cotação ainda.
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
              {declinedSuppliers.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {declinedSuppliers.length} fornecedor(es) que desistiram serão listados no corpo do e-mail.
                </p>
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
        )}

        {step === "preview" && (
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Para</Label>
              <Input value={parseRecipients(email).join(", ")} readOnly className="text-sm" />
            </div>
            {parseRecipients(cc).length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">CC</Label>
                <Input value={parseRecipients(cc).join(", ")} readOnly className="text-sm" />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Assunto</Label>
              <Input
                value={previewSubject}
                onChange={(e) => setPreviewSubject(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mensagem de abertura (editável)</Label>
              <Textarea
                value={openingMessage}
                onChange={(e) => setOpeningMessage(e.target.value)}
                className="min-h-[80px] text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Pré-visualização do e-mail</Label>
              <div
                className="border rounded-md p-3 bg-white overflow-auto"
                style={{ maxHeight: 400 }}
                dangerouslySetInnerHTML={{ __html: emailHtml }}
              />
            </div>

          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step === "form" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
              <Button
                onClick={handleGenerateAndPreview}
                disabled={sending || submittedSuppliers.length === 0}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Gerando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1" /> Gerar e Visualizar
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("form")}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button variant="secondary" onClick={handleCopyBody}>
                <Copy className="w-4 h-4 mr-1" /> Copiar Corpo Formatado
              </Button>
              <Button onClick={handleOpenMail}>
                <Send className="w-4 h-4 mr-1" /> Abrir no Meu E-mail
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
