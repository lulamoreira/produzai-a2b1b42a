/**
 * Returns the canonical public origin for shareable links
 * (e.g. recotação, ocorrências, convites).
 *
 * Em ambientes de preview / sandbox da Lovable o `window.location.origin`
 * aponta para um host efêmero (`id-preview--*.lovable.app`,
 * `*.sandbox.lovable.dev`, etc.) que não é acessível para terceiros.
 * Para que links enviados a fornecedores/lojas funcionem mesmo quando
 * gerados de dentro do preview, trocamos esses hosts pelo domínio
 * publicado oficial.
 */
const PRODUCTION_ORIGIN = "https://produzai.lovable.app";

const PREVIEW_HOST_PATTERNS = [
  /^id-preview--/i,
  /\.sandbox\.lovable\.dev$/i,
  /\.lovableproject\.com$/i,
  /^localhost$/i,
  /^127\.0\.0\.1$/,
];

export function getPublicAppOrigin(): string {
  if (typeof window === "undefined") return PRODUCTION_ORIGIN;
  try {
    const { hostname, origin } = window.location;
    if (PREVIEW_HOST_PATTERNS.some((re) => re.test(hostname))) {
      return PRODUCTION_ORIGIN;
    }
    return origin;
  } catch {
    return PRODUCTION_ORIGIN;
  }
}

export function buildPublicAppUrl(path: string): string {
  const origin = getPublicAppOrigin();
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}
