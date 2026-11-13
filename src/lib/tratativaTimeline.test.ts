import { describe, it, expect } from "vitest";
import {
  tratativaTimeline,
  localTodayISO,
  formatDateOnlyBR,
  validateMaterialDates,
  isReinstallBeforeMaterial,
  arrivalCountdownText,
  type TimelineOccurrence,
} from "./tratativaTimeline";

const TODAY = "2026-11-18";
/** Timestamp local (independente do fuso da máquina de teste). */
const localTs = (y: number, m: number, d: number, h = 14, min = 30) => new Date(y, m - 1, d, h, min).toISOString();

const base: TimelineOccurrence = { status: "pendente", resolved_at: null };
const stateOf = (t: ReturnType<typeof tratativaTimeline>, key: string) => t.steps.find((s) => s.key === key)?.state;

describe("tratativaTimeline", () => {
  it("sem envio de material e sem reinstalação não mostra linha do tempo", () => {
    const t = tratativaTimeline({ ...base, needs_material_shipment: false, needs_reinstallation: false }, TODAY);
    expect(t.show).toBe(false);
    expect(t.steps).toHaveLength(0);
  });

  it("só entram as etapas aplicáveis, na ordem", () => {
    expect(tratativaTimeline({ ...base, needs_material_shipment: true }, TODAY).steps.map((s) => s.key))
      .toEqual(["sent", "arrived", "resolved"]);
    expect(tratativaTimeline({ ...base, needs_reinstallation: true }, TODAY).steps.map((s) => s.key))
      .toEqual(["reinstall", "resolved"]);
  });

  it("sem data de envio: aguardando envio do material", () => {
    const t = tratativaTimeline({ ...base, needs_material_shipment: true }, TODAY);
    expect(t.headline).toBe("Aguardando envio do material");
    expect(t.tone).toBe("warning");
    expect(stateOf(t, "sent")).toBe("current");
  });

  it("material a caminho com previsão", () => {
    const t = tratativaTimeline(
      { ...base, needs_material_shipment: true, material_sent_date: "2026-11-15", material_eta_date: "2026-11-20" },
      TODAY,
    );
    expect(t.headline).toBe("Material a caminho · chega 20/11");
    expect(t.tone).toBe("warning");
    expect(stateOf(t, "sent")).toBe("done");
    expect(stateOf(t, "arrived")).toBe("current");
    expect(t.nextStep).toContain("previsto para 20/11");
  });

  it("material a caminho sem previsão", () => {
    const t = tratativaTimeline({ ...base, needs_material_shipment: true, material_sent_date: "2026-11-15" }, TODAY);
    expect(t.headline).toBe("Material a caminho");
  });

  it("previsão vencida: material atrasado N dias e aviso de remarcar reinstalação", () => {
    const t = tratativaTimeline(
      {
        ...base,
        needs_material_shipment: true,
        material_sent_date: "2026-11-10",
        material_eta_date: "2026-11-15",
        needs_reinstallation: true,
        reinstallation_scheduled_at: localTs(2026, 11, 22),
      },
      TODAY,
    );
    expect(t.headline).toBe("Material atrasado 3 dias");
    expect(t.tone).toBe("danger");
    expect(stateOf(t, "arrived")).toBe("late");
    expect(t.nextStep).toContain("pode precisar ser remarcada");
    const reinst = t.steps.find((s) => s.key === "reinstall");
    expect(reinst?.badge).toBe("prevista");
  });

  it("atrasado 1 dia usa singular", () => {
    const t = tratativaTimeline(
      { ...base, needs_material_shipment: true, material_sent_date: "2026-11-10", material_eta_date: "2026-11-17" },
      TODAY,
    );
    expect(t.headline).toBe("Material atrasado 1 dia");
  });

  it("chegou e não precisa reinstalação: material entregue", () => {
    const t = tratativaTimeline(
      { ...base, needs_material_shipment: true, material_sent_date: "2026-11-10", material_arrived_date: "2026-11-14" },
      TODAY,
    );
    expect(t.headline).toBe("Material entregue na loja");
    expect(t.tone).toBe("success");
    expect(stateOf(t, "arrived")).toBe("done");
    expect(stateOf(t, "resolved")).toBe("current");
  });

  it("precisa reinstalação sem data: agendar (danger se o material já chegou)", () => {
    const semMaterial = tratativaTimeline({ ...base, needs_reinstallation: true }, TODAY);
    expect(semMaterial.headline).toBe("Agendar reinstalação");
    expect(semMaterial.tone).toBe("warning");
    const chegou = tratativaTimeline(
      { ...base, needs_material_shipment: true, material_sent_date: "2026-11-10", material_arrived_date: "2026-11-14", needs_reinstallation: true },
      TODAY,
    );
    expect(chegou.headline).toBe("Agendar reinstalação");
    expect(chegou.tone).toBe("danger");
  });

  it("reinstalação antes da chegada: remarcar", () => {
    const occ: TimelineOccurrence = {
      ...base,
      needs_material_shipment: true,
      material_sent_date: "2026-11-10",
      material_arrived_date: "2026-11-16",
      needs_reinstallation: true,
      reinstallation_scheduled_at: localTs(2026, 11, 15),
    };
    const t = tratativaTimeline(occ, TODAY);
    expect(t.headline).toBe("Remarcar reinstalação");
    expect(t.tone).toBe("danger");
    expect(t.steps.find((s) => s.key === "reinstall")?.badge).toBe("remarcar");
    expect(stateOf(t, "reinstall")).toBe("late");
    expect(isReinstallBeforeMaterial(occ)).toBe(true);
  });

  it("reinstalação futura com material entregue: confirmada", () => {
    const t = tratativaTimeline(
      {
        ...base,
        needs_material_shipment: true,
        material_sent_date: "2026-11-10",
        material_arrived_date: "2026-11-14",
        needs_reinstallation: true,
        reinstallation_scheduled_at: localTs(2026, 11, 20, 9, 5),
      },
      TODAY,
    );
    expect(t.headline).toBe("Reinstalação confirmada · 20/11 às 09:05");
    expect(t.tone).toBe("success");
    expect(t.steps.find((s) => s.key === "reinstall")?.badge).toBe("confirmada");
  });

  it("reinstalação que já passou sem resolver: aguardando confirmação", () => {
    const t = tratativaTimeline(
      { ...base, needs_reinstallation: true, reinstallation_scheduled_at: localTs(2026, 11, 16) },
      TODAY,
    );
    expect(t.headline).toBe("Aguardando confirmação da reinstalação");
    expect(t.tone).toBe("warning");
    expect(stateOf(t, "reinstall")).toBe("done");
  });

  it("resolvida vence todas as regras", () => {
    const byStatus = tratativaTimeline({ ...base, status: "Resolvido", needs_material_shipment: true }, TODAY);
    expect(byStatus.headline).toBe("Resolvido");
    expect(byStatus.tone).toBe("success");
    expect(byStatus.nextStep).toBeNull();
    const byDate = tratativaTimeline(
      { ...base, resolved_at: localTs(2026, 11, 17), needs_material_shipment: true, material_sent_date: "2026-11-01", material_eta_date: "2026-11-05" },
      TODAY,
    );
    expect(byDate.headline).toBe("Resolvido");
    expect(stateOf(byDate, "arrived")).not.toBe("late");
  });

  it("datas sem hora não mudam de dia (armadilha de fuso)", () => {
    expect(formatDateOnlyBR("2026-11-18")).toBe("18/11/2026");
    expect(localTodayISO(new Date(2026, 10, 18, 23, 30))).toBe("2026-11-18");
    expect(localTodayISO(new Date(2026, 10, 18, 0, 5))).toBe("2026-11-18");
    const t = tratativaTimeline({ ...base, needs_material_shipment: true, material_sent_date: "2026-11-01" }, TODAY);
    expect(t.steps.find((s) => s.key === "sent")?.dateLabel).toBe("01/11/2026");
  });

  it("contagem da chegada", () => {
    const occ = { needs_material_shipment: true, material_sent_date: "2026-11-10" };
    expect(arrivalCountdownText({ ...occ, material_eta_date: "2026-11-21" }, TODAY)).toBe("Aguardando · faltam 3 dias");
    expect(arrivalCountdownText({ ...occ, material_eta_date: "2026-11-19" }, TODAY)).toBe("Aguardando · falta 1 dia");
    expect(arrivalCountdownText({ ...occ, material_eta_date: "2026-11-16" }, TODAY)).toBe("Atrasado 2 dias");
  });
});

describe("validateMaterialDates", () => {
  it("previsão antes do envio", () => {
    expect(validateMaterialDates({ sent: "2026-11-10", eta: "2026-11-09" }, TODAY)).toMatch(/previsão/i);
  });
  it("chegada antes do envio", () => {
    expect(validateMaterialDates({ sent: "2026-11-10", arrived: "2026-11-09" }, TODAY)).toMatch(/anterior/i);
  });
  it("chegada no futuro", () => {
    expect(validateMaterialDates({ arrived: "2026-11-19" }, TODAY)).toMatch(/futuro/i);
  });
  it("datas coerentes passam", () => {
    expect(validateMaterialDates({ sent: "2026-11-10", eta: "2026-11-12", arrived: TODAY }, TODAY)).toBeNull();
  });
});
