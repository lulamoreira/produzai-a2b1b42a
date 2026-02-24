import * as XLSX from "xlsx";
import type { Client, ClientStore, Campaign, CampaignPiece, CampaignStorePiece } from "@/hooks/useMultiClientData";

// ─── Clients ────────────────────────────────────────────

export function exportClients(clients: Client[]) {
  const rows = clients.map((c) => ({
    "Nome": c.name,
    "Criado em": new Date(c.created_at).toLocaleDateString("pt-BR"),
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Nome": "" }]);
  ws["!cols"] = [{ wch: 40 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws, "Clientes");
  XLSX.writeFile(wb, "Clientes.xlsx");
}

export function parseClientsImport(file: File): Promise<Array<{ name: string }>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
        const mapped = rows
          .map((r) => ({ name: r["Nome"] || r["nome"] || r["name"] || "" }))
          .filter((c) => c.name.trim());
        resolve(mapped);
      } catch { reject(new Error("Erro ao ler planilha.")); }
    };
    reader.readAsBinaryString(file);
  });
}

// ─── Campaigns ──────────────────────────────────────────

export function exportCampaigns(campaigns: Campaign[], clientName: string) {
  const rows = campaigns.map((c) => ({
    "Nome": c.name,
    "Criado em": new Date(c.created_at).toLocaleDateString("pt-BR"),
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Nome": "" }]);
  ws["!cols"] = [{ wch: 40 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws, "Campanhas");
  XLSX.writeFile(wb, `Campanhas_${clientName.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`);
}

export function parseCampaignsImport(file: File): Promise<Array<{ name: string }>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
        const mapped = rows
          .map((r) => ({ name: r["Nome"] || r["nome"] || r["name"] || "" }))
          .filter((c) => c.name.trim());
        resolve(mapped);
      } catch { reject(new Error("Erro ao ler planilha.")); }
    };
    reader.readAsBinaryString(file);
  });
}

// ─── Client Stores ──────────────────────────────────────

export function exportClientStores(stores: ClientStore[], clientName: string) {
  const rows = stores.map((s) => ({
    "Nome": s.name,
    "Apelido": s.nickname || "",
    "CNPJ": s.cnpj || "",
    "Inscrição Estadual": s.state_registration || "",
    "CEP": s.zip_code || "",
    "Rua": s.street || "",
    "Número": s.number || "",
    "Complemento": s.complement || "",
    "Bairro": s.neighborhood || "",
    "Cidade": s.city || "",
    "Estado": s.state || "",
    "Telefone": s.phone || "",
    "Gerente": s.manager_name || "",
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{
    "Nome": "", "Apelido": "", "CNPJ": "", "Inscrição Estadual": "",
    "CEP": "", "Rua": "", "Número": "", "Complemento": "", "Bairro": "",
    "Cidade": "", "Estado": "", "Telefone": "", "Gerente": "",
  }]);
  ws["!cols"] = [
    { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 18 },
    { wch: 10 }, { wch: 30 }, { wch: 8 }, { wch: 15 }, { wch: 20 },
    { wch: 20 }, { wch: 5 }, { wch: 15 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Lojas");
  XLSX.writeFile(wb, `Lojas_${clientName.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`);
}

// ─── Campaign Pieces ────────────────────────────────────

export function exportCampaignPieces(pieces: CampaignPiece[], campaignName: string) {
  const rows = pieces.map((p) => ({
    "Código": p.code,
    "Categoria": p.category,
    "Nome": p.name,
    "Medidas": p.size,
    "Categoria de Loja": p.store_category || "",
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{
    "Código": "", "Categoria": "", "Nome": "", "Medidas": "", "Categoria de Loja": "",
  }]);
  ws["!cols"] = [{ wch: 8 }, { wch: 20 }, { wch: 35 }, { wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, "Peças");
  XLSX.writeFile(wb, `Pecas_${campaignName.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`);
}

export function parsePiecesImport(file: File): Promise<Array<{ code: number; category: string; name: string; size: string; store_category?: string }>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
        const mapped = rows.map((r) => ({
          code: parseInt(r["Código"] || r["codigo"] || r["code"] || "0") || 0,
          category: r["Categoria"] || r["categoria"] || r["category"] || "",
          name: r["Nome"] || r["nome"] || r["name"] || "",
          size: r["Medidas"] || r["medidas"] || r["size"] || "",
          store_category: r["Categoria de Loja"] || r["categoria_loja"] || r["store_category"] || undefined,
        })).filter((p) => p.name && p.code > 0);
        resolve(mapped);
      } catch { reject(new Error("Erro ao ler planilha.")); }
    };
    reader.readAsBinaryString(file);
  });
}

// ─── Matrix (Store x Pieces) ────────────────────────────

export function exportMatrix(
  stores: ClientStore[],
  pieces: CampaignPiece[],
  storePieces: CampaignStorePiece[],
  campaignName: string,
) {
  const qtyMap: Record<string, number> = {};
  storePieces.forEach((sp) => { qtyMap[`${sp.store_id}-${sp.piece_id}`] = sp.quantity; });

  const rows = stores.map((store) => {
    const row: Record<string, string | number> = {
      "Loja": store.name,
      "Apelido": store.nickname || "",
      "Cidade": store.city || "",
      "Estado": store.state || "",
    };
    let total = 0;
    pieces.forEach((p) => {
      const qty = qtyMap[`${store.id}-${p.id}`] || 0;
      row[`${p.code} - ${p.name}`] = qty;
      total += qty;
    });
    row["Total"] = total;
    return row;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Matriz");
  XLSX.writeFile(wb, `Matriz_${campaignName.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`);
}

export function parseMatrixImport(
  file: File,
  pieces: CampaignPiece[],
  stores: ClientStore[],
): Promise<Array<{ storeName: string; storeId: string; pieceId: string; quantity: number }>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
        
        const storeByName = new Map(stores.map(s => [s.name.toLowerCase(), s]));
        const results: Array<{ storeName: string; storeId: string; pieceId: string; quantity: number }> = [];

        for (const row of rows) {
          const storeName = (row["Loja"] || row["loja"] || "").toString().toLowerCase();
          const store = storeByName.get(storeName);
          if (!store) continue;

          for (const piece of pieces) {
            const colKey = `${piece.code} - ${piece.name}`;
            const qty = parseInt(row[colKey]) || 0;
            if (qty > 0) {
              results.push({ storeName: store.name, storeId: store.id, pieceId: piece.id, quantity: qty });
            }
          }
        }
        resolve(results);
      } catch { reject(new Error("Erro ao ler planilha.")); }
    };
    reader.readAsBinaryString(file);
  });
}
