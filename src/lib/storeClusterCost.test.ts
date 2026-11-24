import { describe, it, expect } from "vitest";
import { computeCampaignStoreCosts, resolveGroup, customLabelName, groupStoreCosts, commonItems, median, type CampaignCostInput, type ClusterStore } from "./storeClusterCost";

const st = (id: string, model: string, delivery: ClusterStore["delivery"] = "frete_instalacao"): ClusterStore => ({ id, name: id, city: null, state: "SP", store_model: model, showcase_count: 1, delivery, custom: {} });

function input(): CampaignCostInput {
  return {
    campaignId: "c1", campaignName: "C1", supplierName: "W",
    stores: [st("s1", "P"), st("s2", "G", "frete_apenas"), st("s3", "P")],
    pieces: [
      { id: "a", code: 1, name: "A", image_url: null, kit_only: false },
      { id: "k1", code: 3, name: "K1", image_url: null, kit_only: true },
      { id: "k2", code: 4, name: "K2", image_url: null, kit_only: true },
    ],
    kits: [{ id: "K", code: 2, name: "Kit", image_url: null }],
    kitPieces: [{ kit_id: "K", piece_id: "k1", quantity: 2 }, { kit_id: "K", piece_id: "k2", quantity: 1 }],
    qty: new Map([
      ["s1", new Map([["a", 2], ["k1", 3], ["k2", 1]])], // kit floor(3/2)=1
      ["s2", new Map([["a", 1], ["k1", 1], ["k2", 1]])], // kit 0
      ["s3", new Map()],
    ]),
    price: new Map([["a", 10], ["k1", 5], ["k2", 7]]),
    extras: { installation: 100, freight: 60, discount: 20 },
  };
}

describe("storeClusterCost", () => {
  it("produção por loja com kit pelo mínimo de floor(qtd/qtd no kit)", () => {
    const r = computeCampaignStoreCosts(input(), false);
    const s1 = r.stores.find((s) => s.store.id === "s1")!;
    expect(s1.production).toBe(2 * 10 + 1 * (2 * 5 + 7));
    expect(r.zeroStores).toBe(1);
  });
  it("instalação só para lojas com instalação; frete para lojas com frete; desconto proporcional", () => {
    const r = computeCampaignStoreCosts(input(), true);
    const s1 = r.stores.find((s) => s.store.id === "s1")!;
    const s2 = r.stores.find((s) => s.store.id === "s2")!;
    expect(s1.installation).toBe(100);
    expect(s2.installation).toBe(0);
    expect(s1.freight).toBe(30);
    expect(s2.freight).toBe(30);
    expect(s1.discount + s2.discount).toBeCloseTo(20);
    expect(s1.discount).toBeCloseTo((20 * 37) / 47);
  });
  it("conciliação: diferença vem só do arredondamento de kits", () => {
    const r = computeCampaignStoreCosts(input(), true);
    // oficial: k1 total 4 → floor(4/2)=2, k2 total 2 → 2 => 2 kits; lojas: 1 kit
    expect(r.officialTotal).toBe(100 + 60 - 20 + 3 * 10 + 2 * 17);
    expect(r.difference).toBeCloseTo(17);
  });
  it("valor sem grupo vira o próprio grupo; vazio vira Sem classificação; ignora caixa/espaços", () => {
    const groups = [{ name: "Lojas P", values: ["P", "ÚNICA P"] }];
    expect(resolveGroup(" única p ", groups)).toBe("Lojas P");
    expect(resolveGroup("GG", groups)).toBe("GG");
    expect(resolveGroup("  ", groups)).toBe("Sem classificação");
  });
  it("rótulo personalizado mostra só o nome antes do |", () => {
    expect(customLabelName("Vitrine_PRIMÁRIA|text")).toBe("Vitrine_PRIMÁRIA");
  });
  it("agrupa e calcula média/mediana; kits aparecem como kit", () => {
    const inp = input();
    const r = computeCampaignStoreCosts(inp, false);
    const g = groupStoreCosts(r.stores, "store_model", [{ name: "Lojas P", values: ["P"] }]);
    expect(g.groups.map((x) => x.name)).toEqual(["Lojas P", "G"]);
    expect(g.all.count).toBe(2);
    expect(median([1, 3, 10, 20])).toBe(6.5);
    const items = commonItems([r], [inp], "store_model", []);
    expect(items[0]).toMatchObject({ key: "piece:a", stores: 2, totalQty: 3 });
    expect(items.find((i) => i.kind === "kit")).toMatchObject({ stores: 1, totalQty: 1, unitPrice: 17 });
    expect(items.some((i) => i.key === "piece:k1")).toBe(false);
  });
});
