import { describe, it, expect } from "vitest";
import { reviewRateio } from "./reviewRateio";

const stores = [
  { id: "a", name: "A", store_model: "Novo", showcase_count: 1 },
  { id: "b", name: "B", store_model: "Novo", showcase_count: 0 },
  { id: "c", name: "C", store_model: "Antigo", showcase_count: 0 },
];

describe("reviewRateio", () => {
  const lonePieces = [{ id: "p1", name: "Banner" }, { id: "base", name: "Base" }];
  const loneStores = (count: number) => [
    { id: "o", name: "Outlet", store_model: "OUTLET", showcase_count: 1 },
    ...Array.from({ length: count }, (_, i) => ({
      id: `l${i}`, name: `Loja ${i}`, store_model: "LOJA", showcase_count: 1,
    })),
  ];
  const loneQty = (count: number, receivers: number) => Object.fromEntries([
    ["o-base", 1],
    ...Array.from({ length: count }, (_, i) => [`l${i}-base`, 1]),
    ...Array.from({ length: receivers }, (_, i) => [`l${i}-p1`, 1]),
  ]);
  const loneHits = (findings: ReturnType<typeof reviewRateio>) => findings.filter(
    (finding) => String(finding.type) === "loja_unica" && finding.itemName === "Banner",
  );

  it("revisa loja única do modelo comparando com todas as lojas", () => {
    const hits = loneHits(reviewRateio(lonePieces, [], [], loneStores(5), loneQty(5, 5)));
    expect(hits).toHaveLength(1);
    expect(hits[0]?.storeName).toBe("Outlet");
    expect(hits[0]?.storesWith).toEqual(["Loja 0", "Loja 1", "Loja 2", "Loja 3", "Loja 4"]);
  });

  it("loja única exige quatro comparáveis e aceita exatamente 50% recebendo", () => {
    expect(loneHits(reviewRateio(lonePieces, [], [], loneStores(3), loneQty(3, 3)))).toHaveLength(0);
    expect(loneHits(reviewRateio(lonePieces, [], [], loneStores(4), loneQty(4, 2)))).toHaveLength(1);
    expect(loneHits(reviewRateio(lonePieces, [], [], loneStores(4), loneQty(4, 1)))).toHaveLength(0);
  });

  it("loja única ignora item já recebido e lojas não participantes ou com modelo repetido", () => {
    expect(loneHits(reviewRateio(lonePieces, [], [], loneStores(5), { ...loneQty(5, 5), "o-p1": 1 }))).toHaveLength(0);
    const quantities = loneQty(5, 5);
    delete quantities["o-base"];
    expect(loneHits(reviewRateio(lonePieces, [], [], loneStores(5), quantities))).toHaveLength(0);
    const repeated = [...loneStores(5), { id: "o2", name: "Outro Outlet", store_model: " outlet ", showcase_count: 1 }];
    expect(loneHits(reviewRateio(lonePieces, [], [], repeated, { ...loneQty(5, 5), "o2-base": 1 }))).toHaveLength(0);
  });

  it("loja única ignora ausência sem capacidade vinculada e exclui comparáveis inelegíveis", () => {
    const pieces = [{ id: "p1", name: "Banner", category: "Vitrine" }, lonePieces[1]];
    const noShowcase = loneStores(5).map((store) => ({ ...store, showcase_count: store.id === "o" ? 0 : 1 }));
    expect(loneHits(reviewRateio(pieces, [], [], noShowcase, loneQty(5, 5)))).toHaveLength(0);
    const smallBase = loneStores(5).map((store) => ({ ...store, showcase_count: ["l3", "l4"].includes(store.id) ? 0 : 1 }));
    expect(loneHits(reviewRateio(pieces, [], [], smallBase, loneQty(5, 3)))).toHaveLength(0);
  });

  it.each([{ withCapacity: 9, expected: 0 }, { withCapacity: 8, expected: 1 }])(
    "loja única ignora ausência explicada só a partir de 90% ($withCapacity/10)",
    ({ withCapacity, expected }) => {
      const stores = loneStores(10).map((store, i) => ({
        ...store, custom_field_18: i > 0 && i <= withCapacity ? "true" : "false",
      }));
      expect(loneHits(reviewRateio(lonePieces, [], [], stores, loneQty(10, 10),
        [{ index: 18, label: "Café|boolean" }]))).toHaveLength(expected);
    },
  );

  it("revisa loja participante sem modelo e usa quantidade derivada de kits", () => {
    const stores = loneStores(5).map((store) => ({ ...store, store_model: store.id === "o" ? "" : store.store_model }));
    const findings = reviewRateio([lonePieces[1]], [{ id: "k", name: "Banner" }],
      [{ kit_id: "k", piece_id: "p1", quantity: 2 }], stores,
      { ...loneQty(5, 0), ...Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`l${i}-p1`, 2])) });
    expect(loneHits(findings)[0]?.storeName).toBe("Outlet");
    expect(loneHits(findings)[0]?.storeModel).toBe("(sem modelo)");
  });

  it("aponta item faltando em loja do mesmo modelo", () => {
    const pieces = [{ id: "p1", name: "Banner" }, { id: "p2", name: "Base" }];
    const withoutCapacityDifference = stores.map((store) => ({ ...store, showcase_count: 0 }));
    const f = reviewRateio(pieces, [], [], withoutCapacityDifference, { "a-p1": 1, "b-p2": 1, "c-p2": 1 });
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
    const unmatched = reviewRateio(capacityPieces, [], [], makeStores([1, 1]), makeQty([1, 0]), [
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

  it("compara só lojas de mesma capacidade e aponta somente quem recebe a menos", () => {
    const f = below([10, 10, 10, 10, 10, 10, 10, 10, 20], [10, 10, 10, 10, 10, 9, 8, 20, 5]);
    expect(f).toHaveLength(2);
    expect(f.map((x) => x.detail).join(" ")).toContain("Loja 5 recebe 9");
    expect(f[0]?.detail).toContain("abaixo do padrão 10");
    expect(f[0]?.detail).toContain("(10 Cubo G 2020)");
    expect(f[0]?.severity).toBe("media");
  });

  it("quantidade fixa por loja não é apontada entre capacidades diferentes", () => {
    expect(below([1, 1, 1, 1, 2, 2, 2, 2], [1, 1, 1, 1, 1, 1, 1, 1])).toHaveLength(0);
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

  it.each([
    { recipientsWithCapacity: 9, expectedMissing: ["Com café"] },
    { recipientsWithCapacity: 8, expectedMissing: ["Sem café", "Com café"] },
  ])("deduz capacidade só a partir de 90% dos recebedores ($recipientsWithCapacity/10)", ({ recipientsWithCapacity, expectedMissing }) => {
    const recipients = Array.from({ length: 10 }, (_, i) => ({
      id: String(i), name: `Recebedora ${i}`, store_model: "Modelo",
      custom_field_18: i < recipientsWithCapacity ? "true" : "false",
    }));
    const missing = [
      { id: "no", name: "Sem café", store_model: "Modelo", custom_field_18: "false" },
      { id: "yes", name: "Com café", store_model: "Modelo", custom_field_18: "true" },
    ];
    const quantities = Object.fromEntries([
      ...recipients.map((s) => [`${s.id}-p`, 1]),
      ...missing.map((s) => [`${s.id}-base`, 1]),
    ]);
    const findings = reviewRateio([{ id: "p", name: "Banner" }, { id: "base", name: "Base" }],
      [], [], [...recipients, ...missing], quantities, [{ index: 18, label: "Café|boolean" }]);
    const hit = findings.find((f) => f.type === "modelo_divergente" && f.itemName === "Banner");
    expect(hit?.storesWithout).toEqual(expectedMissing);
    expect(hit?.storesWith).toEqual(recipients.map((s) => s.name));
  });

  it("retira ausências explicadas da base usada no limiar de metade das lojas", () => {
    const group = makeStores([1, 1, 1, 0, "", -1, 0]);
    const findings = reviewRateio([{ id: "p", name: "Banner" }, { id: "base", name: "Base" }],
      [], [], group, makeQty([1, 1, 0, 0, 0, 0, 0]), [{ index: 7, label: "Capacidade|number" }]);
    const hit = findings.find((f) => f.type === "modelo_divergente" && f.itemName === "Banner");
    expect(hit?.severity).toBe("media");
    expect(hit?.storesWith).toEqual(["Loja 0", "Loja 1"]);
    expect(hit?.storesWithout).toEqual(["Loja 2"]);
  });

  describe("consistência dos kits", () => {
    const KIT_TYPES = ["kit_incompleto", "kit_fora_proporcao", "peca_compartilhada"];
    const kitFindings = (findings: ReturnType<typeof reviewRateio>) =>
      findings.filter((f) => KIT_TYPES.includes(f.type));
    const abPieces = [{ id: "A", name: "Peça A" }, { id: "B", name: "Peça B" }];
    const abKit = [{ id: "K", name: "Kit AB" }];
    const abComps = [{ kit_id: "K", piece_id: "A", quantity: 1 }, { kit_id: "K", piece_id: "B", quantity: 2 }];
    const threeStores = ["1", "2", "3"].map((id) => ({ id, name: `Loja ${id}`, store_model: "M" }));
    const proportional = { "1-A": 1, "1-B": 2, "2-A": 1, "2-B": 2, "3-A": 1, "3-B": 2 };

    it("kit proporcional em 3 lojas não gera nenhum achado de kit", () => {
      expect(kitFindings(reviewRateio(abPieces, abKit, abComps, threeStores, proportional))).toHaveLength(0);
    });

    it("loja com A=2 e B=0 gera kit_incompleto citando A presente e B zerada", () => {
      const f = kitFindings(reviewRateio(abPieces, abKit, abComps, threeStores, { ...proportional, "2-A": 2, "2-B": 0 }));
      expect(f).toHaveLength(1);
      expect(f[0]?.type).toBe("kit_incompleto");
      expect(f[0]?.severity).toBe("alta");
      expect(f[0]?.title).toBe("Kit incompleto em 1 loja(s)");
      expect(f[0]?.detail).toContain("Em Loja 2: 'Peça A' tem 2, mas 'Peça B' está zerada.");
      expect(f[0]?.itemName).toBe("Kit AB");
      expect(f[0]?.storesWith).toEqual(["Loja 2"]);
      expect(f[0]?.breakdown).toEqual([{ name: "Peça A", quantity: 2 }, { name: "Peça B", quantity: 0 }]);
    });

    it("loja com A=1 e B=19 gera kit_fora_proporcao citando 19 e 2", () => {
      const f = kitFindings(reviewRateio(abPieces, abKit, abComps, threeStores, { ...proportional, "3-B": 19 }));
      expect(f).toHaveLength(1);
      expect(f[0]?.type).toBe("kit_fora_proporcao");
      expect(f[0]?.severity).toBe("media");
      expect(f[0]?.detail).toContain("'Peça B' tem 19, mas o kit pede 2 por kit × 1 kit(s) = 2.");
      expect(f[0]?.storesWith).toEqual(["Loja 3"]);
      expect(f[0]?.breakdown).toEqual([{ name: "Peça B", quantity: 19 }]);
    });

    it("peça presente mas abaixo da quantidade por kit também conta como kit incompleto", () => {
      const f = kitFindings(reviewRateio(abPieces, abKit, abComps, threeStores, { ...proportional, "1-B": 1 }));
      expect(f).toHaveLength(1);
      expect(f[0]?.type).toBe("kit_incompleto");
      expect(f[0]?.detail).toContain("'Peça B' tem só 1 e o kit pede 2 por kit");
    });

    const sharedPieces = [{ id: "T", name: "Tapete" }, { id: "U", name: "U" }, { id: "V", name: "V" }];
    const sharedKits = [{ id: "K1", name: "Kit 1" }, { id: "K2", name: "Kit 2" }];
    const sharedComps = [
      { kit_id: "K1", piece_id: "T", quantity: 1 }, { kit_id: "K1", piece_id: "U", quantity: 1 },
      { kit_id: "K2", piece_id: "T", quantity: 1 }, { kit_id: "K2", piece_id: "V", quantity: 1 },
    ];
    const oneStore = [{ id: "s", name: "Loja S", store_model: "M" }];

    it("peça em 2 kits com T=1 (esperado 2) gera peca_compartilhada; com T=2 não gera", () => {
      const f = kitFindings(reviewRateio(sharedPieces, sharedKits, sharedComps, oneStore, { "s-U": 1, "s-V": 1, "s-T": 1 }));
      expect(f).toHaveLength(1);
      expect(f[0]?.type).toBe("peca_compartilhada");
      expect(f[0]?.itemName).toBe("Tapete");
      expect(f[0]?.detail).toContain("'Tapete' está em 2 kits. O rateio grava 1 no total, mas a soma dos kits é 2.");
      expect(f[0]?.storesWith).toEqual(["Loja S"]);
      expect(f[0]?.breakdown).toEqual([{ name: "Kit 1", quantity: 1 }, { name: "Kit 2", quantity: 1 }]);
      expect(kitFindings(reviewRateio(sharedPieces, sharedKits, sharedComps, oneStore, { "s-U": 1, "s-V": 1, "s-T": 2 }))).toHaveLength(0);
    });

    it("kit com todos os componentes compartilhados é ignorado nas checagens 6 e 7", () => {
      const pieces = [{ id: "T", name: "T" }, { id: "X", name: "X" }];
      const kits = [{ id: "K1", name: "Kit 1" }, { id: "K2", name: "Kit 2" }];
      const comps = ["K1", "K2"].flatMap((kit_id) => [
        { kit_id, piece_id: "T", quantity: 1 }, { kit_id, piece_id: "X", quantity: 1 },
      ]);
      expect(kitFindings(reviewRateio(pieces, kits, comps, oneStore, { "s-T": 1, "s-X": 0 }))).toHaveLength(0);
      expect(kitFindings(reviewRateio(pieces, kits, comps, oneStore, { "s-T": 1, "s-X": 5 }))).toHaveLength(0);
    });

    describe("ausência esperada no kit incompleto", () => {
      const supInfPieces = [{ id: "S", name: "Superior" }, { id: "I", name: "Inferior 2020" }];
      const supInfKit = [{ id: "K", name: "Kit Mesa" }];
      const supInfComps = [{ kit_id: "K", piece_id: "S", quantity: 1 }, { kit_id: "K", piece_id: "I", quantity: 1 }];
      const incompletos = (findings: ReturnType<typeof reviewRateio>) => findings.filter((f) => f.type === "kit_incompleto");
      const lojas = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `l${i}`, name: `Loja ${i}`, store_model: "M" }));
      const qtd = (n: number, comInferior: number) => Object.fromEntries(
        Array.from({ length: n }, (_, i) => [[`l${i}-S`, 1], [`l${i}-I`, i < comInferior ? 1 : 0]]).flat(),
      );
      const pecasSemEra = [{ id: "S", name: "Superior" }, { id: "I", name: "Inferior" }];

      it("loja ANTIGO sem a Inferior 2020 não é apontada", () => {
        const loja = [{ id: "x", name: "Loja Antiga", store_model: "Antigo" }];
        expect(incompletos(reviewRateio(supInfPieces, supInfKit, supInfComps, loja, { "x-S": 1, "x-I": 0 }))).toHaveLength(0);
      });

      it("loja NOVO sem a Inferior 2020 continua apontada", () => {
        const loja = [{ id: "x", name: "Loja Nova", store_model: "Novo" }];
        const f = incompletos(reviewRateio(supInfPieces, supInfKit, supInfComps, loja, { "x-S": 1, "x-I": 0 }));
        expect(f).toHaveLength(1);
        expect(f[0]?.storesWith).toEqual(["Loja Nova"]);
      });

      it("Inferior zerada em 80% das lojas do kit (4 de 5) ainda é apontada", () => {
        const f = incompletos(reviewRateio(pecasSemEra, supInfKit, supInfComps, lojas(5), qtd(5, 1)));
        expect(f).toHaveLength(1);
        expect(f[0]?.storesWith).toEqual(["Loja 1", "Loja 2", "Loja 3", "Loja 4"]);
      });

      it("Inferior zerada em 90% das lojas do kit (9 de 10) não é apontada", () => {
        expect(incompletos(reviewRateio(pecasSemEra, supInfKit, supInfComps, lojas(10), qtd(10, 1)))).toHaveLength(0);
      });

      it("base pequena (3 lojas, Inferior zerada em todas) continua apontada", () => {
        const f = incompletos(reviewRateio(pecasSemEra, supInfKit, supInfComps, lojas(3), qtd(3, 0)));
        expect(f).toHaveLength(1);
        expect(f[0]?.title).toBe("Kit incompleto em 3 loja(s)");
      });

      it("peça presente abaixo do que o kit pede continua apontada mesmo com 90% de zeradas", () => {
        const comps = [{ kit_id: "K", piece_id: "S", quantity: 1 }, { kit_id: "K", piece_id: "I", quantity: 2 }];
        const q = { ...qtd(10, 0), "l0-I": 1 };
        const f = incompletos(reviewRateio(pecasSemEra, supInfKit, comps, lojas(10), q));
        expect(f[0]?.storesWith).toEqual(["Loja 0"]);
      });
    });
  });
});

describe("reviewRateio — quantidades em 'Falta em lojas do mesmo modelo'", () => {
  it("traz a quantidade de quem tem e os ids de quem não tem", () => {
    const st = ["a", "b", "c"].map((id) => ({ id, name: id.toUpperCase(), store_model: "M", showcase_count: 1 }));
    const f = reviewRateio(
      [{ id: "p", name: "Banner" }, { id: "base", name: "Base" }], [], [], st,
      { "a-p": 6, "b-p": 4, "a-base": 1, "b-base": 1, "c-base": 1 },
    ).find((x) => x.title === "Falta em lojas do mesmo modelo" && x.itemName === "Banner");
    expect(f?.storesWithQty).toEqual([{ id: "a", name: "A", qty: 6 }, { id: "b", name: "B", qty: 4 }]);
    expect(f?.storesWithoutIds).toEqual([{ id: "c", name: "C" }]);
    expect(f?.itemKind).toBe("piece");
    expect(f?.itemId).toBe("p");
  });
});
