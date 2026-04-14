/**
 * Parse a date-only string (YYYY-MM-DD) into a local-midnight Date,
 * avoiding the UTC-parse pitfall of `new Date("YYYY-MM-DD")`.
 */
export function parseLocalDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

/** Today at local midnight (00:00:00.000) */
export function todayLocalMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Check if an occurrence is overdue:
 * status is not resolved/nao_procede AND expected_resolution_date < today (strictly before).
 */
export function isOccurrenceOverdue(
  expectedDate: string | null | undefined,
  status?: string | null,
): boolean {
  if (!expectedDate) return false;
  if (status && RESOLVED_STATUS_VALUES.has(status)) return false;
  const parsed = parseLocalDate(expectedDate);
  if (!parsed) return false;
  return parsed < todayLocalMidnight();
}

/**
 * Format a date-only string (YYYY-MM-DD) to dd/MM/yyyy for display,
 * without timezone shift issues.
 */
export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return dateStr;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Minimal status shape needed by helper functions */
type StatusLike = { value: string; label: string; color: string; is_default?: boolean };

/**
 * Determines the set of "resolved" status values dynamically from the DB.
 * Statuses with value "resolved" or "nao_procede" are considered resolved.
 * This is the single source of truth — no hardcoding elsewhere.
 */
export const RESOLVED_STATUS_VALUES = new Set(["resolved", "nao_procede"]);

/** Check if a status value is considered resolved/closed */
export function isResolvedStatus(statusValue: string | null | undefined): boolean {
  if (!statusValue) return false;
  const normalized = statusValue.trim().toLowerCase();
  // Handle legacy values
  if (normalized === "rejected" || normalized === "rejeitada") return true;
  return RESOLVED_STATUS_VALUES.has(normalized);
}

/**
 * Compute per-store occurrence status from a list of occurrences.
 * Returns a map: storeId → { hasOccurrence, allResolved, count }
 */
export function computeStoreOccurrenceStatus(
  occurrences: { store_id: string | null; status: string | null }[]
): Record<string, { hasOccurrence: boolean; allResolved: boolean; count: number }> {
  const map: Record<string, { hasOccurrence: boolean; allResolved: boolean; count: number }> = {};
  occurrences.forEach((occ) => {
    if (!occ.store_id) return;
    if (!map[occ.store_id]) map[occ.store_id] = { hasOccurrence: false, allResolved: true, count: 0 };
    map[occ.store_id].hasOccurrence = true;
    map[occ.store_id].count++;
    if (!isResolvedStatus(occ.status)) {
      map[occ.store_id].allResolved = false;
    }
  });
  return map;
}

/** Get status label from status list */
export function getStatusLabel(statuses: StatusLike[], value: string): string {
  return statuses.find((s) => s.value === value)?.label || value;
}

/** Get status color from status list */
export function getStatusColor(statuses: StatusLike[], value: string): string {
  return statuses.find((s) => s.value === value)?.color || "#6366f1";
}

/** Get default status value from status list */
export function getDefaultStatusValue(statuses: StatusLike[]): string {
  return statuses.find((s) => s.is_default)?.value || "pending";
}

/** Normalize whitespace for comparison (collapse multiple spaces) */
export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Build grouped piece options filtered by location */
export function buildGroupedPieceOptions<
  P extends { id: string; category: string; kit_only: boolean; [key: string]: any },
  K extends { id: string; code: number; name: string; [key: string]: any },
  KP extends { kit_id: string; piece_id: string },
>(
  locationFilter: string,
  pieces: P[],
  kits: K[],
  kitPieces: KP[],
) {
  const normFilter = normalizeWhitespace(locationFilter);
  const filteredPieces = locationFilter
    ? pieces.filter((p) => normalizeWhitespace(p.category) === normFilter)
    : pieces;
  const kitPieceIds = new Set(kitPieces.map((kp) => kp.piece_id));
  const standalonePieces = filteredPieces.filter((p) => !p.kit_only && !kitPieceIds.has(p.id));

  const kitItems = kits
    .map((kit) => {
      const memberPieceIds = kitPieces.filter((kp) => kp.kit_id === kit.id).map((kp) => kp.piece_id);
      const memberPieces = filteredPieces.filter((p) => memberPieceIds.includes(p.id));
      if (memberPieces.length === 0) return null;
      return { kit, memberPieces };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  return { standalonePieces, kitItems };
}
