import { describe, it, expect } from "vitest";
import { buildFillMissingUpserts, summarizeQuantities } from "./rateioFillMissing";

const qtyFrom = (map: Record<string, number>) => (s: string, p: string) => map[`${s}-${p}`] || 0;

describe("summarizeQuantities", () => {
  it("quantidade sugerida é a mais comum entre as lojas que têm", () => {
    expect(summarizeQuantities([6, 6, 4, 8]).mode).toBe(6);
  });
  it("em empate, a quantidade sugerida é a menor", () => {
    expect(summarizeQuantities([4, 6, 6, 4]).mode).toBe(4);
  });
  it("resume total, mínimo e máximo", () => {
    expect(summarizeQuantities([2, 6, 4])).toEqual({ count: 3, total: 12, mode: 2, min: 2, max: 6 });
  });
});

describe("buildFillMissingUpserts", () => {
  it("peça: grava só nas lojas marcadas que hoje têm zero", () => {
    const out = buildFillMissingUpserts({
      itemKind: "piece", itemId: "p", storeIds: ["a", "b"], quantity: 6, kitPieces: [],
      currentQty: qtyFrom({ "b-p": 3 }),
    });
    expect(out).toEqual([{ storeId: "a", pieceId: "p", quantity: 6 }]);
  });

  it("nunca grava quantidade zero ou negativa", () => {
    const base = { itemKind: "piece" as const, itemId: "p", storeIds: ["a"], kitPieces: [], currentQty: qtyFrom({}) };
    expect(buildFillMissingUpserts({ ...base, quantity: 0 })).toEqual([]);
    expect(buildFillMissingUpserts({ ...base, quantity: -2 })).toEqual([]);
  });

  it("kit: cada peça do kit recebe qtd do kit × peças por kit", () => {
    const out = buildFillMissingUpserts({
      itemKind: "kit", itemId: "k", storeIds: ["a"], quantity: 2,
      kitPieces: [{ kit_id: "k", piece_id: "x", quantity: 1 }, { kit_id: "k", piece_id: "y", quantity: 3 }],
      currentQty: qtyFrom({}),
    });
    expect(out).toEqual([
      { storeId: "a", pieceId: "x", quantity: 2 },
      { storeId: "a", pieceId: "y", quantity: 6 },
    ]);
  });

  it("kit: não toca loja que já tem o kit completo", () => {
    const out = buildFillMissingUpserts({
      itemKind: "kit", itemId: "k", storeIds: ["a"], quantity: 2,
      kitPieces: [{ kit_id: "k", piece_id: "x", quantity: 1 }],
      currentQty: qtyFrom({ "a-x": 1 }),
    });
    expect(out).toEqual([]);
  });

  it("kit: peça exclusiva nunca diminui", () => {
    const out = buildFillMissingUpserts({
      itemKind: "kit", itemId: "k", storeIds: ["a"], quantity: 1,
      kitPieces: [{ kit_id: "k", piece_id: "x", quantity: 1 }, { kit_id: "k", piece_id: "y", quantity: 1 }],
      currentQty: qtyFrom({ "a-x": 5 }),
    });
    expect(out).toEqual([{ storeId: "a", pieceId: "y", quantity: 1 }]);
  });

  it("kit: peça usada em outro kit soma ao que a loja já tem", () => {
    const out = buildFillMissingUpserts({
      itemKind: "kit", itemId: "k", storeIds: ["a"], quantity: 1,
      kitPieces: [
        { kit_id: "k", piece_id: "shared", quantity: 1 }, { kit_id: "k", piece_id: "x", quantity: 1 },
        { kit_id: "k2", piece_id: "shared", quantity: 1 },
      ],
      currentQty: qtyFrom({ "a-shared": 1 }),
    });
    expect(out).toEqual([
      { storeId: "a", pieceId: "shared", quantity: 2 },
      { storeId: "a", pieceId: "x", quantity: 1 },
    ]);
  });
});
