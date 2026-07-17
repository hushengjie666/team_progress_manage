import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppSettingsActionsRuntime } from "./appSettingsActionsRuntime";
import { createTestState } from "./test/fixtures";

describe("app settings actions runtime", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("recalculates the active timer when enabling the development speed toggle", () => {
    vi.useFakeTimers();
    vi.stubEnv("DEV", true);
    vi.setSystemTime(new Date("2026-07-08T01:05:00.000Z"));

    let state = createTestState({
      activeTimer: {
        sessionId: "session_1",
        mode: "focus",
        duration: 1500,
        remaining: 1500,
        isRunning: true,
        startedAt: "2026-07-08T01:00:00.000Z",
        plannedEndAt: "2026-07-08T01:25:00.000Z",
        totalPausedSeconds: 0,
        cycleIndex: 1,
      },
    });
    const runtime = createAppSettingsActionsRuntime({
      updateState: (updater) => {
        state = updater(state);
      },
      runTeamCommand: vi.fn(async () => state),
      setToast: () => undefined,
    });

    runtime.updateSettings("devTimerSpeed100xEnabled", true);

    expect(state.settings.devTimerSpeed100xEnabled).toBe(true);
    expect(state.activeTimer?.remaining).toBe(1200);
    expect(state.activeTimer?.speedMultiplier).toBe(100);
    expect(state.activeTimer?.plannedEndAt).toBe("2026-07-08T01:05:12.000Z");
  });
});
