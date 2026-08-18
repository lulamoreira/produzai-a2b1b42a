import type { jsPDF as jsPDFType } from "jspdf";
import { formatCurrencyByCode } from "./countryConfig";

const BRAND_RGB: [number, number, number] = [140, 111, 78];
const LIGHT_BG: [number, number, number] = [245, 240, 235];

export interface CostAnalysisData {
  itemCosts: any[];
  totalCampaign: number;
  gaps: any[];
  storeStats: any[];
  suggestions: string[];
  baseLabel: string;
}

function addHeaderBar(doc: jsPDFType, campaignName: string, baseLabel: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND_RGB);
  doc.rect(0, 0, pw, 18, "F");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(`Análise de Custos — ${campaignName}`, 14, 12);
  
  doc.setFontSize(8);
  doc.text(`Base: ${baseLabel}`, pw - 14, 9, { align: "right" });
  doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, pw - 14, 14, { align: "right" });
  
  doc.setTextColor(0, 0, 0);
}

export async function exportCostAnalysisPDF(
  analysis: CostAnalysisData,
  campaignName: string,
  currencyCode: string
) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  addHeaderBar(doc, campaignName, analysis.baseLabel);

  // 1. Ranking de Custos
  doc.setFontSize(14);
  doc.setTextColor(...BRAND_RGB);
  doc.text("1. Ranking de Custos", 14, 28);
  
  const rankingBody = analysis.itemCosts.map((item, index) => [
    item.name + (item.isKit ? " (Kit)" : "") + (index < 5 ? " [Top 5]" : ""),
    item.qty,
    item.price > 0 ? formatCurrencyByCode(item.price, currencyCode) : "—",
    formatCurrencyByCode(item.total, currencyCode),
    `${((item.total / (analysis.totalCampaign || 1)) * 100).toFixed(1)}%`
  ]);

  autoTable(doc, {
    startY: 32,
    head: [["Item", "Qtd Total", "Preço Unit.", "Custo Total", "%"]],
    body: rankingBody,
    foot: [[
      "Total Acumulado",
      "",
      "",
      formatCurrencyByCode(analysis.totalCampaign, currencyCode),
      "100%"
    ]],
    headStyles: { fillColor: BRAND_RGB, fontSize: 9 },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" }
    },
    alternateRowStyles: { fillColor: LIGHT_BG },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 15;

  // 2. Gap entre Fornecedores
  if (analysis.gaps.length > 0) {
    if (currentY > 250) {
      doc.addPage();
      addHeaderBar(doc, campaignName, analysis.baseLabel);
      currentY = 28;
    }
    
    doc.setFontSize(14);
    doc.setTextColor(...BRAND_RGB);
    doc.text("2. Gap entre Fornecedores", 14, currentY);
    
    const gapBody = analysis.gaps.map(gap => [
      gap.name,
      `${gap.minSupplier} - ${formatCurrencyByCode(gap.min, currencyCode)}`,
      `${gap.maxSupplier} - ${formatCurrencyByCode(gap.max, currencyCode)}`,
      `${gap.gapPct.toFixed(1)}%`
    ]);

    autoTable(doc, {
      startY: currentY + 4,
      head: [["Peça", "Menor", "Maior", "Disparidade %"]],
      body: gapBody,
      headStyles: { fillColor: BRAND_RGB, fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        3: { halign: "right" }
      },
      alternateRowStyles: { fillColor: LIGHT_BG },
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // 3. Sugestões de Otimização
  if (analysis.suggestions.length > 0) {
    if (currentY > 250) {
      doc.addPage();
      addHeaderBar(doc, campaignName, analysis.baseLabel);
      currentY = 28;
    }
    
    doc.setFontSize(14);
    doc.setTextColor(...BRAND_RGB);
    doc.text("3. Sugestões de Otimização", 14, currentY);
    
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    let suggestY = currentY + 8;
    analysis.suggestions.forEach(s => {
      const lines = doc.splitTextToSize(`• ${s}`, pw - 28);
      if (suggestY + (lines.length * 5) > 280) {
        doc.addPage();
        addHeaderBar(doc, campaignName, analysis.baseLabel);
        suggestY = 28;
      }
      doc.text(lines, 14, suggestY);
      suggestY += (lines.length * 5) + 2;
    });
    
    currentY = suggestY + 10;
  }

  // 4. Sinalização de Excesso
  const outliers = analysis.storeStats.filter(s => s.outliers.length > 0);
  if (outliers.length > 0) {
    if (currentY > 250) {
      doc.addPage();
      addHeaderBar(doc, campaignName, analysis.baseLabel);
      currentY = 28;
    }
    
    doc.setFontSize(14);
    doc.setTextColor(...BRAND_RGB);
    doc.text("4. Sinalização de Excesso", 14, currentY);

    const outlierBody = outliers.map(s => [
      s.name,
      s.outliers.length,
      s.mean.toFixed(1),
      s.stdDev.toFixed(1),
      s.max
    ]);

    autoTable(doc, {
      startY: currentY + 4,
      head: [["Peça", "Lojas acima padrão", "Média", "Desvio", "Máx"]],
      body: outlierBody,
      headStyles: { fillColor: BRAND_RGB, fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" }
      },
      alternateRowStyles: { fillColor: LIGHT_BG },
    });
  }

  const fileName = `analise-custos-${campaignName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.pdf`;
  doc.save(fileName);
}
