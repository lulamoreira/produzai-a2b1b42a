import ExcelJS from 'exceljs';
import type { RateioUpsert } from '@/lib/applyRateioBulk';

// ─── EXPORTAR ───────────────────────────────────────────────────────────────
export async function exportRateioSpreadsheet({
  stores,
  columns,
  qtyMap,
  kitQtyMap,
  campaignName,
}: {
  stores: any[];
  columns: { _type: 'piece' | 'kit'; id: string; name: string }[];
  qtyMap: Record<string, number>;
  kitQtyMap: Record<string, number>;
  campaignName: string;
}): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ProduzAI';
  const ws = wb.addWorksheet('RATEIO');

  // Linha 1 — cabeçalhos visíveis
  const headerRow = ws.addRow([
    'LOJA',
    'ID_LOJA',       // coluna B oculta
    ...columns.map(c => c.name),
  ]);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

  // Linha 2 — IDs de peças/kits (oculta) — formato "piece:uuid" ou "kit:uuid"
  const idRow = ws.addRow([
    '__META__',
    '__STORE_ID__',
    ...columns.map(c => `${c._type}:${c.id}`),
  ]);
  idRow.hidden = true;

  // Coluna B oculta (store_id)
  ws.getColumn(2).hidden = true;
  ws.getColumn(2).width = 36;

  // Largura das colunas de dados
  ws.getColumn(1).width = 40;
  columns.forEach((_, i) => {
    ws.getColumn(i + 3).width = 14;
  });

  // Linhas de dados
  for (const store of stores) {
    const row = ws.addRow([
      store.name ?? store.razao_social ?? '',
      store.id,
      ...columns.map(col =>
        col._type === 'kit'
          ? (kitQtyMap[`${store.id}-${col.id}`] || 0)
          : (qtyMap[`${store.id}-${col.id}`] || 0)
      ),
    ]);
    // Célula do store_id na col B permanece oculta
    row.getCell(2).protection = { locked: true };
  }

  // Congela primeira linha e primeira coluna
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 2 }];

  // Estilo numérico nas colunas de quantidade
  for (let col = 3; col <= columns.length + 2; col++) {
    ws.getColumn(col).numFmt = '0';
    ws.getColumn(col).alignment = { horizontal: 'center' };
  }

  // Download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rateio-${campaignName.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── IMPORTAR ───────────────────────────────────────────────────────────────
export async function parseRateioSpreadsheet({
  file,
  campaignId,
  validStoreIds,
  validPieceIds,
  validKitIds,
  activeKitPieces,
}: {
  file: File;
  campaignId: string;
  validStoreIds: Set<string>;
  validPieceIds: Set<string>;
  validKitIds: Set<string>;
  activeKitPieces: { kit_id: string; piece_id: string; quantity?: number | null }[];
}): Promise<RateioUpsert[]> {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.getWorksheet('RATEIO');
  if (!ws) throw new Error('Aba "RATEIO" não encontrada. Use o modelo exportado pelo ProduzAI.');

  // Lê linha 2 (IDs ocultos) para mapear colunas
  const idRow = ws.getRow(2);
  type ColMeta = { colIndex: number; type: 'piece' | 'kit'; id: string };
  const colMap: ColMeta[] = [];

  idRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (colNumber <= 2) return;
    const raw = String(cell.value ?? '').trim();
    const [type, id] = raw.split(':');
    if (!id) return;
    if (type === 'piece' && validPieceIds.has(id)) {
      colMap.push({ colIndex: colNumber, type: 'piece', id });
    } else if (type === 'kit' && validKitIds.has(id)) {
      colMap.push({ colIndex: colNumber, type: 'kit', id });
    }
  });

  if (colMap.length === 0) throw new Error('Nenhuma coluna válida encontrada. O arquivo pode estar corrompido ou ser de outra campanha.');

  // Separa peças e kits para processamento em ordem correta
  const pieceCols = colMap.filter(c => c.type === 'piece');
  const kitCols   = colMap.filter(c => c.type === 'kit');

  // Map com last-write-wins — kits processados depois sobrescrevem peças
  const allUpsertsMap = new Map<string, RateioUpsert>();
  const set = (storeId: string, pieceId: string, quantity: number) => {
    allUpsertsMap.set(`${storeId}|${pieceId}`, { campaignId, storeId, pieceId, quantity });
  };

  // Linhas de dados: a partir da linha 3
  for (let r = 3; r <= (ws.actualRowCount ?? ws.rowCount); r++) {
    const row = ws.getRow(r);
    const storeId = String(row.getCell(2).value ?? '').trim();
    if (!storeId || !validStoreIds.has(storeId)) continue;

    // 1ª passagem: peças standalone
    for (const col of pieceCols) {
      const rawVal = row.getCell(col.colIndex).value;
      const qty = Math.max(0, Math.round(Number(rawVal) || 0));
      set(storeId, col.id, qty);
    }

    // 2ª passagem: kits — decompõe em peças componentes (sobrescreve peça se houver conflito)
    for (const col of kitCols) {
      const rawVal = row.getCell(col.colIndex).value;
      const kitQty = Math.max(0, Math.round(Number(rawVal) || 0));
      const kpList = activeKitPieces.filter(kp => kp.kit_id === col.id);
      for (const kp of kpList) {
        set(storeId, kp.piece_id, kitQty * (kp.quantity || 1));
      }
    }
  }

  const upserts = Array.from(allUpsertsMap.values());
  if (upserts.length === 0) throw new Error('Nenhuma quantidade encontrada na planilha.');
  return upserts;
}
