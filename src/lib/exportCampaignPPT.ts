import pptxgen from "pptxgenjs";

interface ExportPPTParams {
  campaign: { 
    name: string; 
    client_name?: string; 
    agency_name?: string; 
    status?: string; 
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
  const { campaign, pieces, kits } = params;
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";

  const totalSlides = 1 + 1 + pieces.length + kits.length + 1;
  const exportDate = new Date().toLocaleDateString();

  // 1. Preload images
  const pieceImages = await Promise.all(
    pieces.map(p => p.photo_url ? urlToBase64(p.photo_url) : Promise.resolve(null))
  );
  const kitImages = await Promise.all(
    kits.map(k => k.photo_url ? urlToBase64(k.photo_url) : Promise.resolve(null))
  );
  
  // Preload kit piece thumbnails
  const kitPiecesThumbnails = await Promise.all(
    kits.map(k => 
      Promise.all((k.pieces || []).slice(0, 5).map(kp => kp.photo_url ? urlToBase64(kp.photo_url) : Promise.resolve(null)))
    )
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SLIDE 1 — CAPA
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const slideCapa = pptx.addSlide();
  slideCapa.background = { color: COLORS.header };
  
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
    x: 0.4, y: 0.18, color: COLORS.white, fontSize: 12, fontFace: "Calibri", bold: true
  });
  
  slideIndice.addText(campaign.name, {
    x: 9.33, y: 0.18, w: 3.6, align: "right", color: COLORS.accent, fontSize: 11, fontFace: "Calibri"
  });

  // Listagem
  const combinedItems = [
    ...pieces.map(p => ({ type: "piece", name: p.name })),
    ...kits.map(k => ({ type: "kit", name: k.name }))
  ];

  const col1 = combinedItems.slice(0, Math.ceil(combinedItems.length / 2));
  const col2 = combinedItems.slice(Math.ceil(combinedItems.length / 2));

  const renderIndexCol = (items: typeof combinedItems, startX: number) => {
    items.forEach((item, idx) => {
      const y = 1.0 + (idx * 0.3);
      const num = String(idx + 1 + (startX > 1 ? col1.length : 0)).padStart(2, '0');
      const prefix = item.type === "kit" ? "KIT " : "";
      
      slideIndice.addText([
        { text: num, options: { color: COLORS.accent, bold: true } },
        { text: `  ${prefix}${item.name}`, options: { color: COLORS.textPrimary } }
      ], { x: startX, y, fontSize: 10, fontFace: "Calibri" });
    });
  };

  renderIndexCol(col1, 0.5);
  renderIndexCol(col2, 6.85);

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
    slide.addText("PEÇA", { x: 0.4, y: 0.10, color: COLORS.white, fontSize: 8, fontFace: "Calibri" });
    slide.addText(piece.name, { x: 0.4, y: 0.22, color: COLORS.white, fontSize: 13, fontFace: "Calibri", bold: true });
    slide.addText(String(idx + 1).padStart(2, '0'), { x: 12.0, y: 0.22, w: 1.0, align: "right", color: COLORS.accent, fontSize: 11, fontFace: "Calibri" });

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
    slide.addText(piece.name, { x: infoX + 0.2, y: currentY + 0.2, w: 5.7, color: COLORS.white, fontSize: 14, fontFace: "Calibri", bold: true });
    
    currentY += 0.9;

    const addField = (label: string, value: string | number | undefined, italic = false) => {
      if (value === undefined || value === "" || value === 0) return;
      slide.addText(label, { x: infoX, y: currentY, color: COLORS.textSecondary, fontSize: 8, fontFace: "Calibri" });
      currentY += 0.15;
      slide.addText(String(value), { x: infoX, y: currentY, w: 6.1, color: COLORS.textPrimary, fontSize: 10, fontFace: "Calibri", bold: !italic, italic });
      currentY += 0.35;
      slide.addShape(pptx.ShapeType.line, { x: infoX, y: currentY - 0.05, w: 6.1, line: { color: COLORS.border, width: 0.3 } });
      currentY += 0.1;
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
  // SLIDES DE KIT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  for (let idx = 0; idx < kits.length; idx++) {
    const kit = kits[idx];
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.bg };
    const pageNum = pieces.length + idx + 3;

