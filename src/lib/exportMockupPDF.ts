import jsPDF from "jspdf";
import { computeKitRolledUpStatus, type CampaignMockup, type MockupStatus } from "@/hooks/useMockups";
import { buildExportFileName } from "@/lib/exportFileName";

const STATUS_LABEL: Record<MockupStatus, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Reprovada",
  changes_requested: "Com alterações",
};

// RGB colors
const STATUS_RGB: Record<MockupStatus, [number, number, number]> = {
  pending: [148, 163, 184],
  approved: [22, 163, 74],
  rejected: [220, 38, 38],
  changes_requested: [217, 119, 6],
};

const DARK_BROWN: [number, number, number] = [74, 44, 42];
const RED: [number, number, number] = [220, 38, 38];
const TEXT: [number, number, number] = [30, 30, 30];
const MUTED: [number, number, number] = [120, 120, 120];

async function loadImage(url: string | null | undefined): Promise<{ data: string; w: number; h: number } | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { data: dataUrl, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

interface Params {
  campaignName: string;
  agencyName: string;
  clientName: string;
  mockups: CampaignMockup[];
  pieces: any[];
  kits: any[];
  kitPieces: any[];
}

export async function exportMockupPDF(params: Params): Promise<{ blob: Blob; fileName: string }> {
  const { campaignName, agencyName, clientName, mockups, pieces, kits } = params;

  const piecesById = new Map<string, any>();
  pieces.forEach((p) => piecesById.set(p.id, p));
  const kitsById = new Map<string, any>();
  kits.forEach((k) => kitsById.set(k.id, k));

  const componentsByParent = new Map<string, CampaignMockup[]>();
  mockups.forEach((m) => {
    if (m.parent_mockup_id) {
      const arr = componentsByParent.get(m.parent_mockup_id) || [];
      arr.push(m);
      componentsByParent.set(m.parent_mockup_id, arr);
    }
  });
  for (const [k, v] of componentsByParent) {
    v.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    componentsByParent.set(k, v);
  }

  const topLevel = mockups.filter((m) => !m.parent_mockup_id);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;

  let pageIndex = 0;

  const drawHeader = (titleText: string, status: MockupStatus) => {
    // Top context line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const ctx = [agencyName, clientName, campaignName].filter(Boolean).join("  •  ");
    doc.text(ctx, pageW / 2, 10, { align: "center" });

    // Title bar
    doc.setFillColor(...DARK_BROWN);
    doc.rect(margin, 14, pageW - margin * 2, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const t = doc.splitTextToSize(`MOCKUP — ${titleText}`, pageW - margin * 2 - 50)[0];
    doc.text(t, margin + 4, 22);

    // Status badge top right
    const [r, g, b] = STATUS_RGB[status];
    const label = STATUS_LABEL[status];
    doc.setFontSize(9);
    const labelW = doc.getTextWidth(label) + 6;
    doc.setFillColor(r, g, b);
    doc.rect(pageW - margin - labelW - 1, 17, labelW, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(label, pageW - margin - labelW / 2 - 1, 22, { align: "center" });
  };

  const drawFooter = (m: CampaignMockup) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const reviewedTxt = `Revisado em: ${fmtDate(m.reviewed_at)}`;
    doc.text(reviewedTxt, margin, pageH - 8);
    doc.text(`Página ${pageIndex}`, pageW - margin, pageH - 8, { align: "right" });
  };

  const drawField = (
    yStart: number,
    label: string,
    original: string | null | undefined,
    altActive: boolean,
    altValue: string | null | undefined
  ): number => {
    const colLabelW = 32;
    const colValueX = margin + colLabelW + 4;
    const valueW = pageW - margin - colValueX;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text(label, margin, yStart + 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const origText = original ? String(original) : "—";
    const origLines = doc.splitTextToSize(origText, valueW);
    doc.setTextColor(...TEXT);
    doc.text(origLines, colValueX, yStart + 4);
    let usedH = origLines.length * 4;

    if (altActive && altValue) {
      const altLines = doc.splitTextToSize(`→ ${altValue}`, valueW);
      doc.setTextColor(...RED);
      doc.text(altLines, colValueX, yStart + 4 + usedH + 1);
      usedH += altLines.length * 4 + 1;
      doc.setTextColor(...TEXT);
    }

    // Divider
    doc.setDrawColor(230);
    doc.line(margin, yStart + usedH + 3, pageW - margin, yStart + usedH + 3);

    return yStart + usedH + 5;
  };

  const renderPiecePage = async (m: CampaignMockup, titleOverride?: string) => {
    if (pageIndex > 0) doc.addPage();
    pageIndex++;

    const piece = m.piece_id ? piecesById.get(m.piece_id) : null;
    const kit = m.kit_id ? kitsById.get(m.kit_id) : null;
    const titleName = titleOverride || piece?.name || kit?.name || "—";

    drawHeader(titleName, m.status);

    // Image
    let y = 32;
    const imgUrl = piece?.image_url || kit?.image_url || null;
    const img = await loadImage(imgUrl);
    if (img) {
      const maxW = 80;
      const maxH = 70;
      const ratio = img.w / img.h;
      let w = maxW;
      let h = w / ratio;
      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }
      const x = (pageW - w) / 2;
      try {
        doc.addImage(img.data, x, y, w, h);
      } catch {
        // ignore image errors
      }
      y += maxH + 6;
    } else {
      doc.setDrawColor(220);
      doc.rect(margin, y, pageW - margin * 2, 60);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text("Sem imagem", pageW / 2, y + 32, { align: "center" });
      y += 66;
    }

    // Fields
    if (piece) {
      y = drawField(y, "Nome", piece.name, !!m.alt_name_active, m.alt_name);
      y = drawField(y, "Tamanho", piece.size, !!m.alt_size_active, m.alt_size);
      y = drawField(y, "Especificação", piece.specification, !!m.alt_specification_active, m.alt_specification);
      y = drawField(y, "Instalação", piece.installation_instructions, !!m.alt_installation_active, m.alt_installation);
    }

    // Observations box
    const obsY = y + 2;
    const obsH = Math.min(40, pageH - obsY - 14);
    doc.setDrawColor(180);
    doc.rect(margin, obsY, pageW - margin * 2, obsH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text("Observações", margin + 2, obsY + 5);
    doc.setFont("helvetica", "normal");
    const obsText = m.observations || "—";
    const obsLines = doc.splitTextToSize(obsText, pageW - margin * 2 - 4);
    doc.text(obsLines.slice(0, Math.floor((obsH - 8) / 4)), margin + 2, obsY + 10);

    drawFooter(m);
  };

  const renderKitOverviewPage = (kitMockup: CampaignMockup) => {
    if (pageIndex > 0) doc.addPage();
    pageIndex++;

    const kit = kitMockup.kit_id ? kitsById.get(kitMockup.kit_id) : null;
    const components = componentsByParent.get(kitMockup.id) || [];
    const rolled = components.length > 0 ? computeKitRolledUpStatus(components) : kitMockup.status;

    drawHeader(`KIT — ${kit?.name || "—"}`, rolled);

    let y = 34;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TEXT);
    doc.text(`${components.length} componente(s)`, margin, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    components.forEach((c, i) => {
      const cp = c.piece_id ? piecesById.get(c.piece_id) : null;
      const status = STATUS_LABEL[c.status];
      const line = `${i + 1}. ${cp?.name || "—"}   —   ${status}`;
      doc.setTextColor(...TEXT);
      const lines = doc.splitTextToSize(line, pageW - margin * 2);
      doc.text(lines, margin, y);
      y += lines.length * 4.5 + 1;
      if (y > pageH - 20) return;
    });

    if (kitMockup.observations) {
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.text("Observações do kit:", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const obs = doc.splitTextToSize(kitMockup.observations, pageW - margin * 2);
      doc.text(obs, margin, y);
    }

    drawFooter(kitMockup);
  };

  // Render
  for (const m of topLevel) {
    if (m.kit_id) {
      const components = componentsByParent.get(m.id) || [];
      renderKitOverviewPage(m);
      const kit = kitsById.get(m.kit_id);
      const kitName = kit?.name || "Kit";
      for (let i = 0; i < components.length; i++) {
        const c = components[i];
        const cp = c.piece_id ? piecesById.get(c.piece_id) : null;
        await renderPiecePage(c, `${kitName} — ${cp?.name || `Componente ${i + 1}`}`);
      }
    } else {
      await renderPiecePage(m);
    }
  }

  // Empty fallback page
  if (pageIndex === 0) {
    pageIndex = 1;
    drawHeader("Nenhum mockup", "pending");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(...MUTED);
    doc.text("Nenhum mockup para exportar.", pageW / 2, pageH / 2, { align: "center" });
  }

  const arrayBuffer = doc.output("arraybuffer");
  const blob = new Blob([arrayBuffer], { type: "application/pdf" });
  const fileName = buildExportFileName("Mockup", {
    agencyName,
    clientName,
    extension: "pdf",
  });
  return { blob, fileName };
}
