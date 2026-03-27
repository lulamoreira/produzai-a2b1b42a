import * as XLSX from "xlsx";
import { buildExportFileName } from "@/lib/exportFileName";
import type { Store, Piece, StorePiece } from "@/hooks/useStoreData";

function buildStoreSheet(store: Store, pieces: Piece[], storePieces: StorePiece[]) {
  const rows: Record<string, string | number>[] = [];
  const spMap = new Map(storePieces.filter(sp => sp.store_id === store.id).map(sp => [sp.piece_id, sp.quantity]));

  for (const piece of pieces) {
    const qty = spMap.get(piece.id) || 0;
    if (qty > 0) {
      rows.push({
        "Código": piece.code,
        "Categoria": piece.category,
        "Peça": piece.name,
        "Medida": piece.size,
        "Quantidade": qty,
      });
    }
  }

  return rows;
}

export function exportSingleStore(store: Store, pieces: Piece[], storePieces: StorePiece[]) {
  const rows = buildStoreSheet(store, pieces, storePieces);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 8 }, { wch: 15 }, { wch: 35 }, { wch: 30 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, store.name.slice(0, 31));
  XLSX.writeFile(wb, buildExportFileName(`Loja_${store.number}_${store.name}`));
}

export function exportAllStores(stores: Store[], pieces: Piece[], allStorePieces: StorePiece[]) {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summary: Record<string, string | number>[] = [];
  for (const store of stores) {
    const sps = allStorePieces.filter(sp => sp.store_id === store.id);
    const total = sps.reduce((s, sp) => s + sp.quantity, 0);
    summary.push({
      "Nº": store.number,
      "UF": store.uf,
      "Loja": store.name,
      "Tipo": store.type,
      "Modelo": store.model,
      "Total Peças": total,
    });
  }
  const summaryWs = XLSX.utils.json_to_sheet(summary);
  summaryWs["!cols"] = [{ wch: 5 }, { wch: 5 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, "Resumo");

  // Individual sheets
  for (const store of stores) {
    const rows = buildStoreSheet(store, pieces, allStorePieces);
    if (rows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 8 }, { wch: 15 }, { wch: 35 }, { wch: 30 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws, `${store.number}-${store.name}`.slice(0, 31));
    }
  }

  XLSX.writeFile(wb, buildExportFileName("Campanha_Completa"));
}

export function exportFilteredStores(filteredStores: Store[], pieces: Piece[], allStorePieces: StorePiece[]) {
  const wb = XLSX.utils.book_new();

  const summary: Record<string, string | number>[] = [];
  for (const store of filteredStores) {
    const sps = allStorePieces.filter(sp => sp.store_id === store.id);
    const total = sps.reduce((s, sp) => s + sp.quantity, 0);
    summary.push({
      "Nº": store.number,
      "UF": store.uf,
      "Loja": store.name,
      "Tipo": store.type,
      "Total Peças": total,
    });
  }
  const summaryWs = XLSX.utils.json_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Resumo Filtrado");

  for (const store of filteredStores) {
    const rows = buildStoreSheet(store, pieces, allStorePieces);
    if (rows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, `${store.number}-${store.name}`.slice(0, 31));
    }
  }

  XLSX.writeFile(wb, buildExportFileName("Campanha_Filtrada"));
}
