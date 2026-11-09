import { describe, expect, it } from "vitest";
import { isOpenedWithinRange } from "./occurrenceDateFilter";

const local = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).toISOString();

describe("isOpenedWithinRange", () => {
  it("sem período, mantém todas as ocorrências", () => {
    expect(isOpenedWithinRange(local(2026, 11, 1), undefined, undefined)).toBe(true);
  });

  it("inclui ocorrência aberta no próprio dia inicial", () => {
    expect(isOpenedWithinRange(local(2026, 11, 5, 0, 1), new Date(2026, 10, 5, 15))).toBe(true);
    expect(isOpenedWithinRange(local(2026, 11, 4, 23, 59), new Date(2026, 10, 5))).toBe(false);
  });

  it("inclui ocorrência aberta no fim do dia final", () => {
    expect(isOpenedWithinRange(local(2026, 11, 9, 23, 30), undefined, new Date(2026, 10, 9))).toBe(true);
    expect(isOpenedWithinRange(local(2026, 11, 10, 0, 0), undefined, new Date(2026, 10, 9))).toBe(false);
  });

  it("exclui ocorrência sem data de abertura quando há período", () => {
    expect(isOpenedWithinRange(null, new Date(2026, 10, 1))).toBe(false);
  });
});
