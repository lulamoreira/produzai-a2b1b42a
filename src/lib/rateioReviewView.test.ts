import { describe, expect, it } from "vitest";
import { ALL, DEFAULT_REASONS, EMPTY_FILTERS, filterFindings, showcaseGroups, topReasons } from "@/lib/rateioReviewView";
import type { RateioFinding } from "@/lib/reviewRateio";

const w = (qty: number, showcase: number, id = `${qty}-${showcase}-${Math.random()}`) => ({ id, name: id, qty, showcase });
const wo = (showcase: number, id = `x-${showcase}-${Math.random()}`) => ({ id, name: id, showcase });

describe("showcaseGroups", () => {
  it("80% do grupo tem e há quem não tem → provável erro", () => {
    const g = showcaseGroups({ storesWithQty: [w(1, 2), w(1, 2), w(2, 2), w(1, 2)], storesWithoutIds: [wo(2)] });
    expect(g).toEqual([{ showcase: 2, have: 4, mode: 1, notHave: 1, flag: "provavel_erro" }]);
  });
  it("abaixo de 80% não marca", () => {
    const g = showcaseGroups({ storesWithQty: [w(1, 1), w(1, 1), w(1, 1)], storesWithoutIds: [wo(1)] });
    expect(g[0].flag).toBeNull(); // 3/4 = 75%
  });
  it("grupo sem nenhuma loja que tenha → sem referência", () => {
    const g = showcaseGroups({ storesWithQty: [w(6, 2)], storesWithoutIds: [wo(3)] });
    expect(g.find((x) => x.showcase === 3)).toEqual({ showcase: 3, have: 0, mode: 0, notHave: 1, flag: "sem_referencia" });
  });
  it("grupo em que todas têm não marca e ordena por nº de vitrines", () => {
    const g = showcaseGroups({ storesWithQty: [w(2, 3), w(1, 1)], storesWithoutIds: [wo(2)] });
    expect(g.map((x) => x.showcase)).toEqual([1, 2, 3]);
    expect(g[0].flag).toBeNull();
  });
});

const f = (over: Partial<RateioFinding>): RateioFinding => ({ severity: "media", type: "modelo_divergente", title: "t", detail: "d", ...over });

describe("filterFindings", () => {
  const list = [
    f({ itemName: "Adesivo Pistache", itemCode: 76, storesWithout: ["São José"] }),
    f({ severity: "alta", type: "kit_incompleto", itemName: "Kit Natal", itemCode: 12, storesWith: ["Recife"] }),
    f({ severity: "baixa", type: "loja_unica", itemName: "Totem", storeName: "Outlet Catarina" }),
  ];
  it("busca ignora acento e maiúsculas (item, código, loja)", () => {
    expect(filterFindings(list, { ...EMPTY_FILTERS, query: "SAO JOSE" }, (x) => x)).toHaveLength(1);
    expect(filterFindings(list, { ...EMPTY_FILTERS, query: "pistáche" }, (x) => x)[0].itemCode).toBe(76);
    expect(filterFindings(list, { ...EMPTY_FILTERS, query: "12" }, (x) => x)[0].itemName).toBe("Kit Natal");
    expect(filterFindings(list, { ...EMPTY_FILTERS, query: "catarina" }, (x) => x)[0].itemName).toBe("Totem");
  });
  it("filtra por severidade e por tipo", () => {
    expect(filterFindings(list, { ...EMPTY_FILTERS, severity: "alta" }, (x) => x)).toHaveLength(1);
    expect(filterFindings(list, { query: "", severity: ALL, type: "loja_unica" }, (x) => x)[0].itemName).toBe("Totem");
  });
});

describe("topReasons", () => {
  it("sem motivos salvos usa os padrões", () => {
    expect(topReasons([])).toEqual([...DEFAULT_REASONS]);
  });
  it("ordena pelos mais usados, junta variações e limita a 8", () => {
    const js = [
      ...Array.from({ length: 3 }, () => ({ motivo: "Outlet" })),
      { motivo: "outlet " },
      ...Array.from({ length: 2 }, () => ({ motivo: "Loja pediu" })),
      ...Array.from({ length: 9 }, (_, i) => ({ motivo: `Motivo ${i}` })),
    ];
    const r = topReasons(js);
    expect(r).toHaveLength(8);
    expect(r[0]).toBe("Outlet");
    expect(r[1]).toBe("Loja pediu");
  });
});
