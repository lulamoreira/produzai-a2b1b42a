import type { ClientStore, CampaignPiece, CampaignKit, CampaignKitPiece } from "@/hooks/useMultiClientData";
import { saveBlobAs } from "@/lib/saveBlobAs";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Palette
const DARK = "FF1C1916";
const BROWN = "FF8C6F4E";
const BEIGE = "FFF7F6F3";
const WHITE = "FFFFFFFF";
const GREY = "FF666666";
const BORDER = "FFE0D5C8";

type Item = {
  name: string;
  code: string | number;
  category: string;
  quantity: number;
  is_new: boolean;
};

function sanitizeSheetName(name: string, used: Set<string>) {
  let base = (name || "Loja").replace(/[\\/?*[\]:]/g, "").trim().slice(0, 31) || "Loja";
  let candidate = base;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = `~${i}`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
    i++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export async function exportRateioGrid(
  pieces: CampaignPiece[],
  kits: CampaignKit[],
  kitPieces: CampaignKitPiece[],
  stores: ClientStore[],
  qtyMap: Record<string, number>,
  campaignName: string,
  clientName: string,
  agencyName: string,
) {
  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "ProduzAI";

  const usedNames = new Set<string>();

  for (const store of stores) {
    // Build items for this store
    const items: Item[] = [];

    // Pieces
    for (const p of pieces) {
      const qty = qtyMap[`${store.id}-${p.id}`] || 0;
      if (qty > 0) {
        items.push({
          name: p.name || "",
          code: p.code || "",
          category: p.category || "—",
          quantity: qty,
          is_new: (p as any).is_new === true,
        });
      }
    }

    // Kits
    for (const k of kits) {
      const components = kitPieces.filter((kp) => kp.kit_id === k.id);
      if (components.length === 0) continue;
      const kitQty = Math.min(
        ...components.map((kp) => {
          const storeQty = qtyMap[`${store.id}-${kp.piece_id}`] || 0;
          return Math.floor(storeQty / (kp.quantity || 1));
        }),
      );
      if (kitQty > 0) {
        items.push({
          name: k.name || "",
          code: k.code || "",
          category: k.category || "—",
          quantity: kitQty,
          is_new: (k as any).is_new === true,
        });
      }
    }

    if (items.length === 0) continue;

    // Sort by category then name
    items.sort((a, b) => {
      const c = a.category.localeCompare(b.category, "pt-BR");
      if (c !== 0) return c;
      return a.name.localeCompare(b.name, "pt-BR");
    });

    const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);

    const ws = wb.addWorksheet(sanitizeSheetName(store.name || "Loja", usedNames), {
      views: [{ showGridLines: false }],
    });

    // Column widths A:H = 18
    for (let c = 1; c <= 8; c++) {
      ws.getColumn(c).width = 18;
    }

    // ─── Header rows 1–5 ───
    // Row 1: agency | client
    ws.mergeCells("A1:H1");
    const r1 = ws.getCell("A1");
    r1.value = [agencyName, clientName].filter(Boolean).join(" | ");
    r1.font = { name: "Arial", size: 10, color: { argb: WHITE } };
    r1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
    r1.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 20;

    // Row 2: campaign UPPER
    ws.mergeCells("A2:H2");
    const r2 = ws.getCell("A2");
    r2.value = (campaignName || "").toUpperCase();
    r2.font = { name: "Arial", size: 14, bold: true, color: { argb: WHITE } };
    r2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
    r2.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 24;

    // Row 3: store name
    ws.mergeCells("A3:H3");
    const r3 = ws.getCell("A3");
    r3.value = store.name || "";
    r3.font = { name: "Arial", size: 18, bold: true, color: { argb: DARK } };
    r3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
    r3.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(3).height = 30;

    // Row 4: code | city, state
    ws.mergeCells("A4:H4");
    const r4 = ws.getCell("A4");
    const cityState = [store.city, store.state].filter(Boolean).join(", ");
    r4.value = `Código: ${store.store_code || "—"} | ${cityState || "—"}`;
    r4.font = { name: "Arial", size: 10, color: { argb: BROWN } };
    r4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
    r4.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(4).height = 18;

    // Row 5: spacer
    ws.getRow(5).height = 8;

    // ─── Grid section ───
    const cardCols: Array<[string, string]> = [
      ["A", "B"],
      ["C", "D"],
      ["E", "F"],
      ["G", "H"],
    ];

    let lastDataRow = 5;

    items.forEach((item, idx) => {
      const gridRow = Math.floor(idx / 4);
      const gridCol = idx % 4;
      const top = 6 + gridRow * 5; // 4 data rows + 1 spacer
      const [colL, colR] = cardCols[gridCol];

      // Set row heights for this card row (only once per gridRow)
      if (gridCol === 0) {
        for (let i = 0; i < 4; i++) ws.getRow(top + i).height = 18;
        ws.getRow(top + 4).height = 8; // spacer below
      }

      // Lines
      const lines: Array<{ value: string; font: any }> = [
        {
          value: `📍 ${item.category}`,
          font: { name: "Arial", size: 9, bold: true, color: { argb: BROWN } },
        },
        {
          value: `${item.is_new ? "🆕 " : ""}${item.name}`,
          font: { name: "Arial", size: 11, bold: true, color: { argb: DARK } },
        },
        {
          value: `Cód: ${item.code || "—"}`,
          font: { name: "Arial", size: 9, color: { argb: GREY } },
        },
        {
          value: `Qtd: ${item.quantity}`,
          font: { name: "Arial", size: 10, bold: true, color: { argb: DARK } },
        },
      ];

      lines.forEach((line, i) => {
        const rowNum = top + i;
        ws.mergeCells(`${colL}${rowNum}:${colR}${rowNum}`);
        const cell = ws.getCell(`${colL}${rowNum}`);
        cell.value = line.value;
        cell.font = line.font;
        cell.alignment = { horizontal: "left", vertical: "middle", indent: 1, wrapText: true };
      });

      // Borders around the 4-row × 2-col block
      const borderColor = { argb: BORDER };
      const thin = { style: "thin" as const, color: borderColor };
      for (let i = 0; i < 4; i++) {
        const rowNum = top + i;
        const left = ws.getCell(`${colL}${rowNum}`);
        const right = ws.getCell(`${colR}${rowNum}`);
        const isTop = i === 0;
        const isBottom = i === 3;
        left.border = {
          left: thin,
          top: isTop ? thin : undefined,
          bottom: isBottom ? thin : undefined,
        };
        right.border = {
          right: thin,
          top: isTop ? thin : undefined,
          bottom: isBottom ? thin : undefined,
        };
      }

      lastDataRow = Math.max(lastDataRow, top + 3);
    });

    // ─── Total summary ───
    // 2 spacer rows, then merged summary
    const spacer1 = lastDataRow + 1;
    const spacer2 = lastDataRow + 2;
    const totalRow = lastDataRow + 3;
    ws.getRow(spacer1).height = 8;
    ws.getRow(spacer2).height = 8;
    ws.mergeCells(`A${totalRow}:H${totalRow}`);
    const tCell = ws.getCell(`A${totalRow}`);
    tCell.value = `Total de peças: ${totalQuantity}`;
    tCell.font = { name: "Arial", size: 14, bold: true, color: { argb: WHITE } };
    tCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
    tCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(totalRow).height = 28;
  }

  if (wb.worksheets.length === 0) {
    throw new Error("Nenhuma loja com quantidades preenchidas para exportar.");
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  await saveBlobAs(blob, `${campaignName} — Rateio por Loja.xlsx`, {
    mimeType: XLSX_MIME,
    description: "Planilha Excel (.xlsx)",
    extension: ".xlsx",
  });
}
