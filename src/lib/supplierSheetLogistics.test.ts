import { describe, it, expect } from "vitest";
import { buildLogisticsNotes, deliveryTypeText } from "./supplierSheetLogistics";
import { getSupplierExcelLabels } from "@/utils/currencyLocale";

const pt = getSupplierExcelLabels("BRL");
const es = getSupplierExcelLabels("CLP");
const st = (id: string, t: string | null) => ({ id, tipo_entrega: t });

describe("buildLogisticsNotes", () => {
  it("no notes when every store is Frete + Instalação", () => {
    expect(buildLogisticsNotes([st("a", "frete_instalacao"), st("b", null)], undefined, pt)).toEqual([]);
  });
  it("writes the three separate warnings with exact counts, ignoring disabled stores", () => {
    const stores = [st("1", "frete_apenas"), st("2", "frete_apenas"), st("3", "instalacao_apenas"), st("4", "sem_logistica"), st("5", "sem_logistica"), st("6", "frete_apenas")];
    expect(buildLogisticsNotes(stores, new Set(["6", "5"]), pt)).toEqual([
      "⚠️ 2 loja(s) somente entrega — sem instalação.",
      "⚠️ 1 loja(s) somente instalação — sem frete.",
      "⚠️ 1 loja(s) sem logística — sem frete e sem instalação.",
    ]);
  });
  it("has Spanish texts", () => {
    expect(buildLogisticsNotes([st("1", "instalacao_apenas")], undefined, es)[0]).toBe("⚠️ 1 punto(s) solo instalación — sin flete.");
  });
});

describe("deliveryTypeText", () => {
  it("labels the four types", () => {
    expect(["frete_instalacao", "frete_apenas", "instalacao_apenas", "sem_logistica"].map((t) => deliveryTypeText(t, pt)))
      .toEqual(["Frete + Instalação", "Só frete", "Só instalação", "Sem logística"]);
  });
});
