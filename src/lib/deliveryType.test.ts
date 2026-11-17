import { describe, it, expect } from "vitest";
import {
  effectiveDeliveryType,
  effectiveDeliveryTypeMulti,
  buildDeliveryOverrideMap,
  buildMultiCampaignOverrideMap,
  hasInstallation,
  hasFreight,
  countByDeliveryType,
} from "./deliveryType";

describe("deliveryType", () => {
  it("sem ajuste na campanha, usa o padrão da loja", () => {
    const overrides = buildDeliveryOverrideMap([]);
    expect(effectiveDeliveryType({ id: "a", tipo_entrega: "frete_apenas" }, overrides)).toBe("frete_apenas");
  });

  it("loja sem tipo definido segue frete + instalação", () => {
    expect(effectiveDeliveryType({ id: "a", tipo_entrega: null })).toBe("frete_instalacao");
  });

  it("ajuste da campanha prevalece sobre o padrão da loja", () => {
    const overrides = buildDeliveryOverrideMap([{ store_id: "a", tipo_entrega: "instalacao_apenas" }]);
    expect(effectiveDeliveryType({ id: "a", tipo_entrega: "frete_apenas" }, overrides)).toBe("instalacao_apenas");
  });

  it("ajuste NULL (voltar ao padrão) é ignorado", () => {
    const overrides = buildDeliveryOverrideMap([{ store_id: "a", tipo_entrega: null }]);
    expect(effectiveDeliveryType({ id: "a", tipo_entrega: "sem_logistica" }, overrides)).toBe("sem_logistica");
  });

  it("Só instalação conta como instalação e não como frete", () => {
    expect(hasInstallation("instalacao_apenas")).toBe(true);
    expect(hasFreight("instalacao_apenas")).toBe(false);
  });

  it("Só frete fica fora da instalação", () => {
    expect(hasInstallation("frete_apenas")).toBe(false);
    expect(hasFreight("frete_apenas")).toBe(true);
  });

  it("ajuste vale só para a campanha em que foi feito", () => {
    const m = buildMultiCampaignOverrideMap([{ campaign_id: "c1", store_id: "a", tipo_entrega: "sem_logistica" }]);
    expect(effectiveDeliveryTypeMulti("c1", "a", "frete_instalacao", m)).toBe("sem_logistica");
    expect(effectiveDeliveryTypeMulti("c2", "a", "frete_instalacao", m)).toBe("frete_instalacao");
  });

  it("conta lojas pelo tipo efetivo", () => {
    const overrides = buildDeliveryOverrideMap([{ store_id: "b", tipo_entrega: "instalacao_apenas" }]);
    const counts = countByDeliveryType(
      [{ id: "a", tipo_entrega: null }, { id: "b", tipo_entrega: "frete_apenas" }, { id: "c", tipo_entrega: "sem_logistica" }],
      overrides,
    );
    expect(counts).toEqual({ frete_instalacao: 1, frete_apenas: 0, instalacao_apenas: 1, sem_logistica: 1 });
  });
});

describe("parseDeliveryTypeInput (importação de lojas)", () => {
  it("aceita a chave interna e os rótulos, inclusive Só instalação", async () => {
    const { parseDeliveryTypeInput } = await import("./deliveryType");
    expect(parseDeliveryTypeInput("instalacao_apenas")).toBe("instalacao_apenas");
    expect(parseDeliveryTypeInput("Só instalação")).toBe("instalacao_apenas");
    expect(parseDeliveryTypeInput("Frete Apenas")).toBe("frete_apenas");
    expect(parseDeliveryTypeInput("📦🔧 Frete + Instalação")).toBe("frete_instalacao");
    expect(parseDeliveryTypeInput("Sem Logística")).toBe("sem_logistica");
    expect(parseDeliveryTypeInput("")).toBe("frete_instalacao");
  });
});

describe("planDeliveryChanges (ajuste em lote nesta campanha)", () => {
  const stores = [
    { id: "a", name: "Loja B", tipo_entrega: "frete_instalacao" },
    { id: "b", name: "Loja A", tipo_entrega: "frete_apenas" },
    { id: "c", name: "Loja C", tipo_entrega: "frete_instalacao" },
  ];

  it("lista só as lojas que mudam, com de → para, em ordem alfabética", async () => {
    const { planDeliveryChanges, buildDeliveryOverrideMap } = await import("./deliveryType");
    const overrides = buildDeliveryOverrideMap([{ store_id: "c", tipo_entrega: "sem_logistica" }]);
    const rows = planDeliveryChanges(stores, overrides, "frete_apenas");
    expect(rows.map((r) => [r.name, r.from, r.to])).toEqual([
      ["Loja A", "frete_apenas", "frete_apenas"],
      ["Loja B", "frete_instalacao", "frete_apenas"],
      ["Loja C", "sem_logistica", "frete_apenas"],
    ]);
  });

  it("desfazer devolve cada loja ao ajuste anterior ou ao padrão", async () => {
    const { planDeliveryChanges, changesToUndoWrites, buildDeliveryOverrideMap } = await import("./deliveryType");
    const overrides = buildDeliveryOverrideMap([{ store_id: "c", tipo_entrega: "sem_logistica" }]);
    const rows = planDeliveryChanges(stores, overrides, "instalacao_apenas");
    const undo = Object.fromEntries(changesToUndoWrites(rows).map((w) => [w.storeId, w.tipo]));
    expect(undo).toEqual({ a: null, b: null, c: "sem_logistica" });
  });

  it("voltar ao padrão só afeta lojas ajustadas", async () => {
    const { planDeliveryChanges, buildDeliveryOverrideMap } = await import("./deliveryType");
    const overrides = buildDeliveryOverrideMap([{ store_id: "c", tipo_entrega: "sem_logistica" }]);
    const rows = planDeliveryChanges(stores, overrides, null);
    expect(rows.map((r) => [r.storeId, r.to])).toEqual([["c", "frete_instalacao"]]);
  });
});
