import { describe, expect, it } from "vitest";
import { createInitialState } from "./test/fixtures";
import { addProjectMemberToState, createProjectInState } from "./teamProgress";
import { projectAccessForCurrentMember } from "./projectDetail";
import type { AppState } from "./types";

describe("project detail access", () => {
  it("lets visible project members edit tasks while only owners review work", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const ownerAccess = projectAccessForCurrentMember(state, projectId);
    const withMember = addProjectMemberToState(
      state,
      projectId,
      "普通成员",
      "member@example.com",
      ["executor"],
      "2026-05-10T10:00:00.000Z",
      (prefix) => `${prefix}_member`,
    );
    const memberAccess = projectAccessForCurrentMember(
      {
        ...withMember,
        auth: {
          ...withMember.auth,
          status: "authenticated",
          account: {
            id: "account_member",
            workspaceId: "workspace_test",
            name: "普通成员",
            email: "member@example.com",
            createdAt: "2026-05-10T10:00:00.000Z",
            updatedAt: "2026-05-10T10:00:00.000Z",
          },
        },
      },
      projectId,
    );
    const nonMemberAccess = projectAccessForCurrentMember(
      {
        ...withMember,
        auth: {
          ...withMember.auth,
          status: "authenticated",
          account: {
            id: "account_missing",
            workspaceId: "workspace_other",
            name: "非项目成员",
            email: "missing@example.com",
            createdAt: "2026-05-10T10:00:00.000Z",
            updatedAt: "2026-05-10T10:00:00.000Z",
          },
        },
      },
      projectId,
    );
    const withSecondProject = createProjectInState(
      state,
      "同账号项目",
      "",
      "2026-05-10T11:00:00.000Z",
      (prefix) => `${prefix}_account`,
    );
    const accountProjectId = withSecondProject.projects[0].id;
    const accountScopedState: AppState = {
      ...withSecondProject,
      auth: {
        ...withSecondProject.auth,
        account: {
          id: "account_owner",
          workspaceId: "workspace_test",
          name: "负责人",
          email: "owner@example.com",
          createdAt: "2026-05-10T10:00:00.000Z",
          updatedAt: "2026-05-10T10:00:00.000Z",
        },
      },
      projectMembers: withSecondProject.projectMembers.map((member) =>
        member.projectId === accountProjectId ? { ...member, accountId: "account_owner" } : member,
      ),
    };
    const accountAccess = projectAccessForCurrentMember(accountScopedState, accountProjectId);
    const emailScopedState: AppState = {
      ...accountScopedState,
      projectMembers: accountScopedState.projectMembers.map((member) =>
        member.projectId === accountProjectId ? { ...member, accountId: undefined, email: "owner@example.com" } : member,
      ),
    };
    const emailAccess = projectAccessForCurrentMember(emailScopedState, accountProjectId);

    expect(ownerAccess).toMatchObject({ canView: true, canEditTasks: true, canReviewTasks: true });
    expect(memberAccess).toMatchObject({ canView: true, canEditTasks: true, canReviewTasks: false });
    expect(nonMemberAccess).toMatchObject({ canView: false, canEditTasks: false, canReviewTasks: false });
    expect(accountAccess).toMatchObject({ canView: true, canEditTasks: true, canReviewTasks: true });
    expect(emailAccess).toMatchObject({ canView: true, canEditTasks: true, canReviewTasks: true });
  });
});
