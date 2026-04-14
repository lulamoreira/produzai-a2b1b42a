import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ── Brand / Color constants ── */
const BRAND = "8C6F4E";
const BRAND_RGB: [number, number, number] = [140, 111, 78];
const LIGHT_BG = "F5F0EB";
const LIGHT_BG_RGB: [number, number, number] = [245, 240, 235];
const WHITE = "FFFFFF";
const RED = "DC2626";
const ORANGE = "F97316";
const YELLOW = "EAB308";
const GREEN = "22C55E";
const GRAY = "6B7280";

/* ── Types ── */
export interface PendingOccurrenceData {
  campaignName: string;
  clientName: string;
  agencyName: string;
  occurrences: {
    id: string;
    store_id: string | null;
    motive_id: string | null;
    description: string | null;
    status: string | null;
    priority: string;
    created_at: string | null;
    expected_resolution_date: string | null;
    reporter_name: string | null;
    reporter_type: string;
  }[];
  stores: { id: string; name: string; city: string | null; state: string | null }[];
  motives: { id: string; description: string }[];
  statuses: { value: string; label: string; color: string }[];
}

/* ── Helpers ── */
function storeMap(stores: PendingOccurrenceData["stores"]) {
  const m: Record<string, (typeof stores)[0]> = {};
  stores.forEach((s) => { m[s.id] = s; });
  return m;
}

function motiveMap(motives: PendingOccurrenceData["motives"]) {
  const m: Record<string, string> = {};
  motives.forEach((mo) => { m[mo.id] = mo.description; });
  return m;
}

function daysBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const da = new Date(a); const db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

function daysOpenSince(created: string | null | undefined): number | null {
  if (!created) return null;
  return daysBetween(created, new Date().toISOString());
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "";
  return new Date(v).toLocaleDateString("pt-BR");
}

function priorityLabel(p: string) {
  const map: Record<string, string> = { critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa" };
  return map[p] || p;
}
function priorityColor(p: string): string {
  const map: Record<string, string> = { critica: RED, alta: ORANGE, media: YELLOW, baixa: GREEN };
  return map[p] || GRAY;
}
function priorityColorRGB(p: string): [number, number, number] {
  const map: Record<string, [number, number, number]> = {
    critica: [220, 38, 38], alta: [249, 115, 22], media: [234, 179, 8], baixa: [34, 197, 94],
  };
  return map[p] || [107, 114, 128];
}
function statusLabel(value: string | null, statuses: PendingOccurrenceData["statuses"]) {
  if (!value) return "";
  return statuses.find((s) => s.value === value)?.label || value;
}
function statusColor(value: string | null, statuses: PendingOccurrenceData["statuses"]): string {
  if (!value) return GRAY;
  const found = statuses.find((s) => s.value === value);
  return found ? found.color.replace("#", "") : GRAY;
}
function statusColorRGB(value: string | null, statuses: PendingOccurrenceData["statuses"]): [number, number, number] {
  const hex = statusColor(value, statuses);
  return [parseInt(hex.substring(0, 2), 16) || 107, parseInt(hex.substring(2, 4), 16) || 114, parseInt(hex.substring(4, 6), 16) || 128];
}
function sanitize(name: string) { return name.replace(/[\\/*?[\]:]/g, "").slice(0, 31); }

/* ── Excel styles ── */
function headerStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, color: { argb: "FF" + WHITE }, size: 10 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BRAND } },
    alignment: { vertical: "middle", horizontal: "center", wrapText: true },
    border: { bottom: { style: "thin", color: { argb: "FF" + BRAND } } },
  };
}

/* ══════════════════════════════════════════
   EXCEL EXPORT
   ══════════════════════════════════════════ */
