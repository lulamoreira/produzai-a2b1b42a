import { describe, it, expect } from "vitest";
import {
  occurrenceWindow, occurrenceWindowWarning, internalNoteText, reporterTypeValue,
  storeMatches, activeCampaignStores, assignedPecaIds, pecaOptions,
} from "./adminOccurrence";

describe("prazo de ocorrências", () => {
  const now = new Date(2026, 10, 18, 11, 0);
  it("prazo passado = encerrado, com a data no aviso", () => {
    const w = occurrenceWindow(new Date(2026, 10, 10, 23, 59).toISOString(), now);
    expect(w.kind).toBe("ended");
    expect(occurrenceWindowWarning(w)).toBe("Prazo de ocorrências encerrado em 10/11/2026. Como administrador, você pode registrar mesmo assim.");
  });
  it("prazo futuro = sem aviso", () => {
    const w = occurrenceWindow(new Date(2026, 10, 30).toISOString(), now);
    expect(w.kind).toBe("ok");
    expect(occurrenceWindowWarning(w)).toBeNull();
  });
  it("sem prazo = não configurado", () => {
    expect(occurrenceWindow(null, now).kind).toBe("not_configured");
  });
});

describe("nota interna", () => {
  const now = new Date(2026, 10, 18, 9, 5);
  it("marca fora do prazo", () => {
    expect(internalNoteText({ userName: "Lula", now, outOfWindow: true }))
      .toBe("Registrada internamente por Lula em 18/11/2026 09:05 (fora do prazo de ocorrências)");
  });
  it("dentro do prazo sem sufixo", () => {
    expect(internalNoteText({ userName: "Lula", now, outOfWindow: false })).toBe("Registrada internamente por Lula em 18/11/2026 09:05");
  });
});

describe("reportado por", () => {
  it("usa o mesmo formato do portal", () => {
    expect(reporterTypeValue("agencia", "Vimer", "Lindt")).toBe("agencia:Vimer");
    expect(reporterTypeValue("cliente", "Vimer", "Lindt")).toBe("cliente:Lindt");
    expect(reporterTypeValue("lojista", "Vimer", "Lindt")).toBe("lojista");
    expect(reporterTypeValue("fornecedor", "Vimer", "Lindt")).toBe("fornecedor");
  });
});

describe("lojas", () => {
  const stores = [
    { id: "2", name: "Morumbi", nickname: "MSP", city: "São Paulo", state: "SP", store_code: "L12" },
    { id: "1", name: "Barra Shopping", city: "Rio de Janeiro", state: "RJ", store_code: "L7" },
    { id: "3", name: "Anália Franco", city: "São Paulo", state: "SP" },
  ];
  it("tira desativadas e ordena por nome", () => {
    expect(activeCampaignStores(stores, ["2"]).map((s) => s.id)).toEqual(["3", "1"]);
  });
  it("busca por nome, apelido, cidade/UF e código, sem acento", () => {
    expect(storeMatches(stores[0], "msp")).toBe(true);
    expect(storeMatches(stores[0], "sao paulo")).toBe(true);
    expect(storeMatches(stores[0], "L12")).toBe(true);
    expect(storeMatches(stores[1], "rj")).toBe(true);
    expect(storeMatches(stores[1], "sp")).toBe(false);
  });
});

describe("peças que a loja recebe", () => {
  const tipos = [
    { id: "A", nome: "Vitrine", tem_subdivisao: false, display_order: 0 },
    { id: "I", nome: "Internos", tem_subdivisao: true, display_order: 1 },
  ];
  const subdivisoes = [{ id: "s1", tipo_id: "I", nome: "Caixa", display_order: 0 }, { id: "s2", tipo_id: "I", nome: "Gôndola", display_order: 1 }];
  const pecas = [
    { id: "p1", nome: "Adesivo", image_url: null, tipo_id: "A", subdivisao_id: null, display_order: 0 },
    { id: "p2", nome: "Display", image_url: null, tipo_id: "I", subdivisao_id: "s1", display_order: 0 },
    { id: "p3", nome: "Faixa", image_url: null, tipo_id: "I", subdivisao_id: "s2", display_order: 0 },
  ];
  it("subdivisão desligada fica de fora; sem linha explícita conta como recebida", () => {
    const set = assignedPecaIds({ tipos, subdivisoes, pecas, lojas: [{ tipo_id: "I", subdivisao_id: "s2", ativo: false }] });
    expect([...set].sort()).toEqual(["p2"]);
  });
  it("recebidas primeiro, depois as demais", () => {
    const assigned = assignedPecaIds({ tipos, subdivisoes, pecas, lojas: [{ tipo_id: "I", subdivisao_id: "s2", ativo: false }] });
    expect(pecaOptions({ tipos, subdivisoes, pecas, assigned }).map((o) => [o.peca.id, o.assigned])).toEqual([["p2", true], ["p1", false], ["p3", false]]);
  });
});
