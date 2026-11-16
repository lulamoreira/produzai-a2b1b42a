import { describe, expect, it } from "vitest";
import { hasScheduledDateAndTime } from "./installationSchedule";

describe("hasScheduledDateAndTime", () => {
  it("counts a normal schedule that has date and time", () => {
    expect(
      hasScheduledDateAndTime({ scheduled_date: "2026-05-12", scheduled_time: "22:00" })
    ).toBe(true);
  });

  it("does not count a schedule without a time (copied from a previous campaign)", () => {
    expect(hasScheduledDateAndTime({ scheduled_date: "2026-05-12" })).toBe(false);
    expect(hasScheduledDateAndTime({ scheduled_time: "22:00" })).toBe(false);
    expect(hasScheduledDateAndTime({})).toBe(false);
  });

  it("uses the reschedule pair when reschedule is enabled", () => {
    expect(
      hasScheduledDateAndTime({
        reschedule_enabled: true,
        reschedule_date: "2026-06-01",
        reschedule_time: "09:00",
      })
    ).toBe(true);

    // reschedule enabled but incomplete -> not shown, even with an original date/time
    expect(
      hasScheduledDateAndTime({
        reschedule_enabled: true,
        reschedule_date: "2026-06-01",
        scheduled_date: "2026-05-12",
        scheduled_time: "22:00",
      })
    ).toBe(false);
  });

  it("ignores the reschedule pair when reschedule is disabled", () => {
    expect(
      hasScheduledDateAndTime({
        reschedule_enabled: false,
        reschedule_date: "2026-06-01",
        reschedule_time: "09:00",
      })
    ).toBe(false);
  });
});

import { isVisiblePendingInstallation, latestCampaignIdsByChain } from "./installationSchedule";

describe("isVisiblePendingInstallation", () => {
  const base = { scheduled_date: "2026-11-20", scheduled_time: "08:00", completed_at: null };

  it("counts an open schedule with date and time", () => {
    expect(isVisiblePendingInstallation(base)).toBe(true);
  });

  it("does not count an empty schedule row (no date/time)", () => {
    expect(isVisiblePendingInstallation({ completed_at: null })).toBe(false);
  });

  it("does not count completed installations", () => {
    expect(isVisiblePendingInstallation({ ...base, completed_at: "2026-11-20T10:00:00Z" })).toBe(false);
  });

  it("does not count stores without logistics, treating missing type as frete_instalacao", () => {
    expect(isVisiblePendingInstallation({ ...base, client_stores: { tipo_entrega: "sem_logistica" } })).toBe(false);
    expect(isVisiblePendingInstallation({ ...base, client_stores: { tipo_entrega: null } })).toBe(true);
  });
});

describe("latestCampaignIdsByChain", () => {
  it("keeps only the newest campaign of each renegotiation chain", () => {
    const ids = latestCampaignIdsByChain([
      { id: "natal", root_campaign_id: null, created_at: "2026-09-01T00:00:00Z" },
      { id: "reneg1", root_campaign_id: "natal", created_at: "2026-10-01T00:00:00Z" },
      { id: "reneg2", root_campaign_id: "natal", created_at: "2026-11-01T00:00:00Z" },
      { id: "solo", root_campaign_id: null, created_at: "2026-08-01T00:00:00Z" },
    ]);
    expect([...ids].sort()).toEqual(["reneg2", "solo"]);
  });
});
