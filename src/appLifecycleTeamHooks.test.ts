import { describe, expect, it } from "vitest";
import { teamBusinessRefreshDelay } from "./appLifecycleTeamHooks";

describe("team business refresh retry", () => {
  it("backs off repeated failures and caps the retry delay", () => {
    expect(teamBusinessRefreshDelay(0)).toBe(5_000);
    expect(teamBusinessRefreshDelay(1)).toBe(10_000);
    expect(teamBusinessRefreshDelay(2)).toBe(20_000);
    expect(teamBusinessRefreshDelay(10)).toBe(60_000);
  });
});
