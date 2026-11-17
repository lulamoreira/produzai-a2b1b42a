import { describe, it, expect } from "vitest";
import {
  resolveExportSelection, buildExportPlan, nextFreeCodes, usedCustomFields, labelsForNewCampaign,
  customFieldWarnings, customFieldWarningText, missingDestinationLocations, exportSummaryText, exportItemCount,
  type ExportSourcePiece, type ExportSourceKit, type ExportSourceKitPiece,
} from "./exportToCampaign";
import { pieceImagePathFromUrl, imageExtension, buildExportImagePath } from "./copyPieceImage";

const piece = (id: string, code: number, order: number, extra: Partial<ExportSourcePiece> = {}): ExportSourcePiece => ({
  id, code, display_order: order, name: `Peça ${id}`, category: "VITRINE", size: "10x10", ...extra,
});
const pieces: ExportSourcePiece[] = [
  piece("a", 1, 0),
  piece("b", 2, 1, { custom_field_2: "Lona" }),
  piece("c1", 7, 5, { kit_only: true }),
  piece("c2", 8, 6, { kit_only: true }),
  piece("d", 3, 2),
];
const kits: ExportSourceKit[] = [{ id: "k1", code: 4, display_order: 3, name: "KIT Balcão" }];
const kitPieces: ExportSourceKitPiece[] = [
  { kit_id: "k1", piece_id: "c2", quantity: 3, display_order: 1 },
  { kit_id: "k1", piece_id: "c1", quantity: 2, display_order: 0 },
];

describe("resolveExportSelection", () => {
  it("exportar um kit leva o kit e todas as suas peças com as quantidades", () => {
    const sel = resolveExportSelection({ pieceIds: [], kitIds: ["k1"], pieces, kits, kitPieces });
    expect(sel.kits.map((k) => k.id)).toEqual(["k1"]);
    expect(sel.componentsByKit.get("k1")!.map((c) => [c.piece.id, c.quantity])).toEqual([["c1", 2], ["c2", 3]]);
    expect(sel.allPieces.map((p) => p.id)).toEqual(["c1", "c2"]);
    expect(sel.autoKitIds.size).toBe(0);
  });

  it("peça de kit selecionada puxa o kit inteiro e marca o aviso", () => {
    const sel = resolveExportSelection({ pieceIds: ["a", "c2"], kitIds: [], pieces, kits, kitPieces });
    expect(sel.standalonePieces.map((p) => p.id)).toEqual(["a"]);
    expect([...sel.autoKitIds]).toEqual(["k1"]);
    expect(sel.allPieces.map((p) => p.id).sort()).toEqual(["a", "c1", "c2"]);
    expect(exportSummaryText(sel)).toBe("1 peça(s) avulsa(s) e 1 kit(s) (com 2 peças)");
    expect(exportItemCount(sel)).toBe(2);
  });
});

describe("buildExportPlan", () => {
  it("códigos livres do destino na ordem de código e posição no fim", () => {
    const sel = resolveExportSelection({ pieceIds: ["d", "b", "a"], kitIds: ["k1"], pieces, kits, kitPieces });
    const plan = buildExportPlan({
      selection: sel,
      destPieces: [{ code: 1, display_order: 0 }, { code: 3, display_order: 40 }, { code: 9, display_order: 12000 }],
      destKits: [{ code: 1, display_order: 41 }],
    });
    // códigos livres: 2, 4, 5, 6, 7 — atribuídos por código de origem (a=1, b=2, d=3, c1=7, c2=8)
    expect(plan.pieceCode.get("a")).toBe(2);
    expect(plan.pieceCode.get("b")).toBe(4);
    expect(plan.pieceCode.get("d")).toBe(5);
    expect(plan.pieceCode.get("c1")).toBe(6);
    expect(plan.pieceCode.get("c2")).toBe(7);
    // posições: depois do maior display_order < 10000 (40), na ordem da origem
    expect(["a", "b", "d", "c1", "c2"].map((id) => plan.pieceOrder.get(id))).toEqual([41, 42, 43, 44, 45]);
    expect(plan.kitCode.get("k1")).toBe(2);
    expect(plan.kitOrder.get("k1")).toBe(42);
    expect(plan.codeRows.find((r) => r.kind === "kit")).toMatchObject({ sourceCode: 4, destCode: 2 });
  });

  it("campanha nova começa do início", () => {
    const sel = resolveExportSelection({ pieceIds: ["b"], kitIds: ["k1"], pieces, kits, kitPieces });
    const plan = buildExportPlan({ selection: sel, destPieces: [], destKits: [] });
    expect(plan.pieceCode.get("b")).toBe(1);
    expect(plan.pieceOrder.get("b")).toBe(0);
    expect(plan.kitCode.get("k1")).toBe(1);
    expect(plan.kitOrder.get("k1")).toBe(0);
    expect(nextFreeCodes([1, 2, 4], 3)).toEqual([3, 5, 6]);
  });
});

describe("campos personalizados", () => {
  it("leva só os rótulos dos campos usados e avisa nomes diferentes no destino", () => {
    const used = usedCustomFields([pieces[1]]);
    expect(used).toEqual([2]);
    expect(labelsForNewCampaign(["Fornecedor", "Material", "Cor"], used)).toEqual({ piece_custom_field_2_label: "Material" });
    const warnings = customFieldWarnings(["Fornecedor", "Material"], ["Fornecedor", "Acabamento"], used);
    expect(warnings.map(customFieldWarningText)).toEqual(["O campo 'Material' se chama 'Acabamento' na campanha de destino."]);
    expect(customFieldWarnings(["", "Material"], ["", "MATERIAL"], used)).toEqual([]);
  });
});

describe("missingDestinationLocations", () => {
  it("cria no destino só locais/sublocais cadastrados na origem que faltam", () => {
    const res = missingDestinationLocations({
      items: [
        { category: "VITRINE", sub_location: "Fundo" },
        { category: "BALCÃO", sub_location: null },
        { category: "SEM CADASTRO", sub_location: "X" },
        { category: "PAREDE", sub_location: "Lateral" },
      ],
      sourceLocations: [{ id: "l1", name: "VITRINE" }, { id: "l2", name: "BALCÃO" }, { id: "l3", name: "PAREDE" }],
      sourceSubLocations: [{ id: "s1", location_id: "l1", name: "Fundo" }, { id: "s3", location_id: "l3", name: "Lateral" }],
      destLocations: [{ id: "d3", name: "Parede" }],
      destSubLocations: [{ id: "ds", location_id: "d3", name: "lateral" }],
    });
    expect(res.locations).toEqual(["VITRINE", "BALCÃO"]);
    expect(res.subLocations).toEqual([{ locationName: "VITRINE", name: "Fundo" }]);
  });
});

describe("copyPieceImage helpers", () => {
  it("só reconhece URLs do bucket piece-images e preserva a extensão", () => {
    const url = "https://x.supabase.co/storage/v1/object/public/piece-images/variants/abc/thumb.jpg?t=1";
    expect(pieceImagePathFromUrl(url)).toBe("variants/abc/thumb.jpg");
    expect(pieceImagePathFromUrl("https://x.supabase.co/storage/v1/object/public/outro/a.png")).toBeNull();
    expect(pieceImagePathFromUrl("https://cdn.exemplo.com/a.png")).toBeNull();
    expect(imageExtension("pasta/foto.PNG")).toBe(".png");
    expect(imageExtension("sem-extensao")).toBe(".jpg");
    expect(buildExportImagePath("a/b.webp", 3, 100, "zz")).toBe("piece-export-100-3-zz.webp");
  });
});
