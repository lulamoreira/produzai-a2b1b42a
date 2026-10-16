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
  return statuses.find(s => s.value === value)?.conta_como_ocorrencia !== false &&
    !!occurrence.expected_resolution_date &&
    new Date(occurrence.expected_resolution_date).getTime() < now.getTime() &&
    value !== "resolvida" && value !== "nao_procede";
}