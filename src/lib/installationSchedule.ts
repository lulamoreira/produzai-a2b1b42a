/**
 * A campaign schedule only becomes an installation the user can actually see
 * when it has BOTH a date and a time. When `reschedule_enabled` is on, the
 * reschedule pair is the one that counts — same rule the Installations screen
 * uses to build its store list.
 *
 * Rows without them (typically copied from a previous campaign) must never be
 * counted as stores, pendings, check-ins or confirmed schedules anywhere.
 */
export interface InstallationScheduleLike {
  reschedule_enabled?: boolean | null;
  reschedule_date?: string | null;
  reschedule_time?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
}

export function hasScheduledDateAndTime(s: InstallationScheduleLike): boolean {
  if (s.reschedule_enabled) {
    return !!(s.reschedule_date && s.reschedule_time);
  }
  return !!(s.scheduled_date && s.scheduled_time);
}
