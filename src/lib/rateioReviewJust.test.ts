import { describe, it, expect } from "vitest";
import { reviewRateio, type RateioFinding } from "@/lib/reviewRateio";
import {
  buildJustRow, countSameTodas, fpEspecifico, fpTodas, legacyVitrineSubtipos, splitByJust, type Justificativa,
} from "@/lib/rateioReviewJust";

const just = (fingerprint: string, motivo = "ok", escopo = "caso"): Justificativa =>
  ({ id: fingerprint, fingerprint, motivo, escopo, created_at: "2026-11-16" });
const mapOf = (...js: Justificativa[]) => new Map(js.map((j) => [j.fingerprint, j]));

// Duas lojas com 1 vitrine recebendo G + P (excesso e tamanhos), uma com 2 vitrines.
const pieces = [
  { id: "g", name: "Vitrine G", code: 1 },
  { id: "p", name: "Vitrine P", code: 2 },
];
const stores = [
  { id: "a", name: "Loja A", showcase_count: 1 },
  { id: "b", name: "Loja B", showcase_count: 1 },
  { id: "c", name: "Loja C", showcase_count: 2 },
];
const qtyMap: Record<string, number> = { "a-g": 1, "a-p": 1, "b-g": 1, "b-p": 1, "c-g": 1, "c-p": 1 };
const vit = () => reviewRateio(pieces, [], [], stores, qtyMap).filter((f) => f.type === "vitrine_excesso");

describe("situação dos achados de vitrine", () => {
  it("preenche EXC/TAM com nº de vitrines e itens normalizados ordenados", () => {
    const a = vit().filter((f) => f.storeName === "Loja A");
    expect(a.map((f) => f.situacao).sort()).toEqual([
      "EXC::VIT:1::VITRINE G:1|VITRINE P:1",
      "TAM::VIT:1::VITRINE G:1|VITRINE P:1",
    ]);
  });
  it("loja com outro nº de vitrines tem outra situação", () => {
    const c = vit().find((f) => f.storeName === "Loja C");
    expect(c?.situacao).toBe("TAM::VIT:2::VITRINE G:1|VITRINE P:1");
  });
  it("não preenche situação em achados de item", () => {
    expect(reviewRateio(pieces, [], [], stores, qtyMap).filter((f) => f.type !== "vitrine_excesso").every((f) => !f.situacao)).toBe(true);
  });
});

describe("fingerprints de vitrine", () => {
  it("separa os subtipos por loja", () => {
    const a = vit().filter((f) => f.storeName === "Loja A").map(fpEspecifico).sort();
    expect(a).toEqual(["vitrine_excesso::EXC::LOJA:LOJA A", "vitrine_excesso::TAM::LOJA:LOJA A"]);
  });
  it("justificar um subtipo não esconde o outro", () => {
    const { ativos, justificados } = splitByJust(vit(), mapOf(just("vitrine_excesso::EXC::LOJA:LOJA A")));
    expect(justificados.map((j) => j.f.title)).toEqual(["Excesso de vitrine"]);
    expect(ativos.some((f) => f.storeName === "Loja A" && f.title === "Vitrines de tamanhos diferentes")).toBe(true);
  });
  it("'Todas as lojas' cobre outra loja na mesma situação, não a de outro nº de vitrines", () => {
    const tam = vit().find((f) => f.storeName === "Loja A" && f.title.includes("tamanhos")) as RateioFinding;
    const { justificados } = splitByJust(vit(), mapOf(just(fpTodas(tam), "ok", "item_todas")));
    expect(justificados.map((j) => j.f.storeName).sort()).toEqual(["Loja A", "Loja B"]);
  });
  it("conta quantas lojas a regra cobre agora", () => {
    const all = vit();
    const tam = all.find((f) => f.storeName === "Loja A" && f.title.includes("tamanhos")) as RateioFinding;
    const exc = all.find((f) => f.storeName === "Loja A" && f.title === "Excesso de vitrine") as RateioFinding;
    expect(countSameTodas(tam, all)).toBe(2);
    expect(countSameTodas(exc, all)).toBe(2);
  });
  it("grava 'todas as lojas' como item_todas, sem item_name", () => {
    const tam = vit().find((f) => f.title.includes("tamanhos")) as RateioFinding;
    expect(buildJustRow(tam, "item_todas")).toEqual({
      fingerprint: "vitrine_excesso::SIT::TAM::VIT:1::VITRINE G:1|VITRINE P:1",
      finding_type: "vitrine_excesso",
      item_name: null,
      escopo: "item_todas",
    });
  });
});

describe("justificativas antigas de vitrine", () => {
  it("motivo sem tamanhos vale só para Excesso (Vila Romana)", () => {
    expect(legacyVitrineSubtipos("Está correto, esse ítem: Display Desconto Vitrine Secundária vai sempre quando tem duas vitrines.")).toEqual(["EXC"]);
  });
  it("motivo com P e G vale só para Tamanhos (Diamond Mall)", () => {
    expect(legacyVitrineSubtipos("Essa loja é exatamente assim a Primária G e a secundária P.")).toEqual(["TAM"]);
  });
  it("motivo ambíguo vale para os dois", () => {
    expect(legacyVitrineSubtipos("Excesso ok, vitrine G e P")).toEqual(["EXC", "TAM"]);
  });
  it("fingerprint antigo continua escondendo o subtipo certo", () => {
    const { justificados } = splitByJust(vit(), mapOf(just("vitrine_excesso::::LOJA:LOJA A", "Primária G e secundária P")));
    expect(justificados.map((j) => j.f.title)).toEqual(["Vitrines de tamanhos diferentes"]);
  });
});

describe("tipos com item mantêm as regras", () => {
  const f: RateioFinding = { severity: "alta", type: "era_incompativel", title: "x", detail: "", itemName: "Wobbler", storeName: "Loja A" };
  it("fpTodas continua por item", () => {
    expect(fpTodas(f)).toBe("era_incompativel::WOBBLER::ALL");
    expect(buildJustRow(f, "item_todas").item_name).toBe("Wobbler");
  });
});

describe("prévia de 'Todas as lojas'", () => {
  it("lista os mesmos apontamentos que a contagem, ordenados pela loja", async () => {
    const { sameTodasFindings, coverageRow } = await import("@/lib/rateioReviewJust");
    const all = vit();
    const tamB = all.find((f) => f.storeName === "Loja B" && f.title.includes("tamanhos")) as RateioFinding;
    const list = sameTodasFindings(tamB, all);
    expect(list.length).toBe(countSameTodas(tamB, all));
    expect(list.map((f) => f.storeName)).toEqual(["Loja A", "Loja B"]);
    expect(coverageRow(list[0])).toEqual({ title: "Loja A", sub: "1 vit. · itens: Vitrine G 1, Vitrine P 1" });
  });
  it("sem loja mostra o item e o modelo", async () => {
    const { coverageRow } = await import("@/lib/rateioReviewJust");
    const f: RateioFinding = { severity: "alta", type: "modelo_divergente", title: "x", detail: "", itemName: "Wobbler", storeModel: "LOOK" };
    expect(coverageRow(f)).toEqual({ title: "Wobbler", sub: "Modelo LOOK" });
  });
});
