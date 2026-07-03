import { describe, expect, it } from "vitest";
import { normalizeAppStatePayload } from "./storage";
import { createInitialState } from "./test/fixtures";

describe("data normalization", () => {
  it("preserves archived task status during current-schema normalization", () => {
    const state = createInitialState();
    const parent = {
      ...state.tasks[0],
      id: "legacy_split_parent",
      title: "旧拆分主任务",
      status: "archived" as const,
      projectId: state.projects[0].id,
    };
    const child = {
      ...state.tasks[1],
      id: "legacy_split_child",
      title: "旧拆分主任务 1",
      notes: "由「旧拆分主任务」拆分而来。",
      projectId: state.projects[0].id,
    };

    const normalized = normalizeAppStatePayload({ ...state, tasks: [parent, child] });

    expect(normalized.tasks.find((task) => task.id === "legacy_split_parent")?.status).toBe("archived");
  });

  it("resets unsupported legacy personal task payloads", () => {
    const legacy = {
      version: 1,
      tasks: [
        {
          id: "legacy_task",
          title: "旧任务",
          notes: "",
          tags: [],
          project: "旧项目标签",
          priority: "medium" as const,
          severity: "medium" as const,
          estimatePomodoros: 1,
          status: "pool" as const,
          subtasks: [],
          sortOrder: 10,
          actualPomodoros: 0,
          estimateHistory: [],
          createdAt: "2026-05-10T10:00:00.000Z",
          updatedAt: "2026-05-10T10:00:00.000Z",
        },
      ],
    };
    const normalized = normalizeAppStatePayload(legacy);
    expect(normalized.version).toBe(createInitialState().version);
    expect(normalized.tasks.some((task) => task.id === "legacy_task")).toBe(false);
  });

  it("keeps the same account as separate project bindings across workspaces", () => {
    const state = createInitialState();
    const normalized = normalizeAppStatePayload({
      ...state,
      projects: [
        {
          ...state.projects[0],
          id: "project_workspace_a",
          workspaceId: "workspace_a",
        },
        {
          ...state.projects[0],
          id: "project_workspace_b",
          workspaceId: "workspace_b",
        },
      ],
      projectMembers: [
        { ...state.projectMembers[0], id: "member_workspace_a", projectId: "project_workspace_a", workspaceId: "workspace_a" },
        { ...state.projectMembers[0], id: "member_workspace_b", projectId: "project_workspace_b", workspaceId: "workspace_b" },
      ],
    });

    expect(normalized.projectMembers.filter((member) => member.accountId === "account_owner")).toHaveLength(2);
  });

  it("keeps project member workspace aligned with its project", () => {
    const state = createInitialState();
    const normalized = normalizeAppStatePayload({
      ...state,
      projects: [
        {
          ...state.projects[0],
          id: "project_workspace_b",
          workspaceId: "workspace_b",
        },
      ],
      projectMembers: [
        {
          ...state.projectMembers[0],
          id: "member_workspace_b_owner",
          workspaceId: "workspace_b",
          projectId: "project_workspace_b",
          accountId: "account_owner",
          email: "owner@example.com",
        },
      ],
    });

    expect(normalized.projectMembers[0]).toMatchObject({
      workspaceId: "workspace_b",
      accountId: "account_owner",
    });
  });

  it("preserves sync switches during current-schema normalization", () => {
    const state = createInitialState();
    const normalized = normalizeAppStatePayload({
      ...state,
      auth: {
        status: "authenticated",
        token: "stored_auth_token",
        bootstrapped: true,
        message: "已登录",
        account: {
          id: "account_wangshuo",
          workspaceId: "workspace_test",
          name: "王硕",
          email: "wangshuo@example.com",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      sync: {
        ...state.sync,
        token: undefined,
      },
    });

    expect(normalized.sync.token).toBeUndefined();
  });

  it("deduplicates project member bindings for the same project and login identity", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const normalized = normalizeAppStatePayload({
      ...state,
      projectMembers: [
        {
          ...state.projectMembers[0],
          id: "member_wangshuo_old",
          projectId,
          accountId: "account_wangshuo",
          name: "王硕",
          email: "wangshuo",
          roles: ["project_owner", "executor"],
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
        {
          ...state.projectMembers[0],
          id: "member_wangshuo_latest",
          projectId,
          accountId: "account_wangshuo",
          name: "王硕",
          email: "wangshuo",
          roles: ["executor"],
          updatedAt: "2026-05-10T11:00:00.000Z",
        },
      ],
    });

    expect(normalized.projectMembers.filter((member) => member.accountId === "account_wangshuo")).toHaveLength(1);
    expect(normalized.projectMembers[0]).toMatchObject({ id: "member_wangshuo_latest", roles: ["executor"] });
  });

  it("does not backfill missing current-schema task fields", () => {
    const state = createInitialState();
    const legacyTask = { ...state.tasks[0] };
    delete (legacyTask as Partial<typeof legacyTask>).stage;
    const normalized = normalizeAppStatePayload({ ...state, tasks: [legacyTask] });

    expect(normalized.tasks[0].stage).toBeUndefined();
  });

  it("preserves regular task stages when normalizing tasks", () => {
    const state = createInitialState();
    const normalized = normalizeAppStatePayload({
      ...state,
      tasks: [{ ...state.tasks[0], stage: "execution" }],
    });

    expect(normalized.tasks[0].stage).toBe("execution");
  });

  it("does not transfer project owner role when repairing duplicated project member identities", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const normalized = normalizeAppStatePayload({
      ...state,
      auth: {
        ...state.auth,
        account: {
          id: "account_wangshuo",
          workspaceId: "workspace_test",
          name: "王硕",
          email: "wangshuo",
          createdAt: "2026-05-10T10:00:00.000Z",
          updatedAt: "2026-05-10T10:00:00.000Z",
        },
      },
      projectMembers: [
        {
          id: "member_stale_owner",
          projectId,
          accountId: "account_owner",
          name: "王硕",
          email: "wangshuo",
          roles: ["project_owner", "executor"],
          status: "active",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
        {
          id: "member_wangshuo",
          projectId,
          accountId: "account_wangshuo",
          name: "王硕",
          email: "wangshuo",
          roles: ["executor"],
          status: "active",
          createdAt: "2026-05-10T10:00:00.000Z",
          updatedAt: "2026-05-10T10:00:00.000Z",
        },
      ],
    });

    expect(normalized.projectMembers.filter((member) => member.email === "wangshuo")).toHaveLength(1);
    expect(normalized.projectMembers[0]).toMatchObject({
      accountId: "account_wangshuo",
      roles: ["executor"],
    });
  });
});
