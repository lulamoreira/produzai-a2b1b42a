import { describe, it, expect } from "vitest";
import { buildFillMissingUpserts, quantityDistribution, suggestQuantityFor, summarizeQuantities } from "./rateioFillMissing";

const qtyFrom = (map: Record<string, number>) => (s: string, p: string) => map[`${s}-${p}`] || 0;

describe("summarizeQuantities", () => {
  it("moda com empate escolhe a menor", () => {
    expect(summarizeQuantities([4, 6, 6, 4]).mode).toBe(4);
  });
});

describe("quantityDistribution", () => {
  it("conta lojas por quantidade, em ordem crescente", () => {
    expect(quantityDistribution([2, 1, 1, 2, 1])).toEqual([{ qty: 1, stores: 3 }, { qty: 2, stores: 2 }]);
  });
});

describe("suggestQuantityFor — sugestão por loja", () => {
  const withs = [
    { qty: 1, showcase: 1 }, { qty: 1, showcase: 1 }, { qty: 2, showcase: 1 },
    { qty: 2, showcase: 2 }, { qty: 2, showcase: 2 }, { qty: 1, showcase: 2 },
  ];
  it("usa a mais comum entre lojas com o mesmo número de vitrines", () => {
    expect(suggestQuantityFor(1, withs)).toEqual({ quantity: 1, sameShowcase: true, base: 3 });
    expect(suggestQuantityFor(2, withs)).toEqual({ quantity: 2, sameShowcase: true, base: 3 });
  });
  it("empate entre lojas comparáveis escolhe a menor", () => {
    expect(suggestQuantityFor(3, [{ qty: 4, showcase: 3 }, { qty: 2, showcase: 3 }]).quantity).toBe(2);
  });
  it("sem loja comparável usa a MENOR quantidade (nunca média nem maior)", () => {
    expect(suggestQuantityFor(5, [{ qty: 3, showcase: 1 }, { qty: 6, showcase: 2 }, { qty: 6, showcase: 2 }]))
      .toEqual({ quantity: 3, sameShowcase: false, base: 0 });
  });
});

describe("buildFillMissingUpserts", () => {
  it("peça: grava a quantidade de cada loja, só nas que hoje têm zero", () => {
    const out = buildFillMissingUpserts({
      itemKind: "piece", itemId: "p", kitPieces: [],
      targets: [{ storeId: "a", quantity: 1 }, { storeId: "c", quantity: 2 }, { storeId: "b", quantity: 6 }],
      currentQty: qtyFrom({ "b-p": 3 }),
    });
    expect(out).toEqual([
      { storeId: "a", pieceId: "p", quantity: 1 },
      { storeId: "c", pieceId: "p", quantity: 2 },
    ]);
  });

  it("nunca grava quantidade zero ou negativa", () => {
    const out = buildFillMissingUpserts({
      itemKind: "piece", itemId: "p", kitPieces: [], currentQty: qtyFrom({}),
      targets: [{ storeId: "a", quantity: 0 }, { storeId: "b", quantity: -2 }],
    });
    expect(out).toEqual([]);
  });

  it("kit: cada peça do kit recebe qtd do kit da loja × peças por kit", () => {
    const out = buildFillMissingUpserts({
      itemKind: "kit", itemId: "k", targets: [{ storeId: "a", quantity: 2 }],
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
      itemKind: "kit", itemId: "k", targets: [{ storeId: "a", quantity: 2 }],
      kitPieces: [{ kit_id: "k", piece_id: "x", quantity: 1 }],
      currentQty: qtyFrom({ "a-x": 1 }),
    });
    expect(out).toEqual([]);
  });

  it("kit: peça exclusiva nunca diminui", () => {
    const out = buildFillMissingUpserts({
      itemKind: "kit", itemId: "k", targets: [{ storeId: "a", quantity: 1 }],
      kitPieces: [{ kit_id: "k", piece_id: "x", quantity: 1 }, { kit_id: "k", piece_id: "y", quantity: 1 }],
      currentQty: qtyFrom({ "a-x": 5 }),
    });
    expect(out).toEqual([{ storeId: "a", pieceId: "y", quantity: 1 }]);
  });

  it("kit: peça usada em outro kit soma ao que a loja já tem", () => {
    const out = buildFillMissingUpserts({
      itemKind: "kit", itemId: "k", targets: [{ storeId: "a", quantity: 1 }],
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
