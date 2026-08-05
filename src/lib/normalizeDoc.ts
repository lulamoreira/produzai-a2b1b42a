/**
 * Document normalization helpers for blocked installers.
 */

/**
 * CPF: Keep only digits (0-9).
 */
export function normCpf(v: string | null | undefined): string {
  if (!v) return "";
  return v.replace(/\D/g, "");
}

/**
 * RG: Remove everything that is not alphanumeric and convert to UPPERCASE.
 */
export function normRg(v: string | null | undefined): string {
  if (!v) return "";
  // Keep only letters and numbers, then uppercase.
  return v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * Generic helper to check if a document is normalized and present.
 */
export function hasDoc(v: string | null | undefined): boolean {
  if (!v) return false;
  return v.trim().length > 0;
}
