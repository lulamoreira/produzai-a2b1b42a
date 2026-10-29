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
