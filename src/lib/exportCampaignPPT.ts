import pptxgen from "pptxgenjs";

interface ExportPPTParams {
  campaign: { 
    name: string; 
    client_name?: string; 
    agency_name?: string; 
    status?: string; 
    cover_image_url?: string;
  };
  pieces: Array<{ 
    id: string; 
    name: string; 
    description?: string; 
    width?: number; 
    height?: number; 
    material?: string; 
    quantity?: number; 
    code?: string; 
    observations?: string; 
    status?: string; 
    photo_url?: string; 
  }>;
  kits: Array<{ 
    id: string; 
    name: string; 
    description?: string; 
    pieces_count?: number; 
    code?: string; 
    observations?: string; 
    photo_url?: string; 
    pieces?: Array<{ name: string; photo_url?: string }>; 
  }>;
  onProgress?: (current: number, total: number, label: string) => void;
}


const COLORS = {
  bg: "#FFFFFF",
  header: "#1A2238",       // Navy escuro Vimer
  accent: "#E63946",       // Vermelho/coral Vimer
  textPrimary: "#1A2238",
  textSecondary: "#5A6B85",
  cardBg: "#F4F5F8",
  border: "#D8DCE5",
  white: "#FFFFFF",
  grayMuted: "#A8B0C0"
};

async function getImageSize(base64: string): Promise<{ width: number, height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = base64;
  });
}

async function urlToBase64(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url);
    const b = await r.blob();
    return new Promise((res) => {
      const fr = new FileReader();
      fr.onloadend = () => res(fr.result as string);
      fr.readAsDataURL(b);
    });
  } catch (err) {
    console.error("Error converting URL to Base64:", err);
    return null;
  }
}

