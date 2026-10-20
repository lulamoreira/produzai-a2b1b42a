import { describe, expect, it } from "vitest";
import { buildFlowImportRecords, flowNameWithoutKit, isFlowKit, parseKitComponents } from "./flowKitImport";
import { parseFlowPieceName, type FlowParsedPiece } from "./parseFlowWorkbook";

const sourceName = "LINDT_SUMMER_INT_PROMOTABLE_KIT_LATERAL_50x88cm";
const piece: FlowParsedPiece = { ...parseFlowPieceName(sourceName), sourceName, category: "PAREDE", subLocation: "Lateral", specification: "Especificação do histórico", imageUrls: [] };

describe("Flow kit import rules", () => {
  it.each([
    [sourceName, true], ["LINDT_SUMMER_TDS_KIT_SHELFTALK_20x20cm", true],
    ["lindt_kit_adesivo", true], ["KIT Shelftalk", true], ["Adesivo KIT", true],
    ["LINDT_SUMMER_VIT_K IT_REVESTIMENTO_100x50cm", true],
    ["LINDT_SUMMER_INT_PICK&MIX K IT_MOBILES_30x30cm", true],
    ["LINDT_SUMMER_INT_PICK&MIX_K  I  T_MOBILES_30x30cm", true],
    ["LINDT_KITCHEN_ADESIVO", false], ["LINDT_TOOLKIT_ADESIVO", false],
  ])("detects isolated KIT only in raw %s", (raw, expected) => {
    expect(isFlowKit(raw)).toBe(expected);
  });

  it.each([
    ["Promotable KIT Lateral", "Promotable Lateral"],
    ["KIT Shelftalk 2020", "Shelftalk 2020"],
    ["Standard GG KIT Adesivo Moldura 5", "Standard GG Adesivo Moldura 5"],
    ["Kit  Adesivo kit", "Adesivo"],
    ["Pick&Mix K IT Mobiles", "Pick&Mix Mobiles"],
  ])("removes isolated KIT from %s", (name, expected) => {
    expect(flowNameWithoutKit(name)).toBe(expected);
  });

  it.each([
    ["LINDT_SUMMER_INT_PROMOTABLE_KIT_LATERAL_50x88cm (10% - 24x24cm / 15% 26x26cm / 20% 28x28cm)",
      [{ label: "10%", size: "24×24" }, { label: "15%", size: "26×26" }, { label: "20%", size: "28×28" }]],
    ["LINDT_SUMMER_VIT_KIT_FAIXA_100x10cm (SUPERIOR 175x7,5cm / INFERIOR 110x7,5cm)",
      [{ label: "Superior", size: "175×7,5" }, { label: "Inferior", size: "110×7,5" }]],
  ])("parses sized components from the final parenthesis of %s", (raw, expected) => {
    expect(parseKitComponents(raw)).toEqual(expected);
  });

  it.each([
    ["LINDT_SUMMER_INT_KIT_DISPLAY_30x30cm (2 laterais / 2 artes)"],
    ["LINDT_SUMMER_INT_KIT_DISPLAY_30x30cm (Dobra: 8cm)"],
    ["LINDT_SUMMER_INT_KIT_DISPLAY_30x30cm"],
  ])("returns null when no part has a size: %s", (raw) => {
    expect(parseKitComponents(raw)).toBeNull();
  });

  it("creates prefixed kit and exactly one kit-only component with all enriched fields", () => {
    const records = buildFlowImportRecords(piece, "campaign", 41, 17, "saved-combined-image");
    expect(records.kit).toMatchObject({ name: "KIT Promotable Lateral", category: "PAREDE", sub_location: "Lateral", image_url: "saved-combined-image", code: 41, display_order: 17 });
    expect(records.pieces).toHaveLength(1);
    expect(records.pieces[0]).toMatchObject({ name: "Promotable Lateral", kit_only: true, category: "PAREDE", sub_location: "Lateral", size: "50×88", specification: "Especificação do histórico", image_url: "saved-combined-image", code: 42, display_order: 18 });
    expect(records.nextCode).toBe(43);
    expect(records.nextOrder).toBe(19);
  });

  it("creates one component per sized part named '<TIPO> <RÓTULO> - <LOCAL>', image only on the first", () => {
    const raw = "LINDT_SUMMER_INT_PICK&MIX K IT_MOBILES_DESCONTOS_30x30cm (10% - 24x24cm / 15% 26x26cm / 20% 28x28cm)";
    const parsed: FlowParsedPiece = { ...parseFlowPieceName(raw), sourceName: raw, category: "PICK & MIX", subLocation: "", imageUrls: [] };
    const records = buildFlowImportRecords(parsed, "campaign", 41, 17, "saved-image");
    expect(records.kit).toMatchObject({ name: "KIT PICK&MIX Mobiles Descontos", code: 41, display_order: 17, image_url: "saved-image" });
    expect(records.pieces).toHaveLength(3);
    expect(records.pieces[0]).toMatchObject({ name: "Mobiles 10% - Pick&Mix", size: "24×24", kit_only: true, image_url: "saved-image", code: 42, display_order: 18 });
    expect(records.pieces[1]).toMatchObject({ name: "Mobiles 15% - Pick&Mix", size: "26×26", image_url: null, code: 43, display_order: 19 });
    expect(records.pieces[2]).toMatchObject({ name: "Mobiles 20% - Pick&Mix", size: "28×28", image_url: null, code: 44, display_order: 20 });
    for (const component of records.pieces) {
      expect(component.specification).not.toContain("(");
      expect(component.specification).toBe("Vide Book/Manual");
    }
    expect(records.nextCode).toBe(45);
    expect(records.nextOrder).toBe(21);
  });

  it("uses the kit sub-location as TIPO when it exists", () => {
    const raw = "LINDT_SUMMER_VIT_KIT_SHELFTALK_100x10cm (SUPERIOR 175x7,5cm / INFERIOR 110x7,5cm)";
    const parsed: FlowParsedPiece = { ...parseFlowPieceName(raw), sourceName: raw, category: "PAREDE", subLocation: "Shelftalk", imageUrls: [] };
    const records = buildFlowImportRecords(parsed, "campaign", 41, 17, null);
    expect(records.pieces.map((p) => p.name)).toEqual(["Shelftalk Superior - Parede", "Shelftalk Inferior - Parede"]);
    expect(records.pieces.map((p) => p.size)).toEqual(["175×7,5", "110×7,5"]);
  });

  it("keeps single component and parenthesis in specification when no part has a size", () => {
    const raw = "LINDT_SUMMER_INT_KIT_DISPLAY_30x30cm (2 laterais / 2 artes)";
    const parsed: FlowParsedPiece = { ...parseFlowPieceName(raw), sourceName: raw, category: "PAREDE", subLocation: "Display", imageUrls: [] };
    const records = buildFlowImportRecords(parsed, "campaign", 41, 17, null);
    expect(records.pieces).toHaveLength(1);
    expect(records.pieces[0]).toMatchObject({ name: "Display", specification: "(2 laterais / 2 artes)", code: 42 });
    expect(records.nextCode).toBe(43);
  });

  it("preserves standalone pieces, missing images and default specification", () => {
    const records = buildFlowImportRecords({ ...piece, sourceName: "LINDT_SUMMER_INT_ADESIVO", name: "Adesivo", specification: "" }, "campaign", 43, 19, null);
    expect(records.kit).toBeNull();
    expect(records.pieces[0]).toMatchObject({ name: "Adesivo", kit_only: false, image_url: null, specification: "Vide Book/Manual", code: 43, display_order: 19 });
    expect(records.nextCode).toBe(44);
  });

  it("shares numbering sequentially across mixed kits and standalone pieces", () => {
    let code = Math.max(36, 70) + 1;
    let order = Math.max(18, 29) + 1;
    const codes: number[] = [];
    for (const row of [piece, { ...piece, sourceName: "Adesivo", name: "Adesivo" }, piece]) {
      const result = buildFlowImportRecords(row, "campaign", code, order, null);
      if (result.kit) codes.push(result.kit.code);
      codes.push(...result.pieces.map((p) => p.code));
      code = result.nextCode;
      order = result.nextOrder;
    }
    expect(codes).toEqual([71, 72, 73, 74, 75]);
    expect(order).toBe(35);
  });
});
