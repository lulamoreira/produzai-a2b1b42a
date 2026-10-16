import { parseLocalDate } from "./dateHelpers";

export interface LalOverdueOccurrence {
  tratativa_status?: string | null;
  expected_resolution_date?: string | null;
}

export interface LalOverdueStatus {
  value: string;
  is_resolved?: boolean;
  conta_como_ocorrencia?: boolean;
}

export function isLalOccurrenceOverdue(
  occurrence: LalOverdueOccurrence,
  statuses: readonly LalOverdueStatus[],
  now = new Date(),
): boolean {
  const value = occurrence.tratativa_status ?? "aberta";
  const status = statuses.find(s => s.value === value);
  // Preserve built-in exclusions even while client statuses are loading.
  if (["resolvida", "nao_procede", "ocorrencia_duplicada"].includes(value) ||
    status?.is_resolved || status?.conta_como_ocorrencia === false) return false;

  const deadline = parseLocalDate(occurrence.expected_resolution_date);
  if (!deadline) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return deadline.getTime() < today.getTime();
}