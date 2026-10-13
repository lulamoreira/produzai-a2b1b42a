import { describe, expect, it } from "vitest";
import { mergeInstallers } from "./mergeTeamInstallers";

const p = (name: string, cpf = "", rg = "", is_leader = false) => ({ name, cpf, rg, phone: "", is_leader, is_unified_doc: false });

describe("copiar instaladores de outra equipe", () => {
  it("não duplica quem já está e acrescenta quem falta", () => {
    const { toAdd, skipped } = mergeInstallers([p("Ana", "111.111.111-11")], [p("ANA S", "11111111111"), p("Bruno")]);
    expect(skipped).toBe(1);
    expect(toAdd.map((m) => m.name)).toEqual(["Bruno"]);
  });
  it("mantém um único líder", () => {
    const { toAdd } = mergeInstallers([p("Ana", "", "", true)], [p("Bruno", "", "", true)]);
    expect(toAdd[0].is_leader).toBe(false);
  });
});
