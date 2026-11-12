import { describe, it, expect } from "vitest";
import {
  buildSupplierChangeMessage,
  describeSupplierChange,
  filterRowsWithChanges,
  findRemovalCandidates,
  formatSupplierChangeCounts,
  normalizeAspects,
  summarizeSupplierChanges,
} from "./supplierChangeMarkers";

describe("supplier change markers", () => {
  it("counts new, changed and removed items separately", () => {
    const s = summarizeSupplierChanges([
      { change_type: "new" }, { change_type: "new" }, { change_type: "new" },
      { change_type: "changed" }, { change_type: "changed" },
      { change_type: "removed" },
    ]);
    expect(s).toEqual({ new: 3, changed: 2, removed: 1, total: 6 });
    expect(formatSupplierChangeCounts(s)).toBe("3 novas, 2 alteradas e 1 removida");
  });

  it("returns no message when nothing is marked", () => {
    expect(buildSupplierChangeMessage(summarizeSupplierChanges([]))).toBe("");
  });

  it("lists which aspects changed", () => {
    expect(describeSupplierChange({ change_type: "changed", aspects: ["quantities", "image"] }))
      .toBe("Alterada: quantidades do rateio, imagem");
  });

  it("only allows kit components on kits", () => {
    expect(normalizeAspects(["components", "image"], "piece")).toEqual(["image"]);
    expect(normalizeAspects(["components", "quantities"], "kit")).toEqual(["quantities", "components"]);
  });

  it("keeps the whole kit block when one of its pieces is marked", () => {
    const rows = [
      { type: "standalone_piece" as const, pieceId: "p1" },
      { type: "standalone_piece" as const, pieceId: "p2" },
      { type: "kit_header" as const, kitId: "k1" },
      { type: "kit_piece" as const, kitId: "k1", pieceId: "c1" },
      { type: "kit_piece" as const, kitId: "k1", pieceId: "c2" },
      { type: "kit_header" as const, kitId: "k2" },
      { type: "kit_piece" as const, kitId: "k2", pieceId: "c3" },
    ];
    const out = filterRowsWithChanges(rows, new Set(["p2", "c2"]), new Set());
    expect(out.map((r) => r.pieceId ?? r.kitId)).toEqual(["p2", "k1", "c1", "c2"]);
  });

  it("suggests as removed only items of the quoted version missing now", () => {
    const out = findRemovalCandidates(
      [
        { kind: "piece", code: 1, name: "A" },
        { kind: "piece", code: 2, name: "B" },
        { kind: "kit", code: 2, name: "Kit B" },
      ],
      [{ kind: "piece", code: 1 }, { kind: "kit", code: 2 }],
    );
    expect(out).toEqual([{ kind: "piece", code: 2, name: "B" }]);
  });
});
