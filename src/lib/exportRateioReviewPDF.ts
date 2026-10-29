/* eslint-disable @typescript-eslint/no-explicit-any */
import { saveBlobAs } from "@/lib/saveBlobAs";
import { fetchImageBytes } from "@/lib/rateioGridShared";
import { FINDING_TYPE_LABELS, type RateioFinding, type RateioFindingType } from "@/lib/reviewRateio";

const BROWN: [number, number, number] = [140, 111, 78];
const DARK: [number, number, number] = [28, 25, 22];
const GREY: [number, number, number] = [102, 102, 102];
const BORDER: [number, number, number] = [224, 213, 200];
const WHITE: [number, number, number] = [255, 255, 255];
const SEV_LABEL = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;
const SEV_COLOR: Record<string, [number, number, number]> = {
  alta: [185, 28, 28],
  media: [180, 120, 20],
  baixa: [110, 110, 110],
};

type ImageEntry = { dataUrl: string; format: "PNG" | "JPEG" | "GIF" } | null;

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

async function loadImage(url: string, cache: Map<string, ImageEntry>): Promise<ImageEntry> {
  if (cache.has(url)) return cache.get(url) ?? null;
  const fetched = await fetchImageBytes(url, 5000);
  if (!fetched) {
    cache.set(url, null);
    return null;
  }
  const format = fetched.mime === "image/jpeg" ? "JPEG" : fetched.mime === "image/gif" ? "GIF" : "PNG";
  const entry: ImageEntry = { dataUrl: `data:${fetched.mime};base64,${bufferToBase64(fetched.buffer)}`, format };
  cache.set(url, entry);
  return entry;
}

export async function exportRateioReviewPDF(
  findings: RateioFinding[],
  opts: { campaignName: string; clientName?: string; onProgress?: (current: number, total: number) => void },
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const M = 12;
  const dateStr = new Date().toLocaleDateString("pt-BR");

  const header = () => {
    doc.setFillColor(...BROWN);
    doc.rect(0, 0, pw, 16, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Revisar Rateio — ${opts.campaignName}`, M, 10, { maxWidth: pw - 2 * M - 30 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(dateStr, pw - M, 10, { align: "right" });
    if (opts.clientName) {
      doc.setTextColor(...GREY);
      doc.setFontSize(8);
      doc.text(opts.clientName, M, 21);
    }
    return 26;
  };

  // Pré-carregar imagens com progresso
  const cache = new Map<string, ImageEntry>();
  const urls = [...new Set(findings.map((f) => f.itemImage).filter((u): u is string => !!u))];
  for (let i = 0; i < urls.length; i++) {
    await loadImage(urls[i], cache);
    try { opts.onProgress?.(i + 1, urls.length); } catch { /* ignore */ }
  }

  let y = header();
  doc.setTextColor(...DARK);

  if (findings.length === 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Nenhuma inconsistência encontrada", pw / 2, ph / 2, { align: "center" });
  } else {
    // Resumo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Resumo", M, y);
    y += 4;
    const bySev = (["alta", "media", "baixa"] as const).map((s) => [SEV_LABEL[s], String(findings.filter((f) => f.severity === s).length)]);
    const types = Object.keys(FINDING_TYPE_LABELS) as RateioFindingType[];
    const byType = types.map((t) => [FINDING_TYPE_LABELS[t], String(findings.filter((f) => f.type === t).length)]);
    autoTable(doc, {
      startY: y,
      head: [["Indicador", "Quantidade"]],
      body: [["Total de apontamentos", String(findings.length)], ...bySev.map(([a, b]) => [`Severidade ${a}`, b]), ...byType],
      theme: "grid",
      headStyles: { fillColor: BROWN, textColor: WHITE },
      styles: { fontSize: 9, lineColor: BORDER },
      margin: { left: M, right: M },
    });

    for (const t of types) {
      const list = findings.filter((f) => f.type === t);
      if (list.length === 0) continue;
      doc.addPage();
      y = header();
      doc.setTextColor(...BROWN);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(`${FINDING_TYPE_LABELS[t]} (${list.length})`, M, y);
      y += 6;

      for (const f of list) {
        const textX = M + 22;
        const textW = pw - textX - M;
        doc.setFontSize(9);
        const detailLines = doc.splitTextToSize(f.detail, textW);
        const blockH = Math.max(20, 10 + detailLines.length * 4);
        if (y + blockH > ph - 14) {
          doc.addPage();
          y = header();
        }
        doc.setDrawColor(...BORDER);
        doc.rect(M, y, 18, 18);
        const img = f.itemImage ? cache.get(f.itemImage) : null;
        if (img) {
          try { doc.addImage(img.dataUrl, img.format, M + 0.5, y + 0.5, 17, 17); } catch { /* ignore */ }
        } else {
          doc.setTextColor(...GREY);
          doc.setFontSize(6);
          doc.text("sem imagem", M + 9, y + 10, { align: "center" });
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...SEV_COLOR[f.severity]);
        doc.text(`[${SEV_LABEL[f.severity]}] ${f.title}`, textX, y + 4);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...DARK);
        doc.text(detailLines, textX, y + 9);
        y += blockH + 2;

        const w = f.storesWith ?? [];
        const wo = f.storesWithout ?? [];
        if (w.length || wo.length) {
          const rows = Array.from({ length: Math.max(w.length, wo.length) }, (_, i) => [w[i] ?? "", wo[i] ?? ""]);
          autoTable(doc, {
            startY: y,
            head: [["Tem", "Não tem"]],
            body: rows,
            theme: "grid",
            headStyles: { fillColor: BROWN, textColor: WHITE },
            styles: { fontSize: 8, lineColor: BORDER },
            margin: { left: textX, right: M, top: 26 },
            didDrawPage: () => { header(); },
          });
          y = (doc as any).lastAutoTable.finalY + 5;
        }
      }
    }
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text(`Página ${i} de ${total}`, pw / 2, ph - 6, { align: "center" });
  }

  const safe = (opts.campaignName || "campanha").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  const blob = doc.output("blob") as Blob;
  await saveBlobAs(blob, `Revisao_Rateio_${safe || "campanha"}.pdf`, {
    mimeType: "application/pdf",
    description: "Documento PDF (.pdf)",
    extension: ".pdf",
  });
}
