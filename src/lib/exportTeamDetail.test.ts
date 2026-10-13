import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { buildTeamClipboardHtml, buildTeamClipboardText, exportTeamDetail, type TeamClipboardData } from "./exportTeamDetail";
import { saveBlobAs } from "./saveBlobAs";

vi.mock("./saveBlobAs", () => ({ saveBlobAs: vi.fn().mockResolvedValue(undefined) }));

const data: TeamClipboardData = {
  team: { id: "team", campaign_id: "campaign", name: "Equipe Teste", created_at: "", coverage_scope: "none", coverage_values: [] },
  campaignName: "Campanha Teste",
  members: [
    { id: "a", team_id: "team", name: "Ana", phone: "11999990000", rg: "12345", cpf: "00123456789", is_unified_doc: false, is_leader: true },
    { id: "b", team_id: "team", name: "Bruno", phone: "", rg: "", cpf: "RU-5678", is_unified_doc: true, is_leader: false },
  ],
  vehicles: [{ id: "v", team_id: "team", name: "Van", brand: "Fiat", color: "Branca", plate: "ABC1D23" }],
};

describe("individual team export data integrity", () => {
  it("preserves all member and vehicle values in both clipboard representations", () => {
    for (const content of [buildTeamClipboardText(data), buildTeamClipboardHtml(data)]) {
      for (const value of ["Ana", "Bruno", "11999990000", "12345", "00123456789", "RU-5678", "Van", "Fiat", "Branca", "ABC1D23"]) {
        expect(content).toContain(value);
      }
    }
  });

  it("exports unified documents only as RU and keeps document leading zeros", async () => {
    await exportTeamDetail({ ...data, fileName: "team.xlsx" });
    const blob = vi.mocked(saveBlobAs).mock.calls.at(-1)?.[0];
    if (!(blob instanceof Blob)) throw new Error("Expected exported workbook blob");
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error("Invalid buffer"));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const sheet = workbook.getWorksheet("Equipe");
    if (!sheet) throw new Error("Missing team worksheet");
    const values: unknown[] = [];
    sheet.eachRow((row) => values.push(row.getCell(2).value));
    expect(values).toContain("00123456789");
    expect(values.filter((value) => value === "RU-5678")).toHaveLength(1);
    const ruRows: string[] = [];
    sheet.eachRow((row) => { if (row.getCell(2).value === "RU-5678") ruRows.push(String(row.getCell(1).value)); });
    expect(ruRows).toEqual(["RU:"]);
  });
});