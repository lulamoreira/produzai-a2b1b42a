import { describe, it, expect } from "vitest";
import { findCurrentFinding, itemQtyForStore, relatedStores, storeCorrected } from "@/lib/rateioFixFinding";
import { buildJustRow } from "@/lib/rateioReviewJust";
import type { RateioFinding } from "@/lib/reviewRateio";

const f = (p: Partial<RateioFinding>): RateioFinding => ({ severity: "media", type: "quantidade_abaixo", title: "t", detail: "d", ...p });

describe("TÁ CERTO / TÁ ERRADO na Revisar Rateio", () => {
  it("TÁ CERTO usa a justificativa 'só este caso' com o mesmo fingerprint do Justificar", () => {
    const a = f({ type: "modelo_divergente", itemName: "Display", storeModel: "ANTIGO" });
    expect(buildJustRow(a, "caso").fingerprint).toBe("modelo_divergente::DISPLAY::MOD:ANTIGO");
    expect(buildJustRow(a, "caso").escopo).toBe("caso");
  });

  it("'Falta em lojas do mesmo modelo' separa Não têm (primeiro) e Têm, sem repetir lojas", () => {
    const g = relatedStores(f({
      type: "modelo_divergente",
      storesWithout: ["Tijuca", "Catarina"],
      storesWithoutIds: [{ id: "t", name: "Tijuca", showcase: 1 }],
      storesWith: ["Barra", "Tijuca"],
      storesWithQty: [{ id: "b", name: "Barra", qty: 1, showcase: 2 }],
    }));
    expect(g.split).toBe(true);
    expect(g.primary).toEqual([{ name: "Tijuca", id: "t" }, { name: "Catarina" }]);
    expect(g.secondary).toEqual([{ name: "Barra", id: "b" }]);
  });

  it("apontamento de uma loja lista só ela", () => {
    expect(relatedStores(f({ storeName: "Barra", storesWith: ["X"] })).primary).toEqual([{ name: "Barra" }]);
  });

  it("acha a versão atual do kit agrupado mesmo com outro conjunto de lojas", () => {
    const orig = f({ type: "kit_incompleto", itemId: "k1", itemName: "KIT A", storesWith: ["A", "B"] });
    const now = f({ type: "kit_incompleto", itemId: "k1", itemName: "KIT A", storesWith: ["B"] });
    expect(findCurrentFinding(orig, [now])).toBe(now);
    expect(findCurrentFinding(orig, [])).toBeNull();
  });

  it("loja que saiu do apontamento fica 'corrigida'; loja de referência não", () => {
    const orig = f({ type: "modelo_divergente", itemName: "D", storeModel: "M", storesWith: ["Barra"], storesWithout: ["Tijuca", "Catarina"] });
    const now = f({ type: "modelo_divergente", itemName: "D", storeModel: "M", storesWith: ["Barra", "Tijuca"], storesWithout: ["Catarina"] });
    expect(storeCorrected(orig, now, { id: "t", name: "Tijuca" })).toBe(true);
    expect(storeCorrected(orig, now, { id: "c", name: "Catarina" })).toBe(false);
    expect(storeCorrected(orig, now, { id: "b", name: "Barra" })).toBe(false);
  });

  it("quantidade do kit na loja = menor quociente entre os componentes", () => {
    const links = [{ kit_id: "k", piece_id: "p1", quantity: 1 }, { kit_id: "k", piece_id: "p2", quantity: 2 }];
    expect(itemQtyForStore("kit", "k", "s", { "s-p1": 3, "s-p2": 4 }, links)).toBe(2);
    expect(itemQtyForStore("piece", "p1", "s", { "s-p1": 3 }, links)).toBe(3);
    expect(itemQtyForStore(undefined, undefined, "s", {}, links)).toBeNull();
  });
});
