// ─── Pure helpers for scheduling preference logic ──────────
// Extracted so they can be unit-tested independently of React/UI.

type PreferenceLike = {
  installation_preference?: string | null;
  reschedule_preference?: string | null;
};

/**
 * Resolve which preference value should be displayed.
 * - When NOT in reschedule mode: use installation_preference, fallback to "not_informed".
 * - When in reschedule mode: prefer reschedule_preference, fallback to installation_preference,
 *   then to "not_informed". This guarantees the original preference is preserved when
 *   activating rescheduling and the user has not yet chosen a different one.
 */
export function resolveEffectivePreference(
  schedule: PreferenceLike | null | undefined,
  isReschedule: boolean,
): string {
  if (isReschedule) {
    return (
      schedule?.reschedule_preference ||
      schedule?.installation_preference ||
      "not_informed"
    );
  }
  return schedule?.installation_preference || "not_informed";
}

/**
 * Build the partial update payload when the user toggles the rescheduling switch.
 * - Enabling: inherits the original installation_preference if no reschedule
 *   preference was set yet — so the UI does NOT flip to "Não informado".
 * - Disabling: clears all reschedule-related fields and resets preference.
 */
export function buildRescheduleToggleUpdates(
  schedule: PreferenceLike | null | undefined,
  enabled: boolean,
): Record<string, any> {
  const updates: Record<string, any> = { reschedule_enabled: enabled };

  if (enabled) {
    updates.reschedule_preference =
      schedule?.reschedule_preference ||
      schedule?.installation_preference ||
      "not_informed";
  } else {
    updates.reschedule_date = null;
    updates.reschedule_time = null;
    updates.reschedule_os = null;
    updates.reschedule_preference = "not_informed";
    updates.reschedule_store_approval_status = "under_review";
    updates.reschedule_store_approved_at = null;
    updates.reschedule_team_approval_status = "under_review";
    updates.reschedule_team_approved_at = null;
    updates.reschedule_responsibility = null;
    updates.reschedule_responsibility_at = null;
    updates.reschedule_suggested_date = null;
    updates.reschedule_suggested_time = null;
    updates.reschedule_suggested_date_2 = null;
    updates.reschedule_suggested_time_2 = null;
  }

  return updates;
}
