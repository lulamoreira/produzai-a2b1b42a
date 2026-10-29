import { describe, expect, it } from "vitest";
import { buildCopiedPieceRows, copyPieceSources } from "./copyLojaALojaPieces";
import type { LojaALojaTipo, LojaALojaPeca } from "@/hooks/useLojaALoja";

const tipos: LojaALojaTipo[] = [
  { id: "a", campaign_id: "c", letra: "A", nome: "Atual", tem_subdivisao: false, display_order: 1, created_at: "" },
  { id: "b", campaign_id: "c", letra: "B", nome: "Origem", tem_subdivisao: false, display_order: 2, created_at: "" },
  { id: "h", campaign_id: "c", letra: "H", nome: "Internos", tem_subdivisao: true, display_order: 3, created_at: "", subdivisoes: [
    { id: "s1", tipo_id: "h", nome: "Um", display_order: 1, created_at: "" },
    { id: "s2", tipo_id: "h", nome: "Dois", display_order: 2, created_at: "" },
  ] },
];
const pieces: LojaALojaPeca[] = ["a", "b", "s1", "s2"].map(id => ({ id, campaign_id: "c", tipo_id: id.startsWith("s") ? null : id, subdivisao_id: id.startsWith("s") ? id : null, nome: id, image_url: null, display_order: 1, created_at: "" }));
const items = [{ id: "source", nome: "Editada", image_url: "photo", checked: true }, { id: "ignored", nome: "Outra", image_url: null, checked: false }];

describe("copy Loja a Loja pieces", () => {
  it("offers other vitrines and internal subdivisions for a vitrine", () => {
    expect(copyPieceSources(tipos, pieces, "a", null).map(s => [s.id, s.kind])).toEqual([["b", "tipo"], ["s1", "sub"], ["s2", "sub"]]);
  });
  it("offers vitrines and other subdivisions for an internal selection", () => {
    expect(copyPieceSources(tipos, pieces, "h", "s1").map(s => s.id)).toEqual(["a", "b", "s2"]);
  });
  it("copies marked rows independently without source ids or changes", () => {
    const snapshot = structuredClone(items);
    expect(buildCopiedPieceRows(items, "c", "a", null, [{ display_order: 9 }])).toEqual([
      { campaign_id: "c", tipo_id: "a", subdivisao_id: null, nome: "Editada", image_url: "photo", display_order: 10 },
    ]);
    expect(items).toEqual(snapshot);
  });
  it("appends subsequent copies to a subdivision with null tipo_id", () => {
    expect(buildCopiedPieceRows(items, "c", "h", "s1", [{ display_order: 10 }])[0]).toMatchObject({ tipo_id: null, subdivisao_id: "s1", display_order: 11 });
  });
  it("does not copy unmarked items", () => {
    expect(buildCopiedPieceRows(items.map(i => ({ ...i, checked: false })), "c", "a", null, [])).toEqual([]);
  });
  it("rejects empty edited names", () => {
    expect(() => buildCopiedPieceRows([{ ...items[0], nome: " " }], "c", "a", null, [])).toThrow("Preencha");
  });
});