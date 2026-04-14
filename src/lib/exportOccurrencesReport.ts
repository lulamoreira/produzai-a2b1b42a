import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Schedule } from "@/types/schedule";

/* ──────────────────────────────────────────
   Brand constants
   ────────────────────────────────────────── */
const BRAND = "8C6F4E";
const BRAND_RGB: [number, number, number] = [140, 111, 78];
const LIGHT_BG = "F5F0EB";
const LIGHT_BG_RGB: [number, number, number] = [245, 240, 235];
const WHITE = "FFFFFF";
const RED = "DC2626";
const ORANGE = "F97316";
const YELLOW = "EAB308";
const GREEN = "22C55E";
const BLUE = "3B82F6";
const GRAY = "6B7280";

/* ──────────────────────────────────────────
   Types
   ────────────────────────────────────────── */
export interface OccurrenceReportData {
  campaignName: string;
  clientName: string;
  agencyName: string;
  occurrences: {
    id: string;
    store_id: string | null;
    piece_id: string | null;
    kit_id: string | null;
    motive_id: string | null;
    description: string | null;
    status: string | null;
    priority: string;
    created_at: string | null;
    resolved_date: string | null;
    expected_resolution_date: string | null;
    agency_observation: string | null;
    actions_taken: string | null;
    needs_reinstallation: boolean | null;
    location_in_store: string | null;
  }[];
  stores: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    store_code: string | null;
  }[];
  pieces: { id: string; name: string; code: number }[];
  kits: { id: string; name: string; code: number }[];
  motives: { id: string; description: string }[];
  statuses: { value: string; label: string; color: string }[];
  scheduleMap: Record<string, Schedule>;
}

/* ──────────────────────────────────────────
   Helpers
   ────────────────────────────────────────── */
function storeMap(stores: OccurrenceReportData["stores"]) {
  const m: Record<string, (typeof stores)[0]> = {};
  stores.forEach((s) => { m[s.id] = s; });
  return m;
}

function buildLookup<T extends { id: string }>(arr: T[], key: keyof T): Record<string, string> {
  const m: Record<string, string> = {};
  arr.forEach((x) => { m[x.id] = String(x[key]); });
  return m;
}

function daysBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const da = new Date(a);
  const db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
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

function statusLabel(value: string | null, statuses: OccurrenceReportData["statuses"]) {
  if (!value) return "";
  const found = statuses.find((s) => s.value === value);
  return found?.label || value;
}

function statusColor(value: string | null, statuses: OccurrenceReportData["statuses"]): string {
  if (!value) return GRAY;
  const found = statuses.find((s) => s.value === value);
  if (!found) return GRAY;
  return found.color.replace("#", "");
}

function statusColorRGB(value: string | null, statuses: OccurrenceReportData["statuses"]): [number, number, number] {
  const hex = statusColor(value, statuses);
  const r = parseInt(hex.substring(0, 2), 16) || 107;
  const g = parseInt(hex.substring(2, 4), 16) || 114;
  const b = parseInt(hex.substring(4, 6), 16) || 128;
  return [r, g, b];
}

