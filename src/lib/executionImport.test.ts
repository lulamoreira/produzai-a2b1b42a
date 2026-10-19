import { describe, expect, it } from "vitest";
import { defaultExecutionSource, executionImportDefaults, executionImportSummarySchema } from "./executionImport";

describe("campaign execution import", () => {
  it("enables scheduling by default", () => expect(executionImportDefaults.schedules).toBe(true));
  it("disables photos by default", () => expect(executionImportDefaults.photos).toBe(false));
  it("prefers the root over the parent", () => expect(defaultExecutionSource({ root_campaign_id: "root", parent_campaign_id: "parent" }, ["root", "parent"])).toBe("root"));
  it("falls back to the parent when no root exists", () => expect(defaultExecutionSource({ root_campaign_id: null, parent_campaign_id: "parent" }, ["parent"])).toBe("parent"));
  it("leaves selection empty without ancestry", () => expect(defaultExecutionSource({ root_campaign_id: null, parent_campaign_id: null }, ["other"])).toBe(""));
  it("does not preselect an inaccessible campaign", () => expect(defaultExecutionSource({ root_campaign_id: "hidden", parent_campaign_id: "parent" }, ["parent"])).toBe(""));
  it("validates concrete import counts", () => {
    expect(executionImportSummarySchema.parse({ schedules_imported: 3, schedules_skipped: 2, teams_created: 1, teams_reused: 4, photos_imported: 0 }).schedules_skipped).toBe(2);
    expect(executionImportSummarySchema.safeParse({ schedules_imported: -1 }).success).toBe(false);
  });
});