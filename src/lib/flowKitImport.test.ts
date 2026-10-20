import { describe, expect, it } from "vitest";
import { buildFlowImportRecords, flowNameWithoutKit, isFlowKit } from "./flowKitImport";
import { parseFlowPieceName, type FlowParsedPiece } from "./parseFlowWorkbook";

const sourceName = "LINDT_SUMMER_INT_PROMOTABLE_KIT_LATERAL_50x88cm";
const piece: FlowParsedPiece = { ...parseFlowPieceName(sourceName), sourceName, category: "PAREDE", subLocation: "Lateral", specification: "Especificação do histórico", imageUrls: [] };

describe("Flow kit import rules", () => {
  it.each([
    [sourceName, true], ["LINDT_SUMMER_TDS_KIT_SHELFTALK_20x20cm", true],
    ["lindt_kit_adesivo", true], ["KIT Shelftalk", true], ["Adesivo KIT", true],
    ["LINDT_KITCHEN_ADESIVO", false], ["LINDT_TOOLKIT_ADESIVO", false],
    ["LINDT_SUMMER_VIT_K IT_REVESTIMENTO", false],
  ])("detects isolated KIT only in raw %s", (raw, expected) => {
    expect(isFlowKit(raw)).toBe(expected);
  });

  it.each([
    ["Promotable KIT Lateral", "Promotable Lateral"],
    ["KIT Shelftalk 2020", "Shelftalk 2020"],
    ["Standard GG KIT Adesivo Moldura 5", "Standard GG Adesivo Moldura 5"],
    ["Kit  Adesivo kit", "Adesivo"],
  ])("removes isolated KIT from %s", (name, expected) => {
    expect(flowNameWithoutKit(name)).toBe(expected);
  });

  it("creates prefixed kit and exactly one kit-only component with all enriched fields", () => {
    const records = buildFlowImportRecords(piece, "campaign", 41, 17, "saved-combined-image");
    expect(records.kit).toMatchObject({ name: "KIT Promotable Lateral", category: "PAREDE", sub_location: "Lateral", image_url: "saved-combined-image", code: 41, display_order: 17 });
    expect(records.piece).toMatchObject({ name: "Promotable Lateral", kit_only: true, category: "PAREDE", sub_location: "Lateral", size: "50×88", specification: "Especificação do histórico", image_url: "saved-combined-image", code: 42, display_order: 18 });
    expect(records.nextCode).toBe(43);
    expect(records.nextOrder).toBe(19);
  });

  it("preserves standalone pieces, missing images and default specification", () => {
    const records = buildFlowImportRecords({ ...piece, sourceName: "LINDT_SUMMER_INT_ADESIVO", name: "Adesivo", specification: "" }, "campaign", 43, 19, null);
    expect(records.kit).toBeNull();
    expect(records.piece).toMatchObject({ name: "Adesivo", kit_only: false, image_url: null, specification: "Vide Book/Manual", code: 43, display_order: 19 });
    expect(records.nextCode).toBe(44);
  });

  it("shares numbering sequentially across mixed kits and standalone pieces", () => {
    let code = Math.max(36, 70) + 1;
    let order = Math.max(18, 29) + 1;
    const codes: number[] = [];
    for (const row of [piece, { ...piece, sourceName: "Adesivo", name: "Adesivo" }, piece]) {
      const result = buildFlowImportRecords(row, "campaign", code, order, null);
      if (result.kit) codes.push(result.kit.code);
      codes.push(result.piece.code);
      code = result.nextCode;
      order = result.nextOrder;
    }
    expect(codes).toEqual([71, 72, 73, 74, 75]);
    expect(order).toBe(35);
  });
});