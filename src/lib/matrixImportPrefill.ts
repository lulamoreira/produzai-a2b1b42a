import { nameTokens } from "@/lib/flowCategorySpec";

export interface MatrixImportItem {
  id: string;
  name: string;
  type: "piece" | "kit";
}

export interface MatrixImportTarget {
  id: string;
  label: string;
  type: "piece" | "kit";
}

export type MatrixImportMapping = Record<string, { targetId: string; targetType: "piece" | "kit" }>;
export interface MatrixImportQuantity {
  store_id: string;
  piece_id: string;
  quantity: number;
}
export interface MatrixImportChange {
  storeId: string;
  pieceId: string;
  quantity: number;
}

/** Highest-scoring pairs win; both sides remain unique and kits stay manual. */
export function autoMapMatrixItems(items: MatrixImportItem[], targets: MatrixImportTarget[]): MatrixImportMapping {
  const targetTokens = targets.filter((target) => target.type === "piece")
    .map((target) => ({ target, tokens: nameTokens(target.label) }));
  const pairs: { remoteId: string; targetId: string; score: number }[] = [];
  for (const item of items) {
    if (item.type !== "piece") continue;
    const tokens = nameTokens(item.name);
    for (const { target, tokens: other } of targetTokens) {
      const union = new Set([...tokens, ...other]).size;
      const intersection = [...tokens].filter((token) => other.has(token)).length;
      const score = union ? intersection / union : 0;
      if (score >= 0.5) pairs.push({ remoteId: item.id, targetId: target.id, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  const mapping: MatrixImportMapping = {};
  const usedTargets = new Set<string>();
  for (const pair of pairs) {
    if (mapping[pair.remoteId] || usedTargets.has(pair.targetId)) continue;
    mapping[pair.remoteId] = { targetId: pair.targetId, targetType: "piece" };
    usedTargets.add(pair.targetId);
  }
  return mapping;
}

export function storesWithoutMatrixReference<T extends { id: string }>(stores: T[], quantities: MatrixImportQuantity[]): T[] {
  const referenced = new Set(quantities.map((quantity) => quantity.store_id));
  return stores.filter((store) => !referenced.has(store.id));
}

/** Zero/negative quantities are empty; positive quantities must never be replaced. */
export function filterEmptyMatrixCells(changes: MatrixImportChange[], current: MatrixImportQuantity[]) {
  const filled = new Set(current.filter((row) => row.quantity > 0).map((row) => `${row.store_id}|${row.piece_id}`));
  const emptyChanges = changes.filter((change) => !filled.has(`${change.storeId}|${change.pieceId}`));
  return { changes: emptyChanges, skipped: changes.length - emptyChanges.length };
}
export interface MatrixKitLink {
  kit_id: string;
  piece_id: string;
  quantity: number;
}

/**
 * Source kit count per store = min over components of floor(store qty / qty per kit);
 * a missing/zero component makes the kit 0 there. Each destination component then
 * receives kitCount × its own qty per kit, so differing structures still transfer.
 */
export function transferKitQuantities(
  sourceKitId: string,
  targetKitId: string,
  sourceLinks: MatrixKitLink[],
  targetLinks: MatrixKitLink[],
  sourceQuantities: MatrixImportQuantity[],
  storeIds: string[],
): MatrixImportChange[] {
  const source = sourceLinks.filter((l) => l.kit_id === sourceKitId && l.quantity > 0);
  const target = targetLinks.filter((l) => l.kit_id === targetKitId && l.quantity > 0);
  if (source.length === 0 || target.length === 0) return [];
  const qty = new Map(sourceQuantities.map((q) => [`${q.store_id}|${q.piece_id}`, q.quantity]));
  const changes: MatrixImportChange[] = [];
  for (const storeId of storeIds) {
    const kits = Math.min(...source.map((l) => Math.floor(Math.max(0, qty.get(`${storeId}|${l.piece_id}`) ?? 0) / l.quantity)));
    if (kits <= 0) continue;
    for (const l of target) changes.push({ storeId, pieceId: l.piece_id, quantity: kits * l.quantity });
  }
  return changes;
}
