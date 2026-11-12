import { describe, it, expect } from "vitest";
import { parseItemCode, findCodeConflicts, describeCodeConflicts } from "./itemCodeConflicts";

const pieces = [
  { id: "p1", code: 41, name: "Pirulito Coco", kit_only: true },
  { id: "p2", code: 64, name: "Quiosque Revestimento", kit_only: false },
  { id: "p3", code: 70, name: "Apagada", is_deleted: true },
];
const kits = [{ id: "k1", code: 40, name: "KIT Pirulitos" }];

describe("parseItemCode", () => {
  it("aceita inteiros positivos e rejeita vazio, zero, negativos e decimais", () => {
    expect(parseItemCode(" 12 ")).toBe(12);
    expect(parseItemCode("")).toBeNull();
    expect(parseItemCode("0")).toBeNull();
    expect(parseItemCode("-3")).toBeNull();
    expect(parseItemCode("4.5")).toBeNull();
    expect(parseItemCode("2147483648")).toBeNull();
  });
});

describe("findCodeConflicts", () => {
  it("avisa quando o código de uma peça bate com o de um kit", () => {
    const c = findCodeConflicts(40, { pieces, kits }, { pieceId: "p2" });
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ kind: "kit", id: "k1" });
  });

  it("avisa quando o código de um kit bate com o de uma peça de kit", () => {
    const c = findCodeConflicts(41, { pieces, kits }, { kitId: "k1" });
    expect(c).toHaveLength(1);
    expect(describeCodeConflicts(c)).toBe("O código 41 já é usado por: Peça de kit #41 “Pirulito Coco”.");
  });

  it("não acusa conflito com o próprio item em edição", () => {
    expect(findCodeConflicts(64, { pieces, kits }, { pieceId: "p2" })).toHaveLength(0);
    expect(findCodeConflicts(40, { pieces, kits }, { kitId: "k1" })).toHaveLength(0);
  });

  it("ignora itens excluídos", () => {
    expect(findCodeConflicts(70, { pieces, kits })).toHaveLength(0);
  });
});
