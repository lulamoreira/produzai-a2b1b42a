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
