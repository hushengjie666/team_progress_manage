import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed";
import { currentMemberForState, deriveWorkspaceModel } from "./workbenchModel";
import type { WorkspaceMembership } from "./types";
import {
  workbenchTask,
  workbenchTimestamp,
  workbenchTodayPlan,
} from "./test/workbenchFixtures";

describe("workbench workspace access", () => {
  it("shows workspace-accessible projects and their active tasks even without a project member binding", () => {
    const state = createInitialState();
    const workspaceId = "workspace_disinfection";
    const unassignedTask = {
      ...workbenchTask("task_disinfection_unassigned", "pool", 10),
      projectId: state.projects[0].id,
      project: "消毒中心",
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
    };
    const otherAssignedTask = {
      ...workbenchTask("task_disinfection_assigned_other", "pool", 20),
      projectId: state.projects[0].id,
      project: "消毒中心",
      primaryExecutorMemberId: "member_other",
    };
    const membership: WorkspaceMembership = {
      id: "membership_wangshuo_disinfection",
      workspaceId,
      accountId: "account_wangshuo",
      name: "王硕",
      email: "wangshuo@example.com",
      role: "member",
      status: "active",
      createdAt: workbenchTimestamp,
      updatedAt: workbenchTimestamp,
    };
    const loggedInState = {
      ...state,
      auth: {
        ...state.auth,
        status: "authenticated" as const,
        account: {
          id: "account_wangshuo",
          workspaceId,
          name: "王硕",
          email: "wangshuo@example.com",
          createdAt: workbenchTimestamp,
          updatedAt: workbenchTimestamp,
        },
        workspace: {
          id: workspaceId,
          name: "宁波团队出击",
          type: "shared" as const,
          ownerAccountId: "account_owner",
          createdAt: workbenchTimestamp,
          updatedAt: workbenchTimestamp,
        },
        workspaces: [{
          id: workspaceId,
          name: "宁波团队出击",
          type: "shared" as const,
          ownerAccountId: "account_owner",
          createdAt: workbenchTimestamp,
          updatedAt: workbenchTimestamp,
        }],
        workspaceMemberships: [membership],
      },
      projects: state.projects.map((project) => ({ ...project, name: "消毒中心", workspaceId })),
      projectMembers: [],
      tasks: [unassignedTask, otherAssignedTask],
    };

    const model = deriveWorkspaceModel(
      loggedInState,
      workbenchTodayPlan(),
      0,
      [],
      [unassignedTask, otherAssignedTask],
      [],
    );

    expect(currentMemberForState(loggedInState)).toBeUndefined();
    expect(model.myProjectTaskCards.map((card) => card.name)).toEqual(["消毒中心"]);
    expect(model.availableWorkbenchProjectIds).toEqual([state.projects[0].id]);
    expect(model.poolWorkbenchTasks.map((item) => item.id)).toEqual([
      "task_disinfection_unassigned",
      "task_disinfection_assigned_other",
    ]);
  });

  it("does not treat the authenticated workspace list as access without membership or project binding", () => {
    const state = createInitialState();
    const privateWorkspace = {
      id: "workspace_wangshuo_private",
      name: "王硕的私人工作区",
      type: "private" as const,
      ownerAccountId: "account_wangshuo",
      createdAt: workbenchTimestamp,
      updatedAt: workbenchTimestamp,
    };
    const sharedWorkspace = {
      id: "workspace_disinfection",
      name: "宁波团队出击",
      type: "shared" as const,
      ownerAccountId: "account_owner",
      createdAt: workbenchTimestamp,
      updatedAt: workbenchTimestamp,
    };
    const unassignedTask = {
      ...workbenchTask("task_disinfection_unassigned", "pool", 10),
      projectId: state.projects[0].id,
      project: "消毒中心",
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
    };
    const loggedInState = {
      ...state,
      auth: {
        ...state.auth,
        status: "authenticated" as const,
        account: {
          id: "account_wangshuo",
          workspaceId: privateWorkspace.id,
          name: "王硕",
          email: "wangshuo@example.com",
          createdAt: workbenchTimestamp,
          updatedAt: workbenchTimestamp,
        },
        workspace: privateWorkspace,
        workspaces: [privateWorkspace, sharedWorkspace],
        workspaceMemberships: [],
      },
      projects: state.projects.map((project) => ({ ...project, name: "消毒中心", workspaceId: sharedWorkspace.id })),
      projectMembers: [],
      tasks: [unassignedTask],
    };

    const model = deriveWorkspaceModel(
      loggedInState,
      workbenchTodayPlan(),
      0,
      [],
      [unassignedTask],
      [],
    );

    expect(currentMemberForState(loggedInState)).toBeUndefined();
    expect(model.myProjectTaskCards.map((card) => card.name)).toEqual([]);
    expect(model.poolWorkbenchTasks.map((item) => item.id)).toEqual([]);
  });
});
