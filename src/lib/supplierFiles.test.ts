import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

import { buildSupplierFilePath, resolveSupplierFilePath, sanitizeSupplierFileName } from "./supplierFiles";

describe("supplierFiles", () => {
  it("sanitizes uploaded supplier file names", () => {
    expect(sanitizeSupplierFileName("Apresentação - Hodari.pdf")).toBe("Apresenta__o_-_Hodari.pdf");
    expect(sanitizeSupplierFileName("Listagem de produtos - 2026.pdf")).toBe("Listagem_de_produtos_-_2026.pdf");
  });

  it("stores new files as private bucket paths instead of public URLs", () => {
    vi.spyOn(Date, "now").mockReturnValue(1782497951932);

    expect(buildSupplierFilePath("agency-123", "Apresentação - Hodari.pdf")).toBe(
      "suppliers/agency-123/1782497951932-Apresenta__o_-_Hodari.pdf",
    );
  });

  it("recovers a private storage path from legacy public URLs", () => {
    const legacyUrl =
      "https://example.supabase.co/storage/v1/object/public/supplier_files/suppliers/12b779b6-8226-4800-be90-bc6eb5d682be/1782497951932-Apresentacao_-_Hodari.pdf";

    expect(resolveSupplierFilePath({ name: "Apresentacao - Hodari.pdf", url: legacyUrl })).toBe(
      "suppliers/12b779b6-8226-4800-be90-bc6eb5d682be/1782497951932-Apresentacao_-_Hodari.pdf",
    );
  });

  it("keeps existing path references unchanged", () => {
    const path = "suppliers/agency-123/file.pdf";

    expect(resolveSupplierFilePath({ name: "file.pdf", path })).toBe(path);
  });
});