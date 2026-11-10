import { describe, expect, it } from "vitest";
import { matchesOccurrenceStoreName, normalizeStoreSearchText } from "./occurrenceStoreSearch";

const occ = (name?: string | null) => ({ client_stores: { name } });

describe("normalizeStoreSearchText", () => {
  it("remove acentos, caixa e espaços repetidos", () => {
    expect(normalizeStoreSearchText("  São   PAULO ")).toBe("sao paulo");
    expect(normalizeStoreSearchText(null)).toBe("");
  });
});

describe("matchesOccurrenceStoreName", () => {
  it("termo vazio não filtra nada", () => {
    expect(matchesOccurrenceStoreName(occ("Mooca Plaza"), "")).toBe(true);
    expect(matchesOccurrenceStoreName(occ("Mooca Plaza"), "   ")).toBe(true);
  });

  it("ignora acentos e maiúsculas ao comparar", () => {
    expect(matchesOccurrenceStoreName(occ("São Paulo"), "sao paulo")).toBe(true);
    expect(matchesOccurrenceStoreName(occ("são paulo"), "São Paulo")).toBe(true);
  });

  it("aceita pedaço do nome digitado", () => {
    expect(matchesOccurrenceStoreName(occ("Mooca Plaza"), "mooca")).toBe(true);
    expect(matchesOccurrenceStoreName(occ("Shopping Cinco"), "cinc")).toBe(true);
  });

  it("esconde lojas que não contêm o termo", () => {
    expect(matchesOccurrenceStoreName(occ("Mooca Plaza"), "paulo")).toBe(false);
    expect(matchesOccurrenceStoreName(occ("Barra Sul Porto Alegre"), "paulo")).toBe(false);
  });

  it("esconde ocorrências sem nome de loja quando há termo", () => {
    expect(matchesOccurrenceStoreName(occ(null), "mooca")).toBe(false);
    expect(matchesOccurrenceStoreName(null, "mooca")).toBe(false);
  });
});
