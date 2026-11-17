import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildSupplierBudgetWorkbook } from "./exportSupplierBudget";

const readBlob = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

const store = (id: string, name: string, tipo: string) =>
  ({ id, name, city: "SP", state: "SP", store_model: "NOVO", showcase_count: 1, tipo_entrega: tipo }) as any;

async function build(stores: any[], disabled?: Set<string>) {
  const { blob } = await buildSupplierBudgetWorkbook({
    campaignName: "Natal", supplierName: "Fornecedor X", currencyCode: "BRL",
    installation: 0, freight: 0, grandTotal: 0,
    rows: [{ type: "standalone_piece", name: "Display", code: 1, totalQty: 0, unitPrice: null, lineTotal: 0 }],
    rateio: { pieces: [], kits: [], kitPieces: [], stores, qtyMap: {}, disabledStoreIds: disabled },
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await readBlob(blob));
  return wb;
}

describe("supplier spreadsheet logistics warnings", () => {
  it("joins the separate warnings in row 4 and skips disabled stores", async () => {
    const wb = await build(
      [store("a", "A", "frete_apenas"), store("b", "B", "instalacao_apenas"), store("c", "C", "sem_logistica"), store("d", "D", "frete_apenas")],
      new Set(["d"]),
    );
    expect(String(wb.worksheets[0].getCell("A4").value)).toBe(
      "⚠️ 1 loja(s) somente entrega — sem instalação. · ⚠️ 1 loja(s) somente instalação — sem frete. · ⚠️ 1 loja(s) sem logística — sem frete e sem instalação.",
    );
  });

  it("has no warning when every store is Frete + Instalação", async () => {
    const wb = await build([store("a", "A", "frete_instalacao")]);
    expect(wb.worksheets[0].getCell("A4").value).toBeNull();
  });

  it("shows each store's effective type in the matrix", async () => {
    const wb = await build([store("a", "Loja A", "instalacao_apenas")]);
    const matrix = wb.worksheets.find((w) => w.name.startsWith("Matriz"))!;
    let found = false;
    matrix.eachRow((row) => {
      if (row.getCell(1).value === "Loja A") { expect(row.getCell(6).value).toBe("Só instalação"); found = true; }
    });
    expect(found).toBe(true);
  });
});
