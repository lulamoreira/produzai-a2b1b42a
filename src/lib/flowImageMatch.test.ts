import { describe, expect, it } from "vitest";
import { canReplaceImage, matchFlowRows } from "./flowImageMatch";

const p = (id: string, code: number, name: string, category: string, image_url: string | null = null) => ({ id, code, name, category, image_url });

describe("matchFlowRows", () => {
  it("liga por nome e localização, consumindo repetidos em ordem de código", () => {
    const existing = [p("b", 2, "Tag", "VITRINE"), p("a", 1, "Tag", "VITRINE"), p("c", 3, "Wallbay", "LOJA")];
    const r = matchFlowRows([{ name: "tag", category: "Vitrine" }, { name: "Tag", category: "VITRINE" }, { name: "Nada", category: "" }], existing);
    expect(r.map((x) => x?.id ?? null)).toEqual(["a", "b", null]);
  });
});

describe("canReplaceImage", () => {
  it("não substitui imagem enviada manualmente", () => {
    expect(canReplaceImage("https://x/piece-images/campaign-piece-1.jpg")).toBe(false);
    expect(canReplaceImage("https://x/piece-images/flow-piece-3-1.jpg")).toBe(true);
    expect(canReplaceImage(null)).toBe(true);
  });
});
