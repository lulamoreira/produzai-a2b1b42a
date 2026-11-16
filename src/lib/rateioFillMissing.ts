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

/** Distribuição "quantidade → nº de lojas", ordenada pela quantidade. */
export function quantityDistribution(values: number[]): { qty: number; stores: number }[] {
  const freq = new Map<number, number>();
  for (const v of values) if (Number.isFinite(v)) freq.set(v, (freq.get(v) ?? 0) + 1);
  return Array.from(freq, ([qty, stores]) => ({ qty, stores })).sort((a, b) => a.qty - b.qty);
}

export interface StoreWithQty {
  qty: number;
  showcase: number;
}

export interface QuantitySuggestion {
  quantity: number;
  /** true quando veio de lojas com o mesmo número de vitrines. */
  sameShowcase: boolean;
  /** Quantas lojas com o mesmo número de vitrines serviram de base. */
  base: number;
}

/**
 * Sugestão POR LOJA (regra do dono): moda (empate = menor) entre as lojas que têm o item
 * e possuem o MESMO número de vitrines. Sem loja comparável, a MENOR quantidade entre as
 * que têm (tende a ser a vitrine primária). Nunca média nem maior.
 */
export function suggestQuantityFor(showcase: number, storesWith: StoreWithQty[]): QuantitySuggestion {
  const positives = storesWith.filter((s) => s.qty > 0);
  const same = positives.filter((s) => (Number(s.showcase) || 0) === (Number(showcase) || 0));
  if (same.length > 0) {
    return { quantity: summarizeQuantities(same.map((s) => s.qty)).mode, sameShowcase: true, base: same.length };
  }
  return { quantity: summarizeQuantities(positives.map((s) => s.qty)).min, sameShowcase: false, base: 0 };
}

export interface FillTarget {
  storeId: string;
  /** Quantidade da peça, ou número de kits, para esta loja. */
  quantity: number;
}

export interface FillRequest {
  itemKind: FillItemKind;
  itemId: string;
  /** Uma entrada por loja marcada, cada uma com a sua quantidade. */
  targets: FillTarget[];
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
 * Peça: grava a quantidade de cada loja marcada que hoje tem 0.
 * Kit: para cada peça do kit grava `quantity × peças por kit`. Peça usada em mais de um
 * kit soma à quantidade atual (ela já serve o outro kit); peça exclusiva do kit fica com o
 * maior valor entre o atual e o necessário, para nunca diminuir.
 */
export function buildFillMissingUpserts(req: FillRequest): FillUpsert[] {
  // Uma quantidade válida (inteira ≥ 1) por loja; a última entrada repetida vence.
  const byStore = new Map<string, number>();
  for (const t of req.targets) {
    const qty = Math.floor(Number(t.quantity));
    if (Number.isFinite(qty) && qty > 0) byStore.set(t.storeId, qty);
  }
  const out: FillUpsert[] = [];

  if (req.itemKind === "piece") {
    for (const [storeId, qty] of byStore) {
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

  for (const [storeId, qty] of byStore) {
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
