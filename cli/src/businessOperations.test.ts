import { describe, expect, it } from "vitest";
import { createInitialState } from "../../src/seed.js";
import type { AppState, Project, Task, Workspace } from "../../src/types.js";
import { scheduleTaskForDateInState } from "./businessTaskOperations.js";

const workspace = (id: string, name: string): Workspace => ({
  id,
  name,
  type: "shared",
  ownerAccountId: "account_owner",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
});

const project = (workspaceId: string): Project => ({
  id: "project_shared",
  workspaceId,
  name: "协作项目",
  description: "",
  defaultExpectedStartHours: 24,
  taskStageMode: "software",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
});

const task = (workspaceId: string): Task => ({
  id: "task_shared",
  workspaceId,
  title: "协作任务",
  notes: "",
  tags: [],
  projectId: "project_shared",
  project: "协作项目",
  priority: "medium",
  severity: "medium",
  stage: "requirements",
  estimatePomodoros: 1,
  status: "pool",
  subtasks: [],
  sortOrder: 1,
  actualPomodoros: 0,
  estimateHistory: [],
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
});

const stateWithPrivateCurrentWorkspaceAndSharedTask = (): AppState => {
  const privateWorkspace = workspace("workspace_private", "私人工作区");
  const sharedWorkspace = workspace("workspace_shared", "协作工作区");
  const sharedProject = project(sharedWorkspace.id);
  return {
    ...createInitialState(),
    auth: {
      status: "authenticated",
      token: "token",
      account: {
        id: "account_owner",
        workspaceId: privateWorkspace.id,
        name: "王昱桥",
        email: "wyq@example.com",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
      workspace: privateWorkspace,
      workspaces: [privateWorkspace, sharedWorkspace],
      workspaceMemberships: [
        {
          id: "membership_private",
          workspaceId: privateWorkspace.id,
          accountId: "account_owner",
          name: "王昱桥",
          email: "wyq@example.com",
          role: "owner",
          status: "active",
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
        {
          id: "membership_shared",
          workspaceId: sharedWorkspace.id,
          accountId: "account_owner",
          name: "王昱桥",
          email: "wyq@example.com",
          role: "member",
          status: "active",
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      ],
      message: "ok",
    },
    projects: [sharedProject],
    tasks: [task(sharedWorkspace.id)],
    dailyPlans: [],
  };
};

describe("CLI business operations", () => {
  it("schedules a task into the task project workspace instead of the current private workspace", () => {
    const source = stateWithPrivateCurrentWorkspaceAndSharedTask();
    const next = scheduleTaskForDateInState(source, "task_shared", "2026-07-10", "2026-07-06T08:00:00.000Z");

    expect(next.tasks.find((item) => item.id === "task_shared")).toMatchObject({
      workspaceId: "workspace_shared",
      status: "committed",
    });
    expect(next.dailyPlans).toHaveLength(1);
    expect(next.dailyPlans[0]).toMatchObject({
      workspaceId: "workspace_shared",
      ownerAccountId: "account_owner",
      date: "2026-07-10",
      committedTaskIds: ["task_shared"],
    });
  });
});
