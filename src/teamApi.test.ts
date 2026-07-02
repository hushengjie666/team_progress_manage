import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "./seed";
import { loadTeamState, teamChangesBetween } from "./teamApi";
import type { SyncRow } from "./sync";
import type { ActiveTimer, FocusSession, SyncState, Task, WorkSession } from "./types";

const iso = (value: string) => new Date(value).toISOString();

const syncRow = (row: Omit<SyncRow, "device_id" | "revision" | "version">): SyncRow => ({
  device_id: "remote",
  revision: 1,
  version: 1,
  ...row,
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("team backend state loading", () => {
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
      sync: {
        ...base.sync,
        serverUrl: "http://127.0.0.1:8787",
        token: "token",
      } satisfies SyncState,
    };

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      current_revision: 7,
      changes: [],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const loaded = await loadTeamState(local);

    expect(loaded.projects).toEqual([]);
    expect(loaded.projectMembers).toEqual([]);
  });

  it("preserves the local active timer when refreshing team state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T06:12:00Z"));
    const base = createInitialState();
    const task: Task = {
      id: "task_active",
      title: "刷新后仍在执行",
      notes: "",
      tags: [],
      projectId: base.projects[0].id,
      project: base.projects[0].name,
      creatorMemberId: base.projectMembers[0].id,
      primaryExecutorMemberId: base.projectMembers[0].id,
      collaboratorMemberIds: [],
      progressPercent: 0,
      progressNote: "",
      priority: "high",
      severity: "medium",
      stage: "development",
      estimatePomodoros: 2,
      status: "committed",
      repeatRule: "none",
      subtasks: [],
      sortOrder: 1,
      actualPomodoros: 0,
      estimateHistory: [],
      createdAt: iso("2026-06-30T06:00:00Z"),
      updatedAt: iso("2026-06-30T06:00:00Z"),
    };
    const localStartedTask = {
      ...task,
      status: "in_progress" as const,
      updatedAt: iso("2026-06-30T06:10:00Z"),
    };
    const focusSession: FocusSession = {
      id: "session_active",
      taskId: task.id,
      mode: "focus",
      duration: 25 * 60,
      startedAt: iso("2026-06-30T06:10:00Z"),
      interruptionCounts: { internal: 0, external: 0 },
    };
    const workSession: WorkSession = {
      id: "work_session_active",
      taskId: task.id,
      executorMemberId: base.projectMembers[0].id,
      focusSessionId: focusSession.id,
      status: "active",
      startedAt: focusSession.startedAt,
      totalPausedSeconds: 0,
      createdAt: focusSession.startedAt,
      updatedAt: focusSession.startedAt,
    };
    const activeTimer: ActiveTimer = {
      sessionId: focusSession.id,
      taskId: task.id,
      workSessionId: workSession.id,
      mode: "focus",
      duration: focusSession.duration,
      remaining: focusSession.duration,
      isRunning: true,
      startedAt: focusSession.startedAt,
      plannedEndAt: iso("2026-06-30T06:35:00Z"),
      totalPausedSeconds: 0,
      cycleIndex: 1,
      strictStarted: false,
    };
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
      sync: {
        ...base.sync,
        serverUrl: "http://127.0.0.1:8787",
        token: "token",
      } satisfies SyncState,
      tasks: [localStartedTask],
      focusSessions: [focusSession],
      workSessions: [workSession],
      activeTimer,
      updatedAt: iso("2026-06-30T06:10:00Z"),
    };

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      current_revision: 2,
      changes: [
        {
          entity: "task",
          id: task.id,
          device_id: "remote",
          updated_at: task.updatedAt,
          revision: 2,
          version: 1,
          payload: task,
        },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const loaded = await loadTeamState(local);

    expect(loaded.activeTimer?.sessionId).toBe(activeTimer.sessionId);
    expect(loaded.workSessions.find((session) => session.id === workSession.id)?.status).toBe("active");
    expect(loaded.focusSessions.some((session) => session.id === focusSession.id)).toBe(true);
    expect(loaded.tasks.find((item) => item.id === task.id)?.status).toBe("in_progress");
    expect(loaded.dailyPlans.some((plan) => plan.committedTaskIds.includes(task.id))).toBe(true);
  });

  it("sends a project-member tombstone when a project member is removed", () => {
    const base = createInitialState();
    const timestamp = iso("2026-06-30T07:00:00Z");
    const deleted = {
      ...base,
      projectMembers: [],
      sync: {
        ...base.sync,
        tombstones: [
          ...base.sync.tombstones,
          { entity: "project_member", id: base.projectMembers[0].id, deletedAt: timestamp },
        ],
      },
      updatedAt: timestamp,
    };

    const changes = teamChangesBetween(base, deleted);

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: "project_member",
          id: base.projectMembers[0].id,
          deleted_at: timestamp,
          payload: {},
        }),
      ]),
    );
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
      sync: {
        ...base.sync,
        serverUrl: "http://127.0.0.1:8787",
        token: "token",
      } satisfies SyncState,
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
      current_revision: 12,
      changes: [
        syncRow({
          entity: "project",
          id: base.projects[0].id,
          updated_at: base.projects[0].updatedAt,
          payload: base.projects[0],
        }),
        syncRow({
          entity: "project_member",
          id: canonicalProjectMember.id,
          updated_at: canonicalProjectMember.updatedAt,
          payload: canonicalProjectMember,
        }),
        syncRow({
          entity: "project_member",
          id: duplicateProjectMember.id,
          updated_at: duplicateProjectMember.updatedAt,
          payload: duplicateProjectMember,
        }),
      ],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const loaded = await loadTeamState(local);

    expect(loaded.projectMembers.map((member) => member.id)).toEqual([canonicalProjectMember.id]);
    expect(loaded.sync.entityAliases).toEqual(
      expect.arrayContaining([
        { entity: "project_member", id: duplicateProjectMember.id, canonicalId: canonicalProjectMember.id },
      ]),
    );
  });
});
