/**
 * Explicit links to an older campaign of a renegotiation chain.
 *
 * Old/bookmarked links to a superseded campaign are redirected to the newest
 * campaign of the chain. Deliberate clicks ("Ver campanha original", cards in
 * the client's campaign list) carry this marker so the redirect is skipped
 * whenever the user can actually open that version.
 */
export const EXPLICIT_VERSION_PARAM = "versao";
export const EXPLICIT_VERSION_VALUE = "anterior";

/** Appends the explicit-version marker to a campaign path. */
export function explicitCampaignVersionPath(path: string): string {
  const [base, hash = ""] = path.split("#");
  const [pathname, query = ""] = base.split("?");
  const params = new URLSearchParams(query);
  params.set(EXPLICIT_VERSION_PARAM, EXPLICIT_VERSION_VALUE);
  return `${pathname}?${params.toString()}${hash ? `#${hash}` : ""}`;
}

/** True when the URL search string asks to stay on the opened version. */
export function isExplicitCampaignVersion(search: string): boolean {
  return new URLSearchParams(search).get(EXPLICIT_VERSION_PARAM) === EXPLICIT_VERSION_VALUE;
}

/**
 * Decides whether an opened campaign must be redirected to the newest one.
 * - Already the newest (or unknown): stay.
 * - Explicit version click: stay while the campaign is still loading or loaded;
 *   redirect only when the user cannot open it (no access).
 * - Plain old link: redirect.
 */
export function shouldRedirectToLatest(args: {
  campaignId: string;
  latestId: string | null | undefined;
  explicit: boolean;
  campaignLoading: boolean;
  campaignLoaded: boolean;
}): boolean {
  const { campaignId, latestId, explicit, campaignLoading, campaignLoaded } = args;
  if (!latestId || latestId === campaignId) return false;
  if (!explicit) return true;
  if (campaignLoading) return false;
  return !campaignLoaded;
}
