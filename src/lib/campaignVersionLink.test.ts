import { describe, it, expect } from "vitest";
import { explicitCampaignVersionPath, isExplicitCampaignVersion, shouldRedirectToLatest } from "./campaignVersionLink";

describe("explicit campaign version links", () => {
  it("marks the path and keeps existing query/hash", () => {
    const p = explicitCampaignVersionPath("/agency/a/clients/c/campaigns/x?section=pieces#top");
    expect(p).toBe("/agency/a/clients/c/campaigns/x?section=pieces&versao=anterior#top");
    expect(isExplicitCampaignVersion("?section=pieces&versao=anterior")).toBe(true);
    expect(isExplicitCampaignVersion("?section=pieces")).toBe(false);
  });

  it("'Ver campanha original' stays on the original when the user can open it", () => {
    expect(shouldRedirectToLatest({ campaignId: "orig", latestId: "reneg2", explicit: true, campaignLoading: false, campaignLoaded: true })).toBe(false);
  });

  it("an explicit click still goes to the newest when the user has no access to the original", () => {
    expect(shouldRedirectToLatest({ campaignId: "orig", latestId: "reneg2", explicit: true, campaignLoading: false, campaignLoaded: false })).toBe(true);
  });

  it("old links without the marker keep redirecting to the newest", () => {
    expect(shouldRedirectToLatest({ campaignId: "orig", latestId: "reneg2", explicit: false, campaignLoading: true, campaignLoaded: false })).toBe(true);
  });

  it("the newest campaign never redirects", () => {
    expect(shouldRedirectToLatest({ campaignId: "reneg2", latestId: "reneg2", explicit: false, campaignLoading: false, campaignLoaded: true })).toBe(false);
  });
});