export async function exportCampaignPPT(params: ExportPPTParams): Promise<void> {
  const { campaign, pieces, kits, onProgress } = params;
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";

  // Map piece name -> kit name(s) for badge display
  const pieceToKits = new Map<string, string[]>();
  kits.forEach(k => {
    (k.pieces || []).forEach(kp => {
      const arr = pieceToKits.get(kp.name) || [];
      arr.push(k.name);
      pieceToKits.set(kp.name, arr);
    });
  });

  const totalSlides = 1 + 1 + pieces.length + 1;
  const exportDate = new Date().toLocaleDateString();

  // Progresso: imagens + capa + indice + cada peca + final + writeFile
  const totalImgs = (campaign.cover_image_url ? 1 : 0) + pieces.filter(p => p.photo_url).length;
  const totalSteps = totalImgs + 1 + 1 + pieces.length + 1 + 1;
  let step = 0;
  const tick = (label: string) => {
    step++;
    onProgress?.(step, totalSteps, label);
  };
  onProgress?.(0, totalSteps, "Iniciando...");

  // 1. Preload images com tick por imagem
  const loadWithTick = async (url: string | undefined | null, label: string) => {
    if (!url) return null;
    const r = await urlToBase64(url);
    tick(label);
    return r;
  };
  const [coverImageB64, ...pieceImages] = await Promise.all([
    campaign.cover_image_url ? loadWithTick(campaign.cover_image_url, "Carregando capa...") : Promise.resolve(null),
    ...pieces.map((p, i) => p.photo_url ? loadWithTick(p.photo_url, `Carregando imagem ${i + 1}/${pieces.length}...`) : Promise.resolve(null))
  ]);


  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SLIDE 1 — CAPA
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const slideCapa = pptx.addSlide();
  slideCapa.background = { color: COLORS.header };
  
  if (coverImageB64) {
    const size = await getImageSize(coverImageB64);
    const maxWidth = 13.33;
    const maxHeight = 7.5;
    let finalW = maxWidth;
    let finalH = maxHeight;

    if (size.width > 0 && size.height > 0) {
      const ratio = size.width / size.height;
      if (ratio > maxWidth / maxHeight) {
        // Image is wider than slide ratio
        finalH = maxWidth / ratio;
      } else {
        // Image is taller than slide ratio
        finalW = maxHeight * ratio;
      }
    }

    slideCapa.addImage({
      data: coverImageB64,
      x: (maxWidth - finalW) / 2,
      y: (maxHeight - finalH) / 2,
      w: finalW,
      h: finalH,
      sizing: { type: 'contain', w: finalW, h: finalH }
    });

    // Add a slight overlay to ensure text readability if needed, 
    // but the user wants it to fit perfectly, so let's keep text clean
    slideCapa.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: "#000000", transparency: 40 }
    });
  }

  // Barra vertical esquerda
  slideCapa.addShape(pptx.ShapeType.rect, { 
    x: 0, y: 0, w: 0.15, h: 7.5, fill: { color: COLORS.accent } 
  });
  
  slideCapa.addText(campaign.agency_name || "VIMER RETAIL EXPERIENCE", {
    x: 1.0, y: 0.35, color: COLORS.grayMuted, fontSize: 11, fontFace: "Calibri"
  });
  
  slideCapa.addText(campaign.client_name || "Cliente", {
    x: 1.0, y: 2.8, w: 11.33, color: COLORS.white, fontSize: 28, fontFace: "Calibri", bold: true
  });
  
  slideCapa.addText(campaign.name, {
    x: 1.0, y: 3.55, color: COLORS.accent, fontSize: 18, fontFace: "Calibri"
  });
  
  slideCapa.addText(exportDate, {
    x: 1.0, y: 6.9, color: COLORS.textSecondary, fontSize: 10, fontFace: "Calibri"
  });
  
  slideCapa.addText("Peças & Kits", {
    x: 10.0, y: 6.9, w: 3.0, align: "right", color: COLORS.textSecondary, fontSize: 10, fontFace: "Calibri"
  });
  tick("Capa gerada");


  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SLIDE 2 — ÍNDICE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const slideIndice = pptx.addSlide();
  slideIndice.background = { color: COLORS.bg };
  
  // Barra topo
  slideIndice.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: COLORS.header }
  });
  
  slideIndice.addText("ÍNDICE DE PEÇAS", {
    x: 0.4, y: 0, w: 6, h: 0.7, valign: "middle", color: COLORS.white, fontSize: 12, fontFace: "Calibri", bold: true
  });
  
  slideIndice.addText(campaign.name, {
    x: 7.0, y: 0, w: 5.93, h: 0.7, align: "right", valign: "middle", color: COLORS.accent, fontSize: 11, fontFace: "Calibri"
  });

  // Listagem - apenas peças
  const combinedItems = pieces.map(p => ({ name: p.name, kit: pieceToKits.get(p.name)?.[0] }));

  const half = Math.ceil(combinedItems.length / 2);
  const col1 = combinedItems.slice(0, half);
  const col2 = combinedItems.slice(half);

  const renderIndexCol = (items: typeof combinedItems, startX: number, offset: number) => {
    items.forEach((item, idx) => {
      const y = 1.0 + (idx * 0.3);
      const num = String(idx + 1 + offset).padStart(2, '0');
      const suffix = item.kit ? `  (${item.kit})` : "";

      slideIndice.addText([
        { text: num, options: { color: COLORS.accent, bold: true } },
        { text: `  ${item.name}`, options: { color: COLORS.textPrimary } },
        { text: suffix, options: { color: COLORS.textSecondary, italic: true } }
      ], { x: startX, y, fontSize: 10, fontFace: "Calibri" });
    });
  };

  renderIndexCol(col1, 0.5, 0);
  renderIndexCol(col2, 6.85, col1.length);

  // Rodapé índice
  slideIndice.addShape(pptx.ShapeType.line, {
    x: 0.4, y: 7.1, w: 12.53, line: { color: COLORS.border, width: 0.5 }
  });
  slideIndice.addText(`Página 2 / ${totalSlides}`, {
    x: 10.0, y: 7.2, w: 3.0, align: "right", color: COLORS.textSecondary, fontSize: 9, fontFace: "Calibri"
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SLIDES DE PEÇA
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  for (let idx = 0; idx < pieces.length; idx++) {
    const piece = pieces[idx];
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.bg };
    const pageNum = idx + 3;

    // Barra topo
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 13.33, h: 0.65, fill: { color: COLORS.header }
    });
    slide.addText([
      { text: "PEÇA\n", options: { fontSize: 7 } },
      { text: piece.name, options: { fontSize: 12, bold: true } }
    ], { x: 0.4, y: 0, w: 5.5, h: 0.65, valign: "middle", color: COLORS.white, fontFace: "Calibri" });

    const kitNames = pieceToKits.get(piece.name);
    if (kitNames && kitNames.length > 0) {
      slide.addText(`COMPÕE O KIT: ${kitNames.join(", ").toUpperCase()}`, {
        x: 6.0, y: 0, w: 5.8, h: 0.65, color: COLORS.accent, fontSize: 9, fontFace: "Calibri", bold: true, align: "right", valign: "middle"
      });
    }
    slide.addText(String(idx + 1).padStart(2, '0'), { x: 12.0, y: 0, w: 1.0, h: 0.65, align: "right", valign: "middle", color: COLORS.accent, fontSize: 11, fontFace: "Calibri" });

    // ÁREA DA FOTO (esquerda)
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.35, y: 0.85, w: 6.2, h: 5.5, fill: { color: COLORS.cardBg }, line: { color: COLORS.border, width: 0.5 }
    });
    const b64 = pieceImages[idx];
    if (b64) {
      const size = await getImageSize(b64);
      const maxWidth = 6.0;
      const maxHeight = 5.3;
      let finalW = maxWidth;
      let finalH = maxHeight;

      if (size.width > 0 && size.height > 0) {
        const ratio = size.width / size.height;
        if (ratio > maxWidth / maxHeight) {
          finalH = maxWidth / ratio;
        } else {
          finalW = maxHeight * ratio;
        }
      }

      slide.addImage({ 
        data: b64, 
        x: 0.45 + (maxWidth - finalW) / 2, 
        y: 0.95 + (maxHeight - finalH) / 2, 
        w: finalW, 
        h: finalH 
      });
    } else {
      slide.addText("Sem foto", { x: 0.35, y: 0.85, w: 6.2, h: 5.5, align: "center", valign: "middle", color: COLORS.textSecondary, fontSize: 14 });
    }

    // ÁREA DE INFORMAÇÕES (direita)
    const infoX = 6.85;
    let currentY = 0.85;
    
    slide.addShape(pptx.ShapeType.rect, {
      x: infoX, y: currentY, w: 6.1, h: 0.75, fill: { color: COLORS.header }
    });
    slide.addText(piece.name, { x: infoX + 0.2, y: currentY, w: 5.7, h: 0.75, valign: "middle", color: COLORS.white, fontSize: 14, fontFace: "Calibri", bold: true });
    
    currentY += 0.95;

    const addField = (label: string, value: string | number | undefined, italic = false) => {
      if (value === undefined || value === "" || value === 0) return;
      const str = String(value);
      // Estimate height more conservatively: ~65 chars per line at fontSize 10 within 6.1" width
      const lines = str.split("\n").reduce((acc, ln) => acc + Math.max(1, Math.ceil(ln.length / 65)), 0);
      const valueH = Math.max(0.25, lines * 0.25);
      
      // Label text box
      slide.addText(label, { x: infoX, y: currentY, w: 6.1, h: 0.2, color: COLORS.textSecondary, fontSize: 8, fontFace: "Calibri", bold: true });
      currentY += 0.25; // Increase gap between label and value
      
      // Value text box
      slide.addText(str, { x: infoX, y: currentY, w: 6.1, h: valueH, valign: "top", color: COLORS.textPrimary, fontSize: 10, fontFace: "Calibri", bold: !italic, italic });
      currentY += valueH + 0.1;
      
      // Separator line
      slide.addShape(pptx.ShapeType.line, { x: infoX, y: currentY, w: 6.1, line: { color: COLORS.border, width: 0.4 } });
      currentY += 0.15;
    };

    addField("DESCRIÇÃO", piece.description);
    const dim = (piece.width && piece.height) ? `${piece.width}cm × ${piece.height}cm` : undefined;
    addField("DIMENSÕES", dim);
    addField("MATERIAL", piece.material);
    addField("QUANTIDADE", piece.quantity);
    addField("CÓDIGO / REF", piece.code);
    addField("OBSERVAÇÕES", piece.observations, true);

    if (piece.status) {
      slide.addShape(pptx.ShapeType.rect, { x: infoX + 4.8, y: 6.0, w: 1.3, h: 0.3, fill: { color: COLORS.accent } });
      slide.addText(piece.status.toUpperCase(), { x: infoX + 4.8, y: 6.0, w: 1.3, h: 0.3, align: "center", valign: "middle", color: COLORS.white, fontSize: 8, fontFace: "Calibri", bold: true });
    }

    slide.addShape(pptx.ShapeType.line, { x: 0.4, y: 7.1, w: 12.53, line: { color: COLORS.border, width: 0.5 } });
    slide.addText(campaign.name, { x: 0.4, y: 7.2, color: COLORS.textSecondary, fontSize: 8, fontFace: "Calibri" });
    slide.addText(`Página ${pageNum} / ${totalSlides}`, { x: 10.0, y: 7.2, w: 3.0, align: "right", color: COLORS.textSecondary, fontSize: 9, fontFace: "Calibri" });
  }


  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SLIDE FINAL — ENCERRAMENTO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const slideFinal = pptx.addSlide();
  slideFinal.background = { color: COLORS.header };
  slideFinal.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.15, h: 7.5, fill: { color: COLORS.accent } });
  
  slideFinal.addText("Obrigado", {
    x: 0, y: 3.0, w: 13.33, align: "center", color: COLORS.white, fontSize: 36, fontFace: "Calibri", bold: true
  });
  
  slideFinal.addText(campaign.agency_name || "VIMER RETAIL EXPERIENCE", {
    x: 0, y: 3.8, w: 13.33, align: "center", color: COLORS.grayMuted, fontSize: 14, fontFace: "Calibri"
  });
  
  slideFinal.addText(exportDate, {
    x: 0, y: 6.9, w: 13.33, align: "center", color: COLORS.textSecondary, fontSize: 9, fontFace: "Calibri"
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // WRITE FILE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const fileName = `${campaign.name}_pecas_${new Date().toISOString().slice(0,10)}.pptx`;
  await pptx.writeFile({ fileName });
}
