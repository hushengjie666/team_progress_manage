import { describe, expect, it } from "vitest";
import type { AppState, WorkspaceMembership } from "../../src/types.js";
import { createInitialState } from "../../src/test/fixtures.js";
import {
  projectOverviewAccessNow,
  workspaceFixture,
  workspaceMembershipFixture,
} from "../../src/test/projectOverviewAccessFixtures.js";
import { listProjectViews, projectOverviewView } from "./views.js";

const sharedWorkspaceState = (): AppState => {
  const state = createInitialState();
  const workspaceId = "workspace_mcp_accessible_members";
  const workspace = workspaceFixture({ id: workspaceId });
  const workspaceMemberships: WorkspaceMembership[] = [
    workspaceMembershipFixture({
      id: "membership_mcp_owner",
      workspaceId,
      accountId: "account_owner",
      name: "负责人",
      email: "owner@example.com",
      role: "owner",
    }),
    workspaceMembershipFixture({
      id: "membership_mcp_teammate",
      workspaceId,
      accountId: "account_teammate",
      name: "协作成员",
      email: "teammate@example.com",
    }),
    workspaceMembershipFixture({
      id: "membership_mcp_disabled",
      workspaceId,
      accountId: "account_disabled",
      name: "停用成员",
      email: "disabled@example.com",
      status: "disabled",
    }),
  ];
  return {
    ...state,
    auth: {
      ...state.auth,
      workspace,
      workspaces: [workspace],
      workspaceMemberships,
    },
    projects: state.projects.map((project) => ({ ...project, workspaceId })),
    projectMembers: [
      {
        id: "member_mcp_project_owner",
        workspaceId,
        projectId: state.projects[0].id,
        accountId: "account_owner",
        name: "负责人",
        email: "owner@example.com",
        roles: ["project_owner", "executor"],
        status: "active",
        createdAt: projectOverviewAccessNow,
        updatedAt: projectOverviewAccessNow,
      },
      {
        id: "member_mcp_project_only",
        workspaceId,
        projectId: state.projects[0].id,
        accountId: "account_project_only",
        name: "项目单独成员",
        email: "project-only@example.com",
        roles: ["executor"],
        status: "active",
        createdAt: projectOverviewAccessNow,
        updatedAt: projectOverviewAccessNow,
      },
      {
        id: "member_mcp_project_disabled",
        workspaceId,
        projectId: state.projects[0].id,
        accountId: "account_project_disabled",
        name: "停用项目成员",
        email: "project-disabled@example.com",
        roles: ["executor"],
        status: "disabled",
        createdAt: projectOverviewAccessNow,
        updatedAt: projectOverviewAccessNow,
      },
    ],
  };
};

describe("MCP project views", () => {
  it("reports project member counts using accessible project members", () => {
    const state = sharedWorkspaceState();
    const projectId = state.projects[0].id;

    expect(listProjectViews(state).find((project) => project.id === projectId)).toMatchObject({
      memberCount: 3,
    });
    expect(projectOverviewView(state, projectId).project).toMatchObject({
      memberCount: 3,
    });
  });
});
