import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "./seed";
import { flattenStateToChanges, mergeRowsIntoState, syncAppState, type SyncRow } from "./sync";
import type { AppState, ExecutionSignal, Project, ProjectMember, Task, WorkSession } from "./types";

const iso = (value: string) => new Date(value).toISOString();

const teamState = (): AppState => {
  const state = createInitialState();
  const project: Project = {
    id: "project_sync",
    name: "同步项目",
    description: "跨设备团队项目",
    defaultExpectedStartHours: 6,
    createdAt: iso("2026-05-10T08:00:00Z"),
    updatedAt: iso("2026-05-10T08:01:00Z"),
  };
  const member: ProjectMember = {
    id: "member_sync",
    projectId: project.id,
    accountId: "account_sync",
    name: "执行者",
    email: "executor@example.com",
    roles: ["project_owner", "executor"],
    createdAt: iso("2026-05-10T08:02:00Z"),
    updatedAt: iso("2026-05-10T08:03:00Z"),
  };
  const task: Task = {
    ...state.tasks[0],
    id: "task_sync",
    title: "同步任务",
    projectId: project.id,
    project: project.name,
    creatorMemberId: member.id,
    primaryExecutorMemberId: member.id,
    expectedStartAt: iso("2026-05-10T09:00:00Z"),
    expectedFinishAt: iso("2026-05-10T18:00:00Z"),
    progressPercent: 65,
    progressNote: "接口联调中",
    status: "pending_review",
    reviewSubmittedAt: iso("2026-05-10T16:30:00Z"),
    reviewSubmittedByMemberId: member.id,
    updatedAt: iso("2026-05-10T16:30:00Z"),
  };
  const workSession: WorkSession = {
    id: "work_session_sync",
    taskId: task.id,
    executorMemberId: member.id,
    focusSessionId: "focus_sync",
    status: "active",
    startedAt: iso("2026-05-10T10:00:00Z"),
    totalPausedSeconds: 0,
    createdAt: iso("2026-05-10T10:00:00Z"),
    updatedAt: iso("2026-05-10T10:05:00Z"),
  };
  const signal: ExecutionSignal = {
    id: "signal_sync",
    workSessionId: workSession.id,
    taskId: task.id,
    executorMemberId: member.id,
    type: "work_started",
    createdAt: iso("2026-05-10T10:00:00Z"),
    payload: { mode: "focus" },
  };

  return {
    ...state,
    sync: { ...state.sync, deviceId: "device_local", token: "token" },
    projects: [project],
    projectMembers: [member],
    currentMemberId: member.id,
    tasks: [task],
    workSessions: [workSession],
    executionSignals: [signal],
    updatedAt: iso("2026-05-10T16:31:00Z"),
  };
};

