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
