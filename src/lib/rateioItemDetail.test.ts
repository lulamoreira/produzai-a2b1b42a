import { describe, expect, it } from "vitest";
import { buildItemDetail } from "@/lib/rateioItemDetail";

const pieces = [
  { id: "p1", code: 5, name: "Faixa", size: "100x20", category: "Vitrine", sub_location: "", store_category: "TODAS", image_url: "a.png" },
  { id: "p2", code: 6, name: "Base", size: "", category: "Balcão", sub_location: "Frente" },
];
const kits = [{ id: "k1", code: 20, name: "KIT Vitrine", category: "Vitrine" }];
const kitPieces = [
  { kit_id: "k1", piece_id: "p1", quantity: 2 },
  { kit_id: "k1", piece_id: "p2", quantity: 1 },
];
const stores = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];
const qtyMap = { "s1-p1": 4, "s1-p2": 2, "s2-p1": 2, "s2-p2": 0, "s3-p1": 1, "s3-p2": 1 };

describe("buildItemDetail", () => {
  it("peça: kits em que entra, total na campanha e campos vazios omitidos", () => {
    const d = buildItemDetail("piece", "p1", pieces, kits, kitPieces, stores, qtyMap)!;
    expect(d.totalQuantity).toBe(7);
    expect(d.storesReceiving).toBe(3);
    expect(d.links).toEqual([{ id: "k1", code: "20", name: "KIT Vitrine", perKit: 2 }]);
    expect(d.fields.map((f) => f.label)).toEqual(["Medidas", "Grupo", "Tipo"]);
  });
  it("kit: conta kits completos pela regra do menor quociente", () => {
    const d = buildItemDetail("kit", "k1", pieces, kits, kitPieces, stores, qtyMap)!;
    // s1: min(4/2, 2/1)=2; s2: p2=0 → 0; s3: floor(1/2)=0
    expect(d.totalQuantity).toBe(2);
    expect(d.storesReceiving).toBe(1);
    expect(d.links.map((l) => l.id)).toEqual(["p1", "p2"]);
  });
  it("item inexistente → null", () => {
    expect(buildItemDetail("piece", "zz", pieces, kits, kitPieces, stores, qtyMap)).toBeNull();
  });
});
