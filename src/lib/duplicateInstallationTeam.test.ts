import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { buildTeamDuplicate } from "./duplicateInstallationTeam";

describe("team duplication", () => {
  const team = { id: "original", campaign_id: "campaign", name: "Original", created_at: "today", coverage_scope: "city", coverage_values: ["São Paulo"] };
  const member = { id: "member", team_id: "original", created_at: "today", name: "Ana", phone: "11999999999", cpf: "00123456789", rg: "00123", is_leader: true, is_unified_doc: true };
  const vehicle = { id: "vehicle", team_id: "original", created_at: "today", name: "Van", brand: "Marca", color: "Branco", plate: "ABC1D23" };
  it("copies all details and coverage under a new name without altering original records", () => {
    const copy = buildTeamDuplicate(team, [member], [vehicle], " Nova equipe ", "new");
    expect(copy.team).toEqual({ id: "new", campaign_id: "campaign", name: "Nova equipe", coverage_scope: "city", coverage_values: ["São Paulo"] });
    expect(copy.members).toEqual([{ team_id: "new", name: "Ana", phone: "11999999999", cpf: "00123456789", rg: "00123", is_leader: true, is_unified_doc: true }]);
    expect(copy.vehicles).toEqual([{ team_id: "new", name: "Van", brand: "Marca", color: "Branco", plate: "ABC1D23" }]);
    expect(team.name).toBe("Original");
    expect(member.team_id).toBe("original");
    expect(vehicle.team_id).toBe("original");
  });
  it("requires a new name", () => {
    expect(() => buildTeamDuplicate(team, [], [], " ", "new")).toThrow("Informe o novo nome");
  });
});