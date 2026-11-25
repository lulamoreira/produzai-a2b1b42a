import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { buildSupplierRows, docDigits, slugAgency } from "./exportSuppliersXlsx";

describe("exportSuppliersXlsx", () => {
  it("lê os dois formatos de contato e ignora vazios", () => {
    const { contacts, suppliers } = buildSupplierRows([{ id: "1", company_name: " A ", contacts: [{ name: "Ana", role: "X", phone: "11" }, { nome: "", email: "" }, { nome: "Bia", funcao: "Y", telefone: "22" }] }]);
    expect(contacts.map((c) => c[3])).toEqual(["Ana", "Bia"]);
    expect(suppliers[0][6]).toBe("Ana");
    expect(suppliers[0][9]).toBe("11");
  });
  it("RUT mantém K e marca CNPJ repetido", () => {
    expect(docDigits("12.345.678-k")).toBe("12345678K");
    const { suppliers } = buildSupplierRows([{ id: "1", cnpj: "01.234/0001-00" }, { id: "2", cnpj: "01234000100" }, { id: "3", cnpj: "" }]);
    expect(suppliers.map((r) => r[27])).toEqual(["SIM", "SIM", ""]);
  });
  it("troca quebras de linha e formata data em SP", () => {
    const { suppliers } = buildSupplierRows([{ id: "1", observations: "a\nb", created_at: "2026-01-01T03:30:00Z" }]);
    expect(suppliers[0][24]).toBe("a / b");
    expect(suppliers[0][28]).toBe("2026-01-01 00:30");
  });
  it("nome da agência sem acentos", () => expect(slugAgency("Vimer Comunicação")).toBe("vimer-comunicacao"));
});
