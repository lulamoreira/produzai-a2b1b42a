import { describe, expect, it } from "vitest";
import { buildStoreEditWrites, draftChanges, editKey, storeEditableItems } from "./rateioStoreEdit";

const q = (m: Record<string, number>) => (pid: string) => m[pid] ?? 0;

describe("storeEditableItems", () => {
  it("lista peças avulsas (sem kit_only) e kits, com a quantidade atual", () => {
    const items = storeEditableItems(
      [{ id: "p1", code: 2, name: "Avulsa" }, { id: "c1", code: 9, name: "Comp", kit_only: true }],
      [{ id: "k1", code: 1, name: "KIT" }],
      [{ kit_id: "k1", piece_id: "c1", quantity: 2 }],
      q({ p1: 3, c1: 5 }),
    );
    expect(items.map((i) => [i.kind, i.id, i.current])).toEqual([["kit", "k1", 2], ["piece", "p1", 3]]);
  });
});

describe("buildStoreEditWrites", () => {
  it("peça zerada vira célula com destino 0", () => {
    expect(buildStoreEditWrites([{ kind: "piece", id: "p1", from: 3, to: 0 }], [], q({ p1: 3 }))).toEqual([
      { pieceId: "p1", from: 3, to: 0, viaKits: [], sharedSum: false },
    ]);
  });

  it("kit grava componente exclusivo = qtd do kit × peças por kit", () => {
    const w = buildStoreEditWrites([{ kind: "kit", id: "k1", from: 1, to: 3 }], [{ kit_id: "k1", piece_id: "c1", quantity: 2 }], q({ c1: 2 }));
    expect(w).toEqual([{ pieceId: "c1", from: 2, to: 6, viaKits: ["k1"], sharedSum: false }]);
  });

  it("peça em dois kits fica com a soma dos kits, não com o valor de um kit só", () => {
    const links = [
      { kit_id: "kA", piece_id: "a", quantity: 1 },
      { kit_id: "kA", piece_id: "s", quantity: 1 },
      { kit_id: "kB", piece_id: "b", quantity: 1 },
      { kit_id: "kB", piece_id: "s", quantity: 2 },
    ];
    // Loja tem 1 kA e 1 kB: s = 1×1 + 1×2 = 3. Zerar kA → s = 0 + 2 = 2.
    const w = buildStoreEditWrites([{ kind: "kit", id: "kA", from: 1, to: 0 }], links, q({ a: 1, b: 1, s: 3 }));
    expect(w.find((x) => x.pieceId === "s")).toEqual({ pieceId: "s", from: 3, to: 2, viaKits: ["kA"], sharedSum: true });
    expect(w.find((x) => x.pieceId === "a")?.to).toBe(0);
    expect(w.some((x) => x.pieceId === "b")).toBe(false);
  });

  it("só devolve células que mudam", () => {
    expect(buildStoreEditWrites([{ kind: "piece", id: "p1", from: 2, to: 2 }], [], q({ p1: 2 }))).toEqual([]);
  });
});

describe("draftChanges", () => {
  it("ignora rascunho igual ao atual e normaliza para inteiro ≥ 0", () => {
    const items = [{ kind: "piece" as const, id: "p1", code: 1, name: "A", current: 2 }, { kind: "piece" as const, id: "p2", code: 2, name: "B", current: 1 }];
    expect(draftChanges(items, { [editKey("piece", "p1")]: 2, [editKey("piece", "p2")]: -4 })).toEqual([{ kind: "piece", id: "p2", from: 1, to: 0 }]);
  });
});
