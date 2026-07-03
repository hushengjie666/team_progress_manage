import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "./seed";
import { createTeamStateRuntime } from "./teamStateRuntime";
import type { AppState } from "./types";

const withToken = (state: AppState): AppState => ({
  ...state,
  auth: {
    ...state.auth,
    status: "authenticated",
    token: "token_runtime",
    message: "已登录",
  },
  sync: {
    ...state.sync,
    token: "token_runtime",
    serverUrl: "http://127.0.0.1:8787",
  },
});

const changedState = (state: AppState): AppState => ({
  ...state,
  settings: {
    ...state.settings,
    focusMinutes: state.settings.focusMinutes + 5,
  },
  updatedAt: "2026-07-01T08:00:00.000Z",
});

const createRuntimeHarness = (initial: AppState) => {
  let current: AppState | null = initial;
  let toast = "";
  const runtime = createTeamStateRuntime({
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

const teamStateResponse = (state: AppState, revision: number) =>
  new Response(JSON.stringify({
    changes: [
      {
        workspace_id: state.auth.workspace?.id,
        entity: "settings",
        id: "default",
        device_id: "server",
        updated_at: state.updatedAt,
        revision,
        version: 1,
        payload: state.settings,
      },
    ],
    current_revision: revision,
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

    runtime.commitTeamState(before, after);

    expect(getCurrent()).toEqual(after);
  });

  it("saves remote changes and applies the saved state", async () => {
    const before = withToken(createInitialState());
    const after = changedState(before);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      current_revision: 12,
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { runtime, getCurrent } = createRuntimeHarness(before);

    const saved = await runtime.persistTeamChanges(before, after);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(saved?.sync.status).toBe("synced");
    expect(saved?.sync.message).toBe("团队在线数据已保存");
    expect(saved?.sync.lastPulledRevision).toBe(12);
    expect(getCurrent()).toEqual(saved);
  });

  it("refreshes team state after a committed remote save", async () => {
    const before = withToken(createInitialState());
    const after = changedState(before);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/team/changes")) {
        return new Response(JSON.stringify({
          current_revision: 8,
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({
        changes: [],
        current_revision: 9,
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { runtime, getCurrent } = createRuntimeHarness(before);

    const saved = await runtime.persistTeamChanges(before, after, { refreshAfterSave: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(saved?.sync.status).toBe("synced");
    expect(saved?.sync.message).toBe("团队在线数据已加载");
    expect(saved?.sync.lastPulledRevision).toBe(9);
    expect(getCurrent()).toEqual(saved);
  });

  it("keeps the latest optimistic commit when an older remote refresh finishes later", async () => {
    const before = withToken(createInitialState());
    const first = changedState(before);
    const second = {
      ...first,
      settings: {
        ...first.settings,
        focusMinutes: first.settings.focusMinutes + 5,
      },
      updatedAt: "2026-07-01T08:01:00.000Z",
    };
    const stateResponses = [deferredResponse(), deferredResponse()];
    let stateResponseIndex = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/team/changes")) {
        return new Response(JSON.stringify({
          current_revision: stateResponseIndex + 1,
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return stateResponses[stateResponseIndex++].promise;
    });
    vi.stubGlobal("fetch", fetchMock);
    const { runtime, getCurrent } = createRuntimeHarness(before);

    runtime.commitTeamState(before, first);
    expect(getCurrent()?.settings.focusMinutes).toBe(first.settings.focusMinutes);

    runtime.commitTeamState(first, second);
    expect(getCurrent()?.settings.focusMinutes).toBe(second.settings.focusMinutes);

    await flushPromises();
    stateResponses[1].resolve(teamStateResponse(second, 2));
    await flushPromises();
    expect(getCurrent()?.settings.focusMinutes).toBe(second.settings.focusMinutes);
    expect(getCurrent()?.sync.lastPulledRevision).toBe(2);

    stateResponses[0].resolve(teamStateResponse(first, 1));
    await flushPromises();
    expect(getCurrent()?.settings.focusMinutes).toBe(second.settings.focusMinutes);
    expect(getCurrent()?.sync.lastPulledRevision).toBe(2);
  });

  it("applies failure state and toast when remote save fails", async () => {
    const before = withToken(createInitialState());
    const after = changedState(before);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: "backend down",
    }), { status: 500, headers: { "content-type": "application/json" } })));
    const { runtime, getCurrent, getToast } = createRuntimeHarness(before);

    const saved = await runtime.persistTeamChanges(before, after);

    expect(saved).toBeUndefined();
    expect(getCurrent()?.auth.status).toBe("error");
    expect(getCurrent()?.sync.status).toBe("error");
    expect(getToast()).toContain("backend down");
  });
});
