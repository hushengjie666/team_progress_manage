import { describe, expect, it } from "vitest";
import { createInitialState } from "./test/fixtures";
import {
  accessibleProjectIdsForCurrentUser,
  buildProjectOverviewCards,
} from "./projectOverview";
import type { AppState } from "./types";
import {
  projectOverviewAccessNow,
  workspaceFixture,
  workspaceMembershipFixture,
} from "./test/projectOverviewAccessFixtures";

describe("project overview invitation access", () => {
  it("does not treat workspace summaries as workspace-level access for project invitees", () => {
    const state = createInitialState();
    const sharedWorkspace = workspaceFixture({
      id: "workspace_summary_only",
      name: "摘要协作区",
    });
    const privateWorkspace = workspaceFixture({
      id: "workspace_private_invitee",
      name: "受邀者私人区",
      type: "private",
      ownerAccountId: "account_invitee",
    });
    const invitedProject = { ...state.projects[0], id: "project_invited_only", name: "受邀项目", workspaceId: sharedWorkspace.id };
    const hiddenProject = { ...state.projects[0], id: "project_workspace_hidden", name: "工作区隐藏项目", workspaceId: sharedWorkspace.id };
    const privateMembership = workspaceMembershipFixture({
      id: "membership_private_invitee",
      workspaceId: privateWorkspace.id,
      accountId: "account_invitee",
      name: "受邀者",
      email: "invitee@example.com",
      role: "owner",
    });
    const next: AppState = {
      ...state,
      auth: {
        ...state.auth,
        status: "authenticated",
        account: {
          id: "account_invitee",
          workspaceId: privateWorkspace.id,
          name: "受邀者",
          email: "invitee@example.com",
          createdAt: projectOverviewAccessNow,
          updatedAt: projectOverviewAccessNow,
        },
        workspace: privateWorkspace,
        workspaces: [privateWorkspace, sharedWorkspace],
        membership: privateMembership,
        workspaceMemberships: [privateMembership],
      },
      projects: [invitedProject, hiddenProject],
      projectMembers: [
        {
          id: "member_invited_only",
          workspaceId: sharedWorkspace.id,
          projectId: invitedProject.id,
          accountId: "account_invitee",
          name: "受邀者",
          email: "invitee@example.com",
          roles: ["executor"],
          status: "active",
          createdAt: projectOverviewAccessNow,
          updatedAt: projectOverviewAccessNow,
        },
      ],
      tasks: [],
    };

    expect([...accessibleProjectIdsForCurrentUser(next)].sort()).toEqual([invitedProject.id]);
    expect(buildProjectOverviewCards(next).map((card) => card.projectId)).toEqual([invitedProject.id]);
    expect(buildProjectOverviewCards(next)[0]).toMatchObject({
      memberCount: 2,
      workspaceName: "摘要协作区",
    });
  });
});
