import { describe, expect, it } from "vitest";
import { buildDesktopTimerStatusPayload } from "./desktopTimerStatus";
import { createInitialState } from "./test/fixtures";

describe("desktop timer status", () => {
  it("hides the status component without an active timer", () => {
    expect(buildDesktopTimerStatusPayload(createInitialState(), undefined)).toBeNull();
  });

  it("keeps the timer, task, and pomodoro information needed by the status menu", () => {
    const initial = createInitialState();
    const task = {
      ...initial.tasks[0],
      id: "task_status",
      title: "梳理现有出口细分方案",
      actualPomodoros: 6,
      estimatePomodoros: 3,
    };
    const state = {
      ...initial,
      activeTimer: {
        sessionId: "focus_status",
        taskId: task.id,
        mode: "focus" as const,
        duration: 1500,
        remaining: 19,
        isRunning: true,
        prepared: false,
        startedAt: "2026-08-26T01:00:00.000Z",
        plannedEndAt: "2026-08-26T01:25:00.000Z",
        totalPausedSeconds: 0,
        cycleIndex: 1,
      },
    };

    expect(buildDesktopTimerStatusPayload(state, task)).toEqual({
      mode: "focus",
      duration: 1500,
      remaining: 19,
      isRunning: true,
      prepared: false,
      taskTitle: "梳理现有出口细分方案",
      actualPomodoros: 6,
      estimatePomodoros: 3,
    });
  });
});
