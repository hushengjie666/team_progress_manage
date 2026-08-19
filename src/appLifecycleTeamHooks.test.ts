import { describe, expect, it } from "vitest";
import { mergeTeamBusinessRefreshState, teamBusinessRefreshDelay } from "./appLifecycleTeamHooks";
import { createTestState } from "./test/fixtures";

describe("team business refresh retry", () => {
  it("backs off repeated failures and caps the retry delay", () => {
    expect(teamBusinessRefreshDelay(0)).toBe(5_000);
    expect(teamBusinessRefreshDelay(1)).toBe(10_000);
    expect(teamBusinessRefreshDelay(2)).toBe(20_000);
    expect(teamBusinessRefreshDelay(10)).toBe(60_000);
  });

  it("keeps a local-only timer started while a refresh request is in flight", () => {
    const remote = createTestState();
    const current = {
      ...remote,
      activeTimer: {
        sessionId: "break_started_during_refresh",
        mode: "short_break" as const,
        duration: 300,
        remaining: 300,
        isRunning: true,
        startedAt: "2026-07-17T08:00:00.000Z",
        plannedEndAt: "2026-07-17T08:05:00.000Z",
        totalPausedSeconds: 0,
        cycleIndex: 1,
      },
    };

    const merged = mergeTeamBusinessRefreshState(
      remote,
      current,
      new Date("2026-07-17T08:00:06.000Z"),
    );

    expect(merged.activeTimer).toMatchObject({
      sessionId: "break_started_during_refresh",
      remaining: 294,
      isRunning: true,
    });
  });
});
