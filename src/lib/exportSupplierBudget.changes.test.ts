import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildSupplierBudgetWorkbook } from "./exportSupplierBudget";
import type { ResolvedSupplierChange } from "./supplierChangeMarkers";

const change = (c: Partial<ResolvedSupplierChange>): ResolvedSupplierChange => ({
  id: crypto.randomUUID(), change_type: "changed", aspects: [], note: null, kind: "piece",
  code: 1, name: "", piece_id: null, kit_id: null, ...c,
});

describe("supplier spreadsheet with change markers", () => {
  it("flags changed items and lists removed ones in an extra tab", async () => {
    const { blob } = await buildSupplierBudgetWorkbook({
      campaignName: "Natal", supplierName: "Fornecedor X", currencyCode: "BRL",
      installation: 0, freight: 0, grandTotal: 0,
      rows: [
        { type: "standalone_piece", name: "Display", code: 10, totalQty: 5, unitPrice: null, lineTotal: 0 },
        { type: "standalone_piece", name: "Faixa", code: 11, totalQty: 2, unitPrice: null, lineTotal: 0 },
      ],
      supplierChanges: [
        change({ code: 10, name: "Display", aspects: ["measures_material"], note: "1,50 m" }),
        change({ change_type: "removed", code: 12, name: "Totem" }),
      ],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const main = wb.worksheets[0];
    expect(String(main.getRow(6).getCell(4).value)).toContain("ALTERADA: MEDIDAS E MATERIAL — 1,50 m");
    expect(String(main.getRow(7).getCell(4).value)).toBe("Faixa");
    const tab = wb.getWorksheet("Alterações");
    expect(tab).toBeDefined();
    const names = [3, 4].map((n) => String(tab!.getRow(n).getCell(4).value));
    expect(names).toEqual(["Display", "Totem"]);
    expect(String(tab!.getRow(4).getCell(1).value)).toBe("Removida");
  });

  it("adds nothing when no change is marked", async () => {
    const { blob } = await buildSupplierBudgetWorkbook({
      campaignName: "Natal", supplierName: "F", currencyCode: "BRL", installation: 0, freight: 0, grandTotal: 0,
      rows: [{ type: "standalone_piece", name: "Display", code: 10, totalQty: 5, unitPrice: null, lineTotal: 0 }],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    expect(wb.getWorksheet("Alterações")).toBeUndefined();
    expect(String(wb.worksheets[0].getRow(6).getCell(4).value)).toBe("Display");
  });
});
