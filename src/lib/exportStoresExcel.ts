import { saveBlobAs } from "@/lib/saveBlobAs";
import { getSupplierPortalLabels } from "@/utils/currencyLocale";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const VERDE = "FF16A34A";
const AZUL = "FF2563EB";
const CINZA = "FF6B7280";
const LARANJA = "FFF97316";
const ROXO = "FF7C3AED";
const BRANCO = "FFFFFFFF";
const ESCURO = "FF111827";
const MARROM = "FF8C6F4E";
const FUNDO_CLARO = "FFF9FAFB";
const BORDER = "FFE5E7EB";

interface Store {
  id: string;
  name: string;
  code?: string;
  nickname?: string;
  city?: string;
  state?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  zip_code?: string;
  tipo_entrega: 'frete_instalacao' | 'frete_apenas' | 'sem_logistica' | null;
}

interface Params {
  stores: Store[];
  campaignName: string;
  supplierName: string;
  currency: string;
}

export async function exportStoresExcel({ stores, campaignName, supplierName, currency }: Params) {
  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default || ExcelJSModule;
  const workbook = new ExcelJSRuntime.Workbook();
  const portal = getSupplierPortalLabels(currency);
  const isCLP = currency === 'CLP';

  // --- ABA 1: RESUMEN / RESUMO ---
  const wsResumo = workbook.addWorksheet(isCLP ? "Resumen" : "Resumo", { views: [{ showGridLines: false }] });
  
  // Título mesclado (A1:F2)
  wsResumo.mergeCells("A1:F2");
  const titleCell = wsResumo.getCell("A1");
  titleCell.value = `${campaignName} — ${supplierName}`;
  titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: BRANCO } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MARROM } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  // Subtítulo
  wsResumo.getCell("A4").value = portal.storesSummaryTitle || (isCLP ? "KPIs de Entrega" : "KPIs de Entrega");
  wsResumo.getCell("A4").font = { bold: true, size: 12, color: { argb: ESCURO } };

  // KPIs
  const totalStores = stores.length;
  const comInstalacao = stores.filter(s => (s.tipo_entrega || 'frete_instalacao') === 'frete_instalacao').length;
  const freteApenas = stores.filter(s => s.tipo_entrega === 'frete_apenas').length;
  const semLogistica = stores.filter(s => s.tipo_entrega === 'sem_logistica').length;
  const totalPacotes = comInstalacao + freteApenas;

  const kpis = [
    { label: isCLP ? "Total de Tiendas" : "Total de Lojas", value: totalStores, color: LARANJA, col: "A" },
    { label: portal.typeFreteInstalacao, value: comInstalacao, color: VERDE, col: "B" },
    { label: portal.typeFreteApenas, value: freteApenas, color: AZUL, col: "C" },
    { label: portal.typeSemLogistica, value: semLogistica, color: CINZA, col: "D" },
    { label: isCLP ? "Total Paquetes" : "Total Pacotes", value: totalPacotes, color: ROXO, col: "E" }
  ];

  kpis.forEach(kpi => {
    const numRange = `${kpi.col}5:${kpi.col}6`;
    const labelRange = `${kpi.col}7:${kpi.col}8`;
    
    wsResumo.mergeCells(numRange);
    const numCell = wsResumo.getCell(`${kpi.col}5`);
    numCell.value = kpi.value;
    numCell.font = { size: 28, bold: true, color: { argb: BRANCO } };
    numCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: kpi.color } };
    numCell.alignment = { horizontal: "center", vertical: "middle" };

    wsResumo.mergeCells(labelRange);
    const lblCell = wsResumo.getCell(`${kpi.col}7`);
    lblCell.value = kpi.label;
    lblCell.font = { size: 10, bold: true, color: { argb: BRANCO } };
    lblCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: kpi.color } };
    lblCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  wsResumo.getRow(11).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  wsResumo.getRow(11).height = 4;

  // --- ABA 2: TIENDAS / LOJAS ---
  const wsTiendas = workbook.addWorksheet(isCLP ? "Tiendas" : "Lojas");
  
  wsTiendas.columns = [
    { header: isCLP ? 'Código' : 'Código', key: 'code', width: 14 },
    { header: portal.storesColName, key: 'name', width: 30 },
    { header: portal.storesColAlias, key: 'nickname', width: 20 },
    { header: portal.storesColCity, key: 'city', width: 20 },
    { header: 'UF', key: 'state', width: 8 },
    { header: isCLP ? 'Dirección' : 'Endereço', key: 'street', width: 35 },
    { header: 'Nº', key: 'number', width: 8 },
    { header: isCLP ? 'C.Postal' : 'CEP', key: 'zip', width: 12 },
    { header: portal.storesColType, key: 'tipo', width: 22 },
  ];

  // Header styling
  const headerRow = wsTiendas.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: BRANCO } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MARROM } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: BORDER } },
      bottom: { style: "thin", color: { argb: BORDER } },
      left: { style: "thin", color: { argb: BORDER } },
      right: { style: "thin", color: { argb: BORDER } },
    };
  });

  // Data rows
  stores.forEach((s, idx) => {
    const tipo = s.tipo_entrega || 'frete_instalacao';
    
    let tipoText = "";
    let tipoColor = "";
    let baseFill = "";

    if (tipo === 'frete_instalacao') {
      tipoText = `📦🔧 ${portal.typeFreteInstalacao}`;
      tipoColor = VERDE;
      baseFill = "FFECFDF5";
    } else if (tipo === 'frete_apenas') {
      tipoText = `📦 ${portal.typeFreteApenas}`;
      tipoColor = AZUL;
      baseFill = "FFEFF6FF";
    } else {
      tipoText = `🏪 ${portal.typeSemLogistica}`;
      tipoColor = CINZA;
      baseFill = "FFF3F4F6";
    }

    const row = wsTiendas.addRow({
      code: s.code || '',
      name: s.name || '',
      nickname: s.nickname || '',
      city: s.city || '',
      state: s.state || '',
      street: s.street || '',
      number: s.number || '',
      zip: s.zip_code || '',
      tipo: tipoText
    });

    // Alternate fill for readability (darken 10% roughly)
    const isEven = idx % 2 === 1;
    // We don't have a simple "darken" helper, so we'll just use the same base fill for now as per instructions "if the fill base is light, even rows receive a slightly darker fill"
    // I will use a slightly darker version manually for each.
    let finalFill = baseFill;
    if (isEven) {
       if (tipo === 'frete_instalacao') finalFill = "FFD1FAE5";
       else if (tipo === 'frete_apenas') finalFill = "FFDBEAFE";
       else finalFill = "FFE5E7EB";
    }

    row.eachCell((cell, colNum) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: finalFill } };
      cell.border = {
        top: { style: "thin", color: { argb: BORDER } },
        bottom: { style: "thin", color: { argb: BORDER } },
        left: { style: "thin", color: { argb: BORDER } },
        right: { style: "thin", color: { argb: BORDER } },
      };
      
      if (colNum === 9) { // Tipo de Entrega
        cell.font = { color: { argb: tipoColor }, bold: tipo !== 'sem_logistica' };
      }
    });
  });

  // Totals row
  wsTiendas.addRow([]);
  const totalRow = wsTiendas.addRow(['TOTAL', totalStores]);
  totalRow.getCell(1).font = { bold: true };
  totalRow.getCell(2).font = { bold: true };
  totalRow.eachCell((cell, colNum) => {
    if (colNum <= 2) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  
  const fileName = isCLP ? `tiendas-${campaignName}.xlsx` : `lojas-${campaignName}.xlsx`;
  await saveBlobAs(blob, fileName);
}
