/**
 * Export helpers for the Rateio Comparison report:
 *   - exportRateioComparisonXLSX: generates a 3-sheet .xlsx via exceljs
 *   - buildRateioComparisonText: returns a copy-pasteable plain-text report
 */

import type { RateioDiff, ItemDiff, StoreDiff } from "./rateioComparison";
import { saveBlobAs } from "./saveBlobAs";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const safeSheetName = (name: string) => name.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Aba";

const formatDateTimeStamp = (d = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};

const formatDateTimeHuman = (d = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const itemTypeLabel = (item: ItemDiff): string => (item.kind === "kit" ? "Kit" : "Peça");

const changeKindLabel = (s: StoreDiff): string => {
  if (s.type === "added") return "Loja adicionada";
  if (s.type === "removed") return "Loja removida";
  return "Quantidade alterada";
};

export interface RateioComparisonMeta {
  campaignName: string;
  clientName: string;
  agencyName: string;
  currentLabel: string;
  previousLabel: string;
}

export async function exportRateioComparisonXLSX(
  diff: RateioDiff,
  meta: RateioComparisonMeta
): Promise<void> {
  const ExcelJSModule = await import("exceljs");
  const ExcelJSRuntime = ExcelJSModule.default;
  const wb = new ExcelJSRuntime.Workbook();
  wb.creator = "ProduzAI";
  wb.created = new Date();

  // ---------- Sheet 1: Cabeçalho ----------
  const wsHeader = wb.addWorksheet(safeSheetName("Cabeçalho"), {
    views: [{ showGridLines: false }],
  });
  wsHeader.columns = [
    { header: "Campo", key: "k", width: 28 },
    { header: "Valor", key: "v", width: 64 },
  ];
  const headerRows = [
    ["Agência", meta.agencyName],
    ["Cliente", meta.clientName],
    ["Campanha", meta.campaignName],
    ["Versão atual", meta.currentLabel],
    ["Versão anterior", meta.previousLabel],
    ["Gerado em", formatDateTimeHuman()],
    ["Peças alteradas", String(diff.summary.piecesChanged)],
    ["Kits alterados", String(diff.summary.kitsChanged)],
    ["Lojas adicionadas (somatório)", String(diff.summary.storesAdded)],
    ["Lojas removidas (somatório)", String(diff.summary.storesRemoved)],
    ["Lojas alteradas (somatório)", String(diff.summary.storesModified)],
    ["Total geral anterior", String(diff.summary.totalQuantityPrevious)],
    ["Total geral atual", String(diff.summary.totalQuantityCurrent)],
    ["Diferença total", String(diff.summary.totalQuantityDiff)],
  ];
  for (const [k, v] of headerRows) {
    wsHeader.addRow({ k, v });
  }
  wsHeader.getRow(1).font = { bold: true };

  // ---------- Sheet 2: Resumo ----------
  const wsSummary = wb.addWorksheet(safeSheetName("Resumo"), {
    views: [{ showGridLines: false, state: "frozen", ySplit: 1 }],
  });
  wsSummary.columns = [
    { header: "Código", key: "code", width: 10 },
    { header: "Tipo", key: "type", width: 8 },
    { header: "Nome", key: "name", width: 48 },
    { header: "Total anterior", key: "prev", width: 16 },
    { header: "Total atual", key: "curr", width: 16 },
    { header: "Diferença", key: "diff", width: 14 },
    { header: "Lojas adicionadas", key: "added", width: 18 },
    { header: "Lojas removidas", key: "removed", width: 18 },
    { header: "Lojas alteradas", key: "modified", width: 18 },
  ];
  wsSummary.getRow(1).font = { bold: true };

  // Order: top-level items by code ascending. Components of kits are NOT duplicated here.
  for (const it of diff.items) {
    wsSummary.addRow({
      code: it.code ?? "",
      type: itemTypeLabel(it),
      name: it.name,
      prev: it.totalPrevious,
      curr: it.totalCurrent,
      diff: it.totalDiff,
      added: it.added.length,
      removed: it.removed.length,
      modified: it.modified.length,
    });
    if (it.kind === "kit" && it.children) {
      for (const child of it.children) {
        wsSummary.addRow({
          code: child.code ?? "",
          type: `  ↳ ${itemTypeLabel(child)}`,
          name: `  ↳ ${child.name}`,
          prev: child.totalPrevious,
          curr: child.totalCurrent,
          diff: child.totalDiff,
          added: child.added.length,
          removed: child.removed.length,
          modified: child.modified.length,
        });
      }
    }
  }

  // ---------- Sheet 3: Detalhes por loja ----------
  const wsDetails = wb.addWorksheet(safeSheetName("Detalhes por loja"), {
    views: [{ showGridLines: false, state: "frozen", ySplit: 1 }],
  });
  wsDetails.columns = [
    { header: "Código peça/kit", key: "icode", width: 14 },
    { header: "Tipo", key: "itype", width: 8 },
    { header: "Peça/Kit", key: "iname", width: 36 },
    { header: "Código loja", key: "scode", width: 16 },
    { header: "Loja", key: "sname", width: 32 },
    { header: "Cidade", key: "city", width: 22 },
    { header: "UF", key: "state", width: 6 },
    { header: "Qtd anterior", key: "prev", width: 14 },
    { header: "Qtd atual", key: "curr", width: 14 },
    { header: "Diferença", key: "diff", width: 12 },
    { header: "Tipo de mudança", key: "ctype", width: 22 },
  ];
  wsDetails.getRow(1).font = { bold: true };

  const pushItemRows = (item: ItemDiff) => {
    const blocks: StoreDiff[][] = [item.added, item.modified, item.removed];
    for (const block of blocks) {
      for (const s of block) {
        wsDetails.addRow({
          icode: item.code ?? "",
          itype: itemTypeLabel(item),
          iname: item.name,
          scode: s.store.store_code || "",
          sname: s.store.name,
          city: s.store.city || "",
          state: s.store.state || "",
          prev: s.previous,
          curr: s.current,
          diff: s.diff,
          ctype: changeKindLabel(s),
        });
      }
    }
  };

  for (const it of diff.items) {
    pushItemRows(it);
    if (it.kind === "kit" && it.children) {
      for (const child of it.children) pushItemRows(child);
    }
  }

  // ---------- Save ----------
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  const safeCampaign = (meta.campaignName || "campanha").replace(/[\\/?*[\]:]/g, "").slice(0, 50);
  const filename = `Comparativo Rateio — ${safeCampaign} — ${formatDateTimeStamp()}.xlsx`;
  await saveBlobAs(blob, filename, {
    mimeType: XLSX_MIME,
    description: "Comparativo de rateio (.xlsx)",
    extension: ".xlsx",
  });
}

export function buildRateioComparisonText(
  diff: RateioDiff,
  meta: RateioComparisonMeta
): string {
  const lines: string[] = [];
  const sep = "─".repeat(72);
  lines.push(sep);
  lines.push("COMPARATIVO DE RATEIOS");
  lines.push(sep);
  lines.push(`Agência: ${meta.agencyName}`);
  lines.push(`Cliente: ${meta.clientName}`);
  lines.push(`Campanha: ${meta.campaignName}`);
  lines.push(`Versão atual: ${meta.currentLabel}`);
  lines.push(`Versão anterior: ${meta.previousLabel}`);
  lines.push(`Gerado em: ${formatDateTimeHuman()}`);
  lines.push("");
  lines.push(
    `Resumo: ${diff.summary.piecesChanged} peça(s) alterada(s) · ${diff.summary.kitsChanged} kit(s) alterado(s)`
  );
  lines.push(
    `Total: ${diff.summary.totalQuantityPrevious} → ${diff.summary.totalQuantityCurrent} (${
      diff.summary.totalQuantityDiff >= 0 ? "+" : ""
    }${diff.summary.totalQuantityDiff})`
  );
  lines.push("");

  if (diff.items.length === 0) {
    lines.push("Nenhuma diferença encontrada entre os dois rateios.");
    return lines.join("\n");
  }

  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  const renderStoreBlock = (label: string, list: StoreDiff[]) => {
    if (list.length === 0) return;
    lines.push(`  ${label} (${list.length}):`);
    for (const s of list) {
      const code = (s.store.store_code || "").padEnd(12, " ");
      const name = (s.store.name || "").padEnd(30, " ").slice(0, 30);
      const uf = (s.store.state || "").padEnd(2, " ");
      const change =
        s.type === "added"
          ? `0 → ${s.current}`
          : s.type === "removed"
          ? `${s.previous} → 0`
          : `${s.previous} → ${s.current}`;
      lines.push(`    ${code} ${name} ${uf}  ${change.padEnd(12)} (${sign(s.diff)})`);
    }
  };

  const renderItem = (item: ItemDiff, indent: string) => {
    const tag = item.kind === "kit" ? "[KIT]" : "[PEÇA]";
    lines.push(sep);
    lines.push(
      `${indent}${tag} #${item.code ?? "—"} ${item.name}    Total: ${item.totalPrevious} → ${
        item.totalCurrent
      } (${sign(item.totalDiff)})`
    );
    renderStoreBlock("Lojas adicionadas", item.added);
    renderStoreBlock("Lojas alteradas", item.modified);
    renderStoreBlock("Lojas removidas", item.removed);
    if (item.kind === "kit" && item.children && item.children.length > 0) {
      lines.push("");
      lines.push(`  Componentes do kit:`);
      for (const child of item.children) {
        renderItem(child, "    ↳ ");
      }
    }
  };

  for (const it of diff.items) renderItem(it, "");
  lines.push(sep);
  return lines.join("\n");
}
