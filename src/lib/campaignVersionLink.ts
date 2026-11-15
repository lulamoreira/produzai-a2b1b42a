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

/**
 * Modules that only make sense on the newest campaign of a renegotiation chain
 * (field operation data). Opening them on an older version sends the user to
 * the newest campaign; every other module keeps opening on the chosen version.
 */
export const LATEST_ONLY_SECTIONS: ReadonlySet<string> = new Set([
  "scheduling",
  "installations",
  "loja_a_loja",
  "occurrences",
]);

export const LATEST_ONLY_SECTION_MESSAGE =
  "Esses módulos só são visualizados na versão mais recente dessa campanha";

export function isLatestOnlySection(section: string | null | undefined): boolean {
  return !!section && LATEST_ONLY_SECTIONS.has(section);
}

/**
 * State of a latest-only section on the opened campaign:
 * - "wait": the newest-campaign lookup has not answered yet (render nothing);
 * - "redirect": this is an older version, go to the newest one;
 * - "stay": not a latest-only section, already the newest, or unknown chain.
 */
export function latestOnlySectionState(args: {
  campaignId: string;
  latestId: string | null | undefined;
  latestLoading: boolean;
  section: string | null | undefined;
}): "wait" | "redirect" | "stay" {
  const { campaignId, latestId, latestLoading, section } = args;
  if (!isLatestOnlySection(section)) return "stay";
  if (latestLoading) return "wait";
  if (!latestId || latestId === campaignId) return "stay";
  return "redirect";
}

/** Same campaign path on the newest campaign, keeping ?section= and dropping the version marker. */
export function latestCampaignPath(args: {
  pathname: string;
  search: string;
  hash?: string;
  campaignId: string;
  latestId: string;
}): string {
  const { pathname, search, hash = "", campaignId, latestId } = args;
  const newPath = pathname.replace(`/campaigns/${campaignId}`, `/campaigns/${latestId}`);
  const params = new URLSearchParams(search);
  params.delete(EXPLICIT_VERSION_PARAM);
  const qs = params.toString();
  return `${newPath}${qs ? `?${qs}` : ""}${hash}`;
}
