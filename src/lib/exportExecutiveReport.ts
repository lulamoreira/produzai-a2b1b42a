import * as XLSX from "xlsx";
import { downloadWorkbook } from "./downloadWorkbook";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND = "#8C6F4E";
const BRAND_RGB: [number, number, number] = [140, 111, 78];
const LIGHT_BG: [number, number, number] = [245, 240, 235];

/* ──────────────────────────────────────────
   Shared types
   ────────────────────────────────────────── */
export interface ReportData {
  campaignName: string;
  clientName: string;
  stores: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    store_model: string | null;
  }[];
  schedules: {
    store_id: string;
    scheduled_date: string | null;
    completed_at: string | null;
    checkin_timestamp: string | null;
    photo_checkin: boolean;
  }[];
  occurrences: {
    store_id: string | null;
    status: string | null;
    priority: string;
    description: string | null;
    created_at: string | null;
    resolved_date: string | null;
    motive_description?: string | null;
  }[];
  photos: {
    store_id: string;
    category: string;
  }[];
}

/* ──────────────────────────────────────────
   Helpers
   ────────────────────────────────────────── */
function scheduleMap(schedules: ReportData["schedules"]) {
  const m: Record<string, ReportData["schedules"][0]> = {};
  schedules.forEach((s) => { m[s.store_id] = s; });
  return m;
}

function countByStore<T extends { store_id: string | null }>(arr: T[]) {
  const m: Record<string, number> = {};
  arr.forEach((x) => { if (x.store_id) m[x.store_id] = (m[x.store_id] || 0) + 1; });
  return m;
}

function photosByStoreCategory(photos: ReportData["photos"]) {
  const m: Record<string, Record<string, number>> = {};
  photos.forEach((p) => {
    if (!m[p.store_id]) m[p.store_id] = {};
    m[p.store_id][p.category] = (m[p.store_id][p.category] || 0) + 1;
  });
  return m;
}

function stateStats(data: ReportData) {
  const sm = scheduleMap(data.schedules);
  const byState: Record<string, { total: number; completed: number; pending: number }> = {};
  data.stores.forEach((st) => {
    const uf = st.state || "N/D";
    if (!byState[uf]) byState[uf] = { total: 0, completed: 0, pending: 0 };
    byState[uf].total++;
    const sched = sm[st.id];
    if (sched?.completed_at) byState[uf].completed++;
    else byState[uf].pending++;
  });
  return Object.entries(byState).sort((a, b) => a[0].localeCompare(b[0]));
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "";
  return new Date(v).toLocaleDateString("pt-BR");
}

