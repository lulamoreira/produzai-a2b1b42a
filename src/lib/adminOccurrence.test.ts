import { describe, it, expect } from "vitest";
import {
  occurrenceWindow, occurrenceWindowWarning, internalNoteText, reporterTypeValue,
  storeMatches, activeCampaignStores, assignedPecaIds, pecaOptions,
  showcaseCountLabel, storeCapacityInfo,
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

describe("modelo e vitrines da loja selecionada", () => {
  it("mostra o modelo cadastrado e o número de vitrines", () => {
    expect(storeCapacityInfo({ id: "1", name: "Barra", store_model: " NOVO ", showcase_count: 2 }))
      .toEqual({ model: "NOVO", showcases: 2 });
  });
  it("0 vitrines é um valor real e aparece", () => {
    expect(storeCapacityInfo({ id: "1", name: "Anália Franco", showcase_count: 0 })).toEqual({ model: null, showcases: 0 });
  });
  it("sem modelo nem vitrines cadastrados = nada a mostrar", () => {
    expect(storeCapacityInfo({ id: "1", name: "X", store_model: "   ", showcase_count: null }))
      .toEqual({ model: null, showcases: null });
    expect(storeCapacityInfo(null)).toEqual({ model: null, showcases: null });
  });
  it("plural de vitrines", () => {
    expect(showcaseCountLabel(1)).toBe("1 vitrine");
    expect(showcaseCountLabel(0)).toBe("0 vitrines");
    expect(showcaseCountLabel(3)).toBe("3 vitrines");
  });
});

describe("peças que a loja recebe", () => {
  const tipos = [
    { id: "A", nome: "Vitrine", letra: "A", tem_subdivisao: false, display_order: 0 },
    { id: "I", nome: "Internos", letra: "H", tem_subdivisao: true, display_order: 1 },
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

describe("código da peça", () => {
  const tipos = [
    { id: "A", nome: "Vitrine", letra: "A", tem_subdivisao: false, display_order: 0 },
    { id: "I", nome: "Internos", letra: "H", tem_subdivisao: true, display_order: 1 },
    { id: "X", nome: "Sem letra", letra: "  ", tem_subdivisao: false, display_order: 2 },
  ];
  const subdivisoes = [{ id: "s1", tipo_id: "I", nome: "Caixa", display_order: 0 }];
  const pecas = [
    { id: "p1", nome: "Adesivo", image_url: null, tipo_id: "A", subdivisao_id: null, display_order: 0 },
    { id: "p2", nome: "Display", image_url: null, tipo_id: "I", subdivisao_id: "s1", display_order: 0 },
    { id: "p3", nome: "Faixa", image_url: null, tipo_id: "X", subdivisao_id: null, display_order: 0 },
  ];
  it("mostra a letra do tipo como código, com o local do lado", () => {
    const opts = pecaOptions({ tipos, subdivisoes, pecas, assigned: new Set(["p2"]) });
    expect(opts.map((o) => [o.peca.id, o.code, o.local])).toEqual([
      ["p2", "H", "Internos / Caixa"],
      ["p1", "A", "Vitrine"],
      ["p3", null, "Sem letra"],
    ]);
  });
  it("peça sem tipo não tem código", () => {
    const opts = pecaOptions({ tipos, subdivisoes, pecas: [{ id: "p9", nome: "Solta", image_url: null, tipo_id: null, subdivisao_id: null, display_order: 0 }], assigned: new Set() });
    expect(opts[0].code).toBeNull();
  });
});