function sanitize(name: string) {
  return name.replace(/[\\/*?[\]:]/g, "").slice(0, 31);
}

/* ──────────────────────────────────────────
   KPI computation
   ────────────────────────────────────────── */
interface KPIs {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  avgResolutionDays: number | null;
  avgInstallToOccDays: number | null;
  pctResolvedOnTime: number | null;
  pctNeedsReinstall: number;
  byState: { uf: string; total: number; byStatus: Record<string, number>; avgDays: number | null }[];
}

function computeKPIs(data: OccurrenceReportData): KPIs {
  const sm = storeMap(data.stores);
  const total = data.occurrences.length;

  // By status
  const byStatus: Record<string, number> = {};
  data.occurrences.forEach((o) => {
    const key = o.status || "sem_status";
    byStatus[key] = (byStatus[key] || 0) + 1;
  });

  // By priority
  const byPriority: Record<string, number> = {};
  data.occurrences.forEach((o) => {
    byPriority[o.priority] = (byPriority[o.priority] || 0) + 1;
  });

  // Avg resolution days
  const resolvedDays: number[] = [];
  data.occurrences.forEach((o) => {
    if (o.resolved_date && o.created_at) {
      const d = daysBetween(o.created_at, o.resolved_date);
      if (d !== null && d >= 0) resolvedDays.push(d);
    }
  });
  const avgResolutionDays = resolvedDays.length ? Math.round((resolvedDays.reduce((a, b) => a + b, 0) / resolvedDays.length) * 10) / 10 : null;

  // Avg install-to-occurrence days
  const installDays: number[] = [];
  data.occurrences.forEach((o) => {
    if (o.store_id && o.created_at) {
      const sched = data.scheduleMap[o.store_id];
      if (sched?.completed_at) {
        const d = daysBetween(sched.completed_at, o.created_at);
        if (d !== null && d >= 0) installDays.push(d);
      }
    }
  });
  const avgInstallToOccDays = installDays.length ? Math.round((installDays.reduce((a, b) => a + b, 0) / installDays.length) * 10) / 10 : null;

  // % resolved on time
  let onTime = 0;
  let resolvedWithDeadline = 0;
  data.occurrences.forEach((o) => {
    if (o.resolved_date && o.expected_resolution_date) {
      resolvedWithDeadline++;
      if (new Date(o.resolved_date) <= new Date(o.expected_resolution_date)) onTime++;
    }
  });
  const pctResolvedOnTime = resolvedWithDeadline > 0 ? Math.round((onTime / resolvedWithDeadline) * 100) : null;

  // % needs reinstallation
  const reinstall = data.occurrences.filter((o) => o.needs_reinstallation).length;
  const pctNeedsReinstall = total > 0 ? Math.round((reinstall / total) * 100) : 0;

  // By state
  const stateData: Record<string, { total: number; byStatus: Record<string, number>; resDays: number[] }> = {};
  data.occurrences.forEach((o) => {
    const st = o.store_id ? sm[o.store_id] : null;
    const uf = st?.state || "N/D";
    if (!stateData[uf]) stateData[uf] = { total: 0, byStatus: {}, resDays: [] };
    stateData[uf].total++;
    const sk = o.status || "sem_status";
    stateData[uf].byStatus[sk] = (stateData[uf].byStatus[sk] || 0) + 1;
    if (o.resolved_date && o.created_at) {
      const d = daysBetween(o.created_at, o.resolved_date);
      if (d !== null && d >= 0) stateData[uf].resDays.push(d);
    }
  });
  const byState = Object.entries(stateData)
    .map(([uf, d]) => ({
      uf,
      total: d.total,
      byStatus: d.byStatus,
      avgDays: d.resDays.length ? Math.round((d.resDays.reduce((a, b) => a + b, 0) / d.resDays.length) * 10) / 10 : null,
    }))
    .sort((a, b) => b.total - a.total);

  return { total, byStatus, byPriority, avgResolutionDays, avgInstallToOccDays, pctResolvedOnTime, pctNeedsReinstall, byState };
}

/* ──────────────────────────────────────────
   Excel helper styles
   ────────────────────────────────────────── */
function headerStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, color: { argb: "FF" + WHITE }, size: 10 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BRAND } },
    alignment: { vertical: "middle", horizontal: "center", wrapText: true },
    border: {
      bottom: { style: "thin", color: { argb: "FF" + BRAND } },
    },
  };
}

function kpiBoxStyle(bg: string): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 12, color: { argb: "FF" + WHITE } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + bg } },
    alignment: { vertical: "middle", horizontal: "center" },
  };
}

function kpiLabelStyle(bg: string): Partial<ExcelJS.Style> {
  return {
    font: { size: 9, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + bg } },
    alignment: { vertical: "middle", horizontal: "center", wrapText: true },
  };
}

/* ══════════════════════════════════════════
   EXCEL EXPORT
   ══════════════════════════════════════════ */