function sanitize(name: string) {
  return name.replace(/[\\/*?[\]:]/g, "").slice(0, 31);
}

/* ──────────────────────────────────────────
   EXCEL
   ────────────────────────────────────────── */
export function exportExecutiveExcel(data: ReportData) {
  const wb = XLSX.utils.book_new();
  const sm = scheduleMap(data.schedules);
  const occCount = countByStore(data.occurrences);
  const photoCount = countByStore(data.photos);

  // 1 — Resumo
  const totalStores = data.stores.length;
  const completed = data.schedules.filter((s) => !!s.completed_at).length;
  const pending = totalStores - completed;
  const storesWithOcc = new Set(data.occurrences.filter((o) => o.store_id).map((o) => o.store_id)).size;
  const withCheckin = data.schedules.filter((s) => !!s.checkin_timestamp).length;
  const withoutCheckin = totalStores - withCheckin;
  const totalPhotos = data.photos.length;
  const confirmedSchedules = data.schedules.filter((s) => !!s.scheduled_date).length;

  const kpiRows = [
    ["Indicador", "Valor"],
    ["Total de lojas", totalStores],
    ["Instalações concluídas", completed],
    ["Instalações pendentes", pending],
    ["Lojas com ocorrência", storesWithOcc],
    ["Lojas com check-in", withCheckin],
    ["Lojas sem check-in", withoutCheckin],
    ["Total de fotos enviadas", totalPhotos],
    ["Agendamentos confirmados", confirmedSchedules],
    [],
    ["UF", "Lojas", "Concluídas", "Pendentes"],
  ];
  stateStats(data).forEach(([uf, s]) => {
    kpiRows.push([uf, s.total as any, s.completed as any, s.pending as any]);
  });
  const wsResumo = XLSX.utils.aoa_to_sheet(kpiRows);
  wsResumo["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, sanitize("Resumo"));

  // 2 — Detalhamento por Loja
  const detailHeader = ["Loja", "Cidade", "UF", "Modelo", "Data agendada", "Concluída em", "Check-in", "Fotos", "Ocorrências"];
  const detailRows = data.stores.map((st) => {
    const sched = sm[st.id];
    return [
      st.name,
      st.city || "",
      st.state || "",
      st.store_model || "",
      fmtDate(sched?.scheduled_date),
      fmtDate(sched?.completed_at),
      sched?.checkin_timestamp ? "Sim" : "Não",
      photoCount[st.id] || 0,
      occCount[st.id] || 0,
    ];
  });
  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]);
  wsDetail["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 6 }, { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsDetail, sanitize("Detalhamento por Loja"));

  // 3 — Ocorrências
  const storeNameMap: Record<string, string> = {};
  data.stores.forEach((s) => { storeNameMap[s.id] = s.name; });
  const occHeader = ["Loja", "Motivo", "Status", "Prioridade", "Descrição", "Abertura", "Resolução"];
  const occRows = data.occurrences.map((o) => [
    o.store_id ? storeNameMap[o.store_id] || "" : "",
    o.motive_description || "",
    o.status || "",
    o.priority,
    o.description || "",
    fmtDate(o.created_at),
    fmtDate(o.resolved_date),
  ]);
  const wsOcc = XLSX.utils.aoa_to_sheet([occHeader, ...occRows]);
  wsOcc["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsOcc, sanitize("Ocorrências"));

  // 4 — Fotos por Loja
  const psc = photosByStoreCategory(data.photos);
  const allCategories = [...new Set(data.photos.map((p) => p.category))].sort();
  const photoHeader = ["Loja", ...allCategories, "Total"];
  const photoRows = data.stores.map((st) => {
    const cats = psc[st.id] || {};
    const total = Object.values(cats).reduce((a, b) => a + b, 0);
    return [st.name, ...allCategories.map((c) => cats[c] || 0), total];
  });
  const wsPhoto = XLSX.utils.aoa_to_sheet([photoHeader, ...photoRows]);
  XLSX.utils.book_append_sheet(wb, wsPhoto, sanitize("Fotos por Loja"));

  const fileName = `Relatório_${data.campaignName.replace(/[^a-zA-Z0-9À-ú ]/g, "")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  downloadWorkbook(wb, fileName);
}

/* ──────────────────────────────────────────
   PDF
   ────────────────────────────────────────── */
function addHeaderBar(doc: jsPDF, text: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND_RGB);
  doc.rect(0, 0, pw, 18, "F");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(text, 14, 12);
  doc.setTextColor(0, 0, 0);
}

export function exportExecutivePDF(data: ReportData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // ── Cover page ──
  doc.setFillColor(...BRAND_RGB);
  doc.rect(0, 0, pw, ph, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.text("Relatório Executivo", pw / 2, ph / 2 - 20, { align: "center" });
  doc.setFontSize(18);
  doc.text(data.campaignName, pw / 2, ph / 2 + 5, { align: "center" });
  doc.setFontSize(14);
  doc.text(data.clientName, pw / 2, ph / 2 + 18, { align: "center" });
  doc.setFontSize(11);
  doc.text(new Date().toLocaleDateString("pt-BR"), pw / 2, ph / 2 + 32, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // ── Summary page ──
  doc.addPage();
  addHeaderBar(doc, `${data.campaignName} — Resumo`);

  const sm = scheduleMap(data.schedules);
  const totalStores = data.stores.length;
  const completed = data.schedules.filter((s) => !!s.completed_at).length;
  const pending = totalStores - completed;
  const storesWithOcc = new Set(data.occurrences.filter((o) => o.store_id).map((o) => o.store_id)).size;
  const withCheckin = data.schedules.filter((s) => !!s.checkin_timestamp).length;
  const withoutCheckin = totalStores - withCheckin;
  const totalPhotos = data.photos.length;
  const confirmedSchedules = data.schedules.filter((s) => !!s.scheduled_date).length;

  const kpiData = [
    ["Total de lojas", String(totalStores), "Instalações concluídas", String(completed)],
    ["Instalações pendentes", String(pending), "Lojas com ocorrência", String(storesWithOcc)],
    ["Lojas com check-in", String(withCheckin), "Lojas sem check-in", String(withoutCheckin)],
    ["Total de fotos", String(totalPhotos), "Agendamentos confirmados", String(confirmedSchedules)],
  ];

  autoTable(doc, {
    startY: 24,
    head: [],
    body: kpiData,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55 },
      1: { halign: "center", cellWidth: 30 },
      2: { fontStyle: "bold", cellWidth: 55 },
      3: { halign: "center", cellWidth: 30 },
    },
    margin: { left: 14 },
  });

  // State breakdown
  const ssData = stateStats(data);
  const finalY = (doc as any).lastAutoTable?.finalY || 80;

  autoTable(doc, {
    startY: finalY + 8,
    head: [["UF", "Lojas", "Concluídas", "Pendentes"]],
    body: ssData.map(([uf, s]) => [uf, s.total, s.completed, s.pending]),
    headStyles: { fillColor: BRAND_RGB, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: LIGHT_BG },
    margin: { left: 14 },
  });

  // ── Store detail pages ──
  doc.addPage();
  addHeaderBar(doc, `${data.campaignName} — Detalhamento por Loja`);

  const occCount = countByStore(data.occurrences);
  const photoCountMap = countByStore(data.photos);

  const storeRows = data.stores.map((st) => {
    const sched = sm[st.id];
    return [
      st.name,
      st.city || "",
      st.state || "",
      st.store_model || "",
      fmtDate(sched?.scheduled_date),
      fmtDate(sched?.completed_at),
      sched?.checkin_timestamp ? "Sim" : "Não",
      photoCountMap[st.id] || 0,
      occCount[st.id] || 0,
    ];
  });

  autoTable(doc, {
    startY: 24,
    head: [["Loja", "Cidade", "UF", "Modelo", "Agendamento", "Concluída", "Check-in", "Fotos", "Ocorr."]],
    body: storeRows,
    headStyles: { fillColor: BRAND_RGB, fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 2 },
    alternateRowStyles: { fillColor: LIGHT_BG },
    margin: { left: 10, right: 10 },
    didDrawPage: (hookData) => {
      if (hookData.pageNumber > 1) {
        addHeaderBar(doc, `${data.campaignName} — Detalhamento por Loja`);
      }
    },
  });

  const fileName = `Relatório_${data.campaignName.replace(/[^a-zA-Z0-9À-ú ]/g, "")}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
