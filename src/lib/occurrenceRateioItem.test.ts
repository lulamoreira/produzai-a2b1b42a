import { describe, it, expect } from "vitest";
import {
  rateioItemOptions, rateioItemInsertFields, occurrencePieceDisplay, occurrencePieceFilterKey,
  matchesRateioItemQuery,
} from "./occurrenceRateioItem";

const pieces = [
  { id: "p1", code: 1, name: "TESTEIRA", category: "Vitrine" },
  { id: "p3", code: 3, name: "ADESIVO A", category: "Balcão" },
  { id: "p4", code: 4, name: "ADESIVO B", category: "Balcão" },
  { id: "p5", code: 5, name: "WOBBLER" },
];
const kits = [{ id: "k2", code: 2, name: "KIT BALCÃO" }];
const links = [
  { kit_id: "k2", piece_id: "p3", quantity: 1 },
  { kit_id: "k2", piece_id: "p4", quantity: 2 },
];

describe("lista de peças do rateio na nova ocorrência", () => {
  it("o que a loja recebe vem primeiro, depois o resto, cada grupo pela numeração", () => {
    const opts = rateioItemOptions({
      pieces, kits, links, storeId: "s1",
      storeQty: [{ piece_id: "p5", quantity: 2 }, { piece_id: "p3", quantity: 1 }, { piece_id: "p4", quantity: 2 }],
    });
    expect(opts.map((o) => [o.code, o.inStore])).toEqual([
      [2, true], [3, true], [4, true], [5, true], [1, false],
    ]);
  });
  it("kit conta pela regra do Rateio (mínimo dos componentes ÷ qtd por kit)", () => {
    const opts = rateioItemOptions({
      pieces, kits, links, storeId: "s1",
      storeQty: [{ piece_id: "p3", quantity: 3 }, { piece_id: "p4", quantity: 2 }],
    });
    expect(opts.find((o) => o.id === "k2")?.qty).toBe(1);
  });
  it("componente traz os códigos dos kits que o levam, sem perder o local", () => {
    const opts = rateioItemOptions({ pieces, kits, links, storeId: "s1", storeQty: [] });
    expect(opts.find((o) => o.id === "p3")?.kitCodes).toEqual([2]);
    expect(opts.find((o) => o.id === "p3")?.local).toBe("Balcão");
    expect(opts.find((o) => o.id === "p1")?.kitCodes).toEqual([]);
    expect(opts.find((o) => o.id === "k2")?.kitCodes).toEqual([]);
  });
  it("grava peça OU kit, com código e nome do momento do registro", () => {
    const opts = rateioItemOptions({ pieces, kits, links, storeId: "s1", storeQty: [] });
    expect(rateioItemInsertFields(opts.find((o) => o.id === "k2")!)).toEqual({
      campaign_piece_id: null, campaign_kit_id: "k2", campaign_item_code: 2, campaign_item_name: "KIT BALCÃO",
    });
  });
});

describe("peça mostrada nas telas de ocorrências", () => {
  it("peça do rateio aparece como 'código · nome' e tem prioridade", () => {
    const o = { campaign_piece_id: "p1", campaign_item_code: 12, campaign_item_name: "TESTEIRA", loja_a_loja_pecas: { nome: "X" } };
    expect(occurrencePieceDisplay(o).label).toBe("12 · TESTEIRA");
  });
  it("ocorrência do portal continua mostrando a peça do Loja a Loja", () => {
    const o = { loja_a_loja_peca_id: "l1", loja_a_loja_pecas: { nome: "TESTEIRA PRODUTOS" } };
    expect(occurrencePieceDisplay(o).label).toBe("TESTEIRA PRODUTOS");
    expect(occurrencePieceFilterKey(o)).toBe("l1");
  });
  it("sem peça nenhuma = sem rótulo", () => {
    expect(occurrencePieceDisplay({}).label).toBeNull();
  });
});

describe("busca no seletor de peça do rateio", () => {
  const opts = rateioItemOptions({
    pieces: [
      ...pieces,
      { id: "p6", code: 92, name: "Lindor Cenográfico Embalagem - Standard G Secundária" },
      { id: "p7", code: 157, name: "Testeira Produtos - Quiosque" },
    ],
    kits, links, storeId: "s1", storeQty: [],
  });
  const find = (q: string) => opts.filter((o) => matchesRateioItemQuery(o, q)).map((o) => o.code);
  it("'testeira' só traz peças com a palavra, não letras soltas espalhadas", () => {
    expect(find("testeira")).toEqual([1, 157]);
  });
  it("ignora maiúsculas e acentos", () => {
    expect(find("CENOGRAFICO")).toEqual([92]);
  });
  it("várias palavras precisam aparecer todas", () => {
    expect(find("testeira quiosque")).toEqual([157]);
  });
  it("número acha pelo início do código da peça ou do kit que a leva", () => {
    expect(find("15")).toEqual([157]);
    expect(find("2")).toEqual([2, 3, 4]);
  });
});
