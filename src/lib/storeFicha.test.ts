import { describe, expect, it } from "vitest";
import { buildStoreLookup, normalizeStoreKey, storeCampaignItems, storeCustomFields } from "./storeFicha";

describe("buildStoreLookup", () => {
  it("encontra a loja pelo nome ignorando espaços, maiúsculas e acentos", () => {
    const map = buildStoreLookup([{ id: "1", name: "São Paulo Ibirapuera", nickname: null }]);
    expect(map.get(normalizeStoreKey("  SAO PAULO IBIRAPUERA "))?.id).toBe("1");
  });
  it("encontra pelo apelido, que é o nome usado nas listas da revisão", () => {
    const map = buildStoreLookup([{ id: "1", name: "Lindt Shopping X", nickname: "Morumbi" }]);
    expect(map.get(normalizeStoreKey("Morumbi"))?.id).toBe("1");
  });
  it("em nomes repetidos usa a primeira loja", () => {
    const map = buildStoreLookup([{ id: "1", name: "Centro" }, { id: "2", name: "centro" }]);
    expect(map.get("centro")?.id).toBe("1");
  });
});

describe("storeCustomFields", () => {
  it("usa o rótulo cortado no '|' e omite campos vazios", () => {
    const fields = storeCustomFields({ custom_field_1: "Sim", custom_field_2: "  ", custom_field_3: "true" }, [
      { index: 1, label: "Gôndola | número" },
      { index: 2, label: "Vazio" },
      { index: 3, label: "Ilha" },
    ]);
    expect(fields).toEqual([{ label: "Gôndola", value: "Sim" }, { label: "Ilha", value: "Sim" }]);
  });
});

describe("storeCampaignItems", () => {
  const store = "aaaaaaaa-0000-0000-0000-000000000001";
  it("lista peças avulsas e conta kits pelo menor quociente dos componentes", () => {
    const items = storeCampaignItems(
      store,
      [{ id: "p1", code: 2, name: "Wobbler" }, { id: "c1", code: 5, name: "Comp A", kit_only: true }, { id: "c2", code: 6, name: "Comp B", kit_only: true }],
      [{ id: "k1", code: 1, name: "KIT Vitrine" }],
      [{ kit_id: "k1", piece_id: "c1", quantity: 1 }, { kit_id: "k1", piece_id: "c2", quantity: 2 }],
      { [`${store}-p1`]: 3, [`${store}-c1`]: 3, [`${store}-c2`]: 4 },
    );
    expect(items.map((i) => [i.kind, i.name, i.quantity])).toEqual([["kit", "KIT Vitrine", 2], ["piece", "Wobbler", 3]]);
  });
});
