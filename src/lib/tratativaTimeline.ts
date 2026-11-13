/**
 * Regra única da linha do tempo da tratativa (envio → chegada → reinstalação → resolvido).
 *
 * Usada pelo painel interno (OccurrenceDetailSheet), pelo portal do lojista
 * (OcorrenciasTab) e, por espelhamento em SQL, pelo Painel de Status. Nenhuma
 * tela deve calcular a situação por conta própria.
 *
 * ATENÇÃO A DATAS: material_sent_date / material_eta_date / material_arrived_date
 * são colunas `date` ("YYYY-MM-DD"). Nunca usar `new Date("YYYY-MM-DD")` com elas
 * (seria interpretado em UTC e viraria o dia anterior no Brasil). Comparamos como
 * string e formatamos quebrando a string. Já reinstallation_scheduled_at e
 * *_recorded_at são timestamptz e podem ser convertidos com `new Date()`.
 */

export type TimelineTone = "success" | "warning" | "danger" | "neutral";
export type TimelineStepState = "done" | "current" | "late" | "todo";
export type TimelineStepKey = "sent" | "arrived" | "reinstall" | "resolved";
export type ReinstallBadge = "prevista" | "confirmada" | "remarcar";

export interface TimelineOccurrence {
  status?: string | null;
  resolved_at?: string | null;
  needs_material_shipment?: boolean | null;
  material_sent_date?: string | null;
  material_eta_date?: string | null;
  material_arrived_date?: string | null;
  needs_reinstallation?: boolean | null;
  reinstallation_scheduled_at?: string | null;
  reinstallation_os?: string | null;
  material_sent_by_name?: string | null;
  material_sent_recorded_at?: string | null;
  material_arrived_by_name?: string | null;
  material_arrived_recorded_at?: string | null;
  reinstallation_by_name?: string | null;
  reinstallation_recorded_at?: string | null;
}

export interface TimelineStep {
  key: TimelineStepKey;
  label: string;
  state: TimelineStepState;
  /** Data já formatada para exibição (dd/mm/aaaa ou dd/mm/aaaa às hh:mm). */
  dateLabel: string | null;
  /** Data curta (dd/mm) para a versão compacta. */
  shortDateLabel: string | null;
  /** true quando a data exibida é uma previsão (ainda não aconteceu). */
  isForecast: boolean;
  /** Só na etapa Reinstalação. */
  badge?: ReinstallBadge;
  /** "Registrado por {nome} · dd/mm às hh:mm" quando houver. */
  recordedBy: string | null;
}

export interface TratativaTimeline {
  show: boolean;
  steps: TimelineStep[];
  headline: string;
  tone: TimelineTone;
  nextStep: string | null;
  isResolved: boolean;
}

// ---------------------------------------------------------------------------
// Datas (sem armadilha de fuso)
// ---------------------------------------------------------------------------

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const pad = (n: number) => String(n).padStart(2, "0");

