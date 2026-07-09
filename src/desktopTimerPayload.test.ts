import { describe, expect, it } from "vitest";
import {
  buildDesktopTimerPayload,
  displayRemainingForDesktopTimer,
  shouldApplyDesktopTimerPayload,
} from "./desktopTimerPayload";
import { createTestState } from "./test/fixtures";

describe("desktop timer payload", () => {
  it("returns null without an active timer", () => {
    const state = createTestState();
    expect(buildDesktopTimerPayload(state, undefined)).toBeNull();
  });

  it("builds the desktop timer payload from active timer and task", () => {
    const baseState = createTestState();
    const task = {
      ...baseState.tasks[0],
      id: "task_1",
      title: "适配 Tauri",
      actualPomodoros: 1,
      estimatePomodoros: 3,
    };
    const state = createTestState({
      tasks: [task],
      activeTimer: {
        sessionId: "session_1",
        taskId: task.id,
        mode: "focus",
        duration: 1500,
        remaining: 1200,
        isRunning: true,
        startedAt: "2026-07-08T01:00:00.000Z",
        plannedEndAt: "2026-07-08T01:25:00.000Z",
        totalPausedSeconds: 0,
        cycleIndex: 1,
      },
    });

    expect(buildDesktopTimerPayload(state, task, "2026-07-08T01:01:00.000Z")).toEqual({
      sessionId: "session_1",
      taskId: "task_1",
      mode: "focus",
      duration: 1500,
      remaining: 1200,
      isRunning: true,
      plannedEndAt: "2026-07-08T01:25:00.000Z",
      pendingSettlement: undefined,
      speedMultiplier: undefined,
      taskTitle: "适配 Tauri",
      actualPomodoros: 1,
      estimatePomodoros: 3,
      soundEnabled: state.settings.soundEnabled,
      timerEndSound: state.settings.timerEndSound,
      timerEndSoundVolume: state.settings.timerEndSoundVolume,
      timerEndSoundRepeats: state.settings.timerEndSoundRepeats,
      sentAt: "2026-07-08T01:01:00.000Z",
    });
  });

  it("derives display remaining from planned end time while running", () => {
    expect(displayRemainingForDesktopTimer({
      duration: 1500,
      remaining: 1200,
      isRunning: true,
      plannedEndAt: "2026-07-08T01:25:00.000Z",
    }, new Date("2026-07-08T01:24:20.100Z"))).toBe(40);
  });

  it("derives display remaining using timer speed multiplier", () => {
    expect(displayRemainingForDesktopTimer({
      duration: 1500,
      remaining: 1500,
      isRunning: true,
      plannedEndAt: "2026-07-08T01:00:15.000Z",
      speedMultiplier: 100,
    }, new Date("2026-07-08T01:00:05.000Z"))).toBe(1000);
  });

  it("uses stored remaining when paused or pending settlement", () => {
    expect(displayRemainingForDesktopTimer({
      duration: 1500,
      remaining: 900,
      isRunning: false,
      plannedEndAt: "2026-07-08T01:25:00.000Z",
    }, new Date("2026-07-08T01:24:20.000Z"))).toBe(900);
    expect(displayRemainingForDesktopTimer({
      duration: 1500,
      remaining: 0,
      isRunning: true,
      plannedEndAt: "2026-07-08T01:25:00.000Z",
      pendingSettlement: "pending",
    }, new Date("2026-07-08T01:24:20.000Z"))).toBe(0);
  });

  it("ignores stale desktop overlay payloads", () => {
    expect(shouldApplyDesktopTimerPayload(null, {
      sentAt: "2026-07-08T01:01:00.000Z",
    })).toBe(true);

    expect(shouldApplyDesktopTimerPayload({
      sentAt: "2026-07-08T01:02:00.000Z",
      syncSequence: 3,
    }, {
      sentAt: "2026-07-08T01:01:00.000Z",
      syncSequence: 2,
    })).toBe(false);

    expect(shouldApplyDesktopTimerPayload({
      sentAt: "2026-07-08T01:01:00.000Z",
    }, {
      sentAt: "2026-07-08T01:02:00.000Z",
    })).toBe(true);

    expect(shouldApplyDesktopTimerPayload({
      sentAt: "2026-07-08T01:01:00.000Z",
      syncSequence: 12,
    }, {
      sentAt: "2026-07-08T01:02:00.000Z",
      syncSequence: 1,
    })).toBe(true);

    expect(shouldApplyDesktopTimerPayload({
      sentAt: "2026-07-08T01:02:00.000Z",
      syncSequence: 3,
    }, {
      sentAt: "2026-07-08T01:02:00.000Z",
      syncSequence: 2,
    })).toBe(false);
  });
});
