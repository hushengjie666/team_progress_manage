import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed";
import {
  mergeRowsIntoState,
  type SyncRow,
} from "./sync";
import { iso, row, teamState } from "./test/syncFixtures";
import type { AppState, Project, ProjectMember, Task } from "./types";

describe("team progress sync merge", () => {
  it("ignores unsupported pulled rows", () => {
    const base = createInitialState();
    const projectMember: ProjectMember = {
      ...base.projectMembers[0],
      id: "project_member_wangshuo",
      accountId: "account_wangshuo",
      name: "王硕",
      email: "wangshuo",
      roles: ["executor"],
      updatedAt: iso("2026-06-18T09:05:00Z"),
    };

    const merged = mergeRowsIntoState(
      {
        ...base,
        projectMembers: [projectMember],
        updatedAt: iso("2026-06-18T09:10:00Z"),
      },
      [
        row({
          entity: "unsupported_legacy_entity" as SyncRow["entity"],
          id: "legacy_wangshuo",
          updated_at: iso("2026-06-18T10:00:00Z"),
          payload: {
            id: "legacy_wangshuo",
            accountId: "account_wangshuo",
            name: "王硕",
            email: "wangshuo",
            status: "active",
            createdAt: iso("2026-06-18T09:00:00Z"),
            updatedAt: iso("2026-06-18T10:00:00Z"),
          } as unknown as SyncRow["payload"],
          revision: 50,
        }),
      ],
      50,
    );

    expect(merged.projectMembers).toHaveLength(1);
    expect(merged.projectMembers[0]).toMatchObject({
      id: "project_member_wangshuo",
      accountId: "account_wangshuo",
      email: "wangshuo",
    });
  });

  it("injects workspace ids from pulled team rows", () => {
    const base = createInitialState();
    const merged = mergeRowsIntoState(
      base,
      [
        row({
          workspace_id: "workspace_shared",
          entity: "project",
          id: "project_remote",
          updated_at: iso("2026-07-01T08:00:00Z"),
          payload: {
            id: "project_remote",
            name: "远端项目",
            description: "",
            defaultExpectedStartHours: 24,
            createdAt: iso("2026-07-01T08:00:00Z"),
            updatedAt: iso("2026-07-01T08:00:00Z"),
          },
        }),
      ],
      1,
      { forceRemote: true },
    );

    expect(merged.projects.find((project) => project.id === "project_remote")?.workspaceId).toBe("workspace_shared");
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

  it("keeps moved workspace rows when old workspace tombstones are pulled later", () => {
    const base = teamState();
    const sourceWorkspaceId = "workspace_source";
    const targetWorkspaceId = "workspace_target";
    const movedProject: Project = {
      ...base.projects[0],
      workspaceId: targetWorkspaceId,
      updatedAt: iso("2026-07-02T09:10:00Z"),
    };
    const movedMember: ProjectMember = {
      ...base.projectMembers[0],
      workspaceId: targetWorkspaceId,
      projectId: movedProject.id,
      updatedAt: iso("2026-07-02T09:11:00Z"),
    };
    const movedTask: Task = {
      ...base.tasks[0],
      workspaceId: targetWorkspaceId,
      projectId: movedProject.id,
      project: movedProject.name,
      primaryExecutorMemberId: movedMember.id,
      updatedAt: iso("2026-07-02T09:12:00Z"),
    };
    const state: AppState = {
      ...base,
      projects: [],
      projectMembers: [],
      tasks: [],
      workSessions: [],
      executionSignals: [],
    };
    const rows: SyncRow[] = [
      row({ workspace_id: targetWorkspaceId, entity: "project", id: movedProject.id, updated_at: movedProject.updatedAt, payload: movedProject, revision: 40 }),
      row({ workspace_id: targetWorkspaceId, entity: "project_member", id: movedMember.id, updated_at: movedMember.updatedAt, payload: movedMember, revision: 41 }),
      row({ workspace_id: targetWorkspaceId, entity: "task", id: movedTask.id, updated_at: movedTask.updatedAt, payload: movedTask, revision: 42 }),
      row({ workspace_id: sourceWorkspaceId, entity: "project", id: movedProject.id, updated_at: iso("2026-07-02T09:13:00Z"), deleted_at: iso("2026-07-02T09:13:00Z"), payload: {}, revision: 43 }),
      row({ workspace_id: sourceWorkspaceId, entity: "project_member", id: movedMember.id, updated_at: iso("2026-07-02T09:14:00Z"), deleted_at: iso("2026-07-02T09:14:00Z"), payload: {}, revision: 44 }),
      row({ workspace_id: sourceWorkspaceId, entity: "task", id: movedTask.id, updated_at: iso("2026-07-02T09:15:00Z"), deleted_at: iso("2026-07-02T09:15:00Z"), payload: {}, revision: 45 }),
    ];

    const merged = mergeRowsIntoState(state, rows, 45, { forceRemote: true });

    expect(merged.projects.find((project) => project.id === movedProject.id)).toMatchObject({ workspaceId: targetWorkspaceId });
    expect(merged.projectMembers.find((member) => member.id === movedMember.id)).toMatchObject({ workspaceId: targetWorkspaceId });
    expect(merged.tasks.find((task) => task.id === movedTask.id)).toMatchObject({ workspaceId: targetWorkspaceId });
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
});