/** "Hoje" no fuso LOCAL do navegador, como "YYYY-MM-DD". */
export function localTodayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Normaliza para "YYYY-MM-DD" ou null (aceita valores com sufixo, ex. "2026-11-18T00:00"). */
export function normalizeDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = DATE_ONLY_RE.exec(value.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** "2026-11-18" → "18/11/2026" (quebrando a string). */
export function formatDateOnlyBR(value: string | null | undefined): string | null {
  const d = normalizeDateOnly(value);
  if (!d) return null;
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

/** "2026-11-18" → "18/11". */
export function formatDayMonth(value: string | null | undefined): string | null {
  const d = normalizeDateOnly(value);
  if (!d) return null;
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

/** Diferença em dias inteiros (b − a) entre duas datas "YYYY-MM-DD". */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Data local ("YYYY-MM-DD") de um timestamp (timestamptz). */
export function timestampLocalDate(value: string | null | undefined): string | null {
  const d = parseTimestamp(value);
  return d ? localTodayISO(d) : null;
}

/** timestamp → "dd/mm às hh:mm" (horário local). */
export function formatTimestampShort(value: string | null | undefined): string | null {
  const d = parseTimestamp(value);
  if (!d) return null;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** timestamp → "dd/mm/aaaa às hh:mm" (horário local). */
export function formatTimestampLong(value: string | null | undefined): string | null {
  const d = parseTimestamp(value);
  if (!d) return null;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function recordedByText(name: string | null | undefined, at: string | null | undefined): string | null {
  const n = name?.trim();
  if (!n) return null;
  const when = formatTimestampShort(at);
  return when ? `Registrado por ${n} · ${when}` : `Registrado por ${n}`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// ---------------------------------------------------------------------------
// Situação
// ---------------------------------------------------------------------------

export function isOccurrenceResolved(o: TimelineOccurrence): boolean {
  const s = (o.status ?? "").trim().toLowerCase();
  return s === "resolvido" || s === "resolvida" || !!o.resolved_at;
}

/** Contagem regressiva da chegada (para "Aguardando · faltam N dias" / "Atrasado N dia(s)"). */
export function arrivalCountdown(
  o: TimelineOccurrence,
  today: string,
): { kind: "arrived" | "late" | "waiting" | "unknown"; days: number } {
  if (normalizeDateOnly(o.material_arrived_date)) return { kind: "arrived", days: 0 };
  const eta = normalizeDateOnly(o.material_eta_date);
  if (!eta) return { kind: "unknown", days: 0 };
  if (eta < today) return { kind: "late", days: daysBetween(eta, today) };
  return { kind: "waiting", days: daysBetween(today, eta) };
}

export function arrivalCountdownText(o: TimelineOccurrence, today: string): string | null {
  const c = arrivalCountdown(o, today);
  if (c.kind === "arrived") return null;
  if (c.kind === "late") return `Atrasado ${c.days} ${plural(c.days, "dia", "dias")}`;
  if (c.kind === "waiting") {
    if (c.days === 0) return "Aguardando · chega hoje";
    return `Aguardando · ${plural(c.days, "falta", "faltam")} ${c.days} ${plural(c.days, "dia", "dias")}`;
  }
  return "Aguardando";
}

/**
 * true quando a reinstalação está marcada para um dia anterior à chegada
 * (real ou prevista) do material. Usado como aviso no painel interno.
 */
export function isReinstallBeforeMaterial(o: TimelineOccurrence): boolean {
  if (!o.needs_material_shipment || !o.needs_reinstallation) return false;
  const reinst = timestampLocalDate(o.reinstallation_scheduled_at);
  if (!reinst) return false;
  const ref = normalizeDateOnly(o.material_arrived_date) ?? normalizeDateOnly(o.material_eta_date);
  return !!ref && reinst < ref;
}

/** Validação das datas de material antes de salvar. Retorna a mensagem de erro ou null. */
export function validateMaterialDates(
  d: { sent?: string | null; eta?: string | null; arrived?: string | null },
  today: string,
): string | null {
  const sent = normalizeDateOnly(d.sent);
  const eta = normalizeDateOnly(d.eta);
  const arrived = normalizeDateOnly(d.arrived);
  if (sent && eta && eta < sent) return "A previsão de chegada não pode ser anterior à data do envio.";
  if (sent && arrived && arrived < sent) return "A chegada não pode ser anterior à data do envio.";
  if (arrived && arrived > today) return "A data de chegada não pode estar no futuro.";
  return null;
}

export function tratativaTimeline(o: TimelineOccurrence, today: string): TratativaTimeline {
  const needsMaterial = !!o.needs_material_shipment;
  const needsReinst = !!o.needs_reinstallation;
  const resolved = isOccurrenceResolved(o);

  if (!needsMaterial && !needsReinst) {
    return { show: false, steps: [], headline: "", tone: "neutral", nextStep: null, isResolved: resolved };
  }

  const sent = needsMaterial ? normalizeDateOnly(o.material_sent_date) : null;
  const eta = needsMaterial ? normalizeDateOnly(o.material_eta_date) : null;
  const arrived = needsMaterial ? normalizeDateOnly(o.material_arrived_date) : null;
  const reinstAt = needsReinst ? o.reinstallation_scheduled_at ?? null : null;
  const reinstDate = timestampLocalDate(reinstAt);
  const materialOk = !needsMaterial || !!arrived;
  const etaLate = needsMaterial && !!sent && !arrived && !!eta && eta < today;
  const mustReschedule = needsReinst && needsMaterial && !!arrived && !!reinstDate && reinstDate < arrived;
  const reinstPassed = !!reinstDate && reinstDate < today;

  // ---- Etapas ------------------------------------------------------------
  const steps: TimelineStep[] = [];
  if (needsMaterial) {
    steps.push({
      key: "sent",
      label: "Material enviado",
      state: sent ? "done" : "todo",
      dateLabel: formatDateOnlyBR(sent),
      shortDateLabel: formatDayMonth(sent),
      isForecast: false,
      recordedBy: sent ? recordedByText(o.material_sent_by_name, o.material_sent_recorded_at) : null,
    });
    steps.push({
      key: "arrived",
      label: "Chegada na loja",
      state: arrived ? "done" : etaLate && !resolved ? "late" : "todo",
      dateLabel: arrived ? formatDateOnlyBR(arrived) : formatDateOnlyBR(eta),
      shortDateLabel: arrived ? formatDayMonth(arrived) : formatDayMonth(eta),
      isForecast: !arrived && !!eta,
      recordedBy: arrived ? recordedByText(o.material_arrived_by_name, o.material_arrived_recorded_at) : null,
    });
  }
  if (needsReinst) {
    let badge: ReinstallBadge | undefined;
    if (reinstAt) {
      if (mustReschedule) badge = "remarcar";
      else if (needsMaterial && !arrived) badge = "prevista";
      else badge = "confirmada";
    }
    let state: TimelineStepState = "todo";
    if (mustReschedule && !resolved) state = "late";
    else if (reinstAt && materialOk && reinstPassed) state = "done";
    steps.push({
      key: "reinstall",
      label: "Reinstalação",
      state,
      dateLabel: formatTimestampLong(reinstAt),
      shortDateLabel: formatTimestampShort(reinstAt),
      isForecast: !!reinstAt && state !== "done",
      badge,
      recordedBy: reinstAt ? recordedByText(o.reinstallation_by_name, o.reinstallation_recorded_at) : null,
    });
  }
  const resolvedDate = timestampLocalDate(o.resolved_at);
  steps.push({
    key: "resolved",
    label: "Resolvido",
    state: resolved ? "done" : "todo",
    dateLabel: formatDateOnlyBR(resolvedDate),
    shortDateLabel: formatDayMonth(resolvedDate),
    isForecast: false,
    recordedBy: null,
  });

  // A primeira etapa não concluída vira a "atual" (se já não estiver atrasada).
  if (!resolved) {
    const idx = steps.findIndex((s) => s.state !== "done");
    if (idx >= 0 && steps[idx].state === "todo") steps[idx] = { ...steps[idx], state: "current" };
  }

  // ---- Headline / tom / próximo passo (primeira regra que casar) ---------
  let headline: string;
  let tone: TimelineTone;
  let nextStep: string | null;

  if (resolved) {
    headline = "Resolvido";
    tone = "success";
    nextStep = null;
  } else if (needsMaterial && !sent) {
    headline = "Aguardando envio do material";
    tone = "warning";
    nextStep = "Próximo passo: a equipe responsável enviar o material para a loja.";
  } else if (etaLate) {
    const n = daysBetween(eta!, today);
    headline = `Material atrasado ${n} ${plural(n, "dia", "dias")}`;
    tone = "danger";
    nextStep = `Próximo passo: confirmar a chegada do material na loja (previsto para ${formatDayMonth(eta)}).`;
    if (needsReinst && reinstAt) nextStep += " A reinstalação pode precisar ser remarcada.";
  } else if (needsMaterial && !arrived) {
    headline = eta ? `Material a caminho · chega ${formatDayMonth(eta)}` : "Material a caminho";
    tone = "warning";
    nextStep = eta
      ? `Próximo passo: confirmar a chegada do material na loja (previsto para ${formatDayMonth(eta)}).`
      : "Próximo passo: confirmar a chegada do material na loja.";
  } else if (needsMaterial && arrived && !needsReinst) {
    headline = "Material entregue na loja";
    tone = "success";
    nextStep = "Próximo passo: a equipe responsável concluir a tratativa.";
  } else if (needsReinst && !reinstAt) {
    headline = "Agendar reinstalação";
    tone = needsMaterial && arrived ? "danger" : "warning";
    nextStep = "Próximo passo: a equipe responsável agendar a reinstalação.";
  } else if (mustReschedule) {
    headline = "Remarcar reinstalação";
    tone = "danger";
    nextStep = `Próximo passo: a equipe responsável remarcar a reinstalação para depois da chegada do material (${formatDayMonth(arrived)}).`;
  } else if (needsReinst && reinstAt && materialOk) {
    if (reinstPassed) {
      headline = "Aguardando confirmação da reinstalação";
      tone = "warning";
      nextStep = "Próximo passo: a equipe responsável confirmar a reinstalação e concluir a tratativa.";
    } else {
      headline = `Reinstalação confirmada · ${formatTimestampShort(reinstAt)}`;
      tone = "success";
      nextStep = `Próximo passo: reinstalação na loja em ${formatTimestampShort(reinstAt)}.`;
    }
  } else {
    headline = "Em tratativa";
    tone = "neutral";
    nextStep = null;
  }

  return { show: true, steps, headline, tone, nextStep, isResolved: resolved };
}
