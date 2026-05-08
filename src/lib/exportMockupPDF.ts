import jsPDF from "jspdf";
import { computeKitRolledUpStatus, type CampaignMockup, type MockupStatus } from "@/hooks/useMockups";
import { buildExportFileName } from "@/lib/exportFileName";

const STATUS_LABEL: Record<MockupStatus, string> = {
  pending: "PENDENTE",
  approved: "APROVADA",
  rejected: "REPROVADA",
  changes_requested: "COM ALTERAÇÕES",
};

const STATUS_RGB: Record<MockupStatus, [number, number, number]> = {
  pending: [120, 120, 120],
  approved: [22, 163, 74],
  rejected: [220, 38, 38],
  changes_requested: [217, 119, 6],
};

const DARK_BROWN: [number, number, number] = [74, 44, 42];
const RED: [number, number, number] = [220, 38, 38];
const TEXT: [number, number, number] = [30, 30, 30];
const MUTED: [number, number, number] = [120, 120, 120];
const LIGHT_BG: [number, number, number] = [245, 242, 237];
const ALT_BG: [number, number, number] = [254, 235, 235];

// Line height in mm for 9pt body
const LINE_H = 4.2;

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
  const contentW = pageW - margin * 2;

  let pageIndex = 0;

  const drawHeader = (titleText: string, status: MockupStatus) => {
    // Top context line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const ctx = [agencyName, clientName, campaignName].filter(Boolean).join("  •  ");
    doc.text(ctx, pageW / 2, 9, { align: "center" });

    // Title bar (dark brown)
    doc.setFillColor(...DARK_BROWN);
    doc.rect(margin, 13, contentW, 11, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    const t = doc.splitTextToSize(`MOCKUP — ${titleText}`, contentW - 8)[0];
    doc.text(t, margin + 4, 20.5);

    // Big status bar right below title
    const [r, g, b] = STATUS_RGB[status];
    const label = STATUS_LABEL[status];
    doc.setFillColor(r, g, b);
    doc.rect(margin, 24, contentW, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(label, pageW / 2, 29.7, { align: "center" });
  };

  const drawFooter = (m: CampaignMockup) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Revisado em: ${fmtDate(m.reviewed_at)}`, margin, pageH - 8);
    doc.text(`Página ${pageIndex}`, pageW - margin, pageH - 8, { align: "right" });
  };

  /**
   * Draw a labeled field row with original (gray) and optional proposed alternative (red).
   * Returns the new y after drawing.
   */
  const drawField = (
    yStart: number,
    label: string,
    original: string | null | undefined,
    altActive: boolean,
    altValue: string | null | undefined
  ): number => {
    const labelH = 4.5;
    const innerPad = 2.5;

    // Label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text(label.toUpperCase(), margin, yStart + 3.5);

    let y = yStart + labelH + 1.5;

    // Original value box (light gray)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const origText = original ? String(original).trim() : "—";
    const origLines = doc.splitTextToSize(origText, contentW - innerPad * 2) as string[];
    const origH = origLines.length * LINE_H + innerPad * 2;
    doc.setFillColor(...LIGHT_BG);
    doc.rect(margin, y, contentW, origH, "F");
    doc.setTextColor(...TEXT);
    doc.text(origLines, margin + innerPad, y + innerPad + LINE_H - 1.2);
    y += origH;

    // Alt value box (red tint)
    if (altActive && altValue && altValue.trim()) {
      y += 1.5;
      const altLines = doc.splitTextToSize(altValue.trim(), contentW - innerPad * 2 - 4) as string[];
      const tagH = 5;
      const altH = altLines.length * LINE_H + innerPad * 2 + tagH;

      // Background
      doc.setFillColor(...ALT_BG);
      doc.rect(margin, y, contentW, altH, "F");
      // Left red bar
      doc.setFillColor(...RED);
      doc.rect(margin, y, 1.6, altH, "F");

      // Tag
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...RED);
      doc.text("ALTERAÇÃO PROPOSTA", margin + innerPad + 2, y + tagH);

      // Alt text
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...RED);
      doc.text(altLines, margin + innerPad + 2, y + tagH + LINE_H - 0.4);

      y += altH;
    }

    return y + 3;
  };

  const renderPiecePage = async (m: CampaignMockup, titleOverride?: string) => {
    if (pageIndex > 0) doc.addPage();
    pageIndex++;

    const piece = m.piece_id ? piecesById.get(m.piece_id) : null;
    const kit = m.kit_id ? kitsById.get(m.kit_id) : null;
    const titleName = titleOverride || piece?.name || kit?.name || "—";

    drawHeader(titleName, m.status);

    let y = 38;

    // Image (left/center, fixed height)
    const imgUrl = piece?.image_url || kit?.image_url || null;
    const img = await loadImage(imgUrl);
    const imgBoxH = 55;
    if (img) {
      const maxW = 70;
      const ratio = img.w / img.h;
      let w = maxW;
      let h = w / ratio;
      if (h > imgBoxH) {
        h = imgBoxH;
        w = h * ratio;
      }
      const x = (pageW - w) / 2;
      try {
        doc.addImage(img.data, x, y, w, h);
      } catch {
        // ignore
      }
    } else {
      doc.setDrawColor(220);
      doc.rect(margin + 30, y, contentW - 60, imgBoxH);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text("Sem imagem", pageW / 2, y + imgBoxH / 2 + 1, { align: "center" });
    }
    y += imgBoxH + 6;

    // Helper: ensure space, otherwise add page (no header repeat — content continues)
    const ensure = (needed: number) => {
      if (y + needed > pageH - 15) {
        doc.addPage();
        pageIndex++;
        // light context line
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text(`(continuação) ${titleName}`, margin, 12);
        y = 18;
      }
    };

    // Fields
    if (piece) {
      const fields: [string, any, boolean, any][] = [
        ["Nome", piece.name, !!m.alt_name_active, m.alt_name],
        ["Tamanho", piece.size, !!m.alt_size_active, m.alt_size],
        ["Especificação", piece.specification, !!m.alt_specification_active, m.alt_specification],
        ["Instalação", piece.installation_instructions, !!m.alt_installation_active, m.alt_installation],
      ];
      for (const [label, orig, active, alt] of fields) {
        // Rough estimate to decide page break
        const estLines = doc.splitTextToSize(String(orig || "—"), contentW - 5).length;
        const estAlt = active && alt ? doc.splitTextToSize(String(alt), contentW - 9).length + 2 : 0;
        ensure(8 + estLines * LINE_H + estAlt * LINE_H);
        y = drawField(y, label, orig, active, alt);
      }
    }

    // Observations
    const obsText = (m.observations || "").trim();
    const obsLines = obsText ? doc.splitTextToSize(obsText, contentW - 5) : ["—"];
    ensure(10 + obsLines.length * LINE_H);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text("OBSERVAÇÕES", margin, y + 3.5);
    y += 6;
    doc.setFillColor(...LIGHT_BG);
    const obsBoxH = obsLines.length * LINE_H + 5;
    doc.rect(margin, y, contentW, obsBoxH, "F");
    doc.setFont("helvetica", "normal");
    doc.text(obsLines, margin + 2.5, y + LINE_H);

    drawFooter(m);
  };

  const renderKitOverviewPage = (kitMockup: CampaignMockup) => {
    if (pageIndex > 0) doc.addPage();
    pageIndex++;

    const kit = kitMockup.kit_id ? kitsById.get(kitMockup.kit_id) : null;
    const components = componentsByParent.get(kitMockup.id) || [];
    const rolled = components.length > 0 ? computeKitRolledUpStatus(components) : kitMockup.status;

    drawHeader(`KIT — ${kit?.name || "—"}`, rolled);

    let y = 40;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TEXT);
    doc.text(`${components.length} componente(s)`, margin, y);
    y += 7;

    components.forEach((c, i) => {
      if (y > pageH - 20) return;
      const cp = c.piece_id ? piecesById.get(c.piece_id) : null;
      const [r, g, b] = STATUS_RGB[c.status];

      // Status pill
      const label = STATUS_LABEL[c.status];
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const pillW = doc.getTextWidth(label) + 4;
      doc.setFillColor(r, g, b);
      doc.rect(margin, y - 3.5, pillW, 5, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(label, margin + pillW / 2, y, { align: "center" });

      // Name
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...TEXT);
      const name = `${i + 1}. ${cp?.name || "—"}`;
      doc.text(name, margin + pillW + 3, y);
      y += 7;
    });

    if (kitMockup.observations) {
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("OBSERVAÇÕES DO KIT", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const obs = doc.splitTextToSize(kitMockup.observations, contentW - 5) as string[];
      doc.setFillColor(...LIGHT_BG);
      doc.rect(margin, y, contentW, obs.length * LINE_H + 5, "F");
      doc.text(obs, margin + 2.5, y + LINE_H);
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
