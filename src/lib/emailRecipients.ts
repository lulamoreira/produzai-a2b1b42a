// Shared helpers for handling multi-recipient email inputs.
// Recipients can be separated by comma, semicolon, newline, or whitespace.

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Split a free-form string into a deduped, lowercased list of recipient emails.
 * Splits on `,` `;` newlines and whitespace. Trims each entry.
 */
export function parseRecipients(input: string | null | undefined): string[] {
  if (!input) return [];
  const tokens = input
    .split(/[\s,;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(tokens));
}

export interface RecipientValidation {
  valid: string[];
  invalid: string[];
}

/**
 * Parse and validate a recipients string. Returns separated valid / invalid lists.
 * Empty input → both arrays empty (caller decides if that's an error).
 */
export function validateRecipients(input: string | null | undefined): RecipientValidation {
  const list = parseRecipients(input);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const e of list) {
    if (EMAIL_REGEX.test(e)) valid.push(e);
    else invalid.push(e);
  }
  return { valid, invalid };
}

/** Combine multiple recipient strings (e.g., to + cc) into a single deduped valid list. */
export function mergeRecipients(...inputs: (string | null | undefined)[]): RecipientValidation {
  const all: string[] = [];
  const invalid: string[] = [];
  for (const inp of inputs) {
    const r = validateRecipients(inp);
    all.push(...r.valid);
    invalid.push(...r.invalid);
  }
  return { valid: Array.from(new Set(all)), invalid: Array.from(new Set(invalid)) };
}

export function formatRecipientsForDisplay(list: string[]): string {
  return list.join(", ");
}
