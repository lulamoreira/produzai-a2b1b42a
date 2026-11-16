/**
 * "Colocar nas que não têm" — regras puras usadas pela Revisão do Rateio.
 *
 * Só monta o que deve ser gravado; quem grava é o Rateio (applyWithHistory),
 * para entrar no histórico e poder ser desfeito.
 *
 * Garantias:
 * - nunca apaga nada (só devolve quantidades positivas);
 * - nunca reduz uma quantidade existente;
 * - não toca lojas que já recebem o item (peça > 0 ou kit completo ≥ 1).
 */

export type FillItemKind = "piece" | "kit";

export interface KitPieceLink {
  kit_id: string;
  piece_id: string;
  quantity?: number | null;
}

export interface QuantitySummary {
  count: number;
  total: number;
  /** Quantidade mais comum; em empate, a menor. 0 quando não há lojas. */
  mode: number;
  min: number;
  max: number;
}

export function summarizeQuantities(values: number[]): QuantitySummary {
  const list = values.filter((v) => Number.isFinite(v));
  if (list.length === 0) return { count: 0, total: 0, mode: 0, min: 0, max: 0 };
  const freq = new Map<number, number>();
  for (const v of list) freq.set(v, (freq.get(v) ?? 0) + 1);
  let mode = list[0];
  let best = 0;
  for (const [v, n] of freq) {
    if (n > best || (n === best && v < mode)) { mode = v; best = n; }
  }
  return {
    count: list.length,
    total: list.reduce((a, b) => a + b, 0),
    mode,
    min: Math.min(...list),
    max: Math.max(...list),
  };
}

export interface FillRequest {
  itemKind: FillItemKind;
  itemId: string;
  storeIds: string[];
  /** Quantidade da peça, ou número de kits, por loja. */
  quantity: number;
  kitPieces: KitPieceLink[];
  /** Quantidade atual da peça na loja (visão atual do Rateio). */
  currentQty: (storeId: string, pieceId: string) => number;
}

export interface FillUpsert {
  storeId: string;
  pieceId: string;
  quantity: number;
}

const kitCount = (storeId: string, comps: KitPieceLink[], currentQty: FillRequest["currentQty"]): number => {
  if (comps.length === 0) return 0;
  return Math.min(...comps.map((c) => Math.floor((currentQty(storeId, c.piece_id) || 0) / (c.quantity || 1))));
};

/**
 * Peça: grava `quantity` nas lojas marcadas que hoje têm 0.
 * Kit: para cada peça do kit grava `quantity × peças por kit`. Peça usada em mais de um
 * kit soma à quantidade atual (ela já serve o outro kit); peça exclusiva do kit fica com o
 * maior valor entre o atual e o necessário, para nunca diminuir.
 */
export function buildFillMissingUpserts(req: FillRequest): FillUpsert[] {
  const qty = Math.floor(Number(req.quantity));
  if (!Number.isFinite(qty) || qty <= 0) return [];
  const storeIds = Array.from(new Set(req.storeIds));
  const out: FillUpsert[] = [];

  if (req.itemKind === "piece") {
    for (const storeId of storeIds) {
      if ((req.currentQty(storeId, req.itemId) || 0) > 0) continue;
      out.push({ storeId, pieceId: req.itemId, quantity: qty });
    }
    return out;
  }

  const comps = req.kitPieces.filter((kp) => kp.kit_id === req.itemId);
  if (comps.length === 0) return [];
  const kitsByPiece = new Map<string, Set<string>>();
  for (const kp of req.kitPieces) {
    const set = kitsByPiece.get(kp.piece_id) ?? new Set<string>();
    set.add(kp.kit_id);
    kitsByPiece.set(kp.piece_id, set);
  }
  // Mesma peça listada duas vezes no kit: soma o necessário.
  const perKit = new Map<string, number>();
  for (const c of comps) perKit.set(c.piece_id, (perKit.get(c.piece_id) ?? 0) + (c.quantity || 1));

  for (const storeId of storeIds) {
    if (kitCount(storeId, comps, req.currentQty) > 0) continue;
    for (const [pieceId, perUnit] of perKit) {
      const existing = req.currentQty(storeId, pieceId) || 0;
      const needed = qty * perUnit;
      const shared = (kitsByPiece.get(pieceId)?.size ?? 0) > 1;
      const next = shared ? existing + needed : Math.max(existing, needed);
      if (next !== existing) out.push({ storeId, pieceId, quantity: next });
    }
  }
  return out;
}
