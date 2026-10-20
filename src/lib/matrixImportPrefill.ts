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