export async function exportOccurrencesExcel(data: OccurrenceReportData) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ProduzAI";
  wb.created = new Date();

  const sm = storeMap(data.stores);
  const motiveMap = buildLookup(data.motives, "description");
  const kpis = computeKPIs(data);

  // ─── Sheet 1: Resumo ───
  const wsR = wb.addWorksheet(sanitize("Resumo"));
  wsR.properties.defaultRowHeight = 20;

  // Title
  wsR.mergeCells("A1:F1");
  const titleCell = wsR.getCell("A1");
  titleCell.value = `${data.agencyName} / ${data.clientName} / ${data.campaignName}`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF" + BRAND } };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  wsR.getRow(1).height = 30;

  // KPI boxes row 3-4
  const kpiDefs: { label: string; value: string | number; color: string }[] = [
    { label: "Total", value: kpis.total, color: BRAND },
    { label: "Em andamento", value: kpis.byStatus["andamento"] || 0, color: BLUE },
    { label: "Pendentes", value: kpis.byStatus["pendente"] || 0, color: YELLOW },
    { label: "Resolvidas", value: kpis.byStatus["resolvida"] || 0, color: GREEN },
    { label: "Não procede", value: kpis.byStatus["nao_procede"] || 0, color: GRAY },
    { label: "Críticas", value: kpis.byPriority["critica"] || 0, color: RED },
    { label: "Altas", value: kpis.byPriority["alta"] || 0, color: ORANGE },
    { label: "Médias", value: kpis.byPriority["media"] || 0, color: YELLOW },
    { label: "Baixas", value: kpis.byPriority["baixa"] || 0, color: GREEN },
  ];

  kpiDefs.forEach((kpi, i) => {
    const col = i + 1;
    const valCell = wsR.getCell(3, col);
    valCell.value = kpi.value;
    Object.assign(valCell, { style: kpiBoxStyle(kpi.color) });

    const lblCell = wsR.getCell(4, col);
    lblCell.value = kpi.label;
    Object.assign(lblCell, { style: kpiLabelStyle(kpi.color) });
  });
  wsR.getRow(3).height = 32;
  wsR.getRow(4).height = 22;
  for (let c = 1; c <= 9; c++) wsR.getColumn(c).width = 16;

  // Additional KPIs row 6-7
  const extraKpis = [
    { label: "Tempo médio resolução (dias)", value: kpis.avgResolutionDays ?? "N/D" },
    { label: "Tempo médio instalação→ocorrência (dias)", value: kpis.avgInstallToOccDays ?? "N/D" },
    { label: "% Resolvidas no prazo", value: kpis.pctResolvedOnTime !== null ? `${kpis.pctResolvedOnTime}%` : "N/D" },
    { label: "% Precisa reinstalação", value: `${kpis.pctNeedsReinstall}%` },
  ];

  extraKpis.forEach((kpi, i) => {
    const col = i * 2 + 1;
    wsR.mergeCells(6, col, 6, col + 1);
    const lbl = wsR.getCell(6, col);
    lbl.value = kpi.label;
    lbl.font = { bold: true, size: 9, color: { argb: "FF" + BRAND } };
    lbl.alignment = { horizontal: "center" };
    wsR.mergeCells(7, col, 7, col + 1);
    const val = wsR.getCell(7, col);
    val.value = kpi.value;
    val.font = { bold: true, size: 14 };
    val.alignment = { horizontal: "center" };
  });

  // State table row 9+
  const stateHeaderRow = 9;
  const stateHeaders = ["UF", "Total", "Em andamento", "Resolvidas", "Críticas", "Tempo médio resolução"];
  const shr = wsR.getRow(stateHeaderRow);
  stateHeaders.forEach((h, i) => {
    const c = shr.getCell(i + 1);
    c.value = h;
    Object.assign(c, { style: headerStyle() });
  });

  kpis.byState.forEach((s, i) => {
    const row = wsR.getRow(stateHeaderRow + 1 + i);
    row.getCell(1).value = s.uf;
    row.getCell(2).value = s.total;
    row.getCell(3).value = s.byStatus["andamento"] || 0;
    row.getCell(4).value = s.byStatus["resolvida"] || 0;
    row.getCell(5).value = s.byStatus["critica"] || 0;
    row.getCell(6).value = s.avgDays ?? "N/D";
    if (i % 2 === 1) {
      for (let c = 1; c <= 6; c++) {
        row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + LIGHT_BG } };
      }
    }
  });

  // ─── Sheet 2: Detalhamento ───
  const wsD = wb.addWorksheet(sanitize("Detalhamento"));
  const detailHeaders = [
    "Loja", "Cidade", "UF", "Código", "Motivo", "Prioridade", "Status",
    "Descrição", "Data Abertura", "Data Instalação", "Dias Inst→Ocorr",
    "Resolução Prevista", "Data Resolvida", "Dias p/ Resolver",
    "No Prazo", "Obs. Agência", "Ações Tomadas", "Reinstalação",
  ];
  const dhr = wsD.getRow(1);
  detailHeaders.forEach((h, i) => {
    const c = dhr.getCell(i + 1);
    c.value = h;
    Object.assign(c, { style: headerStyle() });
  });
  wsD.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];

  data.occurrences.forEach((occ, idx) => {
    const store = occ.store_id ? sm[occ.store_id] : null;
    const sched = occ.store_id ? data.scheduleMap[occ.store_id] : null;
    const daysInstToOcc = daysBetween(sched?.completed_at ?? null, occ.created_at);
    const daysToResolve = daysBetween(occ.created_at, occ.resolved_date);
    const onTime = occ.resolved_date && occ.expected_resolution_date
      ? new Date(occ.resolved_date) <= new Date(occ.expected_resolution_date) ? "Sim" : "Não"
      : "";

    const row = wsD.getRow(idx + 2);
    const vals = [
      store?.name || "",
      store?.city || "",
      store?.state || "",
      store?.store_code || "",
      occ.motive_id ? motiveMap[occ.motive_id] || "" : "",
      priorityLabel(occ.priority),
      statusLabel(occ.status, data.statuses),
      occ.description || "",
      fmtDate(occ.created_at),
      fmtDate(sched?.completed_at),
      daysInstToOcc ?? "",
      fmtDate(occ.expected_resolution_date),
      fmtDate(occ.resolved_date),
      daysToResolve ?? "",
      onTime,
      occ.agency_observation || "",
      occ.actions_taken || "",
      occ.needs_reinstallation ? "Sim" : "Não",
    ];
    vals.forEach((v, ci) => { row.getCell(ci + 1).value = v; });

    // Priority color (col 6)
    row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + priorityColor(occ.priority) } };
    row.getCell(6).font = { color: { argb: "FFFFFFFF" }, bold: true, size: 10 };

    // Status color (col 7)
    const sc = statusColor(occ.status, data.statuses);
    row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + sc } };
    row.getCell(7).font = { color: { argb: "FFFFFFFF" }, bold: true, size: 10 };

    // Alternating row
    if (idx % 2 === 1) {
      for (let c = 1; c <= 18; c++) {
        if (c !== 6 && c !== 7) {
          row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + LIGHT_BG } };
        }
      }
    }
  });

  wsD.autoFilter = { from: "A1", to: `R${data.occurrences.length + 1}` };
  const colWidths = [25, 16, 6, 10, 20, 12, 14, 35, 12, 12, 12, 12, 12, 12, 10, 30, 30, 12];
  colWidths.forEach((w, i) => { wsD.getColumn(i + 1).width = w; });

  // ─── Sheet 3: Por Estado ───
  const wsS = wb.addWorksheet(sanitize("Por Estado"));
  const stateH = ["UF", "Total", "% do Total", "Barra"];
  const shr2 = wsS.getRow(1);
  stateH.forEach((h, i) => {
    const c = shr2.getCell(i + 1);
    c.value = h;
    Object.assign(c, { style: headerStyle() });
  });
  wsS.getColumn(1).width = 8;
  wsS.getColumn(2).width = 10;
  wsS.getColumn(3).width = 12;
  wsS.getColumn(4).width = 50;

  const maxStateCount = kpis.byState.length > 0 ? kpis.byState[0].total : 1;
  kpis.byState.forEach((s, i) => {
    const row = wsS.getRow(i + 2);
    row.getCell(1).value = s.uf;
    row.getCell(2).value = s.total;
    row.getCell(3).value = kpis.total > 0 ? `${Math.round((s.total / kpis.total) * 100)}%` : "0%";
    const barLen = Math.round((s.total / maxStateCount) * 30);
    row.getCell(4).value = "█".repeat(barLen);
    row.getCell(4).font = { color: { argb: "FF" + BRAND } };
  });

  // ─── Sheet 4: Em Aberto ───
  const wsO = wb.addWorksheet(sanitize("Em Aberto"));
  const openOccs = data.occurrences
    .filter((o) => o.status !== "resolvida" && o.status !== "nao_procede")
    .sort((a, b) => {
      const da = a.expected_resolution_date ? new Date(a.expected_resolution_date).getTime() : Infinity;
      const db = b.expected_resolution_date ? new Date(b.expected_resolution_date).getTime() : Infinity;
      return da - db;
    });

  const openHeaders = ["Loja", "Motivo", "Prioridade", "Status", "Data Abertura", "Resolução Prevista", "Dias em aberto", "Descrição"];
  const ohr = wsO.getRow(1);
  openHeaders.forEach((h, i) => {
    const c = ohr.getCell(i + 1);
    c.value = h;
    Object.assign(c, { style: headerStyle() });
  });
  wsO.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];

  const today = new Date();
  openOccs.forEach((occ, idx) => {
    const store = occ.store_id ? sm[occ.store_id] : null;
    const daysOpen = occ.created_at ? daysBetween(occ.created_at, today.toISOString()) : null;
    const isOverdue = occ.expected_resolution_date && new Date(occ.expected_resolution_date) < today;

    const row = wsO.getRow(idx + 2);
    const vals = [
      store?.name || "",
      occ.motive_id ? motiveMap[occ.motive_id] || "" : "",
      priorityLabel(occ.priority),
      statusLabel(occ.status, data.statuses),
      fmtDate(occ.created_at),
      fmtDate(occ.expected_resolution_date),
      daysOpen ?? "",
      occ.description || "",
    ];
    vals.forEach((v, ci) => { row.getCell(ci + 1).value = v; });

    row.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + priorityColor(occ.priority) } };
    row.getCell(3).font = { color: { argb: "FFFFFFFF" }, bold: true };

    if (isOverdue) {
      for (let c = 1; c <= 8; c++) {
        if (c !== 3) {
          row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE8E8" } };
          row.getCell(c).font = { color: { argb: "FF" + RED } };
        }
      }
    }
  });

  const openWidths = [25, 20, 12, 14, 12, 14, 12, 35];
  openWidths.forEach((w, i) => { wsO.getColumn(i + 1).width = w; });

  // ─── Sheet 5: Linha do Tempo ───
  const wsT = wb.addWorksheet(sanitize("Linha do Tempo"));
  const tlHeaders = ["Loja", "Motivo", "Prioridade", "Data Instalação", "Data Abertura", "Resolução Prevista", "Data Resolução", "SLA (dias)", "Cumpriu SLA"];
  const thr = wsT.getRow(1);
  tlHeaders.forEach((h, i) => {
    const c = thr.getCell(i + 1);
    c.value = h;
    Object.assign(c, { style: headerStyle() });
  });
  wsT.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];

  const sortedByDate = [...data.occurrences].sort((a, b) => {
    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
    const db = b.created_at ? new Date(b.created_at).getTime() : 0;
    return da - db;
  });

  sortedByDate.forEach((occ, idx) => {
    const store = occ.store_id ? sm[occ.store_id] : null;
    const sched = occ.store_id ? data.scheduleMap[occ.store_id] : null;
    const slaDays = daysBetween(occ.created_at, occ.resolved_date);
    const metSla = occ.resolved_date && occ.expected_resolution_date
      ? new Date(occ.resolved_date) <= new Date(occ.expected_resolution_date) ? "Sim" : "Não"
      : "";

    const row = wsT.getRow(idx + 2);
    const vals = [
      store?.name || "",
      occ.motive_id ? motiveMap[occ.motive_id] || "" : "",
      priorityLabel(occ.priority),
      fmtDate(sched?.completed_at),
      fmtDate(occ.created_at),
      fmtDate(occ.expected_resolution_date),
      fmtDate(occ.resolved_date),
      slaDays ?? "",
      metSla,
    ];
    vals.forEach((v, ci) => { row.getCell(ci + 1).value = v; });

    if (metSla === "Não") {
      row.getCell(9).font = { color: { argb: "FF" + RED }, bold: true };
    } else if (metSla === "Sim") {
      row.getCell(9).font = { color: { argb: "FF" + GREEN }, bold: true };
    }

    if (idx % 2 === 1) {
      for (let c = 1; c <= 9; c++) {
        row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + LIGHT_BG } };
      }
    }
  });

  const tlWidths = [25, 20, 12, 14, 14, 14, 14, 10, 12];
  tlWidths.forEach((w, i) => { wsT.getColumn(i + 1).width = w; });

  // ─── Save ───
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const fileName = `Ocorrências_${data.campaignName.replace(/[^a-zA-Z0-9À-ú ]/g, "")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
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

export function exportOccurrencesPDF(data: OccurrenceReportData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const sm = storeMap(data.stores);
  const motiveMap = buildLookup(data.motives, "description");
  const kpis = computeKPIs(data);

  // ── Page 1: Cover ──
  doc.setFillColor(...BRAND_RGB);
  doc.rect(0, 0, pw, ph, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.text("Relatório de Ocorrências", pw / 2, ph / 2 - 25, { align: "center" });
  doc.setFontSize(18);
  doc.text(data.campaignName, pw / 2, ph / 2, { align: "center" });
  doc.setFontSize(14);
  doc.text(`${data.agencyName} / ${data.clientName}`, pw / 2, ph / 2 + 14, { align: "center" });
  doc.setFontSize(12);
  doc.text(`Total: ${kpis.total} ocorrências`, pw / 2, ph / 2 + 28, { align: "center" });
  doc.setFontSize(11);
  doc.text(new Date().toLocaleDateString("pt-BR"), pw / 2, ph / 2 + 40, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // ── Page 2: KPI Summary ──
  doc.addPage();
  addPdfHeader(doc, `${data.campaignName} — Resumo de Ocorrências`);

  // KPI boxes 3x3
  const kpiItems = [
    { label: "Total", value: String(kpis.total), color: BRAND_RGB },
    { label: "Em andamento", value: String(kpis.byStatus["andamento"] || 0), color: [59, 130, 246] as [number, number, number] },
    { label: "Pendentes", value: String(kpis.byStatus["pendente"] || 0), color: [234, 179, 8] as [number, number, number] },
    { label: "Resolvidas", value: String(kpis.byStatus["resolvida"] || 0), color: [34, 197, 94] as [number, number, number] },
    { label: "Não procede", value: String(kpis.byStatus["nao_procede"] || 0), color: [107, 114, 128] as [number, number, number] },
    { label: "Críticas", value: String(kpis.byPriority["critica"] || 0), color: [220, 38, 38] as [number, number, number] },
    { label: "Altas", value: String(kpis.byPriority["alta"] || 0), color: [249, 115, 22] as [number, number, number] },
    { label: "Tempo médio (dias)", value: kpis.avgResolutionDays !== null ? String(kpis.avgResolutionDays) : "N/D", color: BRAND_RGB },
    { label: "% No prazo", value: kpis.pctResolvedOnTime !== null ? `${kpis.pctResolvedOnTime}%` : "N/D", color: BRAND_RGB },
  ];

  const boxW = 56;
  const boxH = 24;
  const startX = 30;
  const startY = 28;
  const gapX = 8;
  const gapY = 6;

  kpiItems.forEach((kpi, i) => {
    const col = i % 3;
    const rowIdx = Math.floor(i / 3);
    const x = startX + col * (boxW + gapX);
    const y = startY + rowIdx * (boxH + gapY);
    doc.setFillColor(...kpi.color);
    doc.roundedRect(x, y, boxW, boxH, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(kpi.value, x + boxW / 2, y + 11, { align: "center" });
    doc.setFontSize(8);
    doc.text(kpi.label, x + boxW / 2, y + 19, { align: "center" });
  });

  // Bar chart: status distribution
  const barY = startY + 3 * (boxH + gapY) + 8;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text("Distribuição por Status", startX, barY);

  const statusEntries = Object.entries(kpis.byStatus).slice(0, 6);
  const maxStatusVal = Math.max(...statusEntries.map(([, v]) => v), 1);
  const barMaxW = 120;
  const barH2 = 8;
  const barStartY = barY + 5;

  statusEntries.forEach(([key, count], i) => {
    const y = barStartY + i * (barH2 + 3);
    const label = statusLabel(key, data.statuses) || key;
    const rgb = statusColorRGB(key, data.statuses);
    const w = (count / maxStatusVal) * barMaxW;
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(label, startX, y + 5.5);
    doc.setFillColor(...rgb);
    doc.rect(startX + 45, y, w, barH2, "F");
    doc.text(String(count), startX + 45 + w + 3, y + 5.5);
  });

  // Bar chart: priority distribution
  const priY = barY;
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("Distribuição por Prioridade", startX + 180, priY);

  const priEntries: [string, number][] = [
    ["critica", kpis.byPriority["critica"] || 0],
    ["alta", kpis.byPriority["alta"] || 0],
    ["media", kpis.byPriority["media"] || 0],
    ["baixa", kpis.byPriority["baixa"] || 0],
  ];
  const maxPriVal = Math.max(...priEntries.map(([, v]) => v), 1);

  priEntries.forEach(([key, count], i) => {
    const y = barStartY + i * (barH2 + 3);
    const rgb = priorityColorRGB(key);
    const w = (count / maxPriVal) * 60;
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(priorityLabel(key), startX + 180, y + 5.5);
    doc.setFillColor(...rgb);
    doc.rect(startX + 210, y, w, barH2, "F");
    doc.text(String(count), startX + 210 + w + 3, y + 5.5);
  });

  // ── Page 3: Distribution by state ──
  doc.addPage();
  addPdfHeader(doc, `${data.campaignName} — Distribuição por Estado`);

  const stateBarY = 28;
  const stateBarH = 7;
  const stateBarMaxW = 160;
  const maxSt = kpis.byState.length > 0 ? kpis.byState[0].total : 1;

  kpis.byState.forEach((s, i) => {
    const y = stateBarY + i * (stateBarH + 3);
    if (y > ph - 15) return; // safety
    const w = (s.total / maxSt) * stateBarMaxW;
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(s.uf, 14, y + 5);
    doc.setFillColor(...BRAND_RGB);
    doc.rect(30, y, w, stateBarH, "F");
    doc.setFontSize(8);
    doc.text(`${s.total} (${kpis.total > 0 ? Math.round((s.total / kpis.total) * 100) : 0}%)`, 30 + w + 3, y + 5);
  });

  // ── Page 4+: Full detail table ──
  doc.addPage();
  addPdfHeader(doc, `${data.campaignName} — Detalhamento de Ocorrências`);

  const detailRows = data.occurrences.map((occ) => {
    const store = occ.store_id ? sm[occ.store_id] : null;
    return [
      store?.name || "",
      store?.state || "",
      occ.motive_id ? motiveMap[occ.motive_id] || "" : "",
      priorityLabel(occ.priority),
      statusLabel(occ.status, data.statuses),
      fmtDate(occ.created_at),
      fmtDate(occ.resolved_date),
      (occ.description || "").slice(0, 60),
    ];
  });

  autoTable(doc, {
    startY: 24,
    head: [["Loja", "UF", "Motivo", "Prioridade", "Status", "Abertura", "Resolução", "Descrição"]],
    body: detailRows,
    headStyles: { fillColor: BRAND_RGB, fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 2 },
    alternateRowStyles: { fillColor: LIGHT_BG_RGB },
    margin: { left: 10, right: 10 },
    columnStyles: {
      0: { cellWidth: 35 },
      7: { cellWidth: 50 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body") {
        // Priority column (3)
        if (hookData.column.index === 3) {
          const val = String(hookData.cell.raw).toLowerCase();
          const key = val === "crítica" ? "critica" : val === "alta" ? "alta" : val === "média" ? "media" : val === "baixa" ? "baixa" : "";
          if (key) {
            hookData.cell.styles.fillColor = priorityColorRGB(key);
            hookData.cell.styles.textColor = [255, 255, 255];
            hookData.cell.styles.fontStyle = "bold";
          }
        }
        // Status column (4)
        if (hookData.column.index === 4) {
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
        addPdfHeader(doc, `${data.campaignName} — Detalhamento de Ocorrências`);
      }
    },
  });

  const fileName = `Ocorrências_${data.campaignName.replace(/[^a-zA-Z0-9À-ú ]/g, "")}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
