import type * as ExcelJS from "exceljs";
import { saveXlsxAs } from "./saveBlobAs";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "./supabasePaginate";
import { fetchVigenteRateio } from "@/hooks/useAdjustments";
import { getThumbnailUrl } from "./imageUrl";

// ─── Types ───────────────────────────────────────────────

export interface ExportCampaignPlanParams {
  campaign: { id: string; name: string };
  client: { id: string; name: string } | null | undefined;
  agency?: { name?: string } | null;
  pieces: any[]; // CampaignPiece[]
  kits: any[]; // CampaignKit[]
  kitPieces: any[]; // CampaignKitPiece[]
  stores: any[]; // ClientStore[]
  storePieces?: { store_id: string; piece_id: string; quantity: number }[]; // optional pre-fetched rateio
  winnerPrices?: Map<string, number>;
  onProgress?: (msg: string) => void;
}

// ─── Image helper ────────────────────────────────────────

async function fetchImageAsBase64(url: string): Promise<{ base64: string; ext: "png" | "jpeg" } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    let binary = "";
    uint8.forEach((b) => (binary += String.fromCharCode(b)));
    const base64 = btoa(binary);
    const ext = blob.type.includes("png") ? "png" : "jpeg";
    return { base64, ext };
  } catch {
    return null;
  }
}

// ─── Styling helpers ─────────────────────────────────────

const HEADER_FILL_ARGB = "FF1C1916";
const HEADER_FONT_ARGB = "FFFFFFFF";
const BORDER_ARGB = "FFCBD5E1";

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT_ARGB }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL_ARGB } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: BORDER_ARGB } },
      bottom: { style: "thin", color: { argb: BORDER_ARGB } },
      left: { style: "thin", color: { argb: BORDER_ARGB } },
      right: { style: "thin", color: { argb: BORDER_ARGB } },
    };
  });
  row.height = 28;
}

function styleBodyCell(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin", color: { argb: BORDER_ARGB } },
    bottom: { style: "thin", color: { argb: BORDER_ARGB } },
    left: { style: "thin", color: { argb: BORDER_ARGB } },
    right: { style: "thin", color: { argb: BORDER_ARGB } },
  };
  cell.alignment = { vertical: "middle", wrapText: true };
}

