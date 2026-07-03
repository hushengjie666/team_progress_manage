import { describe, expect, it } from "vitest";
import { resolveMemberIdForProject } from "./memberIdentity";
import { createProjectTaskInState } from "./projectDetail";
import { createInitialState } from "./test/fixtures";
import {
  acceptTaskInState,
  createProjectInState,
  submitTaskForReviewInState,
} from "./teamProgress";
import type { AppState, ProjectMember } from "./types";

describe("team progress task creation", () => {
  it("creates and reviews tasks with the authenticated project member when currentMemberId is stale", () => {
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
    };
    const actorMemberId = resolveMemberIdForProject(loggedInState, owner.projectId);
    const created = createProjectTaskInState(
      loggedInState,
      owner.projectId,
      { title: "登录人创建的任务" },
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_identity_create`,
    );
    const taskId = created.tasks[0].id;
    const committed = {
      ...created,
      tasks: created.tasks.map((task) => (task.id === taskId ? { ...task, status: "in_progress" as const } : task)),
    };
    const submitted = submitTaskForReviewInState(committed, taskId, actorMemberId, "2026-05-10T11:00:00.000Z");
    const accepted = acceptTaskInState(submitted, taskId, actorMemberId, "2026-05-10T12:00:00.000Z");

    expect(created.tasks[0].creatorMemberId).toBe(owner.id);
    expect(submitted.tasks[0].reviewSubmittedByMemberId).toBe(owner.id);
    expect(accepted.tasks[0].reviewAcceptedByMemberId).toBe(owner.id);
  });

  it("defaults new task stages from the project type", () => {
    const state = createInitialState();
    const withRegularProject = createProjectInState(
      state,
      "常规项目",
      "",
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_regular_stage`,
      { taskStageMode: "regular" },
    );
    const regularTask = createProjectTaskInState(
      withRegularProject,
      "project_regular_stage",
      { title: "常规任务" },
      "2026-05-10T09:05:00.000Z",
      (prefix) => `${prefix}_regular_stage`,
    ).tasks[0];
    const softwareTask = createProjectTaskInState(
      state,
      state.projects[0].id,
      { title: "软件任务" },
      "2026-05-10T09:10:00.000Z",
      (prefix) => `${prefix}_software_stage`,
    ).tasks[0];

    expect(regularTask.stage).toBe("planning");
    expect(softwareTask.stage).toBe("requirements");
  });
});
