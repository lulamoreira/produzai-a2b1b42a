import type { PortalData } from "@/pages/StorePortal";
import { getThumbnailUrl } from "@/lib/imageUrl";

function sanitize(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function loadImageAsDataUrl(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { dataUrl, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

export async function exportStorePiecesPDF(data: PortalData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const { tipos, subdivisoes, pecas, lojas, store, campaign } = data;

  // Same filter logic as StorePortalPieceGrid
  const assignedTipoIds = new Set(lojas.filter(l => l.tipo_id && !l.subdivisao_id).map(l => l.tipo_id!));
  const assignedSubIds = new Set(lojas.filter(l => l.subdivisao_id).map(l => l.subdivisao_id!));
  const hasAssignments = assignedTipoIds.size > 0 || assignedSubIds.size > 0;

  const filteredPecas = hasAssignments
    ? pecas.filter(p =>
        (p.tipo_id && assignedTipoIds.has(p.tipo_id) && !p.subdivisao_id) ||
        (p.subdivisao_id && assignedSubIds.has(p.subdivisao_id))
      )
    : pecas;

  const relevantTipoIds = new Set([
    ...assignedTipoIds,
    ...subdivisoes.filter(s => assignedSubIds.has(s.id)).map(s => s.tipo_id),
  ]);

  const grouped = tipos
    .filter(t => !hasAssignments || relevantTipoIds.has(t.id))
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map(tipo => {
      const tipoSubs = subdivisoes
        .filter(s => s.tipo_id === tipo.id)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

      const tipoPecas = filteredPecas
        .filter(p => p.tipo_id === tipo.id && !p.subdivisao_id)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

      const subGroups = tipoSubs
        .map(sub => ({
          sub,
          pecas: filteredPecas
            .filter(p => p.subdivisao_id === sub.id)
            .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
        }))
        .filter(g => g.pecas.length > 0);

      return { tipo, pecasNoSub: tipoPecas, subGroups };
    })
    .filter(g => g.pecasNoSub.length > 0 || g.subGroups.length > 0);

  // Preload images
  const uniqueImageUrls = Array.from(new Set(filteredPecas.map(p => p.image_url).filter(Boolean) as string[]));
  const imageCache = new Map<string, { dataUrl: string; w: number; h: number } | null>();
  await Promise.all(
    uniqueImageUrls.map(async (url) => {
      const thumb = getThumbnailUrl(url, 200);
      const loaded = await loadImageAsDataUrl(thumb);
      imageCache.set(url, loaded);
    })
  );

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  const storeName = store.nickname || store.name;
  const storeLoc = [store.city, store.state].filter(Boolean).join("/");
  const storeCode = store.store_code ? ` (${store.store_code})` : "";
  const agencyName = campaign.clients.agencies.name;
  const clientName = campaign.clients.name;

  // Header
  doc.setFillColor(140, 111, 78);
  doc.rect(0, 0, pw, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text(`${storeName}${storeCode}${storeLoc ? ` — ${storeLoc}` : ""}`, 14, 10);
  doc.setFontSize(9);
  doc.text(`${campaign.name} · ${clientName} · ${agencyName}`, 14, 17);
  doc.setTextColor(0, 0, 0);

  let cursorY = 30;

  const renderGroup = (title: string, count: number, items: PortalData["pecas"]) => {
    if (cursorY > ph - 40) { doc.addPage(); cursorY = 20; }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${title} — ${count} peça${count === 1 ? "" : "s"}`, 14, cursorY);
    cursorY += 4;
    doc.setFont("helvetica", "normal");

    const body = items.map(p => [p, p.nome]);
    autoTable(doc, {
      startY: cursorY,
      head: [["Imagem", "Peça"]],
      body: body.map(() => ["", ""]),
      columnStyles: {
        0: { cellWidth: 22, minCellHeight: 20 },
        1: { cellWidth: "auto", valign: "middle" },
      },
      headStyles: { fillColor: [140, 111, 78], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 10 },
      didDrawCell: (hookData) => {
        if (hookData.section !== "body") return;
        const peca = items[hookData.row.index];
        if (!peca) return;
        if (hookData.column.index === 0 && peca.image_url) {
          const img = imageCache.get(peca.image_url);
          if (img && img.dataUrl) {
            const cell = hookData.cell;
            const pad = 1;
            const maxW = cell.width - pad * 2;
            const maxH = cell.height - pad * 2;
            const ratio = img.w / img.h;
            let w = maxW; let h = w / ratio;
            if (h > maxH) { h = maxH; w = h * ratio; }
            const x = cell.x + (cell.width - w) / 2;
            const y = cell.y + (cell.height - h) / 2;
            try {
              const fmt = img.dataUrl.includes("image/png") ? "PNG" : "JPEG";
              doc.addImage(img.dataUrl, fmt, x, y, w, h);
            } catch { /* ignore */ }
          }
        }
        if (hookData.column.index === 1) {
          // text already drawn? Override with name
          doc.setFontSize(10);
          doc.setTextColor(0, 0, 0);
          doc.text(peca.nome, hookData.cell.x + 2, hookData.cell.y + hookData.cell.height / 2 + 1, { baseline: "middle" });
        }
      },
      margin: { left: 14, right: 14 },
    });
    // @ts-expect-error lastAutoTable provided by autotable
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 6;
  };

  let totalPieces = 0;
  for (const { tipo, pecasNoSub, subGroups } of grouped) {
    if (pecasNoSub.length > 0) {
      renderGroup(tipo.nome.toUpperCase(), pecasNoSub.length, pecasNoSub);
      totalPieces += pecasNoSub.length;
    }
    for (const { sub, pecas: subPecas } of subGroups) {
      renderGroup(`${tipo.nome.toUpperCase()} · ${sub.nome}`, subPecas.length, subPecas);
      totalPieces += subPecas.length;
    }
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  const now = new Date().toLocaleString("pt-BR");
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Gerado em ${now} · Total: ${totalPieces} peças`, 14, ph - 8);
    doc.text(`${i}/${pageCount}`, pw - 14, ph - 8, { align: "right" });
  }

  const fileName = `Pecas_${sanitize(storeName)}_${sanitize(campaign.name)}.pdf`;
  doc.save(fileName);
}
