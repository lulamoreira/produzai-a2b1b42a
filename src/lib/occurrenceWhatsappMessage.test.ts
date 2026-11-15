import { describe, it, expect } from "vitest";
import { buildOccurrenceWhatsappMessage, formatDateOnly } from "./occurrenceWhatsappMessage";

const base = {
  storeName: "Goiania Shopping",
  pieceName: "Tapete Mesa",
  local: "Mesa / Centro",
  openedAtIso: "2026-11-09T13:30:00Z",
  descricao: "Peça chegou rasgada",
  statusLabel: "Em andamento",
  statusNormalizado: "em andamento",
  notes: "Vamos enviar uma nova peça.",
  senderName: "Lula",
  agencyName: "Vimer",
};

describe("buildOccurrenceWhatsappMessage", () => {
  it("contém abertura, descrição, status e notas nesta ordem, e o convite", () => {
    const m = buildOccurrenceWhatsappMessage(base);
    const iOpen = m.indexOf("Aberta em: 09/11/2026 às 10:30");
    const iDesc = m.indexOf("Peça chegou rasgada");
    const iStatus = m.indexOf("*Status da tratativa:* Em andamento");
    const iNotes = m.indexOf("Vamos enviar uma nova peça.");
    expect(iOpen).toBeGreaterThan(-1);
    expect(iDesc).toBeGreaterThan(iOpen);
    expect(iStatus).toBeGreaterThan(iDesc);
    expect(iNotes).toBeGreaterThan(iStatus);
    expect(m).toContain("responder aqui mesmo, por este WhatsApp");
  });

  it("com portalUrl a URL fica sozinha na linha; sem portalUrl não sobra 'link'", () => {
    const url = "https://produzai.lovable.app/loja/abc123";
    const com = buildOccurrenceWhatsappMessage({ ...base, portalUrl: url });
    expect(com.split("\n")).toContain(url);
    const sem = buildOccurrenceWhatsappMessage(base);
    expect(sem.toLowerCase()).not.toContain("link");
    expect(sem).not.toContain("acompanhar essa ocorrência");
  });

  it("sem material e sem rastreio não deixa linhas vazias nem undefined", () => {
    const m = buildOccurrenceWhatsappMessage({ ...base, needsMaterial: true, materialTrackingCode: "" });
    expect(m).not.toContain("undefined");
    expect(m).not.toContain("*Material*");
    expect(m).not.toContain("—");
    expect(m).not.toMatch(/\n\n\n/);
    expect(m).not.toMatch(/: *$/m);
  });

  it("notas vazias usam a frase padrão", () => {
    const m = buildOccurrenceWhatsappMessage({ ...base, notes: "  " });
    expect(m).toContain("Seguimos acompanhando o caso e voltamos a falar com vocês assim que tivermos novidades.");
  });

  it("status Não procede inclui desculpas antes das considerações", () => {
    const m = buildOccurrenceWhatsappMessage({ ...base, statusLabel: "Não procede", statusNormalizado: "nao procede" });
    const i = m.indexOf("pedimos desculpas");
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(m.indexOf("*Nossas considerações:*"));
  });

  it("data 2026-11-09 vira 09/11/2026 sem deslocar", () => {
    expect(formatDateOnly("2026-11-09")).toBe("09/11/2026");
    const m = buildOccurrenceWhatsappMessage({ ...base, needsMaterial: true, materialSentDate: "2026-11-09" });
    expect(m).toContain("Enviado em: 09/11/2026");
  });

  it("sem remetente e agência não deixa 'Aqui é' nem espaços sobrando", () => {
    const m = buildOccurrenceWhatsappMessage({ ...base, senderName: "", agencyName: "" });
    expect(m).not.toContain("Aqui é");
    expect(m.endsWith("Um abraço,")).toBe(true);
    expect(m).not.toMatch(/ \n|  /);
  });
});
