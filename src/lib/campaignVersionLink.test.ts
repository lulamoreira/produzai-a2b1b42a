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

import { latestOnlySectionState, latestCampaignPath, isLatestOnlySection } from "./campaignVersionLink";

describe("latest-only modules on older campaign versions", () => {
  const base = { campaignId: "orig", latestId: "reneg2", latestLoading: false };

  it("Agendamento, Instalações, Loja a Loja e Ocorrências redirect from an older version", () => {
    for (const section of ["scheduling", "installations", "loja_a_loja", "occurrences"]) {
      expect(latestOnlySectionState({ ...base, section })).toBe("redirect");
    }
  });

  it("other modules keep opening on the chosen version", () => {
    for (const section of ["budgets", "mockup", "pieces", "matrix", "summary", "stores", "briefing", "adjustments", "history", "approvals", null]) {
      expect(latestOnlySectionState({ ...base, section })).toBe("stay");
    }
  });

  it("waits while the newest campaign is still unknown", () => {
    expect(latestOnlySectionState({ ...base, latestId: undefined, latestLoading: true, section: "installations" })).toBe("wait");
  });

  it("the newest campaign never redirects (no loop)", () => {
    expect(latestOnlySectionState({ ...base, campaignId: "reneg2", section: "installations" })).toBe("stay");
    expect(latestOnlySectionState({ ...base, latestId: null, section: "installations" })).toBe("stay");
  });

  it("builds the newest path keeping section and dropping versao=anterior", () => {
    expect(latestCampaignPath({
      pathname: "/agency/a/clients/c/campaigns/orig",
      search: "?section=installations&versao=anterior",
      campaignId: "orig",
      latestId: "reneg2",
    })).toBe("/agency/a/clients/c/campaigns/reneg2?section=installations");
    expect(isLatestOnlySection("loja_a_loja")).toBe(true);
  });
});
