import { z } from "zod";

export const executionImportDefaults = { schedules: true, photos: false };
export const executionImportSummarySchema = z.object({
  schedules_imported: z.number().int().nonnegative(),
  schedules_skipped: z.number().int().nonnegative(),
  teams_created: z.number().int().nonnegative(),
  teams_reused: z.number().int().nonnegative(),
  photos_imported: z.number().int().nonnegative(),
});
export type ExecutionImportSummary = z.infer<typeof executionImportSummarySchema>;

export function defaultExecutionSource(current: { root_campaign_id: string | null; parent_campaign_id: string | null }, availableIds: string[]) {
  const preferred = current.root_campaign_id || current.parent_campaign_id;
  return preferred && availableIds.includes(preferred) ? preferred : "";
}