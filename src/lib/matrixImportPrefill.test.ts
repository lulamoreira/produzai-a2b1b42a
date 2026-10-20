import { describe, expect, it } from "vitest";
import { autoMapMatrixItems, filterEmptyMatrixCells, storesWithoutMatrixReference } from "./matrixImportPrefill";

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