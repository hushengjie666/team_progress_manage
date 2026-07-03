import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed";
import { currentMemberForState, deriveWorkspaceModel } from "./workbenchModel";
import type { ProjectMember } from "./types";
import {
  workbenchTask,
  workbenchTimestamp,
  workbenchTodayPlan,
} from "./test/workbenchFixtures";

describe("workbench member identity", () => {
  it("uses the authenticated account and hides teammate work queue tasks", () => {
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
    const ownerTask = {
      ...workbenchTask("task_owner", "committed", 10),
      primaryExecutorMemberId: owner.id,
    };
    const teammateTask = {
      ...workbenchTask("task_teammate", "committed", 20),
      primaryExecutorMemberId: teammate.id,
    };
    const loggedInState = {
      ...state,
      auth: {
        ...state.auth,
        status: "authenticated" as const,
        account: {
          id: owner.accountId!,
          workspaceId: "workspace_test",
          name: owner.name,
          email: owner.email!,
          createdAt: workbenchTimestamp,
          updatedAt: workbenchTimestamp,
        },
      },
      projectMembers: [teammate, owner],
      tasks: [teammateTask, ownerTask],
    };
    const model = deriveWorkspaceModel(
      loggedInState,
      workbenchTodayPlan([ownerTask.id, teammateTask.id]),
      0,
      [teammateTask, ownerTask],
      [],
      [],
    );

    expect(currentMemberForState(loggedInState)?.id).toBe(owner.id);
    expect(model.committedWorkbenchTasks.map((item) => item.id)).toEqual(["task_owner"]);
  });

  it("does not fall back to another person when the authenticated account has no project member", () => {
    const state = createInitialState();
    const otherMember = {
      ...state.projectMembers[0],
      accountId: "account_other",
      email: "other@example.com",
      name: "王硕",
    };
    const otherTask = {
      ...workbenchTask("task_other", "committed", 10),
      primaryExecutorMemberId: otherMember.id,
    };
    const loggedInState = {
      ...state,
      auth: {
        ...state.auth,
        status: "authenticated" as const,
        account: {
          id: "account_current",
          workspaceId: "workspace_test",
          name: "胡圣杰",
          email: "hushengjie@example.com",
          createdAt: workbenchTimestamp,
          updatedAt: workbenchTimestamp,
        },
      },
      projectMembers: [otherMember],
      tasks: [otherTask],
    };
    const model = deriveWorkspaceModel(
      loggedInState,
      workbenchTodayPlan([otherTask.id]),
      0,
      [otherTask],
      [],
      [],
    );

    expect(currentMemberForState(loggedInState)).toBeUndefined();
    expect(model.committedWorkbenchTasks).toEqual([]);
  });
});
