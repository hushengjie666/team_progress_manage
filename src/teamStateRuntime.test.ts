import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "./seed";
import { createTeamDataRuntime } from "./teamStateRuntime";
import { businessRowsFromState } from "./teamBusinessRows";
import type { AppState } from "./types";

const withToken = (state: AppState): AppState => {
  const revisions = Object.fromEntries(businessRowsFromState(state).map((row) => [`${row.workspace_id ?? ""}:${row.entity}:${row.id}`, 1]));
  return ({
  ...state,
  auth: {
    ...state.auth,
    status: "authenticated",
    token: "token_runtime",
    message: "已登录",
  },
  backend: {
    ...state.backend,
    token: "token_runtime",
    serverUrl: "http://127.0.0.1:8787",
    businessRowRevisions: revisions,
  },
});
};

const changedState = (state: AppState): AppState => ({
  ...state,
  projects: state.projects.map((project) =>
    project.id === state.projects[0]?.id
      ? { ...project, name: `${project.name} 已更新`, updatedAt: "2026-07-01T08:00:00.000Z" }
      : project,
  ),
  updatedAt: "2026-07-01T08:00:00.000Z",
});

const createRuntimeHarness = (initial: AppState) => {
  let current: AppState | null = initial;
  let toast = "";
  const runtime = createTeamDataRuntime({
    getState: () => current,
    setState: (updater) => {
      current = typeof updater === "function" ? updater(current) : updater;
    },
    setToast: (message) => {
      toast = message;
    },
  });
  return {
    runtime,
    getCurrent: () => current,
    getToast: () => toast,
  };
};

