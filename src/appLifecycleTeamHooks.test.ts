import { afterEach, describe, expect, it, vi } from "vitest";
import { canApplyTeamBusinessRefresh, mergeTeamBusinessRefreshState, teamBusinessRefreshDelay, useTeamBusinessRefresh } from "./appLifecycleTeamHooks";
import { businessRowsFromState } from "./teamBusinessRows";
import { createTestState, teamBootstrapPayload } from "./test/fixtures";
import type { AppState } from "./types";

const effect = vi.hoisted(() => ({ cleanup: undefined as (() => void) | undefined }));
vi.mock("react", () => ({ useEffect: (run: () => (() => void) | undefined) => { effect.cleanup = run(); } }));

afterEach(() => {
  effect.cleanup?.();
  effect.cleanup = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("team business refresh retry", () => {
  it.each(["delta", "metadata"])("retries a bootstrap when %s arrives during the refresh", async (eventType) => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      location: new URL("http://127.0.0.1:1420"),
      setTimeout, clearTimeout, setInterval, clearInterval,
    });
    const source = createTestState();
    source.auth.token = "token";
    const stateRef = { current: source as AppState | null };
    let socket: FakeSocket;
    class FakeSocket {
      onopen?: () => void;
      onmessage?: (event: { data: string }) => void;
      onclose?: (() => void) | null;
      close() {}
      constructor() { socket = this; }
    }
    vi.stubGlobal("WebSocket", FakeSocket);
    const response = (payload: unknown) => new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
    let resolveBootstrap: (response: Response) => void = () => {};
    let bootstrapCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/app/events/ticket")) return response({ ticket: "ticket" });
      bootstrapCount += 1;
      if (bootstrapCount === 1) return new Promise<Response>((resolve) => { resolveBootstrap = resolve; });
      return response(teamBootstrapPayload(stateRef.current!));
    });
    vi.stubGlobal("fetch", fetchMock);
    useTeamBusinessRefresh({
      state: source,
      loaded: true,
      stateRef,
      setState: (update) => { stateRef.current = typeof update === "function" ? update(stateRef.current) : update; },
    });
    await vi.advanceTimersByTimeAsync(0);
    socket!.onopen?.();
    const send = (event: unknown) => socket!.onmessage?.({ data: JSON.stringify(event) });
    send({ type: "metadata_changed" });
    await vi.advanceTimersByTimeAsync(0);
    const updated = createTestState();
    updated.tasks = updated.tasks.map((task) => ({ ...task, title: `实时更新 ${task.title}` }));
    if (eventType === "delta") {
      send({ type: "business_delta", payload: { delta: true, mutation_id: "newer", rows: businessRowsFromState(updated), deleted: [], settings: {} } });
    } else {
      send({ type: "metadata_changed" });
    }
    const latestTasks = stateRef.current!.tasks;
    resolveBootstrap(response(teamBootstrapPayload(source, eventType === "delta" ? [] : businessRowsFromState(source))));
    await vi.advanceTimersByTimeAsync(0);

    if (eventType === "delta") expect(stateRef.current!.tasks).toBe(latestTasks);
    expect(bootstrapCount).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(bootstrapCount).toBe(2);
    expect(stateRef.current!.tasks[0].title).toBe(eventType === "delta" ? updated.tasks[0].title : source.tasks[0].title);
  });

  it("does not erase today's tasks with a bootstrap started before a queue update", () => {
    const source = createTestState({ dailyPlans: [] });
    const current = { ...source, dailyPlans: createTestState().dailyPlans };
    const staleRemote = { ...source, tasks: [] };

    const merged = mergeTeamBusinessRefreshState(staleRemote, current, new Date(), source);

    expect(merged).toBe(current);
    expect(merged.dailyPlans[0].committedTaskIds).toContain("task_write_prd");
    expect(merged.tasks).toBe(current.tasks);
  });

  it("does not restore a task deleted while a bootstrap was in flight", () => {
    const source = createTestState();
    const current = { ...source, tasks: source.tasks.slice(1) };

    expect(mergeTeamBusinessRefreshState(source, current, new Date(), source)).toBe(current);
  });

  it("waits for pending commands even when their optimistic data has not changed", () => {
    const source = createTestState();
    const pending = { ...source, backend: { ...source.backend, pendingResourceKeys: ["daily-plan:today"] } };

    expect(canApplyTeamBusinessRefresh(source, pending)).toBe(false);
    expect(canApplyTeamBusinessRefresh(pending, source)).toBe(false);
  });

  it("accepts an authoritative empty snapshot when business data has not changed", () => {
    const source = createTestState();
    const current = { ...source, backend: { ...source.backend, realtimeStatus: "connected" as const } };
    const remote = createTestState({ tasks: [], dailyPlans: [] });

    expect(mergeTeamBusinessRefreshState(remote, current, new Date(), source)).toBe(remote);
  });

  it("rejects snapshots belonging to a previous session or backend", () => {
    const source = createTestState();
    expect(canApplyTeamBusinessRefresh(source, { ...source, auth: { ...source.auth, token: "other-session" } })).toBe(false);
    expect(canApplyTeamBusinessRefresh(source, { ...source, backend: { ...source.backend, serverUrl: "http://other-backend" } })).toBe(false);
  });

  it("backs off repeated failures and caps the retry delay", () => {
    expect(teamBusinessRefreshDelay(0)).toBe(1_000);
    expect(teamBusinessRefreshDelay(1)).toBe(2_000);
    expect(teamBusinessRefreshDelay(2)).toBe(5_000);
    expect(teamBusinessRefreshDelay(10)).toBe(30_000);
  });

  it("keeps a local-only timer started while a refresh request is in flight", () => {
    const remote = createTestState();
    const current = {
      ...remote,
      activeTimer: {
        sessionId: "break_started_during_refresh",
        mode: "short_break" as const,
        duration: 300,
        remaining: 300,
        isRunning: true,
        startedAt: "2026-07-17T08:00:00.000Z",
        plannedEndAt: "2026-07-17T08:05:00.000Z",
        totalPausedSeconds: 0,
        cycleIndex: 1,
      },
    };

    const merged = mergeTeamBusinessRefreshState(
      remote,
      current,
      new Date("2026-07-17T08:00:06.000Z"),
    );

    expect(merged.activeTimer).toMatchObject({
      sessionId: "break_started_during_refresh",
      remaining: 294,
      isRunning: true,
    });
  });
});
