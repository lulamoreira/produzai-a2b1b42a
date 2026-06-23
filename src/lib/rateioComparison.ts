/**
 * Pure helpers to compute the diff between two rateio snapshots
 * (previous vs. current). No React, no IO — fully testable.
 *
 * qtyMap keys follow the convention used across the Rateio modules:
 *   `${storeId}-${pieceId}`  → number (quantity)
 * UUIDs are 36 chars, so storeId = key.slice(0, 36) and pieceId = key.slice(37).
 */

export interface RateioPieceLike {
  id: string;
  code: number | null;
  name: string;
  category?: string | null;
  store_category?: string | null;
}

export interface RateioKitLike {
  id: string;
  code: number | null;
  name: string;
}

export interface RateioKitPieceLike {
  kit_id: string;
  piece_id: string;
  quantity: number;
}

export interface RateioStoreLike {
  id: string;
  store_code?: string | null;
  name: string;
  nickname?: string | null;
  city?: string | null;
  state?: string | null;
}

export type ChangeType = "added" | "removed" | "modified";

export interface StoreDiff {
  store: RateioStoreLike;
  previous: number;
  current: number;
  diff: number;
  type: ChangeType;
}

export interface ItemDiff {
  kind: "piece" | "kit";
  id: string;
  code: number | null;
  name: string;
  totalPrevious: number;
  totalCurrent: number;
  totalDiff: number;
  added: StoreDiff[];
  removed: StoreDiff[];
  modified: StoreDiff[];
  /** Only populated when kind === "kit". Children diffs (pieces that compose the kit). */
  children?: ItemDiff[];
}

export interface RateioDiffSummary {
  totalPieces: number;
  totalKits: number;
  piecesChanged: number;
  kitsChanged: number;
  totalQuantityPrevious: number;
  totalQuantityCurrent: number;
  totalQuantityDiff: number;
  storesAdded: number;
  storesRemoved: number;
  storesModified: number;
}

export interface RateioDiff {
  items: ItemDiff[];
  summary: RateioDiffSummary;
}

const isUuid = (s: string) => s.length === 36;

const computeKitQty = (
  kit: RateioKitLike,
  storeId: string,
  qtyMap: Record<string, number>,
  kitPiecesByKit: Map<string, RateioKitPieceLike[]>
): number => {
  const comps = kitPiecesByKit.get(kit.id);
  if (!comps || comps.length === 0) return 0;
  let min = Infinity;
  for (const kp of comps) {
    const base = qtyMap[`${storeId}-${kp.piece_id}`] || 0;
    const cap = Math.floor(base / (kp.quantity || 1));
    if (cap < min) min = cap;
  }
  return min === Infinity ? 0 : min;
};

const buildStoreDiffsForPiece = (
  pieceId: string,
  previous: Record<string, number>,
  current: Record<string, number>,
  storesById: Map<string, RateioStoreLike>
): { added: StoreDiff[]; removed: StoreDiff[]; modified: StoreDiff[]; totalPrev: number; totalCurr: number } => {
  const storeQtyPrev = new Map<string, number>();
  const storeQtyCurr = new Map<string, number>();

  for (const key in previous) {
    if (!isUuid(key.slice(0, 36)) || key.slice(37) !== pieceId) continue;
    const storeId = key.slice(0, 36);
    const v = previous[key] || 0;
    if (v) storeQtyPrev.set(storeId, v);
  }
  for (const key in current) {
    if (!isUuid(key.slice(0, 36)) || key.slice(37) !== pieceId) continue;
    const storeId = key.slice(0, 36);
    const v = current[key] || 0;
    if (v) storeQtyCurr.set(storeId, v);
  }

  const storeIds = new Set<string>([...storeQtyPrev.keys(), ...storeQtyCurr.keys()]);
  const added: StoreDiff[] = [];
  const removed: StoreDiff[] = [];
  const modified: StoreDiff[] = [];
  let totalPrev = 0;
  let totalCurr = 0;

  for (const sid of storeIds) {
    const prev = storeQtyPrev.get(sid) || 0;
    const curr = storeQtyCurr.get(sid) || 0;
    totalPrev += prev;
    totalCurr += curr;
    if (prev === curr) continue;
    const store = storesById.get(sid);
    if (!store) continue;
    const entry: StoreDiff = {
      store,
      previous: prev,
      current: curr,
      diff: curr - prev,
      type: prev === 0 ? "added" : curr === 0 ? "removed" : "modified",
    };
    if (entry.type === "added") added.push(entry);
    else if (entry.type === "removed") removed.push(entry);
    else modified.push(entry);
  }

  const byStoreCode = (a: StoreDiff, b: StoreDiff) =>
    (a.store.store_code || "").localeCompare(b.store.store_code || "", "pt-BR", { numeric: true });
  added.sort(byStoreCode);
  removed.sort(byStoreCode);
  modified.sort(byStoreCode);

  return { added, removed, modified, totalPrev, totalCurr };
};

