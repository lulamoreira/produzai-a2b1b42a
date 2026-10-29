import { describe, it, expect } from "vitest";
import { reviewRateio } from "./reviewRateio";

const stores = [
  { id: "a", name: "A", store_model: "Novo", showcase_count: 1 },
  { id: "b", name: "B", store_model: "Novo", showcase_count: 0 },
  { id: "c", name: "C", store_model: "Antigo", showcase_count: 0 },
];

describe("reviewRateio", () => {
  it("aponta item faltando em loja do mesmo modelo", () => {
    const pieces = [{ id: "p1", name: "Banner" }, { id: "p2", name: "Base" }];
    const f = reviewRateio(pieces, [], [], stores, { "a-p1": 1, "b-p2": 1, "c-p2": 1 });
    const hit = f.find((x) => x.title === "Falta em lojas do mesmo modelo" && x.itemName === "Banner");
    expect(hit?.storesWithout).toEqual(["B"]);
  });

  it("não aponta falta de item de vitrine em loja sem vitrine, mas aponta em loja que tem", () => {
    const storesV = [
      { id: "a", name: "A", store_model: "Antigo", showcase_count: 1 },
      { id: "b", name: "B", store_model: "Antigo", showcase_count: 0 },
      { id: "d", name: "D", store_model: "Antigo", showcase_count: 2 },
    ];
    const pieces = [{ id: "p1", name: "Adesivo Vitrine BF" }, { id: "p2", name: "Base" }];
    // A tem o item; B e D não têm. B não tem vitrine → inelegível; só D deve ser apontada.
    // p2 garante que B e D participam da análise.
    const f = reviewRateio(pieces, [], [], storesV, { "a-p1": 1, "b-p2": 1, "d-p2": 1 });
    const hits = f.filter((x) => x.title === "Falta em lojas do mesmo modelo" && x.itemName === "Adesivo Vitrine BF");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.storesWithout).toEqual(["D"]);
  });

  it("aponta era incompatível", () => {
    const pieces = [{ id: "p1", name: "Painel Antigo" }];
    const f = reviewRateio(pieces, [], [], stores, { "a-p1": 1 });
    expect(f.some((x) => x.type === "era_incompativel")).toBe(true);
  });

  it("aponta excesso de vitrine", () => {
    const pieces = [{ id: "v1", name: "Vitrine G" }, { id: "v2", name: "Vitrine P" }];
    const f = reviewRateio(pieces, [], [], stores, { "a-v1": 1, "a-v2": 1 });
    expect(f.some((x) => x.title === "Excesso de vitrine")).toBe(true);
    expect(f.some((x) => x.title === "Vitrines de tamanhos diferentes")).toBe(true);
  });
});
