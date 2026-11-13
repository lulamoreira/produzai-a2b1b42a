import { describe, it, expect } from "vitest";
import { isCustomFieldTrue } from "./customFields";

describe("isCustomFieldTrue", () => {
  it("reconhece TRUE em maiúsculas vindo de planilha como Sim", () => {
    expect(isCustomFieldTrue("TRUE")).toBe(true);
    expect(isCustomFieldTrue("True")).toBe(true);
    expect(isCustomFieldTrue("true")).toBe(true);
  });
  it("reconhece Sim e 1 como Sim", () => {
    expect(isCustomFieldTrue("Sim")).toBe(true);
    expect(isCustomFieldTrue(" SIM ")).toBe(true);
    expect(isCustomFieldTrue("1")).toBe(true);
    expect(isCustomFieldTrue(true)).toBe(true);
  });
  it("trata FALSE, Não, vazio e nulo como Não", () => {
    expect(isCustomFieldTrue("FALSE")).toBe(false);
    expect(isCustomFieldTrue("Não")).toBe(false);
    expect(isCustomFieldTrue("")).toBe(false);
    expect(isCustomFieldTrue(null)).toBe(false);
    expect(isCustomFieldTrue(undefined)).toBe(false);
  });
});
