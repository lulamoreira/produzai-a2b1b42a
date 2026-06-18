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
  onProgress?: (current: number, total: number, label: string) => void;
}


async function urlToBase64PDF(url: string): Promise<{ data: string; ext: "JPEG" | "PNG" } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
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

// Dimensões em mm — landscape 16:9 idêntico ao PPT LAYOUT_WIDE (13.33" x 7.5")
const W = 338.6;
const H = 190.5;

export async function exportPiecesCatalogPDF(params: PieceCatalogPDFParams): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { campaign, pieces, kits, customFieldLabels = [], onProgress } = params;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [H, W] });
  const exportDate = new Date().toLocaleDateString("pt-BR");
  const totalPages = pieces.length + 3;

  // Steps totais: imagens + capa + indice + paginas de peca + final
  const totalImgs = (campaign.cover_image_url ? 1 : 0) + pieces.filter(p => p.photo_url).length;
  const totalSteps = totalImgs + 1 + 1 + pieces.length + 1;
  let step = 0;
  const tick = (label: string) => {
    step++;
    onProgress?.(step, totalSteps, label);
  };
  onProgress?.(0, totalSteps, "Iniciando...");

  // mapa peça → kits
  const pieceToKits = new Map<string, string[]>();
  kits.forEach(k => {
    (k.pieces || []).forEach(kp => {
      const arr = pieceToKits.get(kp.name) || [];
      arr.push(k.name);
      pieceToKits.set(kp.name, arr);
    });
  });

  // pré-carrega todas as imagens em paralelo, reportando progresso individual
  const loadWithTick = async (url: string | undefined, label: string) => {
    if (!url) return null;
    const r = await urlToBase64PDF(url);
    tick(label);
    return r;
  };
  const [coverImg, ...pieceImgs] = await Promise.all([
    campaign.cover_image_url ? loadWithTick(campaign.cover_image_url, "Carregando capa...") : Promise.resolve(null),
    ...pieces.map((p, i) => p.photo_url ? loadWithTick(p.photo_url, `Carregando imagem ${i + 1}/${pieces.length}...`) : Promise.resolve(null)),
  ]);


  // helper rodapé
  const addFooter = (pageNum: number, text?: string) => {
    doc.setDrawColor(...hexRGB(C.border));
    doc.setLineWidth(0.3);
    doc.line(10, H - 8, W - 10, H - 8);
    doc.setTextColor(...hexRGB(C.textSecondary));
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(text || campaign.name, 10, H - 5);
    doc.text(`${pageNum} / ${totalPages}`, W - 10, H - 5, { align: "right" });
  };

  // ── CAPA ──────────────────────────────────────────────────

  doc.setFillColor(...hexRGB(C.header));
  doc.rect(0, 0, W, H, "F");

  if (coverImg) {
    const dims = await getImgDims(coverImg.data);
    const maxW = W, maxH = H;
    let fw = maxW, fh = maxH;
    if (dims.w > 0 && dims.h > 0) {
      const ratio = dims.w / dims.h;
      if (ratio > maxW / maxH) { fh = maxW / ratio; } else { fw = maxH * ratio; }
    }
    doc.addImage(coverImg.data, coverImg.ext, (W - fw) / 2, (H - fh) / 2, fw, fh, undefined, "MEDIUM");

    // overlay escuro para legibilidade
    doc.setFillColor(0, 0, 0);
    // jsPDF não tem alpha nativo — usamos um rect semitransparente via GState se disponível, senão banda no rodapé
    doc.setFillColor(...hexRGB(C.header));
    doc.rect(0, H * 0.62, W, H * 0.38, "F");
  }

  // stripe accent esquerda
  doc.setFillColor(...hexRGB(C.accent));
  doc.rect(0, 0, 3.8, H, "F");

  // textos da capa
  doc.setTextColor(...hexRGB(C.grayMuted));
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(campaign.agency_name || "", 10, H * 0.67);

  doc.setTextColor(...hexRGB(C.white));
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.text(campaign.client_name || "Cliente", 10, H * 0.73, { maxWidth: W - 20 });

  doc.setTextColor(...hexRGB(C.accent));
  doc.setFontSize(15);
  doc.setFont("helvetica", "normal");
  doc.text(campaign.name, 10, H * 0.82, { maxWidth: W - 20 });

  doc.setTextColor(...hexRGB(C.grayMuted));
  doc.setFontSize(9);
  doc.text("Catalogo de Pecas", 10, H * 0.88);

  doc.setTextColor(...hexRGB(C.textSecondary));
  doc.setFontSize(8);
  doc.text(exportDate, 10, H - 5);
  doc.text("Pecas & Kits", W - 10, H - 5, { align: "right" });
  tick("Capa gerada");


  // ── INDICE ───────────────────────────────────────────────

  doc.addPage();
  doc.setFillColor(...hexRGB(C.header));
  doc.rect(0, 0, W, 17.8, "F");
  doc.setFillColor(...hexRGB(C.accent));
  doc.rect(0, 0, 3.8, 17.8, "F");

  doc.setTextColor(...hexRGB(C.white));
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("INDICE DE PECAS", 10, 11.5);

  doc.setTextColor(...hexRGB(C.accent));
  doc.setFontSize(9);
  doc.text(campaign.name, W - 10, 11.5, { align: "right" });

  const half = Math.ceil(pieces.length / 2);

  const renderIndexCol = (items: typeof pieces, startX: number, offset: number) => {
    items.forEach((p, i) => {
      const y = 24 + i * 7.5;
      if (y > H - 12) return;
      const num = String(i + 1 + offset).padStart(2, "0");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...hexRGB(C.accent));
      doc.text(num, startX, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...hexRGB(C.textPrimary));
      const kitTag = pieceToKits.get(p.name)?.[0] ? ` (${pieceToKits.get(p.name)![0]})` : "";
      doc.text(p.name + kitTag, startX + 8, y, { maxWidth: 148 });
    });
  };

  renderIndexCol(pieces.slice(0, half), 10, 0);
  renderIndexCol(pieces.slice(half), W / 2 + 5, half);
  addFooter(2);
  tick("Indice gerado");


  // ── PAGINAS DE PECA ──────────────────────────────────────

  // Layout espelha o PPT: barra topo, imagem à esquerda, specs à direita

  // Medidas em mm convertidas das polegadas do PPT (1" = 25.4mm):
  //   header: y=0, h=16.5mm
  //   imagem: x=8.9, y=21.6, w=157.5, h=139.7
  //   specs:  x=174,  y=21.6, w=154.9
  //   rodapé: y=H-12

  const HDR_H  = 16.5;
  const IMG_X  = 8.9;
  const IMG_Y  = 21.6;
  const IMG_W  = 157.5;
  const IMG_H  = 145.0;
  const SPC_X  = 174.0;
  const SPC_W  = W - SPC_X - 8.9;

  for (let idx = 0; idx < pieces.length; idx++) {
    const p = pieces[idx];
    const imgResult = pieceImgs[idx];
    const pageNum = idx + 3;

    doc.addPage();

    // barra header topo
    doc.setFillColor(...hexRGB(C.header));
    doc.rect(0, 0, W, HDR_H, "F");
    doc.setFillColor(...hexRGB(C.accent));
    doc.rect(0, 0, 3.8, HDR_H, "F");

    // "PECA" label + nome
    doc.setTextColor(...hexRGB(C.grayMuted));
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("PECA", 10, 7.5);

    doc.setTextColor(...hexRGB(C.white));
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(p.name, 10, 13.5, { maxWidth: W - 50 });

    // kit badge (direita)
    const kitNames = pieceToKits.get(p.name);
    if (kitNames && kitNames.length > 0) {
      doc.setTextColor(...hexRGB(C.accent));
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(`COMPOE O KIT: ${kitNames.join(", ").toUpperCase()}`, W - 10, 7.5, { align: "right" });
    }

    // código (canto superior direito)
    doc.setTextColor(...hexRGB(C.accent));
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(String(p.code ?? "").padStart(2, "0"), W - 10, 13.5, { align: "right" });

    // badge "NOVA"
    if (p.is_new) {
      doc.setFillColor(...hexRGB(C.accent));
      doc.rect(W - 30, 1.5, 20, 6, "F");
      doc.setTextColor(...hexRGB(C.white));
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.text("NOVA", W - 20, 5.5, { align: "center" });
    }

    // caixa da imagem
    doc.setFillColor(...hexRGB(C.cardBg));
    doc.setDrawColor(...hexRGB(C.border));
    doc.setLineWidth(0.3);
    doc.rect(IMG_X, IMG_Y, IMG_W, IMG_H, "FD");

    if (imgResult) {
      const dims = await getImgDims(imgResult.data);
      const maxW = IMG_W - 4;
      const maxH = IMG_H - 4;
      let fw = maxW, fh = maxH;
      if (dims.w > 0 && dims.h > 0) {
        const ratio = dims.w / dims.h;
        if (ratio > maxW / maxH) { fh = maxW / ratio; } else { fw = maxH * ratio; }
      }
      doc.addImage(
        imgResult.data, imgResult.ext,
        IMG_X + 2 + (maxW - fw) / 2,
        IMG_Y + 2 + (maxH - fh) / 2,
        fw, fh, undefined, "MEDIUM"
      );
    } else {
      doc.setTextColor(...hexRGB(C.grayMuted));
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Sem foto", IMG_X + IMG_W / 2, IMG_Y + IMG_H / 2, { align: "center" });
    }

    // coluna de specs (direita)
    let curY = IMG_Y;

    // header escuro com nome da peça
    doc.setFillColor(...hexRGB(C.header));
    doc.rect(SPC_X, curY, SPC_W, 13, "F");
    doc.setTextColor(...hexRGB(C.white));
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(p.name, SPC_X + 3, curY + 9, { maxWidth: SPC_W - 5 });
    curY += 16;

    const addField = (label: string, value: string | number | null | undefined) => {
      if (!value && value !== 0) return;
      const str = String(value).trim();
      if (!str || curY > H - 15) return;
      doc.setTextColor(...hexRGB(C.textSecondary));
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.text(label.toUpperCase(), SPC_X, curY);
      curY += 4;
      doc.setTextColor(...hexRGB(C.textPrimary));
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(str, SPC_W);
      const visible = lines.slice(0, 5);
      doc.text(visible, SPC_X, curY);
      curY += visible.length * 4 + 2;
      doc.setDrawColor(...hexRGB(C.border));
      doc.setLineWidth(0.2);
      doc.line(SPC_X, curY, SPC_X + SPC_W, curY);
      curY += 3.5;
    };

    const loc = p.sub_location ? `${p.category} / ${p.sub_location}` : (p.category || "");
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
    tick(`Peca ${idx + 1}/${pieces.length}: ${p.name}`);
    // cede o thread pra UI atualizar a barra
    if (idx % 3 === 0) await new Promise(r => setTimeout(r, 0));
  }


  // ── SLIDE FINAL ───────────────────────────────────────────

  doc.addPage();
  doc.setFillColor(...hexRGB(C.header));
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...hexRGB(C.accent));
  doc.rect(0, 0, 3.8, H, "F");

  doc.setTextColor(...hexRGB(C.white));
  doc.setFontSize(36);
  doc.setFont("helvetica", "bold");
  doc.text("Obrigado", W / 2, H / 2 - 8, { align: "center" });

  doc.setTextColor(...hexRGB(C.grayMuted));
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(campaign.agency_name || "", W / 2, H / 2 + 6, { align: "center" });

  doc.setTextColor(...hexRGB(C.textSecondary));
  doc.setFontSize(9);
  doc.text(exportDate, W / 2, H - 5, { align: "center" });

  const fileName = `${campaign.name}_catalogo_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}