import { describe, it, expect } from "vitest";
import { isClassifiableStore } from "./lojaALojaClassifiable";

describe("lojas na Classificação do Loja a Loja", () => {
  it("mostra lojas com frete e instalação", () => {
    expect(isClassifiableStore("frete_instalacao")).toBe(true);
    expect(isClassifiableStore(null)).toBe(true);
  });
  it("mostra lojas só com frete, como os quiosques", () => {
    expect(isClassifiableStore("frete_apenas")).toBe(true);
  });
  it("não mostra lojas sem logística", () => {
    expect(isClassifiableStore("sem_logistica")).toBe(false);
  });
});