function safeFileSlug(s: string): string {
  return (s || "SEM_NOME")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ─── Active adjustment rateio (with source_piece remap) ──

async function fetchActiveAdjustmentRateio(
  campaignId: string,
): Promise<{ rows: { store_id: string; piece_id: string; quantity: number }[] } | null> {
  const { data: adj } = await supabase
    .from("campaign_adjustments")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("status", "active")
    .maybeSingle();
  if (!adj?.id) return null;

  const [piecesRes, spRows] = await Promise.all([
    supabase
      .from("campaign_adjustment_pieces")
      .select("id, source_piece_id, is_deleted")
      .eq("adjustment_id", adj.id),
    supabasePaginate<{ store_id: string; piece_id: string; quantity: number }>((from, to) =>
      supabase
        .from("campaign_adjustment_store_pieces" as never)
        .select("store_id, piece_id, quantity", { count: "exact" })
        .eq("adjustment_id", adj.id)
        .order("id").range(from, to) as any,
    ),
  ]);

  const adjToSource = new Map<string, string>();
  for (const p of ((piecesRes.data as any[]) || [])) {
    if (!p.is_deleted && p.source_piece_id) {
      adjToSource.set(String(p.id), String(p.source_piece_id));
    }
  }

  const rows = (spRows || []).map((r) => ({
    store_id: r.store_id,
    piece_id: adjToSource.get(String(r.piece_id)) ?? String(r.piece_id),
    quantity: Number(r.quantity) || 0,
  }));

  return { rows };
}

export async function resolveVigenteRateio(campaignId: string): Promise<{
  qtyMap: Record<string, number>;
  source: "adjustment" | "negotiation" | "original";
}> {
  const adj = await fetchActiveAdjustmentRateio(campaignId);
  if (adj && adj.rows.length > 0) {
    const qtyMap: Record<string, number> = {};
    for (const r of adj.rows) qtyMap[`${r.store_id}-${r.piece_id}`] = Number(r.quantity) || 0;
    return { qtyMap, source: "adjustment" };
  }

  // Winner supplier for negotiation fallback
  const { data: winner } = await supabase
    .from("budget_suppliers")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("is_winner", true)
    .maybeSingle();

  const v = await fetchVigenteRateio(campaignId, winner?.id ?? null);
  const qtyMap: Record<string, number> = {};
  for (const r of v.rows) qtyMap[`${r.store_id}-${r.piece_id}`] = Number(r.quantity) || 0;
  return { qtyMap, source: v.source };
}

export async function fetchWinnerPrices(campaignId: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const { data: winner } = await supabase
    .from("budget_suppliers")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("is_winner", true)
    .maybeSingle();
  if (!winner?.id) return map;
  const { data: prices } = await supabase
    .from("budget_prices")
    .select("piece_id, unit_price, adjusted_unit_price")
    .eq("campaign_id", campaignId)
    .eq("supplier_id", winner.id);
  for (const p of (prices as any[]) || []) {
    const price = p.adjusted_unit_price ?? p.unit_price;
    if (price != null && p.piece_id) {
      map.set(String(p.piece_id), Number(price) || 0);
    }
  }
  return map;
}

// ─── Main export ─────────────────────────────────────────

export async function exportCampaignPlan(params: ExportCampaignPlanParams): Promise<void> {
  const {
    campaign,
    client,
    pieces = [],
    kits = [],
    kitPieces = [],
    stores = [],
    storePieces,
    winnerPrices,
    onProgress,
  } = params;

  onProgress?.("Preparando dados...");

  // Resolve rateio vigente if not provided
  let qtyMap: Record<string, number> = {};
  if (storePieces && storePieces.length > 0) {
    for (const r of storePieces) qtyMap[`${r.store_id}-${r.piece_id}`] = Number(r.quantity) || 0;
  } else {
    const resolved = await resolveVigenteRateio(campaign.id);
    qtyMap = resolved.qtyMap;
  }

  // Resolve winner prices
  const prices = winnerPrices ?? (await fetchWinnerPrices(campaign.id));

  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "ProduzAI";

  // Top-level items: pieces that are NOT kit_only + kits, ordered by code
  const topPieces = pieces.filter((p: any) => !p.kit_only);
  type TopItem = { id: string; code: number; name: string; type: "piece" | "kit"; image_url?: string | null; specification?: string; size?: string; store_category?: string | null };
  const topItems: TopItem[] = [
    ...topPieces.map((p: any) => ({
      id: p.id, code: Number(p.code) || 0, name: p.name || "",
      type: "piece" as const, image_url: p.image_thumb_url || p.image_url,
      specification: p.specification || "", size: p.size || "",
      store_category: p.store_category || p.category,
    })),
    ...kits.map((k: any) => ({
      id: k.id, code: Number(k.code) || 0, name: k.name || "",
      type: "kit" as const, image_url: k.image_url,
      store_category: k.category,
    })),
  ].sort((a, b) => a.code - b.code);

  // Kit qty per store: derived from first kit_piece
  const firstKitPieceByKit = new Map<string, { piece_id: string; quantity: number }>();
  for (const kp of kitPieces) {
    if (!firstKitPieceByKit.has(kp.kit_id)) {
      firstKitPieceByKit.set(kp.kit_id, { piece_id: kp.piece_id, quantity: Number(kp.quantity) || 1 });
    }
  }

  function itemQtyForStore(item: TopItem, storeId: string): number {
    if (item.type === "piece") {
      return Number(qtyMap[`${storeId}-${item.id}`] || 0);
    }
    const first = firstKitPieceByKit.get(item.id);
    if (!first) return 0;
    const q = Number(qtyMap[`${storeId}-${first.piece_id}`] || 0);
    return first.quantity > 0 ? Math.round(q / first.quantity) : 0;
  }

  // ═══ ABA 1: DADOS NF ══════════════════════════════════
  {
    const ws = wb.addWorksheet("DADOS NF");
    ws.getColumn(1).width = 3;
    ws.getColumn(2).width = 25;
    ws.getColumn(3).width = 60;

    const labels = ["Razão Social", "CNPJ", "IE", "Endereço"];
    labels.forEach((label, i) => {
      const row = ws.getRow(2 + i);
      row.getCell(2).value = label;
      row.getCell(2).font = { bold: true };
      row.getCell(2).alignment = { vertical: "middle" };
      row.getCell(3).value = "";
      styleBodyCell(row.getCell(2));
      styleBodyCell(row.getCell(3));
      row.height = 22;
    });

    const tableStartRow = 2 + labels.length + 2;
    const headers = ["Descrição", "Código", "Unidade", "Valor Unitário", "Valor Total"];
    const header = ws.getRow(tableStartRow);
    headers.forEach((h, i) => (header.getCell(2 + i).value = h));
    styleHeaderRow(header);

    ws.getColumn(4).width = 15;
    ws.getColumn(5).width = 15;
    ws.getColumn(6).width = 18;
    ws.getColumn(7).width = 18;

    ws.views = [{ state: "frozen", ySplit: tableStartRow }];
  }

  // ═══ ABA 2: VAREJO ════════════════════════════════════
  {
    const ws = wb.addWorksheet("VAREJO");
    const fixedHeaders = [
      "PRIORIDADE ENVIO", "RAZÃO SOCIAL", "CNPJ", "MUNICÍPIO", "ESTADO",
      "TIPO DE LOJA", "TAMANHO", "MODELO", "NOME DO SHOPPING",
    ];
    const itemHeaders = topItems.map((it) => it.name);
    const trailingHeaders = ["VALOR POR LOJA", "PESO", "VOLUME", "MEDIDAS CAIXA", "TRANSPORTADORA", "NF"];

    const allHeaders = [...fixedHeaders, ...itemHeaders, ...trailingHeaders];
    const headerRow = ws.addRow(allHeaders);
    styleHeaderRow(headerRow);

    // Column widths
    ws.getColumn(1).width = 14;
    ws.getColumn(2).width = 35;
    ws.getColumn(3).width = 20;
    ws.getColumn(4).width = 20;
    ws.getColumn(5).width = 10;
    ws.getColumn(6).width = 15;
    ws.getColumn(7).width = 12;
    ws.getColumn(8).width = 18;
    ws.getColumn(9).width = 25;
    for (let i = 0; i < itemHeaders.length; i++) {
      ws.getColumn(fixedHeaders.length + 1 + i).width = 16;
    }
    for (let i = 0; i < trailingHeaders.length; i++) {
      ws.getColumn(fixedHeaders.length + itemHeaders.length + 1 + i).width = 18;
    }

    for (const store of stores) {
      const row: any[] = [
        "", // PRIORIDADE ENVIO
        store.name || "",
        store.cnpj || "",
        store.city || "",
        store.state || "",
        "", // TIPO DE LOJA (not in schema)
        "", // TAMANHO
        store.store_model || "",
        store.nickname || "",
      ];
      for (const it of topItems) {
        const q = itemQtyForStore(it, store.id);
        row.push(q > 0 ? q : "");
      }
      for (let i = 0; i < trailingHeaders.length; i++) row.push("");
      const added = ws.addRow(row);
      added.eachCell({ includeEmpty: true }, styleBodyCell);
    }

    ws.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];
  }

  // ═══ ABA 3: PEÇAS (catalog with images) ═══════════════
  {
    const ws = wb.addWorksheet("PEÇAS");
    const headers = ["Local de instalação", "Kit", "Imagem", "Nome da Peça", "Página", "Tamanho (cm)", "Especificação", "Quant", "Valor Unit", "Total"];
    const headerRow = ws.addRow(headers);
    styleHeaderRow(headerRow);

    ws.getColumn(1).width = 28;
    ws.getColumn(2).width = 20;
    ws.getColumn(3).width = 12;
    ws.getColumn(4).width = 35;
    ws.getColumn(5).width = 10;
    ws.getColumn(6).width = 18;
    ws.getColumn(7).width = 40;
    ws.getColumn(8).width = 10;
    ws.getColumn(9).width = 14;
    ws.getColumn(10).width = 14;

    // Kit lookup: piece_id → kit name
    const pieceToKitName = new Map<string, string>();
    for (const kp of kitPieces) {
      const kit = kits.find((k: any) => k.id === kp.kit_id);
      if (kit && !pieceToKitName.has(kp.piece_id)) pieceToKitName.set(kp.piece_id, kit.name);
    }

    // Order: follow display_order of top-level items (pieces not kit_only + kits),
    // with each kit's child pieces emitted immediately after the kit.
    // Group "TODAS AS LOJAS" always comes first when present.
    const groupOf = (p: any) => p.store_category || p.category || "SEM LOCAL";

    const pieceById = new Map<string, any>();
    for (const p of pieces) pieceById.set(String(p.id), p);
    const kitPiecesByKit = new Map<string, any[]>();
    for (const kp of kitPieces) {
      const arr = kitPiecesByKit.get(kp.kit_id) || [];
      arr.push(kp);
      kitPiecesByKit.set(kp.kit_id, arr);
    }
    for (const [, arr] of kitPiecesByKit) {
      arr.sort((a: any, b: any) =>
        (a.display_order ?? 0) - (b.display_order ?? 0) ||
        (Number(pieceById.get(String(a.piece_id))?.code) || 0) - (Number(pieceById.get(String(b.piece_id))?.code) || 0),
      );
    }

    type TopEntry = { kind: "piece" | "kit"; id: string; order: number };
    const topEntries: TopEntry[] = [
      ...pieces
        .filter((p: any) => !p.kit_only)
        .map((p: any) => ({ kind: "piece" as const, id: String(p.id), order: Number(p.display_order ?? 0) })),
      ...kits.map((k: any) => ({ kind: "kit" as const, id: String(k.id), order: Number(k.display_order ?? 0) })),
    ].sort((a, b) => a.order - b.order);

    const emitted = new Set<string>();
    const sorted: any[] = [];
    for (const entry of topEntries) {
      if (entry.kind === "piece") {
        const p = pieceById.get(entry.id);
        if (p && !emitted.has(entry.id)) {
          sorted.push(p);
          emitted.add(entry.id);
        }
      } else {
        for (const kp of kitPiecesByKit.get(entry.id) || []) {
          const p = pieceById.get(String(kp.piece_id));
          if (p && !emitted.has(String(p.id))) {
            sorted.push(p);
            emitted.add(String(p.id));
          }
        }
      }
    }
    // Append any remaining pieces not covered above (safety), preserving code order
    const remaining = pieces
      .filter((p: any) => !emitted.has(String(p.id)))
      .sort((a: any, b: any) => (Number(a.code) || 0) - (Number(b.code) || 0));
    sorted.push(...remaining);

    // Reorder so that "TODAS AS LOJAS" group (case-insensitive) appears first,
    // preserving relative order of pieces within that group.
    const isTodasLojas = (g: string) => (g || "").trim().toUpperCase() === "TODAS AS LOJAS";
    const todas = sorted.filter((p) => isTodasLojas(groupOf(p)));
    if (todas.length > 0) {
      const rest = sorted.filter((p) => !isTodasLojas(groupOf(p)));
      sorted.length = 0;
      sorted.push(...todas, ...rest);
    }

    // Total quantity per piece (across all stores) from qtyMap
    const totalQtyByPiece: Record<string, number> = {};
    for (const [key, val] of Object.entries(qtyMap)) {
      const pieceId = key.split("-").slice(1).join("-");
      totalQtyByPiece[pieceId] = (totalQtyByPiece[pieceId] || 0) + Number(val || 0);
    }

    // Pre-fetch images with progress
    const imageCache: Record<string, { base64: string; ext: "png" | "jpeg" } | null> = {};
    const withImages = sorted.filter((p: any) => p.image_thumb_url || p.image_url);
    onProgress?.(`Baixando imagens 0/${withImages.length}...`);
    let doneCount = 0;
    const CONCURRENCY = 6;
    const queue = withImages.slice();
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length) {
        const p: any = queue.shift();
        if (!p) break;
        const rawUrl = p.image_thumb_url || p.image_url;
        const url = getThumbnailUrl(rawUrl, 200, 70);
        imageCache[p.id] = await fetchImageAsBase64(url);
        doneCount++;
        if (doneCount % 5 === 0 || doneCount === withImages.length) {
          onProgress?.(`Baixando imagens ${doneCount}/${withImages.length}...`);
        }
      }
    });
    await Promise.all(workers);

    onProgress?.("Montando planilha PEÇAS...");

    let lastGroup: string | null = null;
    const IMAGE_ROW_HEIGHT = 48;
    let currentRowNum = 2;

    for (const p of sorted) {
      const group = groupOf(p);
      const showGroup = group !== lastGroup;
      lastGroup = group;

      const kitName = pieceToKitName.get(p.id) || "";
      const qty = totalQtyByPiece[p.id] || 0;
      const unitPrice = prices.get(p.id);

      const row = ws.addRow([
        showGroup ? group : "",
        kitName,
        "", // image placeholder
        p.name || "",
        "", // Página
        p.size || "",
        p.specification || "",
        qty > 0 ? qty : "",
        unitPrice != null ? unitPrice : "",
        "", // total will be formula
      ]);
      row.height = IMAGE_ROW_HEIGHT;
      row.eachCell({ includeEmpty: true }, styleBodyCell);

      // Total = Quant * Valor Unit — formula in EVERY piece row so it recalculates
      // automatically when the user fills the price/quantity manually.
      const totalCell = row.getCell(10);
      totalCell.value = { formula: `H${currentRowNum}*I${currentRowNum}` } as any;
      totalCell.numFmt = '"R$"#,##0.00';
      row.getCell(9).numFmt = '"R$"#,##0.00';

      if (showGroup) {
        row.getCell(1).font = { bold: true };
      }

      // Embed image
      const img = imageCache[p.id];
      if (img) {
        const imageId = wb.addImage({ base64: img.base64, extension: img.ext });
        ws.addImage(imageId, {
          tl: { col: 2.1, row: currentRowNum - 1 + 0.05 },
          ext: { width: 60, height: 60 },
        });
      }

      currentRowNum++;
    }

    // Total row
    const totalRow = ws.addRow(["", "", "", "", "", "", "TOTAL GERAL", "", "", { formula: `SUM(J2:J${currentRowNum - 1})` } as any]);
    totalRow.getCell(7).font = { bold: true };
    totalRow.getCell(7).alignment = { horizontal: "right" };
    totalRow.getCell(10).numFmt = '"R$"#,##0.00';
    totalRow.getCell(10).font = { bold: true };
    totalRow.eachCell({ includeEmpty: true }, styleBodyCell);
    totalRow.height = 26;

    ws.views = [{ state: "frozen", ySplit: 1 }];
  }

  // ═══ ABA 4: ORÇ TRANSP ════════════════════════════════
  {
    const ws = wb.addWorksheet("ORÇ TRANSP");
    const headers = [
      "RAZÃO SOCIAL", "CNPJ", "MUNICÍPIO", "ESTADO", "VALOR POR LOJA", "PESO", "VOLUME", "MEDIDAS CAIXA",
      "TRANSPORTADORA 1", "VALOR 1", "TRANSPORTADORA 2", "VALOR 2", "TRANSPORTADORA 3", "VALOR 3",
    ];
    const header = ws.addRow(headers);
    styleHeaderRow(header);

    ws.getColumn(1).width = 35;
    ws.getColumn(2).width = 20;
    ws.getColumn(3).width = 20;
    ws.getColumn(4).width = 10;
    for (let i = 5; i <= 14; i++) ws.getColumn(i).width = 18;

    for (const store of stores) {
      const row = ws.addRow([
        store.name || "", store.cnpj || "", store.city || "", store.state || "",
        "", "", "", "", "", "", "", "", "", "",
      ]);
      row.eachCell({ includeEmpty: true }, styleBodyCell);
    }
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }

  // ═══ ABA 5: RASTREIO ══════════════════════════════════
  {
    const ws = wb.addWorksheet("RASTREIO");
    const headers = [
      "PRIORIDADE ENVIO", "RAZÃO SOCIAL", "CNPJ", "MUNICÍPIO", "ESTADO",
      "NOME DO SHOPPING", "SAÍDA", "PRAZO", "ESTIMATIVA", "NÚMERO NF", "ENTREGA", "TRANSPORTADORA",
    ];
    const header = ws.addRow(headers);
    styleHeaderRow(header);

    ws.getColumn(1).width = 14;
    ws.getColumn(2).width = 35;
    ws.getColumn(3).width = 20;
    ws.getColumn(4).width = 20;
    ws.getColumn(5).width = 10;
    ws.getColumn(6).width = 25;
    for (let i = 7; i <= 12; i++) ws.getColumn(i).width = 16;

    for (const store of stores) {
      const row = ws.addRow([
        "", store.name || "", store.cnpj || "", store.city || "", store.state || "",
        store.nickname || "", "", "", "", "", "", "",
      ]);
      row.eachCell({ includeEmpty: true }, styleBodyCell);
    }
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }

  onProgress?.("Gerando arquivo...");
  const buffer = await wb.xlsx.writeBuffer();

  const clientSlug = safeFileSlug(client?.name || "CLIENTE");
  const campaignSlug = safeFileSlug(campaign.name);
  const fileName = `${clientSlug}_${campaignSlug}_PLAN.xlsx`;
  await saveXlsxAs(buffer as ArrayBuffer, fileName);
}
