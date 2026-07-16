import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureTodayPlan } from "./appModel";
import { createInitialState } from "./seed";
import { loadTeamData, saveTeamDataChanges, saveTeamDataSnapshot } from "./teamApi";
import { businessRowsFromState, type BusinessRow } from "./teamBusinessRows";
import type { BackendConnectionState } from "./types";

const iso = (value: string) => new Date(value).toISOString();

const businessRow = (row: BusinessRow): BusinessRow => ({
  ...row,
});

const authenticatedState = () => {
  const base = createInitialState();
  return {
    ...base,
    auth: {
      status: "authenticated" as const,
      token: "token",
      account: {
        id: "account_owner",
        workspaceId: "workspace_test",
        name: "负责人",
        email: "owner@example.com",
        createdAt: iso("2026-06-30T06:00:00Z"),
        updatedAt: iso("2026-06-30T06:00:00Z"),
      },
      workspace: {
        id: "workspace_test",
        name: "测试团队",
        createdAt: iso("2026-06-30T06:00:00Z"),
        updatedAt: iso("2026-06-30T06:00:00Z"),
      },
      bootstrapped: true,
      message: "已登录",
    },
    backend: {
      ...base.backend,
      serverUrl: "http://127.0.0.1:8787",
      token: "token",
    } satisfies BackendConnectionState,
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("team backend state loading", () => {
  it("loads team data from the unscoped endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      rows: [],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await loadTeamData(authenticatedState());

    expect(String(fetchMock.mock.calls[0][0])).toBe("http://127.0.0.1:8787/team/data");
  });

  it("saves team data to the unscoped endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      rows: [],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const local = authenticatedState();
    vi.stubGlobal("fetch", fetchMock);

    await saveTeamDataSnapshot(local.backend, "token", local);

    expect(String(fetchMock.mock.calls[0][0])).toBe("http://127.0.0.1:8787/team/data");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe("PUT");
  });

  it("refreshes missing row revisions and replays a daily plan patch", async () => {
    const before = ensureTodayPlan(authenticatedState());
    const plan = before.dailyPlans[0];
    const after = {
      ...before,
      dailyPlans: before.dailyPlans.map((item) => item.id === plan.id
        ? { ...item, committedTaskIds: [...item.committedTaskIds, "task_queue_new"], updatedAt: iso("2026-07-15T01:00:00Z") }
        : item),
    };
    const requests: Array<{ method: string; body?: { operations?: Array<Record<string, unknown>> } }> = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      const state = init?.method === "PUT" ? after : before;
      return new Response(JSON.stringify({
        rows: businessRowsFromState(state).map((row) => ({ ...row, revision: init?.method === "PUT" ? 8 : 7 })),
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await saveTeamDataChanges(before.backend, "token", before, after);

    expect(requests.map((request) => request.method)).toEqual(["GET", "PUT"]);
    expect(requests[1]?.body?.operations).toEqual([expect.objectContaining({
      operation: "patch",
      entity: "daily_plan",
      id: plan.id,
      expected_revision: 7,
      patch: expect.objectContaining({ committedTaskIds: [...plan.committedTaskIds, "task_queue_new"] }),
    })]);
  });

  it("rebases a colliding create from another app instance", async () => {
    const before = authenticatedState();
    const project = {
      ...before.projects[0],
      id: "project_parallel_app",
      name: "当前窗口名称",
      updatedAt: iso("2026-07-15T01:00:00Z"),
    };
    const after = { ...before, projects: [...before.projects, project] };
    const latest = {
      ...before,
      projects: [...before.projects, { ...project, name: "另一个窗口名称" }],
    };
    const requests: Array<{ method: string; body?: { operations?: Array<Record<string, unknown>> } }> = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (requests.length === 1) {
        return new Response(JSON.stringify({ error: "revision_conflict" }), {
          status: 409,
          headers: { "content-type": "application/json" },
        });
      }
      const state = init?.method === "PUT" ? after : latest;
      return new Response(JSON.stringify({
        rows: businessRowsFromState(state).map((row) => ({ ...row, revision: init?.method === "PUT" ? 6 : 5 })),
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await saveTeamDataChanges(before.backend, "token", before, after);

    expect(requests.map((request) => request.method)).toEqual(["PUT", "GET", "PUT"]);
    expect(requests[2]?.body?.operations).toEqual([expect.objectContaining({
      operation: "patch",
      id: project.id,
      expected_revision: 5,
      patch: expect.objectContaining({ name: "当前窗口名称" }),
    })]);
  });

  it("does not resurrect starter members when the remote team has no member rows", async () => {
    const base = createInitialState();
    const local = {
      ...base,
      auth: {
        status: "authenticated" as const,
        token: "token",
        account: {
          id: "account_owner",
          workspaceId: "workspace_test",
          name: "负责人",
          email: "owner@example.com",
          createdAt: iso("2026-06-30T06:00:00Z"),
          updatedAt: iso("2026-06-30T06:00:00Z"),
        },
        workspace: {
          id: "workspace_test",
          name: "测试团队",
          createdAt: iso("2026-06-30T06:00:00Z"),
          updatedAt: iso("2026-06-30T06:00:00Z"),
        },
        bootstrapped: true,
        message: "已登录",
      },
      backend: {
        ...base.backend,
        serverUrl: "http://127.0.0.1:8787",
        token: "token",
      } satisfies BackendConnectionState,
    };

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      rows: [],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const loaded = await loadTeamData(local);

    expect(loaded.projects).toEqual([]);
    expect(loaded.projectMembers).toEqual([]);
  });

  it("records hidden duplicate project member identities as aliases when loading team state", async () => {
    const base = createInitialState();
    const local = {
      ...base,
      auth: {
        status: "authenticated" as const,
        token: "token",
        account: {
          id: "account_owner",
          workspaceId: "workspace_test",
          name: "项目负责人",
          email: "owner@example.com",
          createdAt: iso("2026-06-30T06:00:00Z"),
          updatedAt: iso("2026-06-30T06:00:00Z"),
        },
        workspace: {
          id: "workspace_test",
          name: "测试团队",
          createdAt: iso("2026-06-30T06:00:00Z"),
          updatedAt: iso("2026-06-30T06:00:00Z"),
        },
        bootstrapped: true,
        message: "已登录",
      },
      backend: {
        ...base.backend,
        serverUrl: "http://127.0.0.1:8787",
        token: "token",
      } satisfies BackendConnectionState,
    };
    const canonicalProjectMember = {
      ...base.projectMembers[0],
      id: "member_account_owner",
      accountId: "account_owner",
      email: "owner@example.com",
      updatedAt: iso("2026-06-30T06:20:00Z"),
    };
    const duplicateProjectMember = {
      ...canonicalProjectMember,
      id: "member_owner_duplicate",
      updatedAt: iso("2026-06-30T06:10:00Z"),
    };

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      rows: [
        businessRow({
          workspace_id: "workspace_test",
          entity: "project",
          id: base.projects[0].id,
          updated_at: base.projects[0].updatedAt,
          payload: base.projects[0],
        }),
        businessRow({
          workspace_id: "workspace_test",
          entity: "project_member",
          id: canonicalProjectMember.id,
          updated_at: canonicalProjectMember.updatedAt,
          payload: canonicalProjectMember,
        }),
        businessRow({
          workspace_id: "workspace_test",
          entity: "project_member",
          id: duplicateProjectMember.id,
          updated_at: duplicateProjectMember.updatedAt,
          payload: duplicateProjectMember,
        }),
      ],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const loaded = await loadTeamData(local);

    expect(loaded.projectMembers.map((member) => member.id)).toEqual([canonicalProjectMember.id]);
  });
});
