import { listen } from "@tauri-apps/api/event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAppFocusActionsRuntime } from "./appFocusActionsRuntime";
import { prepareTimerStageInState, startTimerInState } from "./appTimerStartSessionState";
import {
  attachDesktopTimerListeners,
  buildDesktopTimerStatusPayload,
  DESKTOP_TIMER_ABORT_EVENT,
  DESKTOP_TIMER_SHORT_BREAK_EVENT,
  DESKTOP_TIMER_TOGGLE_EVENT,
  startDesktopShortBreak,
} from "./desktopTimerStatus";
import { createInitialState } from "./test/fixtures";
import type { AppState, SessionMode } from "./types";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const signedInState = (): AppState => {
  const state = createInitialState();
  return {
    ...state,
    auth: { ...state.auth, status: "authenticated", token: "test-token" },
    settings: { ...state.settings, shortBreakMinutes: 7 },
  };
};

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
      sessionId: "focus_status",
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

describe("desktop short break action", () => {
  it.each(["running focus", "paused focus", "prepared focus", "long break"])("replaces %s with a configured short break", async (source) => {
    const initial = signedInState();
    const now = new Date().toISOString();
    const taskId = initial.tasks[0].id;
    const mode = source === "long break" ? "long_break" : "focus";
    let state = source === "prepared focus"
      ? prepareTimerStageInState(initial, mode, taskId, now)
      : startTimerInState(initial, mode, mode === "focus" ? taskId : undefined, now, "source", {
        startPaused: source === "paused focus",
      });
    const sourceId = state.activeTimer!.sessionId;
    const { tasks, focusSessions, workSessions, executionSignals, dailyPlans } = state;
    const runTeamCommand = vi.fn();
    const runtime = createAppFocusActionsRuntime({
      getState: () => state,
      getQuickNote: () => "",
      updateState: (updater) => { state = updater(state); },
      runTeamCommand,
      setQuickNote: vi.fn(),
      setToast: vi.fn(),
      setPreferredFocusTaskId: vi.fn(),
      setPendingReset: vi.fn(),
    });

    const firstClick = startDesktopShortBreak(state, sourceId, runtime.beginTimer);
    const started = state.activeTimer;
    await startDesktopShortBreak(state, sourceId, runtime.beginTimer);
    await firstClick;

    expect(started).toMatchObject({ mode: "short_break", duration: 420, remaining: 420, isRunning: true });
    expect(state.activeTimer).toBe(started);
    expect(state.tasks).toBe(tasks);
    expect(state.focusSessions).toBe(focusSessions);
    expect(state.workSessions).toBe(workSessions);
    expect(state.executionSignals).toBe(executionSignals);
    expect(state.dailyPlans).toBe(dailyPlans);
    expect(runTeamCommand).not.toHaveBeenCalled();
  });

  it.each(["running", "paused", "prepared"])("ignores a %s short break", async (status) => {
    const initial = signedInState();
    const now = new Date().toISOString();
    const mode: SessionMode = "short_break";
    const state = status === "prepared"
      ? prepareTimerStageInState(initial, mode, undefined, now)
      : startTimerInState(initial, mode, undefined, now, "break", { startPaused: status === "paused" });
    const beginTimer = vi.fn();

    await startDesktopShortBreak(state, state.activeTimer!.sessionId, beginTimer);

    expect(beginTimer).not.toHaveBeenCalled();
  });

  it("ignores stale events, logout, no timer, unready runtime, and expiration", async () => {
    const initial = signedInState();
    const state = startTimerInState(initial, "focus", undefined, new Date().toISOString(), "source");
    const signedOut: AppState = { ...state, auth: { ...state.auth, status: "signed_out", token: undefined } };
    const expired = { ...state, activeTimer: { ...state.activeTimer!, plannedEndAt: new Date(Date.now() - 1000).toISOString() } };
    const beginTimer = vi.fn();

    await startDesktopShortBreak(state, "previous", beginTimer);
    await startDesktopShortBreak(initial, "source", beginTimer);
    await startDesktopShortBreak(null, "source", beginTimer);
    await startDesktopShortBreak(signedOut, "source", beginTimer);
    await startDesktopShortBreak(expired, "source", beginTimer);
    await expect(startDesktopShortBreak(state, "source", undefined)).resolves.toBeUndefined();

    expect(beginTimer).not.toHaveBeenCalled();
  });
});

describe("desktop timer event listeners", () => {
  const listenMock = vi.mocked(listen);
  const options = {
    toggleTimer: vi.fn(),
    abortTimer: vi.fn(),
    startShortBreak: vi.fn(async () => {}),
  };
  beforeEach(() => vi.clearAllMocks());

  it("routes each native event once and removes all listeners on cleanup", async () => {
    const handlers = new Map<string, (payload: string) => void>();
    const remove = vi.fn();
    listenMock.mockImplementation(async (event, handle) => {
      handlers.set(event, (payload) => handle({ event, id: 1, payload }));
      return remove;
    });
    const dispose = attachDesktopTimerListeners(options);
    try {
      await vi.waitFor(() => expect(listenMock).toHaveBeenCalledTimes(3));
      expect(listenMock).toHaveBeenCalledWith(DESKTOP_TIMER_SHORT_BREAK_EVENT, expect.any(Function), {
        target: { kind: "WebviewWindow", label: "main" },
      });

      handlers.get(DESKTOP_TIMER_SHORT_BREAK_EVENT)!("source");
      handlers.get(DESKTOP_TIMER_TOGGLE_EVENT)!("");
      handlers.get(DESKTOP_TIMER_ABORT_EVENT)!("");
      expect(options.startShortBreak).toHaveBeenCalledExactlyOnceWith("source");
      expect(options.toggleTimer).toHaveBeenCalledOnce();
      expect(options.abortTimer).toHaveBeenCalledOnce();
    } finally {
      dispose();
    }
    expect(remove).toHaveBeenCalledTimes(3);
    handlers.get(DESKTOP_TIMER_SHORT_BREAK_EVENT)!("late");
    expect(options.startShortBreak).toHaveBeenCalledOnce();
  });

  it("cleans up registration that completes after unmount", async () => {
    const remove = vi.fn();
    let complete = () => {};
    listenMock.mockImplementation((event) => {
      if (event !== DESKTOP_TIMER_SHORT_BREAK_EVENT) return Promise.resolve(remove);
      return new Promise((resolve) => { complete = () => resolve(remove); });
    });
    const dispose = attachDesktopTimerListeners(options);
    try {
      await vi.waitFor(() => expect(listenMock).toHaveBeenCalledTimes(3));
    } finally {
      dispose();
    }

    expect(remove).toHaveBeenCalledTimes(2);
    complete();
    await vi.waitFor(() => expect(remove).toHaveBeenCalledTimes(3));
  });
});
