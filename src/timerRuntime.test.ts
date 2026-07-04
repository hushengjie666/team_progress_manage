import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "./seed";
import {
  announceTimerEnd,
  runDueTaskReminders,
  updateWhiteNoisePlayback,
  updateActiveTimerPresence,
} from "./timerRuntime";
import type { ActiveTimer, AppState } from "./types";

const mocks = vi.hoisted(() => ({
  playTimerSound: vi.fn(),
  sendTimerNotification: vi.fn(),
  startWhiteNoise: vi.fn(),
}));

vi.mock("./notifications", () => ({
  playTimerSound: mocks.playTimerSound,
  sendTimerNotification: mocks.sendTimerNotification,
  startWhiteNoise: mocks.startWhiteNoise,
}));

const activeTimer = (): ActiveTimer => ({
  sessionId: "session_timer",
  taskId: "task_due",
  mode: "focus",
  duration: 25 * 60,
  remaining: 60,
  isRunning: true,
  startedAt: "2026-07-01T07:30:00.000Z",
  plannedEndAt: "2026-07-01T07:55:00.000Z",
  totalPausedSeconds: 0,
  cycleIndex: 1,
});

const stateWithDueTask = (): AppState => {
  const state = createInitialState();
  return {
    ...state,
    activeTimer: activeTimer(),
    tasks: [
      {
        id: "task_due",
        title: "到期提醒任务",
        notes: "",
        tags: [],
        projectId: state.projects[0].id,
        project: state.projects[0].name,
        creatorMemberId: state.projectMembers[0].id,
        primaryExecutorMemberId: state.projectMembers[0].id,
        collaboratorMemberIds: [],
        progressPercent: 0,
        progressNote: "",
        priority: "medium",
        severity: "medium",
        stage: "development",
        estimatePomodoros: 1,
        status: "committed",
        repeatRule: "none",
        reminderAt: "2026-07-01T07:00:00.000Z",
        subtasks: [],
        sortOrder: 1,
        actualPomodoros: 0,
        estimateHistory: [],
        createdAt: "2026-07-01T06:00:00.000Z",
        updatedAt: "2026-07-01T06:00:00.000Z",
      },
    ],
  };
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("timer runtime", () => {
  it("announces a timer ending through sound and notification adapters", () => {
    const state = createInitialState();

    announceTimerEnd(state.settings, "专注已结束", "休息一下");

    expect(mocks.playTimerSound).toHaveBeenCalledWith(state.settings);
    expect(mocks.sendTimerNotification).toHaveBeenCalledWith(state.settings, "专注已结束", "休息一下");
  });

  it("marks due task reminders and commits the updated state", () => {
    const state = stateWithDueTask();
    const sentIds = new Set<string>();
    const commitTeamData = vi.fn();

    runDueTaskReminders(
      state,
      sentIds,
      commitTeamData,
      Date.parse("2026-07-01T08:00:00.000Z"),
      "2026-07-01T08:00:00.000Z",
    );

    expect(sentIds.has("task_due")).toBe(true);
    expect(mocks.sendTimerNotification).toHaveBeenCalledWith(state.settings, "任务提醒", "到期提醒任务");
    expect(commitTeamData).toHaveBeenCalledWith(state, expect.objectContaining({
      tasks: [expect.objectContaining({
        id: "task_due",
        lastReminderSentAt: "2026-07-01T08:00:00.000Z",
        updatedAt: "2026-07-01T08:00:00.000Z",
      })],
      updatedAt: "2026-07-01T08:00:00.000Z",
    }));
  });

  it("replaces white noise when a running timer wants ambient sound", () => {
    const stopPrevious = vi.fn();
    const stopNext = vi.fn();
    mocks.startWhiteNoise.mockReturnValue(stopNext);
    const state = {
      ...stateWithDueTask(),
      settings: {
        ...stateWithDueTask().settings,
        whiteNoise: "rain" as const,
      },
    };
    const ref = { current: stopPrevious };

    updateWhiteNoisePlayback(state, ref);

    expect(stopPrevious).toHaveBeenCalled();
    expect(mocks.startWhiteNoise).toHaveBeenCalledWith("rain", state.settings.whiteNoiseVolume);
    expect(ref.current).toBe(stopNext);
  });

  it("updates the document title from the active timer", () => {
    vi.stubGlobal("document", { title: "" });

    updateActiveTimerPresence(activeTimer());

    expect(document.title).toBe("01:00 · 专注番茄 · TimeManage");
  });
});
