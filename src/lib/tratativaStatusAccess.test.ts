import { describe, it, expect } from "vitest";
import {
  visibleTratativaStatuses,
  resolveEffectiveTratativaStatus,
  tratativaAccessMode,
  tratativaAccessPatch,
} from "./tratativaStatusAccess";

const statuses = [
  { value: "aberta", admin_only: false, fallback_status: null },
  { value: "em_andamento", admin_only: false, fallback_status: null },
  { value: "nao_procede", admin_only: true, fallback_status: null },
  { value: "resolvida", admin_only: false, fallback_status: "em_andamento" },
];

describe("status da tratativa por permissão", () => {
  it("status 'Somente ADM/Master' some da lista para usuário comum", () => {
    expect(visibleTratativaStatuses(statuses, false).map((s) => s.value)).toEqual(["aberta", "em_andamento", "resolvida"]);
  });
  it("ADM/Master vê todos os status", () => {
    expect(visibleTratativaStatuses(statuses, true)).toHaveLength(4);
  });
  it("usuário comum que escolhe status com encaminhamento grava o status de destino", () => {
    expect(resolveEffectiveTratativaStatus(statuses, "resolvida", false)).toBe("em_andamento");
  });
  it("ADM/Master grava exatamente o status escolhido, mesmo com encaminhamento", () => {
    expect(resolveEffectiveTratativaStatus(statuses, "resolvida", true)).toBe("resolvida");
  });
  it("status sem encaminhamento é gravado como escolhido", () => {
    expect(resolveEffectiveTratativaStatus(statuses, "aberta", false)).toBe("aberta");
  });
  it("status atuais (colunas desligadas) continuam 'Disponível p/ todos'", () => {
    expect(tratativaAccessMode({ value: "x" })).toBe("open");
    expect(tratativaAccessMode({ value: "x", admin_only: false, fallback_status: null })).toBe("open");
  });
  it("seletor converte as opções no que é gravado", () => {
    expect(tratativaAccessPatch("admin")).toEqual({ admin_only: true, fallback_status: null });
    expect(tratativaAccessPatch("redirect:em_andamento")).toEqual({ admin_only: false, fallback_status: "em_andamento" });
    expect(tratativaAccessPatch("open")).toEqual({ admin_only: false, fallback_status: null });
  });
});
