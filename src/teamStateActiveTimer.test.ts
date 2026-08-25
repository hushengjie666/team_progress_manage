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

  it("keeps the local monotonic countdown when the matching server session uses an older clock baseline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T08:05:00.000Z"));
    const base = createTestState();
    const focusSessionId = "focus_clock_skew";
    const workSessionId = "work_clock_skew";
    const remote = withWorkSession({
      ...base,
      updatedAt: "2026-08-25T08:00:00.000Z",
      focusSessions: [{
        id: focusSessionId,
        taskId: base.tasks[0].id,
        mode: "focus",
        duration: 1500,
        startedAt: "2026-08-25T07:58:00.000Z",
        interruptionCounts: { internal: 0, external: 0 },
      }],
      workSessions: [],
    }, {
      id: workSessionId,
      focusSessionId,
      taskId: base.tasks[0].id,
      status: "active",
      startedAt: "2026-08-25T07:58:00.000Z",
      updatedAt: "2026-08-25T07:58:00.000Z",
    });
    const local = {
      ...remote,
      auth: { ...remote.auth, token: "token", status: "authenticated" as const },
      backend: { ...remote.backend, token: "token" },
      activeTimer: {
        sessionId: focusSessionId,
        workSessionId,
        taskId: base.tasks[0].id,
        mode: "focus" as const,
        duration: 1500,
        remaining: 1380,
        isRunning: true,
        startedAt: "2026-08-25T08:03:00.000Z",
        plannedEndAt: "2026-08-25T08:28:00.000Z",
        totalPausedSeconds: 0,
        cycleIndex: 1,
      },
    };
    const payload = {
      ...teamBootstrapPayload(remote, businessRowsFromState(remote)),
      loaded_at: "2026-08-25T08:00:00.000Z",
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));

    const loaded = await loadTeamData(local);

    expect(loaded.activeTimer).toMatchObject({
      workSessionId,
      remaining: 1380,
      plannedEndAt: "2026-08-25T08:28:00.000Z",
    });
  });

  it("recovers the newest active session owned by the current account", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T08:10:00.000Z"));
    const base = createTestState();
    const focusSessions = [
      {
        id: "focus_current_newest",
        taskId: base.tasks[0].id,
        mode: "focus" as const,
        duration: 1500,
        startedAt: "2026-08-25T08:07:00.000Z",
        interruptionCounts: { internal: 0, external: 0 },
      },
      {
        id: "focus_current_older",
        taskId: base.tasks[0].id,
        mode: "focus" as const,
        duration: 1500,
        startedAt: "2026-08-25T08:00:00.000Z",
        interruptionCounts: { internal: 0, external: 0 },
      },
      {
        id: "focus_other_account",
        taskId: base.tasks[0].id,
        mode: "focus" as const,
        duration: 1500,
        startedAt: "2026-08-25T08:09:00.000Z",
        interruptionCounts: { internal: 0, external: 0 },
      },
    ];
    let remote = { ...base, updatedAt: "2026-08-25T08:10:00.000Z", focusSessions, workSessions: [] };
    remote = withWorkSession(remote, {
      id: "work_current_older",
      ownerAccountId: "account_owner",
      focusSessionId: "focus_current_older",
      status: "active",
      startedAt: "2026-08-25T08:00:00.000Z",
    });
    remote = withWorkSession(remote, {
      id: "work_current_newest",
      ownerAccountId: "account_owner",
      focusSessionId: "focus_current_newest",
      status: "active",
      startedAt: "2026-08-25T08:07:00.000Z",
    });
    remote = withWorkSession(remote, {
      id: "work_other_account",
      ownerAccountId: "account_other",
      focusSessionId: "focus_other_account",
      status: "active",
      startedAt: "2026-08-25T08:09:00.000Z",
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
      workSessionId: "work_current_newest",
      sessionId: "focus_current_newest",
      remaining: 1320,
    });
  });
});
