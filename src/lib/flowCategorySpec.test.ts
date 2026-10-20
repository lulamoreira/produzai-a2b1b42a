import { describe, expect, it } from "vitest";
import { buildSpecMatcher, canReplaceSpec, normCat } from "./flowCategorySpec";

describe("normCat", () => {
  it("removes VITRINES prefix", () => {
    expect(normCat("Vitrines - Todas as lojas", [])).toBe("TODAS AS LOJAS");
  });
  it("removes parenthesis notes", () => {
    expect(normCat("Interno (quiosques e pick&mix)", [])).toBe("INTERNO");
  });
  it("reuses existing spelling ignoring accents", () => {
    expect(normCat("BALCAO", ["BALCÃO"])).toBe("BALCÃO");
  });
});

describe("matchSpec", () => {
  const m = buildSpecMatcher([
    { name: "Wobbler Summer Chocolate", specification: "PS 2mm" },
    { name: "Outro", specification: "Vide Book/Manual" },
  ]);
  it("suggests when score >= 0.5", () => {
    expect(m("Wobbler Chocolate 10x20cm")).toBe("PS 2mm");
  });
  it("does not suggest below 0.5", () => {
    expect(m("Totem Gigante Chocolate")).toBeNull();
  });
  it("never suggests default spec", () => {
    expect(m("Outro")).toBeNull();
  });
});

describe("canReplaceSpec", () => {
  it("only empty or default", () => {
    expect(canReplaceSpec("")).toBe(true);
    expect(canReplaceSpec("Vide Book/Manual")).toBe(true);
    expect(canReplaceSpec("Lona")).toBe(false);
  });
});
