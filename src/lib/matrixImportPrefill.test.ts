import { describe, expect, it } from "vitest";
import { autoMapMatrixItems, filterEmptyMatrixCells, storesWithoutMatrixReference, transferKitQuantities } from "./matrixImportPrefill";

describe("matrix import prefill rules", () => {
  it("reuses Flow normalization and accepts Jaccard 0.5 but rejects lower scores", () => {
    expect(autoMapMatrixItems([
      { id: "a", name: "KIT Painél Lateral 20x30cm", type: "piece" },
      { id: "b", name: "Adesivo Moldura Especial", type: "piece" },
    ], [
      { id: "x", label: "Painel", type: "piece" },
      { id: "y", label: "Adesivo", type: "piece" },
    ])).toEqual({ a: { targetId: "x", targetType: "piece" } });
  });

  it("matches kit components as pieces and never auto-maps kits", () => {
    expect(autoMapMatrixItems([
      { id: "kit-a", name: "KIT Shelftalk", type: "kit" },
      { id: "kitpiece-kit-a-piece-a", name: "Shelftalk Superior", type: "piece" },
    ], [
      { id: "kit-b", label: "KIT Shelftalk", type: "kit" },
      { id: "component-b", label: "Shelftalk Inferior", type: "piece" },
    ])).toEqual({ "kitpiece-kit-a-piece-a": { targetId: "component-b", targetType: "piece" } });
  });

  it("gives the highest score priority and assigns the next free eligible target", () => {
    expect(autoMapMatrixItems([
      { id: "partial", name: "Painel Lateral", type: "piece" },
      { id: "exact", name: "Painel Lateral Especial", type: "piece" },
    ], [
      { id: "best", label: "Painel Lateral Especial", type: "piece" },
      { id: "fallback", label: "Painel", type: "piece" },
    ])).toEqual({ exact: { targetId: "best", targetType: "piece" }, partial: { targetId: "fallback", targetType: "piece" } });
  });

  it("does not match empty token sets", () => {
    expect(autoMapMatrixItems([{ id: "a", name: "KIT 20x30cm", type: "piece" }], [{ id: "b", label: "KIT", type: "piece" }])).toEqual({});
  });

  it("only warns for current stores entirely absent from source rows, including zero rows", () => {
    expect(storesWithoutMatrixReference([{ id: "old" }, { id: "new" }], [
      { store_id: "old", piece_id: "p", quantity: 0 },
      { store_id: "outside", piece_id: "p", quantity: 10 },
    ])).toEqual([{ id: "new" }]);
  });

  it("preserves positive cells and fills only zero or absent cells for the same store/target pair", () => {
    const changes = [
      { storeId: "s", pieceId: "filled", quantity: 5 },
      { storeId: "s", pieceId: "zero", quantity: 6 },
      { storeId: "other", pieceId: "filled", quantity: 7 },
    ];
    expect(filterEmptyMatrixCells(changes, [
      { store_id: "s", piece_id: "filled", quantity: 2 },
      { store_id: "s", piece_id: "zero", quantity: 0 },
    ])).toEqual({ changes: changes.slice(1), skipped: 1 });
  });
});
describe("kit to kit transfer", () => {
  const src = [{ kit_id: "k", piece_id: "a", quantity: 2 }, { kit_id: "k", piece_id: "b", quantity: 1 }];
  const dst = [{ kit_id: "t", piece_id: "x", quantity: 3 }, { kit_id: "t", piece_id: "y", quantity: 1 }];
  it("uses min floor(component/qty-per-kit) and multiplies by destination qty-per-kit", () => {
    expect(transferKitQuantities("k", "t", src, dst, [
      { store_id: "s", piece_id: "a", quantity: 5 }, { store_id: "s", piece_id: "b", quantity: 4 },
    ], ["s"])).toEqual([{ storeId: "s", pieceId: "x", quantity: 6 }, { storeId: "s", pieceId: "y", quantity: 2 }]);
  });
  it("a component with 0 in the store makes the kit 0 there", () => {
    expect(transferKitQuantities("k", "t", src, dst, [{ store_id: "s", piece_id: "a", quantity: 8 }], ["s"])).toEqual([]);
  });
});
