import { today } from "../appModel";
import type { DailyPlan, Project, ProjectMember, Task, WorkspaceMembership } from "../types";

export const memberStatusTimestamp = "2026-06-30T08:00:00.000Z";

export const memberStatusProject = (id: string, name: string, overrides: Partial<Project> = {}): Project => ({
  id,
  name,
  description: "",
  defaultExpectedStartHours: 24,
  createdAt: memberStatusTimestamp,
  updatedAt: memberStatusTimestamp,
  ...overrides,
});

export const memberStatusMember = (overrides: Partial<ProjectMember> & Pick<ProjectMember, "id" | "projectId">): ProjectMember => ({
  id: overrides.id,
  projectId: overrides.projectId,
  accountId: overrides.accountId ?? "account_hushengjie",
  name: overrides.name ?? "胡圣杰",
  email: overrides.email ?? "hushengjie@example.com",
  roles: overrides.roles ?? ["project_owner", "executor"],
  status: overrides.status ?? "active",
  createdAt: memberStatusTimestamp,
  updatedAt: memberStatusTimestamp,
});

export const memberStatusTask = (overrides: Partial<Task> & Pick<Task, "id" | "projectId" | "project" | "primaryExecutorMemberId">): Task => ({
  id: overrides.id,
  title: overrides.title ?? "今日任务",
  notes: "",
  tags: [],
  projectId: overrides.projectId,
  project: overrides.project,
  primaryExecutorMemberId: overrides.primaryExecutorMemberId,
  collaboratorMemberIds: overrides.collaboratorMemberIds ?? [],
  progressPercent: overrides.progressPercent ?? 0,
  priority: overrides.priority ?? "medium",
  severity: overrides.severity ?? "medium",
  stage: overrides.stage ?? "requirements",
  estimatePomodoros: overrides.estimatePomodoros ?? 1,
  status: overrides.status ?? "committed",
  subtasks: [],
  sortOrder: overrides.sortOrder ?? 0,
  actualPomodoros: 0,
  estimateHistory: [],
  createdAt: memberStatusTimestamp,
  updatedAt: memberStatusTimestamp,
});

export const memberStatusDailyPlan = (committedTaskIds: string[]): DailyPlan => ({
  id: "plan_today",
  date: today(),
  capacityPomodoros: 8,
  committedTaskIds,
  completedPomodoros: 0,
  suggestedTaskIds: [],
  reflection: "",
  review: {
    mood: "normal",
    wins: "",
    blockers: "",
    interruptionPattern: "",
    tomorrowFocus: "",
  },
  createdAt: memberStatusTimestamp,
  updatedAt: memberStatusTimestamp,
});

export const memberStatusWorkspaceMembership = (overrides: Pick<WorkspaceMembership, "id" | "workspaceId" | "accountId" | "name" | "email"> & Partial<WorkspaceMembership>): WorkspaceMembership => ({
  id: overrides.id,
  workspaceId: overrides.workspaceId,
  accountId: overrides.accountId,
  name: overrides.name,
  email: overrides.email,
  role: overrides.role ?? "member",
  status: overrides.status ?? "active",
  createdAt: memberStatusTimestamp,
  updatedAt: memberStatusTimestamp,
});
