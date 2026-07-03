import { createInitialState } from "../seed";
import type { SyncRow } from "../sync";
import type { AppState, ExecutionSignal, Project, ProjectMember, Task, WorkSession } from "../types";

export const iso = (value: string) => new Date(value).toISOString();

export const teamState = (): AppState => {
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
    tasks: [task],
    workSessions: [workSession],
    executionSignals: [signal],
    updatedAt: iso("2026-05-10T16:31:00Z"),
  };
};

export const row = (patch: Partial<SyncRow> & Pick<SyncRow, "entity" | "id" | "payload" | "updated_at">): SyncRow => ({
  device_id: "device_remote",
  revision: 1,
  version: 1,
  deleted_at: undefined,
  ...patch,
});
