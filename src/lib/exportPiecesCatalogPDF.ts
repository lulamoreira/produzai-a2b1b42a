export interface PieceCatalogPDFParams {
  campaign: {
    name: string;
    client_name?: string;
    agency_name?: string;
    cover_image_url?: string;
  };
  pieces: Array<{
    id: string;
    name: string;
    code?: string | number;
    size?: string;
    category?: string;
    sub_location?: string;
    specification?: string;
    installation_instructions?: string;
    custom_field_1?: string | null;
    custom_field_2?: string | null;
    custom_field_3?: string | null;
    custom_field_4?: string | null;
    custom_field_5?: string | null;
    photo_url?: string;
    is_new?: boolean;
  }>;
  kits: Array<{
    id: string;
    name: string;
    code?: string | number;
    pieces?: Array<{ name: string }>;
  }>;
  customFieldLabels?: Array<string | null>;
}

async function urlToBase64PDF(url: string): Promise<{ data: string; ext: "JPEG" | "PNG" } | null> {
  try {
    const r = await fetch(url);
    const blob = await r.blob();
    const ext: "JPEG" | "PNG" = blob.type.includes("png") ? "PNG" : "JPEG";
    return new Promise((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve({ data: fr.result as string, ext });
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getImgDims(base64: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = base64;
  });
}

function hexRGB(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

const C = {
  header:        "#1A2238",
  accent:        "#E63946",
  textPrimary:   "#1A2238",
  textSecondary: "#5A6B85",
  cardBg:        "#F4F5F8",
  border:        "#D8DCE5",
  white:         "#FFFFFF",
  grayMuted:     "#A8B0C0",
};

export async function exportPiecesCatalogPDF(params: PieceCatalogPDFParams): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { campaign, pieces, kits, customFieldLabels = [] } = params;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const M = 14;
  const exportDate = new Date().toLocaleDateString("pt-BR");
  const totalPages = pieces.length + 3;

  const pieceToKits = new Map<string, string[]>();
  kits.forEach(k => {
    (k.pieces || []).forEach(kp => {
      const arr = pieceToKits.get(kp.name) || [];
      arr.push(k.name);
      pieceToKits.set(kp.name, arr);
    });
  });

  const [coverImgResult, ...pieceImgResults] = await Promise.all([
    campaign.cover_image_url ? urlToBase64PDF(campaign.cover_image_url) : Promise.resolve(null),
    ...pieces.map(p => p.photo_url ? urlToBase64PDF(p.photo_url) : Promise.resolve(null)),
  ]);

  const addFooter = (pageNum: number) => {
    doc.setDrawColor(...hexRGB(C.border));
    doc.setLineWidth(0.25);
    doc.line(M, H - 12, W - M, H - 12);
    doc.setTextColor(...hexRGB(C.textSecondary));
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(campaign.name, M, H - 8);
    doc.text(`${pageNum} / ${totalPages}`, W - M, H - 8, { align: "right" });
  };

  // CAPA
  doc.setFillColor(...hexRGB(C.header));
  doc.rect(0, 0, W, H, "F");

  if (coverImgResult) {
    const dims = await getImgDims(coverImgResult.data);
    const areaW = W;
    const areaH = H * 0.60;
    let fw = areaW, fh = areaH;
    if (dims.w > 0 && dims.h > 0) {
      const ratio = dims.w / dims.h;
      if (ratio > areaW / areaH) { fh = areaW / ratio; } else { fw = areaH * ratio; }
    }
    doc.addImage(coverImgResult.data, coverImgResult.ext, (W - fw) / 2, (areaH - fh) / 2, fw, fh, undefined, "MEDIUM");
  }

  doc.setFillColor(...hexRGB(C.header));
  doc.rect(0, H * 0.56, W, H * 0.44, "F");
  doc.setFillColor(...hexRGB(C.accent));
  doc.rect(0, 0, 3.5, H, "F");

  const textY = H * 0.60;
  doc.setTextColor(...hexRGB(C.grayMuted));
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(campaign.agency_name || "", M + 4, textY + 4);

  doc.setTextColor(...hexRGB(C.white));
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(campaign.client_name || "Cliente", M + 4, textY + 18, { maxWidth: W - M * 2 - 4 });

  doc.setTextColor(...hexRGB(C.accent));
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(campaign.name, M + 4, textY + 30, { maxWidth: W - M * 2 - 4 });

  doc.setTextColor(...hexRGB(C.grayMuted));
  doc.setFontSize(9);
  doc.text("Catalogo de Pecas", M + 4, textY + 41);
  doc.setFontSize(8);
  doc.text(exportDate, M + 4, H - 8);

  // INDICE
  doc.addPage();
  doc.setFillColor(...hexRGB(C.header));
  doc.rect(0, 0, W, 18, "F");
  doc.setFillColor(...hexRGB(C.accent));
  doc.rect(0, 0, 3.5, 18, "F");

  doc.setTextColor(...hexRGB(C.white));
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("INDICE DE PECAS", M + 4, 12);
  doc.setTextColor(...hexRGB(C.accent));
  doc.setFontSize(9);
  doc.text(campaign.name, W - M, 12, { align: "right" });

  const half = Math.ceil(pieces.length / 2);
  const col1 = pieces.slice(0, half);
  const col2 = pieces.slice(half);

  const renderIndexCol = (items: typeof pieces, startX: number, offset: number) => {
    items.forEach((p, i) => {
      const y = 27 + i * 6.8;
      if (y > H - 18) return;
      const num = String(i + 1 + offset).padStart(2, "0");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...hexRGB(C.accent));
      doc.text(num, startX, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...hexRGB(C.textPrimary));
      const kitTag = pieceToKits.get(p.name)?.[0] ? ` (${pieceToKits.get(p.name)![0]})` : "";
      doc.text(p.name + kitTag, startX + 7, y, { maxWidth: 82 });
    });
  };

  renderIndexCol(col1, M + 4, 0);
  renderIndexCol(col2, W / 2 + 6, half);
  addFooter(2);

  // PAGINAS DE PECA
  for (let idx = 0; idx < pieces.length; idx++) {
    const p = pieces[idx];
    const imgResult = pieceImgResults[idx];
    const pageNum = idx + 3;

    doc.addPage();

    doc.setFillColor(...hexRGB(C.header));
    doc.rect(0, 0, W, 20, "F");
    doc.setFillColor(...hexRGB(C.accent));
    doc.rect(0, 0, 3.5, 20, "F");

    doc.setTextColor(...hexRGB(C.grayMuted));
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("PECA", M + 4, 9);

    doc.setTextColor(...hexRGB(C.white));
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(p.name, M + 4, 15.5, { maxWidth: W - M * 2 - 20 });

    const kitNames = pieceToKits.get(p.name);
    if (kitNames && kitNames.length > 0) {
      doc.setTextColor(...hexRGB(C.accent));
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(`KIT: ${kitNames.join(", ").toUpperCase()}`, W - M, 9, { align: "right" });
    }

    doc.setTextColor(...hexRGB(C.accent));
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(String(p.code ?? "").padStart(2, "0"), W - M, 15.5, { align: "right" });

    if (p.is_new) {
      doc.setFillColor(...hexRGB(C.accent));
      doc.rect(W - M - 22, 2, 22, 7, "F");
      doc.setTextColor(...hexRGB(C.white));
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.text("NOVA", W - M - 11, 6.5, { align: "center" });
    }

    const imgX = M + 4;
    const imgY = 24;
    const imgW = 85;
    const imgH = 130;

    doc.setFillColor(...hexRGB(C.cardBg));
    doc.setDrawColor(...hexRGB(C.border));
    doc.setLineWidth(0.25);
    doc.rect(imgX, imgY, imgW, imgH, "FD");

    if (imgResult) {
      const dims = await getImgDims(imgResult.data);
      const maxW = imgW - 4;
      const maxH = imgH - 4;
      let fw = maxW, fh = maxH;
      if (dims.w > 0 && dims.h > 0) {
        const ratio = dims.w / dims.h;
        if (ratio > maxW / maxH) { fh = maxW / ratio; } else { fw = maxH * ratio; }
      }
      doc.addImage(
        imgResult.data, imgResult.ext,
        imgX + 2 + (maxW - fw) / 2,
        imgY + 2 + (maxH - fh) / 2,
        fw, fh, undefined, "MEDIUM"
      );
    } else {
      doc.setTextColor(...hexRGB(C.grayMuted));
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Sem foto", imgX + imgW / 2, imgY + imgH / 2, { align: "center" });
    }

    const loc = p.sub_location ? `${p.category} / ${p.sub_location}` : (p.category || "");
    if (loc) {
      doc.setTextColor(...hexRGB(C.textSecondary));
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(loc, imgX, imgY + imgH + 6, { maxWidth: imgW });
    }

    const specX = imgX + imgW + 6;
    const specW = W - specX - M;
    let curY = imgY;

    doc.setFillColor(...hexRGB(C.header));
    doc.rect(specX, curY, specW, 13, "F");
    doc.setTextColor(...hexRGB(C.white));
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.text(p.name, specX + 2, curY + 9, { maxWidth: specW - 4 });
    curY += 16;

    const addField = (label: string, value: string | number | null | undefined) => {
      if (!value && value !== 0) return;
      const str = String(value).trim();
      if (!str) return;
      if (curY > H - 22) return;

      doc.setTextColor(...hexRGB(C.textSecondary));
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.text(label.toUpperCase(), specX, curY);
      curY += 4;

      doc.setTextColor(...hexRGB(C.textPrimary));
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(str, specW);
      const visibleLines = lines.slice(0, 6);
      doc.text(visibleLines, specX, curY);
      curY += visibleLines.length * 4 + 2;

      doc.setDrawColor(...hexRGB(C.border));
      doc.setLineWidth(0.2);
      doc.line(specX, curY, specX + specW, curY);
      curY += 3.5;
    };

    addField("Medidas", p.size);
    addField("Localizacao na Loja", loc);
    addField("Especificacao", p.specification);
    addField("Instrucoes de Instalacao", p.installation_instructions);

    const cfl = customFieldLabels;
    if (cfl[0] && p.custom_field_1) addField(cfl[0], p.custom_field_1);
    if (cfl[1] && p.custom_field_2) addField(cfl[1], p.custom_field_2);
    if (cfl[2] && p.custom_field_3) addField(cfl[2], p.custom_field_3);
    if (cfl[3] && p.custom_field_4) addField(cfl[3], p.custom_field_4);
    if (cfl[4] && p.custom_field_5) addField(cfl[4], p.custom_field_5);

    addFooter(pageNum);
  }

  // PAGINA FINAL
  doc.addPage();
  doc.setFillColor(...hexRGB(C.header));
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...hexRGB(C.accent));
  doc.rect(0, 0, 3.5, H, "F");

  doc.setTextColor(...hexRGB(C.white));
  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.text("Obrigado", W / 2, H / 2 - 8, { align: "center" });

  doc.setTextColor(...hexRGB(C.grayMuted));
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(campaign.agency_name || "", W / 2, H / 2 + 6, { align: "center" });
  doc.setFontSize(8);
  doc.text(exportDate, W / 2, H - 10, { align: "center" });

  const fileName = `${campaign.name}_catalogo_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
