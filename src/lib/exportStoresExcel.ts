import { saveBlobAs } from "@/lib/saveBlobAs";
import { getSupplierPortalLabels } from "@/utils/currencyLocale";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const VERDE = "FF16A34A"; const AZUL = "FF2563EB"; const CINZA = "FF6B7280";
const LARANJA = "FFF97316"; const BRANCO = "FFFFFFFF"; const ESCURO = "FF111827";
const MARROM = "FF8C6F4E"; const BEGE = "FFF7F3EC"; const BORDER = "FFE5E7EB";

interface Store { id: string; name: string; code?: string; nickname?: string; city?: string; state?: string; street?: string; number?: string; neighborhood?: string; zip_code?: string; tipo_entrega: 'frete_instalacao' | 'frete_apenas' | 'sem_logistica' | null; }
interface Params { stores: Store[]; campaignName: string; supplierName: string; currency: string; }

export async function exportStoresExcel({ stores, campaignName, supplierName, currency }: Params) {
  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default || ExcelJSModule;
  const workbook = new ExcelJSRuntime.Workbook();
  const portal = getSupplierPortalLabels(currency);
  const isCLP = currency === 'CLP';

  const ws = workbook.addWorksheet(isCLP ? "Tiendas" : "Lojas", { views: [{ showGridLines: false }] });
  ws.columns = [ { width: 14 }, { width: 30 }, { width: 18 }, { width: 22 }, { width: 8 }, { width: 35 }, { width: 8 }, { width: 12 }, { width: 24 } ];

  const total = stores.length;
  const comInstalacao = stores.filter(s => (s.tipo_entrega || 'frete_instalacao') === 'frete_instalacao').length;
  const freteApenas = stores.filter(s => s.tipo_entrega === 'frete_apenas').length;
  const semLogistica = stores.filter(s => s.tipo_entrega === 'sem_logistica').length;

  ws.mergeCells("A1:I2");
  const t = ws.getCell("A1");
  t.value = `${campaignName} — ${supplierName}`;
  t.font = { name: "Arial", size: 16, bold: true, color: { argb: BRANCO } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MARROM } };
  t.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 22; ws.getRow(2).height = 22;

  const kpis = [
    { range: "A4:B5", value: total, label: isCLP ? "Total de Tiendas" : "Total de Lojas", color: LARANJA },
    { range: "C4:D5", value: comInstalacao, label: portal.typeFreteInstalacao, color: VERDE },
    { range: "E4:F5", value: freteApenas, label: portal.typeFreteApenas, color: AZUL },
    { range: "G4:I5", value: semLogistica, label: portal.typeSemLogistica, color: CINZA },
  ];
  kpis.forEach(k => {
    ws.mergeCells(k.range);
    const c = ws.getCell(k.range.split(":")[0]);
    c.value = { richText: [
      { font: { size: 22, bold: true, color: { argb: BRANCO }, name: "Arial" }, text: `${k.value}\n` },
      { font: { size: 11, bold: true, color: { argb: BRANCO }, name: "Arial" }, text: k.label },
    ] };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: k.color } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  ws.getRow(4).height = 22; ws.getRow(5).height = 22;

  const cityCounts = stores.reduce((acc, s) => { const c = (s.city || '').trim() || (isCLP ? 'Sin ciudad' : 'Sem cidade'); acc[c] = (acc[c] || 0) + 1; return acc; }, {} as Record<string, number>);
  const cityRows = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
  let r = 7;
  const cityTitle = ws.getCell(`A${r}`);
  cityTitle.value = isCLP ? "Tiendas por Ciudad" : "Lojas por Cidade";
  cityTitle.font = { bold: true, size: 12, color: { argb: ESCURO } };
  r++;
  const ch1 = ws.getCell(`A${r}`), ch2 = ws.getCell(`B${r}`);
  ch1.value = isCLP ? "Ciudad" : "Cidade"; ch2.value = isCLP ? "Tiendas" : "Lojas";
  [ch1, ch2].forEach(c => { c.font = { bold: true, color: { argb: BRANCO } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MARROM } }; });
  r++;
  cityRows.forEach(([city, qty], i) => {
    const a = ws.getCell(`A${r}`), b = ws.getCell(`B${r}`);
    a.value = city; b.value = qty; b.alignment = { horizontal: "center" };
    const f = i % 2 === 0 ? BEGE : BRANCO;
    [a, b].forEach(c => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: f } }; c.border = { bottom: { style: "thin", color: { argb: BORDER } } }; });
    r++;
  });

  r += 1;
  const headers = [ 'Código', portal.storesColName, portal.storesColAlias, portal.storesColCity, 'UF', isCLP ? 'Dirección' : 'Endereço', 'Nº', isCLP ? 'C.Postal' : 'CEP', portal.storesColType ];
  const hr = ws.getRow(r);
  headers.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = { bold: true, color: { argb: BRANCO } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MARROM } }; c.alignment = { horizontal: "center", vertical: "middle" }; c.border = { top: { style: "thin", color: { argb: BORDER } }, bottom: { style: "thin", color: { argb: BORDER } }, left: { style: "thin", color: { argb: BORDER } }, right: { style: "thin", color: { argb: BORDER } } }; });
  hr.height = 22;
  r++;

  stores.forEach((s, idx) => {
    const tipo = s.tipo_entrega || 'frete_instalacao';
    let tipoText, tipoColor, baseFill, altFill;
    if (tipo === 'frete_instalacao') { tipoText = `📦🔧 ${portal.typeFreteInstalacao}`; tipoColor = VERDE; baseFill = "FFECFDF5"; altFill = "FFD1FAE5"; }
    else if (tipo === 'frete_apenas') { tipoText = `📦 ${portal.typeFreteApenas}`; tipoColor = AZUL; baseFill = "FFEFF6FF"; altFill = "FFDBEAFE"; }
    else { tipoText = `🏪 ${portal.typeSemLogistica}`; tipoColor = CINZA; baseFill = "FFF3F4F6"; altFill = "FFE5E7EB"; }
    const vals = [ s.code || '', s.name || '', s.nickname || '', s.city || '', s.state || '', s.street || '', s.number || '', s.zip_code || '', tipoText ];
    const row = ws.getRow(r);
    vals.forEach((v, i) => {
      const c = row.getCell(i + 1);
      c.value = v;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 === 1 ? altFill : baseFill } };
      c.border = { top: { style: "thin", color: { argb: BORDER } }, bottom: { style: "thin", color: { argb: BORDER } }, left: { style: "thin", color: { argb: BORDER } }, right: { style: "thin", color: { argb: BORDER } } };
      c.alignment = { vertical: "middle" };
      if (i === 8) c.font = { color: { argb: tipoColor }, bold: tipo !== 'sem_logistica' };
    });
    r++;
  });

  r += 1;
  const tr = ws.getRow(r);
  tr.getCell(1).value = 'TOTAL'; tr.getCell(2).value = total;
  tr.getCell(1).font = { bold: true }; tr.getCell(2).font = { bold: true };
  [1, 2].forEach(i => { tr.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } }; });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  const fileName = isCLP ? `tiendas-${campaignName}.xlsx` : `lojas-${campaignName}.xlsx`;
  await saveBlobAs(blob, fileName);
}
