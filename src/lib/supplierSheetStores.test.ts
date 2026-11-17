import { describe, it, expect } from "vitest";
import { mergeSupplierSheetStores } from "./supplierSheetStores";

const full = [
  { id: "a", name: "Anália Franco", city: "SP", store_model: "NOVO", showcase_count: 2, tipo_entrega: "frete_instalacao" },
  { id: "b", name: "Barigui", city: "PR", store_model: "ANTIGO", showcase_count: 1, tipo_entrega: "frete_apenas" },
];

describe("mergeSupplierSheetStores", () => {
  it("keeps store model and showcase count when the reread row lacks them", () => {
    const out = mergeSupplierSheetStores(full, [{ id: "a", name: "Anália Franco", city: "SÃO PAULO" }]);
    expect(out[0].store_model).toBe("NOVO");
    expect(out[0].showcase_count).toBe(2);
    expect(out[0].city).toBe("SÃO PAULO");
  });

  it("uses fresh database values for model and showcases when present", () => {
    const out = mergeSupplierSheetStores(full, [{ id: "b", store_model: "LOOK & FEEL", showcase_count: 3 }]);
    expect(out[1].store_model).toBe("LOOK & FEEL");
    expect(out[1].showcase_count).toBe(3);
  });

  it("writes the campaign effective logistics type", () => {
    const out = mergeSupplierSheetStores(full, [], new Map([["a", "instalacao_apenas" as const]]));
    expect(out[0].tipo_entrega).toBe("instalacao_apenas");
    expect(out[1].tipo_entrega).toBe("frete_apenas");
  });

  it("preserves the input order", () => {
    const out = mergeSupplierSheetStores(full, [{ id: "b" }, { id: "a" }]);
    expect(out.map((s) => s.id)).toEqual(["a", "b"]);
  });
});
