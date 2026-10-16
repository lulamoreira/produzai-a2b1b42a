import { describe, expect, it } from "vitest";
import { isLalOccurrenceOverdue } from "./lalOccurrenceOverdue";

const today = new Date(2026, 9, 16, 8, 53);
const statuses = [
  { value: "ocorrencia_duplicada", is_resolved: true, conta_como_ocorrencia: true },
  { value: "encerrada", is_resolved: true, conta_como_ocorrencia: true },
  { value: "ignorada", is_resolved: false, conta_como_ocorrencia: false },
];

describe("Loja a Loja overdue occurrences", () => {
  it("excludes both duplicate occurrences from the screenshot despite their past deadlines", () => {
    const occurrences = ["2026-10-09", "2026-10-08"].map(expected_resolution_date => ({
      tratativa_status: "ocorrencia_duplicada", expected_resolution_date,
    }));
    expect(occurrences.filter(o => isLalOccurrenceOverdue(o, statuses, today))).toHaveLength(0);
  });

  it("does not classify duplicate statuses as overdue before custom statuses load", () => {
    expect(isLalOccurrenceOverdue({ tratativa_status: "ocorrencia_duplicada", expected_resolution_date: "2026-10-09" }, [], today)).toBe(false);
  });

  it("honors configured resolved statuses", () => {
    expect(isLalOccurrenceOverdue({ tratativa_status: "encerrada", expected_resolution_date: "2026-10-09" }, statuses, today)).toBe(false);
  });

  it("keeps overdue open occurrences counted", () => {
    expect(isLalOccurrenceOverdue({ tratativa_status: "em_andamento", expected_resolution_date: "2026-10-15" }, statuses, today)).toBe(true);
  });

  it("does not mark a deadline today as overdue", () => {
    expect(isLalOccurrenceOverdue({ tratativa_status: "em_andamento", expected_resolution_date: "2026-10-16" }, statuses, today)).toBe(false);
  });

  it("excludes statuses that do not count as occurrences", () => {
    expect(isLalOccurrenceOverdue({ tratativa_status: "ignorada", expected_resolution_date: "2026-10-09" }, statuses, today)).toBe(false);
  });

  it.each(["resolvida", "nao_procede"])("keeps %s excluded", tratativa_status => {
    expect(isLalOccurrenceOverdue({ tratativa_status, expected_resolution_date: "2026-10-09" }, [], today)).toBe(false);
  });

  it.each([null, "invalid", "2026-10-17"])("does not count missing, invalid, or future dates (%s)", expected_resolution_date => {
    expect(isLalOccurrenceOverdue({ tratativa_status: "aberta", expected_resolution_date }, statuses, today)).toBe(false);
  });
});