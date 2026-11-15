import { describe, it, expect } from "vitest";
import { cleanGroupText } from "./cleanGroupText";

describe("cleanGroupText", () => {
  it("faz trim de espaço no fim", () => {
    expect(cleanGroupText("STANDARD G ")).toBe("STANDARD G");
  });

  it("colapsa espaços duplos em um só", () => {
    expect(cleanGroupText("Standard  Primária G")).toBe("Standard Primária G");
  });

  it("remove par de aspas tipográficas que cerca o valor inteiro", () => {
    expect(cleanGroupText("“MOLDURA”")).toBe("MOLDURA");
  });

  it("preserva aspa interna", () => {
    expect(cleanGroupText("Tag's Outlet")).toBe("Tag's Outlet");
  });

  it("mantém valor simples inalterado", () => {
    expect(cleanGroupText("Shelftalk")).toBe("Shelftalk");
  });

  it("troca NBSP e invisíveis por espaço comum", () => {
    expect(cleanGroupText("STANDARD G")).toBe("STANDARD G");
    expect(cleanGroupText("STANDARD​G")).toBe("STANDARD G");
    expect(cleanGroupText("﻿STANDARD G")).toBe("STANDARD G");
  });

  it("remove par de aspas retas que cerca o valor inteiro", () => {
    expect(cleanGroupText('"MOLDURA"')).toBe("MOLDURA");
  });

  it("não remove aspas externas quando há aspa do mesmo tipo dentro", () => {
    expect(cleanGroupText('"Shelftalk "Lisa""')).toBe('"Shelftalk "Lisa""');
  });

  it("converte apóstrofo tipográfico interno em reto", () => {
    expect(cleanGroupText("Tag’s Outlet")).toBe("Tag's Outlet");
  });

  it("não altera maiúsculas/minúsculas", () => {
    expect(cleanGroupText("Todas")).toBe("Todas");
    expect(cleanGroupText("TODAS")).toBe("TODAS");
  });

  it("retorna vazio para vazio", () => {
    expect(cleanGroupText("")).toBe("");
    expect(cleanGroupText("   ")).toBe("");
  });
});
