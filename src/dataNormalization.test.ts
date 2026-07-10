import { describe, expect, it } from "vitest";
import { isCurrentAppStatePayload, parseCurrentAppStatePayload } from "./storage";
import { createInitialState } from "./test/fixtures";

describe("current app state payload", () => {
  it("accepts the runtime cache shape without business data", () => {
    const state = createInitialState();
    const payload = {
      version: 4,
      settings: state.settings,
      auth: state.auth,
      backend: {
        serverUrl: state.backend.serverUrl,
        username: state.backend.username,
        deviceId: state.backend.deviceId,
        token: state.backend.token,
      },
      updatedAt: state.updatedAt,
    };

    expect(isCurrentAppStatePayload(payload)).toBe(true);
    expect(parseCurrentAppStatePayload(payload)).toMatchObject({
      settings: state.settings,
      auth: state.auth,
      projects: expect.any(Array),
      tasks: [],
      dailyPlans: [],
    });
  });

  it("does not restore business arrays from cached payloads", () => {
    const state = createInitialState();
    const parsed = parseCurrentAppStatePayload({
      version: 4,
      settings: state.settings,
      auth: state.auth,
      backend: {
        serverUrl: state.backend.serverUrl,
        username: state.backend.username,
        deviceId: state.backend.deviceId,
      },
      projects: [{ id: "cached_project" }],
      tasks: [{ id: "cached_task" }],
      dailyPlans: [{ id: "cached_plan" }],
      updatedAt: state.updatedAt,
    });

    expect(parsed.projects).toEqual(createInitialState().projects);
    expect(parsed.tasks).toEqual([]);
    expect(parsed.dailyPlans).toEqual([]);
  });

  it("restores only the active timer runtime cache", () => {
    const state = createInitialState();
    const activeTimer = {
      sessionId: "focus_active",
      taskId: "task_write_prd",
      workSessionId: "work_active",
      mode: "focus" as const,
      duration: 1500,
      remaining: 1200,
      isRunning: true,
      startedAt: state.updatedAt,
      plannedEndAt: "2026-05-10T08:25:00.000Z",
      totalPausedSeconds: 0,
      cycleIndex: 1,
    };
    const activeFocusSession = {
      id: "focus_active",
      taskId: "task_write_prd",
      mode: "focus" as const,
      duration: 1500,
      startedAt: state.updatedAt,
      interruptionCounts: { internal: 0, external: 0 },
    };
    const activeWorkSession = {
      id: "work_active",
      taskId: "task_write_prd",
      executorMemberId: "member_owner",
      focusSessionId: "focus_active",
      status: "active" as const,
      startedAt: state.updatedAt,
      totalPausedSeconds: 0,
      createdAt: state.updatedAt,
      updatedAt: state.updatedAt,
    };
    const activeSignal = {
      id: "signal_active",
      workSessionId: "work_active",
      taskId: "task_write_prd",
      executorMemberId: "member_owner",
      type: "work_started" as const,
      createdAt: state.updatedAt,
    };
    const unrelatedWorkSession = {
      ...activeWorkSession,
      id: "work_unrelated",
      taskId: "task_sync_config",
      focusSessionId: "focus_unrelated",
    };
    const unrelatedSignal = {
      ...activeSignal,
      id: "signal_unrelated",
      workSessionId: "work_unrelated",
      taskId: "task_sync_config",
    };

    const parsed = parseCurrentAppStatePayload({
      version: 4,
      settings: state.settings,
      auth: state.auth,
      backend: {
        serverUrl: state.backend.serverUrl,
        username: state.backend.username,
        deviceId: state.backend.deviceId,
      },
      activeRuntime: {
        activeTimer,
        tasks: state.tasks,
        dailyPlans: [
          state.dailyPlans[0],
          { ...state.dailyPlans[0], id: "plan_unrelated", committedTaskIds: ["task_sync_config"] },
        ],
        focusSessions: [
          activeFocusSession,
          { ...activeFocusSession, id: "focus_unrelated", taskId: "task_sync_config" },
        ],
        workSessions: [activeWorkSession, unrelatedWorkSession],
        executionSignals: [activeSignal, unrelatedSignal],
      },
      updatedAt: state.updatedAt,
    });

    expect(parsed.activeTimer).toEqual(activeTimer);
    expect(parsed.tasks).toEqual([state.tasks[0]]);
    expect(parsed.dailyPlans).toEqual([state.dailyPlans[0]]);
    expect(parsed.focusSessions).toEqual([activeFocusSession]);
    expect(parsed.workSessions).toEqual([activeWorkSession]);
    expect(parsed.executionSignals).toEqual([activeSignal]);
  });

  it("fills new settings defaults for existing runtime caches", () => {
    const state = createInitialState();
    const {
      timerEndSoundRepeats: _timerEndSoundRepeats,
      timerEndSoundVolume: _timerEndSoundVolume,
      ...settings
    } = state.settings;

    const parsed = parseCurrentAppStatePayload({
      version: 4,
      settings,
      auth: state.auth,
      backend: {
        serverUrl: state.backend.serverUrl,
        username: state.backend.username,
        deviceId: state.backend.deviceId,
      },
      updatedAt: state.updatedAt,
    });

    expect(parsed.settings.timerEndSoundRepeats).toBe(1);
    expect(parsed.settings.timerEndSoundVolume).toBe(100);
  });

  it("rejects unsupported schema versions instead of normalizing them", () => {
    const state = createInitialState();
    const legacy = { ...state, version: 2 };

    expect(isCurrentAppStatePayload(legacy)).toBe(false);
    expect(() => parseCurrentAppStatePayload(legacy)).toThrow("当前版本");
  });

  it("rejects runtime caches missing required auth", () => {
    const state = createInitialState();
    const incomplete = {
      version: 4,
      settings: state.settings,
      backend: {
        serverUrl: state.backend.serverUrl,
        username: state.backend.username,
        deviceId: state.backend.deviceId,
      },
      updatedAt: state.updatedAt,
    };

    expect(isCurrentAppStatePayload(incomplete)).toBe(false);
    expect(() => parseCurrentAppStatePayload(incomplete)).toThrow("完整");
  });
});
