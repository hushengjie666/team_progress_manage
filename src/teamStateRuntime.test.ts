import { afterEach, describe, expect, it, vi } from "vitest";
import { createTeamDataRuntime } from "./teamStateRuntime";
import { businessRowsFromState } from "./teamBusinessRows";
import { createTestState, teamBootstrapPayload } from "./test/fixtures";
import type { AppState } from "./types";

afterEach(() => vi.restoreAllMocks());

const createHarness = (initial: AppState) => {
  let current: AppState | null = initial;
  let toast = "";
  const runtime = createTeamDataRuntime({
    getState: () => current,
    setState: (updater) => {
      current = typeof updater === "function" ? updater(current) : updater;
    },
    setToast: (message) => { toast = message; },
  });
  return { runtime, getCurrent: () => current, getToast: () => toast };
};

const signedInState = () => {
  const state = createTestState();
  return {
    ...state,
    auth: { ...state.auth, token: "token_runtime", status: "authenticated" as const },
    backend: { ...state.backend, token: "token_runtime", serverUrl: "http://127.0.0.1:8787" },
  };
};

describe("team state runtime", () => {
  it("rejects business commands when no backend session exists", async () => {
    const state = createTestState();
    const { runtime, getCurrent, getToast } = createHarness(state);

    const result = await runtime.runTeamCommand({ kind: "delete", entity: "task", id: state.tasks[0].id });

    expect(result).toBeUndefined();
    expect(getCurrent()).toEqual(state);
    expect(getToast()).toBe("请先连接团队后台");
  });

  it("waits for the command and then replaces business state from bootstrap", async () => {
    const before = signedInState();
    const remote = {
      ...before,
      projects: before.projects.map((project) => ({ ...project, name: "服务端确认名称" })),
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return new Response(JSON.stringify({ row: businessRowsFromState(remote)[0] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify(teamBootstrapPayload(remote, businessRowsFromState(remote))), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { runtime, getCurrent } = createHarness(before);

    const pending = runtime.runTeamCommand({
      kind: "patch",
      entity: "project",
      id: before.projects[0].id,
      patch: { name: "服务端确认名称" },
    });
    expect(getCurrent()?.projects[0].name).toBe(before.projects[0].name);
    const saved = await pending;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(`/projects/${before.projects[0].id}`);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/app/bootstrap");
    expect(saved?.projects[0].name).toBe("服务端确认名称");
    expect(getCurrent()?.projects[0].name).toBe("服务端确认名称");
  });

  it("keeps confirmed business data unchanged when a command fails", async () => {
    const before = signedInState();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "backend down" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })));
    const { runtime, getCurrent, getToast } = createHarness(before);

    const result = await runtime.runTeamCommand({
      kind: "patch",
      entity: "project",
      id: before.projects[0].id,
      patch: { name: "不应显示" },
    });

    expect(result).toBeUndefined();
    expect(getCurrent()?.projects).toEqual(before.projects);
    expect(getToast()).toContain("backend down");
  });

  it("applies a delta response without downloading the full bootstrap again", async () => {
    const before = signedInState();
    const confirmedTask = { ...before.tasks[0], status: "committed" as const, updatedAt: "2026-08-19T03:00:00.000Z" };
    const row = businessRowsFromState({ ...before, tasks: [confirmedTask, ...before.tasks.slice(1)] })
      .find((item) => item.entity === "task" && item.id === confirmedTask.id)!;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ delta: true, rows: [row] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { runtime, getCurrent } = createHarness(before);

    const saved = await runtime.runTeamCommand({
      kind: "action",
      resource: "daily-plans",
      id: before.dailyPlans[0].id,
      action: "add-task",
      payload: { task_id: confirmedTask.id },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/daily-plans/");
    expect(saved?.tasks.find((item) => item.id === confirmedTask.id)).toEqual(confirmedTask);
    expect(getCurrent()?.backend.status).toBe("ready");
  });
});