const buildStoreDiffsForKit = (
  kit: RateioKitLike,
  previousQtyMap: Record<string, number>,
  currentQtyMap: Record<string, number>,
  storesById: Map<string, RateioStoreLike>,
  prevKitPiecesByKit: Map<string, RateioKitPieceLike[]>,
  currKitPiecesByKit: Map<string, RateioKitPieceLike[]>
): { added: StoreDiff[]; removed: StoreDiff[]; modified: StoreDiff[]; totalPrev: number; totalCurr: number } => {
  const added: StoreDiff[] = [];
  const removed: StoreDiff[] = [];
  const modified: StoreDiff[] = [];
  let totalPrev = 0;
  let totalCurr = 0;

  for (const store of storesById.values()) {
    const prev = computeKitQty(kit, store.id, previousQtyMap, prevKitPiecesByKit);
    const curr = computeKitQty(kit, store.id, currentQtyMap, currKitPiecesByKit);
    totalPrev += prev;
    totalCurr += curr;
    if (prev === curr) continue;
    const entry: StoreDiff = {
      store,
      previous: prev,
      current: curr,
      diff: curr - prev,
      type: prev === 0 ? "added" : curr === 0 ? "removed" : "modified",
    };
    if (entry.type === "added") added.push(entry);
    else if (entry.type === "removed") removed.push(entry);
    else modified.push(entry);
  }

  const byStoreCode = (a: StoreDiff, b: StoreDiff) =>
    (a.store.store_code || "").localeCompare(b.store.store_code || "", "pt-BR", { numeric: true });
  added.sort(byStoreCode);
  removed.sort(byStoreCode);
  modified.sort(byStoreCode);

  return { added, removed, modified, totalPrev, totalCurr };
};

