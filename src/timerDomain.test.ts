import { describe, expect, it } from "vitest";
import {
  calculateRemaining,
  pauseTimer,
  restoreTimer,
  resumeTimer,
} from "./domain";
import { iso } from "./test/fixtures";
import type { ActiveTimer } from "./types";

describe("timer domain", () => {
  it("marks an expired restored timer for immediate settlement", () => {
    const timer: ActiveTimer = {
      sessionId: "session_1",
      mode: "focus",
      duration: 1500,
      remaining: 1500,
      isRunning: true,
      startedAt: iso("2026-05-10T08:00:00Z"),
      plannedEndAt: iso("2026-05-10T08:25:00Z"),
      totalPausedSeconds: 0,
      cycleIndex: 1,
    };
    const restored = restoreTimer(timer, new Date("2026-05-10T08:30:00Z"));
    expect(restored).toMatchObject({
      remaining: 0,
      isRunning: false,
    });
    expect(restored?.pendingSettlement).toBe("pending");
  });

  it("extends planned end time after pause and resume", () => {
    const timer: ActiveTimer = {
      sessionId: "session_1",
      mode: "focus",
      duration: 1500,
      remaining: 1200,
      isRunning: true,
      startedAt: iso("2026-05-10T08:00:00Z"),
      plannedEndAt: iso("2026-05-10T08:25:00Z"),
      totalPausedSeconds: 0,
      cycleIndex: 1,
    };
    const paused = pauseTimer(timer, iso("2026-05-10T08:05:00Z"));
    const resumed = resumeTimer(paused, iso("2026-05-10T08:07:00Z"));
    expect(resumed.isRunning).toBe(true);
    expect(resumed.totalPausedSeconds).toBe(120);
    expect(new Date(resumed.plannedEndAt).getTime()).toBe(new Date("2026-05-10T08:27:00Z").getTime());
  });

  it("calculates and resumes accelerated timers by their speed multiplier", () => {
    const timer: ActiveTimer = {
      sessionId: "session_fast",
      mode: "focus",
      duration: 1500,
      remaining: 1500,
      isRunning: true,
      startedAt: iso("2026-05-10T08:00:00Z"),
      plannedEndAt: iso("2026-05-10T08:00:15Z"),
      totalPausedSeconds: 0,
      cycleIndex: 1,
      speedMultiplier: 100,
    };

    expect(calculateRemaining(timer, new Date("2026-05-10T08:00:05Z"))).toBe(1000);
    const paused = pauseTimer(timer, iso("2026-05-10T08:00:05Z"));
    const resumed = resumeTimer(paused, iso("2026-05-10T08:01:00Z"));

    expect(paused.remaining).toBe(1000);
    expect(resumed.totalPausedSeconds).toBe(55);
    expect(new Date(resumed.plannedEndAt).getTime()).toBe(new Date("2026-05-10T08:01:10Z").getTime());
  });
});
