import { format } from "date-fns";

/**
 * Parse a YYYY-MM-DD or full ISO string to a LOCAL Date (no UTC shift).
 * - For YYYY-MM-DD strings, returns Date at local midnight that day.
 * - For full ISO strings (with time), returns the local equivalent.
 */
export function parseLocalDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  if (dateOnly.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  // Local datetime without timezone marker: "YYYY-MM-DDTHH:mm[:ss]"
  const localDt = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
  const m = value.match(localDt);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? "0"), 0);
  }
  const dt = new Date(value);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Format a Date as YYYY-MM-DD (local, no UTC shift) */
export function formatLocalDate(date: Date | null | undefined): string {
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
}

/** Format a Date as YYYY-MM-DDTHH:mm (local datetime, no Z) */
export function formatLocalDateTime(date: Date | null | undefined): string {
  if (!date) return "";
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Build an ISO string preserving local wall-clock with explicit timezone offset.
 * Example: "2026-05-08T18:00:00-03:00".
 * This ensures TIMESTAMPTZ columns round-trip without drift.
 */
export function toLocalISOString(date: Date | null | undefined): string {
  if (!date) return "";
  return format(date, "yyyy-MM-dd'T'HH:mm:ssXXX");
}
