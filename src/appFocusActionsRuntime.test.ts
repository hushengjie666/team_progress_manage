import { describe, expect, it, vi } from "vitest";
import { createAppFocusActionsRuntime } from "./appFocusActionsRuntime";
import { createTestState } from "./test/fixtures";
import type { AppState } from "./types";

describe("app focus actions runtime", () => {
  it("pauses a newly started server session before the work-session list catches up", async () => {
    const initial = createTestState();
    const task = initial.tasks[0];
    let state: AppState = {
      ...initial,
      workSessions: [],
      activeTimer: {
        sessionId: "focus_server",
        workSessionId: "work_server",
        taskId: task.id,
        mode: "focus",
        duration: 1500,
        remaining: 1500,
        isRunning: true,
        startedAt: "2026-07-17T03:00:00.000Z",
        plannedEndAt: "2026-07-17T03:25:00.000Z",
        totalPausedSeconds: 0,
        cycleIndex: 1,
      },
    };
    const runTeamCommand = vi.fn(async () => state);
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

    runtime.toggleTimer();
    await vi.waitFor(() => expect(runTeamCommand).toHaveBeenCalledOnce());

    expect(runTeamCommand).toHaveBeenCalledWith({
      kind: "action",
      resource: "work-sessions",
      id: "work_server",
      action: "pause",
      workspaceId: task.workspaceId,
    });
    expect(state.activeTimer?.isRunning).toBe(false);
  });

  it("keeps server-confirmed pomodoro totals when a work segment finishes", async () => {
    const initial = createTestState();
    const task = initial.tasks[0];
    let state: AppState = {
      ...initial,
      workSessions: [],
      activeTimer: {
        sessionId: "focus_server",
        workSessionId: "work_server",
        taskId: task.id,
        mode: "focus",
        duration: 1500,
        remaining: 1,
        isRunning: true,
        startedAt: "2026-07-17T03:00:00.000Z",
        plannedEndAt: "2026-07-17T03:25:00.000Z",
        totalPausedSeconds: 0,
        cycleIndex: 1,
      },
    };
    const confirmed: AppState = {
      ...state,
      tasks: state.tasks.map((item) => item.id === task.id ? { ...item, actualPomodoros: 1 } : item),
      activeTimer: undefined,
    };
    const runTeamCommand = vi.fn(async () => {
      state = confirmed;
      return confirmed;
    });
    const toast = vi.fn();
    const runtime = createAppFocusActionsRuntime({
      getState: () => state,
      getQuickNote: () => "",
      updateState: (updater) => { state = updater(state); },
      runTeamCommand,
      setQuickNote: vi.fn(),
      setToast: toast,
      setPreferredFocusTaskId: vi.fn(),
      setPendingReset: vi.fn(),
    });

    await runtime.finishTimer("completed");

    expect(state.tasks.find((item) => item.id === task.id)?.actualPomodoros).toBe(1);
    expect(state.activeTimer).toBeUndefined();
    expect(toast).toHaveBeenCalledWith("番茄已记录");
  });
});
