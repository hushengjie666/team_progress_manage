import { afterEach, describe, expect, it, vi } from "vitest";
import { loadTeamData } from "./teamApi";
import { businessRowsFromState } from "./teamBusinessRows";
import { createTestState, teamBootstrapPayload, withWorkSession } from "./test/fixtures";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("team backend active timer state loading", () => {
  it("reconstructs the active timer only from the backend active work session", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T08:05:00.000Z"));
    const base = createTestState();
    const startedAt = "2026-07-17T08:00:00.000Z";
    const remote = withWorkSession({
      ...base,
      focusSessions: [{
        id: "focus_backend",
        taskId: base.tasks[0].id,
        mode: "focus",
        duration: 1500,
        startedAt,
        interruptionCounts: { internal: 0, external: 0 },
      }],
      workSessions: [],
    }, {
      id: "work_backend",
      taskId: base.tasks[0].id,
      focusSessionId: "focus_backend",
      status: "active",
      startedAt,
      updatedAt: startedAt,
    });
    const local = {
      ...base,
      auth: { ...base.auth, token: "token", status: "authenticated" as const },
      backend: { ...base.backend, token: "token" },
      activeTimer: undefined,
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(
      teamBootstrapPayload(remote, businessRowsFromState(remote)),
    ), { status: 200, headers: { "content-type": "application/json" } })));

    const loaded = await loadTeamData(local);

    expect(loaded.activeTimer).toMatchObject({
      sessionId: "focus_backend",
      workSessionId: "work_backend",
      taskId: base.tasks[0].id,
      isRunning: true,
      remaining: 1200,
    });
  });

  it("preserves a running local break across backend refreshes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T08:00:05.000Z"));
    const base = createTestState();
    const breakSession = {
      id: "focus_local_break",
      mode: "short_break" as const,
      duration: 300,
      startedAt: "2026-07-17T08:00:00.000Z",
      interruptionCounts: { internal: 0, external: 0 },
    };
    const local = {
      ...base,
      auth: { ...base.auth, token: "token", status: "authenticated" as const },
      backend: { ...base.backend, token: "token" },
      focusSessions: [breakSession, ...base.focusSessions],
      activeTimer: {
        sessionId: breakSession.id,
        mode: breakSession.mode,
        duration: breakSession.duration,
        remaining: breakSession.duration,
        isRunning: true,
        startedAt: breakSession.startedAt,
        plannedEndAt: "2026-07-17T08:05:00.000Z",
        totalPausedSeconds: 0,
        cycleIndex: 1,
      },
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(
      teamBootstrapPayload(base, businessRowsFromState(base)),
    ), { status: 200, headers: { "content-type": "application/json" } })));

    const loaded = await loadTeamData(local);

    expect(loaded.activeTimer).toMatchObject({
      sessionId: breakSession.id,
      mode: "short_break",
      isRunning: true,
      remaining: 295,
    });
    expect(loaded.focusSessions.some((session) => session.id === breakSession.id)).toBe(true);
  });

  it("reconstructs the elapsed remaining time for a paused work session", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T08:10:00.000Z"));
    const base = createTestState();
    const startedAt = "2026-07-17T08:00:00.000Z";
    const pausedAt = "2026-07-17T08:05:00.000Z";
    const remote = withWorkSession({
      ...base,
      focusSessions: [{
        id: "focus_backend_paused",
        taskId: base.tasks[0].id,
        mode: "focus",
        duration: 1500,
        startedAt,
        interruptionCounts: { internal: 0, external: 0 },
      }],
      workSessions: [],
    }, {
      id: "work_backend_paused",
      taskId: base.tasks[0].id,
      focusSessionId: "focus_backend_paused",
      status: "paused",
      startedAt,
      pausedAt,
      updatedAt: pausedAt,
      totalPausedSeconds: 0,
    });
    const local = {
      ...base,
      auth: { ...base.auth, token: "token", status: "authenticated" as const },
      backend: { ...base.backend, token: "token" },
      activeTimer: undefined,
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(
      teamBootstrapPayload(remote, businessRowsFromState(remote)),
    ), { status: 200, headers: { "content-type": "application/json" } })));

    const loaded = await loadTeamData(local);

    expect(loaded.activeTimer).toMatchObject({
      sessionId: "focus_backend_paused",
      workSessionId: "work_backend_paused",
      isRunning: false,
      remaining: 1200,
      pausedAt,
    });
  });
});
