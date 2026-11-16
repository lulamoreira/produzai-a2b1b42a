import { describe, expect, it } from "vitest";
import { findingStoreNames, splitByStoreNames } from "./storeNameLinks";
import type { RateioFinding } from "./reviewRateio";

const base: RateioFinding = { severity: "media", type: "vitrine_excesso", title: "t", detail: "d" };

describe("splitByStoreNames", () => {
  it("troca o nome da loja na descrição, mantendo o resto do texto", () => {
    const segs = splitByStoreNames("A loja SHOPPING DIAMOND MALL tem 2 vitrine(s).", ["Shopping Diamond Mall"]);
    expect(segs).toEqual([
      { text: "A loja " },
      { text: "SHOPPING DIAMOND MALL", name: "Shopping Diamond Mall" },
      { text: " tem 2 vitrine(s)." },
    ]);
  });

  it("ignora acentos e preserva o texto original", () => {
    const segs = splitByStoreNames("Em São Paulo Ibirapuera: falta.", ["SAO PAULO IBIRAPUERA"]);
    expect(segs[1]).toEqual({ text: "São Paulo Ibirapuera", name: "SAO PAULO IBIRAPUERA" });
    expect(segs.map((s) => s.text).join("")).toBe("Em São Paulo Ibirapuera: falta.");
  });

  it("prefere o nome mais longo quando um contém o outro", () => {
    const segs = splitByStoreNames("Lojas: Diamond Mall, Shopping Diamond Mall.", ["Diamond Mall", "Shopping Diamond Mall"]);
    const linked = segs.filter((s) => s.name).map((s) => [s.text, s.name]);
    expect(linked).toEqual([
      ["Diamond Mall", "Diamond Mall"],
      ["Shopping Diamond Mall", "Shopping Diamond Mall"],
    ]);
  });

  it("respeita limites de palavra", () => {
    expect(splitByStoreNames("Centronorte e Centro.", ["Centro"]).filter((s) => s.name)).toEqual([{ text: "Centro", name: "Centro" }]);
  });

  it("sem nomes conhecidos devolve o texto inteiro", () => {
    expect(splitByStoreNames("Nada aqui", ["Outra"])).toEqual([{ text: "Nada aqui" }]);
  });
});

describe("findingStoreNames", () => {
  it("junta todas as listas do achado sem repetir", () => {
    const f: RateioFinding = {
      ...base,
      storeName: "Loja A",
      storesWith: ["Loja B", "loja a"],
      storesWithout: ["Loja C"],
      storesInfo: [{ name: "Loja D", label: "x" }],
      storesWithQty: [{ id: "1", name: "Loja E", qty: 1, showcase: 1 }],
      storesWithoutIds: [{ id: "2", name: "Loja C", showcase: 1 }],
    };
    expect(findingStoreNames(f)).toEqual(["Loja A", "Loja B", "Loja C", "Loja D", "Loja E"]);
  });
});
