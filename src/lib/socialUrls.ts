// Normalization + validation helpers for supplier social handles/URLs.
// Accepts full URLs, bare domains, or @handles and returns a full https URL.

export type SocialNetwork = "instagram" | "linkedin" | "facebook";

const HOSTS: Record<SocialNetwork, string> = {
  instagram: "instagram.com",
  linkedin: "linkedin.com",
  facebook: "facebook.com",
};

const HANDLE_RE = /^[A-Za-z0-9._-]{1,60}$/;

/**
 * Normalize a user-entered value into a full https URL.
 * - "@fulano" or "fulano" → https://instagram.com/fulano (for Instagram)
 * - "instagram.com/fulano" → https://instagram.com/fulano
 * - "https://..." kept as-is (trimmed)
 * Returns "" for empty input, or null if it can't be normalized.
 */
export function normalizeSocialUrl(
  network: SocialNetwork,
  raw: string,
): string | null {
  const value = (raw ?? "").trim();
  if (!value) return "";

  // Already looks like a URL
  if (/^https?:\/\//i.test(value)) {
    try {
      const u = new URL(value);
      if (!u.hostname) return null;
      return u.toString().replace(/\/$/, "");
    } catch {
      return null;
    }
  }

  // Starts with the host (no scheme)
  const lowered = value.toLowerCase();
  const host = HOSTS[network];
  if (lowered.startsWith(host) || lowered.startsWith(`www.${host}`)) {
    try {
      const u = new URL(`https://${value}`);
      return u.toString().replace(/\/$/, "");
    } catch {
      return null;
    }
  }

  // Handle form: "@user" or "user" — LinkedIn defaults to /in/{user}
  const handle = value.replace(/^@/, "").replace(/^\/+/, "");
  if (!HANDLE_RE.test(handle)) return null;

  const path = network === "linkedin" ? `in/${handle}` : handle;
  return `https://${host}/${path}`;
}

/**
 * True when the value is empty OR a valid https URL pointing to the
 * expected host. Use on blur / before submit.
 */
export function isValidSocialUrl(network: SocialNetwork, raw: string): boolean {
  const value = (raw ?? "").trim();
  if (!value) return true;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    return host === HOSTS[network] || host.endsWith(`.${HOSTS[network]}`);
  } catch {
    return false;
  }
}

export const SOCIAL_ERROR_MESSAGE: Record<SocialNetwork, string> = {
  instagram: "Instagram inválido. Use @usuario ou uma URL do instagram.com.",
  linkedin: "LinkedIn inválido. Use uma URL do linkedin.com ou um usuário.",
  facebook: "Facebook inválido. Use uma URL do facebook.com ou um usuário.",
};
