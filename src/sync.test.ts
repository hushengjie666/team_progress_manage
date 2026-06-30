import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState, todayKey } from "./seed";
import { flattenStateToChanges, mergeRowsIntoState, mergeSyncedStateIntoLatest, REQUIRED_FULL_RECONCILE_VERSION, syncableStateFingerprint, syncAppState, type SyncRow } from "./sync";
import type { AppState, ExecutionSignal, Project, ProjectMember, Task, TeamMember, WorkSession } from "./types";

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
  it("deduplicates pulled team members by login identity", () => {
    const base = createInitialState();
    const existingMember: TeamMember = {
      id: "team_member_wangshuo",
      accountId: "account_wangshuo",
      name: "王硕",
      email: "wangshuo",
      status: "active",
      createdAt: iso("2026-06-18T09:00:00Z"),
      updatedAt: iso("2026-06-18T09:00:00Z"),
    };
    const duplicateMember: TeamMember = {
      ...existingMember,
      id: "team_member_duplicate",
      accountId: undefined,
      updatedAt: iso("2026-06-18T10:00:00Z"),
    };
    const projectMember: ProjectMember = {
      ...base.projectMembers[0],
      id: "project_member_wangshuo",
      teamMemberId: existingMember.id,
      accountId: existingMember.accountId,
      name: existingMember.name,
      email: existingMember.email,
      roles: ["executor"],
      updatedAt: iso("2026-06-18T09:05:00Z"),
    };

    const merged = mergeRowsIntoState(
      {
        ...base,
        teamMembers: [existingMember],
        projectMembers: [projectMember],
        currentMemberId: projectMember.id,
        updatedAt: iso("2026-06-18T09:10:00Z"),
      },
      [
        row({
          entity: "team_member",
          id: duplicateMember.id,
          updated_at: duplicateMember.updatedAt,
          payload: duplicateMember,
          revision: 50,
        }),
      ],
      50,
    );

    expect(merged.teamMembers.filter((member) => member.email?.toLowerCase() === "wangshuo")).toHaveLength(1);
    expect(merged.teamMembers[0]).toMatchObject({ id: existingMember.id, accountId: existingMember.accountId });
    expect(merged.projectMembers[0].teamMemberId).toBe(existingMember.id);
  });

  it("deduplicates team members when a full synced snapshot is merged back into the latest state", () => {
    const source = teamState();
    const existingMember: TeamMember = {
      id: "team_member_owner_a",
      accountId: "account_owner_a",
      name: "项目负责人",
      email: "owner@example.com",
      status: "active",
      createdAt: iso("2026-06-18T09:00:00Z"),
      updatedAt: iso("2026-06-18T09:00:00Z"),
    };
    const duplicateMember: TeamMember = {
      ...existingMember,
      id: "team_member_owner_b",
      accountId: undefined,
      updatedAt: iso("2026-06-18T09:30:00Z"),
    };
    const projectMember: ProjectMember = {
      ...source.projectMembers[0],
      teamMemberId: existingMember.id,
      accountId: existingMember.accountId,
      email: existingMember.email,
      name: existingMember.name,
      roles: ["executor"],
    };
    const synced = {
      ...source,
      teamMembers: [existingMember, duplicateMember],
      projectMembers: [projectMember],
      updatedAt: iso("2026-06-18T09:35:00Z"),
    };

    const merged = mergeSyncedStateIntoLatest(source, source, synced);

    expect(merged.teamMembers.filter((member) => member.email?.toLowerCase() === "owner@example.com")).toHaveLength(1);
    expect(merged.projectMembers[0].teamMemberId).toBe(existingMember.id);
  });

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

  it("pushes only rows changed after the last successful sync when requested", () => {
    const state = teamState();
    const changed = {
      ...state,
      sync: {
        ...state.sync,
        tombstones: [
          { entity: "task", id: "task_old_deleted", deletedAt: iso("2026-05-10T16:20:00Z") },
          { entity: "task", id: "task_new_deleted", deletedAt: iso("2026-05-10T16:45:00Z") },
        ],
      },
      tasks: state.tasks.map((task) =>
        task.id === "task_sync"
          ? {
              ...task,
              progressPercent: 90,
              updatedAt: iso("2026-05-10T16:40:00Z"),
            }
          : task,
      ),
    };

    const changes = flattenStateToChanges(changed, { changedAfter: iso("2026-05-10T16:35:00Z") });
    const keys = changes.map((change) => `${change.entity}:${change.id}`);

    expect(keys).toContain("task:task_sync");
    expect(keys).toContain("task:task_new_deleted");
    expect(keys).not.toContain("project:project_sync");
    expect(keys).not.toContain("task:task_old_deleted");
  });

  it("still pushes active work sessions and their tasks when their timestamps are older than last sync", () => {
    const state = teamState();
    const changes = flattenStateToChanges(state, { changedAfter: iso("2026-05-10T16:35:00Z") });
    const keys = changes.map((change) => `${change.entity}:${change.id}`);

    expect(keys).toContain("work_session:work_session_sync");
    expect(keys).toContain("task:task_sync");
    expect(keys).not.toContain("project:project_sync");
  });

  it("repairs a missing active work session before pushing sync changes", async () => {
    const state = teamState();
    const inconsistent: AppState = {
      ...state,
      workSessions: [],
      executionSignals: [],
      activeTimer: {
        sessionId: "focus_missing_sync",
        taskId: state.tasks[0].id,
        mode: "focus",
        duration: 1500,
        remaining: 1200,
        isRunning: true,
        startedAt: `${todayKey()}T16:40:00.000Z`,
        plannedEndAt: `${todayKey()}T17:05:00.000Z`,
        totalPausedSeconds: 0,
        cycleIndex: 1,
        strictStarted: false,
      },
      sync: {
        ...state.sync,
        lastSyncedAt: iso("2026-05-10T16:50:00Z"),
        lastFullReconcileVersion: REQUIRED_FULL_RECONCILE_VERSION,
      },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accepted: [], conflicts: [], current_revision: 80 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ changes: [], current_revision: 80 }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const synced = await syncAppState(inconsistent);
    const pushBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { changes: SyncRow[] };
    const keys = pushBody.changes.map((change) => `${change.entity}:${change.id}`);

    expect(keys).toContain(`task:${state.tasks[0].id}`);
    expect(pushBody.changes.some((change) => change.entity === "work_session" && (change.payload as WorkSession).status === "active")).toBe(true);
    expect(pushBody.changes.some((change) => change.entity === "execution_signal" && (change.payload as ExecutionSignal).type === "work_started")).toBe(true);
    expect(synced.workSessions[0]).toMatchObject({
      taskId: state.tasks[0].id,
      focusSessionId: "focus_missing_sync",
      status: "active",
    });
  });

  it("keeps the sync fingerprint stable for sync-only timestamps", () => {
    const state = teamState();
    const changedStatus = {
      ...state,
      updatedAt: iso("2026-05-10T16:35:00Z"),
      sync: {
        ...state.sync,
        status: "syncing" as const,
        message: "正在同步",
        lastSyncedAt: iso("2026-05-10T16:35:00Z"),
      },
    };

    expect(syncableStateFingerprint(changedStatus)).toBe(syncableStateFingerprint(state));
  });

  it("changes the sync fingerprint when syncable task payload changes", () => {
    const state = teamState();
    const changedTask = {
      ...state,
      tasks: state.tasks.map((task) =>
        task.id === "task_sync"
          ? {
              ...task,
              progressPercent: 90,
              updatedAt: iso("2026-05-10T16:40:00Z"),
            }
          : task,
      ),
    };

    expect(syncableStateFingerprint(changedTask)).not.toBe(syncableStateFingerprint(state));
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

  it("merges pulled daily plan rows even when the device id matches local state", () => {
    const local = teamState();
    const localPlan = {
      ...local.dailyPlans[0],
      id: "plan_2026-06-18",
      date: "2026-06-18",
      committedTaskIds: ["task_local_today"],
      updatedAt: iso("2026-06-18T09:00:00Z"),
    };
    const remotePlan = {
      ...localPlan,
      committedTaskIds: ["task_local_today", "task_remote_today"],
      updatedAt: iso("2026-06-18T09:30:00Z"),
    };

    const merged = mergeRowsIntoState(
      { ...local, dailyPlans: [localPlan], sync: { ...local.sync, deviceId: "device_shared" } },
      [
        row({
          entity: "daily_plan",
          id: remotePlan.id,
          device_id: "device_shared",
          updated_at: remotePlan.updatedAt,
          payload: remotePlan,
          revision: 30,
        }),
      ],
      30,
    );

    expect(merged.dailyPlans[0].committedTaskIds).toEqual(["task_local_today", "task_remote_today"]);
    expect(merged.sync.lastPulledRevision).toBe(30);
  });

  it("applies newer daily plan removals from remote sync", () => {
    const local = teamState();
    const localPlan = {
      ...local.dailyPlans[0],
      id: "plan_2026-06-18",
      date: "2026-06-18",
      committedTaskIds: ["task_keep_today", "task_removed_today"],
      updatedAt: iso("2026-06-18T09:00:00Z"),
    };
    const remotePlan = {
      ...localPlan,
      committedTaskIds: ["task_keep_today"],
      updatedAt: iso("2026-06-18T09:30:00Z"),
    };

    const merged = mergeRowsIntoState(
      { ...local, dailyPlans: [localPlan] },
      [
        row({
          entity: "daily_plan",
          id: remotePlan.id,
          updated_at: remotePlan.updatedAt,
          payload: remotePlan,
          revision: 31,
        }),
      ],
      31,
    );

    expect(merged.dailyPlans[0].committedTaskIds).toEqual(["task_keep_today"]);
  });

  it("removes today queue tasks through the full pull sync flow", async () => {
    const local = teamState();
    const localPlan = {
      ...local.dailyPlans[0],
      id: "plan_2026-06-18",
      date: "2026-06-18",
      committedTaskIds: ["task_keep_today", "task_removed_today"],
      updatedAt: iso("2026-06-18T09:00:00Z"),
    };
    const remotePlan = {
      ...localPlan,
      committedTaskIds: ["task_keep_today"],
      updatedAt: iso("2026-06-18T09:30:00Z"),
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accepted: [],
          conflicts: [],
          current_revision: 30,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          changes: [
            row({
              entity: "daily_plan",
              id: remotePlan.id,
              updated_at: remotePlan.updatedAt,
              payload: remotePlan,
              revision: 31,
            }),
          ],
          current_revision: 31,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const synced = await syncAppState({ ...local, dailyPlans: [localPlan], sync: { ...local.sync, lastPulledRevision: 30 } });

    expect(synced.dailyPlans[0].committedTaskIds).toEqual(["task_keep_today"]);
    expect(synced.sync.lastPulledRevision).toBe(31);
  });

  it("does a versioned full reconciliation and lets remote rows repair stale local task status", async () => {
    const local = teamState();
    const staleTask = {
      ...local.tasks[0],
      status: "pending_review" as const,
      reviewSubmittedAt: iso("2026-05-10T16:30:00Z"),
      reviewAcceptedAt: undefined,
      reviewAcceptedByMemberId: undefined,
      completedAt: undefined,
      updatedAt: iso("2026-05-10T16:40:00Z"),
    };
    const remoteCompletedTask = {
      ...staleTask,
      status: "completed" as const,
      reviewAcceptedAt: iso("2026-05-10T16:35:00Z"),
      reviewAcceptedByMemberId: "member_sync",
      completedAt: iso("2026-05-10T16:35:00Z"),
      updatedAt: iso("2026-05-10T16:35:00Z"),
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accepted: [],
          conflicts: [],
          current_revision: 100,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          changes: [
            row({
              entity: "task",
              id: remoteCompletedTask.id,
              updated_at: remoteCompletedTask.updatedAt,
              payload: remoteCompletedTask,
              revision: 50,
            }),
          ],
          current_revision: 100,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const synced = await syncAppState({
      ...local,
      tasks: [staleTask],
      workSessions: [],
      sync: {
        ...local.sync,
        lastPulledRevision: 100,
        lastSyncedAt: iso("2026-05-10T16:50:00Z"),
        lastFullPulledAt: iso("2026-05-10T16:55:00Z"),
        lastFullReconcileVersion: REQUIRED_FULL_RECONCILE_VERSION - 1,
      },
    });

    const pushBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { changes: SyncRow[] };
    expect(pushBody.changes.some((change) => change.entity === "task" && change.id === staleTask.id)).toBe(false);
    expect(String(fetchMock.mock.calls[1][0])).toContain("/sync/pull?since=0");
    expect(synced.tasks[0]).toMatchObject({
      status: "completed",
      reviewAcceptedAt: iso("2026-05-10T16:35:00Z"),
      completedAt: iso("2026-05-10T16:35:00Z"),
    });
    expect(synced.sync.lastFullPulledAt).toBeDefined();
    expect(synced.sync.lastFullReconcileVersion).toBe(REQUIRED_FULL_RECONCILE_VERSION);
  });

  it("keeps local changes made while a sync request is in flight", () => {
    const source = teamState();
    const synced = {
      ...source,
      sync: {
        ...source.sync,
        status: "synced" as const,
        lastPulledRevision: 42,
        lastSyncedAt: iso("2026-06-18T09:30:00Z"),
      },
      tasks: source.tasks.map((task) =>
        task.id === "task_sync"
          ? {
              ...task,
              title: "远端同步结果",
              updatedAt: iso("2026-06-18T09:30:00Z"),
            }
          : task,
      ),
      updatedAt: iso("2026-06-18T09:30:00Z"),
    };
    const latest = {
      ...source,
      tasks: source.tasks.map((task) =>
        task.id === "task_sync"
          ? {
              ...task,
              title: "同步期间本地修改",
              updatedAt: iso("2026-06-18T09:31:00Z"),
            }
          : task,
      ),
      updatedAt: iso("2026-06-18T09:31:00Z"),
    };

    const merged = mergeSyncedStateIntoLatest(latest, source, synced);

    expect(merged.tasks[0].title).toBe("同步期间本地修改");
    expect(merged.sync.lastPulledRevision).toBe(42);
  });

  it("keeps full reconcile task repairs when only sync status changed in flight", () => {
    const source = teamState();
    const staleTask = {
      ...source.tasks[0],
      status: "pending_review" as const,
      reviewSubmittedAt: iso("2026-05-10T16:30:00Z"),
      reviewAcceptedAt: undefined,
      completedAt: undefined,
      updatedAt: iso("2026-05-10T16:40:00Z"),
    };
    const remoteCompletedTask = {
      ...staleTask,
      status: "completed" as const,
      reviewAcceptedAt: iso("2026-05-10T16:35:00Z"),
      completedAt: iso("2026-05-10T16:35:00Z"),
      updatedAt: iso("2026-05-10T16:35:00Z"),
    };
    const requestSource = { ...source, tasks: [staleTask] };
    const latest = {
      ...requestSource,
      sync: {
        ...requestSource.sync,
        status: "syncing" as const,
        message: "正在推送与拉取变更",
      },
    };
    const synced = {
      ...requestSource,
      sync: {
        ...requestSource.sync,
        status: "synced" as const,
        lastFullReconcileVersion: REQUIRED_FULL_RECONCILE_VERSION,
      },
      tasks: [remoteCompletedTask],
    };

    const merged = mergeSyncedStateIntoLatest(latest, requestSource, synced);

    expect(merged.tasks[0]).toMatchObject({
      status: "completed",
      reviewAcceptedAt: iso("2026-05-10T16:35:00Z"),
      completedAt: iso("2026-05-10T16:35:00Z"),
    });
  });

  it("does not resurrect remote-deleted rows when latest local state is unchanged", () => {
    const source = teamState();
    const synced = {
      ...source,
      tasks: [],
      sync: {
        ...source.sync,
        status: "synced" as const,
        lastPulledRevision: 43,
      },
      updatedAt: iso("2026-06-18T09:30:00Z"),
    };

    const merged = mergeSyncedStateIntoLatest(source, source, synced);

    expect(merged.tasks).toHaveLength(0);
    expect(merged.sync.lastPulledRevision).toBe(43);
  });

  it("keeps local deletions made while a sync request is in flight", () => {
    const source = teamState();
    const synced = {
      ...source,
      sync: {
        ...source.sync,
        status: "synced" as const,
        lastPulledRevision: 44,
      },
      updatedAt: iso("2026-06-18T09:30:00Z"),
    };
    const latest = {
      ...source,
      tasks: [],
      sync: {
        ...source.sync,
        tombstones: [{ entity: "task" as const, id: "task_sync", deletedAt: iso("2026-06-18T09:31:00Z") }],
      },
      updatedAt: iso("2026-06-18T09:31:00Z"),
    };

    const merged = mergeSyncedStateIntoLatest(latest, source, synced);

    expect(merged.tasks).toHaveLength(0);
    expect(merged.sync.tombstones).toEqual([{ entity: "task", id: "task_sync", deletedAt: iso("2026-06-18T09:31:00Z") }]);
    expect(merged.sync.lastPulledRevision).toBe(44);
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
