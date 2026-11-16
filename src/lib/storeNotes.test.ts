import { describe, it, expect } from "vitest";
import { buildStoreNotes, filterStoreNotes, findingCountsByStore, findingStoreNote, resolveStore } from "@/lib/storeNotes";
import { buildStoreLookup } from "@/lib/storeFicha";
import type { RateioFinding } from "@/lib/reviewRateio";

const stores = [
  { id: "1", name: "Diamond Mall", nickname: "Shopping Diamond Mall", observations: "Teto baixo", store_model: "A", era: "Nova", showcase_count: 2 },
  { id: "2", name: "Água Verde", nickname: null, observations: "  ", store_model: "B" },
  { id: "3", name: "Barra", nickname: null, observations: "Tem 2 promotables\nsem vitrine lateral", showcase_count: 1 },
  { id: "4", name: "Ápice", nickname: null, observations: "Outlet" },
];
const lookup = buildStoreLookup(stores);
const f = (p: Partial<RateioFinding>): RateioFinding => ({ severity: "media", type: "quantidade_abaixo", title: "t", detail: "d", ...p });

describe("notas das lojas na Revisar Rateio", () => {
  it("lista só lojas com nota preenchida, em ordem alfabética sem diferenciar acentos", () => {
    const rows = buildStoreNotes(stores);
    expect(rows.map((r) => r.store.id)).toEqual(["4", "3", "1"]);
    expect(rows.find((r) => r.store.id === "1")?.label).toBe("Shopping Diamond Mall");
    expect(rows.find((r) => r.store.id === "1")?.meta).toBe("Modelo A · Era Nova · 2 vitrines");
  });

  it("a busca filtra pelo nome da loja ou pelo texto da nota", () => {
    const rows = buildStoreNotes(stores);
    expect(filterStoreNotes(rows, "promotable").map((r) => r.store.id)).toEqual(["3"]);
    expect(filterStoreNotes(rows, "diamond").map((r) => r.store.id)).toEqual(["1"]);
    expect(filterStoreNotes(rows, "apice").map((r) => r.store.id)).toEqual(["4"]);
  });

  it("casa a loja pelo id antes do nome", () => {
    expect(resolveStore(lookup, { id: "3", name: "Diamond Mall" })?.id).toBe("3");
    expect(resolveStore(lookup, { name: "shopping diamond mall" })?.id).toBe("1");
  });

  it("nota no apontamento só quando é de uma loja só", () => {
    expect(findingStoreNote(f({ storeName: "Shopping Diamond Mall" }), lookup)).toBe("Teto baixo");
    expect(findingStoreNote(f({ storesWithout: ["Barra"] }), lookup)).toBeNull();
  });

  it("conta cada apontamento uma vez por loja citada", () => {
    const counts = findingCountsByStore(
      [
        f({ storeName: "Shopping Diamond Mall" }),
        f({ storesWith: ["Barra", "Diamond Mall"], storesWithout: ["Ápice"] }),
        f({ storesWithoutIds: [{ id: "3", name: "Barra", showcase: 1 }], storesWithout: ["Barra"] }),
      ],
      lookup,
    );
    expect(counts.get("1")).toBe(2);
    expect(counts.get("3")).toBe(2);
    expect(counts.get("4")).toBe(1);
  });
});
