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
    });
  });
});