const row = (patch: Partial<SyncRow> & Pick<SyncRow, "entity" | "id" | "payload" | "updated_at">): SyncRow => ({
  device_id: "device_remote",
  revision: 1,
  version: 1,
  deleted_at: undefined,
  ...patch,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("team progress sync", () => {
  it("represents team progress entities in push payloads", () => {
    const state = teamState();
    const changes = flattenStateToChanges(state);
    const byKey = new Map(changes.map((change) => [`${change.entity}:${change.id}`, change]));

    expect(byKey.get("project:project_sync")?.payload).toMatchObject({ name: "同步项目" });
    expect(byKey.get("project_member:member_sync")?.payload).toMatchObject({ roles: ["project_owner", "executor"] });
    expect(byKey.get("task:task_sync")?.payload).toMatchObject({
      primaryExecutorMemberId: "member_sync",
      expectedStartAt: iso("2026-05-10T09:00:00Z"),
      expectedFinishAt: iso("2026-05-10T18:00:00Z"),
      progressPercent: 65,
      progressNote: "接口联调中",
      status: "pending_review",
      reviewSubmittedAt: iso("2026-05-10T16:30:00Z"),
    });
    expect(byKey.get("work_session:work_session_sync")?.payload).toMatchObject({ status: "active", executorMemberId: "member_sync" });
    expect(byKey.get("execution_signal:signal_sync")?.payload).toMatchObject({ type: "work_started", payload: { mode: "focus" } });
  });

  it("pulls and merges project, member, assignment, work session, progress and acceptance state", () => {
    const local = createInitialState();
    const remote = teamState();
    const rows: SyncRow[] = [
      row({ entity: "project", id: remote.projects[0].id, updated_at: remote.projects[0].updatedAt, payload: remote.projects[0], revision: 2 }),
      row({ entity: "project_member", id: remote.projectMembers[0].id, updated_at: remote.projectMembers[0].updatedAt, payload: remote.projectMembers[0], revision: 3 }),
      row({ entity: "task", id: remote.tasks[0].id, updated_at: remote.tasks[0].updatedAt, payload: remote.tasks[0], revision: 4 }),
      row({ entity: "work_session", id: remote.workSessions[0].id, updated_at: remote.workSessions[0].updatedAt, payload: remote.workSessions[0], revision: 5 }),
      row({ entity: "execution_signal", id: remote.executionSignals[0].id, updated_at: remote.executionSignals[0].createdAt, payload: remote.executionSignals[0], revision: 6 }),
    ];

    const merged = mergeRowsIntoState(local, rows, 6);

    expect(merged.projects.find((project) => project.id === "project_sync")).toMatchObject({ defaultExpectedStartHours: 6 });
    expect(merged.projectMembers.find((member) => member.id === "member_sync")).toMatchObject({ projectId: "project_sync" });
    expect(merged.tasks.find((task) => task.id === "task_sync")).toMatchObject({
      projectId: "project_sync",
      primaryExecutorMemberId: "member_sync",
      progressPercent: 65,
      progressNote: "接口联调中",
      status: "pending_review",
      reviewSubmittedByMemberId: "member_sync",
    });
    expect(merged.workSessions.find((session) => session.id === "work_session_sync")).toMatchObject({ taskId: "task_sync" });
    expect(merged.executionSignals.find((signal) => signal.id === "signal_sync")).toMatchObject({ workSessionId: "work_session_sync" });
    expect(merged.sync.lastPulledRevision).toBe(6);
  });

  it("keeps a locally completed onboarding from being reverted by remote setup state", () => {
    const base = teamState();
    const local = {
      ...base,
      onboarding: {
        ...base.onboarding,
        completed: true,
      },
      updatedAt: iso("2026-06-10T10:00:00Z"),
    };
    const remoteOnboarding = {
      ...local.onboarding,
      completed: false,
    };

    const merged = mergeRowsIntoState(
      local,
      [
        row({
          entity: "onboarding",
          id: "default",
          updated_at: iso("2026-06-10T10:05:00Z"),
          payload: remoteOnboarding,
          revision: 12,
        }),
      ],
      12,
    );

    expect(merged.onboarding.completed).toBe(true);
  });

  it("applies tombstones for team progress entities", () => {
    const state = teamState();
    const rows: SyncRow[] = [
      row({ entity: "project_member", id: "member_sync", updated_at: iso("2026-05-11T08:00:00Z"), deleted_at: iso("2026-05-11T08:00:00Z"), payload: {}, revision: 7 }),
      row({ entity: "work_session", id: "work_session_sync", updated_at: iso("2026-05-11T08:01:00Z"), deleted_at: iso("2026-05-11T08:01:00Z"), payload: {}, revision: 8 }),
      row({ entity: "execution_signal", id: "signal_sync", updated_at: iso("2026-05-11T08:02:00Z"), deleted_at: iso("2026-05-11T08:02:00Z"), payload: {}, revision: 9 }),
      row({ entity: "project", id: "project_sync", updated_at: iso("2026-05-11T08:03:00Z"), deleted_at: iso("2026-05-11T08:03:00Z"), payload: {}, revision: 10 }),
    ];

    const merged = mergeRowsIntoState(state, rows, 10);

    expect(merged.projects.some((project) => project.id === "project_sync")).toBe(false);
    expect(merged.projectMembers.some((member) => member.id === "member_sync")).toBe(false);
    expect(merged.tasks[0]).toMatchObject({ creatorMemberId: undefined, primaryExecutorMemberId: undefined, collaboratorMemberIds: [] });
    expect(merged.workSessions.some((session) => session.id === "work_session_sync")).toBe(false);
    expect(merged.executionSignals.some((signal) => signal.id === "signal_sync")).toBe(false);
  });

  it("reports conflicts for team progress entities", async () => {
    const state = teamState();
    const remoteMember = { ...state.projectMembers[0], name: "远端执行者", updatedAt: iso("2026-05-10T17:00:00Z") };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accepted: [],
          conflicts: [row({ entity: "project_member", id: "member_sync", updated_at: remoteMember.updatedAt, payload: remoteMember, revision: 11 })],
          current_revision: 11,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ changes: [], current_revision: 11 }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const synced = await syncAppState(state);

    expect(synced.sync.conflicts[0]).toMatchObject({
      entity: "project_member",
      id: "member_sync",
      localUpdatedAt: state.projectMembers[0].updatedAt,
      remoteUpdatedAt: remoteMember.updatedAt,
      revision: 11,
      remotePayload: remoteMember,
    });
  });
});
