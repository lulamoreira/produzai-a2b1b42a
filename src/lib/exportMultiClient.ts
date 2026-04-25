import * as XLSX from "xlsx";
import { buildExportFileName } from "@/lib/exportFileName";
import { saveXlsxAs } from "@/lib/saveBlobAs";
import type { Client, ClientStore, Campaign, CampaignPiece, CampaignStorePiece, CampaignKit, CampaignKitPiece } from "@/hooks/useMultiClientData";

// ─── Clients ────────────────────────────────────────────

export function exportClients(clients: Client[], agencyName?: string) {
  const rows = clients.map((c) => ({
    "Nome": c.name,
    "Criado em": new Date(c.created_at).toLocaleDateString("pt-BR"),
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Nome": "" }]);
  ws["!cols"] = [{ wch: 40 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws, "Clientes");
  XLSX.writeFile(wb, buildExportFileName("Clientes", { agencyName }));
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

export function exportCampaigns(campaigns: Campaign[], clientName: string, agencyName?: string) {
  const rows = campaigns.map((c) => ({
    "Nome": c.name,
    "Criado em": new Date(c.created_at).toLocaleDateString("pt-BR"),
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Nome": "" }]);
  ws["!cols"] = [{ wch: 40 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws, "Campanhas");
  XLSX.writeFile(wb, buildExportFileName("Campanhas", { agencyName, clientName }));
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

export function exportClientStores(stores: ClientStore[], clientName: string, agencyName?: string) {
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
    "País": s.country || "",
    "Telefone": s.phone || "",
    "E-mail": s.email || "",
    "Gerente": s.manager_name || "",
    "Modelo de Loja": s.store_model || "",
    "Código da Loja": s.store_code || "",
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{
    "Nome": "", "Apelido": "", "CNPJ": "", "Inscrição Estadual": "",
    "CEP": "", "Rua": "", "Número": "", "Complemento": "", "Bairro": "",
    "Cidade": "", "Estado": "", "País": "", "Telefone": "", "E-mail": "", "Gerente": "",
    "Modelo de Loja": "", "Código da Loja": "",
  }]);
  ws["!cols"] = [
    { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 18 },
    { wch: 10 }, { wch: 30 }, { wch: 8 }, { wch: 15 }, { wch: 20 },
    { wch: 20 }, { wch: 5 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 },
    { wch: 18 }, { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Lojas");
  XLSX.writeFile(wb, buildExportFileName("Lojas", { agencyName, clientName }));
}

// ─── Campaign Pieces ────────────────────────────────────

export function exportCampaignPieces(
  pieces: CampaignPiece[],
  campaignName: string,
  kits: CampaignKit[] = [],
  kitPieces: CampaignKitPiece[] = [],
  allPieces: CampaignPiece[] = [],
  agencyName?: string,
  clientName?: string,
) {
  const rows = pieces.map((p) => ({
    "Código": p.code,
    "Localização na Loja": p.sub_location ? `${p.category} / ${p.sub_location}` : p.category,
    "Nome": p.name,
    "Medidas": p.size,
    "Modelo de Loja": p.store_category || "",
    "Especificação": p.specification || "",
    "Instruções de Instalação": p.installation_instructions || "",
    "Mockup": p.is_mockup ? "Sim" : "",
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{
    "Código": "", "Localização na Loja": "", "Nome": "", "Medidas": "", "Modelo de Loja": "",
    "Especificação": "", "Instruções de Instalação": "", "Mockup": "",
  }]);
  ws["!cols"] = [{ wch: 8 }, { wch: 20 }, { wch: 35 }, { wch: 25 }, { wch: 20 }, { wch: 35 }, { wch: 40 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, "Peças");

  // Kit detail sheets
  const pieceMap = new Map((allPieces.length > 0 ? allPieces : pieces).map(p => [p.id, p]));
  kits.forEach((kit) => {
    const kpForKit = kitPieces.filter(kp => kp.kit_id === kit.id);
    const kitRows = kpForKit.map(kp => {
      const piece = pieceMap.get(kp.piece_id);
      return {
        "Código": piece?.code || 0,
        "Localização na Loja": piece ? (piece.sub_location ? `${piece.category} / ${piece.sub_location}` : piece.category) : "",
        "Nome": piece?.name || "",
        "Medidas": piece?.size || "",
        "Modelo de Loja": piece?.store_category || "",
        "Especificação": piece?.specification || "",
        "Instruções de Instalação": piece?.installation_instructions || "",
        "Qtd no Kit": kp.quantity || 1,
      };
    });
    if (kitRows.length > 0) {
      const kitWs = XLSX.utils.json_to_sheet(kitRows);
      kitWs["!cols"] = [{ wch: 8 }, { wch: 20 }, { wch: 35 }, { wch: 25 }, { wch: 20 }, { wch: 35 }, { wch: 40 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, kitWs, `Kit ${kit.code} - ${kit.name}`.slice(0, 31));
    }
  });

  XLSX.writeFile(wb, buildExportFileName(`Pecas_${campaignName}`, { agencyName, clientName }));
}

export function parsePiecesImport(file: File): Promise<Array<{ code: number; category: string; name: string; size: string; store_category?: string; specification?: string; installation_instructions?: string }>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
        const mapped = rows.map((r) => ({
          code: parseInt(r["Código"] || r["codigo"] || r["code"] || "0") || 0,
          category: r["Localização na Loja"] || r["Categoria"] || r["categoria"] || r["category"] || "",
          name: r["Nome"] || r["nome"] || r["name"] || "",
          size: r["Medidas"] || r["medidas"] || r["size"] || "",
          store_category: r["Modelo de Loja"] || r["Categoria de Loja"] || r["categoria_loja"] || r["store_category"] || undefined,
          specification: r["Especificação"] || r["especificacao"] || r["specification"] || undefined,
          installation_instructions: r["Instruções de Instalação"] || r["instrucoes_instalacao"] || r["installation_instructions"] || undefined,
        })).filter((p) => p.name && p.code > 0);
        resolve(mapped);
      } catch { reject(new Error("Erro ao ler planilha.")); }
    };
    reader.readAsBinaryString(file);
  });
}

// ─── Matrix (Store x Pieces + Kits) ─────────────────────

export function exportMatrix(
  stores: ClientStore[],
  pieces: CampaignPiece[],
  storePieces: CampaignStorePiece[],
  campaignName: string,
  kits: CampaignKit[] = [],
  kitPieces: CampaignKitPiece[] = [],
  allPieces: CampaignPiece[] = [],
  agencyName?: string,
  clientName?: string,
) {
  const qtyMap: Record<string, number> = {};
  storePieces.forEach((sp) => { qtyMap[`${sp.store_id}-${sp.piece_id}`] = sp.quantity; });

  // Build piece map from ALL pieces (including kit_only) for kit sheet lookups
  const pieceMap = new Map((allPieces.length > 0 ? allPieces : pieces).map(p => [p.id, p]));
  const usedSheetNames = new Set(["matriz"]);
  const safeSheetName = (raw: string) => {
    const base = (raw.replace(/[\\/?*\[\]:]/g, "-").replace(/\s+/g, " ").trim() || "Kit").slice(0, 31);
    let name = base;
    let idx = 2;
    while (usedSheetNames.has(name.toLowerCase())) {
      const suffix = ` (${idx++})`;
      name = `${base.slice(0, 31 - suffix.length).trim()}${suffix}`;
    }
    usedSheetNames.add(name.toLowerCase());
    return name;
  };

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
      const colName = p.is_mockup ? `${p.code} - ${p.name} (MOCKUP)` : `${p.code} - ${p.name}`;
      row[colName] = qty;
      total += qty;
    });

    // Kit columns with sequential codes after pieces
    const maxPieceCode = pieces.length > 0 ? Math.max(...pieces.map(p => p.code)) : 0;
    kits.forEach((kit, idx) => {
      const kitSeqCode = maxPieceCode + idx + 1;
      const kpForKit = kitPieces.filter(kp => kp.kit_id === kit.id);
      const kitQty = kpForKit.length > 0
        ? Math.min(...kpForKit.map(kp => {
            const storeQty = qtyMap[`${store.id}-${kp.piece_id}`] || 0;
            return Math.floor(storeQty / (kp.quantity || 1));
          }))
        : 0;
      row[`${kitSeqCode} - ${kit.name}`] = kitQty;
    });

    row["Total"] = total;
    return row;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Matriz");

  // Individual kit sheets
  const maxPieceCodeForSheets = pieces.length > 0 ? Math.max(...pieces.map(p => p.code)) : 0;
  kits.forEach((kit, idx) => {
    const kitSeqCode = maxPieceCodeForSheets + idx + 1;
    const kpForKit = kitPieces.filter(kp => kp.kit_id === kit.id);
    const kitRows = kpForKit.map(kp => {
      const piece = pieceMap.get(kp.piece_id);
      return {
        "Código": piece?.code || 0,
        "Nome": piece?.name || "",
        "Medidas": piece?.size || "",
        "Localização": piece ? (piece.sub_location ? `${piece.category} / ${piece.sub_location}` : piece.category) : "",
        "Qtd no Kit": kp.quantity || 1,
      };
    });
    if (kitRows.length > 0) {
      const kitWs = XLSX.utils.json_to_sheet(kitRows);
      kitWs["!cols"] = [{ wch: 8 }, { wch: 35 }, { wch: 25 }, { wch: 20 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, kitWs, safeSheetName(`Kit ${kitSeqCode} - ${kit.name}`));
    }
  });

  XLSX.writeFile(wb, buildExportFileName(`Matriz_${campaignName}`, { agencyName, clientName }));
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