export function computeRateioDiff(
  pieces: RateioPieceLike[],
  kits: RateioKitLike[],
  previousKitPieces: RateioKitPieceLike[],
  currentKitPieces: RateioKitPieceLike[],
  stores: RateioStoreLike[],
  previousQtyMap: Record<string, number>,
  currentQtyMap: Record<string, number>
): RateioDiff {
  const storesById = new Map(stores.map((s) => [s.id, s]));
  const piecesById = new Map(pieces.map((p) => [p.id, p]));

  const prevKitPiecesByKit = new Map<string, RateioKitPieceLike[]>();
  for (const kp of previousKitPieces) {
    if (!prevKitPiecesByKit.has(kp.kit_id)) prevKitPiecesByKit.set(kp.kit_id, []);
    prevKitPiecesByKit.get(kp.kit_id)!.push(kp);
  }
  const currKitPiecesByKit = new Map<string, RateioKitPieceLike[]>();
  for (const kp of currentKitPieces) {
    if (!currKitPiecesByKit.has(kp.kit_id)) currKitPiecesByKit.set(kp.kit_id, []);
    currKitPiecesByKit.get(kp.kit_id)!.push(kp);
  }

  // Piece-level diffs (all pieces; we'll attach kit-components separately as children of their kit)
  const allPieceDiffs = new Map<string, ItemDiff>();
  for (const p of pieces) {
    const r = buildStoreDiffsForPiece(p.id, previousQtyMap, currentQtyMap, storesById);
    const item: ItemDiff = {
      kind: "piece",
      id: p.id,
      code: p.code,
      name: p.name,
      totalPrevious: r.totalPrev,
      totalCurrent: r.totalCurr,
      totalDiff: r.totalCurr - r.totalPrev,
      added: r.added,
      removed: r.removed,
      modified: r.modified,
    };
    allPieceDiffs.set(p.id, item);
  }

  // Kit-level diffs
  const kitDiffs: ItemDiff[] = [];
  const componentPieceIds = new Set<string>();
  for (const k of kits) {
    const comps = currKitPiecesByKit.get(k.id) || prevKitPiecesByKit.get(k.id) || [];
    for (const c of comps) componentPieceIds.add(c.piece_id);

    const r = buildStoreDiffsForKit(
      k,
      previousQtyMap,
      currentQtyMap,
      storesById,
      prevKitPiecesByKit,
      currKitPiecesByKit
    );

    // children = piece-diffs for this kit's components (preserve in code order)
    const childIds = Array.from(new Set(comps.map((c) => c.piece_id)));
    const children: ItemDiff[] = childIds
      .map((pid) => allPieceDiffs.get(pid))
      .filter((d): d is ItemDiff => !!d && (d.totalDiff !== 0 || d.added.length + d.removed.length + d.modified.length > 0))
      .sort((a, b) => (a.code ?? 0) - (b.code ?? 0));

    kitDiffs.push({
      kind: "kit",
      id: k.id,
      code: k.code,
      name: k.name,
      totalPrevious: r.totalPrev,
      totalCurrent: r.totalCurr,
      totalDiff: r.totalCurr - r.totalPrev,
      added: r.added,
      removed: r.removed,
      modified: r.modified,
      children,
    });
  }

  // Standalone pieces (not part of any kit) — only those with changes
  const standalonePieceDiffs = pieces
    .filter((p) => !componentPieceIds.has(p.id))
    .map((p) => allPieceDiffs.get(p.id)!)
    .filter((d) => d.totalDiff !== 0 || d.added.length + d.removed.length + d.modified.length > 0);

  // Only include kits with changes (either own totals or any child piece changed)
  const changedKitDiffs = kitDiffs.filter(
    (k) =>
      k.totalDiff !== 0 ||
      k.added.length + k.removed.length + k.modified.length > 0 ||
      (k.children && k.children.length > 0)
  );

  // Merge and sort by code ascending
  const items: ItemDiff[] = [...standalonePieceDiffs, ...changedKitDiffs].sort(
    (a, b) => (a.code ?? 0) - (b.code ?? 0)
  );

  // Aggregate summary
  let storesAdded = 0;
  let storesRemoved = 0;
  let storesModified = 0;
  let totalPrevAll = 0;
  let totalCurrAll = 0;
  let piecesChanged = 0;
  let kitsChanged = 0;

  for (const it of items) {
    storesAdded += it.added.length;
    storesRemoved += it.removed.length;
    storesModified += it.modified.length;
    totalPrevAll += it.totalPrevious;
    totalCurrAll += it.totalCurrent;
    if (it.kind === "piece") piecesChanged += 1;
    else kitsChanged += 1;
  }

  return {
    items,
    summary: {
      totalPieces: pieces.length,
      totalKits: kits.length,
      piecesChanged,
      kitsChanged,
      totalQuantityPrevious: totalPrevAll,
      totalQuantityCurrent: totalCurrAll,
      totalQuantityDiff: totalCurrAll - totalPrevAll,
      storesAdded,
      storesRemoved,
      storesModified,
    },
  };
}
