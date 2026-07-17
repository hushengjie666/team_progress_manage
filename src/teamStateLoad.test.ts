import { afterEach, describe, expect, it, vi } from "vitest";
import { loadTeamData } from "./teamApi";
import { businessRowsFromState } from "./teamBusinessRows";
import { createTestState, teamBootstrapPayload } from "./test/fixtures";

afterEach(() => vi.restoreAllMocks());

describe("team backend state loading", () => {
  it("loads the complete application bootstrap from the backend", async () => {
    const remote = createTestState();
    const local = {
      ...createTestState({ projects: [], projectMembers: [], tasks: [], dailyPlans: [] }),
      auth: { ...remote.auth, token: "token", status: "authenticated" as const },
      backend: { ...remote.backend, token: "token", serverUrl: "http://127.0.0.1:8787" },
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify(
      teamBootstrapPayload(remote, businessRowsFromState(remote)),
    ), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const loaded = await loadTeamData(local);

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://127.0.0.1:8787/app/bootstrap");
    expect(loaded.projects).toEqual(remote.projects);
    expect(loaded.tasks).toEqual(remote.tasks);
    expect(loaded.auth.account?.id).toBe("account_owner");
  });

  it("does not resurrect local starter rows when the backend has no business rows", async () => {
    const local = {
      ...createTestState(),
      auth: { ...createTestState().auth, token: "token", status: "authenticated" as const },
      backend: { ...createTestState().backend, token: "token" },
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(
      teamBootstrapPayload(local, []),
    ), { status: 200, headers: { "content-type": "application/json" } })));

    const loaded = await loadTeamData(local);

    expect(loaded.projects).toEqual([]);
    expect(loaded.projectMembers).toEqual([]);
    expect(loaded.tasks).toEqual([]);
  });
});