export async function exportPendingExcel(data: PendingOccurrenceData) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ProduzAI";
  wb.created = new Date();
  const sm = storeMap(data.stores);
  const mm = motiveMap(data.motives);
  const today = new Date();

  // KPI computation
  const total = data.occurrences.length;
  const byPriority: Record<string, number> = {};
  const byMotive: Record<string, number> = {};
  let totalDaysOpen = 0; let countDaysOpen = 0;
  data.occurrences.forEach((o) => {
    byPriority[o.priority] = (byPriority[o.priority] || 0) + 1;
    if (o.motive_id) {
      const label = mm[o.motive_id] || "Outro";
      byMotive[label] = (byMotive[label] || 0) + 1;
    }
    const d = daysOpenSince(o.created_at);
    if (d !== null) { totalDaysOpen += d; countDaysOpen++; }
  });
  const avgDaysOpen = countDaysOpen > 0 ? Math.round((totalDaysOpen / countDaysOpen) * 10) / 10 : 0;
  const overdue = data.occurrences.filter((o) => o.expected_resolution_date && new Date(o.expected_resolution_date) < today);

  // ─── Sheet 1: Resumo ───
  const wsR = wb.addWorksheet(sanitize("Resumo"));
  wsR.properties.defaultRowHeight = 20;
  wsR.mergeCells("A1:F1");
  const titleCell = wsR.getCell("A1");
  titleCell.value = `${data.agencyName} / ${data.clientName} / ${data.campaignName} — Pendências`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF" + BRAND } };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  wsR.getRow(1).height = 30;

  // KPI boxes
  const kpiDefs = [
    { label: "Total Pendentes", value: total, color: BRAND },
    { label: "Atrasadas", value: overdue.length, color: RED },
    { label: "Média dias em aberto", value: avgDaysOpen, color: ORANGE },
  ];
  kpiDefs.forEach((kpi, i) => {
    const valCell = wsR.getCell(3, i + 1);
    valCell.value = kpi.value;
    valCell.font = { bold: true, size: 12, color: { argb: "FF" + WHITE } };
    valCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + kpi.color } };
    valCell.alignment = { vertical: "middle", horizontal: "center" };
    const lblCell = wsR.getCell(4, i + 1);
    lblCell.value = kpi.label;
    lblCell.font = { size: 9, color: { argb: "FFFFFFFF" } };
    lblCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + kpi.color } };
    lblCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  wsR.getRow(3).height = 32;
  wsR.getRow(4).height = 22;
  for (let c = 1; c <= 6; c++) wsR.getColumn(c).width = 22;

  // Bar simulation: by priority (row 6+)
  wsR.getCell("A6").value = "Por Prioridade";
  wsR.getCell("A6").font = { bold: true, size: 11, color: { argb: "FF" + BRAND } };
  const priEntries: [string, number][] = [["critica", byPriority["critica"] || 0], ["alta", byPriority["alta"] || 0], ["media", byPriority["media"] || 0], ["baixa", byPriority["baixa"] || 0]];
  const maxPri = Math.max(...priEntries.map(([, v]) => v), 1);
  priEntries.forEach(([key, count], i) => {
    const row = wsR.getRow(7 + i);
    row.getCell(1).value = priorityLabel(key);
    const barLen = Math.round((count / maxPri) * 20);
    row.getCell(2).value = "█".repeat(barLen);
    row.getCell(2).font = { color: { argb: "FF" + priorityColor(key) } };
    row.getCell(3).value = count;
  });

  // Bar simulation: by motive (row 12+)
  wsR.getCell("A12").value = "Por Motivo";
  wsR.getCell("A12").font = { bold: true, size: 11, color: { argb: "FF" + BRAND } };
  const motiveEntries = Object.entries(byMotive).sort((a, b) => b[1] - a[1]);
  const maxMot = motiveEntries.length > 0 ? motiveEntries[0][1] : 1;
  motiveEntries.forEach(([label, count], i) => {
    const row = wsR.getRow(13 + i);
    row.getCell(1).value = label;
    const barLen = Math.round((count / maxMot) * 20);
    row.getCell(2).value = "█".repeat(barLen);
    row.getCell(2).font = { color: { argb: "FF" + BRAND } };
    row.getCell(3).value = count;
  });

  // ─── Sheet 2: Pendências ───
  const wsP = wb.addWorksheet(sanitize("Pendências"));
  const headers = ["Loja", "Aberta por", "Data Abertura", "Previsão", "Dias p/ Resolver", "Dias em Aberto", "Prioridade", "Motivo", "Status"];
  const phr = wsP.getRow(1);
  headers.forEach((h, i) => {
    const c = phr.getCell(i + 1);
    c.value = h;
    Object.assign(c, { style: headerStyle() });
  });
  wsP.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];

  data.occurrences.forEach((occ, idx) => {
    const store = occ.store_id ? sm[occ.store_id] : null;
    const dToResolve = daysBetween(occ.created_at, occ.expected_resolution_date);
    const dOpen = daysOpenSince(occ.created_at);
    const row = wsP.getRow(idx + 2);
    const vals = [
      store?.name || "",
      occ.reporter_name || "",
      fmtDate(occ.created_at),
      fmtDate(occ.expected_resolution_date),
      dToResolve ?? "",
      dOpen ?? "",
      priorityLabel(occ.priority),
      occ.motive_id ? mm[occ.motive_id] || "" : "",
      statusLabel(occ.status, data.statuses),
    ];
    vals.forEach((v, ci) => { row.getCell(ci + 1).value = v; });

    // Priority color (col 7)
    row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + priorityColor(occ.priority) } };
    row.getCell(7).font = { color: { argb: "FFFFFFFF" }, bold: true, size: 10 };
    // Status color (col 9)
    const sc = statusColor(occ.status, data.statuses);
    row.getCell(9).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + sc } };
    row.getCell(9).font = { color: { argb: "FFFFFFFF" }, bold: true, size: 10 };
    // Alternating
    if (idx % 2 === 1) {
      for (let c = 1; c <= 9; c++) {
        if (c !== 7 && c !== 9) {
          row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + LIGHT_BG } };
        }
      }
    }
  });
  wsP.autoFilter = { from: "A1", to: `I${data.occurrences.length + 1}` };
  const colWidths = [25, 20, 14, 14, 14, 14, 12, 22, 14];
  colWidths.forEach((w, i) => { wsP.getColumn(i + 1).width = w; });

  // ─── Sheet 3: Atrasadas ───
  const wsA = wb.addWorksheet(sanitize("Atrasadas"));
  const aHeaders = ["Loja", "Aberta por", "Data Abertura", "Previsão", "Dias em Aberto", "Prioridade", "Motivo", "Status"];
  const ahr = wsA.getRow(1);
  aHeaders.forEach((h, i) => {
    const c = ahr.getCell(i + 1);
    c.value = h;
    Object.assign(c, { style: headerStyle() });
  });
  wsA.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];

  overdue.forEach((occ, idx) => {
    const store = occ.store_id ? sm[occ.store_id] : null;
    const dOpen = daysOpenSince(occ.created_at);
    const row = wsA.getRow(idx + 2);
    const vals = [
      store?.name || "",
      occ.reporter_name || "",
      fmtDate(occ.created_at),
      fmtDate(occ.expected_resolution_date),
      dOpen ?? "",
      priorityLabel(occ.priority),
      occ.motive_id ? mm[occ.motive_id] || "" : "",
      statusLabel(occ.status, data.statuses),
    ];
    vals.forEach((v, ci) => { row.getCell(ci + 1).value = v; });
    // Red highlight
    for (let c = 1; c <= 8; c++) {
      row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE8E8" } };
      row.getCell(c).font = { color: { argb: "FF" + RED } };
    }
    row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + priorityColor(occ.priority) } };
    row.getCell(6).font = { color: { argb: "FFFFFFFF" }, bold: true };
  });
  const aWidths = [25, 20, 14, 14, 14, 12, 22, 14];
  aWidths.forEach((w, i) => { wsA.getColumn(i + 1).width = w; });

  // ─── Save ───
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const fileName = `Pendências_${data.campaignName.replace(/[^a-zA-Z0-9À-ú ]/g, "")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, fileName);
}

/* ══════════════════════════════════════════
   PDF EXPORT
   ══════════════════════════════════════════ */
function addPdfHeader(doc: jsPDF, text: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND_RGB);
  doc.rect(0, 0, pw, 18, "F");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(text, 14, 12);
  doc.setTextColor(0, 0, 0);
}

export function exportPendingPDF(data: PendingOccurrenceData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const sm = storeMap(data.stores);
  const mm = motiveMap(data.motives);
  const today = new Date();

  const total = data.occurrences.length;
  const byPriority: Record<string, number> = {};
  const byMotive: Record<string, number> = {};
  let totalDaysOpen = 0; let countDaysOpen = 0;
  data.occurrences.forEach((o) => {
    byPriority[o.priority] = (byPriority[o.priority] || 0) + 1;
    if (o.motive_id) {
      const label = mm[o.motive_id] || "Outro";
      byMotive[label] = (byMotive[label] || 0) + 1;
    }
    const d = daysOpenSince(o.created_at);
    if (d !== null) { totalDaysOpen += d; countDaysOpen++; }
  });
  const avgDaysOpen = countDaysOpen > 0 ? Math.round((totalDaysOpen / countDaysOpen) * 10) / 10 : 0;
  const overdueCount = data.occurrences.filter((o) => o.expected_resolution_date && new Date(o.expected_resolution_date) < today).length;

  // ── Page 1: Cover ──
  doc.setFillColor(...BRAND_RGB);
  doc.rect(0, 0, pw, ph, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.text("Dashboard de Pendências", pw / 2, ph / 2 - 25, { align: "center" });
  doc.setFontSize(18);
  doc.text(data.campaignName, pw / 2, ph / 2, { align: "center" });
  doc.setFontSize(14);
  doc.text(`${data.agencyName} / ${data.clientName}`, pw / 2, ph / 2 + 14, { align: "center" });
  doc.setFontSize(12);
  doc.text(`${total} ocorrências pendentes`, pw / 2, ph / 2 + 28, { align: "center" });
  doc.setFontSize(11);
  doc.text(today.toLocaleDateString("pt-BR"), pw / 2, ph / 2 + 40, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // ── Page 2: KPIs ──
  doc.addPage();
  addPdfHeader(doc, `${data.campaignName} — Pendências`);

  const kpiItems = [
    { label: "Total Pendentes", value: String(total), color: BRAND_RGB },
    { label: "Atrasadas", value: String(overdueCount), color: [220, 38, 38] as [number, number, number] },
    { label: "Média dias em aberto", value: String(avgDaysOpen), color: [249, 115, 22] as [number, number, number] },
  ];
  const boxW = 60; const boxH = 24; const startX = 50; const startY = 30;
  kpiItems.forEach((kpi, i) => {
    const x = startX + i * (boxW + 12);
    doc.setFillColor(...kpi.color);
    doc.roundedRect(x, startY, boxW, boxH, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(kpi.value, x + boxW / 2, startY + 11, { align: "center" });
    doc.setFontSize(8);
    doc.text(kpi.label, x + boxW / 2, startY + 19, { align: "center" });
  });

  // Bar chart: by priority
  const barY = startY + boxH + 20;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text("Por Prioridade", startX, barY);
  const priEntries: [string, number][] = [["critica", byPriority["critica"] || 0], ["alta", byPriority["alta"] || 0], ["media", byPriority["media"] || 0], ["baixa", byPriority["baixa"] || 0]];
  const maxPriVal = Math.max(...priEntries.map(([, v]) => v), 1);
  priEntries.forEach(([key, count], i) => {
    const y = barY + 6 + i * 11;
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(priorityLabel(key), startX, y + 5.5);
    doc.setFillColor(...priorityColorRGB(key));
    const w = (count / maxPriVal) * 80;
    doc.rect(startX + 30, y, w, 8, "F");
    doc.text(String(count), startX + 30 + w + 3, y + 5.5);
  });

  // Bar chart: by motive
  const motiveStartX = startX + 140;
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("Por Motivo", motiveStartX, barY);
  const motiveEntries = Object.entries(byMotive).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxMotVal = motiveEntries.length > 0 ? motiveEntries[0][1] : 1;
  motiveEntries.forEach(([label, count], i) => {
    const y = barY + 6 + i * 11;
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    const shortLabel = label.length > 20 ? label.slice(0, 20) + "…" : label;
    doc.text(shortLabel, motiveStartX, y + 5.5);
    doc.setFillColor(...BRAND_RGB);
    const w = (count / maxMotVal) * 60;
    doc.rect(motiveStartX + 45, y, w, 8, "F");
    doc.text(String(count), motiveStartX + 45 + w + 3, y + 5.5);
  });

  // Pie chart simulation: colored rectangles as legend
  const pieY = barY + 60;
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("Distribuição por Status", startX, pieY);
  const byStatus: Record<string, number> = {};
  data.occurrences.forEach((o) => { const k = o.status || "sem_status"; byStatus[k] = (byStatus[k] || 0) + 1; });
  Object.entries(byStatus).forEach(([key, count], i) => {
    const y = pieY + 6 + i * 10;
    const rgb = statusColorRGB(key, data.statuses);
    doc.setFillColor(...rgb);
    doc.rect(startX, y, 12, 7, "F");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(`${statusLabel(key, data.statuses) || key}: ${count}`, startX + 15, y + 5.5);
  });

  // ── Page 3+: Detail table ──
  doc.addPage();
  addPdfHeader(doc, `${data.campaignName} — Detalhamento de Pendências`);

  const detailRows = data.occurrences.map((occ) => {
    const store = occ.store_id ? sm[occ.store_id] : null;
    return [
      store?.name || "",
      occ.reporter_name || "",
      fmtDate(occ.created_at),
      fmtDate(occ.expected_resolution_date),
      daysOpenSince(occ.created_at) ?? "",
      priorityLabel(occ.priority),
      occ.motive_id ? mm[occ.motive_id] || "" : "",
      statusLabel(occ.status, data.statuses),
    ];
  });

  autoTable(doc, {
    startY: 24,
    head: [["Loja", "Aberta por", "Abertura", "Previsão", "Dias aberto", "Prioridade", "Motivo", "Status"]],
    body: detailRows,
    headStyles: { fillColor: BRAND_RGB, fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 2 },
    alternateRowStyles: { fillColor: LIGHT_BG_RGB },
    margin: { left: 10, right: 10 },
    columnStyles: { 0: { cellWidth: 35 }, 6: { cellWidth: 30 } },
    didParseCell: (hookData) => {
      if (hookData.section === "body") {
        if (hookData.column.index === 5) {
          const val = String(hookData.cell.raw).toLowerCase();
          const key = val === "crítica" ? "critica" : val === "alta" ? "alta" : val === "média" ? "media" : val === "baixa" ? "baixa" : "";
          if (key) {
            hookData.cell.styles.fillColor = priorityColorRGB(key);
            hookData.cell.styles.textColor = [255, 255, 255];
            hookData.cell.styles.fontStyle = "bold";
          }
        }
        if (hookData.column.index === 7) {
          const statusVal = data.occurrences[hookData.row.index]?.status;
          if (statusVal) {
            hookData.cell.styles.fillColor = statusColorRGB(statusVal, data.statuses);
            hookData.cell.styles.textColor = [255, 255, 255];
            hookData.cell.styles.fontStyle = "bold";
          }
        }
      }
    },
    didDrawPage: (hookData) => {
      if (hookData.pageNumber > 1) {
        addPdfHeader(doc, `${data.campaignName} — Detalhamento de Pendências`);
      }
    },
  });

  const fileName = `Pendências_${data.campaignName.replace(/[^a-zA-Z0-9À-ú ]/g, "")}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
