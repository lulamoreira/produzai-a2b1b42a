import { describe, expect, it } from "vitest";
import { splitOneNotePdfText, textItemsToLines } from "@/lib/oneNotePdf";

describe("oneNotePdf", () => {
  it("reconstrói linhas pela posição vertical e ordena os itens na horizontal", () => {
    const items = [
      { str: "B", transform: [1, 0, 0, 1, 20, 100] },
      { str: "Linha 2", transform: [1, 0, 0, 1, 5, 80] },
      { str: "A", transform: [1, 0, 0, 1, 5, 101] },
    ];
    expect(textItemsToLines(items)).toEqual(["A B", "Linha 2"]);
  });

  it("mantém textos pequenos em um único bloco", () => {
    expect(splitOneNotePdfText("--- PÁGINA 1 ---\nPeça")).toEqual(["--- PÁGINA 1 ---\nPeça"]);
  });
});