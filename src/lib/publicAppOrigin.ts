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
const PRODUCTION_HOST = "produzai.lovable.app";

// Domínios Lovable de preview/sandbox que NÃO devem ser usados em links
// compartilhados externamente. Qualquer host nesses domínios (exceto o de
// produção) é trocado pelo PRODUCTION_ORIGIN.
const LOVABLE_INTERNAL_DOMAINS = [
  ".lovable.app",
  ".lovable.dev",
  ".lovableproject.com",
  ".sandbox.lovable.dev",
];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

export function getPublicAppOrigin(): string {
  if (typeof window === "undefined") return PRODUCTION_ORIGIN;
  try {
    const { hostname, origin } = window.location;
    if (hostname === PRODUCTION_HOST) return origin;
    if (LOCAL_HOSTS.has(hostname)) return PRODUCTION_ORIGIN;
    if (LOVABLE_INTERNAL_DOMAINS.some((d) => hostname.endsWith(d))) {
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