    // Barra topo
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 13.33, h: 0.65, fill: { color: COLORS.header }
    });
    slide.addText("KIT", { x: 0.4, y: 0.10, color: COLORS.accent, fontSize: 8, fontFace: "Calibri", bold: true });
    slide.addText(kit.name, { x: 0.4, y: 0.22, color: COLORS.white, fontSize: 13, fontFace: "Calibri", bold: true });
    slide.addText(`K${String(idx + 1).padStart(2, '0')}`, { x: 12.0, y: 0.22, w: 1.0, align: "right", color: COLORS.accent, fontSize: 11, fontFace: "Calibri" });

    // ÁREA DA FOTO
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.35, y: 0.85, w: 6.2, h: 5.5, fill: { color: COLORS.cardBg }, line: { color: COLORS.border, width: 0.5 }
    });
    const b64 = kitImages[idx];
    if (b64) {
      const size = await getImageSize(b64);
      const maxWidth = 6.0;
      const maxHeight = 4.0;
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
      slide.addText("Sem foto", { x: 0.35, y: 0.85, w: 6.2, h: 4.0, align: "center", valign: "middle", color: COLORS.textSecondary, fontSize: 14 });
    }

    // Miniaturas das peças do kit
    if (kit.pieces && kit.pieces.length > 0) {
      slide.addText("PEÇAS DESTE KIT", { x: 0.45, y: 5.1, color: COLORS.textSecondary, fontSize: 8, fontFace: "Calibri" });
      const thumbs = kitPiecesThumbnails[idx];
      for (let tIdx = 0; tIdx < thumbs.length; tIdx++) {
        const thumbB64 = thumbs[tIdx];
        const tX = 0.45 + (tIdx * 1.2);
        const tY = 5.3;
        slide.addShape(pptx.ShapeType.rect, { x: tX, y: tY, w: 1.1, h: 0.9, fill: { color: COLORS.white }, line: { color: COLORS.border, width: 0.3 } });
        if (thumbB64) {
          const size = await getImageSize(thumbB64);
          const maxWidth = 1.0;
          const maxHeight = 0.8;
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
            data: thumbB64, 
            x: tX + 0.05 + (maxWidth - finalW) / 2, 
            y: tY + 0.05 + (maxHeight - finalH) / 2, 
            w: finalW, 
            h: finalH 
          });
        }
      }
    }

    // ÁREA DE INFORMAÇÕES
    const infoX = 6.85;
    let currentY = 0.85;
    
    slide.addShape(pptx.ShapeType.rect, {
      x: infoX, y: currentY, w: 6.1, h: 0.75, fill: { color: COLORS.header }
    });
    slide.addText(kit.name, { x: infoX + 0.2, y: currentY + 0.2, w: 5.7, color: COLORS.white, fontSize: 14, fontFace: "Calibri", bold: true });
    
    currentY += 0.9;

    const addField = (label: string, value: string | number | undefined, italic = false) => {
      if (value === undefined || value === "" || value === 0) return;
      slide.addText(label, { x: infoX, y: currentY, color: COLORS.textSecondary, fontSize: 8, fontFace: "Calibri" });
      currentY += 0.15;
      slide.addText(String(value), { x: infoX, y: currentY, w: 6.1, color: COLORS.textPrimary, fontSize: 10, fontFace: "Calibri", bold: !italic, italic });
      currentY += 0.35;
      slide.addShape(pptx.ShapeType.line, { x: infoX, y: currentY - 0.05, w: 6.1, line: { color: COLORS.border, width: 0.3 } });
      currentY += 0.1;
    };

    addField("DESCRIÇÃO", kit.description);
    addField("QUANTIDADE DE PEÇAS", kit.pieces_count);
    addField("CÓDIGO / REF", kit.code);
    addField("OBSERVAÇÕES", kit.observations, true);

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
