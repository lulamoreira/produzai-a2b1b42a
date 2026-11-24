/** PDF "Custo por grupo de lojas" (jsPDF + autotable). Somente leitura. */
import type { CampaignCostResult, CommonItem, GroupDef, GroupStats } from "@/lib/storeClusterCost";

const BRAND: [number, number, number] = [140, 111, 78];

export interface StoreClusterPdfParams {
  clientName: string;
  fieldLabel: string;
  groupDefs: GroupDef[];
  results: CampaignCostResult[];
  groups: GroupStats[];
  all: GroupStats;
  items: CommonItem[];
  topLabel: string;
  fmt: (v: number) => string;
  includeExtras: boolean;
}

/** Reduz a imagem (~120 px) e recomprime em JPEG 0.6 para não estourar o jsPDF. */
async function thumb(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, 120 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * scale));
    c.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.6);
  } catch {
    return null;
  }
}

function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export async function exportStoreClusterCostPDF(p: StoreClusterPdfParams): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pw = doc.internal.pageSize.getWidth();
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const title = (t: string, y: number) => { doc.setFontSize(13); doc.setTextColor(...BRAND); doc.text(t, 14, y); doc.setTextColor(0); };

  // Capa
  doc.setFillColor(...BRAND); doc.rect(0, 0, pw, 18, "F");
  doc.setTextColor(255); doc.setFontSize(16); doc.text("Custo por grupo de lojas", 14, 12);
  doc.setTextColor(0); doc.setFontSize(10);
  let y = 28;
  const line = (t: string) => { const ls = doc.splitTextToSize(t, pw - 28); doc.text(ls, 14, y); y += ls.length * 5; };
  line(`Cliente: ${p.clientName}`);
  line(`Data: ${todayBR()}`);
  line(`Agrupado por: ${p.fieldLabel}`);
  line(`Frete/instalação/desconto: ${p.includeExtras ? "incluídos" : "não incluídos"}`);
  autoTable(doc, {
    startY: y + 2,
    head: [["Campanha (versão usada)", "Vencedora"]],
    body: p.results.map((r) => [r.campaignName, r.supplierName]),
    headStyles: { fillColor: BRAND }, styles: { fontSize: 9 },
  });
  autoTable(doc, {
    startY: lastY() + 4,
    head: [["Grupo", "Valores incluídos"]],
    body: p.groupDefs.length ? p.groupDefs.map((g) => [g.name, g.values.map((v) => v || "(vazio)").join(", ") || "—"]) : [["—", "Cada valor é um grupo"]],
    headStyles: { fillColor: BRAND }, styles: { fontSize: 9 },
  });

  // Custo por grupo
  doc.addPage(); title("Custo por grupo", 14);
  autoTable(doc, {
    startY: 18,
    head: [["Grupo", "Lojas", "Total", "Média/loja", "Mediana", "Menor", "Maior", "Méd. produção", "Méd. frete+inst.", "Méd. desconto"]],
    body: [...p.groups, p.all].map((g) => [g.name, g.count, p.fmt(g.total), p.fmt(g.avg), p.fmt(g.median), p.fmt(g.min), p.fmt(g.max), p.fmt(g.avgProduction), p.fmt(g.avgLogistics), p.fmt(g.avgDiscount)]),
    headStyles: { fillColor: BRAND }, styles: { fontSize: 8 },
  });
  // Conciliação
  y = lastY() + 8; title("Conciliação", y);
  autoTable(doc, {
    startY: y + 3,
    head: [["Campanha", "Soma das lojas", "Total ao vivo da vencedora", "Diferença"]],
    body: p.results.map((r) => [r.campaignName, p.fmt(r.sumStores), p.fmt(r.officialTotal), p.fmt(r.difference)]),
    headStyles: { fillColor: BRAND }, styles: { fontSize: 8 },
  });
  doc.setFontSize(8);
  doc.text("Diferença = arredondamento de kits (o total oficial calcula os kits pelo total da campanha).", 14, lastY() + 5);
  // Gráfico
  y = lastY() + 14; title("Média por loja em cada grupo", y); y += 5;
  const maxAvg = Math.max(1, ...p.groups.map((g) => g.avg));
  doc.setFontSize(8);
  for (const g of p.groups) {
    if (y > doc.internal.pageSize.getHeight() - 12) { doc.addPage(); y = 16; }
    doc.text(g.name.slice(0, 30), 14, y + 3.5);
    doc.setFillColor(...BRAND);
    doc.rect(70, y, Math.max(0.5, ((pw - 130) * g.avg) / maxAvg), 5, "F");
    doc.text(p.fmt(g.avg), pw - 14, y + 3.5, { align: "right" });
    y += 7;
  }

  // Peças mais comuns
  doc.addPage(); title(`Peças mais comuns (${p.topLabel})`, 14);
  const imgs = new Map<string, string>();
  for (const it of p.items) if (it.imageUrl) { const d = await thumb(it.imageUrl); if (d) imgs.set(it.key, d); }
  const gn = p.groups.map((g) => g.name);
  autoTable(doc, {
    startY: 18,
    head: [["", "Cód.", "Item", "Lojas", "%", "Qtd.", "Preço un.", "Valor total", ...gn]],
    body: p.items.map((it) => ["", it.code ?? "—", (it.kind === "kit" && !/^kit\b/i.test(it.name) ? "KIT " : "") + it.name, it.stores, `${it.pct.toFixed(0)}%`, it.totalQty, p.fmt(it.unitPrice), p.fmt(it.totalValue), ...gn.map((g) => it.storesByGroup[g] ?? 0)]),
    headStyles: { fillColor: BRAND }, styles: { fontSize: 7, minCellHeight: 11, valign: "middle" },
    columnStyles: { 0: { cellWidth: 12 } },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const d = imgs.get(p.items[data.row.index]?.key);
      if (d) doc.addImage(d, "JPEG", data.cell.x + 1, data.cell.y + 1, 9, 9);
    },
  });

  // Lojas por grupo
  for (const g of p.groups) {
    doc.addPage(); title(`Lojas — ${g.name} (${g.count})`, 14);
    autoTable(doc, {
      startY: 18,
      head: [["Loja", "Cidade/UF", ...(p.results.length > 1 ? ["Campanha"] : []), "Produção", "Frete+inst.", "Desconto", "Total"]],
      body: g.stores.map((s) => [s.store.name, [s.store.city, s.store.state].filter(Boolean).join("/"), ...(p.results.length > 1 ? [p.results.find((r) => r.campaignId === s.campaignId)?.campaignName ?? ""] : []), p.fmt(s.production), p.fmt(s.freight + s.installation), p.fmt(s.discount), p.fmt(s.total)]),
      headStyles: { fillColor: BRAND }, styles: { fontSize: 8 },
    });
  }

  const d = new Date();
  const ds = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  const camp = (p.results[0]?.campaignName ?? "campanha").replace(/[\\/:*?"<>|]/g, "-");
  doc.save(`Custo por grupo - ${camp}${p.results.length > 1 ? ` +${p.results.length - 1}` : ""} - ${ds}.pdf`);
}
