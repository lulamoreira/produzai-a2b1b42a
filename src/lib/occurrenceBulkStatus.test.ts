import { describe, it, expect } from "vitest";
import { canBulkChangeOccurrenceStatus, visibleSelection, headerCheckState, countDistinctStores } from "./occurrenceBulkStatus";

describe("alteração de status em lote", () => {
  it("permite somente administradores e masters", () => {
    expect(canBulkChangeOccurrenceStatus("admin")).toBe(true);
    expect(canBulkChangeOccurrenceStatus("master")).toBe(true);
    expect(canBulkChangeOccurrenceStatus("viewer")).toBe(false);
    expect(canBulkChangeOccurrenceStatus(undefined)).toBe(false);
  });

  it("aplica somente às ocorrências selecionadas que estão visíveis", () => {
    expect(visibleSelection(new Set(["a", "b", "z"]), ["a", "b", "c"])).toEqual(["a", "b"]);
  });

  it("calcula o estado do selecionar todas", () => {
    expect(headerCheckState(0, 5)).toBe(false);
    expect(headerCheckState(2, 5)).toBe("indeterminate");
    expect(headerCheckState(5, 5)).toBe(true);
  });

  it("conta lojas distintas da seleção", () => {
    const occ = [
      { id: "1", store_id: "cuiaba" },
      { id: "2", store_id: "cuiaba" },
      { id: "3", store_id: "recife" },
    ];
    expect(countDistinctStores(occ, ["1", "2", "3"])).toBe(2);
  });
});
