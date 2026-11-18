import { describe, it, expect } from "vitest";
import {
  rateioItemOptions, rateioItemInsertFields, occurrencePieceDisplay, occurrencePieceFilterKey,
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
  it("componente mostra em qual kit está", () => {
    const opts = rateioItemOptions({ pieces, kits, links, storeId: "s1", storeQty: [] });
    expect(opts.find((o) => o.id === "p3")?.local).toBe("Balcão · no Kit 2");
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
