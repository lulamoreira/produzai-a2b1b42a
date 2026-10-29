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

  const capacityPieces = [{ id: "p", name: "Adesivo Cubo G 2020" }, { id: "base", name: "Base" }];
  const labels = [{ index: 7, label: "Cubo G 2020|number" }];
  const makeStores = (caps: unknown[]) => caps.map((cap, i) => ({
    id: String(i), name: `Loja ${i}`, store_model: "Modelo", custom_field_7: cap,
  }));
  const makeQty = (values: number[]) => Object.fromEntries(values.flatMap((v, i) => [
    [`${i}-p`, v], [`${i}-base`, 1],
  ]));
  const below = (caps: unknown[], values: number[]) => reviewRateio(
    capacityPieces, [], [], makeStores(caps), makeQty(values), labels,
  ).filter((f) => f.type === "quantidade_abaixo");

  it("exclui capacidades numéricas zero, vazias e negativas do grupo elegível", () => {
    const f = reviewRateio(capacityPieces, [], [], makeStores([1, 0, "", -1, 2]), makeQty([1, 0, 0, 0, 0]), labels);
    const hit = f.find((x) => x.itemName === capacityPieces[0].name && x.type === "modelo_divergente");
    expect(hit?.storesWith).toEqual(["Loja 0"]);
    expect(hit?.storesWithout).toEqual(["Loja 4"]);
  });

  it.each(["boolean", "text"])("usa capacidade %s sem cravar índice e ignora valores negativos de presença", (kind) => {
    const caps = ["Sim", "Não", "0", false, "-", "", "Disponível"];
    const f = reviewRateio(capacityPieces, [], [], makeStores(caps), makeQty([1, 0, 0, 0, 0, 0, 0]), [{ index: 7, label: `Cubo G 2020|${kind}` }]);
    expect(f.find((x) => x.itemName === capacityPieces[0].name)?.storesWithout).toEqual(["Loja 6"]);
    expect(f.filter((x) => x.type === "quantidade_abaixo")).toHaveLength(0);
  });

  it("escolhe o campo mais específico e exige todos os tokens separados", () => {
    const f = reviewRateio(capacityPieces, [], [], makeStores([1, 0]), makeQty([1, 0]), [
      { index: 8, label: "Cubo|number" }, ...labels,
      { index: 9, label: "Cubo P 2020|number" },
      { index: 10, label: "Cubo G 20|number" },
    ]);
    expect(f.filter((x) => x.type === "modelo_divergente" && x.itemName === capacityPieces[0].name)).toHaveLength(0);
    const unmatched = reviewRateio(capacityPieces, [], [], makeStores([1, 0]), makeQty([1, 0]), [
      { index: 7, label: "Cubo P 2020|number" }, { index: 7, label: "Cubo G 20|number" },
    ]);
    expect(unmatched.find((x) => x.itemName === capacityPieces[0].name)?.storesWithout).toEqual(["Loja 1"]);
  });

  it("normaliza acentos, ignora stopwords e associa pela localização", () => {
    const f = reviewRateio([{ id: "p", name: "Adesivo", category: "Café" }, capacityPieces[1]], [], [],
      makeStores(["true", "false", "true"]), makeQty([1, 0, 0]), [{ index: 7, label: "Kit de Adesivos Café|boolean" }]);
    expect(f.find((x) => x.itemName === "Adesivo")?.storesWithout).toEqual(["Loja 2"]);
  });

  it("não associa rótulos sem tokens", () => {
    const f = reviewRateio(capacityPieces, [], [], makeStores([0, 0]), makeQty([1, 0]), [{ index: 7, label: "Kit de Adesivos|number" }]);
    expect(f.find((x) => x.itemName === capacityPieces[0].name)?.storesWithout).toEqual(["Loja 1"]);
  });

  it("exige pelo menos quatro lojas com quantidade e capacidade positivas", () => {
    expect(below([10, 10, 10], [10, 10, 1])).toHaveLength(0);
    expect(below([10, 10, 10, 0, 10], [10, 10, 1, 2, 0])).toHaveLength(0);
    expect(below([10, 10, 10, 10], [10, 10, 10, 1])).toHaveLength(1);
  });

  it("exige razão dominante em pelo menos 60% e aceita o limite exato", () => {
    expect(below([10, 10, 10, 10], [10, 10, 5, 2])).toHaveLength(0);
    expect(below([10, 10, 10, 10, 10], [10, 10, 10, 5, 2])).toHaveLength(2);
  });

  it("aponta somente abaixo de 90% do esperado, nunca a mais", () => {
    const f = below([10, 20, 30, 10, 10, 10, 10], [10, 20, 30, 10, 9, 8, 20]);
    expect(f).toHaveLength(1);
    expect(f[0]?.detail).toContain("Loja 5 recebe 8");
    expect(f[0]?.detail).toContain("capacidade 10 (Cubo G 2020)");
    expect(f[0]?.severity).toBe("media");
  });

  it("arredonda as razões a duas casas antes de contar a frequência", () => {
    expect(below([1000, 1000, 1000, 1000], [1001, 1002, 1003, 500])).toHaveLength(1);
  });

  it("não gera ruído para quantidade fixa sem razão dominante nem outlier simétrico", () => {
    const f = reviewRateio(capacityPieces, [], [], makeStores([1, 2, 3, 4]), makeQty([2, 2, 2, 2]), labels);
    expect(f).toHaveLength(0);
    expect(below([1, 1, 1, 1], [1, 1, 1, 2])).toHaveLength(0);
  });

  it("usa a contagem derivada de kits no alerta proporcional", () => {
    const f = reviewRateio([], [{ id: "k", name: "Kit Cubo G 2020" }],
      [{ kit_id: "k", piece_id: "p", quantity: 2 }], makeStores([10, 10, 10, 10]), makeQty([20, 20, 20, 4]), labels);
    expect(f.filter((x) => x.type === "quantidade_abaixo")).toHaveLength(1);
    expect(f.find((x) => x.type === "quantidade_abaixo")?.detail).toContain("recebe 2");
  });

  it("mantém o CHECK 2 de modelo incompatível", () => {
    const f = reviewRateio([{ id: "p", name: "Banner", store_category: "Novo" }], [], [], stores, { "a-p": 1, "c-p": 1 });
    expect(f.filter((x) => x.type === "modelo_incompativel")).toHaveLength(1);
  });
});
