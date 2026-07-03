import { describe, expect, it } from "vitest";
import { startTimerInState } from "./appModel";
import { createInitialState } from "./test/fixtures";
import {
  addProjectMemberToState,
  assignTaskInState,
  updateProjectMemberInState,
} from "./teamProgress";
import type { AppState, ProjectMember } from "./types";

describe("team progress member transitions", () => {
  it("adds and updates project members with project-scoped roles", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const withMember = addProjectMemberToState(
      state,
      projectId,
      "张三",
      "zhangsan@example.com",
      ["executor", "project_owner", "executor"],
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_zhangsan`,
    );
    expect(withMember.projectMembers[0]).toMatchObject({
      id: "member_zhangsan",
      projectId,
      name: "张三",
      roles: ["executor", "project_owner"],
    });
    const updated = updateProjectMemberInState(
      withMember,
      { ...withMember.projectMembers[0], roles: [] },
      "2026-05-10T11:00:00.000Z",
    );
    expect(updated.projectMembers[0].roles).toEqual(["executor"]);
  });

  it("updates project member profile data in place", () => {
    const state = createInitialState();
    const projectMember = state.projectMembers[0];
    const updated = updateProjectMemberInState(
      state,
      { ...projectMember, name: "负责人 A", email: "owner-a@example.com" },
      "2026-05-10T11:00:00.000Z",
    );

    expect(updated.projectMembers.find((member) => member.id === projectMember.id)).toMatchObject({
      name: "负责人 A",
      email: "owner-a@example.com",
      updatedAt: "2026-05-10T11:00:00.000Z",
    });
    expect(updated.updatedAt).toBe("2026-05-10T11:00:00.000Z");
  });

  it("disables a project member and keeps task assignment cleanup project scoped", () => {
    const state = createInitialState();
    const disabled = updateProjectMemberInState(
      state,
      { ...state.projectMembers[0], status: "disabled" },
      "2026-05-10T11:00:00.000Z",
    );

    expect(disabled.projectMembers.find((member) => member.id === "member_owner")).toMatchObject({
      status: "disabled",
      updatedAt: "2026-05-10T11:00:00.000Z",
    });
  });

  it("assigns a task to one primary executor and keeps collaborators separate", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const withMembers = addProjectMemberToState(
      addProjectMemberToState(
        state,
        projectId,
        "张三",
        "",
        ["executor"],
        "2026-05-10T10:00:00.000Z",
        (prefix) => `${prefix}_zhangsan`,
      ),
      projectId,
      "李四",
      "",
      ["executor"],
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_lisi`,
    );
    const assigned = assignTaskInState(withMembers, withMembers.tasks[0].id, {
      primaryExecutorMemberId: "member_zhangsan",
      collaboratorMemberIds: ["member_zhangsan", "member_lisi"],
    }, "2026-05-10T11:00:00.000Z");
    expect(assigned.tasks[0].primaryExecutorMemberId).toBe("member_zhangsan");
    expect(assigned.tasks[0].collaboratorMemberIds).toEqual(["member_lisi"]);

    const reassigned = assignTaskInState(assigned, assigned.tasks[0].id, {
      primaryExecutorMemberId: "member_lisi",
      collaboratorMemberIds: ["member_zhangsan", "member_lisi"],
    }, "2026-05-10T12:00:00.000Z");
    expect(reassigned.tasks[0].primaryExecutorMemberId).toBe("member_lisi");
    expect(reassigned.tasks[0].collaboratorMemberIds).toEqual(["member_zhangsan"]);
  });

  it("leaves a task unassigned when the selected member is not an executor", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const withOwnerOnly = addProjectMemberToState(
      state,
      projectId,
      "只负责验收的人",
      "",
      ["project_owner"],
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_owner_only`,
    );
    const assigned = assignTaskInState(withOwnerOnly, withOwnerOnly.tasks[0].id, {
      primaryExecutorMemberId: "member_owner_only",
      collaboratorMemberIds: ["member_owner_only"],
    });
    expect(assigned.tasks[0].primaryExecutorMemberId).toBeUndefined();
    expect(assigned.tasks[0].collaboratorMemberIds).toEqual(["member_owner_only"]);
  });

  it("claims unassigned tasks for the authenticated account instead of a stale current member", () => {
    const state = createInitialState();
    const owner = state.projectMembers[0];
    const teammate: ProjectMember = {
      ...owner,
      id: "member_teammate",
      accountId: "account_teammate",
      name: "王硕",
      email: "wangshuo@example.com",
      roles: ["executor"],
    };
    const taskId = state.tasks[0].id;
    const loggedInState: AppState = {
      ...state,
      auth: {
        ...state.auth,
        status: "authenticated",
        account: {
          id: owner.accountId!,
          workspaceId: "workspace_test",
          name: owner.name,
          email: owner.email!,
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      projectMembers: [teammate, owner],
      tasks: state.tasks.map((task, index) =>
        index === 0
          ? { ...task, primaryExecutorMemberId: undefined, collaboratorMemberIds: [], status: "pool" as const }
          : task,
      ),
    };

    const started = startTimerInState(
      loggedInState,
      "focus",
      taskId,
      "2026-05-10T10:00:00.000Z",
      "session_identity_claim",
    );

    expect(started.tasks.find((task) => task.id === taskId)?.primaryExecutorMemberId).toBe(owner.id);
    expect(started.workSessions.find((session) => session.taskId === taskId)?.executorMemberId).toBe(owner.id);
  });
});