const deferredResponse = () => {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const teamStateResponse = (state: AppState) =>
  new Response(JSON.stringify({
    rows: businessRowsFromState(state).map((row) => ({ ...row, revision: 2 })),
  }), { status: 200, headers: { "content-type": "application/json" } });

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("team state runtime", () => {
  it("commits local state immediately when no team token exists", () => {
    const before = createInitialState();
    const after = changedState(before);
    const { runtime, getCurrent } = createRuntimeHarness(before);

    runtime.commitTeamData(before, after);

    expect(getCurrent()).toEqual(after);
  });

  it("saves remote changes and applies the saved state", async () => {
    const before = withToken(createInitialState());
    const after = changedState(before);
    const fetchMock = vi.fn(async () => teamStateResponse(after));
    vi.stubGlobal("fetch", fetchMock);
    const { runtime, getCurrent } = createRuntimeHarness(before);

    const saved = await runtime.persistTeamData(before, after);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(saved?.backend.status).toBe("ready");
    expect(saved?.backend.message).toBe("团队在线数据已加载");
    expect(saved?.projects[0]?.name).toBe(after.projects[0]?.name);
    expect(getCurrent()).toEqual(saved);
  });

  it("refreshes team state after a committed remote save", async () => {
    const before = withToken(createInitialState());
    const after = changedState(before);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/team/data")) {
        return teamStateResponse(after);
      }
      return teamStateResponse(after);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { runtime, getCurrent } = createRuntimeHarness(before);

    const saved = await runtime.persistTeamData(before, after, { refreshAfterSave: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(saved?.backend.status).toBe("ready");
    expect(saved?.backend.message).toBe("团队在线数据已加载");
    expect(saved?.projects[0]?.name).toBe(after.projects[0]?.name);
    expect(getCurrent()).toEqual(saved);
  });

  it("keeps the latest optimistic commit when an older remote refresh finishes later", async () => {
    const before = withToken(createInitialState());
    const first = changedState(before);
    const second = {
      ...first,
      projects: first.projects.map((project) =>
        project.id === first.projects[0]?.id
          ? { ...project, name: `${project.name} 再次更新`, updatedAt: "2026-07-01T08:01:00.000Z" }
          : project,
      ),
      updatedAt: "2026-07-01T08:01:00.000Z",
    };
    const stateResponses = [deferredResponse(), deferredResponse()];
    let stateResponseIndex = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/team/data") && init?.method === "PUT") {
        return stateResponses[stateResponseIndex++].promise;
      }
      return teamStateResponse(second);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { runtime, getCurrent } = createRuntimeHarness(before);

    runtime.commitTeamData(before, first);
    expect(getCurrent()?.projects[0]?.name).toBe(first.projects[0]?.name);

    runtime.commitTeamData(first, second);
    expect(getCurrent()?.projects[0]?.name).toBe(second.projects[0]?.name);

    await flushPromises();
    stateResponses[1].resolve(teamStateResponse(second));
    await flushPromises();
    expect(getCurrent()?.projects[0]?.name).toBe(second.projects[0]?.name);

    stateResponses[0].resolve(teamStateResponse(first));
    await flushPromises();
    expect(getCurrent()?.projects[0]?.name).toBe(second.projects[0]?.name);
  });

  it("uses revisions returned by an earlier queued create for the following patch", async () => {
    const before = withToken(createInitialState());
    const createdProject = {
      ...before.projects[0]!,
      id: "project_queued",
      name: "队列新项目",
      createdAt: "2026-07-01T08:00:00.000Z",
      updatedAt: "2026-07-01T08:00:00.000Z",
    };
    const first = {
      ...before,
      projects: [...before.projects, createdProject],
      updatedAt: createdProject.updatedAt,
    };
    const second = {
      ...first,
      projects: first.projects.map((project) => project.id === createdProject.id
        ? { ...project, name: "队列项目已重命名", updatedAt: "2026-07-01T08:01:00.000Z" }
        : project),
      updatedAt: "2026-07-01T08:01:00.000Z",
    };
    let putCount = 0;
    const putBodies: Array<{ operations: Array<{ operation?: string; expected_revision?: number }> }> = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        putBodies.push(JSON.parse(String(init.body)));
        putCount += 1;
        return teamStateResponse(putCount === 1 ? first : second);
      }
      return teamStateResponse(putCount === 1 ? first : second);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { runtime, getCurrent } = createRuntimeHarness(before);

    runtime.commitTeamData(before, first);
    runtime.commitTeamData(first, second);
    await flushPromises();
    await flushPromises();

    expect(putBodies).toHaveLength(2);
    expect(putBodies[0]?.operations[0]).toEqual(expect.objectContaining({ operation: "create" }));
    expect(putBodies[1]?.operations[0]?.expected_revision).toBe(2);
    expect(getCurrent()?.projects.find((project) => project.id === createdProject.id)?.name)
      .toBe("队列项目已重命名");
  });

  it("applies failure state and toast when remote save fails", async () => {
    const before = withToken(createInitialState());
    const after = changedState(before);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: "backend down",
    }), { status: 500, headers: { "content-type": "application/json" } })));
    const { runtime, getCurrent, getToast } = createRuntimeHarness(before);

    const saved = await runtime.persistTeamData(before, after);

    expect(saved).toBeUndefined();
    expect(getCurrent()?.auth.status).toBe("authenticated");
    expect(getCurrent()?.auth.token).toBe(before.auth.token);
    expect(getCurrent()?.auth.account).toEqual(before.auth.account);
    expect(getCurrent()?.backend.status).toBe("error");
    expect(getToast()).toContain("backend down");
  });

  it("restores server state when a destructive operation conflicts", async () => {
    const before = withToken(createInitialState());
    const after = { ...before, projects: [] };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return new Response(JSON.stringify({ error: "revision_conflict" }), { status: 409, headers: { "content-type": "application/json" } });
      }
      return teamStateResponse(before);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { runtime, getCurrent, getToast } = createRuntimeHarness(before);

    const saved = await runtime.persistTeamData(before, after);

    expect(saved).toBeUndefined();
    expect(getCurrent()?.projects).toHaveLength(before.projects.length);
    expect(getToast()).toContain("revision_conflict");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rebases and retries a patch after another device advances the row revision", async () => {
    const before = withToken(createInitialState());
    const after = changedState(before);
    const putBodies: Array<{ operations: Array<{ expected_revision?: number }> }> = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        putBodies.push(JSON.parse(String(init.body)));
        if (putBodies.length === 1) {
          return new Response(JSON.stringify({ error: "revision_conflict" }), {
            status: 409,
            headers: { "content-type": "application/json" },
          });
        }
        return teamStateResponse(after);
      }
      return teamStateResponse(before);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { runtime, getCurrent, getToast } = createRuntimeHarness(before);

    const saved = await runtime.persistTeamData(before, after);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(putBodies).toHaveLength(2);
    expect(putBodies[0]?.operations[0]?.expected_revision).toBe(1);
    expect(putBodies[1]?.operations[0]?.expected_revision).toBe(2);
    expect(saved?.projects[0]?.name).toBe(after.projects[0]?.name);
    expect(getCurrent()?.backend.status).toBe("ready");
    expect(getToast()).toBe("");
  });
});
