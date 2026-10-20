import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const UF_FULL: Record<string, string> = {
  AC:"Acre", AL:"Alagoas", AM:"Amazonas", AP:"Amapá", BA:"Bahia", CE:"Ceará",
  DF:"Distrito Federal", ES:"Espírito Santo", GO:"Goiás", MA:"Maranhão",
  MG:"Minas Gerais", MS:"Mato Grosso do Sul", MT:"Mato Grosso", PA:"Pará",
  PB:"Paraíba", PE:"Pernambuco", PI:"Piauí", PR:"Paraná", RJ:"Rio de Janeiro",
  RN:"Rio Grande do Norte", RO:"Rondônia", RR:"Roraima", RS:"Rio Grande do Sul",
  SC:"Santa Catarina", SE:"Sergipe", SP:"São Paulo", TO:"Tocantins",
};

const titleCase = (s: string) =>
  (s || "").toLocaleLowerCase("pt-BR").replace(/(^|\s|-)([\p{L}])/gu, (_m, b, c) => b + c.toLocaleUpperCase("pt-BR"));

const ddmm = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };

export interface SchedulePdfStore { id: string; name: string; city?: string | null; state?: string | null; }
export interface SchedulePdfSchedule {
  scheduled_date?: string | null; scheduled_time?: string | null;
  reschedule_enabled?: boolean | null; reschedule_date?: string | null; reschedule_time?: string | null;
}

export function exportSchedulePdf(opts: {
  stores: SchedulePdfStore[];
  scheduleMap: Record<string, SchedulePdfSchedule | undefined>;
  fileName: string;
  clientName?: string; campaignName?: string; agencyName?: string;
}): number {
  const { stores, scheduleMap, fileName, clientName = "", campaignName = "", agencyName = "" } = opts;

  type Row = { loja: string; cidade: string; uf: string; date: string; time: string };
  const rows: Row[] = [];
  for (const s of stores) {
    const sc = scheduleMap[s.id];
    if (!sc) continue;
    const useR = !!(sc.reschedule_enabled && sc.reschedule_date); // usa reagendamento quando habilitado
    const date = useR ? (sc.reschedule_date || "") : (sc.scheduled_date || "");
    if (!date) continue;
    const time = useR ? (sc.reschedule_time || "") : (sc.scheduled_time || "");
    rows.push({ loja: s.name || "", cidade: titleCase(s.city || ""), uf: (s.state || "").toUpperCase(), date, time });
  }
  if (rows.length === 0) return 0;

  // ORDEM: estado -> data -> horário -> cidade -> loja
  rows.sort((a, b) =>
    a.uf.localeCompare(b.uf) || a.date.localeCompare(b.date) ||
    a.time.localeCompare(b.time) || a.cidade.localeCompare(b.cidade) || a.loja.localeCompare(b.loja));

  const countByUf: Record<string, number> = {};
  rows.forEach(r => { countByUf[r.uf] = (countByUf[r.uf] || 0) + 1; });
  const nStates = Object.keys(countByUf).length;
  const dates = rows.map(r => r.date).sort();
  const periodStr = `${ddmm(dates[0])}/${dates[0].slice(0,4)} a ${ddmm(dates[dates.length-1])}/${dates[dates.length-1].slice(0,4)}`;

  const body: any[] = [];
  let curUf = "";
  for (const r of rows) {
    if (r.uf !== curUf) {
      curUf = r.uf;
      const n = countByUf[curUf];
      body.push([{ content: `${UF_FULL[curUf] || curUf}   (${n} ${n === 1 ? "loja" : "lojas"})`,
        colSpan: 4, styles: { fillColor: [31,122,77], textColor: 255, fontStyle: "bold", halign: "left" } }]);
    }
    body.push([r.loja, r.cidade, ddmm(r.date), r.time]);
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const hoje = new Date().toLocaleDateString("pt-BR");
  const subtitle = [clientName, campaignName, agencyName].filter(Boolean).join("   ·   ");

  autoTable(doc, {
    startY: 118,
    margin: { top: 118, left: 40, right: 40, bottom: 36 },
    head: [["Loja", "Cidade", "Dia", "Horário"]],
    body,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 4, textColor: [27,43,54], valign: "middle" },
    headStyles: { fillColor: [34,58,78], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246,249,251] },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { cellWidth: 150, textColor: [91,107,120] },
      2: { cellWidth: 70, halign: "center" },
      3: { cellWidth: 60, halign: "center" },
    },
    didDrawPage: (data) => {
      doc.setFillColor(34,58,78); doc.rect(0, 0, pageW, 78, "F");
      doc.setTextColor(255); doc.setFont("helvetica","bold"); doc.setFontSize(17);
      doc.text("Cronograma de Instalação", 40, 40);
      doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(199,212,222);
      if (subtitle) doc.text(subtitle, 40, 60);
      if (data.pageNumber === 1) {
        doc.setTextColor(91,107,120); doc.setFontSize(10);
        doc.text(`${rows.length} lojas  ·  ${nStates} estados  ·  período de instalação: ${periodStr}`, 40, 102);
      }
      doc.setFontSize(8); doc.setTextColor(138,153,165);
      doc.text(`Gerado em ${hoje}  ·  ProduzAI  ·  Datas/horários sujeitos a confirmação.`, 40, pageH - 18);
    },
  });

  doc.save(fileName);
  return rows.length;
}
