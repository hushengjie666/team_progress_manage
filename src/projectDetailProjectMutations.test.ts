import { describe, expect, it } from "vitest";
import { createInitialState } from "./test/fixtures";
import { createProjectInState, updateProjectInState } from "./teamProgress";
import type { Task } from "./types";

describe("project detail project mutations", () => {
  it("creates projects with a project owner who can also execute work", () => {
    const state = createInitialState();
    const next = createProjectInState(
      state,
      "客户交付项目",
      "跟进客户上线",
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_test`,
    );
    expect(next.projects[0]).toMatchObject({
      id: "project_test",
      name: "客户交付项目",
      defaultExpectedStartHours: 24,
    });
    expect(next.projectMembers[0]).toMatchObject({
      id: "member_test",
      projectId: "project_test",
      roles: ["project_owner", "executor"],
    });
  });

  it("creates cross-workspace project owners as project-scoped bindings", () => {
    const state = createInitialState();
    const next = createProjectInState(
      {
        ...state,
        projects: [],
        projectMembers: [],
      },
      "跨工作区项目",
      "",
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_workspace_b`,
      {
        workspaceId: "workspace_b",
        accountId: "account_owner",
        name: "负责人",
        email: "owner@example.com",
      },
    );

    expect(next.projectMembers[0]).toMatchObject({
      projectId: "project_workspace_b",
      workspaceId: "workspace_b",
      accountId: "account_owner",
      name: "负责人",
      email: "owner@example.com",
    });
  });

  it("moves project-scoped data to another workspace", () => {
    const state = createInitialState();
    const timestamp = "2026-05-10T10:00:00.000Z";
    const project = { ...state.projects[0], id: "project_move", workspaceId: "workspace_a", name: "迁移前项目" };
    const sourceProjectMember = {
      ...state.projectMembers[0],
      id: "member_move_owner",
      workspaceId: "workspace_a",
      projectId: "project_move",
      accountId: "account_owner",
      email: "owner@example.com",
    };
    const movingTask: Task = {
      ...state.tasks[0],
      id: "task_move",
      workspaceId: "workspace_a",
      projectId: "project_move",
      project: "迁移前项目",
      title: "迁移任务",
      updatedAt: "2026-05-10T09:00:00.000Z",
    };
    const next = updateProjectInState(
      {
        ...state,
        projects: [project],
        projectMembers: [sourceProjectMember],
        tasks: [movingTask],
        workSessions: [
          {
            id: "work_session_move",
            workspaceId: "workspace_a",
            taskId: "task_move",
            focusSessionId: "focus_session_move",
            status: "active",
            totalPausedSeconds: 0,
            startedAt: "2026-05-10T09:10:00.000Z",
            createdAt: "2026-05-10T09:10:00.000Z",
            updatedAt: "2026-05-10T09:10:00.000Z",
          },
        ],
        executionSignals: [
          {
            id: "signal_move",
            workspaceId: "workspace_a",
            workSessionId: "work_session_move",
            taskId: "task_move",
            type: "work_started",
            createdAt: "2026-05-10T09:20:00.000Z",
          },
        ],
      },
      { ...project, workspaceId: "workspace_b", name: "迁移后项目" },
      timestamp,
      (prefix) => `${prefix}_workspace_b_owner`,
    );

    expect(next.projects[0]).toMatchObject({ workspaceId: "workspace_b", name: "迁移后项目" });
    expect(next.projectMembers[0]).toMatchObject({
      workspaceId: "workspace_b",
      accountId: "account_owner",
      email: "owner@example.com",
      updatedAt: timestamp,
    });
    expect(next.tasks[0]).toMatchObject({ workspaceId: "workspace_b", project: "迁移后项目", updatedAt: timestamp });
    expect(next.workSessions[0]).toMatchObject({ workspaceId: "workspace_b", updatedAt: timestamp });
    expect(next.executionSignals[0]).toMatchObject({ workspaceId: "workspace_b" });
    expect(next.sync.tombstones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity: "project", id: "project_move", workspaceId: "workspace_a" }),
        expect.objectContaining({ entity: "project_member", id: "member_move_owner", workspaceId: "workspace_a" }),
        expect.objectContaining({ entity: "task", id: "task_move", workspaceId: "workspace_a" }),
        expect.objectContaining({ entity: "work_session", id: "work_session_move", workspaceId: "workspace_a" }),
        expect.objectContaining({ entity: "execution_signal", id: "signal_move", workspaceId: "workspace_a" }),
      ]),
    );
  });
});
