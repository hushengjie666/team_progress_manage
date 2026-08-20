import { describe, expect, it, vi } from "vitest";
import { createAppFocusActionsRuntime } from "./appFocusActionsRuntime";
import { createTestState } from "./test/fixtures";
import type { AppState } from "./types";

describe("app focus actions runtime", () => {
  it("projects a newly started timer before the server responds", async () => {
    const initial = createTestState();
    const task = { ...initial.tasks[0], status: "pool" as const };
    let state: AppState = { ...initial, tasks: [task], dailyPlans: [] };
    const runTeamCommand = vi.fn(async (_command, behavior) => {
      const optimistic = behavior?.optimistic?.(state);
      if (optimistic) state = optimistic.next;
      return state;
    });
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

    await runtime.beginTimer("focus", task.id);

    expect(state.tasks[0].status).toBe("in_progress");
    expect(state.dailyPlans[0].committedTaskIds).toContain(task.id);
    expect(state.activeTimer?.taskId).toBe(task.id);
    expect(state.activeTimer?.workSessionId).toBeTruthy();
    expect(runTeamCommand.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      payload: expect.objectContaining({
        focus_session_id: state.activeTimer?.sessionId,
        work_session_id: state.activeTimer?.workSessionId,
      }),
    }));
  });

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
    const runTeamCommand = vi.fn(async (_command, behavior) => {
      const optimistic = behavior?.optimistic?.(state);
      if (optimistic) state = optimistic.next;
      return state;
    });
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

    expect(runTeamCommand).toHaveBeenCalledWith(expect.objectContaining({
      kind: "action",
      resource: "work-sessions",
      id: "work_server",
      action: "pause",
      workspaceId: task.workspaceId,
    }), expect.objectContaining({ resourceKey: "work-sessions:work_server", pendingMode: "background" }));
    expect(state.activeTimer?.isRunning).toBe(false);
  });

  it("starts a prepared break locally when the user presses play", () => {
    const initial = createTestState();
    let state: AppState = {
      ...initial,
      activeTimer: {
        sessionId: "prepared_break",
        mode: "short_break",
        duration: 300,
        remaining: 300,
        isRunning: false,
        startedAt: "2026-07-17T03:25:00.000Z",
        plannedEndAt: "2026-07-17T03:30:00.000Z",
        pausedAt: "2026-07-17T03:25:00.000Z",
        totalPausedSeconds: 0,
        cycleIndex: 1,
        prepared: true,
      },
    };
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

    runtime.toggleTimer();

    expect(state.activeTimer).toMatchObject({ mode: "short_break", remaining: 300, isRunning: true });
    expect(state.activeTimer?.prepared).toBeUndefined();
    expect(state.focusSessions).toHaveLength(initial.focusSessions.length);
    expect(runTeamCommand).not.toHaveBeenCalled();
  });

  it("starts a prepared focus stage through the atomic task start action", async () => {
    const initial = createTestState();
    const task = initial.tasks[0];
    let state: AppState = {
      ...initial,
      activeTimer: {
        sessionId: "prepared_focus",
        taskId: task.id,
        mode: "focus",
        duration: 1500,
        remaining: 1500,
        isRunning: false,
        startedAt: "2026-07-17T03:30:00.000Z",
        plannedEndAt: "2026-07-17T03:55:00.000Z",
        pausedAt: "2026-07-17T03:30:00.000Z",
        totalPausedSeconds: 0,
        cycleIndex: 2,
        prepared: true,
      },
    };
    const runTeamCommand = vi.fn(async (_command, behavior) => {
      const optimistic = behavior?.optimistic?.(state);
      if (optimistic) state = optimistic.next;
      return state;
    });
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

    expect(runTeamCommand.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      kind: "action",
      resource: "tasks",
      id: task.id,
      action: "start",
    }));
    expect(state.activeTimer).toMatchObject({ taskId: task.id, mode: "focus", isRunning: true });
    expect(state.activeTimer?.prepared).toBeUndefined();
    expect(state.activeTimer?.workSessionId).toBeTruthy();
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
